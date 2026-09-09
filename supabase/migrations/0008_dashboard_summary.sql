-- ============================================================================
-- Migration 0008: dashboard_summary() - every number on the dashboard is
-- computed live, in one round trip, straight from payments/receipts/
-- student_fee_summary. Nothing here is cached or hard-coded (spec #29/#47).
-- ============================================================================

create or replace function dashboard_summary()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_current_year_id uuid;
  v_result jsonb;
begin
  if not has_permission('dashboard.view') then
    raise exception 'PERMISSION_DENIED: dashboard.view required';
  end if;

  select id into v_current_year_id from academic_years where org_id = v_org_id and is_current = true limit 1;

  select jsonb_build_object(
    'today_collection', coalesce((
      select sum(amount) from payments
      where org_id = v_org_id and status = 'COMPLETED' and payment_date = current_date
    ), 0),
    'month_collection', coalesce((
      select sum(amount) from payments
      where org_id = v_org_id and status = 'COMPLETED'
        and date_trunc('month', payment_date) = date_trunc('month', current_date)
    ), 0),
    'year_collection', coalesce((
      select sum(p.amount) from payments p
      join student_fee_accounts sfa on sfa.id = p.student_fee_account_id
      where p.org_id = v_org_id and p.status = 'COMPLETED'
        and (v_current_year_id is null or sfa.academic_year_id = v_current_year_id)
    ), 0),
    'total_outstanding', coalesce((
      select sum(outstanding_total) from student_fee_summary where org_id = v_org_id
    ), 0),
    'overdue_amount', coalesce((
      select sum(overdue_amount) from student_fee_summary where org_id = v_org_id
    ), 0),
    'students_with_outstanding', coalesce((
      select count(distinct student_id) from student_fee_summary where org_id = v_org_id and outstanding_total > 0
    ), 0),
    'fully_paid_students', coalesce((
      select count(distinct student_id) from student_fee_summary where org_id = v_org_id and overall_status = 'FULLY_PAID'
    ), 0),
    'total_students', coalesce((
      select count(*) from students where org_id = v_org_id and status = 'ACTIVE'
    ), 0),
    'collection_by_mode', coalesce((
      select jsonb_agg(jsonb_build_object('mode', payment_mode, 'amount', total))
      from (
        select payment_mode, sum(amount) as total
        from payments
        where org_id = v_org_id and status = 'COMPLETED'
          and date_trunc('month', payment_date) = date_trunc('month', current_date)
        group by payment_mode
        order by total desc
      ) t
    ), '[]'::jsonb),
    'collection_by_course', coalesce((
      select jsonb_agg(jsonb_build_object('course', course_name, 'amount', total))
      from (
        select coalesce(c.name, 'Unassigned') as course_name, sum(p.amount) as total
        from payments p
        join students s on s.id = p.student_id
        left join courses c on c.id = s.course_id
        where p.org_id = v_org_id and p.status = 'COMPLETED'
          and date_trunc('month', p.payment_date) = date_trunc('month', current_date)
        group by c.name
        order by total desc
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function dashboard_summary() to authenticated;

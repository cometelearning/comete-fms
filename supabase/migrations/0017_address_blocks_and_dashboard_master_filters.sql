-- ============================================================================
-- Migration 0017: two independent changes shipped together.
--
-- 1) Student address becomes structured blocks (Plot/Flat No., Area,
--    Landmark, PIN Code, District) instead of one free-text box. The old
--    `address` column is left in place (never destructively removed) so
--    every existing student's previously entered address text is still
--    readable - the student profile falls back to showing it, clearly
--    labelled as legacy, whenever none of the five new fields have been
--    filled in yet for that student. New/edited students go through the new
--    fields instead; `address` is simply never written to again.
--
-- 2) dashboard_summary() gains Branch/Batch/Board filters (students carries
--    branch_id/batch_id/board_id directly, so this is a plain equality
--    filter - no join needed) and its Class filter is rewritten from the
--    old p_class_standard text-equality match to a proper p_class_id match
--    against the course_classes join table (migration 0016). This fixes the
--    known limitation flagged when many-to-many Course<->Class shipped: a
--    course tagged to more than one class could under-match on the
--    Dashboard even though Collection/Outstanding/Student Record reports
--    already matched correctly. The function signature changes (a
--    text-based class filter can't safely become a uuid-based one in
--    place), so the old 3-arg overload is dropped explicitly.
-- ============================================================================

alter table students
  add column if not exists plot_flat_no text,
  add column if not exists area text,
  add column if not exists landmark text,
  add column if not exists pincode text,
  add column if not exists district text;

drop function if exists dashboard_summary(uuid, uuid, text);

create or replace function dashboard_summary(
  p_academic_year_id uuid default null,
  p_course_id uuid default null,
  p_class_id uuid default null,
  p_branch_id uuid default null,
  p_batch_id uuid default null,
  p_board_id uuid default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_current_year_id uuid;
  v_year_filter uuid;
  v_result jsonb;
begin
  if not has_permission('dashboard.view') then
    raise exception 'PERMISSION_DENIED: dashboard.view required';
  end if;

  select id into v_current_year_id from academic_years where org_id = v_org_id and is_current = true limit 1;
  v_year_filter := coalesce(p_academic_year_id, v_current_year_id);

  select jsonb_build_object(
    'today_collection', coalesce((
      select sum(p.amount)
      from payments p
      join students s on s.id = p.student_id
      left join courses c on c.id = s.course_id
      where p.org_id = v_org_id and p.status = 'COMPLETED' and p.payment_date = current_date
        and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'month_collection', coalesce((
      select sum(p.amount)
      from payments p
      join students s on s.id = p.student_id
      left join courses c on c.id = s.course_id
      where p.org_id = v_org_id and p.status = 'COMPLETED'
        and date_trunc('month', p.payment_date) = date_trunc('month', current_date)
        and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'year_collection', coalesce((
      select sum(p.amount)
      from payments p
      join student_fee_accounts sfa on sfa.id = p.student_fee_account_id
      join students s on s.id = p.student_id
      left join courses c on c.id = s.course_id
      where p.org_id = v_org_id and p.status = 'COMPLETED'
        and (v_year_filter is null or sfa.academic_year_id = v_year_filter)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'total_outstanding', coalesce((
      select sum(sfs.outstanding_total)
      from student_fee_summary sfs
      join students s on s.id = sfs.student_id
      left join courses c on c.id = s.course_id
      where sfs.org_id = v_org_id
        and (p_academic_year_id is null or sfs.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'overdue_amount', coalesce((
      select sum(sfs.overdue_amount)
      from student_fee_summary sfs
      join students s on s.id = sfs.student_id
      left join courses c on c.id = s.course_id
      where sfs.org_id = v_org_id
        and (p_academic_year_id is null or sfs.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'students_with_outstanding', coalesce((
      select count(distinct sfs.student_id)
      from student_fee_summary sfs
      join students s on s.id = sfs.student_id
      left join courses c on c.id = s.course_id
      where sfs.org_id = v_org_id and sfs.outstanding_total > 0
        and (p_academic_year_id is null or sfs.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'fully_paid_students', coalesce((
      select count(distinct sfs.student_id)
      from student_fee_summary sfs
      join students s on s.id = sfs.student_id
      left join courses c on c.id = s.course_id
      where sfs.org_id = v_org_id and sfs.overall_status = 'FULLY_PAID'
        and (p_academic_year_id is null or sfs.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'total_students', coalesce((
      select count(*)
      from students s
      left join courses c on c.id = s.course_id
      where s.org_id = v_org_id and s.status = 'ACTIVE'
        and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'collection_by_mode', coalesce((
      select jsonb_agg(jsonb_build_object('mode', payment_mode, 'amount', total))
      from (
        select p.payment_mode, sum(p.amount) as total
        from payments p
        join students s on s.id = p.student_id
        left join courses c on c.id = s.course_id
        where p.org_id = v_org_id and p.status = 'COMPLETED'
          and date_trunc('month', p.payment_date) = date_trunc('month', current_date)
          and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
          and (p_course_id is null or s.course_id = p_course_id)
          and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
          and (p_branch_id is null or s.branch_id = p_branch_id)
          and (p_batch_id is null or s.batch_id = p_batch_id)
          and (p_board_id is null or s.board_id = p_board_id)
        group by p.payment_mode
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
          and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
          and (p_course_id is null or s.course_id = p_course_id)
          and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
          and (p_branch_id is null or s.branch_id = p_branch_id)
          and (p_batch_id is null or s.batch_id = p_batch_id)
          and (p_board_id is null or s.board_id = p_board_id)
        group by c.name
        order by total desc
      ) t
    ), '[]'::jsonb),
    'collection_by_class', coalesce((
      select jsonb_agg(jsonb_build_object('class', class_name, 'amount', total))
      from (
        select coalesce(c.class_standard, 'Unassigned') as class_name, sum(p.amount) as total
        from payments p
        join students s on s.id = p.student_id
        left join courses c on c.id = s.course_id
        where p.org_id = v_org_id and p.status = 'COMPLETED'
          and date_trunc('month', p.payment_date) = date_trunc('month', current_date)
          and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
          and (p_course_id is null or s.course_id = p_course_id)
          and (p_class_id is null or exists (select 1 from course_classes cc where cc.course_id = s.course_id and cc.class_id = p_class_id))
          and (p_branch_id is null or s.branch_id = p_branch_id)
          and (p_batch_id is null or s.batch_id = p_batch_id)
          and (p_board_id is null or s.board_id = p_board_id)
        group by c.class_standard
        order by total desc
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function dashboard_summary(uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;

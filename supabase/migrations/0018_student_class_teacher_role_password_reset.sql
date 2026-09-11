-- ============================================================================
-- Migration 0018: three independent changes shipped together.
--
-- 1) Fixes a real bug reported by the user: since Course<->Class became
--    many-to-many (migration 0016), `courses.class_standard` is an
--    aggregate of EVERY class a course is tagged to ("Class 11, Class 12"),
--    not the one class a specific student is actually in. Every report/
--    profile screen that displayed a student's Class by reading it off
--    their course was therefore showing every class the course happens to
--    be tagged to, not just theirs. The fix is to store the student's own
--    Class directly (`students.class_id`) - it was already being captured
--    on the Add/Edit Student form's cascading Class select, just never sent
--    to the API. Existing students are backfilled where unambiguous.
--
-- 2) Adds a `teacher` role (per explicit request) and a `password_reset_tokens`
--    table backing a new self-service "forgot password" flow. Role/permission
--    management itself needs NO schema change - `roles`/`permissions`/
--    `role_permissions` and their RLS policies (migration 0001/0003) already
--    support creating custom roles and editing any non-super-admin role's
--    permission set; only the app needed a UI for it (see the code round
--    shipped alongside this migration).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) students.class_id
-- ----------------------------------------------------------------------------
alter table students add column if not exists class_id uuid references classes(id);
create index if not exists idx_students_class on students(class_id);

-- Backfill only where unambiguous: the student's course is (still) tagged to
-- exactly one class. Students whose course is tagged to 2+ classes are left
-- null - there is no way to know which one was originally intended, since
-- the old schema never stored it separately. Same graceful pattern as every
-- other newly-mandatory field added in this project: the office fills it in
-- the next time that student is opened for editing.
update students s
set class_id = single.class_id
from (
  select course_id, min(class_id::text)::uuid as class_id
  from course_classes
  group by course_id
  having count(*) = 1
) single
where s.course_id = single.course_id
  and s.class_id is null;

-- dashboard_summary(): the class filter becomes a plain `s.class_id =
-- p_class_id` equality (no join needed - simpler AND more correct than the
-- course_classes EXISTS check from migration 0017, which matched if the
-- student's course was tagged to the filtered class at all, even via a
-- different class the student isn't actually in). The `collection_by_class`
-- breakdown is also fixed the same way: it now groups by the student's own
-- class (via a join to `classes`) instead of by `courses.class_standard`,
-- so a course tagged to two classes no longer merges into one combined bar -
-- this was flagged as a known nuance in migration 0017 and is fully
-- resolved now that students carry their own class_id. Signature is
-- unchanged (still 6 uuid params), so this is a plain replace, no drop
-- needed.
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
      where p.org_id = v_org_id and p.status = 'COMPLETED' and p.payment_date = current_date
        and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or s.class_id = p_class_id)
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'month_collection', coalesce((
      select sum(p.amount)
      from payments p
      join students s on s.id = p.student_id
      where p.org_id = v_org_id and p.status = 'COMPLETED'
        and date_trunc('month', p.payment_date) = date_trunc('month', current_date)
        and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or s.class_id = p_class_id)
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'year_collection', coalesce((
      select sum(p.amount)
      from payments p
      join student_fee_accounts sfa on sfa.id = p.student_fee_account_id
      join students s on s.id = p.student_id
      where p.org_id = v_org_id and p.status = 'COMPLETED'
        and (v_year_filter is null or sfa.academic_year_id = v_year_filter)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or s.class_id = p_class_id)
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'total_outstanding', coalesce((
      select sum(sfs.outstanding_total)
      from student_fee_summary sfs
      join students s on s.id = sfs.student_id
      where sfs.org_id = v_org_id
        and (p_academic_year_id is null or sfs.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or s.class_id = p_class_id)
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'overdue_amount', coalesce((
      select sum(sfs.overdue_amount)
      from student_fee_summary sfs
      join students s on s.id = sfs.student_id
      where sfs.org_id = v_org_id
        and (p_academic_year_id is null or sfs.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or s.class_id = p_class_id)
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'students_with_outstanding', coalesce((
      select count(distinct sfs.student_id)
      from student_fee_summary sfs
      join students s on s.id = sfs.student_id
      where sfs.org_id = v_org_id and sfs.outstanding_total > 0
        and (p_academic_year_id is null or sfs.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or s.class_id = p_class_id)
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'fully_paid_students', coalesce((
      select count(distinct sfs.student_id)
      from student_fee_summary sfs
      join students s on s.id = sfs.student_id
      where sfs.org_id = v_org_id and sfs.overall_status = 'FULLY_PAID'
        and (p_academic_year_id is null or sfs.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or s.class_id = p_class_id)
        and (p_branch_id is null or s.branch_id = p_branch_id)
        and (p_batch_id is null or s.batch_id = p_batch_id)
        and (p_board_id is null or s.board_id = p_board_id)
    ), 0),
    'total_students', coalesce((
      select count(*)
      from students s
      where s.org_id = v_org_id and s.status = 'ACTIVE'
        and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
        and (p_course_id is null or s.course_id = p_course_id)
        and (p_class_id is null or s.class_id = p_class_id)
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
        where p.org_id = v_org_id and p.status = 'COMPLETED'
          and date_trunc('month', p.payment_date) = date_trunc('month', current_date)
          and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
          and (p_course_id is null or s.course_id = p_course_id)
          and (p_class_id is null or s.class_id = p_class_id)
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
          and (p_class_id is null or s.class_id = p_class_id)
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
        select coalesce(cl.name, 'Unassigned') as class_name, sum(p.amount) as total
        from payments p
        join students s on s.id = p.student_id
        left join classes cl on cl.id = s.class_id
        where p.org_id = v_org_id and p.status = 'COMPLETED'
          and date_trunc('month', p.payment_date) = date_trunc('month', current_date)
          and (p_academic_year_id is null or s.academic_year_id = p_academic_year_id)
          and (p_course_id is null or s.course_id = p_course_id)
          and (p_class_id is null or s.class_id = p_class_id)
          and (p_branch_id is null or s.branch_id = p_branch_id)
          and (p_batch_id is null or s.batch_id = p_batch_id)
          and (p_board_id is null or s.board_id = p_board_id)
        group by cl.name
        order by total desc
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Teacher role
-- ----------------------------------------------------------------------------
-- is_system = false (unlike the original 4 roles from bootstrap_organization)
-- so it can be renamed, deleted, or have its permissions freely edited from
-- the new Users > Roles & Permissions screen - it isn't one of the "must
-- always exist" roles the way Super Admin is.
insert into roles (org_id, key, name, is_system)
select o.id, 'teacher', 'Teacher', false
from organizations o
where not exists (select 1 from roles r where r.org_id = o.id and r.key = 'teacher');

-- Minimal default permission set (least privilege): Dashboard + Students,
-- read-only. Deliberately narrower than the Viewer role (which also sees
-- fees/receipts/outstanding/reports) since a fee-management system has no
-- inherent notion of what a teacher needs to see - broaden anytime from
-- Users > Roles & Permissions, no code/migration required.
insert into role_permissions (role_id, permission_key)
select r.id, p.key
from roles r
cross join (values ('dashboard.view'), ('students.read')) as p(key)
where r.key = 'teacher'
on conflict (role_id, permission_key) do nothing;

-- ----------------------------------------------------------------------------
-- 3) password_reset_tokens (backs the new self-service "forgot password" flow)
-- ----------------------------------------------------------------------------
create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_password_reset_tokens_hash on password_reset_tokens(token_hash);
create index if not exists idx_password_reset_tokens_user on password_reset_tokens(user_id);

-- RLS enabled with NO policies at all (default-deny): this table is only
-- ever touched by /api/auth/forgot-password and /api/auth/reset-password,
-- both of which use the service-role admin client (bypasses RLS) precisely
-- because there is no logged-in session yet when a token is issued or
-- redeemed. An ordinary authenticated user has no legitimate reason to read
-- or write a reset token directly, so nothing is granted here.
alter table password_reset_tokens enable row level security;

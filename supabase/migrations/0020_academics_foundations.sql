-- ============================================================================
-- Migration 0020: "Foundations" round for the upcoming Academics area.
--
-- Per explicit user request (verbatim): "Inactive students should not be
-- seen by default in any reports or dashboard, unless filter specifically
-- ask it for. Wherever students list are displayed, it should be counted
-- and shown at the bottom of the page. A separate Practice Slip Management
-- System (PSMS) be introduce as a tab... Create a subject master based on
-- classes... For that prepare teacher master also..." followed by the
-- user's explicit scope decision: "Go with Foundation Firsts and also move
-- PTM to academic section."
--
-- This migration ships only the FOUNDATIONS: Subject Master, Teacher
-- Master, and the dashboard_summary() change needed for "inactive students
-- hidden by default". Practice Slip Management, Student Performance Report
-- and Practice Copy Check are deliberately deferred to a later round.
--
-- The app-layer default-hide-inactive change (query builders + API routes)
-- ships alongside this migration but lives in application code, not SQL.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Subject Master - "based on classes" per the user's request: every subject
-- belongs to exactly one Class (e.g. Class 10 -> Mathematics, Science...).
-- Same simple pattern as Classes/Boards/Branches (masters.read/write), no
-- seed data - the user will enter these themselves.
-- ----------------------------------------------------------------------------
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  class_id uuid not null references classes(id),
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (org_id, class_id, name)
);

create index idx_subjects_org on subjects(org_id);
create index idx_subjects_class on subjects(class_id);

alter table subjects enable row level security;

create policy subjects_select on subjects for select
  using (org_id = current_org_id());
create policy subjects_cud on subjects for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

-- ----------------------------------------------------------------------------
-- Teacher Master - name + status only, per the user's request ("I will put
-- the teacher name"). Deliberately NOT a login/user account - this is a
-- plain reference list so future academic records (practice slips, student
-- performance, practice copy checks) can attribute a teacher name from a
-- dropdown, matching the project's "no Teacher Management module" boundary
-- (this is fee-management-adjacent academics data entry, not HR/payroll).
-- ----------------------------------------------------------------------------
create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index idx_teachers_org on teachers(org_id);

alter table teachers enable row level security;

create policy teachers_select on teachers for select
  using (org_id = current_org_id());
create policy teachers_cud on teachers for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

-- ----------------------------------------------------------------------------
-- dashboard_summary(): the four "current state" figures - Total Outstanding,
-- Overdue Amount, Students with Outstanding, Fully Paid Students - now only
-- count ACTIVE students by default, matching total_students (which already
-- filtered on s.status = 'ACTIVE' since migration 0008) and the user's
-- explicit "inactive students should not be seen by default... unless
-- filter specifically ask it for" instruction. The dashboard has no
-- status-override control (unlike the list/report screens, which gained an
-- explicit Student Status filter in this same round), so this is an
-- unconditional filter, not a p_status-style optional parameter.
--
-- The collection figures (today/month/year/by-mode/by-course/by-class) are
-- deliberately left unfiltered by student status: they report money already
-- collected - a historical fact - not a live roster, so a student who has
-- since been deactivated must not silently vanish from what the office
-- already collected (mirrors the project's "financial history must never
-- disappear silently" rule, spec #32).
--
-- Signature is unchanged from migration 0017 (still
-- dashboard_summary(uuid, uuid, uuid, uuid, uuid, uuid)) so this is a plain
-- create or replace, no drop/re-grant needed.
-- ============================================================================
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
      where sfs.org_id = v_org_id and s.status = 'ACTIVE'
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
      where sfs.org_id = v_org_id and s.status = 'ACTIVE'
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
      where sfs.org_id = v_org_id and sfs.outstanding_total > 0 and s.status = 'ACTIVE'
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
      where sfs.org_id = v_org_id and sfs.overall_status = 'FULLY_PAID' and s.status = 'ACTIVE'
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

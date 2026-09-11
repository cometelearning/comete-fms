-- ============================================================================
-- Migration 0021: Practice Slip Management (PSMS), Student Performance
-- Report, and Practice Copy Check - the "next round" deferred from migration
-- 0020's Foundations round, per the user's original request (verbatim,
-- abridged): "A separate Practice Slip Management System (PSMS) be
-- introduce as a tab and should be maped to student profile, wherein
-- teacher will allot practice slips of different subjects... Date, Student
-- Name, Practice Slip Topic & it's level (like Level 1, 2, or 3, NA). An
-- action button... teacher shall mark as the practice slip checked and
-- completed... A separate student performance report tab... exam date,
-- subject, topic, total marks and marks obtained, teacher name... option to
-- add more rows as and when needed... A separate tab... practice copy
-- check, wherein teacher will mention student name and date on which it is
-- checked and signed along with teacher name from the drop down."
--
-- All three are student-linked academic records (not master data, not
-- financial data), so they follow the ptm_records pattern from migration
-- 0014: RLS gated on students.read/students.write directly inside the
-- policy (not the lenient org-only masters pattern), no new permission keys
-- (reusing students.read/students.write, per the established "reuse
-- existing keys unless a backfill migration is worth it" rule - see item 6
-- of the project doc).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Practice Slip Management System (PSMS)
-- ----------------------------------------------------------------------------
create table if not exists practice_slips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  student_id uuid not null references students(id),
  subject_id uuid not null references subjects(id),
  slip_date date not null,
  topic text not null,
  level text not null check (level in ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'NA')),
  status text not null default 'PENDING' check (status in ('PENDING', 'CHECKED')),
  checked_at timestamptz,
  checked_by uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_practice_slips_org on practice_slips(org_id);
create index idx_practice_slips_student on practice_slips(student_id);
create index idx_practice_slips_subject on practice_slips(subject_id);
create index idx_practice_slips_date on practice_slips(slip_date);
create index idx_practice_slips_status on practice_slips(status);

alter table practice_slips enable row level security;

create policy practice_slips_select on practice_slips for select
  using (org_id = current_org_id() and has_permission('students.read'));
create policy practice_slips_cud on practice_slips for all
  using (org_id = current_org_id() and has_permission('students.write'))
  with check (org_id = current_org_id() and has_permission('students.write'));

create trigger trg_practice_slips_updated_at before update on practice_slips
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Student Performance Report (exam marks)
-- ----------------------------------------------------------------------------
create table if not exists student_performance_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  student_id uuid not null references students(id),
  exam_date date not null,
  subject_id uuid not null references subjects(id),
  topic text not null,
  total_marks numeric(10, 2) not null check (total_marks > 0),
  marks_obtained numeric(10, 2) not null check (marks_obtained >= 0),
  teacher_id uuid not null references teachers(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marks_obtained_within_total check (marks_obtained <= total_marks)
);

create index idx_student_performance_org on student_performance_records(org_id);
create index idx_student_performance_student on student_performance_records(student_id);
create index idx_student_performance_subject on student_performance_records(subject_id);
create index idx_student_performance_teacher on student_performance_records(teacher_id);
create index idx_student_performance_date on student_performance_records(exam_date);

alter table student_performance_records enable row level security;

create policy student_performance_select on student_performance_records for select
  using (org_id = current_org_id() and has_permission('students.read'));
create policy student_performance_cud on student_performance_records for all
  using (org_id = current_org_id() and has_permission('students.write'))
  with check (org_id = current_org_id() and has_permission('students.write'));

create trigger trg_student_performance_updated_at before update on student_performance_records
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Practice Copy Check
-- ----------------------------------------------------------------------------
create table if not exists practice_copy_checks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  student_id uuid not null references students(id),
  check_date date not null,
  teacher_id uuid not null references teachers(id),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_practice_copy_checks_org on practice_copy_checks(org_id);
create index idx_practice_copy_checks_student on practice_copy_checks(student_id);
create index idx_practice_copy_checks_teacher on practice_copy_checks(teacher_id);
create index idx_practice_copy_checks_date on practice_copy_checks(check_date);

alter table practice_copy_checks enable row level security;

create policy practice_copy_checks_select on practice_copy_checks for select
  using (org_id = current_org_id() and has_permission('students.read'));
create policy practice_copy_checks_cud on practice_copy_checks for all
  using (org_id = current_org_id() and has_permission('students.write'))
  with check (org_id = current_org_id() and has_permission('students.write'));

create trigger trg_practice_copy_checks_updated_at before update on practice_copy_checks
  for each row execute function set_updated_at();

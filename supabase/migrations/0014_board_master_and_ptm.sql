-- ============================================================================
-- Migration 0014: Board Master (linked to student profile) + PTM records
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Board Master - e.g. CBSE, ICSE, State Board. Same simple pattern as
-- Branches/Classes/Fee Heads.
-- ---------------------------------------------------------------------------
create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index idx_boards_org on boards(org_id);

alter table boards enable row level security;

create policy boards_select on boards for select
  using (org_id = current_org_id());
create policy boards_cud on boards for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

alter table students add column if not exists board_id uuid references boards(id);
create index if not exists idx_students_board on students(board_id);

-- ---------------------------------------------------------------------------
-- PTM (Parent-Teacher Meeting) records. Linked to a student; RLS mirrors the
-- students table itself (select requires students.read, write requires
-- students.write) since this is student-linked personal data, not plain
-- master data.
-- ---------------------------------------------------------------------------
create table if not exists ptm_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  student_id uuid not null references students(id),
  ptm_date date not null,
  attended boolean not null default false,
  parent_remarks text,
  counsellor_remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ptm_records_org on ptm_records(org_id);
create index idx_ptm_records_student on ptm_records(student_id);
create index idx_ptm_records_date on ptm_records(ptm_date);

alter table ptm_records enable row level security;

create policy ptm_records_select on ptm_records for select
  using (org_id = current_org_id() and has_permission('students.read'));
create policy ptm_records_cud on ptm_records for all
  using (org_id = current_org_id() and has_permission('students.write'))
  with check (org_id = current_org_id() and has_permission('students.write'));

create trigger trg_ptm_records_updated_at before update on ptm_records
  for each row execute function set_updated_at();

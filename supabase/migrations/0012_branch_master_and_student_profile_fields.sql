-- ============================================================================
-- Migration 0012: Branch Master; Batch linked to Branch; new student profile
-- fields (School Name, Last Year %, Parent's Remarks)
-- ============================================================================

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index idx_branches_org on branches(org_id);

alter table branches enable row level security;

create policy branches_select on branches for select
  using (org_id = current_org_id());
create policy branches_cud on branches for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

-- ---------------------------------------------------------------------------
-- Batches now belong to a branch. Nullable at the database level so this
-- migration never breaks any existing batch row; the Batch Master form
-- requires a branch for every batch created or edited from now on.
-- ---------------------------------------------------------------------------
alter table batches add column if not exists branch_id uuid references branches(id);
create index if not exists idx_batches_branch on batches(branch_id);

-- ---------------------------------------------------------------------------
-- Student profile: branch link + School Name, Last Year %, Parent's Remarks.
-- last_year_percentage is free text on purpose (office staff may enter
-- "88%", "First Class", "N/A", etc., not only a strict number).
-- parent_remarks is a distinct column from the existing general `remarks`
-- column, so office notes and parent-stated remarks stay separate.
-- ---------------------------------------------------------------------------
alter table students add column if not exists branch_id uuid references branches(id);
alter table students add column if not exists school_name text;
alter table students add column if not exists last_year_percentage text;
alter table students add column if not exists parent_remarks text;
create index if not exists idx_students_branch on students(branch_id);

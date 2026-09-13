-- ============================================================================
-- Migration 0023: Teacher tuition-fee revenue share.
--
-- Per explicit user request (verbatim, across two turns):
-- "Some teachers are allowed sharing basis of fees... suggest modules...
-- Suggest the input you would need" -> clarified with "Individually assigned
-- students" / "Percentage only" / "Selected fee heads only" / independent,
-- non-capped cuts across teachers -> then corrected: "Whatever subject share
-- would be defined out of total tuition fee only. It should be by default
-- assumed that the fees collected are first adjusted with Admission Fee,
-- Study Material Kit, Examination Fee and rest will be taken for tuition
-- fees. Only share in tuition fee be given to the teachers. Further
-- whatever sharing % is mentioned only 60% of such shares belongs to
-- teachers, rest belongs to tuition itself."
--
-- This is deliberately kept a READ-ONLY calculation layered on top of
-- existing payments/receipts - it never writes to payments, installments,
-- student_fee_accounts or any other financial table, and it does not
-- process any payout to a teacher (no bank transfer, no payroll run). It
-- only calculates and displays what a teacher's tuition share works out to,
-- from money already collected - staying on the fee-management side of the
-- project's own "no Payroll / no Teacher Management" boundary (see item 6
-- of the addendum docs for the same reasoning applied to Teacher Master).
--
-- JUDGMENT CALL (documented per project convention): fee heads are only
-- ever recorded at the Fee Structure level (fee_structure_items - the
-- composition of a structure's total_fee); individual payments are
-- recorded against a student's overall fee account, never tagged to a
-- specific fee head. So "first adjust Admission/Study Material/Examination
-- Fee, then whatever's left is Tuition" is implemented as a WATERFALL over
-- a student's cumulative payments on one fee account: every fee head other
-- than the one flagged is_tuition below is summed into a single
-- "non-tuition floor"; cumulative collections up to that floor are deemed
-- non-tuition, and only cumulative collections beyond it are deemed
-- tuition. The specific order of Admission/Study Material/Examination Fee
-- among themselves does not change this total (it's a sum), so no ordering
-- column was needed - only a single is_tuition flag identifying the one
-- fee head that acts as the "remainder" bucket.
-- ============================================================================

-- Exactly one fee head per org can be flagged as the Tuition Fee head - the
-- one that absorbs whatever is collected beyond the other fee heads' sticker
-- amounts. Enforced with a partial unique index rather than a boolean
-- default change, so existing fee heads are unaffected until the office
-- explicitly designates one (Fee Heads master gains a checkbox for this).
alter table fee_heads add column if not exists is_tuition boolean not null default false;

create unique index if not exists ux_fee_heads_single_tuition_head
  on fee_heads(org_id) where is_tuition = true;

-- ----------------------------------------------------------------------------
-- Teacher Student Share - "Individually assigned students" / "Percentage
-- only" per the user's explicit choice: a teacher is assigned a % share of
-- the TUITION portion of one specific student's collections (never a whole
-- course/batch). Multiple teachers can each hold an independent share on
-- the same student (their percentages are not required to sum to 100 - each
-- is its own cut of the tuition pool, per the user's explicit choice).
--
-- Deliberately gated on settings.manage (Super Admin by default) for BOTH
-- select and cud, unlike every other academics module in this project
-- (which use students.read/write) - a revenue-share arrangement is
-- compensation-like, sensitive information, not routine student data. An
-- org can broaden this later via the existing Roles & Permissions screen
-- without another migration, same as any other permission.
-- ----------------------------------------------------------------------------
create table teacher_student_shares (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  teacher_id uuid not null references teachers(id),
  student_id uuid not null references students(id),
  share_percentage numeric(5,2) not null check (share_percentage > 0 and share_percentage <= 100),
  effective_from date not null,
  effective_to date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create index idx_teacher_student_shares_org on teacher_student_shares(org_id);
create index idx_teacher_student_shares_teacher on teacher_student_shares(teacher_id);
create index idx_teacher_student_shares_student on teacher_student_shares(student_id);

alter table teacher_student_shares enable row level security;

create policy teacher_student_shares_select on teacher_student_shares for select
  using (org_id = current_org_id() and has_permission('settings.manage'));
create policy teacher_student_shares_cud on teacher_student_shares for all
  using (org_id = current_org_id() and has_permission('settings.manage'))
  with check (org_id = current_org_id() and has_permission('settings.manage'));

create trigger trg_teacher_student_shares_updated_at
  before update on teacher_student_shares
  for each row execute function set_updated_at();

-- The org-wide "what fraction of a computed tuition share actually goes to
-- the teacher" policy (user: "only 60% of such shares belongs to teachers,
-- rest belongs to tuition itself") is stored as a single row in the
-- existing generic `settings` key-value table (key
-- 'teacher_share_payout_percent', value {"percent": 60}) rather than a new
-- column/table - it's a single organization-wide policy value, and
-- `settings` already exists with exactly the settings.manage RLS this
-- needs. The application defaults to 60 when no row is present yet, so no
-- seed insert is required here.

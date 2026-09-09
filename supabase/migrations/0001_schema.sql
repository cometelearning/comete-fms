-- ============================================================================
-- COMETE LEARNING - Fee Management Software
-- Migration 0001: Core schema
-- ============================================================================
-- Design notes:
--  * Every business table carries org_id so the schema supports more than one
--    organization even though COMETE LEARNING will use a single one. This
--    keeps Row Level Security simple and future-proof.
--  * Money columns are numeric(12,2). Never use float for money.
--  * Nothing that can be derived from transactions (paid amount, outstanding,
--    installment status) is stored as a mutable column. See 0002 for the
--    views/functions that compute these live from payments/discounts.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  email text,
  logo_drive_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Roles & permissions
-- ---------------------------------------------------------------------------
create table roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  key text not null, -- e.g. super_admin, admin, accountant, viewer, or a custom key
  name text not null,
  is_system boolean not null default false, -- system roles cannot be deleted
  created_at timestamptz not null default now(),
  unique (org_id, key)
);

create table permissions (
  key text primary key, -- e.g. 'students.write'
  description text not null,
  category text not null
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

-- ---------------------------------------------------------------------------
-- Profiles (one row per Supabase auth user)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  mobile text,
  role_id uuid not null references roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, email)
);

create index idx_profiles_org on profiles(org_id);
create index idx_profiles_role on profiles(role_id);

-- ---------------------------------------------------------------------------
-- Academic years
-- ---------------------------------------------------------------------------
create table academic_years (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null, -- e.g. '2026-27'
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index idx_academic_years_org on academic_years(org_id);

-- ---------------------------------------------------------------------------
-- Courses
-- ---------------------------------------------------------------------------
create table courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  class_standard text,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now()
);

create index idx_courses_org on courses(org_id);

-- ---------------------------------------------------------------------------
-- Batches
-- ---------------------------------------------------------------------------
create table batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  course_id uuid not null references courses(id),
  academic_year_id uuid not null references academic_years(id),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now()
);

create index idx_batches_org on batches(org_id);
create index idx_batches_course on batches(course_id);
create index idx_batches_year on batches(academic_year_id);

-- ---------------------------------------------------------------------------
-- Fee heads
-- ---------------------------------------------------------------------------
create table fee_heads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index idx_fee_heads_org on fee_heads(org_id);

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
create table students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  student_code text not null, -- system-generated unique Student ID, e.g. CL-STU-000123
  admission_number text,
  name text not null,
  guardian_name text,
  student_mobile text,
  parent_mobile text,
  student_email text,
  parent_email text,
  address text,
  course_id uuid references courses(id),
  batch_id uuid references batches(id),
  academic_year_id uuid references academic_years(id),
  admission_date date not null default current_date,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  remarks text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, student_code)
);

create index idx_students_org on students(org_id);
create index idx_students_name on students using gin (to_tsvector('simple', coalesce(name,'')));
create index idx_students_admission_number on students(admission_number);
create index idx_students_student_mobile on students(student_mobile);
create index idx_students_parent_mobile on students(parent_mobile);
create index idx_students_email on students(student_email);
create index idx_students_course on students(course_id);
create index idx_students_batch on students(batch_id);
create index idx_students_year on students(academic_year_id);
create index idx_students_status on students(status);

-- ---------------------------------------------------------------------------
-- Fee structures (a reusable fee plan template for a course/batch/year)
-- ---------------------------------------------------------------------------
create table fee_structures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  academic_year_id uuid not null references academic_years(id),
  course_id uuid not null references courses(id),
  batch_id uuid references batches(id), -- nullable: applies to whole course if null
  total_fee numeric(12,2) not null check (total_fee >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_fee_structures_org on fee_structures(org_id);
create index idx_fee_structures_year on fee_structures(academic_year_id);
create index idx_fee_structures_course on fee_structures(course_id);

-- Fee structure items: breakdown of total_fee by fee head
create table fee_structure_items (
  id uuid primary key default gen_random_uuid(),
  fee_structure_id uuid not null references fee_structures(id) on delete cascade,
  fee_head_id uuid not null references fee_heads(id),
  amount numeric(12,2) not null check (amount >= 0),
  unique (fee_structure_id, fee_head_id)
);

-- Fee structure installment template: how total_fee is split over time
create table fee_structure_installments (
  id uuid primary key default gen_random_uuid(),
  fee_structure_id uuid not null references fee_structures(id) on delete cascade,
  seq_no int not null,
  label text not null, -- e.g. 'Installment 1'
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  unique (fee_structure_id, seq_no)
);

-- ---------------------------------------------------------------------------
-- Student fee accounts (fee assigned to a specific student)
-- ---------------------------------------------------------------------------
create table student_fee_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  fee_structure_id uuid not null references fee_structures(id),
  academic_year_id uuid not null references academic_years(id),
  total_fee numeric(12,2) not null check (total_fee >= 0), -- snapshot at assignment time
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CLOSED')),
  assigned_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (student_id, fee_structure_id)
);

create index idx_sfa_org on student_fee_accounts(org_id);
create index idx_sfa_student on student_fee_accounts(student_id);
create index idx_sfa_year on student_fee_accounts(academic_year_id);

-- ---------------------------------------------------------------------------
-- Installments (actual, per student, generated from the fee structure template)
-- ---------------------------------------------------------------------------
create table installments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  student_fee_account_id uuid not null references student_fee_accounts(id) on delete cascade,
  seq_no int not null,
  label text not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  created_at timestamptz not null default now(),
  unique (student_fee_account_id, seq_no)
);

create index idx_installments_org on installments(org_id);
create index idx_installments_sfa on installments(student_fee_account_id);
create index idx_installments_due_date on installments(due_date);

-- ---------------------------------------------------------------------------
-- Discounts / concessions / waivers
-- ---------------------------------------------------------------------------
create table discounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  student_fee_account_id uuid not null references student_fee_accounts(id) on delete cascade,
  installment_id uuid references installments(id), -- null = applies against the account generally
  discount_type text not null check (discount_type in ('FIXED','PERCENTAGE')),
  value numeric(12,2) not null check (value >= 0), -- amount if FIXED, percent if PERCENTAGE
  amount numeric(12,2) not null check (amount >= 0), -- resolved rupee amount at time of granting
  reason text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVERSED')),
  granted_by uuid not null references profiles(id),
  reversed_by uuid references profiles(id),
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now()
);

create index idx_discounts_org on discounts(org_id);
create index idx_discounts_sfa on discounts(student_fee_account_id);
create index idx_discounts_installment on discounts(installment_id);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  student_fee_account_id uuid not null references student_fee_accounts(id),
  student_id uuid not null references students(id),
  payment_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  payment_mode text not null check (payment_mode in ('CASH','UPI','BANK_TRANSFER','CHEQUE','CARD','OTHER')),
  reference_number text,
  remarks text,
  status text not null default 'COMPLETED' check (status in ('COMPLETED','CANCELLED')),
  idempotency_key uuid not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create index idx_payments_org on payments(org_id);
create index idx_payments_sfa on payments(student_fee_account_id);
create index idx_payments_student on payments(student_id);
create index idx_payments_date on payments(payment_date);
create index idx_payments_mode on payments(payment_mode);
create index idx_payments_created_by on payments(created_by);

-- How a payment is allocated across one or more installments
create table payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  installment_id uuid not null references installments(id),
  amount numeric(12,2) not null check (amount > 0),
  unique (payment_id, installment_id)
);

create index idx_payment_allocations_installment on payment_allocations(installment_id);

-- ---------------------------------------------------------------------------
-- Receipt numbering: concurrency-safe per-organization, per-year counter.
-- Actual number generation happens atomically inside record_payment() (0005).
-- ---------------------------------------------------------------------------
create table receipt_sequences (
  org_id uuid not null references organizations(id) on delete cascade,
  year_label text not null, -- calendar year the receipt is issued in, e.g. '2026'
  next_number bigint not null default 1,
  primary key (org_id, year_label)
);

-- ---------------------------------------------------------------------------
-- Receipts
-- ---------------------------------------------------------------------------
create table receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  payment_id uuid not null references payments(id),
  receipt_number text not null,
  academic_year_id uuid not null references academic_years(id),
  issued_at timestamptz not null default now(),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED')),
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  cancellation_reason text,
  pdf_status text not null default 'PENDING' check (pdf_status in ('PENDING','STORED','FAILED')),
  pdf_storage_attempts int not null default 0,
  pdf_last_error text,
  drive_file_id text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (org_id, receipt_number),
  unique (payment_id)
);

create index idx_receipts_org on receipts(org_id);
create index idx_receipts_status on receipts(status);
create index idx_receipts_pdf_status on receipts(pdf_status);
create index idx_receipts_issued_at on receipts(issued_at);

-- ---------------------------------------------------------------------------
-- Audit logs
-- ---------------------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references profiles(id),
  user_email text,
  action text not null, -- e.g. 'PAYMENT_RECORDED', 'RECEIPT_CANCELLED'
  module text not null, -- e.g. 'students', 'payments', 'users'
  record_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_org on audit_logs(org_id);
create index idx_audit_logs_module on audit_logs(module);
create index idx_audit_logs_record on audit_logs(record_id);
create index idx_audit_logs_created_at on audit_logs(created_at);
create index idx_audit_logs_user on audit_logs(user_id);

-- ---------------------------------------------------------------------------
-- Settings (generic key/value, per org)
-- ---------------------------------------------------------------------------
create table settings (
  org_id uuid not null references organizations(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

-- ---------------------------------------------------------------------------
-- Google Drive connection (org-level, single connected account)
-- ---------------------------------------------------------------------------
create table google_drive_accounts (
  org_id uuid primary key references organizations(id) on delete cascade,
  connected_email text,
  refresh_token_encrypted text,
  access_token_encrypted text,
  token_expiry timestamptz,
  root_folder_id text,
  status text not null default 'DISCONNECTED' check (status in ('CONNECTED','DISCONNECTED','ERROR')),
  last_error text,
  connected_by uuid references profiles(id),
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Every file COMETE LEARNING has stored in Drive (receipts, reports, backups, exports)
create table google_drive_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  file_type text not null check (file_type in ('RECEIPT','REPORT','EXPORT','BACKUP')),
  related_receipt_id uuid references receipts(id),
  file_name text not null,
  drive_path text not null,
  drive_file_id text,
  status text not null default 'PENDING' check (status in ('PENDING','STORED','FAILED')),
  attempts int not null default 0,
  last_error text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_gdrive_files_org on google_drive_files(org_id);
create index idx_gdrive_files_status on google_drive_files(status);
create index idx_gdrive_files_receipt on google_drive_files(related_receipt_id);

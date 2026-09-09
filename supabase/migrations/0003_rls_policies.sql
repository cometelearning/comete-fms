-- ============================================================================
-- Migration 0003: Row Level Security
--
-- Principle: every table is scoped to the caller's organization, and every
-- write additionally requires the matching permission via has_permission().
-- This is enforced in Postgres itself, so it holds even if someone bypasses
-- the UI and calls the API/Supabase client directly. Sensitive multi-table
-- financial writes (payments/receipts/fee assignment/discounts) are NOT
-- reachable via direct table INSERT at all -- only through SECURITY DEFINER
-- RPC functions (see 0005) which re-check permissions themselves and run as
-- one atomic transaction.
-- ============================================================================

alter table organizations enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table profiles enable row level security;
alter table academic_years enable row level security;
alter table courses enable row level security;
alter table batches enable row level security;
alter table fee_heads enable row level security;
alter table students enable row level security;
alter table fee_structures enable row level security;
alter table fee_structure_items enable row level security;
alter table fee_structure_installments enable row level security;
alter table student_fee_accounts enable row level security;
alter table installments enable row level security;
alter table discounts enable row level security;
alter table payments enable row level security;
alter table payment_allocations enable row level security;
alter table receipt_sequences enable row level security;
alter table receipts enable row level security;
alter table audit_logs enable row level security;
alter table settings enable row level security;
alter table google_drive_accounts enable row level security;
alter table google_drive_files enable row level security;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create policy org_select on organizations for select
  using (id = current_org_id());
create policy org_update on organizations for update
  using (id = current_org_id() and has_permission('settings.manage'));

-- ---------------------------------------------------------------------------
-- roles / permissions / role_permissions (reference data)
-- ---------------------------------------------------------------------------
create policy roles_select on roles for select
  using (org_id = current_org_id());
create policy roles_write on roles for insert
  with check (org_id = current_org_id() and has_permission('users.manage'));
create policy roles_update on roles for update
  using (org_id = current_org_id() and has_permission('users.manage') and is_system = false);
create policy roles_delete on roles for delete
  using (org_id = current_org_id() and has_permission('users.manage') and is_system = false);

create policy permissions_select on permissions for select using (true);

create policy role_permissions_select on role_permissions for select
  using (exists (select 1 from roles r where r.id = role_id and r.org_id = current_org_id()));
create policy role_permissions_write on role_permissions for insert
  with check (
    has_permission('users.manage')
    and exists (select 1 from roles r where r.id = role_id and r.org_id = current_org_id())
  );
create policy role_permissions_delete on role_permissions for delete
  using (
    has_permission('users.manage')
    and exists (select 1 from roles r where r.id = role_id and r.org_id = current_org_id())
  );

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on profiles for select
  using (org_id = current_org_id());
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_update_admin on profiles for update
  using (org_id = current_org_id() and has_permission('users.manage'));
-- Inserts happen server-side with the service role (creating the auth user
-- and profile together); no direct-insert policy is granted to `authenticated`.

-- ---------------------------------------------------------------------------
-- Masters: academic years, courses, batches, fee heads
-- ---------------------------------------------------------------------------
create policy academic_years_select on academic_years for select
  using (org_id = current_org_id());
create policy academic_years_cud on academic_years for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

create policy courses_select on courses for select
  using (org_id = current_org_id());
create policy courses_cud on courses for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

create policy batches_select on batches for select
  using (org_id = current_org_id());
create policy batches_cud on batches for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

create policy fee_heads_select on fee_heads for select
  using (org_id = current_org_id());
create policy fee_heads_cud on fee_heads for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
create policy students_select on students for select
  using (org_id = current_org_id() and has_permission('students.read'));
create policy students_cud on students for all
  using (org_id = current_org_id() and has_permission('students.write'))
  with check (org_id = current_org_id() and has_permission('students.write'));

-- ---------------------------------------------------------------------------
-- Fee structures
-- ---------------------------------------------------------------------------
create policy fee_structures_select on fee_structures for select
  using (org_id = current_org_id() and has_permission('fee_structures.read'));
create policy fee_structures_cud on fee_structures for all
  using (org_id = current_org_id() and has_permission('fee_structures.write'))
  with check (org_id = current_org_id() and has_permission('fee_structures.write'));

create policy fsi_select on fee_structure_items for select
  using (exists (select 1 from fee_structures fs where fs.id = fee_structure_id and fs.org_id = current_org_id() and has_permission('fee_structures.read')));
create policy fsi_cud on fee_structure_items for all
  using (exists (select 1 from fee_structures fs where fs.id = fee_structure_id and fs.org_id = current_org_id() and has_permission('fee_structures.write')))
  with check (exists (select 1 from fee_structures fs where fs.id = fee_structure_id and fs.org_id = current_org_id() and has_permission('fee_structures.write')));

create policy fsinst_select on fee_structure_installments for select
  using (exists (select 1 from fee_structures fs where fs.id = fee_structure_id and fs.org_id = current_org_id() and has_permission('fee_structures.read')));
create policy fsinst_cud on fee_structure_installments for all
  using (exists (select 1 from fee_structures fs where fs.id = fee_structure_id and fs.org_id = current_org_id() and has_permission('fee_structures.write')))
  with check (exists (select 1 from fee_structures fs where fs.id = fee_structure_id and fs.org_id = current_org_id() and has_permission('fee_structures.write')));

-- ---------------------------------------------------------------------------
-- Student fee accounts + installments: writes only via RPC (0005), so we
-- expose SELECT here and leave writes to the SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------
create policy sfa_select on student_fee_accounts for select
  using (org_id = current_org_id() and has_permission('student_fees.read'));

create policy installments_select on installments for select
  using (org_id = current_org_id() and has_permission('student_fees.read'));

-- ---------------------------------------------------------------------------
-- Discounts: select only directly; grant/reverse only via RPC.
-- ---------------------------------------------------------------------------
create policy discounts_select on discounts for select
  using (org_id = current_org_id() and has_permission('student_fees.read'));

-- ---------------------------------------------------------------------------
-- Payments / allocations / receipts / receipt sequence: select only.
-- All writes happen exclusively inside record_payment() / cancel_receipt().
-- ---------------------------------------------------------------------------
create policy payments_select on payments for select
  using (org_id = current_org_id() and has_permission('receipts.read'));

create policy payment_allocations_select on payment_allocations for select
  using (exists (select 1 from payments p where p.id = payment_id and p.org_id = current_org_id() and has_permission('receipts.read')));

create policy receipts_select on receipts for select
  using (org_id = current_org_id() and has_permission('receipts.read'));

-- receipt_sequences is internal bookkeeping only; no policies granted to
-- `authenticated` at all (only the SECURITY DEFINER function touches it).

-- ---------------------------------------------------------------------------
-- Audit logs: select only for users with audit.view; writes via RPC only.
-- ---------------------------------------------------------------------------
create policy audit_logs_select on audit_logs for select
  using (org_id = current_org_id() and has_permission('audit.view'));

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create policy settings_select on settings for select
  using (org_id = current_org_id() and has_permission('settings.manage'));
create policy settings_cud on settings for all
  using (org_id = current_org_id() and has_permission('settings.manage'))
  with check (org_id = current_org_id() and has_permission('settings.manage'));

-- google_drive_accounts: intentionally NO policies for `authenticated`.
-- OAuth tokens are only ever read/written by server-side API routes using
-- the Supabase service-role key, which bypasses RLS. The browser never
-- receives raw tokens.

-- google_drive_files: status is safe to show to anyone who can read receipts.
create policy gdrive_files_select on google_drive_files for select
  using (org_id = current_org_id() and (has_permission('receipts.read') or has_permission('settings.manage')));

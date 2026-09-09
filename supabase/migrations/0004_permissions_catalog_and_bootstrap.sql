-- ============================================================================
-- Migration 0004: Permission catalog + organization bootstrap
-- ============================================================================

insert into permissions (key, description, category) values
  ('dashboard.view',       'View the dashboard',                                   'General'),
  ('students.read',        'Search and view students',                             'Students'),
  ('students.write',       'Create, edit and deactivate students',                 'Students'),
  ('masters.read',         'View academic years, courses, batches, fee heads',     'Masters'),
  ('masters.write',        'Create/edit academic years, courses, batches, fee heads','Masters'),
  ('fee_structures.read',  'View fee structures',                                  'Fees'),
  ('fee_structures.write', 'Create/edit fee structures and installment plans',     'Fees'),
  ('student_fees.read',    'View a student''s fee account, ledger and outstanding','Fees'),
  ('student_fees.write',   'Assign a fee structure to a student',                  'Fees'),
  ('payments.collect',     'Collect a payment and generate a receipt',             'Payments'),
  ('receipts.read',        'View receipts and the receipt register',              'Payments'),
  ('receipts.cancel',      'Cancel an issued receipt',                             'Payments'),
  ('discounts.grant',      'Apply or reverse a discount/concession',               'Fees'),
  ('outstanding.view',     'View the outstanding fees report',                     'Reports'),
  ('reports.view',         'View collection, outstanding, receipt and discount reports','Reports'),
  ('exports.run',          'Export data to Excel/CSV/PDF',                         'Reports'),
  ('audit.view',           'View the audit trail',                                 'Admin'),
  ('users.manage',         'Create/disable users and assign roles',                'Admin'),
  ('settings.manage',      'Manage organization settings and Google Drive connection','Admin')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- bootstrap_organization: creates the organization + the 4 built-in system
-- roles with their default permission sets. Called once, from the initial
-- setup flow (see /setup in the app), by a caller using the service-role key
-- (so it runs outside RLS - there is no logged-in user yet).
-- ---------------------------------------------------------------------------
create or replace function bootstrap_organization(p_name text, p_email text default null, p_phone text default null, p_address text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role_super uuid;
  v_role_admin uuid;
  v_role_accountant uuid;
  v_role_viewer uuid;
begin
  insert into organizations (name, email, phone, address)
  values (p_name, p_email, p_phone, p_address)
  returning id into v_org_id;

  insert into roles (org_id, key, name, is_system) values (v_org_id, 'super_admin', 'Super Admin', true) returning id into v_role_super;
  insert into roles (org_id, key, name, is_system) values (v_org_id, 'admin', 'Admin', true) returning id into v_role_admin;
  insert into roles (org_id, key, name, is_system) values (v_org_id, 'accountant', 'Accountant', true) returning id into v_role_accountant;
  insert into roles (org_id, key, name, is_system) values (v_org_id, 'viewer', 'Management / Viewer', true) returning id into v_role_viewer;

  -- Super Admin: every permission
  insert into role_permissions (role_id, permission_key)
  select v_role_super, key from permissions;

  -- Admin: manage students/masters/fee structures/student fees, view reports
  insert into role_permissions (role_id, permission_key)
  select v_role_admin, key from unnest(array[
    'dashboard.view','students.read','students.write',
    'masters.read','masters.write',
    'fee_structures.read','fee_structures.write',
    'student_fees.read','student_fees.write',
    'discounts.grant',
    'receipts.read','outstanding.view','reports.view','exports.run'
  ]) as key;

  -- Accountant: search students, collect payments, generate receipts, view outstanding/collection
  insert into role_permissions (role_id, permission_key)
  select v_role_accountant, key from unnest(array[
    'dashboard.view','students.read',
    'masters.read','fee_structures.read',
    'student_fees.read',
    'payments.collect','receipts.read',
    'outstanding.view','reports.view','exports.run'
  ]) as key;

  -- Viewer: read-only everywhere, cannot touch financial transactions
  insert into role_permissions (role_id, permission_key)
  select v_role_viewer, key from unnest(array[
    'dashboard.view','students.read','masters.read',
    'fee_structures.read','student_fees.read',
    'receipts.read','outstanding.view','reports.view'
  ]) as key;

  insert into google_drive_accounts (org_id, status) values (v_org_id, 'DISCONNECTED');

  return v_org_id;
end;
$$;

-- Only the service role should ever call this (initial setup). Not granted
-- to `authenticated` so an ordinary logged-in user can never spin up a
-- second organization for themselves.
revoke all on function bootstrap_organization(text, text, text, text) from public, authenticated;
grant execute on function bootstrap_organization(text, text, text, text) to service_role;

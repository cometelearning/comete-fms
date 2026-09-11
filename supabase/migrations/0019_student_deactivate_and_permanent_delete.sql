-- ============================================================================
-- Migration 0019: Deactivate / permanently delete a student - Super Admin only.
--
-- Per explicit user request: "Give an option to deactivate students and
-- delete the student permanently. These rights should only be with super
-- admin." Two distinct, deliberately narrow actions:
--
-- 1) Deactivate/Activate: students.status already existed (ACTIVE/INACTIVE,
--    since the initial schema) but nothing in the app ever wrote to it. This
--    just wires it up - but restricted to Super Admin, not the general
--    students.write permission Admin/Accountant already hold, per the
--    user's explicit ask. Enforced with a BEFORE UPDATE trigger (not just
--    app-layer/RLS) so a status change is blocked even via a raw table
--    UPDATE that would otherwise pass students.write.
--
-- 2) Permanent delete: a real `delete from students`, Super Admin only,
--    and only when the student has no fee/payment history at all -
--    otherwise this would either violate the "financial history must never
--    disappear silently" rule (spec #32) or hit an FK violation from
--    student_fee_accounts/payments and surface as a raw Postgres error. A
--    student with any fee history should be Deactivated instead; the
--    Reports/Receipts/Ledger for that student remain fully intact. Modeled
--    on cancel_receipt() (migration 0005): SECURITY DEFINER RPC, explicit
--    permission check, explicit reason requirement, one audit log entry
--    capturing a full snapshot of the deleted row (record_id has no FK
--    constraint - see audit_logs in migration 0001 - so it safely survives
--    the student being gone).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Session helper: is the calling user's role exactly 'super_admin'?
-- Same SECURITY DEFINER pattern as current_org_id()/has_permission() in
-- migration 0002 - only ever answers for auth.uid(), never arbitrary users.
-- Deliberately a ROLE check, not a permission check: Super Admin's
-- permissions can never be edited away (see the Roles & Permissions
-- super_admin lock from migration 0018), but a permission-based gate here
-- could be loosened by granting some other role students.delete-equivalent
-- access - the user asked for this to stay tied to the Super Admin role
-- itself, not to whatever a permission happens to be granted to.
-- ----------------------------------------------------------------------------
create or replace function is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    join roles r on r.id = p.role_id
    where p.id = auth.uid()
      and p.is_active = true
      and r.key = 'super_admin'
  );
$$;

grant execute on function is_super_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- Split the old FOR ALL students_cud policy so DELETE can be locked down
-- separately from INSERT/UPDATE. Admin/Accountant keep creating and editing
-- students exactly as before; only DELETE now requires Super Admin.
-- ----------------------------------------------------------------------------
drop policy if exists students_cud on students;

create policy students_insert on students for insert
  with check (org_id = current_org_id() and has_permission('students.write'));

create policy students_update on students for update
  using (org_id = current_org_id() and has_permission('students.write'))
  with check (org_id = current_org_id() and has_permission('students.write'));

create policy students_delete on students for delete
  using (org_id = current_org_id() and is_super_admin());

-- ----------------------------------------------------------------------------
-- Defense-in-depth: block a status flip on a raw UPDATE even when the caller
-- otherwise satisfies students_update (has students.write). The app's own
-- PATCH /api/students/[id] (general edit) never sends `status` at all as of
-- this migration - this trigger guards the case of someone hitting the
-- Supabase REST API directly.
-- ----------------------------------------------------------------------------
create or replace function enforce_student_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status is distinct from new.status and not is_super_admin() then
    raise exception 'PERMISSION_DENIED: only Super Admin can change a student''s active/inactive status';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_student_status_change on students;
create trigger trg_enforce_student_status_change
before update on students
for each row execute function enforce_student_status_change();

-- ----------------------------------------------------------------------------
-- delete_student_permanently(): the only path that can hard-delete a
-- student row. Blocks if any fee account was ever assigned (which
-- transitively covers installments/discounts/payments - all cascade from
-- student_fee_accounts, migration 0001) - preserving every financial
-- transaction and receipt intact for a student with real history.
-- PTM records are NOT financial and are cleared as part of the delete
-- (they have no cascade of their own - migration 0014's FK has no ON
-- DELETE clause - so they'd otherwise block the delete with a raw FK
-- error).
-- ----------------------------------------------------------------------------
create or replace function delete_student_permanently(p_student_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_student students%rowtype;
  v_fee_account_count bigint;
begin
  if not is_super_admin() then
    raise exception 'PERMISSION_DENIED: only Super Admin can permanently delete a student';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_student from students where id = p_student_id and org_id = v_org_id;
  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  select count(*) into v_fee_account_count from student_fee_accounts where student_id = p_student_id;
  if v_fee_account_count > 0 then
    raise exception 'STUDENT_HAS_FEE_RECORDS';
  end if;

  select email into v_user_email from profiles where id = v_user_id;

  delete from ptm_records where student_id = p_student_id;

  delete from students where id = p_student_id and org_id = v_org_id;

  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, previous_value, new_value, reason)
  values (v_org_id, v_user_id, v_user_email, 'STUDENT_DELETED', 'students', p_student_id,
    to_jsonb(v_student), null, p_reason);

  return jsonb_build_object('student_id', p_student_id, 'deleted', true);
end;
$$;

grant execute on function delete_student_permanently(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- The students.write permission's catalog description (migration 0004) said
-- "Create, edit and deactivate students" - no longer accurate now that
-- deactivate (and delete) are Super Admin-only regardless of who holds
-- students.write. Corrected so the Roles & Permissions screen (migration
-- 0018) doesn't show a misleading label to the office.
-- ----------------------------------------------------------------------------
update permissions set description = 'Create and edit students' where key = 'students.write';

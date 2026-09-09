-- ============================================================================
-- Migration 0005: Transactional RPC functions
--
-- Every financially-sensitive multi-table write in the whole application
-- goes through one of the functions below. Each function:
--   1) Re-checks the caller's permission with has_permission() -- never
--      trusts that the UI already checked.
--   2) Runs as a single Postgres function invocation, which Postgres always
--      executes inside one transaction: either everything below commits, or
--      (on any exception) nothing does. There is no code path that can leave
--      a payment recorded without its receipt, or an installment updated
--      without an audit entry.
--   3) Is SECURITY DEFINER, so it can write to receipt_sequences / audit_logs
--      etc. that ordinary users have no direct table grants on.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Generic per-organization counters (used for student codes; receipts use
-- the dedicated receipt_sequences table because they are also scoped by
-- year).
-- ---------------------------------------------------------------------------
create table counters (
  org_id uuid not null references organizations(id) on delete cascade,
  counter_key text not null,
  next_number bigint not null default 1,
  primary key (org_id, counter_key)
);
alter table counters enable row level security; -- no policies: server-only

create or replace function next_counter_value(p_org_id uuid, p_key text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num bigint;
begin
  insert into counters (org_id, counter_key, next_number)
  values (p_org_id, p_key, 1)
  on conflict (org_id, counter_key) do nothing;

  update counters set next_number = next_number + 1
  where org_id = p_org_id and counter_key = p_key
  returning next_number - 1 into v_num;

  return v_num;
end;
$$;

create or replace function generate_student_code(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num bigint;
begin
  v_num := next_counter_value(p_org_id, 'student_code');
  return 'CL-STU-' || lpad(v_num::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- assign_fee_to_student: creates the student's fee account and generates
-- its installment schedule from the fee structure template, atomically.
-- ---------------------------------------------------------------------------
create or replace function assign_fee_to_student(p_student_id uuid, p_fee_structure_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_fs fee_structures%rowtype;
  v_account_id uuid;
  v_row record;
begin
  if not has_permission('student_fees.write') then
    raise exception 'PERMISSION_DENIED: student_fees.write required';
  end if;

  select * into v_fs from fee_structures where id = p_fee_structure_id and org_id = v_org_id and status = 'ACTIVE';
  if not found then
    raise exception 'FEE_STRUCTURE_NOT_FOUND_OR_INACTIVE';
  end if;

  if not exists (select 1 from students s where s.id = p_student_id and s.org_id = v_org_id) then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  if exists (select 1 from student_fee_accounts where student_id = p_student_id and fee_structure_id = p_fee_structure_id) then
    raise exception 'FEE_ALREADY_ASSIGNED';
  end if;

  if not exists (select 1 from fee_structure_installments where fee_structure_id = p_fee_structure_id) then
    raise exception 'FEE_STRUCTURE_HAS_NO_INSTALLMENTS';
  end if;

  insert into student_fee_accounts (org_id, student_id, fee_structure_id, academic_year_id, total_fee, assigned_by)
  values (v_org_id, p_student_id, p_fee_structure_id, v_fs.academic_year_id, v_fs.total_fee, auth.uid())
  returning id into v_account_id;

  for v_row in select seq_no, label, amount, due_date from fee_structure_installments where fee_structure_id = p_fee_structure_id order by seq_no
  loop
    insert into installments (org_id, student_fee_account_id, seq_no, label, amount, due_date)
    values (v_org_id, v_account_id, v_row.seq_no, v_row.label, v_row.amount, v_row.due_date);
  end loop;

  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, new_value)
  values (v_org_id, auth.uid(), (select email from profiles where id = auth.uid()), 'FEE_ASSIGNED', 'student_fees', v_account_id,
    jsonb_build_object('student_id', p_student_id, 'fee_structure_id', p_fee_structure_id, 'total_fee', v_fs.total_fee));

  return v_account_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_payment: THE critical function.
--   * Idempotent: same (org, idempotency_key) will never create a second
--     payment, even under a duplicate click or a network retry.
--   * Generates the receipt number atomically via receipt_sequences, so
--     concurrent accountants never collide.
--   * Allocates the amount to the selected installment first, then cascades
--     any remainder to the next unpaid installments in order (so paying more
--     than one installment's due amount in a single collection works).
-- ---------------------------------------------------------------------------
create or replace function record_payment(
  p_student_fee_account_id uuid,
  p_installment_id uuid,
  p_amount numeric,
  p_payment_mode text,
  p_payment_date date,
  p_reference_number text,
  p_remarks text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_sfa student_fee_accounts%rowtype;
  v_payment_id uuid;
  v_existing_payment_id uuid;
  v_existing_receipt receipts%rowtype;
  v_remaining numeric(12,2);
  v_year text;
  v_seq_num bigint;
  v_receipt_number text;
  v_receipt_id uuid;
  v_inst record;
  v_alloc numeric(12,2);
  v_prev_outstanding numeric(12,2);
  v_new_outstanding numeric(12,2);
begin
  if not has_permission('payments.collect') then
    raise exception 'PERMISSION_DENIED: payments.collect required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT: amount must be greater than zero';
  end if;

  select * into v_sfa from student_fee_accounts where id = p_student_fee_account_id and org_id = v_org_id;
  if not found then
    raise exception 'STUDENT_FEE_ACCOUNT_NOT_FOUND';
  end if;

  select email into v_user_email from profiles where id = v_user_id;

  -- Outstanding BEFORE this payment, for the receipt.
  select outstanding_total into v_prev_outstanding from student_fee_summary where student_fee_account_id = p_student_fee_account_id;
  v_prev_outstanding := coalesce(v_prev_outstanding, 0);

  -- ---- Idempotency guard -------------------------------------------------
  select id into v_existing_payment_id from payments where org_id = v_org_id and idempotency_key = p_idempotency_key;
  if found then
    select * into v_existing_receipt from receipts where payment_id = v_existing_payment_id;
    return jsonb_build_object(
      'replayed', true,
      'payment_id', v_existing_payment_id,
      'receipt_id', v_existing_receipt.id,
      'receipt_number', v_existing_receipt.receipt_number
    );
  end if;

  -- ---- Create the payment --------------------------------------------------
  insert into payments (org_id, student_fee_account_id, student_id, payment_date, amount, payment_mode, reference_number, remarks, status, idempotency_key, created_by)
  values (v_org_id, p_student_fee_account_id, v_sfa.student_id, coalesce(p_payment_date, current_date), p_amount, p_payment_mode, nullif(p_reference_number,''), nullif(p_remarks,''), 'COMPLETED', p_idempotency_key, v_user_id)
  returning id into v_payment_id;

  -- ---- Allocate to installments -------------------------------------------
  v_remaining := p_amount;

  -- First, the installment the accountant selected (if it still has an outstanding balance).
  if p_installment_id is not null then
    select id, outstanding_amount into v_inst from installment_status
      where id = p_installment_id and student_fee_account_id = p_student_fee_account_id;
    if found and v_inst.outstanding_amount > 0 and v_remaining > 0 then
      v_alloc := least(v_remaining, v_inst.outstanding_amount);
      insert into payment_allocations (payment_id, installment_id, amount) values (v_payment_id, p_installment_id, v_alloc);
      v_remaining := v_remaining - v_alloc;
    end if;
  end if;

  -- Then cascade any remainder to other unpaid installments, oldest due first.
  for v_inst in
    select id, outstanding_amount from installment_status
    where student_fee_account_id = p_student_fee_account_id
      and outstanding_amount > 0
      and id is distinct from p_installment_id
    order by due_date asc
  loop
    exit when v_remaining <= 0;
    v_alloc := least(v_remaining, v_inst.outstanding_amount);
    insert into payment_allocations (payment_id, installment_id, amount) values (v_payment_id, v_inst.id, v_alloc);
    v_remaining := v_remaining - v_alloc;
  end loop;

  -- Any leftover (fully paid ahead / advance) is applied against the most
  -- recent installment as a credit rather than left unallocated, so every
  -- rupee of the payment is traceable to an installment.
  if v_remaining > 0 then
    select id into v_inst from installments
      where student_fee_account_id = p_student_fee_account_id
      order by seq_no desc limit 1;
    if found then
      insert into payment_allocations (payment_id, installment_id, amount) values (v_payment_id, v_inst.id, v_remaining);
    end if;
  end if;

  -- ---- Generate the receipt number atomically -----------------------------
  v_year := to_char(coalesce(p_payment_date, current_date), 'YYYY');
  insert into receipt_sequences (org_id, year_label, next_number) values (v_org_id, v_year, 1)
    on conflict (org_id, year_label) do nothing;
  update receipt_sequences set next_number = next_number + 1
    where org_id = v_org_id and year_label = v_year
    returning next_number - 1 into v_seq_num;
  v_receipt_number := 'CL-' || v_year || '-' || lpad(v_seq_num::text, 6, '0');

  insert into receipts (org_id, payment_id, receipt_number, academic_year_id, created_by)
  values (v_org_id, v_payment_id, v_receipt_number, v_sfa.academic_year_id, v_user_id)
  returning id into v_receipt_id;

  select outstanding_total into v_new_outstanding from student_fee_summary where student_fee_account_id = p_student_fee_account_id;

  -- ---- Audit trail ----------------------------------------------------------
  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, previous_value, new_value)
  values (v_org_id, v_user_id, v_user_email, 'PAYMENT_RECORDED', 'payments', v_payment_id,
    jsonb_build_object('outstanding_before', v_prev_outstanding),
    jsonb_build_object('amount', p_amount, 'payment_mode', p_payment_mode, 'receipt_number', v_receipt_number, 'outstanding_after', v_new_outstanding));

  return jsonb_build_object(
    'replayed', false,
    'payment_id', v_payment_id,
    'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_number,
    'outstanding_before', v_prev_outstanding,
    'outstanding_after', v_new_outstanding
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_receipt: never deletes anything. Flips status to CANCELLED, which
-- automatically reverses the financial effect everywhere (the payment is
-- excluded from every SUM(...) once status <> 'COMPLETED'), and permanently
-- retires the receipt number.
-- ---------------------------------------------------------------------------
create or replace function cancel_receipt(p_receipt_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_receipt receipts%rowtype;
begin
  if not has_permission('receipts.cancel') then
    raise exception 'PERMISSION_DENIED: receipts.cancel required';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_receipt from receipts where id = p_receipt_id and org_id = v_org_id;
  if not found then
    raise exception 'RECEIPT_NOT_FOUND';
  end if;
  if v_receipt.status = 'CANCELLED' then
    raise exception 'RECEIPT_ALREADY_CANCELLED';
  end if;

  select email into v_user_email from profiles where id = v_user_id;

  update receipts set status = 'CANCELLED', cancelled_at = now(), cancelled_by = v_user_id, cancellation_reason = p_reason
  where id = p_receipt_id;

  update payments set status = 'CANCELLED' where id = v_receipt.payment_id;

  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, previous_value, new_value, reason)
  values (v_org_id, v_user_id, v_user_email, 'RECEIPT_CANCELLED', 'receipts', p_receipt_id,
    jsonb_build_object('status','ACTIVE'), jsonb_build_object('status','CANCELLED'), p_reason);

  return jsonb_build_object('receipt_id', p_receipt_id, 'status', 'CANCELLED');
end;
$$;

-- ---------------------------------------------------------------------------
-- grant_discount / reverse_discount
-- ---------------------------------------------------------------------------
create or replace function grant_discount(
  p_student_fee_account_id uuid,
  p_installment_id uuid,
  p_discount_type text,
  p_value numeric,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_user_id uuid := auth.uid();
  v_base numeric(12,2);
  v_amount numeric(12,2);
  v_discount_id uuid;
begin
  if not has_permission('discounts.grant') then
    raise exception 'PERMISSION_DENIED: discounts.grant required';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;
  if p_discount_type not in ('FIXED','PERCENTAGE') then
    raise exception 'INVALID_DISCOUNT_TYPE';
  end if;

  if p_installment_id is not null then
    select effective_amount into v_base from installment_status where id = p_installment_id and student_fee_account_id = p_student_fee_account_id;
  else
    select net_fee into v_base from student_fee_summary where student_fee_account_id = p_student_fee_account_id;
  end if;

  if v_base is null then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  if p_discount_type = 'FIXED' then
    v_amount := p_value;
  else
    v_amount := round(v_base * p_value / 100.0, 2);
  end if;

  if v_amount <= 0 or v_amount > v_base then
    raise exception 'INVALID_DISCOUNT_AMOUNT: must be greater than 0 and not exceed the current fee amount (%).', v_base;
  end if;

  insert into discounts (org_id, student_fee_account_id, installment_id, discount_type, value, amount, reason, granted_by)
  values (v_org_id, p_student_fee_account_id, p_installment_id, p_discount_type, p_value, v_amount, p_reason, v_user_id)
  returning id into v_discount_id;

  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, new_value, reason)
  values (v_org_id, v_user_id, (select email from profiles where id = v_user_id), 'DISCOUNT_GRANTED', 'discounts', v_discount_id,
    jsonb_build_object('amount', v_amount, 'type', p_discount_type, 'value', p_value), p_reason);

  return v_discount_id;
end;
$$;

create or replace function reverse_discount(p_discount_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_user_id uuid := auth.uid();
begin
  if not has_permission('discounts.grant') then
    raise exception 'PERMISSION_DENIED: discounts.grant required';
  end if;
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'REASON_REQUIRED';
  end if;

  update discounts set status = 'REVERSED', reversed_by = v_user_id, reversed_at = now(), reversal_reason = p_reason
  where id = p_discount_id and org_id = v_org_id and status = 'ACTIVE';

  if not found then
    raise exception 'DISCOUNT_NOT_FOUND_OR_ALREADY_REVERSED';
  end if;

  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, new_value, reason)
  values (v_org_id, v_user_id, (select email from profiles where id = v_user_id), 'DISCOUNT_REVERSED', 'discounts', p_discount_id,
    jsonb_build_object('status','REVERSED'), p_reason);

  return jsonb_build_object('discount_id', p_discount_id, 'status', 'REVERSED');
end;
$$;

-- ---------------------------------------------------------------------------
-- Generic audit-log writer for actions outside the functions above
-- (student created/edited, user created, settings changed, etc.) so the
-- application never inserts into audit_logs directly.
-- ---------------------------------------------------------------------------
create or replace function write_audit_log(
  p_action text,
  p_module text,
  p_record_id uuid,
  p_previous_value jsonb,
  p_new_value jsonb,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_org_id uuid := current_org_id();
  v_user_id uuid := auth.uid();
begin
  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, previous_value, new_value, reason)
  values (v_org_id, v_user_id, (select email from profiles where id = v_user_id), p_action, p_module, p_record_id, p_previous_value, p_new_value, p_reason)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function next_counter_value(uuid, text) to service_role;
grant execute on function generate_student_code(uuid) to authenticated, service_role;
grant execute on function assign_fee_to_student(uuid, uuid) to authenticated;
grant execute on function record_payment(uuid, uuid, numeric, text, date, text, text, uuid) to authenticated;
grant execute on function cancel_receipt(uuid, text) to authenticated;
grant execute on function grant_discount(uuid, uuid, text, numeric, text) to authenticated;
grant execute on function reverse_discount(uuid, text) to authenticated;
grant execute on function write_audit_log(text, text, uuid, jsonb, jsonb, text) to authenticated;

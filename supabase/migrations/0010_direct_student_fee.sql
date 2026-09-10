-- ============================================================================
-- Migration 0010: Enter a student's fee directly on the student's own record,
-- with no separate reusable "Fee Structure" step.
--
-- Design: rather than reshaping the schema (fee_structures / fee_structure_
-- items / fee_structure_installments / student_fee_accounts / installments
-- are deeply relied on by receipts, the ledger view, discounts and audit
-- history), each direct fee entry still creates one fee_structures row
-- behind the scenes - it is just no longer created or browsed as its own
-- step. It is auto-named from the student/course/year and is never reused
-- across students (create_fee_structure() and the fee-structures list/detail
-- UI are removed from the app; assign_fee_to_student() is superseded by
-- create_student_fee() below but left in the database for any historical
-- reference).
--
-- Two new functions:
--   * create_student_fee(student, items, installments) - the whole "enter a
--     fee" flow (used both on the New Student page and the student's "Add
--     Fee" action later), as one atomic transaction.
--   * update_student_fee(account, items, installments) - lets a mistake be
--     fixed before any money has moved. Blocked once the account has a
--     completed payment or an active discount, per spec #25 (never silently
--     edit historical financial transactions) - the fix in that case is to
--     add a new, correct fee entry instead.
-- ============================================================================

create or replace function create_student_fee(
  p_student_id uuid,
  p_items jsonb,        -- [{ "fee_head_id": "...", "amount": 1000 }, ...]
  p_installments jsonb  -- [{ "seq_no": 1, "label": "Installment 1", "amount": 10000, "due_date": "2026-06-10" }, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_user_id uuid := auth.uid();
  v_student students%rowtype;
  v_course_name text;
  v_year_name text;
  v_structure_name text;
  v_total_fee numeric(12,2);
  v_installment_total numeric(12,2);
  v_structure_id uuid;
  v_account_id uuid;
  v_item jsonb;
  v_inst jsonb;
begin
  if not has_permission('student_fees.write') then
    raise exception 'PERMISSION_DENIED: student_fees.write required';
  end if;

  select * into v_student from students where id = p_student_id and org_id = v_org_id;
  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;
  if v_student.course_id is null or v_student.academic_year_id is null then
    raise exception 'STUDENT_MISSING_COURSE_OR_YEAR: set Course and Academic Year on the student profile before entering a fee.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'FEE_NEEDS_AT_LEAST_ONE_FEE_HEAD';
  end if;
  if p_installments is null or jsonb_array_length(p_installments) = 0 then
    raise exception 'FEE_NEEDS_AT_LEAST_ONE_INSTALLMENT';
  end if;

  select coalesce(sum((item->>'amount')::numeric), 0) into v_total_fee from jsonb_array_elements(p_items) item;
  select coalesce(sum((inst->>'amount')::numeric), 0) into v_installment_total from jsonb_array_elements(p_installments) inst;

  if v_total_fee <= 0 then
    raise exception 'INVALID_TOTAL_FEE: fee amounts must sum to more than zero';
  end if;
  if v_installment_total <> v_total_fee then
    raise exception 'INSTALLMENTS_DO_NOT_MATCH_TOTAL: installments sum to % but total fee is %', v_installment_total, v_total_fee;
  end if;

  select name into v_course_name from courses where id = v_student.course_id;
  select name into v_year_name from academic_years where id = v_student.academic_year_id;
  v_structure_name := v_student.name || ' - ' || coalesce(v_course_name, 'Course') || ' (' || coalesce(v_year_name, 'Year') || ')';

  insert into fee_structures (org_id, name, academic_year_id, course_id, batch_id, total_fee, created_by)
  values (v_org_id, v_structure_name, v_student.academic_year_id, v_student.course_id, null, v_total_fee, v_user_id)
  returning id into v_structure_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into fee_structure_items (fee_structure_id, fee_head_id, amount)
    values (v_structure_id, (v_item->>'fee_head_id')::uuid, (v_item->>'amount')::numeric);
  end loop;

  for v_inst in select * from jsonb_array_elements(p_installments)
  loop
    insert into fee_structure_installments (fee_structure_id, seq_no, label, amount, due_date)
    values (v_structure_id, (v_inst->>'seq_no')::int, v_inst->>'label', (v_inst->>'amount')::numeric, (v_inst->>'due_date')::date);
  end loop;

  insert into student_fee_accounts (org_id, student_id, fee_structure_id, academic_year_id, total_fee, assigned_by)
  values (v_org_id, p_student_id, v_structure_id, v_student.academic_year_id, v_total_fee, v_user_id)
  returning id into v_account_id;

  for v_inst in select * from jsonb_array_elements(p_installments)
  loop
    insert into installments (org_id, student_fee_account_id, seq_no, label, amount, due_date)
    values (v_org_id, v_account_id, (v_inst->>'seq_no')::int, v_inst->>'label', (v_inst->>'amount')::numeric, (v_inst->>'due_date')::date);
  end loop;

  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, new_value)
  values (v_org_id, v_user_id, (select email from profiles where id = v_user_id), 'FEE_ASSIGNED', 'student_fees', v_account_id,
    jsonb_build_object('student_id', p_student_id, 'total_fee', v_total_fee));

  return v_account_id;
end;
$$;

create or replace function update_student_fee(
  p_student_fee_account_id uuid,
  p_items jsonb,
  p_installments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_user_id uuid := auth.uid();
  v_sfa student_fee_accounts%rowtype;
  v_total_fee numeric(12,2);
  v_installment_total numeric(12,2);
  v_item jsonb;
  v_inst jsonb;
begin
  if not has_permission('student_fees.write') then
    raise exception 'PERMISSION_DENIED: student_fees.write required';
  end if;

  select * into v_sfa from student_fee_accounts where id = p_student_fee_account_id and org_id = v_org_id;
  if not found then
    raise exception 'STUDENT_FEE_ACCOUNT_NOT_FOUND';
  end if;

  if exists (select 1 from payments where student_fee_account_id = p_student_fee_account_id and status = 'COMPLETED') then
    raise exception 'CANNOT_EDIT_FEE_WITH_PAYMENTS: this fee already has a payment recorded against it. Add a new fee entry instead of editing this one.';
  end if;
  if exists (select 1 from discounts where student_fee_account_id = p_student_fee_account_id and status = 'ACTIVE') then
    raise exception 'CANNOT_EDIT_FEE_WITH_DISCOUNTS: this fee already has a discount recorded against it. Add a new fee entry instead of editing this one.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'FEE_NEEDS_AT_LEAST_ONE_FEE_HEAD';
  end if;
  if p_installments is null or jsonb_array_length(p_installments) = 0 then
    raise exception 'FEE_NEEDS_AT_LEAST_ONE_INSTALLMENT';
  end if;

  select coalesce(sum((item->>'amount')::numeric), 0) into v_total_fee from jsonb_array_elements(p_items) item;
  select coalesce(sum((inst->>'amount')::numeric), 0) into v_installment_total from jsonb_array_elements(p_installments) inst;

  if v_total_fee <= 0 then
    raise exception 'INVALID_TOTAL_FEE: fee amounts must sum to more than zero';
  end if;
  if v_installment_total <> v_total_fee then
    raise exception 'INSTALLMENTS_DO_NOT_MATCH_TOTAL: installments sum to % but total fee is %', v_installment_total, v_total_fee;
  end if;

  delete from fee_structure_items where fee_structure_id = v_sfa.fee_structure_id;
  delete from fee_structure_installments where fee_structure_id = v_sfa.fee_structure_id;
  delete from installments where student_fee_account_id = p_student_fee_account_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into fee_structure_items (fee_structure_id, fee_head_id, amount)
    values (v_sfa.fee_structure_id, (v_item->>'fee_head_id')::uuid, (v_item->>'amount')::numeric);
  end loop;

  for v_inst in select * from jsonb_array_elements(p_installments)
  loop
    insert into fee_structure_installments (fee_structure_id, seq_no, label, amount, due_date)
    values (v_sfa.fee_structure_id, (v_inst->>'seq_no')::int, v_inst->>'label', (v_inst->>'amount')::numeric, (v_inst->>'due_date')::date);

    insert into installments (org_id, student_fee_account_id, seq_no, label, amount, due_date)
    values (v_org_id, p_student_fee_account_id, (v_inst->>'seq_no')::int, v_inst->>'label', (v_inst->>'amount')::numeric, (v_inst->>'due_date')::date);
  end loop;

  update fee_structures set total_fee = v_total_fee where id = v_sfa.fee_structure_id;
  update student_fee_accounts set total_fee = v_total_fee where id = p_student_fee_account_id;

  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, previous_value, new_value)
  values (v_org_id, v_user_id, (select email from profiles where id = v_user_id), 'FEE_UPDATED', 'student_fees', p_student_fee_account_id,
    jsonb_build_object('total_fee', v_sfa.total_fee), jsonb_build_object('total_fee', v_total_fee));

  return p_student_fee_account_id;
end;
$$;

grant execute on function create_student_fee(uuid, jsonb, jsonb) to authenticated;
grant execute on function update_student_fee(uuid, jsonb, jsonb) to authenticated;

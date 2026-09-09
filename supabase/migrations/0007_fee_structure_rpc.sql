-- ============================================================================
-- Migration 0007: Fee structure creation, as one atomic transaction
-- (fee_structures + fee_structure_items + fee_structure_installments).
-- ============================================================================

create or replace function create_fee_structure(
  p_name text,
  p_academic_year_id uuid,
  p_course_id uuid,
  p_batch_id uuid,
  p_items jsonb,      -- [{ "fee_head_id": "...", "amount": 1000 }, ...]
  p_installments jsonb -- [{ "seq_no": 1, "label": "Installment 1", "amount": 10000, "due_date": "2026-06-10" }, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid := current_org_id();
  v_user_id uuid := auth.uid();
  v_total_fee numeric(12,2);
  v_installment_total numeric(12,2);
  v_structure_id uuid;
  v_item jsonb;
  v_inst jsonb;
begin
  if not has_permission('fee_structures.write') then
    raise exception 'PERMISSION_DENIED: fee_structures.write required';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'FEE_STRUCTURE_NEEDS_AT_LEAST_ONE_FEE_HEAD';
  end if;
  if p_installments is null or jsonb_array_length(p_installments) = 0 then
    raise exception 'FEE_STRUCTURE_NEEDS_AT_LEAST_ONE_INSTALLMENT';
  end if;

  select coalesce(sum((item->>'amount')::numeric), 0) into v_total_fee from jsonb_array_elements(p_items) item;
  select coalesce(sum((inst->>'amount')::numeric), 0) into v_installment_total from jsonb_array_elements(p_installments) inst;

  if v_total_fee <= 0 then
    raise exception 'INVALID_TOTAL_FEE: fee head amounts must sum to more than zero';
  end if;

  if v_installment_total <> v_total_fee then
    raise exception 'INSTALLMENTS_DO_NOT_MATCH_TOTAL: installments sum to % but total fee is %', v_installment_total, v_total_fee;
  end if;

  insert into fee_structures (org_id, name, academic_year_id, course_id, batch_id, total_fee, created_by)
  values (v_org_id, p_name, p_academic_year_id, p_course_id, p_batch_id, v_total_fee, v_user_id)
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

  insert into audit_logs (org_id, user_id, user_email, action, module, record_id, new_value)
  values (v_org_id, v_user_id, (select email from profiles where id = v_user_id), 'FEE_STRUCTURE_CREATED', 'fee_structures', v_structure_id,
    jsonb_build_object('name', p_name, 'total_fee', v_total_fee));

  return v_structure_id;
end;
$$;

grant execute on function create_fee_structure(text, uuid, uuid, uuid, jsonb, jsonb) to authenticated;

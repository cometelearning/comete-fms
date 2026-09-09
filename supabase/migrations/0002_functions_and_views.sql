-- ============================================================================
-- Migration 0002: Helper functions + computed views
-- Nothing here stores a balance. Everything is derived live from
-- payments / discounts / installments so numbers can never drift.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Session helpers used by RLS policies and available to the app via RPC.
-- SECURITY DEFINER so they can read `profiles` even under RLS, but they only
-- ever return facts about the CALLING user (auth.uid()), never arbitrary data.
-- ---------------------------------------------------------------------------
create or replace function current_profile()
returns profiles
language sql
security definer
stable
set search_path = public
as $$
  select * from profiles where id = auth.uid();
$$;

create or replace function current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select org_id from profiles where id = auth.uid();
$$;

create or replace function has_permission(perm text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    join role_permissions rp on rp.role_id = p.role_id
    where p.id = auth.uid()
      and p.is_active = true
      and rp.permission_key = perm
  );
$$;

grant execute on function current_profile() to authenticated;
grant execute on function current_org_id() to authenticated;
grant execute on function has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Installment status: live, per-installment paid/waived/outstanding + status
-- ---------------------------------------------------------------------------
create or replace view installment_status as
select
  i.id,
  i.org_id,
  i.student_fee_account_id,
  i.seq_no,
  i.label,
  i.amount,
  i.due_date,
  coalesce(pa.paid_amount, 0) as paid_amount,
  coalesce(d.waived_amount, 0) as waived_amount,
  greatest(i.amount - coalesce(d.waived_amount, 0), 0) as effective_amount,
  greatest(i.amount - coalesce(d.waived_amount, 0) - coalesce(pa.paid_amount, 0), 0) as outstanding_amount,
  case
    when greatest(i.amount - coalesce(d.waived_amount, 0), 0) = 0 then 'WAIVED'
    when greatest(i.amount - coalesce(d.waived_amount, 0) - coalesce(pa.paid_amount, 0), 0) <= 0 then 'PAID'
    when i.due_date < current_date then 'OVERDUE'
    when coalesce(pa.paid_amount, 0) > 0 then 'PARTIALLY_PAID'
    else 'DUE'
  end as status,
  greatest((current_date - i.due_date), 0) as days_overdue
from installments i
left join (
  select pa.installment_id, sum(pa.amount) as paid_amount
  from payment_allocations pa
  join payments p on p.id = pa.payment_id
  where p.status = 'COMPLETED'
  group by pa.installment_id
) pa on pa.installment_id = i.id
left join (
  select d.installment_id, sum(d.amount) as waived_amount
  from discounts d
  where d.status = 'ACTIVE' and d.installment_id is not null
  group by d.installment_id
) d on d.installment_id = i.id;

-- ---------------------------------------------------------------------------
-- Student fee summary: one row per student_fee_account with live totals.
-- This is the single source of truth for "Total Fee / Discount / Net Fee /
-- Paid / Outstanding / Overdue / Next Due" shown across the app.
-- ---------------------------------------------------------------------------
create or replace view student_fee_summary as
with discount_agg as (
  select student_fee_account_id, sum(amount) as discount_total
  from discounts
  where status = 'ACTIVE'
  group by student_fee_account_id
),
paid_agg as (
  select student_fee_account_id, sum(amount) as paid_total
  from payments
  where status = 'COMPLETED'
  group by student_fee_account_id
),
overdue_agg as (
  select student_fee_account_id, sum(outstanding_amount) as overdue_amount, count(*) as overdue_installments
  from installment_status
  where status = 'OVERDUE'
  group by student_fee_account_id
),
next_due_agg as (
  select distinct on (student_fee_account_id)
    student_fee_account_id, due_date as next_due_date, outstanding_amount as next_due_amount, id as next_due_installment_id
  from installment_status
  where status in ('DUE', 'OVERDUE', 'PARTIALLY_PAID')
  order by student_fee_account_id, due_date asc
)
select
  sfa.id as student_fee_account_id,
  sfa.org_id,
  sfa.student_id,
  sfa.fee_structure_id,
  sfa.academic_year_id,
  sfa.status as account_status,
  sfa.total_fee,
  coalesce(da.discount_total, 0) as discount_total,
  (sfa.total_fee - coalesce(da.discount_total, 0)) as net_fee,
  coalesce(pa.paid_total, 0) as paid_total,
  greatest((sfa.total_fee - coalesce(da.discount_total, 0) - coalesce(pa.paid_total, 0)), 0) as outstanding_total,
  coalesce(oa.overdue_amount, 0) as overdue_amount,
  coalesce(oa.overdue_installments, 0) as overdue_installments,
  nd.next_due_amount,
  nd.next_due_date,
  nd.next_due_installment_id,
  case
    when (sfa.total_fee - coalesce(da.discount_total, 0)) <= coalesce(pa.paid_total, 0) then 'FULLY_PAID'
    when coalesce(oa.overdue_amount, 0) > 0 then 'OVERDUE'
    when coalesce(pa.paid_total, 0) > 0 then 'PARTIALLY_PAID'
    else 'PENDING'
  end as overall_status
from student_fee_accounts sfa
left join discount_agg da on da.student_fee_account_id = sfa.id
left join paid_agg pa on pa.student_fee_account_id = sfa.id
left join overdue_agg oa on oa.student_fee_account_id = sfa.id
left join next_due_agg nd on nd.student_fee_account_id = sfa.id;

-- ---------------------------------------------------------------------------
-- Student ledger: every debit/credit event, in order, with a running balance.
-- ---------------------------------------------------------------------------
create or replace view ledger_entries as
select
  sfa.org_id,
  sfa.student_id,
  sfa.id as student_fee_account_id,
  sfa.created_at as entry_at,
  ('Fee Assigned - ' || fs.name)::text as particulars,
  sfa.total_fee as debit,
  0::numeric(12,2) as credit,
  'FEE_ASSIGNED'::text as ref_type,
  sfa.id as ref_id,
  1 as sort_order
from student_fee_accounts sfa
join fee_structures fs on fs.id = sfa.fee_structure_id

union all

select
  d.org_id,
  sfa.student_id,
  d.student_fee_account_id,
  d.created_at as entry_at,
  ('Discount - ' || d.reason)::text as particulars,
  0::numeric(12,2) as debit,
  d.amount as credit,
  'DISCOUNT'::text as ref_type,
  d.id as ref_id,
  2 as sort_order
from discounts d
join student_fee_accounts sfa on sfa.id = d.student_fee_account_id
where d.status = 'ACTIVE'

union all

select
  d.org_id,
  sfa.student_id,
  d.student_fee_account_id,
  coalesce(d.reversed_at, d.created_at) as entry_at,
  ('Discount Reversed - ' || d.reason)::text as particulars,
  d.amount as debit,
  0::numeric(12,2) as credit,
  'DISCOUNT_REVERSED'::text as ref_type,
  d.id as ref_id,
  5 as sort_order
from discounts d
join student_fee_accounts sfa on sfa.id = d.student_fee_account_id
where d.status = 'REVERSED'

union all

select
  p.org_id,
  p.student_id,
  p.student_fee_account_id,
  (p.payment_date::timestamptz) as entry_at,
  ('Receipt ' || r.receipt_number || ' (' || p.payment_mode || ')')::text as particulars,
  0::numeric(12,2) as debit,
  p.amount as credit,
  'PAYMENT'::text as ref_type,
  p.id as ref_id,
  3 as sort_order
from payments p
join receipts r on r.payment_id = p.id
where p.status = 'COMPLETED'

union all

select
  p.org_id,
  p.student_id,
  p.student_fee_account_id,
  coalesce(r.cancelled_at, r.issued_at) as entry_at,
  ('Reversal - Receipt ' || r.receipt_number || ' cancelled')::text as particulars,
  p.amount as debit,
  0::numeric(12,2) as credit,
  'RECEIPT_CANCELLED'::text as ref_type,
  r.id as ref_id,
  4 as sort_order
from payments p
join receipts r on r.payment_id = p.id
where r.status = 'CANCELLED';

create or replace view student_ledger as
select
  le.*,
  sum(le.debit - le.credit) over (
    partition by le.student_id
    order by le.entry_at, le.sort_order, le.ref_id
    rows between unbounded preceding and current row
  ) as balance
from ledger_entries le;

-- Views are relations like any other and need their own SELECT grant -
-- Supabase's project-level default privileges normally cover this
-- automatically, but we grant explicitly here so the migration is correct
-- even when applied outside the Supabase dashboard. Row Level Security on
-- the underlying tables (students, payments, discounts, receipts, ...)
-- still does the actual per-row authorization for every one of these.
grant select on installment_status to authenticated;
grant select on student_fee_summary to authenticated;
grant select on ledger_entries to authenticated;
grant select on student_ledger to authenticated;

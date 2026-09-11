-- ============================================================================
-- Migration 0015: Admission Number becomes system-generated (like Student
-- ID). No column/constraint changes needed for the other two changes in
-- this round (Last Year % optional, single Remarks box) - both
-- last_year_percentage and remarks/parent_remarks were already nullable at
-- the database level; "mandatory" was only ever enforced in the app layer,
-- so relaxing/consolidating them is a pure code change with no schema
-- change. parent_remarks is NOT dropped here (never destructively remove) -
-- it simply stops being read/written by the app.
-- ============================================================================

-- Reuses the same generic per-organization counter mechanism as
-- generate_student_code (see 0005_transactional_rpc.sql: next_counter_value
-- does an atomic UPDATE ... RETURNING on the `counters` table, so it is safe
-- under concurrent student creation by multiple users). Uses a separate
-- counter key ('admission_number') from student_code, so the two sequences
-- advance independently.
create or replace function generate_admission_number(p_org_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num bigint;
begin
  v_num := next_counter_value(p_org_id, 'admission_number');
  return 'CL-ADM-' || lpad(v_num::text, 6, '0');
end;
$$;

grant execute on function generate_admission_number(uuid) to authenticated, service_role;

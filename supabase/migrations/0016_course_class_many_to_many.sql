-- ============================================================================
-- Migration 0016: A Course can now be tagged to multiple Classes
-- ============================================================================
-- Until now a course belonged to exactly one class (courses.class_id, added
-- in migration 0011). The office runs the same course (e.g. "CA
-- Foundation") across more than one class and doesn't want to create a
-- duplicate course per class, so Course <-> Class becomes a proper
-- many-to-many relationship via a new join table.
--
-- courses.class_id / courses.class_standard are NOT dropped (never
-- destructively remove) - Course Master simply stops writing class_id going
-- forward. class_standard instead becomes an auto-maintained, comma-joined
-- aggregate of every class a course is now tagged to (e.g. "Class 11,
-- Class 12"), kept in sync by triggers on the new join table below. This is
-- deliberate: it means every existing piece of *display* code that reads
-- courses.class_standard (the student profile's Class field, the Student
-- Record report table/export, the Collection/Outstanding export "class"
-- column) keeps working completely unchanged.
--
-- *Filtering* by class is a different story - text-equality against a
-- comma-joined aggregate can't correctly match a multi-class course, so
-- src/lib/reports/classFilter.ts's resolveClassToCourseIds() moves from
-- matching courses.class_standard text to querying this join table by
-- class_id directly (see that file and its callers - Collection Report,
-- Outstanding, and Student Record report). The Dashboard's class filter
-- still goes through the separate dashboard_summary() RPC (migration 0009),
-- which still matches on class_standard text - that RPC was NOT rewritten
-- in this migration (a materially larger, higher-risk change to a live
-- financial reporting function), so filtering the dashboard by one specific
-- class will under-match any course tagged to more than one class. Flagged
-- to the user as a known limitation, not fixed here.
-- ============================================================================

create table if not exists course_classes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, class_id)
);

create index idx_course_classes_org on course_classes(org_id);
create index idx_course_classes_course on course_classes(course_id);
create index idx_course_classes_class on course_classes(class_id);

alter table course_classes enable row level security;

create policy course_classes_select on course_classes for select
  using (org_id = current_org_id());
create policy course_classes_cud on course_classes for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

-- Backfill: every course that already had a single class_id gets one
-- course_classes row, preserving today's tagging exactly.
insert into course_classes (org_id, course_id, class_id)
select org_id, id, class_id from courses where class_id is not null
on conflict (course_id, class_id) do nothing;

-- ---------------------------------------------------------------------------
-- Keep courses.class_standard as the comma-joined, alphabetically ordered
-- list of every class a course is currently tagged to (via course_classes),
-- null if none. Recomputed whenever that course's tags change.
-- ---------------------------------------------------------------------------
create or replace function recompute_course_class_standard(p_course_id uuid)
returns void
language plpgsql
as $$
begin
  update courses
  set class_standard = (
    select nullif(string_agg(cl.name, ', ' order by cl.name), '')
    from course_classes cc
    join classes cl on cl.id = cc.class_id
    where cc.course_id = p_course_id
  )
  where id = p_course_id;
end;
$$;

create or replace function trg_course_classes_sync()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_course_class_standard(old.course_id);
    return old;
  else
    perform recompute_course_class_standard(new.course_id);
    return new;
  end if;
end;
$$;

drop trigger if exists trg_course_classes_sync_standard on course_classes;
create trigger trg_course_classes_sync_standard
  after insert or update or delete on course_classes
  for each row execute function trg_course_classes_sync();

-- If a class is renamed, cascade the new name into every course tagged to
-- it (previously matched courses.class_id = new.id directly; now walks the
-- join table, since a course can be tagged to several classes at once).
create or replace function sync_courses_on_class_rename()
returns trigger
language plpgsql
as $$
declare
  v_course_id uuid;
begin
  if new.name is distinct from old.name then
    for v_course_id in select course_id from course_classes where class_id = new.id loop
      perform recompute_course_class_standard(v_course_id);
    end loop;
  end if;
  return new;
end;
$$;

-- trg_classes_cascade_rename (created in migration 0011) already points at
-- this function name and fires on the same event, so replacing the
-- function body above is sufficient - no need to redrop/recreate the
-- trigger itself.

grant execute on function recompute_course_class_standard(uuid) to authenticated, service_role;

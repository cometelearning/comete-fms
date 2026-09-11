-- ============================================================================
-- Migration 0011: Class Master, separate from Course Master
-- ============================================================================
-- Until now "class" was a free-text field (courses.class_standard) typed
-- directly on the Course Master form. This migration turns Class into its
-- own master table (like Academic Years / Fee Heads), and Course Master
-- references it via a proper foreign key (courses.class_id).
--
-- courses.class_standard is kept in the schema and kept in sync
-- automatically (via trigger, from classes.name) rather than removed,
-- because the dashboard summary RPC, the Collection/Outstanding/Student
-- Record report queries and their filter dropdowns all currently filter on
-- that text column (see src/lib/reports/classFilter.ts). Keeping it in sync
-- means none of that query code has to change: it keeps matching class
-- names exactly as before, only now that name is governed by Class Master
-- instead of being typed freely on every course.

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create index idx_classes_org on classes(org_id);

alter table classes enable row level security;

create policy classes_select on classes for select
  using (org_id = current_org_id());
create policy classes_cud on classes for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

-- ---------------------------------------------------------------------------
-- Link courses to classes
-- ---------------------------------------------------------------------------
alter table courses add column if not exists class_id uuid references classes(id);
create index if not exists idx_courses_class on courses(class_id);

-- Backfill: one classes row per distinct existing class_standard value, per org.
insert into classes (org_id, name)
select distinct org_id, btrim(class_standard)
from courses
where class_standard is not null and btrim(class_standard) <> ''
on conflict (org_id, name) do nothing;

update courses c
set class_id = cl.id
from classes cl
where cl.org_id = c.org_id
  and cl.name = btrim(c.class_standard)
  and c.class_standard is not null
  and c.class_id is null;

-- ---------------------------------------------------------------------------
-- Keep courses.class_standard in sync with classes.name, so existing
-- dashboard/report filter code (which matches on that text column) keeps
-- working unchanged.
-- ---------------------------------------------------------------------------
create or replace function sync_course_class_standard()
returns trigger
language plpgsql
as $$
begin
  if new.class_id is not null then
    select name into new.class_standard from classes where id = new.class_id;
  else
    new.class_standard := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_courses_sync_class_standard on courses;
create trigger trg_courses_sync_class_standard
  before insert or update of class_id on courses
  for each row execute function sync_course_class_standard();

-- If a class is renamed in Class Master, cascade the new name to every
-- course referencing it (so report filters stay correct).
create or replace function sync_courses_on_class_rename()
returns trigger
language plpgsql
as $$
begin
  if new.name is distinct from old.name then
    update courses set class_standard = new.name where class_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_classes_cascade_rename on classes;
create trigger trg_classes_cascade_rename
  after update of name on classes
  for each row execute function sync_courses_on_class_rename();

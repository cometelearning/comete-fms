-- ============================================================================
-- Migration 0022: Subjects <-> Classes, many-to-many.
--
-- Per explicit user correction (verbatim): "the subjects master be created
-- many to one, like Maths, Science and english may be tagged to all the
-- class from 6th to 10th etc., but you should not mistake like course and
-- classes in reporting format."
--
-- Migration 0020 modelled a Subject as belonging to exactly one Class
-- (subjects.class_id not null, unique(org_id, class_id, name)) - so "Maths"
-- would have had to be re-created once per class (Maths/Class 6, Maths/
-- Class 7, ...), which is wrong: one subject is taught across many classes.
-- This migration fixes the data model to many-to-many via a join table, and
-- carries forward any subjects already created under 0020 so nothing is
-- lost.
--
-- "Should not mistake course and classes in reporting format" - Course and
-- Class remain their own separate masters (courses, classes); this
-- migration only changes how Subjects relate to Classes and does not touch
-- Course at all. The application layer (subjects list/dialog) must keep
-- labelling this relationship "Classes", never "Course".
-- ============================================================================

create table if not exists subject_classes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (subject_id, class_id)
);

create index if not exists idx_subject_classes_org on subject_classes(org_id);
create index if not exists idx_subject_classes_subject on subject_classes(subject_id);
create index if not exists idx_subject_classes_class on subject_classes(class_id);

alter table subject_classes enable row level security;

create policy subject_classes_select on subject_classes for select
  using (org_id = current_org_id());
create policy subject_classes_cud on subject_classes for all
  using (org_id = current_org_id() and has_permission('masters.write'))
  with check (org_id = current_org_id() and has_permission('masters.write'));

-- Carry forward every subject already created under the old one-class-only
-- model into the new join table before the column is dropped.
insert into subject_classes (org_id, subject_id, class_id)
select org_id, id, class_id from subjects where class_id is not null
on conflict do nothing;

-- Subjects are now defined once, independent of any single class.
alter table subjects drop constraint if exists subjects_org_id_class_id_name_key;
drop index if exists idx_subjects_class;
alter table subjects drop column if exists class_id;
alter table subjects add constraint subjects_org_id_name_key unique (org_id, name);

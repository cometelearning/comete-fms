-- ============================================================================
-- Migration 0013: simplify Batch back to a plain type label (e.g. Morning /
-- Evening) - not linked to Course/Academic Year/Branch - and add
-- students.date_of_birth.
-- ============================================================================

-- Batch is just a type label, not an academic-placement master. The
-- original schema (0001) required course_id and academic_year_id on every
-- batch; relax that so Batch Master can go back to being a simple
-- name-only master, matching Fee Heads / Classes / Branches. The columns
-- themselves are left in place (not dropped) so no historical data is
-- lost - they simply stop being required or shown in the UI.
alter table batches alter column course_id drop not null;
alter table batches alter column academic_year_id drop not null;

-- Date of Birth: nullable at the database level (existing students don't
-- have it yet), but the application now requires it for every new student
-- and whenever an existing student is next edited.
alter table students add column if not exists date_of_birth date;

-- ============================================================================
-- Migration 0006: updated_at maintenance triggers
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at before update on organizations
  for each row execute function set_updated_at();

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create trigger trg_students_updated_at before update on students
  for each row execute function set_updated_at();

create trigger trg_receipts_files_updated_at before update on google_drive_files
  for each row execute function set_updated_at();

create trigger trg_gdrive_accounts_updated_at before update on google_drive_accounts
  for each row execute function set_updated_at();

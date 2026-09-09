import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { OrganizationForm } from '@/components/settings/OrganizationForm';
import { GoogleDriveCard } from '@/components/settings/GoogleDriveCard';
import { BackupButton } from '@/components/settings/BackupButton';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('settings.manage')) redirect('/dashboard');

  const supabase = createClient();
  const { data: org } = await supabase.from('organizations').select('*').eq('id', session.orgId).single();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Organization details, Google Drive connection and data backups.</p>
      </div>

      <OrganizationForm initial={{ name: org?.name ?? 'COMETE LEARNING', address: org?.address ?? null, phone: org?.phone ?? null, email: org?.email ?? null }} />

      <GoogleDriveCard />

      <div className="card p-6">
        <h2 className="mb-2 font-semibold text-slate-800">Data Backup</h2>
        <p className="mb-4 text-sm text-slate-500">
          Download a full backup (students, fees, payments, receipts, discounts and the audit trail) as a zip of CSV files. If Google Drive is
          connected, a copy is also saved to Backups/ automatically.
        </p>
        <BackupButton />
      </div>
    </div>
  );
}

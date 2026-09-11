import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { toCsv } from '@/lib/export/tabular';
import { uploadFile } from '@/lib/google-drive/client';

export const runtime = 'nodejs';

const BACKUP_TABLES = [
  'students',
  'boards',
  'branches',
  'classes',
  'courses',
  'batches',
  'academic_years',
  'fee_heads',
  'ptm_records',
  'fee_structures',
  'fee_structure_items',
  'fee_structure_installments',
  'student_fee_accounts',
  'installments',
  'discounts',
  'payments',
  'receipts',
  'audit_logs'
] as const;

/**
 * Full data export/backup (spec #36/#37). Every core table is exported as a
 * CSV and bundled into one zip, downloaded to the browser AND (when Google
 * Drive is connected) saved to Backups/<timestamp>.zip. A Drive failure
 * never blocks the download - the zip has already been built.
 */
export async function GET() {
  try {
    const session = await requirePermission('settings.manage');
    const supabase = createClient();

    const zip = new JSZip();
    for (const table of BACKUP_TABLES) {
      const { data, error } = await supabase.from(table).select('*').eq('org_id', session.orgId);
      if (error) continue; // don't let one table's issue abort the whole backup
      const rows = data ?? [];
      const columns = rows.length > 0 ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : [{ key: 'note', label: 'note' }];
      const csv = rows.length > 0 ? toCsv(columns, rows) : 'No records.';
      zip.file(`${table}.csv`, csv);
    }

    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(
      now.getHours()
    ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = `Backup_${stamp}.zip`;

    // Best-effort Drive copy. Awaited (rather than fire-and-forget) because a
    // Vercel serverless function stops executing once the response is sent -
    // this is the only reliable place to run it. Never throws; a Drive
    // failure here must not stop the browser download of the backup that is
    // already built.
    try {
      await uploadFile(session.orgId, ['Backups'], fileName, bytes, 'application/zip');
    } catch {
      // Drive connection status is visible in Settings; the download below still succeeds.
    }

    await supabase.rpc('write_audit_log', {
      p_action: 'BACKUP_GENERATED',
      p_module: 'settings',
      p_record_id: null,
      p_previous_value: null,
      p_new_value: { fileName },
      p_reason: null
    });

    return new Response(Buffer.from(bytes), {
      headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${fileName}"` }
    });
  } catch (error) {
    return apiError(error);
  }
}

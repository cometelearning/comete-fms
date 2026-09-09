'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils/format';

export function GoogleDriveCard() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch('/api/google-drive/status')
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.data);
        setConfigured(d.configured);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function disconnect() {
    await fetch('/api/google-drive/disconnect', { method: 'POST' });
    load();
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch('/api/google-drive/test', { method: 'POST' });
    const data = await res.json();
    setTestResult(data.data?.connected ? `Connection OK (${data.data.email})` : data.data?.error ?? 'Not connected');
    setTesting(false);
  }

  const connectedMessage = searchParams.get('drive_connected');
  const errorMessage = searchParams.get('drive_error');

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">Google Drive</h2>
        {!loading && <Badge status={status?.status ?? 'DISCONNECTED'} label={status?.status === 'CONNECTED' ? 'Connected' : 'Not Connected'} />}
      </div>

      {connectedMessage && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{connectedMessage}</p>}
      {errorMessage && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}

      {!configured ? (
        <p className="text-sm text-slate-500">
          Google Drive is not configured on this deployment yet. A Super Admin needs to add <code className="text-xs">GOOGLE_CLIENT_ID</code> and{' '}
          <code className="text-xs">GOOGLE_CLIENT_SECRET</code> to the environment variables (see README.md). Receipts and payments work fully in the
          meantime - PDF storage will simply show as &quot;Pending&quot; until this is connected.
        </p>
      ) : loading ? (
        <p className="text-sm text-slate-500">Checking…</p>
      ) : status?.status === 'CONNECTED' ? (
        <div className="space-y-2 text-sm">
          <p className="text-slate-600">
            Connected as <span className="font-medium">{status.connected_email}</span>
          </p>
          {status.connected_at && <p className="text-xs text-slate-400">Since {formatDateTime(status.connected_at)}</p>}
          <div className="flex gap-2 pt-2">
            <button className="btn-secondary" onClick={test} disabled={testing}>
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button className="btn-danger" onClick={disconnect}>
              Disconnect
            </button>
          </div>
          {testResult && <p className="text-xs text-slate-500">{testResult}</p>}
        </div>
      ) : (
        <div>
          <p className="mb-3 text-sm text-slate-500">
            Receipt PDFs, reports and backups are saved to a Google Drive folder your organization controls. Connect the account COMETE LEARNING
            wants to use for storage.
          </p>
          <a href="/api/google-drive/connect" className="btn-primary">
            Connect Google Drive
          </a>
        </div>
      )}
    </div>
  );
}

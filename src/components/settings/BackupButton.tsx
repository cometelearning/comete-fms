'use client';

import { useState } from 'react';

export function BackupButton() {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const res = await fetch('/api/backup');
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || 'backup.zip';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn-primary" onClick={download} disabled={loading}>
      {loading ? 'Preparing backup…' : 'Download Backup'}
    </button>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [alreadySetUp, setAlreadySetUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    orgName: 'COMETE LEARNING',
    orgEmail: '',
    orgPhone: '',
    orgAddress: '',
    adminName: '',
    adminEmail: '',
    adminMobile: '',
    adminPassword: ''
  });

  useEffect(() => {
    fetch('/api/setup')
      .then((r) => r.json())
      .then((d) => setAlreadySetUp(!!d.setupComplete))
      .finally(() => setChecking(false));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Setup failed.');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <CenteredCard>Checking setup status…</CenteredCard>;
  }

  if (alreadySetUp) {
    return (
      <CenteredCard>
        <p className="text-slate-700">COMETE LEARNING is already set up.</p>
        <a href="/login" className="btn-primary mt-4">
          Go to sign in
        </a>
      </CenteredCard>
    );
  }

  if (success) {
    return (
      <CenteredCard>
        <p className="text-emerald-700">Setup complete. Redirecting you to sign in…</p>
      </CenteredCard>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-10">
      <div className="card p-8">
        <h1 className="text-xl font-semibold text-slate-900">Set up COMETE LEARNING</h1>
        <p className="mt-1 text-sm text-slate-500">
          This one-time setup creates your organization and your Super Admin account. It will not run again once complete.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800">Organization</legend>
            <div>
              <label className="label">Organization name</label>
              <input className="input" required value={form.orgName} onChange={(e) => update('orgName', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Contact email</label>
                <input type="email" className="input" value={form.orgEmail} onChange={(e) => update('orgEmail', e.target.value)} />
              </div>
              <div>
                <label className="label">Contact phone</label>
                <input className="input" value={form.orgPhone} onChange={(e) => update('orgPhone', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={form.orgAddress} onChange={(e) => update('orgAddress', e.target.value)} />
            </div>
          </fieldset>

          <fieldset className="space-y-3 border-t border-slate-100 pt-4">
            <legend className="text-sm font-semibold text-slate-800">Your Super Admin account</legend>
            <div>
              <label className="label">Full name</label>
              <input className="input" required value={form.adminName} onChange={(e) => update('adminName', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Email (used to sign in)</label>
                <input type="email" className="input" required value={form.adminEmail} onChange={(e) => update('adminEmail', e.target.value)} />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input className="input" value={form.adminMobile} onChange={(e) => update('adminMobile', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                required
                minLength={8}
                value={form.adminPassword}
                onChange={(e) => update('adminPassword', e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">At least 8 characters. You can change this later.</p>
            </div>
          </fieldset>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Setting up…' : 'Create organization & Super Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md p-8 text-center">{children}</div>
    </div>
  );
}

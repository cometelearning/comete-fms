'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? 'Could not reset your password.');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">COMETE LEARNING</h1>
          <p className="text-sm text-slate-500">Choose a new password</p>
        </div>

        {!token ? (
          <div className="card space-y-4 p-6 text-sm">
            <p className="text-red-700">This reset link is missing its token. Please use the link from your email, or request a new one.</p>
            <Link href="/forgot-password" className="btn-secondary block text-center">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="card p-6 text-sm text-slate-700">Your password has been reset. Redirecting to sign in…</div>
        ) : (
          <form onSubmit={submit} className="card space-y-4 p-6">
            <div>
              <label className="label">New password</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Saving…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

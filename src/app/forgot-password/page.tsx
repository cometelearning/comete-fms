'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ emailConfigured: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setResult(res.ok ? data.data : { emailConfigured: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-brand-700">COMETE LEARNING</h1>
          <p className="text-sm text-slate-500">Reset your password</p>
        </div>

        {result ? (
          <div className="card space-y-4 p-6 text-sm">
            {result.emailConfigured ? (
              <p className="text-slate-700">
                If <span className="font-medium">{email}</span> belongs to an account here, we&apos;ve sent a link to reset the password. It
                expires in 30 minutes.
              </p>
            ) : (
              <p className="text-slate-700">
                Email sending hasn&apos;t been set up on this deployment yet, so this link can&apos;t be sent right now. Ask your Super Admin to
                reset your password from the Users tab instead.
              </p>
            )}
            <Link href="/login" className="btn-secondary block text-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4 p-6">
            <p className="text-sm text-slate-500">Enter the email you sign in with and we&apos;ll send you a reset link.</p>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                autoComplete="username"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@cometelearning.com"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <Link href="/login" className="block text-center text-xs text-slate-400 hover:text-slate-600">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

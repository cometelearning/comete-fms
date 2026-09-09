export function StatCard({ label, value, tone, hint }: { label: string; value: string; tone?: 'default' | 'danger' | 'success'; hint?: string }) {
  const toneClass = tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

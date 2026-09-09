import { formatCurrency } from '@/lib/utils/format';

export function BarList({ title, items }: { title: string; items: { label: string; amount: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.amount));
  return (
    <div className="card p-5">
      <h3 className="mb-4 font-semibold text-slate-800">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">No collections this month yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-slate-700">{item.label.replace('_', ' ')}</span>
                <span className="font-medium text-slate-900">{formatCurrency(item.amount)}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(4, (item.amount / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

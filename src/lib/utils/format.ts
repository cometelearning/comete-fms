export function formatCurrency(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(n);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function statusBadgeColor(status: string): string {
  switch (status) {
    case 'PAID':
    case 'FULLY_PAID':
    case 'ACTIVE':
    case 'COMPLETED':
    case 'STORED':
    case 'CONNECTED':
      return 'bg-emerald-100 text-emerald-800';
    case 'PARTIALLY_PAID':
      return 'bg-amber-100 text-amber-800';
    case 'OVERDUE':
      return 'bg-red-100 text-red-800';
    case 'DUE':
    case 'PENDING':
      return 'bg-slate-100 text-slate-700';
    case 'WAIVED':
      return 'bg-sky-100 text-sky-800';
    case 'CANCELLED':
    case 'INACTIVE':
    case 'FAILED':
    case 'DISCONNECTED':
      return 'bg-gray-200 text-gray-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

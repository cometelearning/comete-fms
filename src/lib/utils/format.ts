export function formatCurrency(amount: number | null | undefined): string {
  const n = amount ?? 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(n);
}

/**
 * Same INR grouping/decimals as formatCurrency(), but spells out "Rs." instead
 * of the Unicode Rupee sign (U+20B9). Use this - never formatCurrency() -
 * anywhere text is drawn into a PDF via pdf-lib's standard 14 fonts
 * (StandardFonts.Helvetica/HelveticaBold, used by src/lib/pdf/receipt.ts and
 * src/lib/pdf/table.ts): those fonts only support WinAnsi encoding, which has
 * no Rupee glyph, and pdf-lib throws ("WinAnsi cannot encode...") rather than
 * silently dropping the character. The web UI, CSV and XLSX exports are fine
 * with formatCurrency() as-is - browsers and Excel render "₹" correctly, so
 * don't switch those over.
 */
export function formatCurrencyForPdf(amount: number | null | undefined): string {
  const n = amount ?? 0;
  const number = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.abs(n));
  return `${n < 0 ? '-' : ''}Rs. ${number}`;
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

/**
 * Suffixes a student's name with their class, e.g. "Rahul Sharma (Class 10)"
 * - per the explicit user request that "where in any report student name is
 * displayed it should be suffixed by the class... for the easy referals and
 * use". Only used where a report doesn't already show Class as its own
 * dedicated column (Collection Report, Student Record Report and
 * Outstanding already do, so they don't need this).
 */
export function studentDisplayName(name: string | null | undefined, className: string | null | undefined): string {
  const n = name ?? '';
  return className ? `${n} (${className})` : n;
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

import { statusBadgeColor } from '@/lib/utils/format';

export function Badge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${statusBadgeColor(status)}`}>{label ?? status.replace(/_/g, ' ')}</span>;
}

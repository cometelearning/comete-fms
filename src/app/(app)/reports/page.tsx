import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export default async function ReportsHubPage() {
  const session = await getSession();
  if (!session || !session.permissions.has('reports.view')) redirect('/dashboard');

  const cards = [
    { href: '/reports/collection', title: 'Collection Reports', desc: 'Daily, date-wise, course-wise, batch-wise, payment-mode-wise and user-wise collection.' },
    { href: '/outstanding', title: 'Outstanding Reports', desc: 'Student-wise, course-wise and batch-wise outstanding, overdue, due this week/month.' },
    { href: '/receipts', title: 'Receipt Register', desc: 'Every receipt issued, including cancelled receipts.' },
    { href: '/receipts?status=CANCELLED', title: 'Cancelled Receipts', desc: 'Receipts that were cancelled, with reasons and who cancelled them.' },
    { href: '/reports/discounts', title: 'Discount Register', desc: 'Every discount/concession/waiver granted or reversed, and by whom.' }
  ];
  if (session.permissions.has('audit.view')) {
    cards.push({ href: '/reports/audit-logs', title: 'Audit Trail', desc: 'Full history of who changed what, and when.' });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Every report is generated live from the database and can be filtered and exported.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card block p-5 transition hover:border-brand-300 hover:shadow-md">
            <p className="font-semibold text-slate-900">{c.title}</p>
            <p className="mt-1 text-sm text-slate-500">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

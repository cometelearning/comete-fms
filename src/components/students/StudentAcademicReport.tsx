'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils/format';

const LEVEL_LABELS: Record<string, string> = { LEVEL_1: 'Level 1', LEVEL_2: 'Level 2', LEVEL_3: 'Level 3', NA: 'NA' };

export function StudentAcademicReport({ studentId }: { studentId: string }) {
  const [data, setData] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/students/${studentId}/academic-report`)
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading || !data) return <p className="text-sm text-slate-500">Loading academic report…</p>;

  const { student, ptmRecords, practiceSlips, performanceRecords, copyChecks } = data;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Academic Report - {student.name}</h1>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => window.print()}>
            Print
          </button>
          <a className="btn-secondary" href={`/api/students/${studentId}/academic-report/pdf`} target="_blank" rel="noreferrer">
            Download PDF
          </a>
        </div>
      </div>

      <div className="card p-8">
        <div className="mb-6 grid grid-cols-2 gap-4 border-b border-slate-100 pb-4 text-sm">
          <Field label="Student Name" value={student.name} />
          <Field label="Student ID" value={student.student_code} />
          <Field label="Parent / Guardian" value={student.guardian_name} />
          <Field label="Course" value={student.courses?.name} />
          <Field label="Class" value={student.classes?.name} />
          <Field label="Academic Year" value={student.academic_years?.name} />
        </div>

        <Section title="PTM Records">
          {ptmRecords.length === 0 ? (
            <Empty label="No PTM records." />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Attended</th>
                  <th>Parent&apos;s Remarks</th>
                  <th>Counsellor Remarks</th>
                </tr>
              </thead>
              <tbody>
                {ptmRecords.map((r: any, i: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                  <tr key={i}>
                    <td>{formatDate(r.ptm_date)}</td>
                    <td>{r.attended ? 'Yes' : 'No'}</td>
                    <td>{r.parent_remarks ?? '-'}</td>
                    <td>{r.counsellor_remarks ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Practice Slips">
          {practiceSlips.length === 0 ? (
            <Empty label="No practice slips." />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Topic</th>
                  <th>Level</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {practiceSlips.map((r: any, i: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                  <tr key={i}>
                    <td>{formatDate(r.slip_date)}</td>
                    <td>{r.subjects?.name ?? '-'}</td>
                    <td>{r.topic}</td>
                    <td>{LEVEL_LABELS[r.level] ?? r.level}</td>
                    <td>{r.status === 'CHECKED' ? 'Checked' : 'Pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Student Performance (Marks)">
          {performanceRecords.length === 0 ? (
            <Empty label="No performance records." />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Exam Date</th>
                  <th>Subject</th>
                  <th>Topic</th>
                  <th className="text-right">Marks</th>
                  <th>Teacher</th>
                </tr>
              </thead>
              <tbody>
                {performanceRecords.map((r: any, i: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                  <tr key={i}>
                    <td>{formatDate(r.exam_date)}</td>
                    <td>{r.subjects?.name ?? '-'}</td>
                    <td>{r.topic}</td>
                    <td className="text-right">
                      {r.marks_obtained} / {r.total_marks}
                    </td>
                    <td>{r.teachers?.name ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section title="Practice Copy Check">
          {copyChecks.length === 0 ? (
            <Empty label="No practice copy checks." />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date Checked</th>
                  <th>Teacher (Signed)</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {copyChecks.map((r: any, i: number) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                  <tr key={i}>
                    <td>{formatDate(r.check_date)}</td>
                    <td>{r.teachers?.name ?? '-'}</td>
                    <td>{r.remarks ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{value || '-'}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 break-inside-avoid">
      <h2 className="mb-2 text-sm font-semibold text-slate-800">{title}</h2>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-slate-400">{label}</p>;
}

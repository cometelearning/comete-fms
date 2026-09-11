import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/session';
import { apiError } from '@/lib/api/handler';
import { fetchStudentAcademicReportData } from '@/lib/reports/studentAcademicReport';
import { generateStudentAcademicReportPdf, type AcademicReportSection } from '@/lib/pdf/academicReport';
import { formatDate } from '@/lib/utils/format';

export const runtime = 'nodejs';

const LEVEL_LABELS: Record<string, string> = { LEVEL_1: 'Level 1', LEVEL_2: 'Level 2', LEVEL_3: 'Level 3', NA: 'NA' };

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePermission('exports.run');
    await requirePermission('students.read');
    const supabase = createClient();
    const { data: org } = await supabase.from('organizations').select('name').eq('id', session.orgId).single();

    const { student, ptmRecords, practiceSlips, performanceRecords, copyChecks } = await fetchStudentAcademicReportData(
      supabase,
      session.orgId,
      params.id
    );

    const sections: AcademicReportSection[] = [
      {
        title: 'PTM Records',
        columns: [
          { key: 'date', label: 'Date', width: 70 },
          { key: 'attended', label: 'Attended', width: 60 },
          { key: 'parent_remarks', label: "Parent's Remarks", width: 190 },
          { key: 'counsellor_remarks', label: 'Counsellor Remarks', width: 190 }
        ],
        rows: ptmRecords.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          date: formatDate(r.ptm_date),
          attended: r.attended ? 'Yes' : 'No',
          parent_remarks: r.parent_remarks ?? '-',
          counsellor_remarks: r.counsellor_remarks ?? '-'
        })),
        emptyLabel: 'No PTM records.'
      },
      {
        title: 'Practice Slips',
        columns: [
          { key: 'date', label: 'Date', width: 70 },
          { key: 'subject', label: 'Subject', width: 110 },
          { key: 'topic', label: 'Topic', width: 200 },
          { key: 'level', label: 'Level', width: 60 },
          { key: 'status', label: 'Status', width: 70 }
        ],
        rows: practiceSlips.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          date: formatDate(r.slip_date),
          subject: r.subjects?.name ?? '-',
          topic: r.topic,
          level: LEVEL_LABELS[r.level] ?? r.level,
          status: r.status === 'CHECKED' ? 'Checked' : 'Pending'
        })),
        emptyLabel: 'No practice slips.'
      },
      {
        title: 'Student Performance (Marks)',
        columns: [
          { key: 'date', label: 'Exam Date', width: 70 },
          { key: 'subject', label: 'Subject', width: 100 },
          { key: 'topic', label: 'Topic', width: 150 },
          { key: 'marks', label: 'Marks', width: 70, align: 'right' },
          { key: 'teacher', label: 'Teacher', width: 100 }
        ],
        rows: performanceRecords.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          date: formatDate(r.exam_date),
          subject: r.subjects?.name ?? '-',
          topic: r.topic,
          marks: `${Number(r.marks_obtained)} / ${Number(r.total_marks)}`,
          teacher: r.teachers?.name ?? '-'
        })),
        emptyLabel: 'No performance records.'
      },
      {
        title: 'Practice Copy Check',
        columns: [
          { key: 'date', label: 'Date Checked', width: 90 },
          { key: 'teacher', label: 'Teacher (Signed)', width: 150 },
          { key: 'remarks', label: 'Remarks', width: 250 }
        ],
        rows: copyChecks.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          date: formatDate(r.check_date),
          teacher: r.teachers?.name ?? '-',
          remarks: r.remarks ?? '-'
        })),
        emptyLabel: 'No practice copy checks.'
      }
    ];

    const bytes = await generateStudentAcademicReportPdf({
      orgName: org?.name ?? 'COMETE LEARNING',
      studentName: student.name,
      studentCode: student.student_code,
      guardianName: student.guardian_name,
      courseName: (student as any).courses?.name ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      className: (student as any).classes?.name ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      academicYearName: (student as any).academic_years?.name ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
      status: student.status,
      sections
    });

    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="academic-report-${student.student_code}.pdf"`
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

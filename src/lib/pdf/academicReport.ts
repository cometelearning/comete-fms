import 'server-only';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatDateTime } from '@/lib/utils/format';

export interface AcademicReportSection {
  title: string;
  columns: { key: string; label: string; width: number; align?: 'left' | 'right' }[];
  rows: Record<string, string>[];
  emptyLabel: string;
}

export interface AcademicReportData {
  orgName: string;
  studentName: string;
  studentCode: string;
  guardianName: string | null;
  courseName: string | null;
  className: string | null;
  academicYearName: string | null;
  status: string;
  sections: AcademicReportSection[];
}

const MARGIN = 42;
const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;

/**
 * "A separate student performance report tab be also prepared and mapped to
 * student profle" + "Any report should be in proper A4 format only" - a
 * single consolidated per-student academic document (PTM, Practice Slips,
 * Student Performance/marks, Practice Copy Check), A4 portrait, paginating
 * automatically as any one section grows. Mirrors src/lib/pdf/receipt.ts's
 * low-level drawing style and src/lib/pdf/table.ts's pagination approach,
 * combined for a multi-section document.
 */
export async function generateStudentAcademicReportPdf(data: AcademicReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0.12, 0.14, 0.18);
  const gray = rgb(0.45, 0.47, 0.5);
  const brand = rgb(0.15, 0.29, 0.85);
  const lightLine = rgb(0.85, 0.86, 0.88);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  // Header: org name + "Student Academic Report" + student details
  page.drawText(data.orgName, { x: MARGIN, y, size: 16, font: bold, color: brand });
  page.drawText('Student Academic Report', { x: PAGE_W - MARGIN - 190, y, size: 13, font: bold, color: black });
  y -= 20;
  page.drawText(`Generated ${formatDateTime(new Date().toISOString())}`, { x: PAGE_W - MARGIN - 190, y, size: 8, color: gray });
  y -= 20;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: lightLine });
  y -= 20;

  const detailPairs: [string, string][] = [
    ['Student Name', data.studentName],
    ['Student ID', data.studentCode],
    ['Parent / Guardian', data.guardianName ?? '-'],
    ['Course', data.courseName ?? '-'],
    ['Class', data.className ?? '-'],
    ['Academic Year', data.academicYearName ?? '-'],
    ['Status', data.status]
  ];
  const col2X = MARGIN + 280;
  for (let i = 0; i < detailPairs.length; i += 2) {
    const [l1, v1] = detailPairs[i];
    page.drawText(l1, { x: MARGIN, y, size: 8, color: gray });
    page.drawText(v1, { x: MARGIN, y: y - 12, size: 10, font: bold, color: black });
    if (detailPairs[i + 1]) {
      const [l2, v2] = detailPairs[i + 1];
      page.drawText(l2, { x: col2X, y, size: 8, color: gray });
      page.drawText(v2, { x: col2X, y: y - 12, size: 10, font: bold, color: black });
    }
    y -= 32;
  }

  y -= 6;

  for (const section of data.sections) {
    ensureSpace(60);
    page.drawText(section.title, { x: MARGIN, y, size: 11, font: bold, color: brand });
    y -= 16;

    if (section.rows.length === 0) {
      page.drawText(section.emptyLabel, { x: MARGIN, y, size: 9, color: gray });
      y -= 24;
      continue;
    }

    function drawTableHeader() {
      let x = MARGIN;
      for (const col of section.columns) {
        page.drawText(col.label, { x, y, size: 8, font: bold, color: rgb(0.3, 0.3, 0.3) });
        x += col.width;
      }
      y -= 6;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: lightLine });
      y -= 12;
    }

    drawTableHeader();
    for (const row of section.rows) {
      if (y < MARGIN + 20) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
        page.drawText(`${section.title} (continued)`, { x: MARGIN, y, size: 11, font: bold, color: brand });
        y -= 16;
        drawTableHeader();
      }
      let x = MARGIN;
      for (const col of section.columns) {
        const value = row[col.key] ?? '';
        const textWidth = font.widthOfTextAtSize(value, 8);
        const drawX = col.align === 'right' ? x + col.width - textWidth - 6 : x;
        page.drawText(String(value).slice(0, 50), { x: drawX, y, size: 8, font, color: black });
        x += col.width;
      }
      y -= 15;
    }
    y -= 16;
  }

  return doc.save();
}

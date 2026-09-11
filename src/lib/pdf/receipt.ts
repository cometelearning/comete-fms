import 'server-only';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { amountToWordsInr } from '@/lib/utils/numberToWords';
import { formatCurrencyForPdf, formatDate, formatDateTime } from '@/lib/utils/format';

export interface ReceiptPdfData {
  orgName: string;
  orgAddress: string | null;
  orgPhone: string | null;
  orgEmail: string | null;
  receiptNumber: string;
  issuedAt: string;
  status: 'ACTIVE' | 'CANCELLED';
  studentName: string;
  studentCode: string;
  guardianName: string | null;
  courseName: string | null;
  batchName: string | null;
  academicYearName: string | null;
  installmentLabel: string | null;
  previousOutstanding: number;
  amountReceived: number;
  paymentMode: string;
  referenceNumber: string | null;
  currentOutstanding: number;
  authorizedBy: string;
}

const MARGIN = 50;
const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_H - MARGIN;
  const black = rgb(0.12, 0.14, 0.18);
  const gray = rgb(0.45, 0.47, 0.5);
  const brand = rgb(0.15, 0.29, 0.85);
  const red = rgb(0.75, 0.1, 0.1);

  function text(str: string, x: number, yy: number, opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb> } = {}) {
    page.drawText(str, { x, y: yy, size: opts.size ?? 10, font: opts.f ?? font, color: opts.color ?? black });
  }
  function line(yy: number) {
    page.drawLine({ start: { x: MARGIN, y: yy }, end: { x: PAGE_W - MARGIN, y: yy }, thickness: 0.75, color: rgb(0.85, 0.86, 0.88) });
  }

  // Header
  text(data.orgName, MARGIN, y, { size: 18, f: bold, color: brand });
  y -= 16;
  if (data.orgAddress) {
    text(data.orgAddress, MARGIN, y, { size: 9, color: gray });
    y -= 12;
  }
  const contactLine = [data.orgPhone, data.orgEmail].filter(Boolean).join('   |   ');
  if (contactLine) {
    text(contactLine, MARGIN, y, { size: 9, color: gray });
    y -= 12;
  }

  text('FEE RECEIPT', PAGE_W - MARGIN - 110, PAGE_H - MARGIN, { size: 13, f: bold });
  text(`Receipt No: ${data.receiptNumber}`, PAGE_W - MARGIN - 170, PAGE_H - MARGIN - 18, { size: 10, f: bold });
  text(`Date: ${formatDate(data.issuedAt)}`, PAGE_W - MARGIN - 170, PAGE_H - MARGIN - 32, { size: 10 });
  if (data.status === 'CANCELLED') {
    text('CANCELLED', PAGE_W - MARGIN - 170, PAGE_H - MARGIN - 48, { size: 12, f: bold, color: red });
  }

  y -= 14;
  line(y);
  y -= 24;

  // Student details, two columns
  const col2X = MARGIN + 280;
  const rowH = 18;
  const rows: [string, string, string, string][] = [
    ['Student Name', data.studentName, 'Student ID', data.studentCode],
    ['Parent / Guardian', data.guardianName ?? '-', 'Course', data.courseName ?? '-'],
    ['Batch', data.batchName ?? '-', 'Academic Year', data.academicYearName ?? '-']
  ];
  for (const [l1, v1, l2, v2] of rows) {
    text(l1, MARGIN, y, { size: 9, color: gray });
    text(v1, MARGIN, y - 13, { size: 11, f: bold });
    text(l2, col2X, y, { size: 9, color: gray });
    text(v2, col2X, y - 13, { size: 11, f: bold });
    y -= rowH + 16;
  }

  y -= 6;
  line(y);
  y -= 24;

  // Payment breakdown box
  text('Particulars', MARGIN, y, { size: 9, color: gray });
  text('Amount', PAGE_W - MARGIN - 100, y, { size: 9, color: gray });
  y -= 16;

  text(data.installmentLabel ?? 'Fee Payment', MARGIN, y, { size: 11 });
  text(formatCurrencyForPdf(data.amountReceived), PAGE_W - MARGIN - 100, y, { size: 11, f: bold });
  y -= 26;
  line(y);
  y -= 20;

  const summaryRows: [string, string][] = [
    ['Previous Outstanding', formatCurrencyForPdf(data.previousOutstanding)],
    ['Amount Received', formatCurrencyForPdf(data.amountReceived)],
    ['Payment Mode', data.paymentMode.replace('_', ' ')],
    ['Reference / Transaction No.', data.referenceNumber ?? '-'],
    ['Current Outstanding', formatCurrencyForPdf(data.currentOutstanding)]
  ];
  for (const [l, v] of summaryRows) {
    text(l, MARGIN, y, { size: 10, color: gray });
    text(v, PAGE_W - MARGIN - 200, y, { size: 10, f: bold });
    y -= 18;
  }

  y -= 10;
  line(y);
  y -= 22;

  text('Amount in Words:', MARGIN, y, { size: 9, color: gray });
  y -= 14;
  const words = amountToWordsInr(data.amountReceived);
  text(words, MARGIN, y, { size: 10, f: bold });
  y -= 40;

  text(`Authorized by: ${data.authorizedBy}`, MARGIN, y, { size: 10 });
  text('Signature: ______________________', PAGE_W - MARGIN - 220, y, { size: 10 });

  y -= 30;
  line(y);
  y -= 14;
  text(`Generated ${formatDateTime(new Date().toISOString())} - COMETE LEARNING Fee Management`, MARGIN, y, { size: 7, color: gray });

  if (data.status === 'CANCELLED') {
    page.drawText('CANCELLED', {
      x: PAGE_W / 2 - 150,
      y: PAGE_H / 2,
      size: 60,
      font: bold,
      color: rgb(0.85, 0.15, 0.15),
      opacity: 0.25,
      rotate: degrees(30)
    });
  }

  return doc.save();
}

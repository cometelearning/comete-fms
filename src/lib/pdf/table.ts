import 'server-only';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

export interface TableColumn {
  key: string;
  label: string;
  width: number; // points
  align?: 'left' | 'right';
}

/** Simple multi-page landscape table renderer, used by every CSV/XLSX-adjacent PDF export. */
export async function generateTablePdf(title: string, subtitle: string, columns: TableColumn[], rows: Record<string, string>[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 841.89; // A4 landscape
  const PAGE_H = 595.28;
  const MARGIN = 36;
  const ROW_H = 16;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function drawHeader() {
    page.drawText(title, { x: MARGIN, y, size: 14, font: bold, color: rgb(0.15, 0.29, 0.85) });
    page.drawText(subtitle, { x: MARGIN, y: y - 16, size: 8, font, color: rgb(0.45, 0.47, 0.5) });
    y -= 36;
    let x = MARGIN;
    for (const col of columns) {
      page.drawText(col.label, { x, y, size: 8, font: bold, color: rgb(0.3, 0.3, 0.3) });
      x += col.width;
    }
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 12;
  }

  drawHeader();

  for (const row of rows) {
    if (y < MARGIN + ROW_H) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawHeader();
    }
    let x = MARGIN;
    for (const col of columns) {
      const value = row[col.key] ?? '';
      const textWidth = font.widthOfTextAtSize(value, 7.5);
      const drawX = col.align === 'right' ? x + col.width - textWidth - 6 : x;
      page.drawText(String(value).slice(0, 60), { x: drawX, y, size: 7.5, font, color: rgb(0.15, 0.15, 0.18) });
      x += col.width;
    }
    y -= ROW_H;
  }

  if (rows.length === 0) {
    page.drawText('No records match the selected filters.', { x: MARGIN, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
  }

  // Watermark-style footer with generation time on the last page.
  page.drawText(`Generated ${new Date().toLocaleString('en-IN')}`, {
    x: PAGE_W - MARGIN - 160,
    y: MARGIN / 2,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.6),
    rotate: degrees(0)
  });

  return doc.save();
}

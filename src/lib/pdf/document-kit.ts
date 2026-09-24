import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

// Shared layout and drawing helpers for the printable documents (receipts,
// account statements) so they read as one family.

// US Letter, the usual office paper size in Colombia.
export const PAGE = { width: 612, height: 792, margin: 50 };
export const CONTENT_RIGHT = PAGE.width - PAGE.margin;

export const COLOR = {
  ink: rgb(0.055, 0.145, 0.22),
  text: rgb(0.2, 0.286, 0.357),
  muted: rgb(0.44, 0.514, 0.584),
  border: rgb(0.863, 0.902, 0.929),
  soft: rgb(0.973, 0.98, 0.988),
  primary: rgb(0, 0.455, 0.729),
  danger: rgb(0.741, 0.239, 0.29),
};

export type Fonts = { regular: PDFFont; bold: PDFFont };

export async function createDocument(title: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor("Sopdisponal");
  pdf.setCreator("Sopdisponal · Plataforma administrativa");
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  return { pdf, fonts };
}

// The standard PDF fonts only cover WinAnsi: Latin-1 plus a few typographic marks
// (dashes, curly quotes, bullet, ellipsis, euro). Spanish text fits; anything else
// coming from migrated data is replaced instead of crashing the render.
const outsideWinAnsi = /[^\x20-\x7E\xA1-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026\u20AC]/g;

export function clean(text: string) {
  return text.replace(/[\u00A0\u202F]/g, " ").replace(outsideWinAnsi, "?");
}

export function sentenceCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of clean(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Shortens text with an ellipsis so it fits in `maxWidth`. */
export function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  let value = clean(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) value = value.slice(0, -1);
  return `${value.trimEnd()}...`;
}

export function drawText(page: PDFPage, text: string, x: number, y: number, size: number, font: PDFFont, color = COLOR.text) {
  page.drawText(clean(text), { x, y, size, font, color });
}

export function drawRight(page: PDFPage, text: string, right: number, y: number, size: number, font: PDFFont, color = COLOR.text) {
  const value = clean(text);
  page.drawText(value, { x: right - font.widthOfTextAtSize(value, size), y, size, font, color });
}

export function drawRule(page: PDFPage, y: number, thickness = 0.75, color = COLOR.border) {
  page.drawLine({ start: { x: PAGE.margin, y }, end: { x: CONTENT_RIGHT, y }, thickness, color });
}

/**
 * Letterhead shared by every document. When the logo is provided, embed it with
 * pdf.embedPng / embedJpg, draw it at the top-left and shift the title block right.
 * Returns the y where the body starts.
 */
export function drawLetterhead(
  page: PDFPage,
  fonts: Fonts,
  { subtitle, label, value, caption }: { subtitle: string; label: string; value: string; caption: string },
) {
  const top = PAGE.height - PAGE.margin;
  drawText(page, "SOPDISPONAL", PAGE.margin, top - 16, 18, fonts.bold, COLOR.ink);
  drawText(page, subtitle, PAGE.margin, top - 32, 10, fonts.regular, COLOR.muted);

  drawRight(page, label, CONTENT_RIGHT, top - 8, 8, fonts.regular, COLOR.muted);
  drawRight(page, value, CONTENT_RIGHT, top - 26, 16, fonts.bold, COLOR.ink);
  drawRight(page, caption, CONTENT_RIGHT, top - 40, 8.5, fonts.regular, COLOR.muted);

  const ruleY = top - 70;
  drawRule(page, ruleY, 1.5, COLOR.ink);
  return ruleY - 30;
}

export function drawSectionTitle(page: PDFPage, title: string, y: number, fonts: Fonts) {
  drawText(page, title.toUpperCase(), PAGE.margin, y, 8.5, fonts.bold, COLOR.primary);
  drawRule(page, y - 6);
  return y - 24;
}

const FIELD_ROW_HEIGHT = 32;

/** Label/value grid (two columns by default). Returns the y below the last row. */
export function drawFieldGrid(page: PDFPage, fields: [string, string][], y: number, fonts: Fonts, columns = 2) {
  const columnWidth = (CONTENT_RIGHT - PAGE.margin) / columns;
  fields.forEach(([label, value], index) => {
    const x = PAGE.margin + (index % columns) * columnWidth;
    const rowY = y - Math.floor(index / columns) * FIELD_ROW_HEIGHT;
    drawText(page, label, x, rowY, 8, fonts.regular, COLOR.muted);
    drawText(page, fit(value, fonts.bold, 10.5, columnWidth - 12), x, rowY - 13, 10.5, fonts.bold, COLOR.ink);
  });
  return y - Math.ceil(fields.length / columns) * FIELD_ROW_HEIGHT;
}

/** y of the signature line; the ~45pt above it are reserved for the signature image. */
export const SIGNATURE_Y = 120;

/** Height a closing block (total line + signature) needs above the table bottom. */
export const CLOSING_BLOCK_HEIGHT = 90;

/** Signature line; the space above it is reserved for the signature image. */
export function drawSignature(page: PDFPage, fonts: Fonts, y: number) {
  page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.margin + 220, y }, thickness: 0.75, color: COLOR.ink });
  drawText(page, "Firma y sello autorizados", PAGE.margin, y - 14, 9, fonts.bold, COLOR.ink);
  drawText(page, "Sopdisponal", PAGE.margin, y - 27, 8.5, fonts.regular, COLOR.muted);
}

export function drawFooter(page: PDFPage, fonts: Fonts, left: string, right?: string) {
  drawRule(page, 70);
  drawText(page, left, PAGE.margin, 56, 7.5, fonts.regular, COLOR.muted);
  if (right) drawRight(page, right, CONTENT_RIGHT, 56, 7.5, fonts.regular, COLOR.muted);
}

export function formatLongDate(value: Date | string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date(value));
}

export type TableColumn = {
  label: string;
  /** Left edge for left-aligned columns, right edge for right-aligned ones. */
  x: number;
  width: number;
  align?: "left" | "right";
};

export type TableCell = { text: string; color?: ReturnType<typeof rgb> };

const TABLE_ROW_HEIGHT = 18;
/** Lowest y a table row may use; keeps rows clear of the footer rule at y = 70. */
export const TABLE_BOTTOM = 96;

function drawTableHeader(page: PDFPage, fonts: Fonts, columns: TableColumn[], y: number) {
  page.drawRectangle({ x: PAGE.margin, y: y - 7, width: CONTENT_RIGHT - PAGE.margin, height: 22, color: COLOR.soft });
  for (const column of columns) {
    if (column.align === "right") drawRight(page, column.label, column.x, y, 8, fonts.bold, COLOR.muted);
    else drawText(page, column.label, column.x, y, 8, fonts.bold, COLOR.muted);
  }
  return y - 24;
}

/**
 * Draws a zebra table that continues on new pages as needed, repeating the header
 * under `continuationTitle`. Returns the page and y where drawing can continue.
 */
export function drawPaginatedTable(
  pdf: PDFDocument,
  fonts: Fonts,
  start: { page: PDFPage; y: number },
  columns: TableColumn[],
  rows: TableCell[][],
  continuationTitle: string,
) {
  let { page, y } = start;
  y = drawTableHeader(page, fonts, columns, y);

  rows.forEach((row, rowIndex) => {
    if (y < TABLE_BOTTOM) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin - 10;
      drawText(page, continuationTitle, PAGE.margin, y, 9, fonts.bold, COLOR.ink);
      drawText(page, "Continuación", PAGE.margin, y - 14, 8.5, fonts.regular, COLOR.muted);
      y = drawTableHeader(page, fonts, columns, y - 40);
    }
    if (rowIndex % 2 === 1) {
      page.drawRectangle({ x: PAGE.margin, y: y - 6, width: CONTENT_RIGHT - PAGE.margin, height: TABLE_ROW_HEIGHT, color: COLOR.soft });
    }
    row.forEach((cell, cellIndex) => {
      const column = columns[cellIndex];
      const text = fit(cell.text, fonts.regular, 8.5, column.width);
      if (column.align === "right") drawRight(page, text, column.x, y, 8.5, fonts.regular, cell.color ?? COLOR.ink);
      else drawText(page, text, column.x, y, 8.5, fonts.regular, cell.color ?? COLOR.ink);
    });
    y -= TABLE_ROW_HEIGHT;
  });

  return { page, y };
}

/** Starts a new page when fewer than `height` points remain above the table bottom. */
export function ensureSpace(pdf: PDFDocument, position: { page: PDFPage; y: number }, height: number) {
  if (position.y >= TABLE_BOTTOM + height) return position;
  return { page: pdf.addPage([PAGE.width, PAGE.height]), y: PAGE.height - PAGE.margin - 10 };
}

/** Stamps "Página X de Y" footers once every page exists. */
export function drawPageFooters(pdf: PDFDocument, fonts: Fonts, text: string) {
  const pages = pdf.getPages();
  pages.forEach((page, index) => drawFooter(page, fonts, text, `Página ${index + 1} de ${pages.length}`));
}

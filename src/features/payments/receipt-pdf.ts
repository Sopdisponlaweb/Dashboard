import { formatCurrency, formatDate, formatPeriod, formatReceiptNumber, paymentStatusLabels, sourceLabels } from "@/features/affiliates/format";
import type { AffiliationSource, PaymentStatus } from "@/features/affiliates/types";
import {
  COLOR,
  CONTENT_RIGHT,
  createDocument,
  drawFieldGrid,
  drawFooter,
  drawLetterhead,
  drawRight,
  drawRule,
  drawSectionTitle,
  drawSignature,
  drawText,
  formatLongDate,
  PAGE,
  sentenceCase,
  SIGNATURE_Y,
  wrap,
} from "@/lib/pdf/document-kit";

export type ReceiptData = {
  receiptNumber: number;
  createdAt: string;
  affiliateName: string;
  affiliateDocument: string;
  municipality: string | null;
  source: AffiliationSource;
  periodFrom: string; // YYYY-MM
  periodTo: string; // YYYY-MM
  monthsCount: number;
  monthlyAmount: number;
  totalAmount: number;
  status: PaymentStatus;
  paidOn: string | null;
  paymentMethod: string;
  observations: string | null;
  registeredBy: string | null;
};

export async function renderReceiptPdf(receipt: ReceiptData): Promise<Uint8Array> {
  const receiptLabel = formatReceiptNumber(receipt.receiptNumber);
  const { pdf, fonts } = await createDocument(`Soporte de pago ${receiptLabel}`);
  const page = pdf.addPage([PAGE.width, PAGE.height]);

  let y = drawLetterhead(page, fonts, {
    subtitle: "Soporte de pago de aportes",
    label: "RECIBO N.º",
    value: receiptLabel,
    caption: `Emitido el ${formatLongDate(receipt.createdAt)}`,
  });

  y = drawSectionTitle(page, "Datos del afiliado", y, fonts);
  y = drawFieldGrid(page, [
    ["Nombre", receipt.affiliateName],
    ["Documento", receipt.affiliateDocument],
    ["Tipo de afiliación", sourceLabels[receipt.source]],
    ["Municipio", receipt.municipality ?? "Sin registrar"],
  ], y, fonts);
  y -= 12;

  // Line item.
  y = drawSectionTitle(page, "Detalle del pago", y, fonts);
  const columns = [
    { label: "Concepto", x: PAGE.margin + 8, align: "left" as const },
    { label: "Periodo", x: PAGE.margin + 120, align: "left" as const },
    { label: "Meses", x: PAGE.margin + 345, align: "right" as const },
    { label: "Valor mensual", x: PAGE.margin + 430, align: "right" as const },
    { label: "Subtotal", x: CONTENT_RIGHT - 8, align: "right" as const },
  ];
  page.drawRectangle({ x: PAGE.margin, y: y - 7, width: CONTENT_RIGHT - PAGE.margin, height: 22, color: COLOR.soft });
  for (const column of columns) {
    if (column.align === "left") drawText(page, column.label, column.x, y, 8, fonts.bold, COLOR.muted);
    else drawRight(page, column.label, column.x, y, 8, fonts.bold, COLOR.muted);
  }
  y -= 28;

  const periodLabel = receipt.monthsCount === 1
    ? sentenceCase(formatPeriod(receipt.periodFrom))
    : `${sentenceCase(formatPeriod(receipt.periodFrom))} a ${formatPeriod(receipt.periodTo)}`;
  const periodLines = wrap(periodLabel, fonts.regular, 10, 200);
  drawText(page, "Aporte mensual", columns[0].x, y, 10, fonts.regular, COLOR.ink);
  periodLines.forEach((line, index) => drawText(page, line, columns[1].x, y - index * 13, 10, fonts.regular, COLOR.ink));
  drawRight(page, String(receipt.monthsCount), columns[2].x, y, 10, fonts.regular, COLOR.ink);
  drawRight(page, formatCurrency(receipt.monthlyAmount), columns[3].x, y, 10, fonts.regular, COLOR.ink);
  drawRight(page, formatCurrency(receipt.totalAmount), columns[4].x, y, 10, fonts.regular, COLOR.ink);
  y -= 12 + (periodLines.length - 1) * 13;

  drawRule(page, y);
  y -= 26;
  drawRight(page, "TOTAL PAGADO", columns[3].x, y + 2, 9, fonts.bold, COLOR.muted);
  drawRight(page, formatCurrency(receipt.totalAmount), CONTENT_RIGHT - 8, y, 15, fonts.bold, COLOR.ink);
  y -= 36;

  y = drawSectionTitle(page, "Información del pago", y, fonts);
  y = drawFieldGrid(page, [
    ["Método de pago", receipt.paymentMethod],
    ["Fecha de pago", formatDate(receipt.paidOn)],
    ["Estado", paymentStatusLabels[receipt.status]],
    ["Registrado por", receipt.registeredBy ?? "Sistema"],
  ], y, fonts);

  if (receipt.observations) {
    y -= 4;
    drawText(page, "Observaciones", PAGE.margin, y, 8, fonts.regular, COLOR.muted);
    y -= 13;
    for (const line of wrap(receipt.observations, fonts.regular, 10, CONTENT_RIGHT - PAGE.margin).slice(0, 6)) {
      drawText(page, line, PAGE.margin, y, 10, fonts.regular, COLOR.ink);
      y -= 13;
    }
  }

  drawSignature(page, fonts, SIGNATURE_Y);
  drawFooter(page, fonts, `Documento generado por la plataforma administrativa de Sopdisponal · ${receiptLabel}`);

  return pdf.save();
}

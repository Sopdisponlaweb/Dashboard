import { formatCreditReceiptNumber, formatCurrency, formatDate, formatRate, sourceLabels } from "@/features/affiliates/format";
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
  SIGNATURE_Y,
  wrap,
} from "@/lib/pdf/document-kit";

import type { CreditPdfContext, CreditPdfInstallment } from "./credit-pdf-data";

export type CreditReceiptData = CreditPdfContext & {
  createdAt: string;
  installment: CreditPdfInstallment & { receiptNumber: number };
  registeredBy: string | null;
  balanceBefore: number;
  balanceAfter: number;
};

export async function renderCreditReceiptPdf(data: CreditReceiptData): Promise<Uint8Array> {
  const receiptLabel = formatCreditReceiptNumber(data.installment.receiptNumber);
  const { pdf, fonts } = await createDocument(`Soporte de abono ${receiptLabel}`);
  const page = pdf.addPage([PAGE.width, PAGE.height]);
  const { credit, installment } = data;

  let y = drawLetterhead(page, fonts, {
    subtitle: "Soporte de abono a crédito",
    label: "RECIBO N.º",
    value: receiptLabel,
    caption: `Emitido el ${formatLongDate(data.createdAt)}`,
  });

  y = drawSectionTitle(page, "Datos del afiliado", y, fonts);
  y = drawFieldGrid(page, [
    ["Nombre", data.affiliateName],
    ["Documento", data.affiliateDocument],
    ["Tipo de afiliación", sourceLabels[data.source]],
    ["Municipio", data.municipality ?? "Sin registrar"],
  ], y, fonts);
  y -= 12;

  y = drawSectionTitle(page, "Crédito", y, fonts);
  y = drawFieldGrid(page, [
    ["Fecha de solicitud", formatDate(credit.requestedOn)],
    ["Total del crédito", formatCurrency(credit.totalAmount)],
    ["Plazo y tasa", `${credit.termMonths} meses · ${formatRate(credit.interestRate)}`],
  ], y, fonts, 3);
  y -= 12;

  // Line item: how the abono splits between capital and interest.
  y = drawSectionTitle(page, "Detalle del abono", y, fonts);
  const columns = [
    { label: "Concepto", x: PAGE.margin + 8, right: false },
    { label: "Capital", x: PAGE.margin + 300, right: true },
    { label: "Interés", x: PAGE.margin + 400, right: true },
    { label: "Valor", x: CONTENT_RIGHT - 8, right: true },
  ];
  page.drawRectangle({ x: PAGE.margin, y: y - 7, width: CONTENT_RIGHT - PAGE.margin, height: 22, color: COLOR.soft });
  for (const column of columns) {
    if (column.right) drawRight(page, column.label, column.x, y, 8, fonts.bold, COLOR.muted);
    else drawText(page, column.label, column.x, y, 8, fonts.bold, COLOR.muted);
  }
  y -= 28;
  drawText(page, "Abono a crédito", columns[0].x, y, 10, fonts.regular, COLOR.ink);
  drawRight(page, formatCurrency(installment.capitalPortion), columns[1].x, y, 10, fonts.regular, COLOR.ink);
  drawRight(page, formatCurrency(installment.interestPortion), columns[2].x, y, 10, fonts.regular, COLOR.ink);
  drawRight(page, formatCurrency(installment.amount), columns[3].x, y, 10, fonts.regular, COLOR.ink);
  y -= 12;
  drawRule(page, y);
  y -= 26;
  drawRight(page, "TOTAL ABONADO", columns[2].x, y + 2, 9, fonts.bold, COLOR.muted);
  drawRight(page, formatCurrency(installment.amount), CONTENT_RIGHT - 8, y, 15, fonts.bold, COLOR.ink);
  y -= 36;

  y = drawSectionTitle(page, "Información del pago", y, fonts);
  y = drawFieldGrid(page, [
    ["Método de pago", installment.method ?? "Sin registrar"],
    ["Fecha del abono", formatDate(installment.paidOn)],
    ["Saldo antes del abono", formatCurrency(data.balanceBefore)],
    ["Saldo después del abono", data.balanceAfter <= 0 ? "$ 0 · Crédito pagado" : formatCurrency(data.balanceAfter)],
    ["Registrado por", data.registeredBy ?? "Sistema"],
  ], y, fonts);

  if (installment.observation) {
    y -= 4;
    drawText(page, "Observaciones", PAGE.margin, y, 8, fonts.regular, COLOR.muted);
    y -= 13;
    for (const line of wrap(installment.observation, fonts.regular, 10, CONTENT_RIGHT - PAGE.margin).slice(0, 4)) {
      drawText(page, line, PAGE.margin, y, 10, fonts.regular, COLOR.ink);
      y -= 13;
    }
  }

  drawSignature(page, fonts, SIGNATURE_Y);
  drawFooter(page, fonts, `Documento generado por la plataforma administrativa de Sopdisponal · ${receiptLabel}`);

  return pdf.save();
}

import { formatClearanceNumber, formatCreditReceiptNumber, formatCurrency, formatDate, formatRate, sourceLabels } from "@/features/affiliates/format";
import {
  CLOSING_BLOCK_HEIGHT,
  COLOR,
  CONTENT_RIGHT,
  createDocument,
  drawFieldGrid,
  drawLetterhead,
  drawPageFooters,
  drawPaginatedTable,
  drawSectionTitle,
  drawSignature,
  drawText,
  ensureSpace,
  formatLongDate,
  PAGE,
  SIGNATURE_Y,
  wrap,
  type TableColumn,
} from "@/lib/pdf/document-kit";

import { byPaymentOrder, type CreditPdfContext, type CreditPdfInstallment } from "./credit-pdf-data";

export type CreditClearancePdfData = CreditPdfContext & {
  clearance: {
    number: number;
    settlement: "paid" | "forgiven";
    settledOn: string;
    issuedOn: string;
    totalPaid: number;
  };
  installments: CreditPdfInstallment[];
};

const columns: TableColumn[] = [
  { label: "Recibo", x: PAGE.margin + 6, width: 70 },
  { label: "Fecha", x: PAGE.margin + 82, width: 90 },
  { label: "Método", x: PAGE.margin + 178, width: 120 },
  { label: "Capital", x: CONTENT_RIGHT - 170, width: 70, align: "right" },
  { label: "Interés", x: CONTENT_RIGHT - 88, width: 70, align: "right" },
  { label: "Valor", x: CONTENT_RIGHT - 6, width: 76, align: "right" },
];

const shortDate = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export async function renderCreditClearancePdf(data: CreditClearancePdfData): Promise<Uint8Array> {
  const { clearance, credit } = data;
  const number = formatClearanceNumber(clearance.number);
  const title = `Paz y salvo ${number} · ${data.affiliateName}`;
  const { pdf, fonts } = await createDocument(title);
  const issuedOn = formatLongDate(`${clearance.issuedOn}T12:00:00Z`);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = drawLetterhead(page, fonts, {
    subtitle: "Paz y salvo de crédito",
    label: "PAZ Y SALVO No.",
    value: number,
    caption: `Emitido el ${issuedOn}`,
  });

  const settledText = clearance.settlement === "paid"
    ? `el cual fue cancelado en su totalidad; el último abono se registró el ${formatDate(clearance.settledOn)}`
    : `cuyo saldo pendiente fue condonado por Sopdisponal, con lo cual la obligación quedó extinguida`;
  const statement =
    `Sopdisponal certifica que ${data.affiliateName} (${data.affiliateDocument}) se encuentra a PAZ Y SALVO ` +
    `por concepto del crédito solicitado el ${formatDate(credit.requestedOn)} por un total de ${formatCurrency(credit.totalAmount)}, ` +
    `${settledText}. A la fecha no registra saldo pendiente por esta obligación.`;
  for (const line of wrap(statement, fonts.regular, 10.5, CONTENT_RIGHT - PAGE.margin)) {
    drawText(page, line, PAGE.margin, y, 10.5, fonts.regular, COLOR.ink);
    y -= 15;
  }
  y -= 14;

  y = drawSectionTitle(page, "Titular", y, fonts);
  y = drawFieldGrid(page, [
    ["Nombre", data.affiliateName],
    ["Documento", data.affiliateDocument],
    ["Tipo de afiliación", sourceLabels[data.source]],
    ["Municipio", data.municipality ?? "Sin registrar"],
  ], y, fonts, 2);
  y -= 12;

  y = drawSectionTitle(page, "Crédito", y, fonts);
  y = drawFieldGrid(page, [
    ["Fecha de solicitud", formatDate(credit.requestedOn)],
    ["Plazo y tasa", `${credit.termMonths} meses · ${formatRate(credit.interestRate)}`],
    ["Base del crédito", formatCurrency(credit.principalBase)],
    ["Interés", formatCurrency(credit.interestAmount)],
    ["Total a pagar", formatCurrency(credit.totalAmount)],
    ["Total abonado", formatCurrency(clearance.totalPaid)],
    [clearance.settlement === "paid" ? "Fecha de pago total" : "Saldo condonado",
      clearance.settlement === "paid" ? formatDate(clearance.settledOn) : formatCurrency(Math.max(0, credit.totalAmount - clearance.totalPaid))],
    ["Saldo pendiente", formatCurrency(0)],
  ], y, fonts, 2);
  y -= 12;

  const installments = [...data.installments].sort(byPaymentOrder);
  y = drawSectionTitle(page, `Abonos registrados (${installments.length})`, y, fonts);
  let position = { page, y };
  if (!installments.length) {
    drawText(page, "El crédito no tiene abonos registrados.", PAGE.margin, y, 10, fonts.regular, COLOR.muted);
    position = { page, y: y - 30 };
  } else {
    position = drawPaginatedTable(
      pdf,
      fonts,
      position,
      columns,
      installments.map((installment) => [
        { text: installment.receiptNumber ? formatCreditReceiptNumber(installment.receiptNumber) : "—" },
        { text: shortDate.format(new Date(`${installment.paidOn}T00:00:00Z`)) },
        { text: installment.method ?? "—" },
        { text: formatCurrency(installment.capitalPortion) },
        { text: formatCurrency(installment.interestPortion) },
        { text: formatCurrency(installment.amount) },
      ]),
      title,
    );
  }

  ({ page, y } = ensureSpace(pdf, position, CLOSING_BLOCK_HEIGHT + 30));
  const closing = `Se expide a solicitud del interesado el ${issuedOn}.`;
  drawText(page, closing, PAGE.margin, Math.min(y - 8, SIGNATURE_Y + 60), 9.5, fonts.regular, COLOR.muted);
  drawSignature(page, fonts, SIGNATURE_Y);
  drawPageFooters(pdf, fonts, `Paz y salvo ${number} generado por la plataforma administrativa de Sopdisponal`);

  return pdf.save();
}

import {
  creditStatusLabels,
  formatCreditReceiptNumber,
  formatCurrency,
  formatDate,
  formatRate,
  sourceLabels,
} from "@/features/affiliates/format";
import {
  COLOR,
  CLOSING_BLOCK_HEIGHT,
  CONTENT_RIGHT,
  createDocument,
  drawFieldGrid,
  drawLetterhead,
  drawPageFooters,
  drawPaginatedTable,
  drawRight,
  drawRule,
  drawSectionTitle,
  drawSignature,
  drawText,
  ensureSpace,
  formatLongDate,
  PAGE,
  SIGNATURE_Y,
  type TableColumn,
} from "@/lib/pdf/document-kit";

import { remainingBalance } from "./calculations";
import { byPaymentOrder, type CreditPdfContext, type CreditPdfInstallment } from "./credit-pdf-data";

export type CreditStatementData = CreditPdfContext & {
  generatedAt: Date;
  installments: CreditPdfInstallment[];
};

const columns: TableColumn[] = [
  { label: "Fecha", x: PAGE.margin + 6, width: 74 },
  { label: "Recibo", x: PAGE.margin + 84, width: 58 },
  { label: "Método", x: PAGE.margin + 146, width: 92 },
  { label: "Valor", x: PAGE.margin + 306, width: 62, align: "right" },
  { label: "Capital", x: PAGE.margin + 374, width: 62, align: "right" },
  { label: "Interés", x: PAGE.margin + 438, width: 58, align: "right" },
  { label: "Saldo", x: CONTENT_RIGHT - 6, width: 64, align: "right" },
];

export async function renderCreditStatementPdf(data: CreditStatementData): Promise<Uint8Array> {
  const { pdf, fonts } = await createDocument(`Estado de cuenta de crédito · ${data.affiliateName}`);
  const { credit } = data;
  const cutOff = formatLongDate(data.generatedAt);
  const installments = [...data.installments].sort(byPaymentOrder);
  const balance = remainingBalance(credit, installments);
  const totalPaid = balance.paidCapital + balance.paidInterest;
  const pendingInstallments = credit.status === "active" && credit.installmentAmount > 0
    ? Math.ceil(balance.remainingTotal / credit.installmentAmount - 0.001)
    : 0;

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = drawLetterhead(page, fonts, {
    subtitle: "Estado de cuenta de crédito",
    label: "FECHA DE CORTE",
    value: new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Bogota" }).format(data.generatedAt),
    caption: `Generado el ${cutOff}`,
  });

  y = drawSectionTitle(page, "Datos del afiliado", y, fonts);
  y = drawFieldGrid(page, [
    ["Nombre", data.affiliateName],
    ["Documento", data.affiliateDocument],
    ["Tipo de afiliación", sourceLabels[data.source]],
    ["Municipio", data.municipality ?? "Sin registrar"],
  ], y, fonts);
  y -= 12;

  const refinanced = credit.rolledOverCapital + credit.rolledOverInterest;
  y = drawSectionTitle(page, "Condiciones del crédito", y, fonts);
  y = drawFieldGrid(page, [
    ["Fecha de solicitud", formatDate(credit.requestedOn)],
    ["Estado", creditStatusLabels[credit.status]],
    ["Plazo", `${credit.termMonths} meses`],
    ["Monto desembolsado", formatCurrency(credit.disbursedAmount)],
    ["Saldo refinanciado", refinanced > 0 ? formatCurrency(refinanced) : "No aplica"],
    ["Base del crédito", formatCurrency(credit.principalBase)],
    ["Tasa de interés", formatRate(credit.interestRate)],
    ["Interés total", formatCurrency(credit.interestAmount)],
    ["Cuota mensual", formatCurrency(credit.installmentAmount)],
  ], y, fonts, 3);
  y -= 12;

  y = drawSectionTitle(page, "Resumen al corte", y, fonts);
  y = drawFieldGrid(page, [
    ["Total a pagar", formatCurrency(credit.totalAmount)],
    ["Total abonado", formatCurrency(totalPaid)],
    ["Saldo pendiente", formatCurrency(balance.remainingTotal)],
    ["Capital pagado / pendiente", `${formatCurrency(balance.paidCapital)} / ${formatCurrency(balance.remainingCapital)}`],
    ["Interés pagado / pendiente", `${formatCurrency(balance.paidInterest)} / ${formatCurrency(balance.remainingInterest)}`],
    ["Cuotas pendientes (aprox.)", credit.status === "active" ? String(pendingInstallments) : "No aplica"],
  ], y, fonts, 3);
  y -= 12;

  y = drawSectionTitle(page, `Detalle de abonos (${installments.length})`, y, fonts);

  let position = { page, y };
  if (!installments.length) {
    drawText(page, "Aún no hay abonos registrados para este crédito.", PAGE.margin, y, 10, fonts.regular, COLOR.muted);
    position = { page, y: y - 30 };
  } else {
    let running = credit.totalAmount;
    const rows = installments.map((installment) => {
      running = Math.max(Math.round((running - installment.amount) * 100) / 100, 0);
      return [
        { text: formatDate(installment.paidOn) },
        { text: installment.receiptNumber ? formatCreditReceiptNumber(installment.receiptNumber) : "—" },
        { text: installment.method ?? "—" },
        { text: formatCurrency(installment.amount) },
        { text: formatCurrency(installment.capitalPortion), color: COLOR.text },
        { text: formatCurrency(installment.interestPortion), color: COLOR.text },
        { text: formatCurrency(running) },
      ];
    });
    position = drawPaginatedTable(pdf, fonts, position, columns, rows, `Estado de cuenta de crédito · ${data.affiliateName} · ${data.affiliateDocument}`);
  }

  // Closing balance and signature stay together on the last page.
  ({ page, y } = ensureSpace(pdf, position, CLOSING_BLOCK_HEIGHT));
  drawRule(page, y + 8);
  y -= 14;
  drawRight(page, "SALDO PENDIENTE", CONTENT_RIGHT - 130, y + 2, 9, fonts.bold, COLOR.muted);
  drawRight(page, formatCurrency(balance.remainingTotal), CONTENT_RIGHT - 6, y, 14, fonts.bold, COLOR.ink);
  drawText(page, `Total del crédito ${formatCurrency(credit.totalAmount)} menos ${formatCurrency(totalPaid)} abonados.`, PAGE.margin, y + 2, 8, fonts.regular, COLOR.muted);

  drawSignature(page, fonts, SIGNATURE_Y);
  drawPageFooters(pdf, fonts, `Estado de cuenta de crédito generado por la plataforma administrativa de Sopdisponal el ${cutOff}`);

  return pdf.save();
}

import {
  formatCurrency,
  formatDate,
  formatPeriod,
  formatReceiptNumber,
  paymentStatusLabels,
  sourceLabels,
  statusLabels,
} from "@/features/affiliates/format";
import type { AffiliateStatus, AffiliationSource, PaymentStatus } from "@/features/affiliates/types";
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
  sentenceCase,
  SIGNATURE_Y,
  type TableColumn,
} from "@/lib/pdf/document-kit";

export type StatementPayment = {
  period: string; // YYYY-MM
  source: AffiliationSource;
  method: string | null;
  status: PaymentStatus;
  paidOn: string | null;
  amount: number;
  receiptNumber: number | null;
};

export type AccountStatementData = {
  generatedAt: Date;
  affiliateName: string;
  affiliateDocument: string;
  source: AffiliationSource;
  status: AffiliateStatus;
  joinedOn: string;
  municipality: string | null;
  rangeFrom: string | null; // YYYY-MM, null = from the first payment
  rangeTo: string | null; // YYYY-MM, null = up to the last payment
  /** Movements inside the range, oldest first. */
  payments: StatementPayment[];
  /** Last paid month over the whole history, regardless of the range. */
  lastPaidPeriod: string | null;
  /** Months in arrears at the cut-off date, as the status rule counts them; null if not applicable. */
  monthsInArrears: number | null;
};

const columns: TableColumn[] = [
  { label: "Periodo", x: PAGE.margin + 6, width: 92 },
  { label: "Fuente", x: PAGE.margin + 102, width: 62 },
  { label: "Método", x: PAGE.margin + 168, width: 92 },
  { label: "Estado", x: PAGE.margin + 264, width: 58 },
  { label: "Fecha de pago", x: PAGE.margin + 326, width: 74 },
  { label: "Recibo", x: PAGE.margin + 404, width: 54 },
  { label: "Valor", x: CONTENT_RIGHT - 6, width: 60, align: "right" },
];

const shortMonths = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2008-01" -> "ene 2008"; short enough for a summary cell. */
function shortPeriod(period: string) {
  const [year, month] = period.split("-");
  return `${shortMonths[Number(month) - 1]} ${year}`;
}

function rangeLabel(data: AccountStatementData) {
  if (!data.rangeFrom && !data.rangeTo) return "Todo el historial";
  const from = data.rangeFrom ? shortPeriod(data.rangeFrom) : "inicio";
  const to = data.rangeTo ? shortPeriod(data.rangeTo) : "hoy";
  return sentenceCase(`${from} – ${to}`);
}

function arrearsLabel(data: AccountStatementData) {
  if (data.status === "deceased" || data.monthsInArrears === null) return "No aplica";
  if (data.monthsInArrears === 0) return "Al día";
  return `${data.monthsInArrears} ${data.monthsInArrears === 1 ? "mes" : "meses"}`;
}

export async function renderAccountStatementPdf(data: AccountStatementData): Promise<Uint8Array> {
  const { pdf, fonts } = await createDocument(`Estado de cuenta · ${data.affiliateName}`);
  const cutOff = formatLongDate(data.generatedAt);

  const paid = data.payments.filter((payment) => payment.status === "paid");
  const totalPaid = paid.reduce((sum, payment) => sum + payment.amount, 0);
  const monthsPaid = new Set(paid.map((payment) => payment.period)).size;
  const pendingCount = data.payments.filter((payment) => payment.status === "pending").length;
  const reversedCount = data.payments.filter((payment) => payment.status === "reversed").length;

  // First page: letterhead, affiliate and summary.
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = drawLetterhead(page, fonts, {
    subtitle: "Estado de cuenta de aportes",
    label: "FECHA DE CORTE",
    value: new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Bogota" }).format(data.generatedAt),
    caption: `Generado el ${cutOff}`,
  });

  y = drawSectionTitle(page, "Datos del afiliado", y, fonts);
  y = drawFieldGrid(page, [
    ["Nombre", data.affiliateName],
    ["Documento", data.affiliateDocument],
    ["Tipo de afiliación", sourceLabels[data.source]],
    ["Estado actual", statusLabels[data.status]],
    ["Fecha de afiliación", formatDate(data.joinedOn)],
    ["Municipio", data.municipality ?? "Sin registrar"],
  ], y, fonts);
  y -= 12;

  y = drawSectionTitle(page, "Resumen", y, fonts);
  y = drawFieldGrid(page, [
    ["Periodo consultado", rangeLabel(data)],
    ["Total pagado en el periodo", formatCurrency(totalPaid)],
    ["Meses pagados en el periodo", String(monthsPaid)],
    ["Último mes pagado", data.lastPaidPeriod ? sentenceCase(formatPeriod(data.lastPaidPeriod)) : "Sin pagos registrados"],
    ["Meses en mora al corte", arrearsLabel(data)],
    ["Movimientos pendientes / reversados", `${pendingCount} / ${reversedCount}`],
  ], y, fonts, 3);
  y -= 12;

  y = drawSectionTitle(page, "Detalle de movimientos", y, fonts);

  let position = { page, y };
  if (!data.payments.length) {
    drawText(page, "No hay pagos registrados en el periodo consultado.", PAGE.margin, y, 10, fonts.regular, COLOR.muted);
    position = { page, y: y - 30 };
  } else {
    const rows = data.payments.map((payment) => {
      const statusColor = payment.status === "reversed" ? COLOR.danger : payment.status === "pending" ? COLOR.muted : undefined;
      return [
        { text: sentenceCase(formatPeriod(payment.period)) },
        { text: sourceLabels[payment.source] },
        { text: payment.method ?? "—" },
        { text: paymentStatusLabels[payment.status], color: statusColor },
        { text: formatDate(payment.paidOn) },
        { text: payment.receiptNumber ? formatReceiptNumber(payment.receiptNumber) : "—" },
        { text: formatCurrency(payment.amount), color: statusColor },
      ];
    });
    position = drawPaginatedTable(pdf, fonts, position, columns, rows, `Estado de cuenta · ${data.affiliateName} · ${data.affiliateDocument}`);
  }

  // Totals and signature stay together on the last page.
  ({ page, y } = ensureSpace(pdf, position, CLOSING_BLOCK_HEIGHT));
  drawRule(page, y + 8);
  y -= 14;
  drawRight(page, "TOTAL PAGADO", CONTENT_RIGHT - 116, y + 2, 9, fonts.bold, COLOR.muted);
  drawRight(page, formatCurrency(totalPaid), CONTENT_RIGHT - 6, y, 14, fonts.bold, COLOR.ink);
  drawText(page, "Solo suma movimientos en estado Pagado.", PAGE.margin, y + 2, 8, fonts.regular, COLOR.muted);

  drawSignature(page, fonts, SIGNATURE_Y);
  drawPageFooters(pdf, fonts, `Estado de cuenta generado por la plataforma administrativa de Sopdisponal el ${cutOff}`);

  return pdf.save();
}

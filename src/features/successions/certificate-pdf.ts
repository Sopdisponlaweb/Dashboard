import { formatCurrency, formatDate, formatPeriod, sourceLabels } from "@/features/affiliates/format";
import type { AffiliationSource } from "@/features/affiliates/types";
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
  sentenceCase,
  SIGNATURE_Y,
  wrap,
  type TableColumn,
} from "@/lib/pdf/document-kit";

import { creditDecisionLabels, successorOriginLabels, type Succession } from "./types";

export type SuccessionCertificateData = {
  succession: Succession;
  deceased: {
    name: string;
    document: string;
    source: AffiliationSource;
    joinedOn: string;
    deceasedOn: string | null;
    lastPaymentOn: string | null;
    paymentsCount: number;
    totalPaid: number;
  };
  successorSource: AffiliationSource | null;
  beneficiaries: { name: string; relationship: string; document: string; joinedOn: string }[];
  credit: { totalAmount: number; remainingTotal: number } | null;
};

const columns: TableColumn[] = [
  { label: "Beneficiario", x: PAGE.margin + 6, width: 200 },
  { label: "Parentesco", x: PAGE.margin + 214, width: 100 },
  { label: "Documento", x: PAGE.margin + 318, width: 100 },
  { label: "Vinculado desde", x: CONTENT_RIGHT - 6, width: 80, align: "right" },
];

export async function renderSuccessionCertificatePdf(data: SuccessionCertificateData): Promise<Uint8Array> {
  const { succession, deceased } = data;
  const { pdf, fonts } = await createDocument(`Constancia de sucesión · ${deceased.name}`);
  const issuedOn = formatLongDate(new Date());

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = drawLetterhead(page, fonts, {
    subtitle: "Constancia de sucesión",
    label: "FECHA DE SUCESIÓN",
    value: new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${succession.successionDate}T00:00:00Z`)),
    caption: `Emitida el ${issuedOn}`,
  });

  const statement =
    `Sopdisponal hace constar que, con ocasión del fallecimiento de ${deceased.name} (${deceased.document}), ` +
    `${succession.successorName} (${succession.successorDocument}) asume la titularidad de su afiliación a partir del ` +
    `${formatDate(succession.successionDate)}${succession.resolutionNumber ? `, según resolución o acta ${succession.resolutionNumber}` : ""}. ` +
    "Los pagos del fallecido quedan a su nombre y el sucesor puede consultarlos.";
  for (const line of wrap(statement, fonts.regular, 10, CONTENT_RIGHT - PAGE.margin)) {
    drawText(page, line, PAGE.margin, y, 10, fonts.regular, COLOR.ink);
    y -= 14;
  }
  y -= 14;

  y = drawSectionTitle(page, "Titular fallecido", y, fonts);
  y = drawFieldGrid(page, [
    ["Nombre", deceased.name],
    ["Documento", deceased.document],
    ["Tipo de afiliación", sourceLabels[deceased.source]],
    ["Fecha de afiliación", formatDate(deceased.joinedOn)],
    ["Fecha de fallecimiento", formatDate(deceased.deceasedOn)],
    ["Último mes pagado", deceased.lastPaymentOn ? sentenceCase(formatPeriod(deceased.lastPaymentOn.slice(0, 7))) : "Sin pagos"],
  ], y, fonts, 2);
  y -= 12;

  y = drawSectionTitle(page, "Titular sucesor", y, fonts);
  y = drawFieldGrid(page, [
    ["Nombre", succession.successorName],
    ["Documento", succession.successorDocument],
    ["Origen", successorOriginLabels[succession.origin]],
    ["Tipo de afiliación", data.successorSource ? sourceLabels[data.successorSource] : "—"],
    ["Fecha de sucesión", formatDate(succession.successionDate)],
    ["Resolución o acta", succession.resolutionNumber ?? "Sin registrar"],
  ], y, fonts, 2);
  y -= 12;

  y = drawSectionTitle(page, "Pagos y crédito", y, fonts);
  y = drawFieldGrid(page, [
    ["Historial de pagos del fallecido", `${deceased.paymentsCount.toLocaleString("es-CO")} movimientos · ${formatCurrency(deceased.totalPaid)}`],
    ["Crédito", data.credit ? `${creditDecisionLabels[succession.creditDecision]} · saldo ${formatCurrency(data.credit.remainingTotal)}` : creditDecisionLabels[succession.creditDecision]],
  ], y, fonts, 2);
  y -= 12;

  y = drawSectionTitle(page, `Beneficiarios transferidos (${data.beneficiaries.length})`, y, fonts);
  let position = { page, y };
  if (!data.beneficiaries.length) {
    drawText(page, "No se transfirieron beneficiarios.", PAGE.margin, y, 10, fonts.regular, COLOR.muted);
    position = { page, y: y - 30 };
  } else {
    position = drawPaginatedTable(
      pdf,
      fonts,
      position,
      columns,
      data.beneficiaries.map((beneficiary) => [
        { text: beneficiary.name },
        { text: beneficiary.relationship },
        { text: beneficiary.document },
        { text: formatDate(beneficiary.joinedOn) },
      ]),
      `Constancia de sucesión · ${deceased.name}`,
    );
  }

  const notesLines = succession.notes ? wrap(succession.notes, fonts.regular, 9.5, CONTENT_RIGHT - PAGE.margin).slice(0, 3) : [];
  ({ page, y } = ensureSpace(pdf, position, CLOSING_BLOCK_HEIGHT + (notesLines.length ? 25 + notesLines.length * 12 : 0)));
  if (notesLines.length) {
    y -= 6;
    drawText(page, "Observaciones", PAGE.margin, y, 8, fonts.regular, COLOR.muted);
    y -= 13;
    for (const line of notesLines) {
      drawText(page, line, PAGE.margin, y, 9.5, fonts.regular, COLOR.ink);
      y -= 12;
    }
  }

  drawSignature(page, fonts, SIGNATURE_Y);
  drawPageFooters(pdf, fonts, `Constancia de sucesión generada por la plataforma administrativa de Sopdisponal el ${issuedOn}`);

  return pdf.save();
}

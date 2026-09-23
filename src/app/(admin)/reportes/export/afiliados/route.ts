import { formatDate, sourceLabels, statusLabels } from "@/features/affiliates/format";
import { listAffiliates } from "@/features/affiliates/repository";
import { csvResponse, toCsv } from "@/features/reports/csv";

export async function GET() {
  const affiliates = await listAffiliates();
  const headers = ["Documento", "Nombres", "Apellidos", "Tipo de afiliación", "Estado", "Municipio", "Fecha de afiliación", "Cobertura total", "Último pago", "Beneficiarios vigentes"];
  const rows = affiliates.map((affiliate) => [
    `${affiliate.documentType} ${affiliate.documentNumber}`,
    affiliate.firstNames,
    affiliate.lastNames,
    sourceLabels[affiliate.source],
    statusLabels[affiliate.status],
    affiliate.municipality,
    formatDate(affiliate.joinedOn),
    formatDate(affiliate.fullCoverageOn),
    formatDate(affiliate.lastPaymentOn),
    affiliate.beneficiaries.filter((beneficiary) => beneficiary.status !== "deceased").length,
  ]);

  return csvResponse("afiliados.csv", toCsv(headers, rows));
}

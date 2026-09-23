import { formatDate, statusLabels } from "@/features/affiliates/format";
import { listBeneficiaries } from "@/features/affiliates/repository";
import { csvResponse, toCsv } from "@/features/reports/csv";

export async function GET() {
  const beneficiaries = await listBeneficiaries();
  const headers = ["Beneficiario", "Documento", "Parentesco", "Titular", "Documento del titular", "Estado", "Fecha de vinculación", "Cobertura total"];
  const rows = beneficiaries.map((beneficiary) => [
    `${beneficiary.firstNames} ${beneficiary.lastNames}`,
    beneficiary.documentNumber ?? "",
    beneficiary.relationship,
    beneficiary.affiliateName,
    beneficiary.affiliateDocument,
    statusLabels[beneficiary.status],
    formatDate(beneficiary.joinedOn),
    formatDate(beneficiary.fullCoverageOn),
  ]);

  return csvResponse("beneficiarios.csv", toCsv(headers, rows));
}

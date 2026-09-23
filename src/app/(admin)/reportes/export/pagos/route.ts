import { formatCurrency, formatDate, formatPeriod, paymentStatusLabels, sourceLabels } from "@/features/affiliates/format";
import { listPayments } from "@/features/affiliates/repository";
import { csvResponse, toCsv } from "@/features/reports/csv";

export async function GET() {
  const payments = await listPayments();
  const headers = ["Titular", "Documento", "Periodo", "Fuente", "Valor", "Estado", "Fecha de pago", "Observación"];
  const rows = payments.map((payment) => [
    payment.affiliateName,
    payment.affiliateDocument,
    formatPeriod(payment.period),
    sourceLabels[payment.source],
    formatCurrency(payment.amount),
    paymentStatusLabels[payment.status],
    formatDate(payment.paidOn),
    payment.observation ?? "",
  ]);

  return csvResponse("pagos.csv", toCsv(headers, rows));
}

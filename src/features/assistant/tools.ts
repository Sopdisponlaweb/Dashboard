import { formatCurrency, formatDate, sourceLabels, statusLabels } from "@/features/affiliates/format";
import { getAffiliateById, getDashboardSummary, getPaymentTotals, searchAffiliates } from "@/features/affiliates/repository";

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
};

export const assistantTools: ToolDefinition[] = [
  {
    name: "search_affiliates",
    description: "Busca titulares (afiliados) por nombre, apellido o número de documento. Devuelve hasta 5 coincidencias con datos resumidos, incluido el id necesario para pedir el detalle completo.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Nombre, apellido o número de documento a buscar." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_affiliate_detail",
    description: "Obtiene el detalle completo de un titular específico por su id: datos personales, beneficiarios vigentes, pagos recientes y documentos. Usa primero search_affiliates para encontrar el id.",
    parameters: {
      type: "object",
      properties: {
        affiliateId: { type: "string", description: "Id del afiliado (uuid)." },
      },
      required: ["affiliateId"],
    },
  },
  {
    name: "get_dashboard_summary",
    description: "Obtiene indicadores generales de la operación: totales de titulares activos, en carencia, suspendidos (3 a 5 meses de mora) y retirados (6 meses o más); beneficiarios; recaudo mensual reciente; distribución por tipo de afiliación; alertas de mora. Los conteos usan claves internas: inactive = Suspendido, suspended = Retirado.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_payment_totals",
    description: "Obtiene los totales generales de pagos registrados en el sistema: monto pagado, pendiente, revertido y número total de pagos.",
    parameters: { type: "object", properties: {} },
  },
];

function summarizeAffiliate(affiliate: Awaited<ReturnType<typeof searchAffiliates>>[number]) {
  return {
    id: affiliate.id,
    nombre: `${affiliate.firstNames} ${affiliate.lastNames}`,
    documento: `${affiliate.documentType} ${affiliate.documentNumber}`,
    estado: statusLabels[affiliate.status],
    tipoAfiliacion: sourceLabels[affiliate.source],
    municipio: affiliate.municipality,
    ultimoPago: formatDate(affiliate.lastPaymentOn),
  };
}

export async function runAssistantTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search_affiliates": {
      const query = String(input.query ?? "").trim();
      if (!query) return { error: "Escribe un nombre o número de documento para buscar." };

      const results = await searchAffiliates(query);
      if (!results.length) return { resultados: [], mensaje: "No se encontraron afiliados que coincidan." };
      return { resultados: results.slice(0, 5).map(summarizeAffiliate), totalCoincidencias: results.length };
    }

    case "get_affiliate_detail": {
      const affiliateId = String(input.affiliateId ?? "").trim();
      if (!affiliateId) return { error: "Falta el id del afiliado." };

      const affiliate = await getAffiliateById(affiliateId);
      if (!affiliate) return { error: "No se encontró un afiliado con ese id." };

      const recentPayments = [...affiliate.payments]
        .sort((a, b) => (a.period < b.period ? 1 : -1))
        .slice(0, 6)
        .map((payment) => ({
          periodo: payment.period,
          valor: formatCurrency(payment.amount),
          estado: payment.status,
          fuente: sourceLabels[payment.source],
        }));

      return {
        id: affiliate.id,
        nombre: `${affiliate.firstNames} ${affiliate.lastNames}`,
        documento: `${affiliate.documentType} ${affiliate.documentNumber}`,
        estado: statusLabels[affiliate.status],
        tipoAfiliacion: sourceLabels[affiliate.source],
        municipio: affiliate.municipality,
        fechaAfiliacion: formatDate(affiliate.joinedOn),
        coberturaCompletaDesde: formatDate(affiliate.fullCoverageOn),
        ultimoPago: formatDate(affiliate.lastPaymentOn),
        beneficiariosVigentes: affiliate.beneficiaries
          .filter((beneficiary) => beneficiary.status !== "deceased")
          .map((beneficiary) => ({
            nombre: `${beneficiary.firstNames} ${beneficiary.lastNames}`,
            parentesco: beneficiary.relationship,
            estado: statusLabels[beneficiary.status],
          })),
        pagosRecientes: recentPayments,
        documentos: affiliate.documents.map((document) => document.title),
      };
    }

    case "get_dashboard_summary":
      // Counts are keyed by internal status; tell the model the names users see.
      return { ...(await getDashboardSummary()), nombresDeEstado: statusLabels };

    case "get_payment_totals":
      return getPaymentTotals();

    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { formatCurrency, formatDate, membershipStatusLabels, sourceLabel, statusLabel } from "./lib/format.js";
import { getAuthenticatedClient } from "./lib/supabase.js";

const affiliateSummarySelect =
  "id, document_type, document_number, first_names, last_names, status, source, last_payment_on, municipality:municipalities!municipality_id(name, department)";

function summarizeAffiliateRow(row: Record<string, unknown>) {
  const municipality = row.municipality as { name: string; department: string } | null;
  return {
    id: row.id,
    nombre: `${row.first_names} ${row.last_names}`,
    documento: `${row.document_type} ${row.document_number}`,
    estado: statusLabel(row.status),
    tipoAfiliacion: sourceLabel(row.source),
    municipio: municipality ? `${municipality.name}, ${municipality.department}` : "Sin registrar",
    ultimoPago: formatDate(row.last_payment_on as string | null),
  };
}

export function registerReadTools(server: McpServer) {
  server.registerTool(
    "search_affiliates",
    {
      title: "Buscar afiliados",
      description:
        "Busca titulares (afiliados) de Sopdisponal por nombre, apellido o número de documento. Devuelve hasta 8 coincidencias con datos resumidos, incluido el id (uuid) necesario para pedir el detalle completo o proponer un cambio. Solo lectura.",
      inputSchema: { query: z.string().min(2).max(120).describe("Nombre, apellido o número de documento a buscar.") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      const { supabase } = await getAuthenticatedClient();
      const trimmed = query.trim();
      const { data, error } = await supabase
        .from("affiliates")
        .select(affiliateSummarySelect)
        .or(`first_names.ilike.%${trimmed}%,last_names.ilike.%${trimmed}%,document_number.ilike.%${trimmed}%`)
        .limit(8);

      if (error) return { content: [{ type: "text", text: `Error al buscar afiliados: ${error.message}` }] };
      if (!data?.length) return { content: [{ type: "text", text: `No se encontraron afiliados que coincidan con "${trimmed}".` }] };

      const resultados = data.map(summarizeAffiliateRow);
      return { content: [{ type: "text", text: JSON.stringify({ resultados, total: resultados.length }, null, 2) }] };
    },
  );

  server.registerTool(
    "get_affiliate_detail",
    {
      title: "Detalle de un afiliado",
      description:
        "Obtiene el detalle completo de un titular por su id: datos personales, beneficiarios vigentes, pagos recientes, créditos y documentos. Usa primero search_affiliates para encontrar el id. Solo lectura.",
      inputSchema: { affiliateId: z.string().uuid().describe("Id (uuid) del afiliado.") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ affiliateId }) => {
      const { supabase } = await getAuthenticatedClient();
      const { data: affiliate, error } = await supabase
        .from("affiliates")
        .select(`
          id, document_type, document_number, first_names, last_names, status, source, joined_on, full_coverage_on, last_payment_on,
          municipality:municipalities!municipality_id(name, department),
          organization:organizations(name),
          beneficiaries!beneficiaries_affiliate_id_fkey(id, first_names, last_names, relationship, status),
          payments(period_start, paid_on, amount, source, status, observations),
          credits!credits_affiliate_id_fkey(id, status, principal_base, total_amount, installment_amount, requested_on),
          member_documents(title)
        `)
        .eq("id", affiliateId)
        .maybeSingle();

      if (error) return { content: [{ type: "text", text: `Error al consultar el afiliado: ${error.message}` }] };
      if (!affiliate) return { content: [{ type: "text", text: "No se encontró un afiliado con ese id." }] };

      const municipality = affiliate.municipality as unknown as { name: string; department: string } | null;
      const organization = affiliate.organization as unknown as { name: string } | null;
      const payments = ((affiliate.payments as Record<string, unknown>[]) ?? [])
        .sort((a, b) => String(b.period_start).localeCompare(String(a.period_start)))
        .slice(0, 6)
        .map((payment) => ({
          periodo: String(payment.period_start).slice(0, 7),
          valor: formatCurrency(payment.amount as number),
          estado: payment.status,
          fuente: sourceLabel(payment.source),
        }));

      const output = {
        id: affiliate.id,
        nombre: `${affiliate.first_names} ${affiliate.last_names}`,
        documento: `${affiliate.document_type} ${affiliate.document_number}`,
        estado: statusLabel(affiliate.status),
        tipoAfiliacion: sourceLabel(affiliate.source),
        entidad: organization?.name ?? "Particular",
        municipio: municipality ? `${municipality.name}, ${municipality.department}` : "Sin registrar",
        fechaAfiliacion: formatDate(affiliate.joined_on as string),
        coberturaCompletaDesde: formatDate(affiliate.full_coverage_on as string),
        ultimoPago: formatDate(affiliate.last_payment_on as string | null),
        beneficiariosVigentes: ((affiliate.beneficiaries as Record<string, unknown>[]) ?? [])
          .filter((b) => b.status !== "deceased")
          .map((b) => ({ nombre: `${b.first_names} ${b.last_names}`, parentesco: b.relationship, estado: statusLabel(b.status) })),
        pagosRecientes: payments,
        creditos: ((affiliate.credits as Record<string, unknown>[]) ?? []).map((c) => ({
          id: c.id,
          estado: c.status,
          capitalBase: formatCurrency(c.principal_base as number),
          total: formatCurrency(c.total_amount as number),
          cuota: formatCurrency(c.installment_amount as number),
          solicitadoEl: formatDate(c.requested_on as string),
        })),
        documentos: ((affiliate.member_documents as Record<string, unknown>[]) ?? []).map((d) => d.title),
      };

      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
    },
  );

  server.registerTool(
    "get_dashboard_summary",
    {
      title: "Resumen general de la operación",
      description:
        "Indicadores generales de Sopdisponal: totales de titulares activos, en carencia, suspendidos (3 a 5 meses de mora) y retirados (6 meses o más), beneficiarios, recaudo mensual reciente, distribución por tipo de afiliación y alertas de mora. Los conteos usan claves internas: inactive = Suspendido, suspended = Retirado. Solo lectura.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const { supabase } = await getAuthenticatedClient();
      const { data, error } = await supabase.rpc("get_dashboard_summary");
      if (error) return { content: [{ type: "text", text: `Error al calcular el resumen: ${error.message}` }] };
      return { content: [{ type: "text", text: JSON.stringify({ ...data, nombresDeEstado: membershipStatusLabels }, null, 2) }] };
    },
  );

  server.registerTool(
    "get_payment_totals",
    {
      title: "Totales generales de pagos",
      description: "Monto total pagado, pendiente y revertido, y número total de pagos registrados en Sopdisponal. Solo lectura.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const { supabase } = await getAuthenticatedClient();
      const { data, error } = await supabase.rpc("get_payment_totals");
      if (error) return { content: [{ type: "text", text: `Error al calcular los totales: ${error.message}` }] };
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.registerTool(
    "list_affiliate_credits",
    {
      title: "Créditos de un afiliado",
      description:
        "Lista los créditos de un afiliado con su historial de abonos (capital e interés desglosados). Útil para calcular el saldo pendiente antes de proponer un nuevo abono o una refinanciación. Solo lectura.",
      inputSchema: { affiliateId: z.string().uuid().describe("Id (uuid) del afiliado.") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ affiliateId }) => {
      const { supabase } = await getAuthenticatedClient();
      const { data, error } = await supabase
        .from("credits")
        .select("id, status, principal_base, interest_amount, total_amount, installment_amount, requested_on, credit_installments(id, paid_on, amount, capital_portion, interest_portion)")
        .eq("affiliate_id", affiliateId)
        .order("requested_on", { ascending: false });

      if (error) return { content: [{ type: "text", text: `Error al consultar créditos: ${error.message}` }] };
      if (!data?.length) return { content: [{ type: "text", text: "Este afiliado no tiene créditos registrados." }] };

      const output = data.map((credit) => {
        const installments = (credit.credit_installments as Record<string, unknown>[]) ?? [];
        const paidCapital = installments.reduce((sum, i) => sum + Number(i.capital_portion), 0);
        const paidInterest = installments.reduce((sum, i) => sum + Number(i.interest_portion), 0);
        return {
          id: credit.id,
          estado: credit.status,
          capitalBase: formatCurrency(credit.principal_base as number),
          interes: formatCurrency(credit.interest_amount as number),
          total: formatCurrency(credit.total_amount as number),
          cuota: formatCurrency(credit.installment_amount as number),
          solicitadoEl: formatDate(credit.requested_on as string),
          saldoPendiente: formatCurrency(Number(credit.total_amount) - paidCapital - paidInterest),
          abonos: installments.map((i) => ({
            fecha: formatDate(i.paid_on as string),
            valor: formatCurrency(i.amount as number),
            capital: formatCurrency(i.capital_portion as number),
            interes: formatCurrency(i.interest_portion as number),
          })),
        };
      });

      return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
    },
  );
}

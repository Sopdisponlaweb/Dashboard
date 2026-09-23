import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { formatCurrency, formatDate } from "./lib/format.js";
import { calculateCredit, splitPayment } from "./lib/calculations.js";
import { normalizeDocumentNumber } from "./lib/validation.js";
import { getAuthenticatedClient } from "./lib/supabase.js";
import {
  registerPaymentSchema,
  requestCreditSchema,
  registerCreditInstallmentSchema,
  updateAffiliateIdentitySchema,
} from "./schemas.js";

const CONFIRM_WARNING =
  "IMPORTANTE: esta herramienta NO guarda ningún cambio todavía. Solo prepara una propuesta. " +
  "Antes de llamar a confirm_write, debes mostrarle al usuario el campo 'summary' de la respuesta tal cual, " +
  "y esperar su aprobación explícita en la conversación. Nunca llames confirm_write de forma automática o especulativa.";

async function affiliateName(supabase: SupabaseClient, affiliateId: string): Promise<string> {
  const { data } = await supabase.from("affiliates").select("first_names, last_names").eq("id", affiliateId).maybeSingle();
  return data ? `${data.first_names} ${data.last_names}` : affiliateId;
}

async function insertProposal(
  supabase: SupabaseClient,
  userId: string,
  params: { toolName: string; affiliateId: string; payload: Record<string, unknown>; summary: string },
) {
  const { data, error } = await supabase
    .from("mcp_write_proposals")
    .insert({
      tool_name: params.toolName,
      affiliate_id: params.affiliateId,
      payload: params.payload,
      summary: params.summary,
      created_by: userId,
    })
    .select("id, expires_at")
    .single();

  if (error || !data) throw new Error(`No fue posible preparar la propuesta: ${error?.message ?? "error desconocido"}.`);
  return data as { id: string; expires_at: string };
}

function proposalResponse(proposalId: string, summary: string, expiresAt: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            proposalId,
            summary,
            expiresAt,
            instruccion: "Muéstrale este 'summary' al usuario tal cual y espera su aprobación explícita antes de llamar a confirm_write con este proposalId.",
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function registerWriteTools(server: McpServer) {
  server.registerTool(
    "propose_register_payment",
    {
      title: "Proponer registro de un pago",
      description: `Prepara (sin guardar) el registro manual de un pago para un afiliado. ${CONFIRM_WARNING}`,
      inputSchema: {
        affiliateId: z.string().uuid(),
        period: z.string().describe("Periodo del pago, formato YYYY-MM."),
        source: z.enum(["particular", "activo", "casur", "tegen", "inpec", "ordisponal"]),
        amount: z.string().describe("Valor numérico como texto, ej. '150000' o '150000.50'."),
        status: z.enum(["paid", "pending", "reversed"]).default("paid"),
        paidOn: z.string().optional().describe("Fecha de pago YYYY-MM-DD. Si se omite y el estado es 'paid', se usa el primer día del periodo."),
        observation: z.string().max(500).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const parsed = registerPaymentSchema.safeParse(input);
      if (!parsed.success) return { content: [{ type: "text", text: `Datos inválidos: ${parsed.error.issues[0]?.message}` }] };

      const { supabase, userId } = await getAuthenticatedClient();
      const { affiliateId, period, source, amount, status, paidOn, observation } = parsed.data;
      const periodStart = `${period}-01`;
      const finalPaidOn = status === "paid" ? (paidOn || periodStart) : (paidOn || null);
      const name = await affiliateName(supabase, affiliateId);

      const summary =
        `Registrar pago para ${name} (${affiliateId})\n` +
        `- Periodo: ${period}\n- Fuente: ${source}\n- Valor: ${formatCurrency(Number(amount))}\n- Estado: ${status}\n` +
        `- Fecha de pago: ${finalPaidOn ? formatDate(finalPaidOn) : "Sin definir"}\n` +
        `- Observación: ${observation || "Ninguna"}`;

      const proposal = await insertProposal(supabase, userId, {
        toolName: "register_payment",
        affiliateId,
        payload: { affiliate_id: affiliateId, source, period_start: periodStart, amount: Number(amount), status, paid_on: finalPaidOn, observations: observation ?? null },
        summary,
      });

      return proposalResponse(proposal.id, summary, proposal.expires_at);
    },
  );

  server.registerTool(
    "propose_request_credit",
    {
      title: "Proponer solicitud de crédito",
      description: `Prepara (sin guardar) una solicitud de crédito nuevo para un afiliado. Si el afiliado tiene un crédito activo, la app lo refinancia automáticamente al confirmar (el saldo pendiente se suma al nuevo crédito) — la vista previa de aquí asume que no hay refinanciación, así que si el afiliado tiene un crédito activo el monto final puede ser mayor al mostrado. ${CONFIRM_WARNING}`,
      inputSchema: {
        affiliateId: z.string().uuid(),
        disbursedAmount: z.string().describe("Monto nuevo desembolsado, como texto numérico."),
        interestRatePercent: z.string().describe("Tasa de interés en porcentaje, ej. '20' para 20%."),
        termMonths: z.string().describe("Plazo en meses, ej. '12'."),
        observations: z.string().max(500).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const parsed = requestCreditSchema.safeParse(input);
      if (!parsed.success) return { content: [{ type: "text", text: `Datos inválidos: ${parsed.error.issues[0]?.message}` }] };

      const { supabase, userId } = await getAuthenticatedClient();
      const { affiliateId, disbursedAmount, interestRatePercent, termMonths, observations } = parsed.data;
      const name = await affiliateName(supabase, affiliateId);

      const preview = calculateCredit({
        disbursedAmount: Number(disbursedAmount),
        rolledOverCapital: 0,
        rolledOverInterest: 0,
        rate: Number(interestRatePercent) / 100,
        termMonths: Number(termMonths),
      });

      const summary =
        `Solicitar crédito para ${name} (${affiliateId})\n` +
        `- Monto desembolsado: ${formatCurrency(Number(disbursedAmount))}\n- Tasa: ${interestRatePercent}%\n- Plazo: ${termMonths} meses\n` +
        `- Estimado SIN refinanciación: capital ${formatCurrency(preview.principalBase)} + interés ${formatCurrency(preview.interestAmount)} = ${formatCurrency(preview.totalAmount)} (cuota ${formatCurrency(preview.installmentAmount)})\n` +
        `- Observaciones: ${observations || "Ninguna"}`;

      const proposal = await insertProposal(supabase, userId, {
        toolName: "request_credit",
        affiliateId,
        payload: { affiliate_id: affiliateId, disbursed_amount: Number(disbursedAmount), interest_rate: Number(interestRatePercent) / 100, term_months: Number(termMonths), observations: observations ?? "" },
        summary,
      });

      return proposalResponse(proposal.id, summary, proposal.expires_at);
    },
  );

  server.registerTool(
    "propose_register_credit_installment",
    {
      title: "Proponer registro de un abono a crédito",
      description: `Prepara (sin guardar) el registro de un abono a un crédito activo. Calcula cuánto de ese abono corresponde a capital y cuánto a interés, y valida que no supere el saldo pendiente. ${CONFIRM_WARNING}`,
      inputSchema: {
        affiliateId: z.string().uuid(),
        creditId: z.string().uuid(),
        paidOn: z.string().describe("Fecha del abono, formato YYYY-MM-DD."),
        amount: z.string().describe("Valor del abono, como texto numérico."),
        observation: z.string().max(500).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const parsed = registerCreditInstallmentSchema.safeParse(input);
      if (!parsed.success) return { content: [{ type: "text", text: `Datos inválidos: ${parsed.error.issues[0]?.message}` }] };

      const { supabase, userId } = await getAuthenticatedClient();
      const { affiliateId, creditId, paidOn, amount, observation } = parsed.data;

      const { data: credit, error: creditError } = await supabase
        .from("credits")
        .select("status, principal_base, total_amount, credit_installments(amount)")
        .eq("id", creditId)
        .maybeSingle();

      if (creditError || !credit) return { content: [{ type: "text", text: "No fue posible encontrar ese crédito." }] };
      if (credit.status !== "active") return { content: [{ type: "text", text: "Ese crédito ya no está activo." }] };

      const alreadyPaid = ((credit.credit_installments as { amount: number }[]) ?? []).reduce((sum, i) => sum + Number(i.amount), 0);
      const remainingTotal = Number(credit.total_amount) - alreadyPaid;
      const amountValue = Number(amount);

      if (amountValue > remainingTotal + 0.01) {
        return { content: [{ type: "text", text: `El abono (${formatCurrency(amountValue)}) supera el saldo pendiente (${formatCurrency(remainingTotal)}).` }] };
      }

      const { capitalPortion, interestPortion } = splitPayment({
        principalBase: Number(credit.principal_base),
        totalAmount: Number(credit.total_amount),
        amount: amountValue,
      });

      const name = await affiliateName(supabase, affiliateId);
      const summary =
        `Registrar abono de crédito para ${name} (${affiliateId})\n` +
        `- Crédito: ${creditId}\n- Fecha: ${formatDate(paidOn)}\n- Valor: ${formatCurrency(amountValue)}\n` +
        `- Desglose: capital ${formatCurrency(capitalPortion)} + interés ${formatCurrency(interestPortion)}\n` +
        `- Saldo pendiente después de este abono: ${formatCurrency(Math.max(0, remainingTotal - amountValue))}\n` +
        `- Observación: ${observation || "Ninguna"}`;

      const proposal = await insertProposal(supabase, userId, {
        toolName: "register_credit_installment",
        affiliateId,
        payload: { credit_id: creditId, paid_on: paidOn, amount: amountValue, capital_portion: capitalPortion, interest_portion: interestPortion, observation: observation ?? null },
        summary,
      });

      return proposalResponse(proposal.id, summary, proposal.expires_at);
    },
  );

  server.registerTool(
    "propose_update_affiliate_identity",
    {
      title: "Proponer actualización de datos de identidad",
      description: `Prepara (sin guardar) una actualización de los datos de identidad de un afiliado (tipo/número de documento, nombres, apellidos, fechas). No toca otros campos de la ficha. ${CONFIRM_WARNING}`,
      inputSchema: {
        affiliateId: z.string().uuid(),
        documentType: z.enum(["CC", "CE", "TI"]),
        documentNumber: z.string(),
        firstNames: z.string(),
        lastNames: z.string(),
        birthDate: z.string().optional().describe("YYYY-MM-DD"),
        documentIssuedOn: z.string().optional().describe("YYYY-MM-DD"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const parsed = updateAffiliateIdentitySchema.safeParse(input);
      if (!parsed.success) return { content: [{ type: "text", text: `Datos inválidos: ${parsed.error.issues[0]?.message}` }] };

      const { supabase, userId } = await getAuthenticatedClient();
      const { affiliateId, documentType, documentNumber, firstNames, lastNames, birthDate, documentIssuedOn } = parsed.data;
      const normalizedDocumentNumber = normalizeDocumentNumber(documentNumber);
      const name = await affiliateName(supabase, affiliateId);

      const summary =
        `Actualizar identidad de ${name} (${affiliateId})\n` +
        `- Documento: ${documentType} ${normalizedDocumentNumber}\n- Nombres: ${firstNames}\n- Apellidos: ${lastNames}\n` +
        `- Fecha de nacimiento: ${birthDate ? formatDate(birthDate) : "Sin cambiar"}\n` +
        `- Fecha de expedición: ${documentIssuedOn ? formatDate(documentIssuedOn) : "Sin cambiar"}`;

      const proposal = await insertProposal(supabase, userId, {
        toolName: "update_affiliate_identity",
        affiliateId,
        payload: {
          document_type: documentType,
          document_number: normalizedDocumentNumber,
          first_names: firstNames,
          last_names: lastNames,
          birth_date: birthDate ?? null,
          document_issued_on: documentIssuedOn ?? null,
        },
        summary,
      });

      return proposalResponse(proposal.id, summary, proposal.expires_at);
    },
  );

  server.registerTool(
    "confirm_write",
    {
      title: "Confirmar y aplicar una propuesta de escritura",
      description:
        "Ejecuta el cambio real de una propuesta previamente creada por una herramienta propose_*. " +
        "SOLO debes llamar esta herramienta después de que el usuario haya visto el 'summary' exacto de la propuesta " +
        "y haya dado su aprobación explícita e inequívoca en esta conversación. No la llames de forma automática, " +
        "especulativa, ni inmediatamente después de un propose_* sin esa aprobación humana explícita.",
      inputSchema: { proposalId: z.string().uuid().describe("El proposalId devuelto por la herramienta propose_* correspondiente.") },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async ({ proposalId }) => {
      const { supabase, userId } = await getAuthenticatedClient();

      const { data: proposal, error: loadError } = await supabase
        .from("mcp_write_proposals")
        .select("id, tool_name, affiliate_id, payload, status, expires_at")
        .eq("id", proposalId)
        .maybeSingle();

      if (loadError || !proposal) return { content: [{ type: "text", text: "No se encontró esa propuesta (o no te pertenece)." }] };
      if (proposal.status !== "pending") return { content: [{ type: "text", text: `Esta propuesta ya fue ${proposal.status === "confirmed" ? "confirmada" : proposal.status === "cancelled" ? "cancelada" : "procesada"} antes.` }] };
      if (new Date(proposal.expires_at).getTime() < Date.now()) {
        await supabase.from("mcp_write_proposals").update({ status: "expired" }).eq("id", proposalId);
        return { content: [{ type: "text", text: "Esta propuesta venció (las propuestas expiran a los 10 minutos). Vuelve a llamar a la herramienta propose_* correspondiente." }] };
      }

      const payload = proposal.payload as Record<string, unknown>;
      let result: Record<string, unknown>;

      try {
        switch (proposal.tool_name) {
          case "register_payment": {
            const { data, error } = await supabase.from("payments").insert(payload).select("id").single();
            if (error) {
              const message = error.code === "23505" ? "Ya existe un pago registrado para esa fuente y ese periodo." : `No fue posible registrar el pago: ${error.message}`;
              return { content: [{ type: "text", text: message }] };
            }
            result = { paymentId: data.id };
            break;
          }
          case "request_credit": {
            const { error } = await supabase.rpc("request_credit", {
              p_affiliate_id: payload.affiliate_id,
              p_disbursed_amount: payload.disbursed_amount,
              p_interest_rate: payload.interest_rate,
              p_term_months: payload.term_months,
              p_observations: payload.observations,
            });
            if (error) return { content: [{ type: "text", text: `No fue posible registrar el crédito: ${error.message}` }] };
            result = { ok: true };
            break;
          }
          case "register_credit_installment": {
            const { data, error } = await supabase
              .from("credit_installments")
              .insert({ credit_id: payload.credit_id, paid_on: payload.paid_on, amount: payload.amount, capital_portion: payload.capital_portion, interest_portion: payload.interest_portion, observation: payload.observation, created_by: userId })
              .select("id")
              .single();
            if (error) return { content: [{ type: "text", text: `No fue posible registrar el abono: ${error.message}` }] };
            result = { installmentId: data.id };
            break;
          }
          case "update_affiliate_identity": {
            const { error } = await supabase.from("affiliates").update(payload).eq("id", proposal.affiliate_id);
            if (error) {
              const message = error.code === "23505" ? "Ya existe un afiliado con ese documento." : `No fue posible actualizar el afiliado: ${error.message}`;
              return { content: [{ type: "text", text: message }] };
            }
            result = { affiliateId: proposal.affiliate_id };
            break;
          }
          default:
            return { content: [{ type: "text", text: `Tipo de propuesta desconocido: ${proposal.tool_name}` }] };
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Error inesperado al confirmar: ${error instanceof Error ? error.message : String(error)}` }] };
      }

      await supabase
        .from("mcp_write_proposals")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString(), result })
        .eq("id", proposalId);

      return { content: [{ type: "text", text: JSON.stringify({ confirmado: true, resultado: result }, null, 2) }] };
    },
  );

  server.registerTool(
    "cancel_write",
    {
      title: "Cancelar una propuesta de escritura",
      description: "Descarta una propuesta pendiente creada por una herramienta propose_*. No modifica ningún otro dato.",
      inputSchema: { proposalId: z.string().uuid() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ proposalId }) => {
      const { supabase } = await getAuthenticatedClient();
      const { data, error } = await supabase
        .from("mcp_write_proposals")
        .update({ status: "cancelled" })
        .eq("id", proposalId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (error) return { content: [{ type: "text", text: `Error al cancelar: ${error.message}` }] };
      if (!data) return { content: [{ type: "text", text: "No se encontró una propuesta pendiente con ese id." }] };
      return { content: [{ type: "text", text: "Propuesta cancelada. No se guardó ningún dato." }] };
    },
  );
}

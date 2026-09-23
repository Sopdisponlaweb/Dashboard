import { NextResponse } from "next/server";

import { getProvider, isAnyProviderConfigured } from "@/features/assistant/providers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const systemPrompt = `Eres el asistente interno de Sopdisponal, una organización colombiana que administra beneficios y pensión para sus afiliados.
Respondes preguntas del equipo administrativo sobre afiliados, beneficiarios, pagos y mora, usando exclusivamente las herramientas disponibles para consultar datos reales.
Reglas:
- Nunca inventes datos. Si una herramienta no encuentra información, dilo con claridad.
- No puedes crear, modificar ni eliminar información; solo consultas.
- Responde en español, de forma breve y precisa, citando cifras exactas cuando las tengas.
- Si una pregunta requiere el detalle de un afiliado específico, primero usa search_affiliates para encontrar el id y luego get_affiliate_detail.`;

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ message: "El asistente requiere una conexión activa a Supabase." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) {
    return NextResponse.json({ message: "Tu sesión no es válida o venció. Inicia sesión nuevamente." }, { status: 401 });
  }

  if (!isAnyProviderConfigured()) {
    return NextResponse.json(
      { message: "El asistente de IA no está configurado. Falta ANTHROPIC_API_KEY, GROQ_API_KEY u OPENROUTER_API_KEY en el servidor." },
      { status: 501 },
    );
  }

  const body = await request.json().catch(() => null);
  const incoming = Array.isArray(body?.messages) ? (body.messages as IncomingMessage[]) : null;
  const providerId = typeof body?.providerId === "string" ? body.providerId : "";
  const model = typeof body?.model === "string" ? body.model : "";

  if (!incoming || !incoming.length) {
    return NextResponse.json({ message: "Envía al menos un mensaje." }, { status: 400 });
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return NextResponse.json({ message: "Proveedor de modelo desconocido." }, { status: 400 });
  }
  if (!provider.isConfigured()) {
    return NextResponse.json({ message: `${provider.label} no está configurado en el servidor.` }, { status: 501 });
  }
  if (!model || !provider.models.some((option) => option.id === model)) {
    return NextResponse.json({ message: "Selecciona un modelo válido." }, { status: 400 });
  }

  try {
    const message = await provider.runConversation({ model, systemPrompt, messages: incoming });
    return NextResponse.json({ message });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Error desconocido.";
    return NextResponse.json({ message: `No fue posible consultar al asistente: ${detail}` }, { status: 502 });
  }
}

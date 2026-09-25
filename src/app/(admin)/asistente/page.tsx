import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { AssistantChat } from "@/features/assistant/chat-widget";
import { ASSISTANT_ENABLED } from "@/features/assistant/config";
import { assistantProviders, isAnyProviderConfigured, listAvailableModels } from "@/features/assistant/providers";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Asistente IA" };

export default function AssistantPage() {
  if (!ASSISTANT_ENABLED) notFound();

  const persistenceEnabled = isSupabaseConfigured();
  const configured = isAnyProviderConfigured();
  const availableModels = listAvailableModels();

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Asistencia</p>
          <h1>Asistente interno</h1>
          <p>Consulta afiliados, pagos, beneficiarios e indicadores en lenguaje natural. Solo responde con datos autorizados para tu sesión y no puede modificar información.</p>
        </div>
        <DataSourceBadge connected={persistenceEnabled} connectedLabel="Conectado a Supabase local" disconnectedLabel="Requiere conexión a Supabase" />
      </header>

      {!persistenceEnabled ? (
        <p className="empty-hint">El asistente requiere una conexión activa a Supabase.</p>
      ) : (
        <>
          <section className="detail-panel" aria-labelledby="providers-title">
            <div className="panel-header">
              <div>
                <h2 id="providers-title">Proveedores de modelos</h2>
                <p>Cada uno se activa agregando su API key en el archivo .env.local del servidor.</p>
              </div>
            </div>
            <ul className="provider-status-list">
              {assistantProviders.map((provider) => {
                const isConfigured = provider.isConfigured();
                return (
                  <li key={provider.id} className={`provider-status-item${isConfigured ? " is-ready" : ""}`}>
                    <span><Icon name={isConfigured ? "lock" : "activity"} size={16} /></span>
                    <div>
                      <strong>{provider.label}</strong>
                      <small>{isConfigured ? `${provider.models.length} modelos disponibles` : "No configurado"}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {!configured ? (
            <div className="persistence-banner">
              <span><Icon name="message" size={18} /></span>
              <div>
                <strong>Falta configurar al menos un proveedor</strong>
                <p>Agrega ANTHROPIC_API_KEY o OPENROUTER_API_KEY en .env.local para activar las respuestas de IA. La interfaz y las herramientas de consulta ya están listas.</p>
              </div>
            </div>
          ) : (
            <section className="detail-panel" aria-labelledby="assistant-chat-title">
              <div className="panel-header">
                <div>
                  <h2 id="assistant-chat-title">Chat</h2>
                  <p>Las conversaciones no se guardan; cada sesión del navegador empieza desde cero.</p>
                </div>
              </div>
              <AssistantChat availableModels={availableModels} />
            </section>
          )}
        </>
      )}
    </>
  );
}

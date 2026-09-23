"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";

type ChatMessage = { role: "user" | "assistant"; content: string };

type AvailableModel = { id: string; label: string; providerId: string; providerLabel: string };

type AssistantChatProps = {
  availableModels: AvailableModel[];
};

export function AssistantChat({ availableModels }: AssistantChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelKey, setModelKey] = useState(() => (availableModels[0] ? `${availableModels[0].providerId}:${availableModels[0].id}` : ""));
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || pending || !modelKey) return;

    const [providerId, ...modelParts] = modelKey.split(":");
    const model = modelParts.join(":");

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, providerId, model }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.message ?? "No fue posible consultar al asistente.");
        return;
      }

      setMessages([...nextMessages, { role: "assistant", content: String(data?.message ?? "") }]);
    } catch {
      setError("No fue posible conectar con el asistente. Verifica tu conexión.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="assistant-chat">
      {availableModels.length > 1 ? (
        <label className="assistant-model-picker">
          <span>Modelo</span>
          <select value={modelKey} onChange={(event) => setModelKey(event.target.value)} disabled={pending}>
            {availableModels.map((model) => (
              <option key={`${model.providerId}:${model.id}`} value={`${model.providerId}:${model.id}`}>
                {model.label} · {model.providerLabel}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="assistant-messages" ref={listRef}>
        {messages.length ? (
          messages.map((message, index) => (
            <div className={`assistant-bubble assistant-bubble-${message.role}`} key={index}>
              <span className="assistant-bubble-role">{message.role === "user" ? "Tú" : "Asistente"}</span>
              <p>{message.content}</p>
            </div>
          ))
        ) : (
          <p className="inline-empty">
            Pregunta sobre afiliados, pagos, beneficiarios o indicadores generales. Por ejemplo: &quot;¿Cuántos titulares están suspendidos por mora?&quot;
          </p>
        )}
        {pending ? (
          <div className="assistant-bubble assistant-bubble-assistant assistant-bubble-pending">
            <span className="assistant-bubble-role">Asistente</span>
            <p>Consultando…</p>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="form-message message-error" role="alert"><Icon name="activity" size={16} /><span>{error}</span></div>
      ) : null}

      <form className="assistant-input-row" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Escribe tu pregunta..."
          aria-label="Mensaje para el asistente"
          disabled={pending}
        />
        <button className="primary-button" type="submit" disabled={pending || !input.trim() || !modelKey}>Enviar</button>
      </form>
    </div>
  );
}

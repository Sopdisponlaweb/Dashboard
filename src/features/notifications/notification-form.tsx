"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { sendNotification } from "./actions";
import { initialNotificationFormState } from "./form-state";
import type { NotificationRecipientOption } from "./repository";

type NotificationFormProps = {
  recipients: NotificationRecipientOption[];
};

export function NotificationForm({ recipients }: NotificationFormProps) {
  const [state, formAction, pending] = useActionState(sendNotification, initialNotificationFormState);

  return (
    <form action={formAction} className="affiliate-form" noValidate>
      <div className="field-grid field-grid-three">
        <label className="form-field">
          <span>Destinatario <em>*</em></span>
          <select name="recipientId" defaultValue="" required>
            <option value="">Todos los usuarios</option>
            {recipients.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>{recipient.displayName}</option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Nivel <em>*</em></span>
          <select name="level" defaultValue="info" required>
            <option value="info">Información</option>
            <option value="success">Éxito</option>
            <option value="warning">Advertencia</option>
            <option value="critical">Crítico</option>
          </select>
        </label>
      </div>
      <label className="form-field">
        <span>Título <em>*</em></span>
        <input name="title" placeholder="Ej. Mantenimiento programado" required />
      </label>
      <label className="form-field">
        <span>Mensaje <em>*</em></span>
        <textarea name="message" rows={3} required placeholder="Detalle de la notificación..." />
      </label>

      {state.status === "error" && state.message ? (
        <div className="form-message message-error" role="alert"><Icon name="activity" size={16} /><span>{state.message}</span></div>
      ) : null}
      {state.status === "unavailable" && state.message ? (
        <div className="form-message message-unavailable" role="status"><Icon name="lock" size={16} /><span>{state.message}</span></div>
      ) : null}
      {state.status === "sent" && state.message ? (
        <div className="form-message message-success" role="status"><Icon name="lock" size={16} /><span>{state.message}</span></div>
      ) : null}

      <footer className="form-footer">
        <p>Se enviará al destinatario elegido, o a todos los usuarios si dejas &quot;Todos&quot;.</p>
        <div><button className="primary-button" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar notificación"}</button></div>
      </footer>
    </form>
  );
}

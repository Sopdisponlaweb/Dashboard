"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { initialAnnouncementActionState, type AnnouncementActionState } from "./form-state";
import type { AnnouncementFormField, AnnouncementFormValues } from "./validation";

type AnnouncementFormAction = (
  state: AnnouncementActionState,
  formData: FormData,
) => Promise<AnnouncementActionState>;

type AnnouncementFormProps = {
  action: AnnouncementFormAction;
  persistenceEnabled: boolean;
};

const defaultValues: AnnouncementFormValues = {
  title: "",
  message: "",
  startsOn: "",
  endsOn: "",
  isPublished: false,
};

function firstError(state: AnnouncementActionState, field: AnnouncementFormField) {
  return state.fieldErrors?.[field]?.[0];
}

export function AnnouncementForm({ action, persistenceEnabled }: AnnouncementFormProps) {
  const [state, formAction, pending] = useActionState(action, initialAnnouncementActionState);
  const values = state.values ?? defaultValues;
  const fieldProps = (field: AnnouncementFormField) => {
    const message = firstError(state, field);
    return {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `${field}-error` : undefined,
    };
  };
  const error = (field: AnnouncementFormField) => {
    const message = firstError(state, field);
    return message ? <span className="field-error" id={`${field}-error`}>{message}</span> : null;
  };

  return (
    <form action={formAction} className="affiliate-form" noValidate>
      <div className={`persistence-banner${persistenceEnabled ? " is-ready" : ""}`}>
        <span><Icon name={persistenceEnabled ? "lock" : "activity"} size={18} /></span>
        <div>
          <strong>{persistenceEnabled ? "Conexión segura disponible" : "Modo local sin persistencia"}</strong>
          <p>{persistenceEnabled
            ? "Al publicar se verificará tu sesión y el permiso de gestión de avisos."
            : "Puedes completar y validar el formulario. Nada se escribirá hasta activar Supabase local."}</p>
        </div>
      </div>

      {state.message ? (
        <div className={`form-message message-${state.status}`} role="alert">
          <Icon name={state.status === "error" ? "activity" : "lock"} size={18} />
          <span>{state.message}</span>
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="announcement-content-title">
        <div className="form-section-heading"><span>01</span><div><h2 id="announcement-content-title">Contenido</h2><p>Lo que verá el equipo en el resumen de la operación.</p></div></div>
        <label className="form-field">
          <span>Título <em>*</em></span>
          <input name="title" defaultValue={values.title} required placeholder="Ej. Jornada especial de atención" {...fieldProps("title")} />
          {error("title")}
        </label>
        <label className="form-field">
          <span>Mensaje <em>*</em></span>
          <textarea name="message" defaultValue={values.message} rows={4} required placeholder="Detalle del aviso para el equipo interno..." {...fieldProps("message")} />
          {error("message")}
        </label>
      </section>

      <section className="form-section" aria-labelledby="announcement-window-title">
        <div className="form-section-heading"><span>02</span><div><h2 id="announcement-window-title">Vigencia</h2><p>Rango de fechas en el que el aviso estará visible.</p></div></div>
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Visible desde <em>*</em></span>
            <input name="startsOn" type="date" defaultValue={values.startsOn} required {...fieldProps("startsOn")} />
            {error("startsOn")}
          </label>
          <label className="form-field">
            <span>Visible hasta <em>*</em></span>
            <input name="endsOn" type="date" defaultValue={values.endsOn} required {...fieldProps("endsOn")} />
            {error("endsOn")}
          </label>
          <label className="form-field form-field-checkbox">
            <span>Publicación</span>
            <span className="checkbox-row"><input name="isPublished" type="checkbox" defaultChecked={values.isPublished} /> Publicar de inmediato</span>
            <small>Si lo dejas sin marcar, quedará guardado como borrador.</small>
          </label>
        </div>
      </section>

      <footer className="form-footer">
        <p><strong>*</strong> Campos obligatorios</p>
        <div>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Validando…" : persistenceEnabled ? "Publicar aviso" : "Validar formulario"}
          </button>
        </div>
      </footer>
    </form>
  );
}

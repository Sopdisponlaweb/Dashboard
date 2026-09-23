"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Icon } from "@/components/icons";
import type { Municipality } from "@/features/catalogs/repository";

import { initialBeneficiaryActionState, type BeneficiaryActionState } from "./form-state";
import type { BeneficiaryFormField, BeneficiaryFormValues } from "./validation";

type BeneficiaryFormAction = (
  state: BeneficiaryActionState,
  formData: FormData,
) => Promise<BeneficiaryActionState>;

type BeneficiaryFormProps = {
  action: BeneficiaryFormAction;
  initialValues: BeneficiaryFormValues;
  mode: "create" | "edit";
  persistenceEnabled: boolean;
  cancelHref: string;
  affiliateName: string;
  municipalities: Municipality[];
};

function firstError(state: BeneficiaryActionState, field: BeneficiaryFormField) {
  return state.fieldErrors?.[field]?.[0];
}

export function BeneficiaryForm({
  action,
  initialValues,
  mode,
  persistenceEnabled,
  cancelHref,
  affiliateName,
  municipalities,
}: BeneficiaryFormProps) {
  const [state, formAction, pending] = useActionState(action, initialBeneficiaryActionState);
  const values = state.values ?? initialValues;
  const [status, setStatus] = useState(values.status);
  const isDeceased = status === "deceased";
  const departments = Array.from(new Set(municipalities.map((m) => m.department))).sort((a, b) => a.localeCompare(b, "es"));
  const [deathDepartment, setDeathDepartment] = useState(() => {
    const current = municipalities.find((m) => m.id === values.deathMunicipalityId);
    return current?.department ?? "";
  });
  const fieldProps = (field: BeneficiaryFormField) => {
    const message = firstError(state, field);
    return {
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `${field}-error` : undefined,
    };
  };
  const error = (field: BeneficiaryFormField) => {
    const message = firstError(state, field);
    return message ? <span className="field-error" id={`${field}-error`}>{message}</span> : null;
  };

  return (
    <form action={formAction} className="affiliate-form" noValidate>
      <div className="relationship-banner">
        <span><Icon name="heart" size={19} /></span>
        <div><strong>Titular vinculado</strong><p>{affiliateName}. La cobertura del beneficiario se contará desde su propia fecha de vinculación.</p></div>
      </div>

      <div className={`persistence-banner${persistenceEnabled ? " is-ready" : ""}`}>
        <span><Icon name={persistenceEnabled ? "lock" : "activity"} size={18} /></span>
        <div>
          <strong>{persistenceEnabled ? "Conexión segura disponible" : "Modo local sin persistencia"}</strong>
          <p>{persistenceEnabled
            ? "Al guardar se verificará tu sesión y el permiso de gestión de afiliados."
            : "Puedes completar y validar el formulario. Nada se escribirá hasta activar Supabase local."}</p>
        </div>
      </div>

      {state.message ? <div className={`form-message message-${state.status}`} role="alert"><Icon name={state.status === "error" ? "activity" : "lock"} size={18} /><span>{state.message}</span></div> : null}

      <section className="form-section" aria-labelledby="relationship-title">
        <div className="form-section-heading"><span>01</span><div><h2 id="relationship-title">Vínculo</h2><p>Define la relación con el titular.</p></div></div>
        <label className="form-field form-field-compact">
          <span>Parentesco o relación <em>*</em></span>
          <input name="relationship" defaultValue={values.relationship} required list="relationship-options" placeholder="Ej. Hija, cónyuge, padre" {...fieldProps("relationship")} />
          <datalist id="relationship-options"><option value="Cónyuge" /><option value="Hijo" /><option value="Hija" /><option value="Padre" /><option value="Madre" /><option value="Hermano" /><option value="Hermana" /><option value="Otro" /></datalist>
          {error("relationship")}
        </label>
      </section>

      <section className="form-section" aria-labelledby="beneficiary-identification-title">
        <div className="form-section-heading"><span>02</span><div><h2 id="beneficiary-identification-title">Identificación</h2><p>El documento es opcional, pero se recomienda registrarlo cuando exista.</p></div></div>
        <div className="field-grid field-grid-three">
          <label className="form-field"><span>Tipo de documento</span><select name="documentType" defaultValue={values.documentType} {...fieldProps("documentType")}><option value="CC">Cédula de ciudadanía</option><option value="CE">Cédula de extranjería</option><option value="TI">Tarjeta de identidad</option></select>{error("documentType")}</label>
          <label className="form-field field-span-two"><span>Número de documento</span><input name="documentNumber" defaultValue={values.documentNumber} autoComplete="off" placeholder="Ej. 1.036.418.220" {...fieldProps("documentNumber")} />{error("documentNumber")}</label>
          <label className="form-field"><span>Fecha de expedición</span><input name="documentIssuedOn" type="date" defaultValue={values.documentIssuedOn} {...fieldProps("documentIssuedOn")} /><small>Muchos registros migrados no la tienen.</small>{error("documentIssuedOn")}</label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="beneficiary-personal-title">
        <div className="form-section-heading"><span>03</span><div><h2 id="beneficiary-personal-title">Datos personales</h2><p>Información necesaria para identificar y atender al beneficiario.</p></div></div>
        <div className="field-grid">
          <label className="form-field"><span>Nombres <em>*</em></span><input name="firstNames" defaultValue={values.firstNames} required autoComplete="given-name" placeholder="Nombres completos" {...fieldProps("firstNames")} />{error("firstNames")}</label>
          <label className="form-field"><span>Apellidos <em>*</em></span><input name="lastNames" defaultValue={values.lastNames} required autoComplete="family-name" placeholder="Apellidos completos" {...fieldProps("lastNames")} />{error("lastNames")}</label>
          <label className="form-field"><span>Fecha de nacimiento <em>*</em></span><input name="birthDate" type="date" defaultValue={values.birthDate} required autoComplete="bday" {...fieldProps("birthDate")} />{error("birthDate")}</label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="beneficiary-contact-title">
        <div className="form-section-heading"><span>04</span><div><h2 id="beneficiary-contact-title">Contacto</h2><p>Úsalo solo cuando sea apropiado para el beneficiario.</p></div></div>
        <div className="field-grid">
          <label className="form-field"><span>Teléfono</span><input name="phone" defaultValue={values.phone} autoComplete="tel" inputMode="tel" placeholder="300 000 0000" {...fieldProps("phone")} />{error("phone")}</label>
          <label className="form-field"><span>Correo electrónico</span><input name="email" type="email" defaultValue={values.email} autoComplete="email" placeholder="persona@correo.com" {...fieldProps("email")} />{error("email")}</label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="beneficiary-status-title">
        <div className="form-section-heading"><span>05</span><div><h2 id="beneficiary-status-title">Vigencia</h2><p>El sistema calculará la cobertura completa seis meses después de la vinculación.</p></div></div>
        <div className="field-grid field-grid-three">
          <label className="form-field"><span>Fecha de vinculación <em>*</em></span><input name="joinedOn" type="date" defaultValue={values.joinedOn} required {...fieldProps("joinedOn")} />{error("joinedOn")}</label>
          <label className="form-field">
            <span>Estado <em>*</em></span>
            <select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as BeneficiaryFormValues["status"])}
              required
              {...fieldProps("status")}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
              <option value="suspended">Suspendido</option>
              <option value="deceased">Fallecido</option>
            </select>
            <small>Los estados por mora se actualizarán automáticamente con los pagos.</small>
            {error("status")}
          </label>
          <label className="form-field"><span>Fecha de fallecimiento</span><input name="deceasedOn" type="date" defaultValue={values.deceasedOn} disabled={!isDeceased} {...fieldProps("deceasedOn")} /><small>Déjala vacía si no se conoce con certeza.</small>{error("deceasedOn")}</label>
        </div>
      </section>

      {isDeceased ? (
        <section className="form-section" aria-labelledby="beneficiary-death-title">
          <div className="form-section-heading">
            <span>06</span>
            <div><h2 id="beneficiary-death-title">Detalles del fallecimiento</h2><p>Registro de defunción y cuenta para el pago del servicio.</p></div>
          </div>

          <div className="form-section-body">
          <div className="field-grid field-grid-three">
            <label className="form-field">
              <span>Departamento</span>
              <select value={deathDepartment} onChange={(event) => setDeathDepartment(event.target.value)}>
                <option value="">Seleccione departamento</option>
                {departments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
            </label>
            <label className="form-field">
              <span>Municipio</span>
              <select name="deathMunicipalityId" defaultValue={values.deathMunicipalityId} {...fieldProps("deathMunicipalityId")}>
                <option value="">Seleccione municipio</option>
                {municipalities
                  .filter((m) => m.department === deathDepartment)
                  .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {error("deathMunicipalityId")}
            </label>
            <label className="form-field">
              <span>N.° registro de defunción</span>
              <input name="deathRegistryNumber" defaultValue={values.deathRegistryNumber} placeholder="Número de registro" {...fieldProps("deathRegistryNumber")} />
              {error("deathRegistryNumber")}
            </label>
            <label className="form-field">
              <span>Notaría que expide</span>
              <input name="deathNotary" defaultValue={values.deathNotary} placeholder="Notaría" {...fieldProps("deathNotary")} />
              {error("deathNotary")}
            </label>
            <label className="form-field">
              <span>Servicio prestado</span>
              <input name="deathServiceProvided" defaultValue={values.deathServiceProvided} placeholder="Ej. Auxilio funerario" {...fieldProps("deathServiceProvided")} />
              {error("deathServiceProvided")}
            </label>
            <label className="form-field">
              <span>Monto del servicio</span>
              <input name="deathServiceAmount" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={values.deathServiceAmount} placeholder="0" {...fieldProps("deathServiceAmount")} />
              {error("deathServiceAmount")}
            </label>
          </div>

          <p className="form-subheading">Detalle de pago</p>
          <div className="field-grid field-grid-three">
            <label className="form-field">
              <span>Banco</span>
              <input name="successorBank" defaultValue={values.successorBank} placeholder="Banco" {...fieldProps("successorBank")} />
              {error("successorBank")}
            </label>
            <label className="form-field">
              <span>Número de cuenta</span>
              <input name="successorAccountNumber" defaultValue={values.successorAccountNumber} placeholder="Número de cuenta" {...fieldProps("successorAccountNumber")} />
              {error("successorAccountNumber")}
            </label>
            <label className="form-field">
              <span>Tipo de cuenta</span>
              <select name="successorAccountType" defaultValue={values.successorAccountType} {...fieldProps("successorAccountType")}>
                <option value="">Seleccione tipo de cuenta</option>
                <option value="ahorros">Ahorros</option>
                <option value="corriente">Corriente</option>
              </select>
              {error("successorAccountType")}
            </label>
          </div>
          </div>
        </section>
      ) : null}

      <footer className="form-footer"><p><strong>*</strong> Campos obligatorios</p><div><Link className="secondary-button" href={cancelHref}>Cancelar</Link><button className="primary-button" type="submit" disabled={pending}>{pending ? "Validando…" : persistenceEnabled ? (mode === "create" ? "Guardar beneficiario" : "Guardar cambios") : "Validar formulario"}</button></div></footer>
    </form>
  );
}

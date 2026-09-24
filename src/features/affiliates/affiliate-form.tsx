"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Icon } from "@/components/icons";
import type { Municipality, PoliceRank, PoliceRankCategory } from "@/features/catalogs/repository";

import { affiliateStatuses, affiliationSources, describeWaitingPeriod, sourceLabels, sourceUsesPoliceRank, statusLabels } from "./format";
import { initialAffiliateActionState, type AffiliateActionState } from "./form-state";
import type { AffiliateFormField, AffiliateFormValues } from "./validation";

type AffiliateFormAction = (
  state: AffiliateActionState,
  formData: FormData,
) => Promise<AffiliateActionState>;

type AffiliateFormProps = {
  action: AffiliateFormAction;
  initialValues: AffiliateFormValues;
  mode: "create" | "edit";
  persistenceEnabled: boolean;
  cancelHref: string;
  municipalities: Municipality[];
  policeRanks: PoliceRank[];
};

const policeRankCategoryOptions: { value: PoliceRankCategory; label: string }[] = [
  { value: "oficial_general", label: "Oficial General" },
  { value: "oficial_superior", label: "Oficial Superior" },
  { value: "oficial_subalterno", label: "Oficial Subalterno" },
  { value: "nivel_ejecutivo", label: "Nivel Ejecutivo" },
  { value: "historico", label: "Histórico (fuera de uso)" },
];

function firstError(state: AffiliateActionState, field: AffiliateFormField) {
  return state.fieldErrors?.[field]?.[0];
}

export function AffiliateForm({
  action,
  initialValues,
  mode,
  persistenceEnabled,
  cancelHref,
  municipalities,
  policeRanks,
}: AffiliateFormProps) {
  const [state, formAction, pending] = useActionState(action, initialAffiliateActionState);
  const values = state.values ?? initialValues;
  const [status, setStatus] = useState(values.status);
  const [source, setSource] = useState(values.source);
  const [joinedOn, setJoinedOn] = useState(values.joinedOn);
  // Kept while the rank is disabled so switching back to a police type restores it.
  const [policeRankId, setPoliceRankId] = useState(values.policeRankId);
  const usesPoliceRank = sourceUsesPoliceRank(source);
  const isDeceased = status === "deceased";
  const departments = Array.from(new Set(municipalities.map((m) => m.department))).sort((a, b) => a.localeCompare(b, "es"));
  const [deathDepartment, setDeathDepartment] = useState(() => {
    const current = municipalities.find((m) => m.id === values.deathMunicipalityId);
    return current?.department ?? "";
  });
  const fieldProps = (field: AffiliateFormField) => {
    const error = firstError(state, field);
    return {
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${field}-error` : undefined,
    };
  };
  const error = (field: AffiliateFormField) => {
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
            ? "Al guardar se verificará tu sesión y PostgreSQL aplicará los permisos del rol."
            : "Puedes completar y validar el formulario. Nada se escribirá hasta activar Supabase local."}</p>
        </div>
      </div>

      {state.message ? (
        <div className={`form-message message-${state.status}`} role="alert">
          <Icon name={state.status === "error" ? "activity" : "lock"} size={18} />
          <span>{state.message}</span>
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="identification-title">
        <div className="form-section-heading">
          <span>01</span>
          <div><h2 id="identification-title">Identificación</h2><p>Documento legal y fecha de expedición.</p></div>
        </div>
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Tipo de documento <em>*</em></span>
            <select name="documentType" defaultValue={values.documentType} required {...fieldProps("documentType")}>
              <option value="CC">Cédula de ciudadanía</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="TI">Tarjeta de identidad</option>
            </select>
            {error("documentType")}
          </label>
          <label className="form-field field-span-two">
            <span>Número de documento <em>*</em></span>
            <input name="documentNumber" defaultValue={values.documentNumber} required autoComplete="off" inputMode="text" placeholder="Ej. 52.884.104" {...fieldProps("documentNumber")} />
            <small>Se guardará sin puntos ni espacios para evitar duplicados.</small>
            {error("documentNumber")}
          </label>
          <label className="form-field">
            <span>Fecha de expedición</span>
            <input name="documentIssuedOn" type="date" defaultValue={values.documentIssuedOn} {...fieldProps("documentIssuedOn")} />
            <small>Muchos registros migrados del sistema anterior no la tienen.</small>
            {error("documentIssuedOn")}
          </label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="personal-title">
        <div className="form-section-heading">
          <span>02</span>
          <div><h2 id="personal-title">Datos personales</h2><p>Información básica del titular.</p></div>
        </div>
        <div className="field-grid">
          <label className="form-field">
            <span>Nombres <em>*</em></span>
            <input name="firstNames" defaultValue={values.firstNames} required autoComplete="given-name" placeholder="Nombres completos" {...fieldProps("firstNames")} />
            {error("firstNames")}
          </label>
          <label className="form-field">
            <span>Apellidos <em>*</em></span>
            <input name="lastNames" defaultValue={values.lastNames} required autoComplete="family-name" placeholder="Apellidos completos" {...fieldProps("lastNames")} />
            {error("lastNames")}
          </label>
          <label className="form-field">
            <span>Fecha de nacimiento</span>
            <input name="birthDate" type="date" defaultValue={values.birthDate} autoComplete="bday" {...fieldProps("birthDate")} />
            <small>Muchos registros migrados del sistema anterior no la tienen.</small>
            {error("birthDate")}
          </label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="contact-title">
        <div className="form-section-heading">
          <span>03</span>
          <div><h2 id="contact-title">Contacto</h2><p>Canales administrativos para comunicarse con el afiliado.</p></div>
        </div>
        <div className="field-grid">
          <label className="form-field">
            <span>Teléfono</span>
            <input name="phone" defaultValue={values.phone} autoComplete="tel" inputMode="tel" placeholder="300 000 0000" {...fieldProps("phone")} />
            {error("phone")}
          </label>
          <label className="form-field">
            <span>Correo electrónico</span>
            <input name="email" type="email" defaultValue={values.email} autoComplete="email" placeholder="persona@correo.com" {...fieldProps("email")} />
            {error("email")}
          </label>
          <label className="form-field field-span-two">
            <span>Dirección</span>
            <input name="address" defaultValue={values.address} autoComplete="street-address" placeholder="Dirección de residencia" {...fieldProps("address")} />
            {error("address")}
          </label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="membership-title">
        <div className="form-section-heading">
          <span>04</span>
          <div><h2 id="membership-title">Afiliación</h2><p>Clasificación, ingreso y estado operativo.</p></div>
        </div>
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Tipo de afiliación <em>*</em></span>
            <select
              name="source"
              value={source}
              onChange={(event) => setSource(event.target.value as AffiliateFormValues["source"])}
              required
              {...fieldProps("source")}
            >
              {affiliationSources.map((value) => <option key={value} value={value}>{sourceLabels[value]}</option>)}
            </select>
            {error("source")}
          </label>
          <label className="form-field">
            <span>Rango de policía</span>
            <select
              name="policeRankId"
              value={usesPoliceRank ? policeRankId : ""}
              onChange={(event) => setPoliceRankId(event.target.value)}
              disabled={!usesPoliceRank}
              {...fieldProps("policeRankId")}
            >
              <option value="">{usesPoliceRank ? "Sin registrar" : "No aplica"}</option>
              {policeRankCategoryOptions.map(({ value, label }) => {
                const ranksInCategory = policeRanks.filter((rank) => rank.category === value && rank.isActive);
                if (!ranksInCategory.length) return null;
                return (
                  <optgroup key={value} label={label}>
                    {ranksInCategory.map((rank) => (
                      <option key={rank.id} value={rank.id}>{rank.abbreviation ? `${rank.name} (${rank.abbreviation})` : rank.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            <small>Solo aplica a PERSONAL ACTIVO, CASUR y TEGEN.</small>
            {error("policeRankId")}
          </label>
          <label className="form-field">
            <span>Fecha de afiliación <em>*</em></span>
            <input name="joinedOn" type="date" defaultValue={values.joinedOn} onChange={(event) => setJoinedOn(event.target.value)} required {...fieldProps("joinedOn")} />
            <small>{describeWaitingPeriod(joinedOn)}</small>
            {error("joinedOn")}
          </label>
          <label className="form-field">
            <span>Estado <em>*</em></span>
            <select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as AffiliateFormValues["status"])}
              required
              {...fieldProps("status")}
            >
              {affiliateStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
            </select>
            <small>La suspensión (3 meses sin pago) y el retiro (6 meses) se aplican automáticamente según los pagos.</small>
            {error("status")}
          </label>
          <label className="form-field">
            <span>Fecha de fallecimiento{isDeceased ? <em> *</em> : null}</span>
            <input name="deceasedOn" type="date" defaultValue={values.deceasedOn} disabled={!isDeceased} {...fieldProps("deceasedOn")} />
            <small>Solo se permite cuando el estado es fallecido.</small>
            {error("deceasedOn")}
          </label>
        </div>
      </section>

      {isDeceased ? (
        <section className="form-section" aria-labelledby="death-title">
          <div className="form-section-heading">
            <span>05</span>
            <div><h2 id="death-title">Fallecimiento y sucesión</h2><p>Información del sucesor, el registro de defunción y la cuenta para el pago final.</p></div>
          </div>

          <div className="form-section-body">
          <p className="form-subheading">Información del sucesor</p>
          <div className="field-grid field-grid-three">
            <label className="form-field">
              <span>Número de resolución</span>
              <input name="successorResolutionNumber" defaultValue={values.successorResolutionNumber} placeholder="Número de resolución" {...fieldProps("successorResolutionNumber")} />
              {error("successorResolutionNumber")}
            </label>
            <label className="form-field">
              <span>N.° doc. sucesor</span>
              <input name="successorDocumentNumber" defaultValue={values.successorDocumentNumber} placeholder="Documento del sucesor" {...fieldProps("successorDocumentNumber")} />
              {error("successorDocumentNumber")}
            </label>
            <label className="form-field">
              <span>Teléfono</span>
              <input name="successorPhone" defaultValue={values.successorPhone} placeholder="Teléfono del sucesor" {...fieldProps("successorPhone")} />
              {error("successorPhone")}
            </label>
            <label className="form-field">
              <span>Apellidos sucesor</span>
              <input name="successorLastNames" defaultValue={values.successorLastNames} placeholder="Apellidos del sucesor" {...fieldProps("successorLastNames")} />
              {error("successorLastNames")}
            </label>
            <label className="form-field">
              <span>Nombres sucesor</span>
              <input name="successorFirstNames" defaultValue={values.successorFirstNames} placeholder="Nombres del sucesor" {...fieldProps("successorFirstNames")} />
              {error("successorFirstNames")}
            </label>
          </div>

          <p className="form-subheading">Detalles del fallecimiento</p>
          <div className="field-grid field-grid-three">
            <label className="form-field">
              <span>Departamento</span>
              <select
                value={deathDepartment}
                onChange={(event) => setDeathDepartment(event.target.value)}
              >
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

      <footer className="form-footer">
        <p><strong>*</strong> Campos obligatorios</p>
        <div>
          <Link className="secondary-button" href={cancelHref}>Cancelar</Link>
          <button className="primary-button" type="submit" disabled={pending}>
            {pending ? "Validando…" : persistenceEnabled ? (mode === "create" ? "Guardar afiliado" : "Guardar cambios") : "Validar formulario"}
          </button>
        </div>
      </footer>
    </form>
  );
}

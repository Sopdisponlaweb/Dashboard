"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { Icon } from "@/components/icons";
import { affiliationSources, formatCurrency, formatDate, formatPeriod, sourceLabels, statusLabels } from "@/features/affiliates/format";
import type { AffiliateStatus, AffiliationSource } from "@/features/affiliates/types";

import { searchSuccessorCandidates } from "./actions";
import { initialSuccessionFormState, type SuccessionFormState, type SuccessorCandidate, type SuccessorOrigin } from "./types";

type RegisterAction = (state: SuccessionFormState, formData: FormData) => Promise<SuccessionFormState>;

export type SuccessionBeneficiary = {
  id: string;
  name: string;
  relationship: string;
  documentType: string | null;
  documentNumber: string | null;
  phone: string | null;
  email: string | null;
};

type SuccessionFormProps = {
  action: RegisterAction;
  deceased: { id: string; name: string; source: AffiliationSource; joinedOn: string; lastPaymentOn: string | null };
  beneficiaries: SuccessionBeneficiary[];
  activeCredit: { remainingTotal: number; totalAmount: number } | null;
  today: string;
};

function monthIndex(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  return year * 12 + (month - 1);
}

/** Status the new titular starts with under the arrears rule (3 months → Suspendido, 6 → Retirado). */
function projectedStatus(base: string | null, today: string): AffiliateStatus {
  if (!base) return "active";
  const months = monthIndex(today) - monthIndex(base);
  return months >= 6 ? "suspended" : months >= 3 ? "inactive" : "active";
}

export function SuccessionForm({ action, deceased, beneficiaries, activeCredit, today }: SuccessionFormProps) {
  const [state, formAction, pending] = useActionState(action, initialSuccessionFormState);
  const [mode, setMode] = useState<SuccessorOrigin>(beneficiaries.length ? "beneficiary" : "new");
  const [beneficiaryId, setBeneficiaryId] = useState(beneficiaries[0]?.id ?? "");
  const [transfer, setTransfer] = useState<Set<string>>(() => new Set(beneficiaries.map((item) => item.id)));
  const [source, setSource] = useState<AffiliationSource>(deceased.source);
  const [creditDecision, setCreditDecision] = useState<"inherited" | "paused">("paused");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SuccessorCandidate[] | null>(null);
  const [existing, setExisting] = useState<SuccessorCandidate | null>(null);
  const [searching, startSearch] = useTransition();

  const chosenBeneficiary = beneficiaries.find((item) => item.id === beneficiaryId) ?? null;
  const transferable = beneficiaries.filter((item) => !(mode === "beneficiary" && item.id === beneficiaryId));
  const transferCount = transferable.filter((item) => transfer.has(item.id)).length;
  const createsTitular = mode !== "existing";
  const resultingStatus = projectedStatus(deceased.lastPaymentOn ?? deceased.joinedOn, today);
  const successorLabel =
    mode === "beneficiary" ? chosenBeneficiary?.name ?? "—" : mode === "existing" ? existing?.name ?? "Sin elegir" : "Persona nueva";

  function toggleTransfer(id: string) {
    setTransfer((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runSearch() {
    startSearch(async () => {
      setCandidates(await searchSuccessorCandidates(deceased.id, query));
    });
  }

  return (
    <form
      action={formAction}
      className="affiliate-form"
      onSubmit={(event) => {
        if (!window.confirm(`¿Registrar la sucesión de ${deceased.name}? Los beneficiarios y el crédito elegidos pasarán al sucesor.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="mode" value={mode} />

      {state.status !== "idle" && state.message ? (
        <div className={`form-message message-${state.status}`} role="alert">
          <Icon name={state.status === "error" ? "activity" : "lock"} size={18} />
          <span>{state.message}</span>
        </div>
      ) : null}

      <section className="form-section" aria-labelledby="successor-title">
        <div className="form-section-heading">
          <span>01</span>
          <div><h2 id="successor-title">Sucesor</h2><p>Quién queda como titular en lugar de {deceased.name}.</p></div>
        </div>
        <div className="form-section-body">
          <div className="choice-cards" role="radiogroup" aria-label="Origen del sucesor">
            {(["beneficiary", "existing", "new"] as const).map((value) => (
              <label key={value} className={`choice-card${mode === value ? " is-selected" : ""}`}>
                <input type="radio" name="modeChoice" value={value} checked={mode === value} onChange={() => setMode(value)} disabled={value === "beneficiary" && !beneficiaries.length} />
                <strong>{value === "beneficiary" ? "Un beneficiario" : value === "existing" ? "Afiliado existente" : "Persona nueva"}</strong>
                <span>
                  {value === "beneficiary"
                    ? beneficiaries.length ? "Pasa de beneficiario a titular (p. ej., cónyuge)." : "El fallecido no tiene beneficiarios vivos."
                    : value === "existing" ? "Alguien que ya es titular en Sopdisponal." : "Se registra aquí mismo como titular."}
                </span>
              </label>
            ))}
          </div>

          {mode === "beneficiary" ? (
            <div className="field-grid">
              <label className="form-field field-span-two">
                <span>Beneficiario que será titular <em>*</em></span>
                <select name="beneficiaryId" value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)} required>
                  {beneficiaries.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} · {item.relationship}{item.documentNumber ? ` · ${item.documentType ?? "CC"} ${item.documentNumber}` : " · sin documento"}</option>
                  ))}
                </select>
              </label>
              {chosenBeneficiary && !chosenBeneficiary.documentNumber ? (
                <>
                  <label className="form-field">
                    <span>Tipo de documento <em>*</em></span>
                    <select name="documentType" defaultValue="CC"><option value="CC">Cédula de ciudadanía</option><option value="CE">Cédula de extranjería</option><option value="TI">Tarjeta de identidad</option></select>
                  </label>
                  <label className="form-field">
                    <span>Número de documento <em>*</em></span>
                    <input name="documentNumber" required placeholder="Requerido para crear el titular" />
                    <small>El beneficiario no tiene documento registrado.</small>
                  </label>
                </>
              ) : null}
              <label className="form-field">
                <span>Teléfono</span>
                <input key={`phone-${beneficiaryId}`} name="phone" defaultValue={chosenBeneficiary?.phone ?? ""} placeholder="Opcional" />
              </label>
              <label className="form-field">
                <span>Correo</span>
                <input key={`email-${beneficiaryId}`} name="email" type="email" defaultValue={chosenBeneficiary?.email ?? ""} placeholder="Opcional" />
              </label>
            </div>
          ) : null}

          {mode === "existing" ? (
            <div className="successor-search">
              <input type="hidden" name="existingAffiliateId" value={existing?.id ?? ""} />
              <div className="successor-search-bar">
                <label className="filter-input-wrap">
                  <span className="sr-only">Buscar afiliado</span>
                  <Icon name="search" size={16} />
                  <input
                    type="search"
                    value={query}
                    placeholder="Nombre o número de documento (mínimo 3 caracteres)"
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        runSearch();
                      }
                    }}
                  />
                </label>
                <button type="button" className="secondary-button" onClick={runSearch} disabled={searching || query.trim().length < 3}>
                  {searching ? "Buscando…" : "Buscar"}
                </button>
              </div>
              {candidates ? (
                candidates.length ? (
                  <ul className="candidate-list">
                    {candidates.map((candidate) => (
                      <li key={candidate.id}>
                        <label className={`candidate${existing?.id === candidate.id ? " is-selected" : ""}`}>
                          <input type="radio" name="candidate" checked={existing?.id === candidate.id} onChange={() => setExisting(candidate)} />
                          <strong>{candidate.name}</strong>
                          <span>{candidate.document} · {candidate.statusLabel}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : <p className="inline-empty">No encontramos afiliados vivos con “{query}”.</p>
              ) : null}
            </div>
          ) : null}

          {mode === "new" ? (
            <div className="field-grid field-grid-three">
              <label className="form-field">
                <span>Tipo de documento <em>*</em></span>
                <select name="documentType" defaultValue="CC"><option value="CC">Cédula de ciudadanía</option><option value="CE">Cédula de extranjería</option><option value="TI">Tarjeta de identidad</option></select>
              </label>
              <label className="form-field">
                <span>Número de documento <em>*</em></span>
                <input name="documentNumber" required />
              </label>
              <label className="form-field">
                <span>Fecha de nacimiento</span>
                <input name="birthDate" type="date" max={today} />
              </label>
              <label className="form-field">
                <span>Nombres <em>*</em></span>
                <input name="firstNames" required />
              </label>
              <label className="form-field">
                <span>Apellidos <em>*</em></span>
                <input name="lastNames" required />
              </label>
              <label className="form-field">
                <span>Teléfono</span>
                <input name="phone" />
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <section className="form-section" aria-labelledby="succession-source-title">
        <div className="form-section-heading">
          <span>02</span>
          <div><h2 id="succession-source-title">Tipo de afiliación</h2><p>Se elige para el sucesor; por defecto, el del fallecido.</p></div>
        </div>
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Tipo de afiliación <em>*</em></span>
            <select name="source" value={source} onChange={(event) => setSource(event.target.value as AffiliationSource)} required>
              {affiliationSources.map((value) => <option key={value} value={value}>{sourceLabels[value]}</option>)}
            </select>
            {mode === "existing" ? <small>Reemplaza el tipo actual del afiliado elegido.</small> : null}
          </label>
        </div>
      </section>

      <section className="form-section" aria-labelledby="succession-beneficiaries-title">
        <div className="form-section-heading">
          <span>03</span>
          <div><h2 id="succession-beneficiaries-title">Beneficiarios</h2><p>Pasan al sucesor conservando su fecha de vinculación.</p></div>
        </div>
        <div className="form-section-body">
          {beneficiaries.length ? (
            <ul className="transfer-list">
              {beneficiaries.map((item) => {
                const isTitular = mode === "beneficiary" && item.id === beneficiaryId;
                return (
                  <li key={item.id}>
                    <label className={`transfer-item${isTitular ? " is-titular" : ""}`}>
                      <input
                        type="checkbox"
                        name="beneficiaryIds"
                        value={item.id}
                        checked={!isTitular && transfer.has(item.id)}
                        disabled={isTitular}
                        onChange={() => toggleTransfer(item.id)}
                      />
                      <strong>{item.name}</strong>
                      <span>{isTitular ? "Será el nuevo titular" : item.relationship}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : <p className="inline-empty">El fallecido no tiene beneficiarios vivos para transferir.</p>}
        </div>
      </section>

      <section className="form-section" aria-labelledby="succession-credit-title">
        <div className="form-section-heading">
          <span>04</span>
          <div><h2 id="succession-credit-title">Crédito</h2><p>Si no se hereda, queda en pausa hasta decidir si se hereda, condona o cancela.</p></div>
        </div>
        <div className="form-section-body">
          {activeCredit ? (
            <div className="choice-cards">
              <label className={`choice-card${creditDecision === "inherited" ? " is-selected" : ""}`}>
                <input type="radio" name="creditDecision" value="inherited" checked={creditDecision === "inherited"} onChange={() => setCreditDecision("inherited")} />
                <strong>Heredar al sucesor</strong>
                <span>Pasa con su saldo de {formatCurrency(activeCredit.remainingTotal)} y su historial de abonos.</span>
              </label>
              <label className={`choice-card${creditDecision === "paused" ? " is-selected" : ""}`}>
                <input type="radio" name="creditDecision" value="paused" checked={creditDecision === "paused"} onChange={() => setCreditDecision("paused")} />
                <strong>Dejar en pausa</strong>
                <span>Queda a nombre del fallecido; más adelante se hereda, condona o cancela.</span>
              </label>
            </div>
          ) : (
            <>
              <input type="hidden" name="creditDecision" value="paused" />
              <p className="inline-empty">El fallecido no tiene un crédito activo.</p>
            </>
          )}
        </div>
      </section>

      <section className="form-section" aria-labelledby="succession-support-title">
        <div className="form-section-heading">
          <span>05</span>
          <div><h2 id="succession-support-title">Soporte</h2><p>Datos del acto que reconoce la sucesión.</p></div>
        </div>
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Fecha de la sucesión <em>*</em></span>
            <input name="successionDate" type="date" defaultValue={today} max={today} required />
          </label>
          <label className="form-field">
            <span>N.º de resolución o acta</span>
            <input name="resolutionNumber" maxLength={80} placeholder="Opcional" />
          </label>
          <label className="form-field">
            <span>Soporte</span>
            <input type="file" name="supportFile" accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg" />
            <small>PDF, PNG o JPG, máximo 15 MB.</small>
          </label>
          <label className="form-field field-span-two">
            <span>Observaciones</span>
            <textarea name="notes" rows={3} maxLength={1000} placeholder="Opcional" />
          </label>
        </div>
      </section>

      <div className="succession-summary" aria-live="polite">
        <div><span>Sucesor</span><strong>{successorLabel}</strong></div>
        <div><span>Tipo</span><strong>{sourceLabels[source]}</strong></div>
        <div><span>Beneficiarios a transferir</span><strong>{transferCount}</strong></div>
        <div><span>Crédito</span><strong>{activeCredit ? (creditDecision === "inherited" ? "Se hereda" : "En pausa") : "No aplica"}</strong></div>
        {createsTitular ? (
          <p>
            El nuevo titular conserva la fecha de afiliación del fallecido ({formatDate(deceased.joinedOn)}) y su último pago
            ({deceased.lastPaymentOn ? formatPeriod(deceased.lastPaymentOn.slice(0, 7)) : "sin pagos"}), así que inicia como
            {" "}<strong>{statusLabels[resultingStatus]}</strong>
            {resultingStatus !== "active" ? " hasta que registre pagos." : "."}
          </p>
        ) : <p>El afiliado existente conserva su propia fecha de afiliación y sus pagos.</p>}
      </div>

      <footer className="form-footer">
        <p><strong>*</strong> Campos obligatorios</p>
        <div>
          <Link className="secondary-button" href={`/afiliados/${deceased.id}`}>Cancelar</Link>
          <button className="primary-button" type="submit" disabled={pending || (mode === "existing" && !existing)}>
            {pending ? "Registrando…" : "Registrar sucesión"}
          </button>
        </div>
      </footer>
    </form>
  );
}

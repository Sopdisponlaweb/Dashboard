import Link from "next/link";

import { Icon } from "@/components/icons";
import { formatDate } from "@/features/affiliates/format";

import { annulSuccession } from "./actions";
import { AnnulSuccessionForm } from "./annul-succession-form";
import type { AffiliateSuccessions } from "./repository";
import { creditDecisionLabels, successorOriginLabels } from "./types";

/** Calendar day in Colombia for a UTC timestamp. */
function bogotaDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(timestamp));
}

type SuccessionBannerProps = {
  affiliateId: string;
  isDeceased: boolean;
  successions: AffiliateSuccessions;
  isAdmin: boolean;
};

/** Succession status on an affiliate's record, for both the deceased and the successor. */
export function SuccessionBanner({ affiliateId, isDeceased, successions, isAdmin }: SuccessionBannerProps) {
  const { asDeceased, asSuccessor, annulled } = successions;

  return (
    <>
      {isDeceased && !asDeceased ? (
        <section className="succession-banner is-pending" aria-label="Sucesión pendiente">
          <span className="succession-icon"><Icon name="users" size={20} /></span>
          <div>
            <strong>Sucesión pendiente</strong>
            <p>Este titular falleció y aún no tiene sucesor. Sus beneficiarios siguen vinculados a él y su crédito, si existe, sigue activo.</p>
            {annulled.length ? <p className="succession-meta">{annulled.length} sucesión(es) anulada(s) anteriormente.</p> : null}
          </div>
          <Link className="primary-button" href={`/afiliados/${affiliateId}/sucesion`}>Registrar sucesión</Link>
        </section>
      ) : null}

      {asDeceased ? (
        <section className="succession-banner is-registered" aria-label="Sucesión registrada">
          <span className="succession-icon"><Icon name="users" size={20} /></span>
          <div>
            <strong>
              Sucedido por{" "}
              {asDeceased.successorId ? <Link href={`/afiliados/${asDeceased.successorId}`}>{asDeceased.successorName}</Link> : asDeceased.successorName}
            </strong>
            <p>
              {asDeceased.successorDocument} · {successorOriginLabels[asDeceased.origin]} · sucesión del {formatDate(asDeceased.successionDate)}
              {asDeceased.resolutionNumber ? ` · Resolución ${asDeceased.resolutionNumber}` : ""}
            </p>
            <ul className="succession-facts">
              <li><strong>{asDeceased.transferredBeneficiaries}</strong> beneficiario(s) transferido(s)</li>
              <li>Crédito: <strong>{creditDecisionLabels[asDeceased.creditDecision]}</strong></li>
              <li>Pagos: el sucesor ve este historial</li>
            </ul>
            <p className="succession-meta">Registrada por {asDeceased.createdByName ?? "Sistema"} el {formatDate(bogotaDate(asDeceased.createdAt))}</p>
          </div>
          <div className="succession-actions">
            <Link className="secondary-button" href={`/afiliados/${affiliateId}/sucesion/constancia`} target="_blank">
              <Icon name="file" size={15} /> Constancia PDF
            </Link>
            {asDeceased.supportDocumentId ? (
              <Link className="panel-link" href={`/afiliados/${affiliateId}/documentos/${asDeceased.supportDocumentId}`} target="_blank">Ver soporte</Link>
            ) : null}
            {isAdmin ? <AnnulSuccessionForm action={annulSuccession.bind(null, asDeceased.id, affiliateId)} deceasedName={asDeceased.deceasedName} /> : null}
          </div>
        </section>
      ) : null}

      {asSuccessor.map((succession) => (
        <section key={succession.id} className="succession-banner is-successor" aria-label="Titular por sucesión">
          <span className="succession-icon"><Icon name="heart" size={20} /></span>
          <div>
            <strong>
              Titular por sucesión de <Link href={`/afiliados/${succession.deceasedId}`}>{succession.deceasedName}</Link>
            </strong>
            <p>
              {succession.deceasedDocument}
              {succession.deceasedOn ? ` · falleció el ${formatDate(succession.deceasedOn)}` : ""} · sucesión del {formatDate(succession.successionDate)}
            </p>
            <ul className="succession-facts">
              <li><strong>{succession.transferredBeneficiaries}</strong> beneficiario(s) heredado(s)</li>
              <li>Crédito: <strong>{creditDecisionLabels[succession.creditDecision]}</strong></li>
              <li>Pagos del fallecido visibles en la pestaña Pagos</li>
            </ul>
          </div>
          <div className="succession-actions">
            <Link className="secondary-button" href={`/afiliados/${succession.deceasedId}/sucesion/constancia`} target="_blank">
              <Icon name="file" size={15} /> Constancia PDF
            </Link>
          </div>
        </section>
      ))}
    </>
  );
}

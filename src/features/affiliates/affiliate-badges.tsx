import { formatDate, getCoverageState, getWaitingPeriodProgress, statusLabels, WAITING_PERIOD_MONTHS } from "./format";
import type { AffiliateStatus } from "./types";

export function StatusBadge({ status }: { status: AffiliateStatus }) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>;
}

/** Coverage of a titular or a beneficiary: remaining waiting period (carencia) or full coverage. */
export function CoverageBadge({ status, fullCoverageOn }: { status: AffiliateStatus; fullCoverageOn: string }) {
  const coverage = getCoverageState({ status, fullCoverageOn });

  if (coverage === "waiting") {
    const { month, timeLeft, invalidDate } = getWaitingPeriodProgress(fullCoverageOn);
    if (invalidDate) {
      return (
        <span className="coverage-badge coverage-invalid" title={`La cobertura completa quedaría el ${formatDate(fullCoverageOn)}: la fecha de vinculación está en el futuro.`}>
          Revisar fecha de vinculación
        </span>
      );
    }
    return (
      <span className="coverage-badge coverage-waiting" title={`Mes ${month} de ${WAITING_PERIOD_MONTHS} de carencia · cobertura completa desde el ${formatDate(fullCoverageOn)}`}>
        Carencia · faltan {timeLeft}
      </span>
    );
  }

  if (coverage === "full") {
    return <span className="coverage-badge coverage-full">Cobertura completa</span>;
  }

  return null;
}

import { formatDate, getCoverageState, statusLabels } from "./format";
import type { AffiliateStatus } from "./types";

export function StatusBadge({ status }: { status: AffiliateStatus }) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>;
}

export function CoverageBadge({ status, fullCoverageOn }: { status: AffiliateStatus; fullCoverageOn: string }) {
  const coverage = getCoverageState({ status, fullCoverageOn });

  if (coverage === "waiting") {
    return <span className="coverage-badge coverage-waiting">En carencia · hasta {formatDate(fullCoverageOn)}</span>;
  }

  if (coverage === "full") {
    return <span className="coverage-badge coverage-full">Cobertura completa</span>;
  }

  return null;
}

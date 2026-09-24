import Link from "next/link";

import { Icon } from "@/components/icons";
import { todayInBogota } from "@/features/affiliates/format";

import { gapWindowStart } from "./gaps";
import { getPaymentGapSummary } from "./gaps-repository";

/** Dashboard block for payment continuity. Rendered inside <Suspense>: the query takes about a second. */
export async function PaymentGapsOverview() {
  const summary = await getPaymentGapSummary(`${gapWindowStart(todayInBogota())}-01`);

  const cards = [
    { label: "Titulares con huecos", value: summary.affiliates, note: `${summary.activeAffiliates.toLocaleString("es-CO")} están activos`, tone: "metric-warning", href: "/pagos/continuidad" },
    { label: "Meses sin pago", value: summary.missingMonths, note: `En ${summary.gaps.toLocaleString("es-CO")} huecos entre meses pagados`, tone: "metric-info", href: "/pagos/continuidad" },
    { label: "Huecos de un mes", value: summary.singleMonthGaps, note: "Posible mes digitado mal", tone: "metric-danger", href: "/pagos/continuidad?tipo=single" },
    { label: "Con huecos en el histórico", value: summary.allTimeAffiliates, note: "Desde el primer pago registrado", tone: "metric-info", href: "/pagos/continuidad?ventana=todo" },
  ];

  return (
    <div className="metrics-grid">
      {cards.map((card) => (
        <Link className={`metric-card metric-link ${card.tone}`} href={card.href} key={card.label}>
          <div className="metric-top">
            <span className="metric-label">{card.label}</span>
            <span className="metric-icon"><Icon name="calendar" size={18} /></span>
          </div>
          <div className="metric-value">{card.value.toLocaleString("es-CO")}</div>
          <div className="metric-note">{card.note}</div>
        </Link>
      ))}
    </div>
  );
}

export function PaymentGapsOverviewFallback() {
  return <p className="empty-hint" role="status">Calculando la continuidad de los pagos…</p>;
}

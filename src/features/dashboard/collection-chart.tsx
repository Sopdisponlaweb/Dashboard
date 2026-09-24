"use client";

import { useState } from "react";

import { formatCurrency, formatPeriod } from "@/features/affiliates/format";

import { formatCompactCurrency, type MonthlyCollection } from "./format";

const axisMonth = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" });
const axisYear = new Intl.DateTimeFormat("es-CO", { year: "2-digit", timeZone: "UTC" });

function monthTick(period: string) {
  const date = new Date(`${period}-01T00:00:00Z`);
  const month = axisMonth.format(date).replace(".", "");
  return { month: month.charAt(0).toUpperCase() + month.slice(1), year: `’${axisYear.format(date)}` };
}

/** Rounds the top of the axis up to 1, 2, 2.5 or 5 × 10ⁿ so the four gridlines land on clean values. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const raw = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= raw) ?? raw;
  return step * 4;
}

/**
 * Monthly collection as columns: closed months in the accent, the current month as a lighter,
 * partial column. The whole column is the hover/focus target; the tooltip repeats what the
 * table below the chart also lists.
 */
export function CollectionChart({ months, currentMonth, highlight }: { months: MonthlyCollection[]; currentMonth: string; highlight: string }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(...months.map((month) => month.amount)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * top);

  return (
    <figure className="cc" aria-label="Recaudo mensual de los últimos 12 meses y el mes en curso">
      <div className="cc-plot">
        <div className="cc-grid" aria-hidden="true">
          {ticks.map((tick) => (
            <div className="cc-gridline" key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>
              <span>{tick === 0 ? "$ 0" : formatCompactCurrency(tick)}</span>
            </div>
          ))}
        </div>

        <div className="cc-columns" onMouseLeave={() => setActive(null)}>
          {months.map((month, index) => {
            const height = (month.amount / top) * 100;
            const partial = month.period === currentMonth;
            const isHighlight = month.period === highlight;
            const edge = index === 0 ? " is-first" : index === months.length - 1 ? " is-last" : "";
            return (
              <button
                type="button"
                key={month.period}
                className={`cc-column${active === index ? " is-active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`${formatPeriod(month.period)}${partial ? " (en curso)" : ""}: ${formatCurrency(month.amount)}, ${month.payments.toLocaleString("es-CO")} pagos`}
              >
                <span className={`cc-bar${partial ? " is-partial" : ""}${isHighlight ? " is-highlight" : ""}`} style={{ height: `${Math.max(height, month.amount ? 1.5 : 0)}%` }} />
                {isHighlight || partial ? (
                  <span className={`cc-value${partial ? " is-partial-label" : ""}`} style={{ bottom: `calc(${height}% + 6px)` }}>
                    {partial ? "En curso" : formatCompactCurrency(month.amount)}
                  </span>
                ) : null}
                {active === index ? (
                  <span className={`cc-tooltip${edge}`} role="tooltip" style={{ bottom: `calc(${Math.min(height, 78)}% + 30px)` }}>
                    <strong>{formatCurrency(month.amount)}</strong>
                    <span className="sentence-case">{formatPeriod(month.period)}{partial ? " · en curso" : ""}</span>
                    <span>{month.payments.toLocaleString("es-CO")} pagos · {month.payers.toLocaleString("es-CO")} titulares</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="cc-axis" aria-hidden="true">
        {months.map((month) => {
          const tick = monthTick(month.period);
          return <span key={month.period}><b>{tick.month}</b>{tick.year}</span>;
        })}
      </div>
    </figure>
  );
}

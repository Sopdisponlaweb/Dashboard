import Link from "next/link";

import { Icon, type IconName } from "@/components/icons";
import { formatClearanceNumber, formatCreditReceiptNumber, formatCurrency, formatReceiptNumber, sourceLabels } from "@/features/affiliates/format";
import type { AffiliationSource } from "@/features/affiliates/types";
import { getUnreadNotificationCount } from "@/features/notifications/repository";
import { gapWindowStart } from "@/features/payments/gaps";
import { getPaymentGapSummary } from "@/features/payments/gaps-repository";

import type { ActivityEvent, DashboardInsights } from "./insights";

// ---------- Sparkline ----------

/** 12-point trend line in the de-emphasis tone; the last point carries the accent. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => [(index / (values.length - 1)) * 100, 4 + (1 - (value - min) / span) * 28]);
  const [lastX, lastY] = points[points.length - 1];
  return (
    <span className="sparkline" role="img" aria-label={label}>
      <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="sparkline-dot" style={{ left: `${lastX}%`, top: `${(lastY / 36) * 100}%` }} />
    </span>
  );
}

// ---------- Delta chip ----------

/** Signed change with an arrow; `upIsGood` decides the tone, the icon and text carry the meaning. */
export function DeltaChip({ value, suffix, upIsGood = true }: { value: number | null; suffix: string; upIsGood?: boolean }) {
  if (value === null) return <span className="delta-chip is-neutral">Sin mes anterior para comparar</span>;
  const good = value === 0 ? null : value > 0 === upIsGood;
  const tone = good === null ? "is-neutral" : good ? "is-good" : "is-bad";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return (
    <span className={`delta-chip ${tone}`}>
      <Icon name={value >= 0 ? "trendUp" : "trendDown"} size={14} />
      {sign}{Math.abs(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })} % {suffix}
    </span>
  );
}

// ---------- Estado de titulares ----------

const statusRows = [
  { key: "active", label: "Activos", note: "Al día con sus pagos" },
  { key: "inactive", label: "Suspendidos", note: "3 a 5 meses sin pagar" },
  { key: "suspended", label: "Retirados", note: "6 meses o más sin pagar" },
] as const;

/** Part-to-whole of the operational titulars; the stacked bar and the legend share the status tones. */
export function StatusComposition({ counts, deceased, pendingSuccessions }: {
  counts: { active: number; inactive: number; suspended: number };
  deceased: number;
  pendingSuccessions: number;
}) {
  const total = counts.active + counts.inactive + counts.suspended;
  const share = (value: number) => (total ? (value / total) * 100 : 0);
  const percent = (value: number) => `${share(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
  return (
    <>
      <div className="stack-bar" role="img" aria-label={statusRows.map((row) => `${row.label}: ${counts[row.key].toLocaleString("es-CO")} (${percent(counts[row.key])})`).join("; ")}>
        {statusRows.map((row) => counts[row.key] ? (
          <span key={row.key} className={`stack-segment status-${row.key}`} style={{ flexGrow: counts[row.key] }} title={`${row.label}: ${counts[row.key].toLocaleString("es-CO")}`} />
        ) : null)}
      </div>
      <ul className="stack-legend">
        {statusRows.map((row) => (
          <li key={row.key}>
            <span className={`legend-key status-${row.key}`} aria-hidden="true" />
            <span className="stack-legend-label"><strong>{row.label}</strong><small>{row.note}</small></span>
            <span className="stack-legend-value"><strong>{counts[row.key].toLocaleString("es-CO")}</strong><small>{percent(counts[row.key])}</small></span>
          </li>
        ))}
      </ul>
      <p className="panel-footnote">
        <Icon name="history" size={14} /> {deceased.toLocaleString("es-CO")} titulares fallecidos en el histórico
        {pendingSuccessions ? <> · <Link href="/afiliados?sucesion=pendiente">{pendingSuccessions.toLocaleString("es-CO")} con sucesión pendiente</Link></> : null}
      </p>
    </>
  );
}

// ---------- Tipo de afiliación ----------

/** Active titulars per affiliation type: one series, one hue, sorted, value at the bar tip. */
export function SourceBars({ distribution }: { distribution: { source: AffiliationSource; count: number }[] }) {
  const sorted = [...distribution].sort((a, b) => b.count - a.count);
  const total = sorted.reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(1, ...sorted.map((item) => item.count));
  return (
    <ul className="hbar-list">
      {sorted.map((item) => (
        <li key={item.source}>
          <Link className="hbar-label" href={`/afiliados?status=active&source=${item.source}`}>{sourceLabels[item.source]}</Link>
          <span className="hbar-track" aria-hidden="true"><span className="hbar-fill" style={{ width: `${(item.count / max) * 100}%` }} /></span>
          <span className="hbar-value"><strong>{item.count.toLocaleString("es-CO")}</strong><small>{total ? Math.round((item.count / total) * 100) : 0} %</small></span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Actividad reciente ----------

const relative = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" });

function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "hace un momento";
}

function describeActivity(event: ActivityEvent): { icon: IconName; title: string; detail: string; href: string | null } {
  const who = event.affiliateName ?? "Titular";
  const affiliateHref = (tab: string) => (event.affiliateId ? `/afiliados/${event.affiliateId}?tab=${tab}` : null);
  switch (event.kind) {
    case "payment_receipts": {
      const months = event.monthsCount ?? 1;
      return {
        icon: "wallet",
        title: "Pago registrado",
        detail: [who, `${months} ${months === 1 ? "mes" : "meses"}`, event.totalAmount !== null ? formatCurrency(event.totalAmount) : null, event.receiptNumber ? formatReceiptNumber(event.receiptNumber) : null].filter(Boolean).join(" · "),
        href: affiliateHref("pagos"),
      };
    }
    case "credit_installments":
      return { icon: "creditCard", title: "Abono a crédito", detail: [who, event.amount !== null ? formatCurrency(event.amount) : null, event.receiptNumber ? formatCreditReceiptNumber(event.receiptNumber) : null].filter(Boolean).join(" · "), href: affiliateHref("creditos") };
    case "credits":
      return { icon: "creditCard", title: "Crédito solicitado", detail: [who, event.totalAmount !== null ? `total ${formatCurrency(event.totalAmount)}` : null].filter(Boolean).join(" · "), href: affiliateHref("creditos") };
    case "credit_clearances":
      return { icon: "check", title: "Paz y salvo emitido", detail: [event.clearanceNumber ? formatClearanceNumber(event.clearanceNumber) : null, who].filter(Boolean).join(" · "), href: affiliateHref("creditos") };
    case "affiliates":
      return { icon: "users", title: "Afiliado registrado", detail: event.personName ?? who, href: affiliateHref("resumen") };
    case "beneficiaries":
      return { icon: "heart", title: "Beneficiario vinculado", detail: [event.personName, event.affiliateName ? `de ${event.affiliateName}` : null].filter(Boolean).join(" · "), href: affiliateHref("beneficiarios") };
    case "affiliate_successions":
      return { icon: "history", title: "Sucesión registrada", detail: [event.successorName ? `Sucesor: ${event.successorName}` : null, event.affiliateName ? `de ${event.affiliateName}` : null].filter(Boolean).join(" · "), href: affiliateHref("resumen") };
    case "payment_batches":
      return { icon: "upload", title: "Lote de pagos importado", detail: event.rowCount !== null ? `${event.rowCount.toLocaleString("es-CO")} pagos` : "Carga por archivo", href: "/importaciones" };
    case "member_documents":
      return { icon: "file", title: "Documento cargado", detail: [event.title, event.affiliateName].filter(Boolean).join(" · "), href: affiliateHref("documentos") };
  }
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (!events.length) return <p className="empty-hint">Aún no hay movimientos registrados desde la plataforma.</p>;
  return (
    <ol className="feed">
      {events.map((event, index) => {
        const item = describeActivity(event);
        const body = (
          <>
            <span className="feed-icon" aria-hidden="true"><Icon name={item.icon} size={16} /></span>
            <span className="feed-copy">
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </span>
            <span className="feed-meta">
              <time dateTime={event.occurredAt}>{timeAgo(event.occurredAt)}</time>
              {event.actorName ? <small>{event.actorName}</small> : null}
            </span>
          </>
        );
        return (
          <li key={`${event.kind}-${event.occurredAt}-${index}`}>
            {item.href ? <Link className="feed-item" href={item.href}>{body}</Link> : <div className="feed-item">{body}</div>}
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Requiere atención ----------

type AttentionItem = { key: string; tone: "critical" | "warning" | "info"; icon: IconName; count: number; title: string; detail: string; href?: string };

/** Everything that needs someone to act, most urgent first. Streams in: the gap check takes about a second. */
export async function AttentionPanel({ insights, pendingSuccessions, upcomingCoverage }: {
  insights: DashboardInsights;
  pendingSuccessions: number;
  upcomingCoverage: number;
}) {
  const [gaps, unread] = await Promise.all([
    getPaymentGapSummary(`${gapWindowStart(insights.today)}-01`),
    getUnreadNotificationCount(),
  ]);

  const items: AttentionItem[] = [
    { key: "risk", tone: "critical", icon: "alert", count: insights.atRiskCount, title: "En riesgo de suspensión", detail: "Titulares activos con dos meses sin pagar", href: "/afiliados?mora=riesgo" },
    { key: "gaps", tone: "warning", icon: "calendar", count: gaps.affiliates, title: "Pagos sin continuidad", detail: `${gaps.singleMonthGaps.toLocaleString("es-CO")} huecos de un mes (posible digitación) en el último año`, href: "/pagos/continuidad" },
    { key: "successions", tone: "warning", icon: "history", count: pendingSuccessions, title: "Sucesiones pendientes", detail: "Titulares fallecidos sin sucesor registrado", href: "/afiliados?sucesion=pendiente" },
    { key: "paused", tone: "warning", icon: "creditCard", count: insights.credits.pausedCount, title: "Créditos en pausa", detail: `${formatCurrency(insights.credits.pausedOutstanding)} por decidir: heredar, condonar o cancelar`, href: "/creditos?status=paused" },
    { key: "clearances", tone: "info", icon: "check", count: insights.credits.clearancesPending, title: "Paz y salvo por emitir", detail: "Créditos pagados o condonados sin certificado", href: "/reportes?reporte=creditos&pazysalvo=none" },
    { key: "coverage", tone: "info", icon: "calendar", count: upcomingCoverage, title: "Completan cobertura en 30 días", detail: "Titulares que terminan la carencia este mes", href: "/afiliados?carencia=en-carencia" },
    { key: "notifications", tone: "info", icon: "bell", count: unread, title: "Notificaciones sin leer", detail: "Avisos del sistema y comunicados internos", href: "/notificaciones" },
    { key: "data", tone: "info", icon: "activity", count: insights.invalidJoinDates + insights.futurePayments, title: "Fechas por revisar", detail: `${insights.invalidJoinDates.toLocaleString("es-CO")} fechas de afiliación futuras · ${insights.futurePayments.toLocaleString("es-CO")} pagos con periodo futuro` },
  ].filter((item) => item.count > 0) as AttentionItem[];

  if (!items.length) {
    return <p className="attention-clear"><Icon name="check" size={18} /> Todo al día: no hay pendientes que requieran acción.</p>;
  }

  return (
    <ul className="attention-list">
      {items.map((item) => {
        const body = (
          <>
            <span className={`attention-icon tone-${item.tone}`} aria-hidden="true"><Icon name={item.icon} size={17} /></span>
            <span className="attention-copy"><strong>{item.title}</strong><span>{item.detail}</span></span>
            <span className="attention-count">{item.count.toLocaleString("es-CO")}</span>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? <Link className="attention-item" href={item.href}>{body}<Icon name="arrow" size={15} /></Link> : <div className="attention-item">{body}<span /></div>}
          </li>
        );
      })}
    </ul>
  );
}

export function AttentionFallback() {
  return <p className="empty-hint" role="status">Revisando pendientes…</p>;
}

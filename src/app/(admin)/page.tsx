import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon, type IconName } from "@/components/icons";
import { demoReferenceDate, formatCurrency, formatDate, formatPeriod, sourceLabels } from "@/features/affiliates/format";
import { getDashboardSummary } from "@/features/affiliates/repository";
import { listActiveAnnouncements } from "@/features/announcements/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Metric = { label: string; value: number; note: string; tone: string; icon: IconName };

const monthLabelFormatter = new Intl.DateTimeFormat("es-CO", { month: "short", year: "2-digit", timeZone: "UTC" });
const headingDateFormatter = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("es-CO") + value.slice(1);
}

function monthLabel(period: string) {
  return capitalize(monthLabelFormatter.format(new Date(`${period}-01T00:00:00Z`)).replace(".", ""));
}

function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className={`metric-card ${metric.tone}`}>
      <div className="metric-top">
        <span className="metric-label">{metric.label}</span>
        <span className="metric-icon"><Icon name={metric.icon} size={18} /></span>
      </div>
      <div className="metric-value">{metric.value.toLocaleString("es-CO")}</div>
      <div className="metric-note">{metric.note}</div>
    </article>
  );
}

export default async function DashboardPage() {
  const persistenceEnabled = isSupabaseConfigured();
  const [summary, activeAnnouncements] = await Promise.all([
    getDashboardSummary(),
    persistenceEnabled ? listActiveAnnouncements() : Promise.resolve([]),
  ]);

  const holderMetrics: Metric[] = [
    { label: "Titulares activos", value: summary.holderStatusCounts.active, note: `${percent(summary.holderStatusCounts.active, summary.operationalTotal)} % del total operativo`, tone: "metric-success", icon: "users" },
    { label: "En carencia", value: summary.waitingCoverageCount, note: "Cobertura menor a 6 meses", tone: "metric-warning", icon: "calendar" },
    { label: "Inactivos", value: summary.holderStatusCounts.inactive, note: "3 a 5 meses en mora", tone: "metric-info", icon: "activity" },
    { label: "Suspendidos", value: summary.holderStatusCounts.suspended, note: "6 meses o más en mora", tone: "metric-danger", icon: "lock" },
  ];

  const beneficiaryMetrics: Metric[] = [
    { label: "Beneficiarios activos", value: summary.beneficiaryStatusCounts.active, note: "Vinculados a titulares vigentes", tone: "metric-success", icon: "heart" },
    { label: "Beneficiarios inactivos", value: summary.beneficiaryStatusCounts.inactive + summary.beneficiaryStatusCounts.suspended, note: "Fuera de cobertura", tone: "metric-info", icon: "users" },
    { label: "Titulares fallecidos", value: summary.holderStatusCounts.deceased, note: "Conservados en histórico", tone: "metric-danger", icon: "history" },
    { label: "Beneficiarios fallecidos", value: summary.beneficiaryStatusCounts.deceased, note: "Ocultos en la vista operativa", tone: "metric-danger", icon: "history" },
  ];

  const maxMonthlyAmount = Math.max(1, ...summary.monthlyPayments.map((entry) => entry.amount));
  const activeSourceTotal = summary.sourceDistribution.reduce((sum, entry) => sum + entry.count, 0);

  const activityItems = [
    ...summary.recentPayments.map((payment) => ({
      key: `payment-${payment.affiliateId}-${payment.period}`,
      title: "Pago aplicado",
      detail: `${payment.affiliateName} · ${formatPeriod(payment.period)} · ${formatCurrency(payment.amount)}`,
      date: payment.paidOn,
      colorVar: "var(--color-success)",
      softVar: "var(--color-success-soft)",
    })),
    ...summary.moraAlerts.map((alert) => ({
      key: `mora-${alert.affiliateId}`,
      title: alert.status === "suspended" ? "Cambió a suspendido por mora" : "Cambió a inactivo por mora",
      detail: `${alert.affiliateName} · Último pago ${formatDate(alert.lastPaymentOn)}`,
      date: alert.lastPaymentOn ?? "",
      colorVar: alert.status === "suspended" ? "var(--color-danger)" : "var(--color-warning)",
      softVar: alert.status === "suspended" ? "var(--color-danger-soft)" : "var(--color-warning-soft)",
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 4);

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">{capitalize(headingDateFormatter.format(new Date(demoReferenceDate)))}</p>
          <h1>Resumen de la operación</h1>
          <p>Indicadores de afiliación, cobertura y recaudo para tomar decisiones desde un solo lugar.</p>
        </div>
        <DataSourceBadge connected={persistenceEnabled} connectedLabel="Calculado sobre datos de Supabase local" />
      </header>

      {activeAnnouncements.length ? (
        activeAnnouncements.map((announcement) => (
          <section className="announcement" aria-label="Aviso interno" key={announcement.id}>
            <span className="announcement-icon"><Icon name="calendar" /></span>
            <div>
              <strong>{announcement.title}</strong>
              <span>{announcement.message}</span>
            </div>
            <span className="announcement-meta">Vigente hasta {formatDate(announcement.endsAt.slice(0, 10))} · <Link href="/avisos">gestionar avisos</Link></span>
          </section>
        ))
      ) : (
        <section className="announcement" aria-label="Aviso interno">
          <span className="announcement-icon"><Icon name="calendar" /></span>
          <div>
            <strong>Sin avisos vigentes</strong>
            <span>No hay comunicados internos activos en este momento.</span>
          </div>
          <span className="announcement-meta"><Link href="/avisos">gestionar avisos</Link></span>
        </section>
      )}

      <section aria-labelledby="titulares-heading">
        <div className="section-heading"><h2 id="titulares-heading">Estado de titulares</h2><span>{summary.operationalTotal.toLocaleString("es-CO")} registros operativos</span></div>
        <div className="metrics-grid">{holderMetrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
      </section>

      <section aria-labelledby="beneficiarios-heading">
        <div className="section-heading"><h2 id="beneficiarios-heading">Titulares y beneficiarios en histórico</h2><span>Los fallecidos no aparecen en vistas operativas</span></div>
        <div className="metrics-grid">{beneficiaryMetrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
      </section>

      <div className="dashboard-grid">
        <section className="panel" aria-labelledby="recaudo-heading">
          <div className="panel-header"><div><h2 id="recaudo-heading">Recaudo mensual</h2><p>Pagos aplicados durante los últimos meses con datos disponibles</p></div><span className="panel-tag">COP</span></div>
          <div className="payment-summary">
            <strong>{formatCurrency(summary.totalCollected)}</strong>
            <span>{summary.collectedChangePercent === null
              ? "Sin datos suficientes para comparar"
              : `${summary.collectedChangePercent >= 0 ? "+" : ""}${summary.collectedChangePercent} % frente al mes anterior`}</span>
          </div>
          {summary.monthlyPayments.length ? (
            <div className="bar-chart" aria-label={`Recaudo mensual calculado sobre datos ${persistenceEnabled ? "de Supabase local" : "de demostración"}`}>
              {summary.monthlyPayments.map((payment) => (
                <div className="bar-item" key={payment.period}>
                  <div className="bar-fill" style={{ height: `${Math.max(6, Math.round((payment.amount / maxMonthlyAmount) * 100))}%` }} />
                  <small>{monthLabel(payment.period)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-hint">{persistenceEnabled ? "Aún no hay pagos registrados en Supabase." : "Aún no hay pagos registrados en los datos de demostración."}</p>
          )}
        </section>

        <section id="actividad" className="panel" aria-labelledby="actividad-heading">
          <div className="panel-header"><div><h2 id="actividad-heading">Notificaciones recientes</h2><p>Cambios que requieren seguimiento</p></div><span className="panel-tag">{activityItems.length} recientes</span></div>
          {activityItems.length ? (
            <ul className="activity-list">
              {activityItems.map((activity) => (
                <li className="activity-item" key={activity.key}>
                  <span className="activity-mark" style={{ "--activity-color": activity.colorVar, "--activity-soft": activity.softVar } as React.CSSProperties} />
                  <span className="activity-copy"><strong>{activity.title}</strong><span>{activity.detail}</span></span>
                  <span className="activity-time">{formatDate(activity.date || null)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-hint">No hay actividad reciente para mostrar.</p>
          )}
        </section>
      </div>

      <div className="dashboard-lower-grid">
        <section className="panel" aria-labelledby="distribucion-heading">
          <div className="panel-header"><div><h2 id="distribucion-heading">Tipo de afiliación</h2><p>Distribución de titulares activos</p></div></div>
          <ul className="distribution-list">
            {summary.sourceDistribution.map((item) => (
              <li className="distribution-item" key={item.source}>
                <span>{sourceLabels[item.source]}</span>
                <span className="progress-track"><span className="progress-fill" style={{ width: `${percent(item.count, activeSourceTotal)}%` }} /></span>
                <strong>{item.count.toLocaleString("es-CO")}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="cobertura-heading">
          <div className="panel-header"><div><h2 id="cobertura-heading">Cobertura y accesos rápidos</h2><p>Seguimiento del periodo inicial de seis meses</p></div></div>
          <div className="coverage-callout">
            <span className="coverage-icon"><Icon name="calendar" size={19} /></span>
            <span className="coverage-copy"><strong>Afiliados próximos a cobertura completa</strong><span>{summary.upcomingCoverageCount} {summary.upcomingCoverageCount === 1 ? "persona completa" : "personas completan"} el periodo durante los próximos 30 días.</span></span>
            <span className="coverage-count">{summary.upcomingCoverageCount}</span>
          </div>
          <div className="quick-actions">
            <Link href="/consulta" className="quick-action"><Icon name="search" size={17} /> Consultar afiliado</Link>
            <Link href="/importaciones" className="quick-action"><Icon name="upload" size={17} /> Cargar pagos</Link>
            <Link href="/reportes" className="quick-action"><Icon name="file" size={17} /> Crear informe</Link>
          </div>
        </section>
      </div>
    </>
  );
}

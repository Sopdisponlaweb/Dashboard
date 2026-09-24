import Link from "next/link";
import { Suspense } from "react";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon, type IconName } from "@/components/icons";
import { formatCurrency, formatDate, formatPeriod } from "@/features/affiliates/format";
import { getDashboardSummary } from "@/features/affiliates/repository";
import { listActiveAnnouncements } from "@/features/announcements/repository";
import { CollectionChart } from "@/features/dashboard/collection-chart";
import { formatCompactCurrency, getDashboardInsights, percentChange } from "@/features/dashboard/insights";
import { ActivityFeed, AttentionFallback, AttentionPanel, DeltaChip, SourceBars, Sparkline, StatusComposition } from "@/features/dashboard/widgets";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const headingDateFormatter = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });
const updatedAtFormatter = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase("es-CO") + value.slice(1);
}

type Tile = { label: string; value: string; note: React.ReactNode; icon: IconName; tone: string; href?: string };

function KpiTile({ tile }: { tile: Tile }) {
  const body = (
    <>
      <span className="kpi-top">
        <span className="kpi-label">{tile.label}</span>
        <span className="kpi-icon" aria-hidden="true"><Icon name={tile.icon} size={17} /></span>
      </span>
      <strong className="kpi-value">{tile.value}</strong>
      <span className="kpi-note">{tile.note}</span>
    </>
  );
  return tile.href
    ? <Link className={`kpi-tile ${tile.tone}`} href={tile.href}>{body}</Link>
    : <article className={`kpi-tile ${tile.tone}`}>{body}</article>;
}

export default async function DashboardPage() {
  const persistenceEnabled = isSupabaseConfigured();
  const [summary, insights, announcements] = await Promise.all([
    getDashboardSummary(),
    getDashboardInsights(),
    persistenceEnabled ? listActiveAnnouncements() : Promise.resolve([]),
  ]);

  const now = new Date();
  const counts = summary.holderStatusCounts;
  const operational = counts.active + counts.inactive + counts.suspended;
  const beneficiariesActive = summary.beneficiaryStatusCounts.active;

  // Collection: the last closed month leads; the current one is shown as partial.
  const monthly = insights?.monthly ?? [];
  const lastClosed = monthly.find((month) => month.period === insights?.lastClosedMonth) ?? null;
  const previousClosed = monthly[monthly.findIndex((month) => month.period === insights?.lastClosedMonth) - 1] ?? null;
  const closedMonths = monthly.filter((month) => month.period !== insights?.currentMonth);
  const collectionChange = lastClosed && previousClosed ? percentChange(lastClosed.amount, previousClosed.amount) : null;
  const payersChange = lastClosed && previousClosed ? lastClosed.payers - previousClosed.payers : null;
  const paymentRate = insights && insights.activeCount ? (insights.activePaidLastMonth / insights.activeCount) * 100 : null;
  const yearAgo = closedMonths[0] ?? null;
  const payersYearChange = lastClosed && yearAgo ? percentChange(lastClosed.payers, yearAgo.payers) : null;

  const tiles: Tile[] = [
    {
      label: "Titulares activos",
      value: counts.active.toLocaleString("es-CO"),
      note: <>de {operational.toLocaleString("es-CO")} en la base operativa</>,
      icon: "users", tone: "tone-good", href: "/afiliados?status=active",
    },
    {
      label: "Beneficiarios activos",
      value: beneficiariesActive.toLocaleString("es-CO"),
      note: <>de {(beneficiariesActive + summary.beneficiaryStatusCounts.inactive + summary.beneficiaryStatusCounts.suspended).toLocaleString("es-CO")} registrados, sin fallecidos</>,
      icon: "heart", tone: "tone-info", href: "/beneficiarios?status=active",
    },
    {
      label: "En carencia",
      value: (summary.waitingCoverageCount + (insights?.beneficiariesWaiting ?? 0)).toLocaleString("es-CO"),
      note: <>{summary.waitingCoverageCount.toLocaleString("es-CO")} titulares · {(insights?.beneficiariesWaiting ?? 0).toLocaleString("es-CO")} beneficiarios</>,
      icon: "calendar", tone: "tone-warning", href: "/beneficiarios?carencia=en-carencia",
    },
    {
      label: "Cartera de créditos",
      value: insights ? formatCompactCurrency(insights.credits.outstanding + insights.credits.pausedOutstanding) : "—",
      note: insights
        ? <>{insights.credits.activeCount} {insights.credits.activeCount === 1 ? "crédito activo" : "créditos activos"}{insights.credits.pausedCount ? ` · ${insights.credits.pausedCount} en pausa` : ""}</>
        : "Disponible con Supabase",
      icon: "creditCard", tone: "tone-primary", href: "/creditos",
    },
  ];

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div>
          <p className="eyebrow">{capitalize(headingDateFormatter.format(now))}</p>
          <h1>Resumen de la operación</h1>
          <p>Afiliación, recaudo, cartera y pendientes de Sopdisponal en una sola vista.</p>
        </div>
        <div className="dash-header-side">
          <DataSourceBadge connected={persistenceEnabled} connectedLabel={`Datos al ${updatedAtFormatter.format(now)}`} />
          <div className="dash-actions">
            <Link className="secondary-button" href="/reportes"><Icon name="chart" size={15} /> Reportes</Link>
            <Link className="secondary-button" href="/importaciones"><Icon name="upload" size={15} /> Cargar pagos</Link>
            <Link className="primary-button" href="/afiliados/nuevo"><Icon name="plus" size={15} /> Nuevo afiliado</Link>
          </div>
        </div>
      </header>

      {announcements.map((announcement) => (
        <section className="dash-announcement" aria-label="Aviso interno" key={announcement.id}>
          <span className="dash-announcement-icon" aria-hidden="true"><Icon name="bell" size={17} /></span>
          <p><strong>{announcement.title}</strong> {announcement.message}</p>
          <span className="dash-announcement-meta">Hasta {formatDate(announcement.endsAt.slice(0, 10))} · <Link href="/avisos">Gestionar avisos</Link></span>
        </section>
      ))}

      <section className="kpi-row" aria-label="Indicadores principales">
        {tiles.map((tile) => <KpiTile key={tile.label} tile={tile} />)}
      </section>

      <div className="dash-grid dash-grid-main">
        <section className="dash-card dash-collection" aria-labelledby="collection-title">
          <header className="dash-card-header">
            <div>
              <h2 id="collection-title">Recaudo de aportes</h2>
              <p>Pagos aplicados por periodo · últimos 12 meses y el mes en curso</p>
            </div>
            <Link className="panel-link" href="/pagos">Ver pagos <Icon name="arrow" size={14} /></Link>
          </header>

          {lastClosed ? (
            <div className="collection-hero">
              <div className="collection-lead">
                <span className="collection-label sentence-case">{formatPeriod(lastClosed.period)} · último mes cerrado</span>
                <strong className="hero-figure">{formatCurrency(lastClosed.amount)}</strong>
                <DeltaChip value={collectionChange} suffix={previousClosed ? `frente a ${formatPeriod(previousClosed.period).split(" ")[0]}` : ""} />
              </div>
              <dl className="collection-stats">
                <div>
                  <dt>Titulares que pagaron</dt>
                  <dd>
                    <strong>{lastClosed.payers.toLocaleString("es-CO")}</strong>
                    {payersChange !== null ? <span className={payersChange < 0 ? "stat-down" : "stat-up"}>{payersChange > 0 ? "+" : payersChange < 0 ? "−" : ""}{Math.abs(payersChange).toLocaleString("es-CO")} vs. mes anterior</span> : null}
                  </dd>
                  <Sparkline values={closedMonths.map((month) => month.payers)} label={`Titulares que pagaron por mes, de ${closedMonths[0]?.payers.toLocaleString("es-CO")} a ${lastClosed.payers.toLocaleString("es-CO")}`} />
                  {payersYearChange !== null ? <small>{payersYearChange > 0 ? "+" : "−"}{Math.abs(payersYearChange).toLocaleString("es-CO")} % en 12 meses</small> : null}
                </div>
                <div>
                  <dt>Tasa de pago</dt>
                  <dd><strong>{paymentRate !== null ? `${paymentRate.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %` : "—"}</strong></dd>
                  <span className="meter" aria-hidden="true"><span style={{ width: `${Math.min(paymentRate ?? 0, 100)}%` }} /></span>
                  <small>{insights?.activePaidLastMonth.toLocaleString("es-CO")} de {insights?.activeCount.toLocaleString("es-CO")} activos pagaron {formatPeriod(lastClosed.period).split(" ")[0]}</small>
                </div>
              </dl>
            </div>
          ) : null}

          {monthly.length ? (
            <>
              <CollectionChart months={monthly} currentMonth={insights?.currentMonth ?? ""} highlight={insights?.lastClosedMonth ?? ""} />
              <p className="chart-key"><span className="chart-key-swatch is-partial" aria-hidden="true" /> Columna clara: mes en curso, todavía parcial.</p>
              <details className="chart-table">
                <summary>Ver los datos en tabla</summary>
                <div className="data-table-wrap">
                  <table className="data-table compact-table">
                    <thead><tr><th>Periodo</th><th>Recaudo</th><th>Pagos</th><th>Titulares</th></tr></thead>
                    <tbody>
                      {[...monthly].reverse().map((month) => (
                        <tr key={month.period}>
                          <td className="sentence-case">{formatPeriod(month.period)}{month.period === insights?.currentMonth ? " (en curso)" : ""}</td>
                          <td className="mono-value">{formatCurrency(month.amount)}</td>
                          <td className="mono-value">{month.payments.toLocaleString("es-CO")}</td>
                          <td className="mono-value">{month.payers.toLocaleString("es-CO")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : <p className="empty-hint">El recaudo mensual se calcula con la conexión a Supabase.</p>}
        </section>

        <section className="dash-card" aria-labelledby="attention-title">
          <header className="dash-card-header">
            <div><h2 id="attention-title">Requiere atención</h2><p>Pendientes que necesitan una acción</p></div>
          </header>
          {insights ? (
            <Suspense fallback={<AttentionFallback />}>
              <AttentionPanel insights={insights} pendingSuccessions={summary.pendingSuccessionCount ?? 0} upcomingCoverage={summary.upcomingCoverageCount} />
            </Suspense>
          ) : <p className="empty-hint">Disponible con la conexión a Supabase.</p>}
        </section>
      </div>

      <div className="dash-grid dash-grid-halves">
        <section className="dash-card" aria-labelledby="status-title">
          <header className="dash-card-header">
            <div><h2 id="status-title">Estado de los titulares</h2><p>{operational.toLocaleString("es-CO")} titulares en la base operativa, según sus pagos</p></div>
            <Link className="panel-link" href="/afiliados">Ver afiliados <Icon name="arrow" size={14} /></Link>
          </header>
          <StatusComposition counts={counts} deceased={counts.deceased} pendingSuccessions={summary.pendingSuccessionCount ?? 0} />
        </section>

        <section className="dash-card" aria-labelledby="sources-title">
          <header className="dash-card-header">
            <div><h2 id="sources-title">Titulares activos por tipo de afiliación</h2><p>{counts.active.toLocaleString("es-CO")} titulares activos</p></div>
          </header>
          <SourceBars distribution={summary.sourceDistribution} />
        </section>
      </div>

      <div className="dash-grid dash-grid-side">
        <section className="dash-card" aria-labelledby="credits-title">
          <header className="dash-card-header">
            <div><h2 id="credits-title">Cartera de créditos</h2><p>Saldo por cobrar y recaudo del mes</p></div>
            <Link className="panel-link" href="/creditos">Ver créditos <Icon name="arrow" size={14} /></Link>
          </header>
          {insights ? (
            <dl className="mini-stats">
              <div><dt>Saldo por cobrar</dt><dd>{formatCurrency(insights.credits.outstanding)}</dd><small>{insights.credits.activeCount} {insights.credits.activeCount === 1 ? "crédito activo" : "créditos activos"}</small></div>
              <div><dt>Abonado este mes</dt><dd>{formatCurrency(insights.credits.collectedThisMonth)}</dd><small><Link href="/creditos/pagos">Ver pagos de créditos</Link></small></div>
              <div><dt>En pausa</dt><dd>{formatCurrency(insights.credits.pausedOutstanding)}</dd><small>{insights.credits.pausedCount} {insights.credits.pausedCount === 1 ? "crédito" : "créditos"} por decidir</small></div>
              <div><dt>Paz y salvo por emitir</dt><dd>{insights.credits.clearancesPending.toLocaleString("es-CO")}</dd><small>Créditos pagados sin certificado</small></div>
            </dl>
          ) : <p className="empty-hint">Disponible con la conexión a Supabase.</p>}
        </section>

        <section className="dash-card" aria-labelledby="activity-title">
          <header className="dash-card-header">
            <div><h2 id="activity-title">Actividad reciente</h2><p>Últimos movimientos registrados en la plataforma</p></div>
            <Link className="panel-link" href="/auditoria">Ver auditoría <Icon name="arrow" size={14} /></Link>
          </header>
          <ActivityFeed events={(insights?.recentActivity ?? []).slice(0, 6)} />
        </section>
      </div>
    </div>
  );
}

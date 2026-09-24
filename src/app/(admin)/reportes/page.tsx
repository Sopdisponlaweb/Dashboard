import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { displayCell, isReportKey, PREVIEW_ROWS, readReportValues, reportKeys, reports, type ReportKey } from "@/features/reports/definitions";

export const metadata: Metadata = { title: "Reportes" };

/** Above this, the CSV is warned as slow (the payments history alone is ~950.000 rows). */
const LARGE_EXPORT_ROWS = 100_000;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawReport = Array.isArray(params.reporte) ? params.reporte[0] : params.reporte;
  const key: ReportKey = isReportKey(rawReport) ? rawReport : "afiliados";
  const definition = reports[key];

  const { fields, values } = await readReportValues(key, params);
  const [count, preview] = await Promise.all([definition.count(values), definition.rows(values, PREVIEW_ROWS)]);

  const query = new URLSearchParams(values).toString();
  const downloadHref = `/reportes/export/${key}${query ? `?${query}` : ""}`;
  const monthWithoutYear = Boolean(values.mes && !values.anio);
  const activeFilters = Object.keys(values).length;

  return (
    <>
      <section className="module-hero">
        <div>
          <p className="eyebrow" style={{ color: "#75d5c3" }}>Información</p>
          <h1>Reportes y exportaciones</h1>
          <p>Elige un reporte, filtra por cédula, año, mes, estado y más, revisa cuántos registros salen y descárgalos en CSV con los mismos filtros.</p>
        </div>
        <span className="module-icon"><Icon name="chart" size={38} strokeWidth={1.5} /></span>
      </section>

      <nav className="tab-bar" aria-label="Reportes disponibles">
        {reportKeys.map((reportKey) => (
          <Link
            key={reportKey}
            className={`tab-link${reportKey === key ? " is-active" : ""}`}
            href={`/reportes?reporte=${reportKey}`}
            aria-current={reportKey === key ? "page" : undefined}
          >
            <Icon name={reports[reportKey].icon} size={15} /> {reports[reportKey].title}
          </Link>
        ))}
      </nav>

      <section className="directory-panel report-panel" aria-labelledby="report-title">
        <div className="directory-panel-header">
          <div>
            <h2 id="report-title">{definition.title}</h2>
            <p>{definition.description} El año y el mes se aplican a la {definition.dateLabel}.</p>
          </div>
        </div>

        <form className="filter-bar report-filters" method="get">
          <input type="hidden" name="reporte" value={key} />
          {fields.map((field) => field.kind === "search" ? (
            <label className="filter-search" key={field.name}>
              <span>{field.label}</span>
              <span className="filter-input-wrap"><Icon name="search" size={17} /><input name={field.name} type="search" defaultValue={values[field.name] ?? ""} placeholder={field.placeholder} /></span>
            </label>
          ) : (
            <label key={field.name}>
              <span>{field.label}</span>
              <select name={field.name} defaultValue={values[field.name] ?? "all"}>
                {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
          <button className="primary-button" type="submit">Aplicar filtros</button>
          <Link className="secondary-button" href={`/reportes?reporte=${key}`}>Limpiar</Link>
        </form>

        {monthWithoutYear ? (
          <p className="form-message message-unavailable report-note" role="status"><Icon name="calendar" size={16} /><span>El mes se aplica junto con un año. Elige también el año para filtrar por mes.</span></p>
        ) : null}

        <div className="report-result">
          <div>
            <strong>{count.toLocaleString("es-CO")} {count === 1 ? "registro" : "registros"}</strong>
            <span>{activeFilters ? `con ${activeFilters} ${activeFilters === 1 ? "filtro aplicado" : "filtros aplicados"}` : "sin filtros: se descarga todo el reporte"}</span>
          </div>
          {count ? (
            <a className="primary-button" href={downloadHref} download><Icon name="file" size={15} /> Descargar CSV</a>
          ) : null}
        </div>

        {count > LARGE_EXPORT_ROWS ? (
          <p className="form-message message-unavailable report-note" role="status">
            <Icon name="activity" size={16} />
            <span>Es una descarga grande ({count.toLocaleString("es-CO")} registros): puede tardar varios minutos. Filtra por año o mes para obtenerla más rápido.</span>
          </p>
        ) : null}

        {preview.length ? (
          <>
            <p className="report-preview-title">Vista previa · primeros {Math.min(PREVIEW_ROWS, count)} de {count.toLocaleString("es-CO")}</p>
            <div className="data-table-wrap">
              <table className="data-table compact-table">
                <thead><tr>{definition.columns.map((column) => <th key={column.header}>{column.header}</th>)}</tr></thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr key={index}>
                      {definition.columns.map((column) => (
                        <td key={column.header} className={column.kind === "money" ? "mono-value" : undefined}>{displayCell(column.kind, column.value(row))}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="empty-state"><span><Icon name="chart" size={26} /></span><h3>No hay registros con estos filtros</h3><p>Prueba con otro año, mes o estado.</p><Link href={`/reportes?reporte=${key}`}>Quitar filtros</Link></div>
        )}
      </section>
    </>
  );
}

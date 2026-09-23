"use client";

import { useState } from "react";

import { toggleMunicipalityActive } from "./actions";
import type { Municipality } from "./repository";

const PAGE_SIZE_OPTIONS = [50, 100, 500] as const;

export function MunicipalityTable({ municipalities }: { municipalities: Municipality[] }) {
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const [page, setPage] = useState(1);

  const effectivePageSize = pageSize === "all" ? Math.max(municipalities.length, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(municipalities.length / effectivePageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * effectivePageSize;
  const visible = municipalities.slice(start, start + effectivePageSize);

  function handlePageSizeChange(value: string) {
    setPageSize(value === "all" ? "all" : Number(value));
    setPage(1);
  }

  if (!municipalities.length) {
    return <p className="inline-empty">No hay municipios registrados.</p>;
  }

  return (
    <>
      <div className="data-table-wrap">
        <table className="data-table compact-table">
          <thead><tr><th>Departamento</th><th>Municipio</th><th>DANE</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {visible.map((municipality) => (
              <tr key={municipality.id}>
                <td>{municipality.department}</td>
                <td><strong>{municipality.name}</strong></td>
                <td className="mono-value">{municipality.daneCode ?? "—"}</td>
                <td><span className={`payment-badge ${municipality.isActive ? "payment-paid" : "payment-reversed"}`}>{municipality.isActive ? "Activo" : "Inactivo"}</span></td>
                <td>
                  <form action={toggleMunicipalityActive.bind(null, municipality.id, !municipality.isActive)}>
                    <button className="row-action" type="submit">{municipality.isActive ? "Inactivar" : "Activar"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <label className="table-pagination-size">
          Mostrar
          <select value={pageSize} onChange={(event) => handlePageSizeChange(event.target.value)}>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
            <option value="all">Todas</option>
          </select>
        </label>
        <div className="table-pagination-controls">
          <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
            Anterior
          </button>
          <span>Página {currentPage} de {pageCount}</span>
          <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount}>
            Siguiente
          </button>
        </div>
      </div>
    </>
  );
}

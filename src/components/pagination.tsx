import Link from "next/link";

type PaginationProps = {
  page: number;
  pageSize: number;
  totalCount: number;
  basePath: string;
  searchParams: Record<string, string>;
};

export function Pagination({ page, pageSize, totalCount, basePath, searchParams }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="pagination" aria-label="Paginación">
      {hasPrevious ? (
        <Link className="secondary-button" href={hrefFor(page - 1)}>Anterior</Link>
      ) : (
        <span className="secondary-button is-disabled" aria-disabled="true">Anterior</span>
      )}
      <span className="pagination-status">Página {page} de {totalPages} · {totalCount.toLocaleString("es-CO")} registros</span>
      {hasNext ? (
        <Link className="secondary-button" href={hrefFor(page + 1)}>Siguiente</Link>
      ) : (
        <span className="secondary-button is-disabled" aria-disabled="true">Siguiente</span>
      )}
    </nav>
  );
}

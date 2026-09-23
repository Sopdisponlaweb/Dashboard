export default function AffiliatesLoading() {
  return (
    <div className="loading-stack" aria-label="Cargando afiliados" aria-live="polite">
      <span className="skeleton skeleton-heading" />
      <span className="skeleton skeleton-copy" />
      <div className="skeleton-summary">{Array.from({ length: 4 }, (_, index) => <span className="skeleton" key={index} />)}</div>
      <span className="skeleton skeleton-panel" />
    </div>
  );
}

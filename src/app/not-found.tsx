import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-content">
      <section className="module-hero">
        <div><p className="eyebrow" style={{ color: "#75d5c3" }}>404</p><h1>Este módulo no existe</h1><p>La dirección solicitada no corresponde a una sección disponible de Sopdisponal.</p><p><Link href="/">Volver al dashboard</Link></p></div>
      </section>
    </main>
  );
}

import type { Metadata } from "next";

import { Icon, type IconName } from "@/components/icons";
import { countAffiliates, countBeneficiaries, countPayments } from "@/features/affiliates/repository";

export const metadata: Metadata = { title: "Reportes" };

type ReportDefinition = {
  key: string;
  title: string;
  description: string;
  icon: IconName;
  href: string;
  count: number;
};

export default async function ReportsPage() {
  const [affiliateCount, beneficiaryCount, paymentCount] = await Promise.all([
    countAffiliates(),
    countBeneficiaries(),
    countPayments(),
  ]);

  const reports: ReportDefinition[] = [
    { key: "afiliados", title: "Afiliados", description: "Directorio completo con estado, cobertura, municipio y último pago.", icon: "users", href: "/reportes/export/afiliados", count: affiliateCount },
    { key: "beneficiarios", title: "Beneficiarios", description: "Personas vinculadas a cada titular, con parentesco, estado y cobertura.", icon: "heart", href: "/reportes/export/beneficiarios", count: beneficiaryCount },
    { key: "pagos", title: "Pagos", description: "Histórico de pagos individuales con periodo, fuente, valor y observación.", icon: "wallet", href: "/reportes/export/pagos", count: paymentCount },
  ];

  return (
    <>
      <section className="module-hero">
        <div>
          <p className="eyebrow" style={{ color: "#75d5c3" }}>Información</p>
          <h1>Reportes y exportaciones</h1>
          <p>Descarga los datos actuales en CSV. Los formatos PDF y XLSX, los permisos de exportación por rol y la auditoría de descargas quedan para cuando el sistema esté conectado a Supabase.</p>
        </div>
        <span className="module-icon"><Icon name="chart" size={38} strokeWidth={1.5} /></span>
      </section>

      <section className="module-grid" aria-label="Reportes disponibles">
        {reports.map((report, index) => (
          <article className="module-card" key={report.key}>
            <span className="module-card-index">0{index + 1}</span>
            <h2>{report.title}</h2>
            <p>{report.description}</p>
            <div className="report-card-footer">
              <span className="module-status">{report.count.toLocaleString("es-CO")} registros</span>
              <a className="secondary-button" href={report.href} download><Icon name="file" size={15} /> Descargar CSV</a>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

import type { Metadata } from "next";

import { DataSourceBadge } from "@/components/data-source-badge";
import { ImportBatchForm } from "@/features/payment-imports/import-batch-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Importaciones" };

export default function PaymentImportsPage() {
  const persistenceEnabled = isSupabaseConfigured();

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Recaudo</p>
          <h1>Importaciones de pagos</h1>
          <p>Carga archivos CSV o Excel de Activos, CASUR, TEGEN o particulares. Tú decides qué columna es cada campo y qué filas se aplican.</p>
        </div>
        <DataSourceBadge connected={persistenceEnabled} connectedLabel="Validación contra afiliados en Supabase local" disconnectedLabel="Validación sobre datos locales de demostración" />
      </header>

      <ImportBatchForm persistenceEnabled={persistenceEnabled} />
    </>
  );
}

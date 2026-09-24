import { Icon } from "@/components/icons";

type AccountStatementFormProps = {
  affiliateId: string;
  /** First and last months with payments, as YYYY-MM, to bound the pickers. */
  firstPeriod: string | null;
  lastPeriod: string | null;
};

// Plain GET form: the PDF route reads desde/hasta and opens in a new tab.
export function AccountStatementForm({ affiliateId, firstPeriod, lastPeriod }: AccountStatementFormProps) {
  return (
    <form className="statement-bar" method="get" action={`/afiliados/${affiliateId}/estado-de-cuenta`} target="_blank">
      <div className="statement-bar-copy">
        <strong>Estado de cuenta</strong>
        <span>Deja las fechas vacías para incluir todo el historial.</span>
      </div>
      <label className="form-field">
        <span>Desde</span>
        <input type="month" name="desde" min={firstPeriod ?? undefined} max={lastPeriod ?? undefined} />
      </label>
      <label className="form-field">
        <span>Hasta</span>
        <input type="month" name="hasta" min={firstPeriod ?? undefined} max={lastPeriod ?? undefined} />
      </label>
      <button className="secondary-button" type="submit">
        <Icon name="file" size={16} /> Generar PDF
      </button>
    </form>
  );
}

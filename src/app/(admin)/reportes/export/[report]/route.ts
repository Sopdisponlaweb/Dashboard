import { csvResponse, toCsv } from "@/features/reports/csv";
import { csvCell, isReportKey, readReportValues, reports } from "@/features/reports/definitions";

type RouteParams = { params: Promise<{ report: string }> };

/** CSV of a report with the same filters as the Reportes page (query string). */
export async function GET(request: Request, { params }: RouteParams) {
  const { report } = await params;
  if (!isReportKey(report)) return new Response("Reporte no encontrado.", { status: 404 });

  const definition = reports[report];
  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const { values } = await readReportValues(report, searchParams);
  const rows = await definition.rows(values);

  const csv = toCsv(
    definition.columns.map((column) => column.header),
    rows.map((row) => definition.columns.map((column) => csvCell(column.kind, column.value(row)))),
  );
  const suffix = [values.anio, values.mes].filter(Boolean).join("-");
  return csvResponse(`${report}${suffix ? `-${suffix}` : ""}.csv`, csv);
}

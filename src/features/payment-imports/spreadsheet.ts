import * as XLSX from "xlsx";

export type SpreadsheetGrid = {
  rows: string[][];
  columnCount: number;
};

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export async function parseSpreadsheetFile(file: File): Promise<SpreadsheetGrid> {
  const isCsv = /\.csv$/i.test(file.name);

  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], columnCount: 0 };

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });

  const rows = raw
    .map((row) => row.map(cellToString))
    .filter((row) => row.some((cell) => cell.length > 0));

  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const normalizedRows = rows.map((row) => {
    if (row.length >= columnCount) return row;
    return [...row, ...Array(columnCount - row.length).fill("")];
  });

  return { rows: normalizedRows, columnCount };
}

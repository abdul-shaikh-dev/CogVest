import { formatLocalCalendarDate, parseCalendarDate } from "./dates";

export const ppfCsvMaxBytes = 256 * 1024;
export const ppfCsvMaxRows = 1000;
export const ppfCsvTemplateFileName = "cogvest-ppf-v1.csv";
export const ppfCsvTemplate = "date,type,amount,note\n2025-04-02,contribution,5000,Replace these example rows\n2026-03-31,interest,350,Official credit only\n2026-04-02,withdrawal,1000,Example withdrawal\n";

export type PpfCsvRow = {
  rowNumber: number;
  date: string;
  type: "contribution" | "interest" | "withdrawal";
  amount: number;
  note: string;
};
export type PpfCsvError = { rowNumber?: number; message: string };

// Hermes does not expose TextEncoder in every supported Expo runtime.
export function ppfCsvByteLength(text: string) {
  let bytes = 0;
  for (const character of text) {
    const point = character.codePointAt(0)!;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function records(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === "," || c === "\n" || c === "\r") {
      row.push(field); field = ""; closed = false;
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        result.push(row); row = [];
      }
    } else if (c === '"' && !field && !closed) quoted = true;
    else {
      if (closed || c === '"') throw new Error("Malformed quoted CSV field.");
      field += c;
    }
  }
  if (quoted) throw new Error("Unclosed quoted CSV field.");
  if (field || closed || row.length) result.push([...row, field]);
  return result;
}

export function parsePpfCsv(text: string, now = new Date()): { rows: PpfCsvRow[]; errors: PpfCsvError[] } {
  const errors: PpfCsvError[] = [];
  const rows: PpfCsvRow[] = [];
  if (text.length > ppfCsvMaxBytes || ppfCsvByteLength(text) > ppfCsvMaxBytes) {
    return { rows, errors: [{ message: "CSV must be 256 KiB or smaller." }] };
  }
  let data: string[][];
  try { data = records(text.replace(/^\uFEFF/, "")); }
  catch { return { rows, errors: [{ message: "Invalid CSV quoting. Use the downloaded template." }] }; }
  const header = data.shift()?.map((cell) => cell.trim().toLowerCase());
  const names = ["date", "type", "amount", "note"];
  if (!header || header.length !== 4 || names.some((name) => !header.includes(name)) || new Set(header).size !== 4) {
    return { rows, errors: [{ message: "Use exactly these columns: date,type,amount,note." }] };
  }
  const activeRows = data.filter((row) => row.some((cell) => cell.trim()));
  if (!activeRows.length || activeRows.length > ppfCsvMaxRows) {
    return { rows, errors: [{ message: `Include 1 to ${ppfCsvMaxRows} transaction rows.` }] };
  }
  data.forEach((cells, index) => {
    if (!cells.some((cell) => cell.trim())) return;
    const rowNumber = index + 2;
    const fail = (message: string) => errors.push({ rowNumber, message });
    if (cells.length !== 4) { fail("Expected four columns."); return; }
    const value = (name: string) => cells[header.indexOf(name)].trim();
    const date = value("date"), type = value("type"), rawAmount = value("amount"), note = value("note");
    const amount = Number(rawAmount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseCalendarDate(date) || date > formatLocalCalendarDate(now)) fail("Use a valid non-future date in YYYY-MM-DD format.");
    if (!["contribution", "interest", "withdrawal"].includes(type)) fail("Type must be contribution, interest or withdrawal.");
    if (!/^\d+(?:\.\d{1,2})?$/.test(rawAmount) || !Number.isSafeInteger(Math.round(amount * 100)) || amount <= 0) fail("Amount must be positive INR, with at most two decimal places and no commas.");
    if (type === "contribution" && amount % 50 !== 0) fail("Contributions must be in multiples of INR 50.");
    if (note.length > 500) fail("Keep notes to 500 characters or fewer.");
    if (!errors.some((error) => error.rowNumber === rowNumber)) rows.push({ rowNumber, date, type: type as PpfCsvRow["type"], amount, note });
  });
  return { rows: errors.length ? [] : rows, errors };
}

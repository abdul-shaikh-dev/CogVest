import { formatLocalCalendarDate, parseCalendarDate } from "./dates";
import { formatINR } from "./formatters";

export const ppfCsvMaxBytes = 256 * 1024;
export const ppfCsvMaxRows = 1000;
export const ppfCsvTemplateFileName = "cogvest-ppf-v1.csv";
export const ppfCsvTemplate = "date,type,amount,balance,note\n2025-04-02,contribution,5000,15000,Replace these example rows\n2026-03-31,interest,350,15350,Official credit only\n2026-04-02,withdrawal,1000,14350,Example withdrawal\n";

export type PpfCsvRowType = "contribution" | "interest" | "withdrawal";
export type PpfCsvRow = {
  rowNumber: number;
  date: string;
  type: PpfCsvRowType;
  amount: number;
  /** The balance printed after this row, when the file has a balance column. */
  balance?: number;
  note: string;
};
export type PpfCsvError = { rowNumber?: number; column?: string; message: string };
export type PpfCsvParseResult = {
  rows: PpfCsvRow[];
  errors: PpfCsvError[];
  /** The first rows as read, when the columns couldn't be matched (#748). */
  firstRows?: string[][];
};

type Column = "date" | "type" | "amount" | "balance" | "note";

/** Header names people use for each column, compared without case or spaces. */
const columnNames: Record<Column, readonly string[]> = {
  amount: ["amount", "amt", "amountinr", "amount(inr)"],
  balance: ["balance", "closingbalance", "runningbalance", "balanceinr", "balance(inr)"],
  date: ["date", "transactiondate", "txndate", "valuedate"],
  note: ["note", "notes", "description", "narration", "remarks", "particulars"],
  type: ["type", "transactiontype", "kind"],
};
const requiredColumns: readonly Column[] = ["date", "type", "amount"];

/** Words accepted in the type column, compared without case. */
const typeWords: Record<string, PpfCsvRowType> = {
  contribution: "contribution",
  deposit: "contribution",
  subscription: "contribution",
  int: "interest",
  interest: "interest",
  "interest credit": "interest",
  "interest credited": "interest",
  "partial withdrawal": "withdrawal",
  withdrawal: "withdrawal",
};

const monthNumbers: Record<string, number> = {
  apr: 4, april: 4, aug: 8, august: 8, dec: 12, december: 12, feb: 2, february: 2,
  jan: 1, january: 1, jul: 7, july: 7, jun: 6, june: 6, mar: 3, march: 3, may: 5,
  nov: 11, november: 11, oct: 10, october: 10, sep: 9, sept: 9, september: 9,
};

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

function isoDate(year: number, month: number, day: number) {
  const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return parseCalendarDate(value) ? value : null;
}

/**
 * A statement date as YYYY-MM-DD. Accepts YYYY-MM-DD, day-first DD/MM/YYYY and
 * DD-MM-YYYY (as Indian passbooks print them; month-first is never read), and
 * DD-MMM-YYYY or DD MMM YYYY with a month name. Anything else gives null.
 */
export function parsePpfCsvDate(raw: string) {
  const value = raw.trim();
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (match) return isoDate(Number(match[3]), Number(match[2]), Number(match[1]));
  match = /^(\d{1,2})[- ]([A-Za-z]{3,9})[- ,]+(\d{4})$/.exec(value);
  if (match) {
    const month = monthNumbers[match[2].toLowerCase()];
    return month ? isoDate(Number(match[3]), month, Number(match[1])) : null;
  }
  return null;
}

/**
 * A rupee amount in paise. Accepts ₹, Rs or INR, and Indian (1,50,000.00) or
 * Western (150,000.00) digit grouping. Signs, brackets and more than two
 * decimal places give null, never a guess.
 */
export function parsePpfCsvAmount(raw: string) {
  const value = raw.trim().replace(/^(?:₹|rs\.?|inr)\s*/i, "").replace(/\s*inr$/i, "");
  const plain = /^\d+(?:\.\d{1,2})?$/;
  const indian = /^\d{1,2}(?:,\d{2})*,\d{3}(?:\.\d{1,2})?$/;
  const western = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/;
  if (!plain.test(value) && !indian.test(value) && !western.test(value)) return null;
  const [whole, fraction = ""] = value.replace(/,/g, "").split(".");
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}

function matchColumns(header: readonly string[]) {
  const columns: (Column | undefined)[] = header.map((cell) => {
    const name = cell.trim().toLowerCase().replace(/[\s_.]/g, "");
    return (Object.keys(columnNames) as Column[]).find((column) => columnNames[column].includes(name));
  });
  const errors: PpfCsvError[] = [];
  header.forEach((cell, index) => {
    if (!columns[index] && cell.trim()) errors.push({ column: cell.trim(), message: `Column "${cell.trim()}" isn't one CogVest reads. Use date, type, amount, and optionally balance and note.` });
  });
  for (const column of Object.keys(columnNames) as Column[]) {
    if (columns.filter((item) => item === column).length > 1) errors.push({ column, message: `There is more than one ${column} column.` });
  }
  for (const column of requiredColumns) {
    if (!columns.includes(column)) errors.push({ column, message: `A ${column} column is needed.` });
  }
  return { columns, errors };
}

/** Whether a header row is one the PPF import reads, for file detection (#771). */
export function isPpfCsvHeader(header: readonly string[]) {
  return matchColumns(header).errors.length === 0;
}

export function parsePpfCsv(text: string, now = new Date()): PpfCsvParseResult {
  const errors: PpfCsvError[] = [];
  const rows: PpfCsvRow[] = [];
  if (text.length > ppfCsvMaxBytes || ppfCsvByteLength(text) > ppfCsvMaxBytes) {
    return { rows, errors: [{ message: "CSV must be 256 KiB or smaller." }] };
  }
  let data: string[][];
  try { data = records(text.replace(/^﻿/, "")); }
  catch { return { rows, errors: [{ message: "Invalid CSV quoting. Use the downloaded template." }] }; }
  const firstRows = data.slice(0, 4);
  const header = data.shift();
  if (!header) return { rows, errors: [{ message: "The file is empty." }] };
  const matched = matchColumns(header);
  if (matched.errors.length) return { rows, errors: matched.errors, firstRows };
  const at = (column: Column) => matched.columns.indexOf(column);
  const activeRows = data.filter((row) => row.some((cell) => cell.trim()));
  if (!activeRows.length || activeRows.length > ppfCsvMaxRows) {
    return { rows, errors: [{ message: `Include 1 to ${ppfCsvMaxRows} transaction rows.` }] };
  }
  const today = formatLocalCalendarDate(now);
  data.forEach((cells, index) => {
    if (!cells.some((cell) => cell.trim())) return;
    const rowNumber = index + 2;
    const fail = (column: Column | undefined, message: string) => errors.push({ rowNumber, column, message });
    if (cells.length > header.length) { fail(undefined, `Expected ${header.length} columns, found ${cells.length}.`); return; }
    const value = (column: Column) => (at(column) < 0 ? "" : cells[at(column)] ?? "").trim();
    const rawDate = value("date"), rawType = value("type"), rawAmount = value("amount");
    const rawBalance = value("balance"), note = value("note");
    const date = parsePpfCsvDate(rawDate);
    if (!date) fail("date", `"${rawDate}" isn't a date CogVest reads. Use YYYY-MM-DD, DD/MM/YYYY or DD-MMM-YYYY.`);
    else if (date > today) fail("date", "The date is in the future.");
    const type = typeWords[rawType.toLowerCase().replace(/\s+/g, " ")];
    if (!type) fail("type", `"${rawType}" isn't a type CogVest reads. Use contribution, interest or withdrawal.`);
    const paise = parsePpfCsvAmount(rawAmount);
    if (paise === null || paise === 0) fail("amount", `"${rawAmount}" isn't a positive rupee amount with at most two decimal places.`);
    else if (type === "contribution" && paise % 5000 !== 0) fail("amount", "Contributions must be in multiples of ₹50.");
    const balancePaise = rawBalance ? parsePpfCsvAmount(rawBalance) : undefined;
    if (balancePaise === null) fail("balance", `"${rawBalance}" isn't a rupee balance with at most two decimal places.`);
    if (note.length > 500) fail("note", "Keep notes to 500 characters or fewer.");
    if (!errors.some((error) => error.rowNumber === rowNumber)) {
      rows.push({
        rowNumber, date: date!, type: type!, amount: paise! / 100, note,
        ...(balancePaise !== undefined && balancePaise !== null ? { balance: balancePaise / 100 } : {}),
      });
    }
  });
  if (errors.length) return { rows: [], errors };
  const chain = checkPpfCsvBalances(rows);
  return chain.errors.length ? { rows: [], errors: chain.errors } : { rows, errors };
}

/** Rows in the order they happened: by date, then as listed in the file. */
export function orderPpfCsvRows(rows: readonly PpfCsvRow[]) {
  return [...rows].sort((left, right) => (left.date < right.date ? -1 : left.date > right.date ? 1 : left.rowNumber - right.rowNumber));
}

/**
 * Checks the file's own balance column (#748): once a balance is printed, each
 * later row must reproduce it from the row before. The first printed balance
 * also gives the balance before the file starts.
 */
export function checkPpfCsvBalances(rows: readonly PpfCsvRow[]) {
  const errors: PpfCsvError[] = [];
  let running: number | undefined;
  let opening: { balance: number; before: string } | undefined;
  for (const row of orderPpfCsvRows(rows)) {
    const signed = Math.round(row.amount * 100) * (row.type === "withdrawal" ? -1 : 1);
    const printed = row.balance === undefined ? undefined : Math.round(row.balance * 100);
    if (running === undefined) {
      if (printed === undefined) continue;
      opening = { balance: (printed - signed) / 100, before: row.date };
      running = printed;
      if (printed - signed < 0) errors.push({ rowNumber: row.rowNumber, column: "balance", message: "This balance is less than the row's own amount." });
      continue;
    }
    running += signed;
    if (printed !== undefined && printed !== running) {
      errors.push({
        rowNumber: row.rowNumber, column: "balance",
        message: `The rows before give a balance of ${formatINR(running / 100)} here, but the file shows ${formatINR(printed / 100)}.`,
      });
      running = printed;
    }
  }
  return { errors, opening };
}


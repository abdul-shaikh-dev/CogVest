/**
 * Which import a statement file belongs to (#771), from its name, type and
 * first bytes. Pure: the caller reads at most a bounded head of the file.
 * Nothing is imported here; detection only chooses the review to open.
 */

import { isPpfCsvHeader } from "./ppfCsv";

export type ImportFileKind =
  | "holdingsCsv"
  | "transactionsCsv"
  | "zerodhaTradebook"
  | "ppfCsv"
  /** An encrypted PDF: CAMS + KFintech statements are password-protected. */
  | "casPdf"
  /** A readable PDF that could be a CAS statement or an EPF passbook: ask. */
  | "pdf"
  | "spreadsheet"
  | "unknown";

export type ImportFileProbe = {
  mimeType?: string | null;
  name?: string | null;
  /** The file's first bytes as Latin-1 text (one character per byte). */
  head: string;
  /** Whether the PDF declares encryption, from its trailer; only for PDFs. */
  pdfEncrypted?: boolean;
};

/** Bytes to read for detection: enough for any supported header row. */
export const importFileProbeBytes = 4096;

const spreadsheetTypes = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function extension(name: string | null | undefined) {
  return /\.([a-z0-9]+)$/iu.exec(name ?? "")?.[1]?.toLowerCase() ?? "";
}

function headerFields(head: string) {
  const text = head.replace(/^﻿|^ï»¿/u, "");
  const line = text.split(/\r?\n/u).find((item) => item.trim().length > 0) ?? "";
  return line.split(",").map((field) => field.trim().replace(/^"|"$/gu, "").trim().toLowerCase());
}

function hasAll(fields: readonly string[], required: readonly string[]) {
  return required.every((field) => fields.includes(field));
}

export function detectImportFile(probe: ImportFileProbe): ImportFileKind {
  const ext = extension(probe.name);
  const mime = (probe.mimeType ?? "").toLowerCase();

  if (probe.head.startsWith("%PDF-")) return probe.pdfEncrypted ? "casPdf" : "pdf";
  // A ZIP (xlsx) or OLE (xls) container, or a file that says it is one.
  if (probe.head.startsWith("PK\u0003\u0004") || probe.head.startsWith("ÐÏ\u0011à") ||
    spreadsheetTypes.has(mime) || ext === "xlsx" || ext === "xls") {
    return "spreadsheet";
  }
  // Text statements only: a NUL or other control byte means binary or damaged.
  if (!probe.head.trim() || /[\u0000-\u0008\u000E-\u001F]/u.test(probe.head)) return "unknown";

  const fields = headerFields(probe.head);
  if (hasAll(fields, ["cogvest_version", "quantity", "average_cost"])) return "holdingsCsv";
  if (hasAll(fields, ["cogvest_version", "transaction_type", "trade_date"])) return "transactionsCsv";
  if (hasAll(fields, ["symbol", "isin", "trade_date", "trade_type", "quantity", "price", "trade_id"])) return "zerodhaTradebook";
  // The PPF import's own column rule, which takes bank passbook names too.
  if (isPpfCsvHeader(fields)) return "ppfCsv";
  return "unknown";
}

/** Whether a PDF's last bytes declare encryption (the trailer's /Encrypt entry). */
export function pdfDeclaresEncryption(tail: string) {
  return /\/Encrypt\b/u.test(tail);
}

export const importFileKindLabels: Record<ImportFileKind, string> = {
  casPdf: "CAMS + KFintech CAS statement",
  holdingsCsv: "CogVest holdings CSV",
  pdf: "PDF statement",
  ppfCsv: "PPF statement CSV",
  spreadsheet: "Spreadsheet",
  transactionsCsv: "CogVest transactions CSV",
  unknown: "Unrecognised file",
  zerodhaTradebook: "Zerodha tradebook",
};

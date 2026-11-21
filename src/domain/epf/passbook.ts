import { decimal } from "@/src/domain/precision";

/**
 * Reads the text of one EPFO Member Passbook (one member ID, one financial
 * year) as the on-device extractor produces it: PDFBox with sortByPosition, so
 * one line per baseline and wrapped cell text on lines of its own (#740).
 *
 * The result lives only in memory for the import preview. Name, date of birth,
 * UAN and establishment are never read. The member ID is read only to chain
 * years and pair a claim with its credits; callers must not store it.
 */

export type PassbookColumns = { employee: number; employer: number; pension: number };

export type PassbookRowKind = "contribution" | "transferIn" | "transferInterest" | "claim";

export type PassbookRow = {
  /** 1-based line in the extracted text, for messages. */
  line: number;
  wageMonth: string;
  date: string;
  kind: PassbookRowKind;
  /** Old member ID cited by a transfer-in credit. */
  oldMemberId: string | null;
  amounts: PassbookColumns;
};

export type EpfoPassbook = {
  layout: "A" | "B" | null;
  memberId: string;
  /** Financial year start (1 Apr) and end (31 Mar). */
  yearStart: string;
  yearEnd: string;
  printedOn: string | null;
  /** True while the year is still open on the print date: no year-end closing yet. */
  open: boolean;
  opening: { date: string; amounts: PassbookColumns };
  rows: PassbookRow[];
  totals: { contributions: PassbookColumns; transfersIn: PassbookColumns; withdrawals: PassbookColumns };
  interest: { date: string; amounts: PassbookColumns };
  closing: { date: string; amounts: PassbookColumns };
};

export type PassbookRejection =
  | "notPassbook"
  | "multiplePages"
  | "unknownLayout"
  | "unknownRow"
  | "missingLine"
  | "doesNotAddUp";

export type PassbookReadResult =
  | { ok: true; passbook: EpfoPassbook }
  | { ok: false; reason: PassbookRejection; message: string };

const amount = String.raw`\d{1,3}(?:,\d{2})*(?:,\d{3})?|\d+`;
const columns = String.raw`(${amount}) (${amount}) (${amount})`;
const rowPattern = new RegExp(String.raw`^([A-Z][a-z]{2})-(\d{4}) (\d{2})-(\d{2})-(\d{4}) (CR|DR)\b(.*?) (${amount}) (${amount}) ${columns}$`);
const memberIdPattern = /[A-Z]{5}\d{17}/;
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const reject = (reason: PassbookRejection, message: string): PassbookReadResult => ({ ok: false, reason, message });
const rupees = (value: string) => Number(value.replace(/,/g, ""));
const cols = (match: RegExpMatchArray, from: number): PassbookColumns =>
  ({ employee: rupees(match[from]), employer: rupees(match[from + 1]), pension: rupees(match[from + 2]) });
const isoDate = (day: string, month: string, year: string) => {
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
};
const slashDate = (value: string) => {
  const [day, month, year] = value.split("/");
  return isoDate(day, month, year);
};

function columnLine(lines: readonly string[], label: RegExp) {
  for (const [index, text] of lines.entries()) {
    const match = text.match(new RegExp(String.raw`^${label.source} ${columns}$`));
    if (match) return { line: index + 1, match };
  }
  return null;
}

/** Starts of descriptions that wrap above their row; the rest of a wrap follows its row. */
const startsAbove = /^(Cont\. for the Due-Month|TRANSFER IN\b)/;

/** A row's date, type and description with its amounts on the next line. */
const rowHead = /^[A-Z][a-z]{2}-\d{4} \d{2}-\d{2}-\d{4} (CR|DR)\b.*$/;
/** That next line: amounts, optionally led by the due month (layout B) or the old member ID (a transfer-in). */
const amountsLine = new RegExp(String.raw`^(?:\S+ )?(?:${amount}) (?:${amount}) (?:${amount}) (?:${amount}) (?:${amount})$`);

/**
 * The device extractor puts a wide row's amounts on their own line below its
 * date: layout B's due month, and a transfer-in's old member ID, lead that line.
 * Join them so each entry is one line again.
 */
function joinSplitRows(lines: readonly string[]) {
  const joined: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const text = lines[index];
    const next = lines[index + 1];
    if (next !== undefined && rowHead.test(text) && !rowPattern.test(text) && amountsLine.test(next)) {
      joined.push(`${text} ${next}`);
      joined.push("");
      index += 1;
    } else joined.push(text);
  }
  return joined;
}

export function readEpfoPassbook(text: string, pageCount = 1): PassbookReadResult {
  // Joined rows leave a blank line behind, so line numbers still match the text.
  const lines = joinSplitRows(text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()));
  const yearMatch = lines.join("\n").match(/EPF Passbook \[ Financial Year - (\d{4})-(\d{4}) \]/);
  const memberMatch = lines.find((line) => /\bMember ID\/Name\b/.test(line))?.match(memberIdPattern);
  if (!yearMatch || !memberMatch) {
    return reject("notPassbook", "This is not an EPFO member passbook. Download the passbook for one member ID and year from the EPFO portal.");
  }
  if (pageCount !== 1) {
    return reject("multiplePages", "This passbook has more than one page, which CogVest can't read yet.");
  }
  const startYear = Number(yearMatch[1]);
  if (Number(yearMatch[2]) !== startYear + 1) return reject("notPassbook", "The passbook's financial year could not be read.");
  const yearStart = `${startYear}-04-01`;
  const yearEnd = `${startYear + 1}-03-31`;

  const opening = columnLine(lines, /OB Int\. Updated upto (\d{2}\/\d{2}\/\d{4})/);
  const contributions = columnLine(lines, /Total Contributions for the year \[ \d{4} \]/);
  const transfersIn = columnLine(lines, /Total Transfer-Ins\/VDRs for the year \[ \d{4} \]/);
  const withdrawals = columnLine(lines, /Total Withdrawals for the year \[ \d{4} \]/);
  const interest = columnLine(lines, /Int\. Updated upto (\d{2}\/\d{2}\/\d{4})/);
  const closing = columnLine(lines, /Closing Balance as on (\d{2}\/\d{2}\/\d{4})/);
  if (!opening || !contributions || !transfersIn || !withdrawals || !interest || !closing) {
    return reject("missingLine", "This passbook is missing its opening, totals, interest or closing line, so it can't be checked.");
  }
  const openingDate = slashDate(opening.match[1]);
  const interestDate = slashDate(interest.match[1]);
  const closingDate = slashDate(closing.match[1]);
  if (!openingDate || !interestDate || !closingDate) return reject("missingLine", "A balance line has a date that could not be read.");

  // Rows sit between the column headings and the yearly totals.
  const firstTotal = contributions.line - 1;
  const rows: PassbookRow[] = [];
  const layouts = new Set<"A" | "B">();
  let pendingAbove: string[] = [];
  let lastRow: { row: PassbookRow; text: string[] } | null = null;
  const finish = () => {
    if (!lastRow) return null;
    const { row, text } = lastRow;
    const description = text.join(" ");
    if (/^Cont\. for Due-Month \d{6}$/.test(description)) layouts.add("A");
    else if (/^Cont\. for the Due-Month \d{6}$/.test(description)) layouts.add("B");
    if (row.kind === "contribution" && !/^Cont\. for (the )?Due-Month \d{6}$/.test(description)) {
      return `Line ${row.line} is a contribution CogVest can't read: its description isn't in a known layout.`;
    }
    if (row.kind === "transferIn" || row.kind === "transferInterest") {
      row.oldMemberId = description.match(memberIdPattern)?.[0] ?? null;
      if (!row.oldMemberId) return `Line ${row.line} is a transfer-in without the old member ID.`;
    }
    lastRow = null;
    return null;
  };
  // The headings end "Type Employee Employer Pension", or the device extractor
  // puts "Employee Employer Pension" on a line of its own below "Type".
  const headings = lines.findIndex((line, index) => index < firstTotal
    && (/\bType Employee Employer Pension$/.test(line) || (line === "Employee Employer Pension" && /\bType\b/.test(lines[index - 1] ?? ""))));
  for (let index = headings + 1; index < firstTotal && headings >= 0; index += 1) {
    const text = lines[index];
    if (!text) continue;
    const match = text.match(rowPattern);
    if (!match) {
      if (startsAbove.test(text)) {
        const problem = finish();
        if (problem) return reject("unknownRow", problem);
        pendingAbove = [text];
      } else if (pendingAbove.length && !lastRow) pendingAbove.push(text);
      else if (lastRow) lastRow.text.push(text);
      else return reject("unknownRow", `Line ${index + 1} could not be read as a passbook entry.`);
      continue;
    }
    const problem = finish();
    if (problem) return reject("unknownRow", problem);
    const [, mon, wageYear, day, month, year, type, inline] = match;
    const date = isoDate(day, month, year);
    const monthIndex = months.indexOf(mon);
    if (!date || monthIndex < 0) return reject("unknownRow", `Line ${index + 1} has a date that could not be read.`);
    const description = [...pendingAbove, inline.trim()].filter(Boolean);
    const lead = description.join(" ");
    const kind: PassbookRowKind | null = type === "DR"
      ? (/^Claim$/.test(lead) ? "claim" : null)
      : /^Cont\. for/.test(lead) ? "contribution"
        : /^TRANSFER IN - SAME OFFICE\b/.test(lead) ? "transferIn"
          : /^TRANSFER IN - INTEREST AMOUNT ONLY\b/.test(lead) ? "transferInterest" : null;
    if (!kind) return reject("unknownRow", `Line ${index + 1} is a ${type} entry CogVest doesn't recognise yet, so nothing was imported.`);
    const row: PassbookRow = { line: index + 1, wageMonth: `${wageYear}-${String(monthIndex + 1).padStart(2, "0")}`, date, kind,
      oldMemberId: null, amounts: cols(match, 10) };
    rows.push(row);
    lastRow = { row, text: description };
    pendingAbove = [];
  }
  const problem = finish();
  if (problem) return reject("unknownRow", problem);
  if (headings < 0 || pendingAbove.length) return reject("unknownLayout", "This passbook's layout isn't one CogVest can read yet.");
  if (layouts.size > 1) return reject("unknownLayout", "This passbook mixes two layouts, so it can't be read safely.");

  const printed = lines.join("\n").match(/On : (\d{2})-(\d{2})-(\d{4}) \d{2}:\d{2}:\d{2}/);
  const printedOn = printed ? isoDate(printed[1], printed[2], printed[3]) : null;
  const passbook: EpfoPassbook = {
    layout: [...layouts][0] ?? null,
    memberId: memberMatch[0],
    yearStart, yearEnd, printedOn,
    open: printedOn !== null && printedOn <= yearEnd,
    opening: { date: openingDate, amounts: cols(opening.match, 2) },
    rows,
    totals: { contributions: cols(contributions.match, 1), transfersIn: cols(transfersIn.match, 1), withdrawals: cols(withdrawals.match, 1) },
    interest: { date: interestDate, amounts: cols(interest.match, 2) },
    closing: { date: closingDate, amounts: cols(closing.match, 2) },
  };
  const mismatch = reconcileEpfoPassbook(passbook);
  return mismatch ? reject("doesNotAddUp", mismatch) : { ok: true, passbook };
}

const parts = ["employee", "employer", "pension"] as const;
const label = { employee: "employee", employer: "employer", pension: "pension" } as const;

/** Every printed total must equal its rows, and the year must close exactly. */
export function reconcileEpfoPassbook(passbook: EpfoPassbook): string | null {
  const sum = (kinds: readonly PassbookRowKind[], part: (typeof parts)[number]) => passbook.rows
    .filter((row) => kinds.includes(row.kind)).reduce((total, row) => total.plus(row.amounts[part]), decimal(0));
  for (const part of parts) {
    if (!sum(["contribution"], part).equals(passbook.totals.contributions[part])) {
      return `The ${label[part]} contributions don't add up to the passbook's yearly total.`;
    }
    if (!sum(["transferIn", "transferInterest"], part).equals(passbook.totals.transfersIn[part])) {
      return `The ${label[part]} transfer-ins don't add up to the passbook's yearly total.`;
    }
    if (!sum(["claim"], part).equals(passbook.totals.withdrawals[part])) {
      return `The ${label[part]} withdrawals don't add up to the passbook's yearly total.`;
    }
    const closing = decimal(passbook.opening.amounts[part]).plus(passbook.totals.contributions[part])
      .plus(passbook.totals.transfersIn[part]).minus(passbook.totals.withdrawals[part]).plus(passbook.interest.amounts[part]);
    if (!closing.equals(passbook.closing.amounts[part])) {
      return `The ${label[part]} balance doesn't close: opening plus the year's entries isn't the closing balance.`;
    }
  }
  return null;
}

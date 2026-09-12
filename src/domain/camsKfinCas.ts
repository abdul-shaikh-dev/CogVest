import { decimal } from "./precision";

export const camsKfinCasSourceFormat = "cams-kfin-cas";
export const camsKfinCasSourceVersion = "combined-detailed-v1";

export type CasEventType =
  | "cancelled"
  | "purchase"
  | "purchaseSip"
  | "redemption"
  | "reversal"
  | "stampDuty"
  | "switchIn"
  | "switchOut"
  | "unknown";

export type CasEventDisposition =
  | "importable"
  | "preservedCharge"
  | "preservedNotice"
  | "unsupported";

export type CasStatementEvent = {
  amount?: string;
  date: string;
  disposition: CasEventDisposition;
  nav?: string;
  rowNumber: number;
  runningBalance?: string;
  type: CasEventType;
  units?: string;
};

export type CasSchemeBlock = {
  closingUnits: string;
  events: CasStatementEvent[];
  folioReference: {
    fingerprint?: string;
    label: string;
    scope: "statement";
  };
  isin: string;
  name: string;
  openingUnits: string;
  registrar: "CAMS" | "KFINTECH";
  sourceRow: number;
};

export type CasParseErrorCode =
  | "closingBalanceMismatch"
  | "invalidDate"
  | "invalidDecimal"
  | "malformedTransaction"
  | "malformedScheme"
  | "missingClosingBalance"
  | "missingOpeningBalance"
  | "missingRunningBalance"
  | "missingTransactionHeader"
  | "runningBalanceMismatch"
  | "unknownLayout"
  | "unsupportedSummary";

export type CasParseError = {
  code: CasParseErrorCode;
  detail?: CasTransactionShapeIssue;
  message: string;
  reason?: CasSchemeIdentityIssue;
  rowNumber?: number;
};

export type CasTransactionShapeIssue =
  | "incompleteColumns"
  | "extraColumns"
  | "missingColumns"
  | "missingDescription"
  | "orphanedContent"
  | "unsupportedDateFormat";

export type CasSchemeIdentityIssue =
  | "missingFolio"
  | "missingIsin"
  | "missingName"
  | "missingRegistrar";

export type CasUnsupportedEvent = {
  date: string;
  rowNumber: number;
  type: CasEventType;
};

export type CasParseResult = {
  administrativeNotices: number;
  coverage?: {
    from: string;
    to: string;
  };
  errors: CasParseError[];
  schemes: CasSchemeBlock[];
  source: {
    format: typeof camsKfinCasSourceFormat;
    version: typeof camsKfinCasSourceVersion;
  };
  status: "blocked" | "ready";
  unsupportedEvents: CasUnsupportedEvent[];
};

const dateToken = "(?:\\d{1,2}-[A-Za-z]{3}-\\d{4}|\\d{2}\\/\\d{2}\\/\\d{4})";
const integerToken = "(?:\\d+|\\d{1,3}(?:,\\d{3})+|\\d{1,2}(?:,\\d{2})*,\\d{3})";
const unsignedDecimalToken = `${integerToken}(?:\\.\\d+)?`;
const decimalToken = `(?:-?${unsignedDecimalToken}|\\(${unsignedDecimalToken}\\))`;
const transactionRowPattern = new RegExp(`^(${dateToken})\\s+(.+)$`, "u");
const transactionCandidatePattern = /^(?:\d{1,2}-[A-Za-z]{3}-\d{4}|\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/u;
const decimalPattern = new RegExp(`^${decimalToken}$`, "u");
const numericPrefixWithInvalidSuffixPattern = new RegExp(
  `^(?:-?${unsignedDecimalToken}|\\(${unsignedDecimalToken}\\))(?=[A-Za-z_])`,
  "u",
);
const openingPattern = /Opening\s+Unit\s+Balance\s*:?\s*(\S+)/iu;
const closingPattern = /Closing\s+Unit\s+Balance\s*:?\s*(\S+)/iu;
const folioPattern = /Folio\s+No\s*:\s*(\d+(?:\s*\/\s*\d+)?)/iu;
const statementPeriodPattern = new RegExp(
  `Statement\\s+Period\\s*:\\s*(${dateToken})\\s+(?:To|-)\\s+(${dateToken})`,
  "iu",
);
const isinPattern = /\b(INF[A-Z0-9]{9})\b/u;
const registrarLabelPattern = /Registrar\s*:/iu;
const registrarTokenPattern = /\b(CAMS|KFINTECH|KFIN|KARVY)\b/iu;

export function detectCamsKfinCasLayout(
  text: string,
):
  | { error: "unknownLayout" | "unsupportedSummary" }
  | { version: typeof camsKfinCasSourceVersion } {
  const normalized = text.replace(/\r\n?/gu, "\n");
  if (/Consolidated\s+Account\s+Summary/iu.test(normalized)) {
    return { error: "unsupportedSummary" as const };
  }
  const hasTitle = /Consolidated\s+Account\s+Statement/iu.test(normalized);
  const hasBalances = openingPattern.test(normalized) && closingPattern.test(normalized);
  const hasHeader = hasTransactionHeader(normalized);

  return hasTitle && hasBalances && hasHeader
    ? { version: camsKfinCasSourceVersion }
    : { error: "unknownLayout" as const };
}

export function parseCamsKfinCas(
  text: string,
  options: { folioFingerprint?: (rawFolio: string) => string | undefined } = {},
): CasParseResult {
  const source = {
    format: camsKfinCasSourceFormat,
    version: camsKfinCasSourceVersion,
  } as const;
  const layout = detectCamsKfinCasLayout(text);
  if ("error" in layout) {
    return {
      errors: [
        {
          code: layout.error,
          message:
            layout.error === "unsupportedSummary"
              ? "Choose a detailed CAMS + KFintech statement with transaction history."
              : "This is not a recognized detailed CAMS + KFintech statement layout.",
        },
      ],
      schemes: [],
      administrativeNotices: 0,
      source,
      status: "blocked",
      unsupportedEvents: [],
    };
  }

  const lines = text
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/gu, " ").trim());
  const periodMatch = statementPeriodPattern.exec(text);
  const periodFrom = periodMatch ? parseCasDate(periodMatch[1]) : undefined;
  const periodTo = periodMatch ? parseCasDate(periodMatch[2]) : undefined;
  const coverage = periodFrom && periodTo
    ? { from: periodFrom, to: periodTo }
    : undefined;
  const errors: CasParseError[] = [];
  const schemes: CasSchemeBlock[] = [];
  const unsupportedEvents: CasUnsupportedEvent[] = [];
  let administrativeNotices = 0;
  const consumedClosingRows = new Set<number>();
  const pageBoilerplateRows = findPageBoilerplateRows(lines);
  const folioFingerprintOwners = new Map<string, string>();
  let headerStart = 0;
  // Raw folios exist only during this parse and become statement-local labels.
  const folioReferences = new Map<string, string>();

  for (let index = 0; index < lines.length; index += 1) {
    const opening = openingPattern.exec(lines[index]);
    if (!opening) continue;

    const closingIndex = findNextLine(lines, index + 1, closingPattern);
    const nextOpeningIndex = findNextLine(lines, index + 1, openingPattern);
    if (
      closingIndex === -1 ||
      (nextOpeningIndex !== -1 && nextOpeningIndex < closingIndex)
    ) {
      errors.push({
        code: "missingClosingBalance",
        message: "A scheme block has no closing unit balance.",
        rowNumber: index + 1,
      });
      break;
    }
    consumedClosingRows.add(closingIndex);

    const headerLines = lines.slice(headerStart, index).filter(Boolean);
    const headerResult = parseSchemeHeader(headerLines);
    const openingUnits = parseCasDecimal(opening[1]);
    const closingMatch = closingPattern.exec(lines[closingIndex]);
    const closingUnits = closingMatch ? parseCasDecimal(closingMatch[1]) : undefined;
    if (!headerResult.header || !openingUnits || !closingUnits) {
      errors.push({
        code:
          openingUnits && closingUnits ? "malformedScheme" : "invalidDecimal",
        message: openingUnits && closingUnits
          ? "A scheme header is missing a valid folio, name, ISIN, or registrar."
          : "A scheme opening or closing balance is not a valid decimal value.",
        ...(openingUnits && closingUnits && headerResult.issue
          ? { reason: headerResult.issue }
          : {}),
        rowNumber: index + 1,
      });
      headerStart = closingIndex + 1;
      index = closingIndex;
      continue;
    }

    const header = headerResult.header;
    let folioLabel = folioReferences.get(header.rawFolio);
    if (!folioLabel) {
      folioLabel = `Folio ${folioReferences.size + 1}`;
      folioReferences.set(header.rawFolio, folioLabel);
    }
    const rawFingerprint = options.folioFingerprint?.(header.rawFolio)?.trim();
    const fingerprintOwner = rawFingerprint
      ? folioFingerprintOwners.get(rawFingerprint)
      : undefined;
    const folioFingerprint = rawFingerprint &&
      isOpaqueFolioFingerprint(rawFingerprint, header.rawFolio) &&
      (!fingerprintOwner || fingerprintOwner === header.rawFolio)
      ? rawFingerprint
      : undefined;
    if (folioFingerprint) {
      folioFingerprintOwners.set(folioFingerprint, header.rawFolio);
    }
    const events: CasStatementEvent[] = [];
    const schemeRegion = lines.slice(index + 1, closingIndex);
    const firstTransactionOffset = schemeRegion.findIndex((line) =>
      transactionCandidatePattern.test(line)
    );
    const schemeHeaderLines = firstTransactionOffset >= 0
      ? schemeRegion.slice(0, firstTransactionOffset)
      : schemeRegion;
    const localHeaderCandidate = schemeHeaderLines.some(isTransactionHeaderFragment);
    const pageStart = findPageStart(lines, index);
    const firstPageOpening = findNextLine(lines, pageStart, openingPattern);
    const sharedPageHeader = firstPageOpening >= 0 && firstPageOpening <= index
      ? hasTransactionHeaderBlock(lines.slice(pageStart, firstPageOpening))
      : false;
    if (localHeaderCandidate
      ? !hasTransactionHeaderBlock(schemeHeaderLines)
      : !hasTransactionHeaderBlock(schemeHeaderLines) && !sharedPageHeader) {
      errors.push({
        code: "missingTransactionHeader",
        message: "A scheme block has no recognized detailed transaction table header.",
        rowNumber: index + 1,
      });
    }
    const transactionStart = firstTransactionOffset >= 0
      ? index + 1 + firstTransactionOffset
      : closingIndex;
    for (let rowIndex = index + 1; rowIndex < transactionStart; rowIndex += 1) {
      if (!lines[rowIndex] || pageBoilerplateRows.has(rowIndex) || isTransactionHeaderFragment(lines[rowIndex])) {
        continue;
      }
      if (isAdministrativeRow(lines[rowIndex])) {
        administrativeNotices += 1;
        continue;
      }
      if (transactionStart === closingIndex && openingUnits === closingUnits &&
          isNoTransactionsNotice(lines[rowIndex])) {
        continue;
      }
      errors.push({
        code: "malformedTransaction",
        detail: "orphanedContent",
        message: "A transaction region contains detached content that cannot be proven.",
        rowNumber: rowIndex + 1,
      });
    }
    for (let rowIndex = transactionStart; rowIndex < closingIndex; rowIndex += 1) {
      if (pageBoilerplateRows.has(rowIndex)) continue;
      if (isAdministrativeRow(lines[rowIndex])) {
        administrativeNotices += 1;
        continue;
      }
      if (isTransactionHeaderFragment(lines[rowIndex])) continue;
      if (!transactionCandidatePattern.test(lines[rowIndex])) {
        errors.push({
          code: "malformedTransaction",
          detail: "orphanedContent",
          message: "A transaction region contains detached content that cannot be proven.",
          rowNumber: rowIndex + 1,
        });
        continue;
      }
      const rowErrors: CasParseError[] = [];
      let event = parseTransactionLine(lines[rowIndex], rowIndex + 1, rowErrors);
      if (
        !event &&
        rowErrors.length === 1 &&
        rowErrors[0].detail === "missingColumns"
      ) {
        let combinedLine = lines[rowIndex];
        for (let offset = 1; offset <= 3 && rowIndex + offset < closingIndex; offset += 1) {
          const continuation = lines[rowIndex + offset];
          if (
            transactionCandidatePattern.test(continuation) ||
            pageBoilerplateRows.has(rowIndex + offset) ||
            isAdministrativeRow(continuation) ||
            isTransactionHeaderFragment(continuation)
          ) break;
          combinedLine = `${combinedLine} ${continuation}`;
          const wrappedErrors: CasParseError[] = [];
          const wrappedEvent = parseTransactionLine(
            combinedLine,
            rowIndex + 1,
            wrappedErrors,
          );
          if (wrappedEvent && wrappedErrors.length === 0) {
            event = wrappedEvent;
            rowIndex += offset;
            break;
          }
        }
      }
      if (
        !event &&
        rowErrors.length === 1 &&
        rowErrors[0].detail === "missingColumns"
      ) {
        const dateMatch = transactionRowPattern.exec(lines[rowIndex]);
        const date = dateMatch ? parseCasDate(dateMatch[1]) : undefined;
        const classification = classifyEvent(dateMatch?.[2] ?? "", undefined, false);
        if (
          date &&
          classification.disposition === "preservedNotice" &&
          classification.type === "cancelled"
        ) {
          event = {
            date,
            disposition: classification.disposition,
            rowNumber: rowIndex + 1,
            type: classification.type,
          };
          rowErrors.length = 0;
        }
      }
      if (!event) errors.push(...rowErrors);
      if (!event) continue;
      events.push(event);
      if (event.disposition === "unsupported") {
        unsupportedEvents.push({
          date: event.date,
          rowNumber: event.rowNumber,
          type: event.type,
        });
      }
    }

    const scheme: CasSchemeBlock = {
      closingUnits,
      events,
      folioReference: {
        ...(folioFingerprint ? { fingerprint: folioFingerprint } : {}),
        label: folioLabel,
        scope: "statement",
      },
      isin: header.isin,
      name: header.name,
      openingUnits,
      registrar: header.registrar,
      sourceRow: index + 1,
    };
    reconcileScheme(scheme, errors);
    schemes.push(scheme);
    headerStart = closingIndex + 1;
    index = closingIndex;
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (closingPattern.test(lines[index]) && !consumedClosingRows.has(index)) {
      errors.push({
        code: "missingOpeningBalance",
        message: "A scheme closing balance has no matching opening balance.",
        rowNumber: index + 1,
      });
    }
  }

  if (schemes.length === 0 && errors.length === 0) {
    errors.push({
      code: "unknownLayout",
      message: "No supported scheme blocks were found in this statement.",
    });
  }

  return {
    administrativeNotices,
    ...(coverage ? { coverage } : {}),
    errors,
    schemes,
    source,
    status: errors.length === 0 && unsupportedEvents.length === 0 ? "ready" : "blocked",
    unsupportedEvents,
  };
}

export async function parseCamsKfinCasWithFolioFingerprint(
  text: string,
  fingerprint: (rawFolio: string) => Promise<string | undefined>,
): Promise<CasParseResult> {
  const rawFolios = new Set<string>();
  const globalFolioPattern = new RegExp(folioPattern.source, "giu");
  for (const match of text.matchAll(globalFolioPattern)) {
    const rawFolio = match[1]?.replace(/\s+/gu, "");
    if (rawFolio) rawFolios.add(rawFolio);
  }

  const fingerprints = new Map<string, string | undefined>();
  for (const rawFolio of rawFolios) {
    fingerprints.set(rawFolio, await fingerprint(rawFolio));
  }

  return parseCamsKfinCas(text, {
    folioFingerprint: (rawFolio) => fingerprints.get(rawFolio),
  });
}

function parseSchemeHeader(lines: string[]) {
  const relevant = lines.slice(-18);
  const joined = relevant.join(" ");
  const rawFolio = folioPattern.exec(joined)?.[1]?.replace(/\s+/gu, "");
  const isin = isinPattern.exec(joined)?.[1];
  const registrarLabelIndex = joined.search(registrarLabelPattern);
  const registrarField = registrarLabelIndex >= 0
    ? joined.slice(registrarLabelIndex)
    : "";
  const rawRegistrar = registrarField
    ? registrarTokenPattern.exec(registrarField)?.[1]?.toUpperCase()
    : undefined;
  const explicitRegistrar =
    rawRegistrar === "CAMS"
      ? "CAMS"
      : rawRegistrar === "KFINTECH" || rawRegistrar === "KFIN" || rawRegistrar === "KARVY"
        ? "KFINTECH"
        : undefined;
  const registrar = explicitRegistrar;
  const isinLineIndex = relevant.findIndex((line) => isinPattern.test(line));
  const isinLine = isinLineIndex >= 0 ? relevant[isinLineIndex] : "";
  const inlineName = isinLine
    .replace(/\s*-?\s*ISIN\s*:.*/iu, "")
    .replace(/^[A-Z0-9]+\s*-\s*/u, "")
    .trim();
  const previousName = isinLineIndex > 0 ? relevant[isinLineIndex - 1] : "";
  const name = inlineName || previousName;
  if (!rawFolio) return { issue: "missingFolio" as const };
  if (!isin) return { issue: "missingIsin" as const };
  if (!registrar) return { issue: "missingRegistrar" as const };
  if (!name || /Folio\s+No|PAN\s*:/iu.test(name)) {
    return { issue: "missingName" as const };
  }
  return { header: { isin, name, rawFolio, registrar } as const };
}

function parseTransactionLine(
  line: string,
  rowNumber: number,
  errors: CasParseError[],
): CasStatementEvent | undefined {
  const match = transactionRowPattern.exec(line);
  if (!match) {
    if (transactionCandidatePattern.test(line)) {
      errors.push({
        code: "malformedTransaction",
        detail: "unsupportedDateFormat",
        message: "A date-leading transaction row does not match the supported columns.",
        rowNumber,
      });
    }
    return undefined;
  }
  const date = parseCasDate(match[1]);
  if (!date) {
    errors.push({
      code: "invalidDate",
      message: "A transaction uses an unsupported or invalid date.",
      rowNumber,
    });
    return undefined;
  }

  const parts = match[2].split(" ");
  const numericTokens: string[] = [];
  while (parts.length > 0 && decimalPattern.test(parts[parts.length - 1])) {
    numericTokens.unshift(parts.pop()!);
  }
  if (parts.some(isMalformedNumericLikeToken)) {
    errors.push({
      code: "invalidDecimal",
      message: "A transaction contains malformed numeric syntax.",
      rowNumber,
    });
    return undefined;
  }
  const values = numericTokens;
  if (values.length === 5 && values[0] === "(1)" &&
      /systematic\s+investment(?:\s+existing\s+folio\s+with\s+sip)?$/iu.test(parts.join(" "))) {
    values.shift();
  }
  if (values.length === 3) {
    errors.push({
      code: "missingRunningBalance",
      message: "A unit-changing transaction has no running unit balance.",
      rowNumber,
    });
    return undefined;
  }
  if ((values.length !== 1 && values.length !== 4) || parts.length === 0) {
    errors.push({
      code: "malformedTransaction",
      detail: parts.length === 0
        ? "missingDescription"
        : values.length > 4
          ? "extraColumns"
        : values.length === 0
          ? "missingColumns"
          : "incompleteColumns",
      message: "A transaction row has an unsupported or incomplete column shape.",
      rowNumber,
    });
    return undefined;
  }
  const [amountToken, unitsToken, navToken, balanceToken] = values;
  const amount = parseCasDecimal(amountToken);
  const units = unitsToken ? parseCasDecimal(unitsToken) : undefined;
  const nav = navToken ? parseCasDecimal(navToken) : undefined;
  const runningBalance = balanceToken ? parseCasDecimal(balanceToken) : undefined;
  if (!amount || (unitsToken && !units) || (navToken && !nav) || (balanceToken && !runningBalance)) {
    errors.push({
      code: "invalidDecimal",
      message: "A transaction contains an invalid decimal value.",
      rowNumber,
    });
    return undefined;
  }

  const classification = classifyEvent(parts.join(" "), units, true);
  return {
    amount,
    date,
    disposition: classification.disposition,
    ...(nav ? { nav } : {}),
    rowNumber,
    ...(runningBalance ? { runningBalance } : {}),
    type: classification.type,
    ...(units ? { units } : {}),
  } satisfies CasStatementEvent;
}

function classifyEvent(
  description: string,
  units?: string,
  hasFinancialColumns = false,
): Pick<CasStatementEvent, "disposition" | "type"> {
  const normalized = description.toLowerCase();
  if (/^\*{3}\s*cancelled\s*\*{3}$/u.test(normalized)) {
    return hasFinancialColumns
      ? { disposition: "unsupported", type: "cancelled" }
      : { disposition: "preservedNotice", type: "cancelled" };
  }
  if (!units) {
    return /stamp\s+duty/u.test(normalized)
      ? { disposition: "preservedCharge", type: "stampDuty" }
      : { disposition: "unsupported", type: "unknown" };
  }

  const signedUnits = decimal(units);
  if (/reversal|rejection|dishonou?red|payment\s+not\s+received/u.test(normalized)) {
    return { disposition: "unsupported", type: "reversal" };
  }
  if (/switch|systematic\s+transfer|\bs\s*t\s*p\b/u.test(normalized)) {
    return {
      disposition: "unsupported",
      type: signedUnits.isNegative() ? "switchOut" : "switchIn",
    };
  }
  if (signedUnits.isNegative()) {
    return { disposition: "unsupported", type: "redemption" };
  }
  if (/\bsip\b|\bsys\.?\s*investment\b|systematic\s+investment|instal+ment/u.test(normalized)) {
    return { disposition: "importable", type: "purchaseSip" };
  }
  if (/purchase/u.test(normalized)) {
    return { disposition: "importable", type: "purchase" };
  }
  return { disposition: "unsupported", type: "unknown" };
}

function reconcileScheme(scheme: CasSchemeBlock, errors: CasParseError[]) {
  const tolerance = decimal("0.0000001");
  let running = decimal(scheme.openingUnits);
  for (const event of scheme.events) {
    if (!event.units) continue;
    running = running.plus(event.units);
    if (!event.runningBalance) {
      errors.push({
        code: "missingRunningBalance",
        message: "A unit-changing transaction has no running unit balance.",
        rowNumber: event.rowNumber,
      });
      continue;
    }
    if (running.minus(event.runningBalance).abs().greaterThan(tolerance)) {
      errors.push({
        code: "runningBalanceMismatch",
        message: "A transaction does not reconcile to its printed running unit balance.",
        rowNumber: event.rowNumber,
      });
      running = decimal(event.runningBalance);
    }
  }
  if (running.minus(scheme.closingUnits).abs().greaterThan(tolerance)) {
    errors.push({
      code: "closingBalanceMismatch",
      message: "Parsed transactions do not reconcile to the printed closing unit balance.",
      rowNumber: scheme.sourceRow,
    });
  }
}

function parseCasDecimal(value: string) {
  const trimmed = value.trim();
  const parenthesized = trimmed.startsWith("(") && trimmed.endsWith(")");
  const negative = parenthesized || trimmed.startsWith("-");
  const rawUnsigned = parenthesized
    ? trimmed.slice(1, -1)
    : negative
      ? trimmed.slice(1)
      : trimmed;
  const unsignedPattern = new RegExp(`^${unsignedDecimalToken}$`, "u");
  if (!unsignedPattern.test(rawUnsigned)) return undefined;
  const unsigned = rawUnsigned.replace(/,/gu, "");
  try {
    const parsed = decimal(unsigned);
    return (negative ? parsed.negated() : parsed).toFixed();
  } catch {
    return undefined;
  }
}

function isOpaqueFolioFingerprint(fingerprint: string, rawFolio: string) {
  const rawIdentity = rawFolio.replace(/[^A-Za-z0-9]/gu, "").toLowerCase();
  const fingerprintIdentity = fingerprint
    .replace(/[^A-Za-z0-9]/gu, "")
    .toLowerCase();
  return /^folio_[a-z0-9_-]{24,128}$/u.test(fingerprint) &&
    !fingerprintIdentity.includes(rawIdentity);
}

function isMalformedNumericLikeToken(token: string) {
  const malformedNumericPunctuation = /\d/u.test(token) &&
    /[(),.-]/u.test(token) &&
    /^[\d(),.-]+$/u.test(token);
  const numericWithInvalidSuffix = numericPrefixWithInvalidSuffixPattern.test(token);

  return (malformedNumericPunctuation || numericWithInvalidSuffix) &&
    !decimalPattern.test(token);
}

function hasTransactionHeader(text: string) {
  return /\bDate\b/iu.test(text) &&
    /\bTransaction\b/iu.test(text) &&
    /\bAmount\b/iu.test(text) &&
    /\bUnits\b/iu.test(text) &&
    /(?:\bNAV\b|\bPrice\b)/iu.test(text) &&
    /(?:Unit\s+Balance|\bBalance\b)/iu.test(text);
}

function isTransactionHeaderFragment(line: string) {
  if (!/(?:\bDate\b|\bTransaction\b|\bAmount\b|\bUnits\b|\bPrice\b|\bNAV\b|\bBalance\b)/iu.test(line)) {
    return false;
  }
  return line
    .replace(/\b(?:Date|Transaction|Amount|Units|Price|NAV|Unit|Balance|INR)\b/giu, "")
    .replace(/[()\s/|-]/gu, "") === "";
}

function hasTransactionHeaderBlock(lines: string[]) {
  for (let start = 0; start < lines.length; start += 1) {
    if (!isTransactionHeaderFragment(lines[start])) continue;
    let text = "";
    for (let index = start; index < lines.length && isTransactionHeaderFragment(lines[index]); index += 1) {
      text = `${text} ${lines[index]}`;
      if (hasTransactionHeader(text)) return true;
    }
  }
  return false;
}

function isAdministrativeRow(line: string) {
  return new RegExp(`^${dateToken}\\s+\\*{3}Address Updated from KRA Data\\*{3}$`, "iu").test(line);
}

function isNoTransactionsNotice(line: string) {
  return /^\*{3}\s*No transactions during this statement period\s*\*{3}$/iu.test(line);
}

function findPageStart(lines: string[], before: number) {
  for (let index = before - 1; index >= 0; index -= 1) {
    if (/^Page\s+\d+\s+of\s+\d+$/iu.test(lines[index])) return index;
  }
  return 0;
}

function findPageBoilerplateRows(lines: string[]) {
  const rows = new Set<number>();
  for (let index = 0; index < lines.length - 2; index += 1) {
    if (!/^Page\s+\d+\s+of\s+\d+$/iu.test(lines[index]) ||
        !/^CAMSCASWS-\S+\s+Version:\S+(?:\s+\S+)?$/iu.test(lines[index + 1]) ||
        !/^Consolidated Account Statement$/iu.test(lines[index + 2])) continue;
    rows.add(index);
    rows.add(index + 1);
    rows.add(index + 2);
    let cursor = index + 3;
    if (new RegExp(`^${dateToken}\\s+(?:To|-)\\s+${dateToken}$`, "iu").test(lines[cursor] ?? "")) {
      rows.add(cursor++);
    }
    while (cursor < lines.length && isTransactionHeaderFragment(lines[cursor])) {
      rows.add(cursor++);
    }
  }
  return rows;
}

function parseCasDate(value: string) {
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(value);
  if (slash) return validIsoDate(slash[3], slash[2], slash[1]);
  const named = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/u.exec(value);
  if (!named) return undefined;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(
    named[2].toLowerCase(),
  ) + 1;
  return month > 0 ? validIsoDate(named[3], String(month).padStart(2, "0"), named[1]) : undefined;
}

function validIsoDate(year: string, month: string, day: string) {
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
    ? iso
    : undefined;
}

function findNextLine(lines: string[], start: number, pattern: RegExp) {
  for (let index = start; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) return index;
  }
  return -1;
}

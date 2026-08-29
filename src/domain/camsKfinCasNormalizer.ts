import { decimal, normalizeQuantity, normalizeUnitPrice } from "./precision";
import {
  getTransactionCsvFingerprint,
  type TransactionCsvCandidate,
  type UnsupportedTransactionCsvEvent,
} from "./transactionCsv";
import {
  camsKfinCasSourceFormat,
  camsKfinCasSourceVersion,
  type CasParseError,
  type CasParseResult,
  type CasSchemeBlock,
  type CasStatementEvent,
} from "./camsKfinCas";

export type CasNormalizationError = {
  code: "invalidEventValue" | "missingFolioFingerprint";
  message: string;
  rowNumber: number;
};

export type CasPreservedCharge = {
  amount: string;
  date: string;
  folioLabel: string;
  rowNumber: number;
  type: "stampDuty";
};

export type CasSchemeReview = {
  closingUnits: string;
  events: Array<Pick<
    CasStatementEvent,
    | "amount"
    | "date"
    | "disposition"
    | "nav"
    | "rowNumber"
    | "runningBalance"
    | "type"
    | "units"
  >>;
  folioLabel: string;
  importableTransactions: number;
  isin: string;
  name: string;
  openingUnits: string;
  registrar: CasSchemeBlock["registrar"];
};

export type CamsKfinCasNormalizationResult = {
  coverage?: CasParseResult["coverage"];
  errors: CasNormalizationError[];
  parserErrors: CasParseError[];
  preservedCharges: CasPreservedCharge[];
  rows: TransactionCsvCandidate[];
  schemes: CasSchemeReview[];
  unsupportedEvents: UnsupportedTransactionCsvEvent[];
};

function exactPositiveNumber(
  value: string,
  normalize: (number: number) => number,
) {
  const exact = decimal(value);
  const converted = exact.toNumber();
  const normalized = Number.isFinite(converted) ? normalize(converted) : NaN;
  return Number.isFinite(converted) &&
    converted > 0 &&
    Number.isFinite(normalized) &&
    normalized > 0 &&
    decimal(converted).equals(exact) &&
    decimal(normalized).equals(exact)
    ? normalized
    : undefined;
}

function descriptionFor(event: CasStatementEvent) {
  return event.type === "purchaseSip" ? "SIP purchase" : "Purchase";
}

function externalIdFor(event: CasStatementEvent) {
  return [
    "cas",
    event.date,
    event.type,
    event.units,
    event.nav,
    event.runningBalance,
  ].join(":");
}

function candidateFor(
  event: CasStatementEvent,
  scheme: CasSchemeBlock,
  folioFingerprint: string,
  errors: CasNormalizationError[],
) {
  if (!event.units || !event.nav || !event.runningBalance) {
    errors.push({
      code: "invalidEventValue",
      message: "A supported CAS purchase is missing units, NAV, or running balance.",
      rowNumber: event.rowNumber,
    });
    return undefined;
  }
  const quantity = exactPositiveNumber(event.units, normalizeQuantity);
  const unitPrice = exactPositiveNumber(event.nav, normalizeUnitPrice);
  const exactTotal = decimal(event.units).times(event.nav);
  const convertedTotal = exactTotal.toNumber();
  const totalIsSafe = Number.isFinite(convertedTotal) &&
    decimal(convertedTotal).equals(exactTotal);
  if (quantity === undefined || unitPrice === undefined || !totalIsSafe) {
    errors.push({
      code: "invalidEventValue",
      message: "A CAS purchase cannot be represented safely by the transaction model.",
      rowNumber: event.rowNumber,
    });
    return undefined;
  }

  const candidateWithoutFingerprint = {
    account: folioFingerprint,
    currency: "INR" as const,
    description: descriptionFor(event),
    externalId: externalIdFor(event),
    identity: { kind: "isin" as const, value: scheme.isin },
    isin: scheme.isin,
    quantity,
    source: {
      format: camsKfinCasSourceFormat,
      version: camsKfinCasSourceVersion,
    },
    tradeDate: event.date,
    transactionType: "buy" as const,
    unitPrice,
  } satisfies Omit<TransactionCsvCandidate, "fingerprint" | "rowNumber">;

  return {
    ...candidateWithoutFingerprint,
    fingerprint: getTransactionCsvFingerprint(candidateWithoutFingerprint),
    rowNumber: event.rowNumber,
  } satisfies TransactionCsvCandidate;
}

export function normalizeCamsKfinCas(
  parsed: CasParseResult,
): CamsKfinCasNormalizationResult {
  const errors: CasNormalizationError[] = [];
  const preservedCharges: CasPreservedCharge[] = [];
  const rows: TransactionCsvCandidate[] = [];
  const schemes: CasSchemeReview[] = [];
  const unsupportedEvents = parsed.unsupportedEvents.map((event) => ({
    rowNumber: event.rowNumber,
    transactionType: event.type,
  }));

  if (parsed.errors.length > 0) {
    return {
      ...(parsed.coverage ? { coverage: parsed.coverage } : {}),
      errors,
      parserErrors: parsed.errors,
      preservedCharges,
      rows,
      schemes,
      unsupportedEvents,
    };
  }

  for (const scheme of parsed.schemes) {
    let importableTransactions = 0;
    const folioFingerprint = scheme.folioReference.fingerprint;
    if (!folioFingerprint) {
      errors.push({
        code: "missingFolioFingerprint",
        message: "A CAS folio needs an opaque stable fingerprint before normalization.",
        rowNumber: scheme.sourceRow,
      });
    }
    for (const event of scheme.events) {
      if (event.disposition === "preservedCharge" && event.type === "stampDuty") {
        if (event.amount) {
          preservedCharges.push({
            amount: event.amount,
            date: event.date,
            folioLabel: scheme.folioReference.label,
            rowNumber: event.rowNumber,
            type: "stampDuty",
          });
        }
        continue;
      }
      if (event.disposition !== "importable") continue;
      if (!folioFingerprint) continue;
      const candidate = candidateFor(event, scheme, folioFingerprint, errors);
      if (!candidate) continue;
      rows.push(candidate);
      importableTransactions += 1;
    }
    schemes.push({
      closingUnits: scheme.closingUnits,
      events: scheme.events.map((event) => ({
        ...(event.amount ? { amount: event.amount } : {}),
        date: event.date,
        disposition: event.disposition,
        ...(event.nav ? { nav: event.nav } : {}),
        rowNumber: event.rowNumber,
        ...(event.runningBalance
          ? { runningBalance: event.runningBalance }
          : {}),
        type: event.type,
        ...(event.units ? { units: event.units } : {}),
      })),
      folioLabel: scheme.folioReference.label,
      importableTransactions,
      isin: scheme.isin,
      name: scheme.name,
      openingUnits: scheme.openingUnits,
      registrar: scheme.registrar,
    });
  }

  return {
    ...(parsed.coverage ? { coverage: parsed.coverage } : {}),
    errors,
    parserErrors: parsed.errors,
    preservedCharges,
    rows: errors.length === 0 ? rows : [],
    schemes,
    unsupportedEvents,
  };
}

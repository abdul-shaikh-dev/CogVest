import type { Currency } from "@/src/types";

export const transactionCsvVersion = "1";
export const transactionCsvSourceFormat = "cogvest-transactions";
export const transactionCsvMaxRows = 500;
export const transactionCsvMaxBytes = 1_000_000;

export const transactionCsvHeaders = [
  "cogvest_version",
  "transaction_type",
  "trade_date",
  "isin",
  "exchange",
  "symbol",
  "currency",
  "quantity",
  "unit_price",
  "acquisition_cost",
  "settlement_date",
  "external_id",
  "account",
  "fees",
  "taxes",
  "description",
  "notes",
] as const;

type TransactionCsvHeader = (typeof transactionCsvHeaders)[number];

export const supportedTransactionTypes = [
  "buy",
  "sell",
  "transferIn",
  "transferOut",
] as const;

export type SupportedTransactionType =
  (typeof supportedTransactionTypes)[number];

export const unsupportedTransactionTypes = [
  "bonus",
  "buyback",
  "cashDeposit",
  "cashWithdrawal",
  "corporateAction",
  "derivative",
  "derivatives",
  "dividend",
  "futures",
  "fee",
  "interest",
  "merger",
  "ofs",
  "ofsAllotment",
  "ipo",
  "ipoAllotment",
  "options",
  "pledge",
  "reversal",
  "rightsIssue",
  "split",
  "unpledge",
] as const;

export type UnsupportedTransactionType =
  (typeof unsupportedTransactionTypes)[number];

export type TransactionCsvIdentity =
  | { kind: "isin"; value: string }
  | { exchange: string; kind: "exchangeSymbol"; symbol: string };

export type TransactionCsvSource = {
  exchange?: string;
  executedAt?: string;
  fileIndex?: number;
  fileName?: string;
  format: string;
  orderId?: string;
  segment?: string;
  symbol?: string;
  version: string;
};

export type TransactionCsvCandidate = {
  account?: string;
  acquisitionCost?: number;
  currency: Currency;
  description?: string;
  exchange?: string;
  externalId?: string;
  fees?: number;
  fingerprint: string;
  identity: TransactionCsvIdentity;
  isin?: string;
  notes?: string;
  quantity: number;
  rowNumber: number;
  settlementDate?: string;
  source?: TransactionCsvSource;
  symbol?: string;
  taxes?: number;
  tradeDate: string;
  transactionType: SupportedTransactionType;
  unitPrice?: number;
};

export type ParsedTransactionCsvRow = TransactionCsvCandidate;

export type TransactionCsvErrorCode =
  | "duplicateHeader"
  | "emptyFile"
  | "fileLimit"
  | "invalidDate"
  | "invalidHeader"
  | "invalidNumber"
  | "invalidRow"
  | "invalidValue"
  | "missingHeader"
  | "rowLimit"
  | "syntax"
  | "unsupportedSourceField"
  | "unsupportedTransactionType"
  | "unsupportedVersion";

export type TransactionCsvError = {
  classification?: "unsupported";
  code: TransactionCsvErrorCode;
  column?: string;
  message: string;
  rowNumber?: number;
};

export type UnsupportedTransactionCsvEvent = {
  reason?: string;
  rowNumber: number;
  transactionType: string;
};

export type TransactionCsvParseResult = {
  errors: TransactionCsvError[];
  rows: ParsedTransactionCsvRow[];
  unsupportedEvents: UnsupportedTransactionCsvEvent[];
};

export type CsvRecord = {
  fields: string[];
  rowNumber: number;
};

export type CsvRecordsResult = {
  error?: string;
  records: CsvRecord[];
};

export function getUtf8ByteLength(value: string) {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return bytes;
}

export function parseCsvRecords(text: string): CsvRecordsResult {
  const records: CsvRecord[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  let record: string[] = [];
  let recordStartRow = 1;
  let rowNumber = 1;

  const pushRecord = () => {
    record.push(field);
    records.push({ fields: record, rowNumber: recordStartRow });
    field = "";
    record = [];
    afterQuote = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        field += "\n";
        rowNumber += 1;
      } else {
        field += character;
      }
      continue;
    }

    if (afterQuote) {
      if (character === ",") {
        record.push(field);
        field = "";
        afterQuote = false;
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        pushRecord();
        rowNumber += 1;
        recordStartRow = rowNumber;
      } else if (!/\s/u.test(character)) {
        return {
          error: "A quoted field must be followed by a comma or line ending.",
          records: [],
        };
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        return {
          error: "A quoted field must start immediately after a comma.",
          records: [],
        };
      }
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      pushRecord();
      rowNumber += 1;
      recordStartRow = rowNumber;
    } else {
      field += character;
    }
  }

  if (quoted) {
    return { error: "The CSV ends inside a quoted field.", records: [] };
  }

  if (field.length > 0 || record.length > 0 || afterQuote) {
    record.push(field);
    records.push({ fields: record, rowNumber: recordStartRow });
  }

  return { records };
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/u, "").trim().toLowerCase();
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumber(
  value: string,
  column: TransactionCsvHeader,
  rowNumber: number,
  errors: TransactionCsvError[],
  { nonNegative = false, required = false } = {},
) {
  const trimmed = value.trim();
  const validDecimal = /^(?:\d+\.?\d*|\.\d+)$/u.test(trimmed);

  if (!trimmed && !required) return undefined;
  const number = Number(trimmed);
  const valid =
    validDecimal &&
    Number.isFinite(number) &&
    (nonNegative ? number >= 0 : number > 0);

  if (!valid) {
    errors.push({
      code: "invalidNumber",
      column,
      message: `${column.replaceAll("_", " ")} must be ${
        nonNegative ? "a non-negative" : "a positive"
      } decimal number without grouping separators.`,
      rowNumber,
    });
    return undefined;
  }

  return number;
}

function parseDate(
  value: string,
  column: "trade_date" | "settlement_date",
  rowNumber: number,
  errors: TransactionCsvError[],
  required = false,
) {
  const trimmed = value.trim();
  if (!trimmed && !required) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(trimmed);
  const date = match ? new Date(`${trimmed}T00:00:00.000Z`) : null;
  const valid =
    match !== null &&
    date !== null &&
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3]);

  if (!valid) {
    errors.push({
      code: "invalidDate",
      column,
      message: `${column.replaceAll("_", " ")} must be a valid YYYY-MM-DD date.`,
      rowNumber,
    });
    return undefined;
  }

  return trimmed;
}

function valueFor(
  record: string[],
  indexes: Map<TransactionCsvHeader, number>,
  header: TransactionCsvHeader,
) {
  const index = indexes.get(header);
  return index === undefined ? "" : (record[index] ?? "");
}

function supportedType(value: string): SupportedTransactionType | undefined {
  const normalized = value.trim().toLowerCase();
  return supportedTransactionTypes.find(
    (type) => type.toLowerCase() === normalized,
  );
}

function unsupportedType(value: string): UnsupportedTransactionType | undefined {
  const normalized = value.trim().toLowerCase();
  return unsupportedTransactionTypes.find(
    (type) => type.toLowerCase() === normalized,
  );
}

export function getTransactionCsvFingerprint(
  candidate: Omit<TransactionCsvCandidate, "fingerprint" | "rowNumber">,
) {
  // The fingerprint identifies the financial event. Descriptive/provider fields
  // are compared separately so corrected metadata is a conflict, not a new row.
  return JSON.stringify([
    candidate.transactionType,
    candidate.tradeDate,
    candidate.identity,
    candidate.currency,
    candidate.quantity,
    candidate.unitPrice ?? null,
    candidate.acquisitionCost ?? null,
  ]);
}

export function parseTransactionCsv(input: string): TransactionCsvParseResult {
  if (getUtf8ByteLength(input) > transactionCsvMaxBytes) {
    return {
      errors: [
        {
          code: "fileLimit",
          message: "CSV files may be at most 1 MB.",
        },
      ],
      rows: [],
      unsupportedEvents: [],
    };
  }
  const text = input.replace(/^\uFEFF/u, "");
  if (!text.trim()) {
    return {
      errors: [{ code: "emptyFile", message: "Choose a non-empty CSV file." }],
      rows: [],
      unsupportedEvents: [],
    };
  }

  const parsed = parseCsvRecords(text);
  if (parsed.error) {
    return {
      errors: [{ code: "syntax", message: parsed.error }],
      rows: [],
      unsupportedEvents: [],
    };
  }

  const records = parsed.records.filter((record) =>
    record.fields.some((field) => field.trim().length > 0),
  );
  const headerRecord = records[0];
  if (!headerRecord) {
    return {
      errors: [{ code: "emptyFile", message: "Choose a non-empty CSV file." }],
      rows: [],
      unsupportedEvents: [],
    };
  }

  const errors: TransactionCsvError[] = [];
  const indexes = new Map<TransactionCsvHeader, number>();

  headerRecord.fields.forEach((rawHeader, index) => {
    const header = normalizeHeader(rawHeader);
    if (!transactionCsvHeaders.includes(header as TransactionCsvHeader)) {
      errors.push({
        code: "invalidHeader",
        message: `Unsupported CSV header: ${header || "(blank)"}.`,
      });
      return;
    }

    if (indexes.has(header as TransactionCsvHeader)) {
      errors.push({
        code: "duplicateHeader",
        column: header as TransactionCsvHeader,
        message: `CSV header ${header} appears more than once.`,
      });
      return;
    }

    indexes.set(header as TransactionCsvHeader, index);
  });

  const requiredHeaders: TransactionCsvHeader[] = [
    "cogvest_version",
    "transaction_type",
    "trade_date",
    "currency",
    "quantity",
  ];
  for (const header of requiredHeaders) {
    if (!indexes.has(header)) {
      errors.push({
        code: "missingHeader",
        column: header,
        message: `CSV header ${header} is required.`,
      });
    }
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) {
    errors.push({
      code: "emptyFile",
      message: "CSV files need at least one transaction row.",
    });
  }
  if (dataRecords.length > transactionCsvMaxRows) {
    errors.push({
      code: "rowLimit",
      message: `CSV files may contain at most ${transactionCsvMaxRows} transactions.`,
    });
  }
  if (errors.length > 0) {
    return { errors, rows: [], unsupportedEvents: [] };
  }

  const rows: TransactionCsvCandidate[] = [];
  const unsupportedEvents: UnsupportedTransactionCsvEvent[] = [];

  for (const record of dataRecords.slice(0, transactionCsvMaxRows)) {
    const rowNumber = record.rowNumber;
    const rowErrorsBefore = errors.length;
    if (record.fields.length > headerRecord.fields.length) {
      errors.push({
        code: "invalidRow",
        message: "This row contains more values than the CSV header.",
        rowNumber,
      });
    }

    const version = valueFor(record.fields, indexes, "cogvest_version").trim();
    const rawType = valueFor(record.fields, indexes, "transaction_type").trim();
    const transactionType = supportedType(rawType);
    const unsupported = unsupportedType(rawType);

    if (version !== transactionCsvVersion) {
      errors.push({
        code: "unsupportedVersion",
        column: "cogvest_version",
        message: `Row ${rowNumber} uses unsupported CogVest CSV version ${version || "(blank)"}.`,
        rowNumber,
      });
    }

    if (unsupported) {
      unsupportedEvents.push({ rowNumber, transactionType: rawType });
      errors.push({
        classification: "unsupported",
        code: "unsupportedTransactionType",
        column: "transaction_type",
        message: `Transaction type ${rawType} is recognized but unsupported in V1.`,
        rowNumber,
      });
      // Unsupported events are reviewable but are never interpreted as an
      // ordinary transaction, so malformed irrelevant columns do not block it.
      continue;
    } else if (!transactionType) {
      errors.push({
        code: "invalidValue",
        column: "transaction_type",
        message: `Unsupported transaction type: ${rawType || "(blank)"}.`,
        rowNumber,
      });
    }

    const tradeDate = parseDate(
      valueFor(record.fields, indexes, "trade_date"),
      "trade_date",
      rowNumber,
      errors,
      true,
    );
    const rawIsin = optionalText(valueFor(record.fields, indexes, "isin"));
    const rawExchange = optionalText(
      valueFor(record.fields, indexes, "exchange"),
    );
    const rawSymbol = optionalText(valueFor(record.fields, indexes, "symbol"));
    const rawCurrency = valueFor(record.fields, indexes, "currency")
      .trim()
      .toUpperCase();

    if (!tradeDate) {
      // parseDate has already added the row-level error.
    }

    if (!rawIsin && !(rawExchange && rawSymbol)) {
      errors.push({
        code: "invalidRow",
        message: "Provide an ISIN or both exchange and symbol for the asset.",
        rowNumber,
      });
    }
    if (Boolean(rawExchange) !== Boolean(rawSymbol)) {
      errors.push({
        code: "invalidRow",
        message: "Exchange and symbol must be provided together.",
        rowNumber,
      });
    }
    if (rawIsin && !/^[A-Za-z0-9]{12}$/u.test(rawIsin)) {
      errors.push({
        code: "invalidValue",
        column: "isin",
        message: "ISIN must contain exactly 12 letters or digits.",
        rowNumber,
      });
    }
    if (
      rawExchange &&
      !["NSE", "BSE", "CRYPTO"].includes(rawExchange.toUpperCase())
    ) {
      errors.push({
        code: "invalidValue",
        column: "exchange",
        message: `Unsupported exchange: ${rawExchange}.`,
        rowNumber,
      });
    }

    if (!rawCurrency) {
      errors.push({
        code: "invalidValue",
        column: "currency",
        message: "Currency is required and must be the asset's native currency.",
        rowNumber,
      });
    } else if (!(rawCurrency === "INR" || rawCurrency === "USD")) {
      errors.push({
        code: "invalidValue",
        column: "currency",
        message: `Unsupported currency: ${rawCurrency}.`,
        rowNumber,
      });
    }

    const quantity = parseNumber(
      valueFor(record.fields, indexes, "quantity"),
      "quantity",
      rowNumber,
      errors,
      { required: true },
    );
    const unitPrice = parseNumber(
      valueFor(record.fields, indexes, "unit_price"),
      "unit_price",
      rowNumber,
      errors,
      { required: transactionType === "buy" || transactionType === "sell" },
    );
    const acquisitionCost = parseNumber(
      valueFor(record.fields, indexes, "acquisition_cost"),
      "acquisition_cost",
      rowNumber,
      errors,
      { nonNegative: true },
    );
    const settlementDate = parseDate(
      valueFor(record.fields, indexes, "settlement_date"),
      "settlement_date",
      rowNumber,
      errors,
    );
    const fees = parseNumber(
      valueFor(record.fields, indexes, "fees"),
      "fees",
      rowNumber,
      errors,
      { nonNegative: true },
    );
    const taxes = parseNumber(
      valueFor(record.fields, indexes, "taxes"),
      "taxes",
      rowNumber,
      errors,
      { nonNegative: true },
    );

    if (
      (transactionType === "transferIn" || transactionType === "transferOut") &&
      unitPrice !== undefined
    ) {
      errors.push({
        code: "invalidValue",
        column: "unit_price",
        message: `${transactionType} rows must leave unit price blank.`,
        rowNumber,
      });
    }
    if (
      (transactionType === "buy" ||
        transactionType === "sell" ||
        transactionType === "transferOut") &&
      acquisitionCost !== undefined
    ) {
      errors.push({
        code: "invalidValue",
        column: "acquisition_cost",
        message: `${transactionType} rows must leave acquisition cost blank.`,
        rowNumber,
      });
    }

    const currency = rawCurrency === "INR" || rawCurrency === "USD"
      ? (rawCurrency as Currency)
      : undefined;
    if (
      errors.length === rowErrorsBefore &&
      transactionType &&
      tradeDate &&
      quantity !== undefined &&
      currency
    ) {
      const identity: TransactionCsvIdentity = rawIsin
        ? { kind: "isin", value: rawIsin.toUpperCase() }
        : {
            exchange: rawExchange!.toUpperCase(),
            kind: "exchangeSymbol",
            symbol: rawSymbol!.toUpperCase(),
          };
      const candidateWithoutFingerprint = {
        ...(valueFor(record.fields, indexes, "account").trim()
          ? { account: valueFor(record.fields, indexes, "account").trim() }
          : {}),
        ...(acquisitionCost === undefined ? {} : { acquisitionCost }),
        currency,
        ...(valueFor(record.fields, indexes, "description").trim()
          ? {
              description: valueFor(record.fields, indexes, "description").trim(),
            }
          : {}),
        ...(rawExchange ? { exchange: rawExchange.toUpperCase() } : {}),
        ...(valueFor(record.fields, indexes, "external_id").trim()
          ? {
              externalId: valueFor(record.fields, indexes, "external_id").trim(),
            }
          : {}),
        ...(fees === undefined ? {} : { fees }),
        identity,
        ...(rawIsin ? { isin: rawIsin.toUpperCase() } : {}),
        ...(valueFor(record.fields, indexes, "notes").trim()
          ? { notes: valueFor(record.fields, indexes, "notes").trim() }
          : {}),
        quantity,
        ...(settlementDate === undefined ? {} : { settlementDate }),
        ...(rawSymbol ? { symbol: rawSymbol.toUpperCase() } : {}),
        source: {
          format: transactionCsvSourceFormat,
          version: transactionCsvVersion,
        },
        ...(taxes === undefined ? {} : { taxes }),
        tradeDate,
        transactionType,
        ...(unitPrice === undefined ? {} : { unitPrice }),
      } satisfies Omit<TransactionCsvCandidate, "fingerprint" | "rowNumber">;

      rows.push({
        ...candidateWithoutFingerprint,
        fingerprint: getTransactionCsvFingerprint(candidateWithoutFingerprint),
        rowNumber,
      });
    }
  }

  return {
    errors,
    rows: errors.some((error) => error.classification !== "unsupported")
      ? []
      : rows,
    unsupportedEvents,
  };
}

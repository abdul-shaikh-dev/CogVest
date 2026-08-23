import type { Currency } from "@/src/types";
import {
  getTransactionCsvFingerprint,
  getUtf8ByteLength,
  parseCsvRecords,
  transactionCsvMaxBytes,
  transactionCsvMaxRows,
  type TransactionCsvCandidate,
  type TransactionCsvError,
  type TransactionCsvParseResult,
  type UnsupportedTransactionCsvEvent,
} from "@/src/domain/transactionCsv";

export const zerodhaTradebookSourceFormat = "zerodha-tradebook";
export const zerodhaTradebookSourceVersion = "eq-v1";

export const zerodhaTradebookHeaders = [
  "symbol",
  "isin",
  "trade_date",
  "exchange",
  "segment",
  "series",
  "trade_type",
  "auction",
  "quantity",
  "price",
  "trade_id",
  "order_id",
  "order_execution_time",
] as const;

type ZerodhaTradebookHeader = (typeof zerodhaTradebookHeaders)[number];

export type ParseZerodhaTradebookOptions = {
  fileIndex?: number;
  fileName?: string;
};

const headerIndexes = new Map<ZerodhaTradebookHeader, number>(
  zerodhaTradebookHeaders.map((header, index) => [header, index]),
);

function invalidResult(error: TransactionCsvError): TransactionCsvParseResult {
  return { errors: [error], rows: [], unsupportedEvents: [] };
}

function isValidLocalIsoTimestamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/u.exec(
    value,
  );
  if (!match) return false;

  const timestamp = new Date(
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.000Z`,
  );
  return (
    timestamp.getUTCFullYear() === Number(match[1]) &&
    timestamp.getUTCMonth() + 1 === Number(match[2]) &&
    timestamp.getUTCDate() === Number(match[3]) &&
    timestamp.getUTCHours() === Number(match[4]) &&
    timestamp.getUTCMinutes() === Number(match[5]) &&
    timestamp.getUTCSeconds() === Number(match[6])
  );
}

function isValidIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() + 1 === Number(match[2]) &&
    date.getUTCDate() === Number(match[3])
  );
}

function parsePositiveDecimal(
  value: string,
  column: ZerodhaTradebookHeader,
  rowNumber: number,
  errors: TransactionCsvError[],
) {
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  if (
    !/^(?:\d+\.?\d*|\.\d+)$/u.test(trimmed) ||
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    errors.push({
      code: "invalidNumber",
      column,
      message: `${column.replaceAll("_", " ")} must be a positive decimal number without grouping separators.`,
      rowNumber,
    });
    return undefined;
  }
  return parsed;
}

function getField(fields: string[], header: ZerodhaTradebookHeader) {
  return (fields[headerIndexes.get(header)!] ?? "").trim();
}

function getUnsupportedReason(
  fields: string[],
): { column: ZerodhaTradebookHeader; reason: string } | undefined {
  const exchange = getField(fields, "exchange").toUpperCase();
  if (exchange !== "NSE" && exchange !== "BSE") {
    return { column: "exchange", reason: `exchange ${exchange || "(blank)"}` };
  }

  const segment = getField(fields, "segment").toUpperCase();
  if (segment !== "EQ") {
    return { column: "segment", reason: `segment ${segment || "(blank)"}` };
  }

  const series = getField(fields, "series").toUpperCase();
  if (series !== "EQ") {
    return { column: "series", reason: `series ${series || "(blank)"}` };
  }

  const auction = getField(fields, "auction").toLowerCase();
  if (auction !== "false") {
    return { column: "auction", reason: `auction ${auction || "(blank)"}` };
  }

  const tradeType = getField(fields, "trade_type").toLowerCase();
  if (tradeType !== "buy" && tradeType !== "sell") {
    return {
      column: "trade_type",
      reason: `trade type ${tradeType || "(blank)"}`,
    };
  }
}

/** Parses Zerodha's current Equity Tradebook CSV without applying deduplication. */
export function parseZerodhaTradebook(
  input: string,
  options: ParseZerodhaTradebookOptions = {},
): TransactionCsvParseResult {
  if (getUtf8ByteLength(input) > transactionCsvMaxBytes) {
    return invalidResult({
      code: "fileLimit",
      message: "Zerodha Tradebook CSV files may be at most 1 MB.",
    });
  }

  const text = input.replace(/^\uFEFF/u, "");
  if (!text.trim()) {
    return invalidResult({
      code: "emptyFile",
      message: "Choose a non-empty Zerodha Equity Tradebook CSV file.",
    });
  }

  const parsed = parseCsvRecords(text);
  if (parsed.error) {
    return invalidResult({ code: "syntax", message: parsed.error });
  }

  const records = parsed.records.filter((record) =>
    record.fields.some((field) => field.trim().length > 0),
  );
  const headerRecord = records[0];
  if (!headerRecord) {
    return invalidResult({
      code: "emptyFile",
      message: "Choose a non-empty Zerodha Equity Tradebook CSV file.",
    });
  }

  const headersMatch =
    headerRecord.fields.length === zerodhaTradebookHeaders.length &&
    headerRecord.fields.every(
      (header, index) => header === zerodhaTradebookHeaders[index],
    );
  if (!headersMatch) {
    return invalidResult({
      code: "invalidHeader",
      message:
        "Unsupported Zerodha Tradebook CSV header. Export the current Equity Tradebook CSV without modifying its columns.",
    });
  }

  const dataRecords = records.slice(1);
  if (dataRecords.length === 0) {
    return invalidResult({
      code: "emptyFile",
      message: "Zerodha Tradebook CSV files need at least one transaction row.",
    });
  }
  if (dataRecords.length > transactionCsvMaxRows) {
    return invalidResult({
      code: "rowLimit",
      message: `Zerodha Tradebook CSV files may contain at most ${transactionCsvMaxRows} transactions.`,
    });
  }

  const errors: TransactionCsvError[] = [];
  const rows: TransactionCsvCandidate[] = [];
  const unsupportedEvents: UnsupportedTransactionCsvEvent[] = [];

  for (const record of dataRecords) {
    const { fields, rowNumber } = record;
    if (fields.length !== zerodhaTradebookHeaders.length) {
      errors.push({
        code: "invalidRow",
        message:
          "This Zerodha Tradebook row does not contain the expected number of values.",
        rowNumber,
      });
      continue;
    }

    const unsupported = getUnsupportedReason(fields);
    if (unsupported) {
      const transactionType = getField(fields, "trade_type");
      unsupportedEvents.push({
        reason: unsupported.reason,
        rowNumber,
        transactionType: transactionType || "(blank)",
      });
      errors.push({
        classification: "unsupported",
        code: "unsupportedSourceField",
        column: unsupported.column,
        message: `Zerodha Tradebook row is unsupported in V1: ${unsupported.reason}.`,
        rowNumber,
      });
      continue;
    }

    const rowErrorsBefore = errors.length;
    const symbol = getField(fields, "symbol").toUpperCase();
    const isin = getField(fields, "isin").toUpperCase();
    const tradeDate = getField(fields, "trade_date");
    const exchange = getField(fields, "exchange").toUpperCase();
    const segment = getField(fields, "segment").toUpperCase();
    const tradeType = getField(fields, "trade_type").toLowerCase() as "buy" | "sell";
    const tradeId = getField(fields, "trade_id");
    const orderId = getField(fields, "order_id");
    const executedAt = getField(fields, "order_execution_time");

    if (!symbol) {
      errors.push({
        code: "invalidValue",
        column: "symbol",
        message: "symbol is required.",
        rowNumber,
      });
    }
    if (!/^[A-Z0-9]{12}$/u.test(isin)) {
      errors.push({
        code: "invalidValue",
        column: "isin",
        message: "isin must contain exactly 12 letters or digits.",
        rowNumber,
      });
    }
    if (!isValidIsoDate(tradeDate)) {
      errors.push({
        code: "invalidDate",
        column: "trade_date",
        message: "trade date must be a valid YYYY-MM-DD date.",
        rowNumber,
      });
    }
    if (!isValidLocalIsoTimestamp(executedAt)) {
      errors.push({
        code: "invalidDate",
        column: "order_execution_time",
        message:
          "order execution time must be a valid local YYYY-MM-DDTHH:mm:ss timestamp.",
        rowNumber,
      });
    }
    if (
      isValidIsoDate(tradeDate) &&
      isValidLocalIsoTimestamp(executedAt) &&
      executedAt.slice(0, 10) !== tradeDate
    ) {
      errors.push({
        code: "invalidDate",
        column: "order_execution_time",
        message: "order execution date must match trade date.",
        rowNumber,
      });
    }
    if (!tradeId) {
      errors.push({
        code: "invalidValue",
        column: "trade_id",
        message: "trade id is required.",
        rowNumber,
      });
    }
    if (!orderId) {
      errors.push({
        code: "invalidValue",
        column: "order_id",
        message: "order id is required.",
        rowNumber,
      });
    }

    const quantity = parsePositiveDecimal(
      getField(fields, "quantity"),
      "quantity",
      rowNumber,
      errors,
    );
    const unitPrice = parsePositiveDecimal(
      getField(fields, "price"),
      "price",
      rowNumber,
      errors,
    );

    if (
      errors.length !== rowErrorsBefore ||
      quantity === undefined ||
      unitPrice === undefined
    ) {
      continue;
    }

    const candidateWithoutFingerprint = {
      currency: "INR" as Currency,
      exchange,
      externalId: tradeId,
      identity: { kind: "isin" as const, value: isin },
      isin,
      quantity,
      source: {
        ...(options.fileIndex === undefined ? {} : { fileIndex: options.fileIndex }),
        ...(options.fileName ? { fileName: options.fileName } : {}),
        exchange,
        executedAt,
        format: zerodhaTradebookSourceFormat,
        orderId,
        segment,
        symbol,
        version: zerodhaTradebookSourceVersion,
      },
      symbol,
      tradeDate: executedAt,
      transactionType: tradeType,
      unitPrice,
    } satisfies Omit<TransactionCsvCandidate, "fingerprint" | "rowNumber">;

    rows.push({
      ...candidateWithoutFingerprint,
      fingerprint: getTransactionCsvFingerprint(candidateWithoutFingerprint),
      rowNumber,
    });
  }

  return {
    errors,
    rows: errors.some((error) => error.classification !== "unsupported")
      ? []
      : rows,
    unsupportedEvents,
  };
}

import {
  isInstrumentType,
  isSectorType,
} from "@/src/domain/assets";
import {
  getCalendarDatePart,
  isFutureCalendarDate,
} from "@/src/domain/dates";
import type {
  AssetClass,
  AssetExchange,
  Currency,
  InstrumentType,
  SectorType,
} from "@/src/types";

export const holdingsCsvVersion = "1";
export const holdingsCsvMaxRows = 500;

export const holdingsCsvHeaders = [
  "cogvest_version",
  "name",
  "ticker",
  "symbol",
  "asset_class",
  "instrument_type",
  "sector",
  "currency",
  "exchange",
  "quantity",
  "average_cost",
  "current_price",
  "valuation_as_of",
  "first_purchase_date",
] as const;

type HoldingsCsvHeader = (typeof holdingsCsvHeaders)[number];

export type ParsedHoldingsCsvRow = {
  assetClass?: AssetClass;
  averageCost: number;
  currency: Currency;
  currentPrice?: number;
  exchange?: AssetExchange;
  firstPurchaseDate: string | null;
  instrumentType?: InstrumentType;
  name: string;
  quantity: number;
  rowNumber: number;
  sectorType?: SectorType;
  symbol?: string;
  ticker?: string;
  valuationAsOf?: string;
};

export type HoldingsCsvError = {
  code:
    | "duplicateHeader"
    | "emptyFile"
    | "invalidDate"
    | "invalidHeader"
    | "invalidNumber"
    | "invalidRow"
    | "invalidValue"
    | "missingHeader"
    | "rowLimit"
    | "syntax"
    | "unsupportedInstrument"
    | "unsupportedVersion";
  column?: HoldingsCsvHeader;
  message: string;
  rowNumber?: number;
};

export type HoldingsCsvParseResult = {
  errors: HoldingsCsvError[];
  rows: ParsedHoldingsCsvRow[];
};

const assetClasses: AssetClass[] = ["stock", "etf", "debt", "crypto", "cash"];
const currencies: Currency[] = ["INR", "USD"];
const exchanges: AssetExchange[] = ["NSE", "BSE", "CRYPTO"];
const requiredHeaders: HoldingsCsvHeader[] = [
  "cogvest_version",
  "quantity",
  "average_cost",
];

function parseCsvRecords(text: string) {
  const records: string[][] = [];
  let field = "";
  let quoted = false;
  let record: string[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        return { error: "A quoted field must start immediately after a comma.", records: [] };
      }
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      field = "";
      records.push(record);
      record = [];
    } else {
      field += character;
    }
  }

  if (quoted) {
    return { error: "The CSV ends inside a quoted field.", records: [] };
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return { records };
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/u, "").trim().toLowerCase();
}

function parsePositiveNumber(
  value: string,
  column: "average_cost" | "current_price" | "quantity",
  rowNumber: number,
  errors: HoldingsCsvError[],
) {
  const trimmed = value.trim();
  if (column === "current_price" && trimmed.length === 0) return undefined;

  const number = Number(trimmed);
  if (!trimmed || !Number.isFinite(number) || number <= 0) {
    errors.push({
      code: "invalidNumber",
      column,
      message: `${column.replaceAll("_", " ")} must be a positive number without grouping separators.`,
      rowNumber,
    });
    return undefined;
  }

  return number;
}

function parseOptionalDate({
  column,
  errors,
  now,
  rowNumber,
  value,
}: {
  column: "first_purchase_date" | "valuation_as_of";
  errors: HoldingsCsvError[];
  now: Date;
  rowNumber: number;
  value: string;
}) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") return undefined;

  if (
    getCalendarDatePart(trimmed) !== trimmed ||
    isFutureCalendarDate(trimmed, now)
  ) {
    errors.push({
      code: "invalidDate",
      column,
      message: `${column.replaceAll("_", " ")} must be a valid, non-future YYYY-MM-DD date or unknown.`,
      rowNumber,
    });
    return undefined;
  }

  return trimmed;
}

function valueFor(
  record: string[],
  indexes: Map<HoldingsCsvHeader, number>,
  header: HoldingsCsvHeader,
) {
  const index = indexes.get(header);
  return index === undefined ? "" : (record[index] ?? "");
}

export function parseHoldingsCsv(
  input: string,
  now = new Date(),
): HoldingsCsvParseResult {
  const text = input.replace(/^\uFEFF/u, "");
  if (!text.trim()) {
    return {
      errors: [{ code: "emptyFile", message: "Choose a non-empty CSV file." }],
      rows: [],
    };
  }

  const parsed = parseCsvRecords(text);
  if (parsed.error) {
    return {
      errors: [{ code: "syntax", message: parsed.error }],
      rows: [],
    };
  }

  const records = parsed.records.filter((record) =>
    record.some((field) => field.trim().length > 0),
  );
  const headerRecord = records[0];
  if (!headerRecord) {
    return {
      errors: [{ code: "emptyFile", message: "Choose a non-empty CSV file." }],
      rows: [],
    };
  }

  const errors: HoldingsCsvError[] = [];
  const indexes = new Map<HoldingsCsvHeader, number>();

  headerRecord.forEach((rawHeader, index) => {
    const header = normalizeHeader(rawHeader);
    if (!holdingsCsvHeaders.includes(header as HoldingsCsvHeader)) {
      errors.push({
        code: "invalidHeader",
        message: `Unsupported CSV header: ${header || "(blank)"}.`,
      });
      return;
    }
    if (indexes.has(header as HoldingsCsvHeader)) {
      errors.push({
        code: "duplicateHeader",
        column: header as HoldingsCsvHeader,
        message: `CSV header ${header} appears more than once.`,
      });
      return;
    }
    indexes.set(header as HoldingsCsvHeader, index);
  });

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
      message: "CSV files need at least one holding row.",
    });
  }
  if (dataRecords.length > holdingsCsvMaxRows) {
    errors.push({
      code: "rowLimit",
      message: `CSV files may contain at most ${holdingsCsvMaxRows} holdings.`,
    });
  }
  if (errors.length > 0) return { errors, rows: [] };

  const rows: ParsedHoldingsCsvRow[] = [];
  for (const [index, record] of dataRecords.slice(0, holdingsCsvMaxRows).entries()) {
    const rowNumber = index + 2;
    const rowErrorsBefore = errors.length;
    const version = valueFor(record, indexes, "cogvest_version").trim();
    const name = valueFor(record, indexes, "name").trim();
    const ticker = valueFor(record, indexes, "ticker").trim();
    const symbol = valueFor(record, indexes, "symbol").trim();
    const rawAssetClass = valueFor(record, indexes, "asset_class").trim().toLowerCase();
    const rawCurrency = valueFor(record, indexes, "currency").trim().toUpperCase() || "INR";
    const rawExchange = valueFor(record, indexes, "exchange").trim().toUpperCase();
    const rawInstrumentType = valueFor(record, indexes, "instrument_type").trim();
    const rawSector = valueFor(record, indexes, "sector").trim();

    if (version !== holdingsCsvVersion) {
      errors.push({
        code: "unsupportedVersion",
        column: "cogvest_version",
        message: `Row ${rowNumber} uses unsupported CogVest CSV version ${version || "(blank)"}.`,
        rowNumber,
      });
    }
    if (!name && !ticker) {
      errors.push({
        code: "invalidRow",
        message: "Provide an asset name or ticker.",
        rowNumber,
      });
    }
    if (rawAssetClass && !assetClasses.includes(rawAssetClass as AssetClass)) {
      errors.push({
        code: "invalidValue",
        column: "asset_class",
        message: `Unsupported asset class: ${rawAssetClass}.`,
        rowNumber,
      });
    }
    if (!currencies.includes(rawCurrency as Currency)) {
      errors.push({
        code: "invalidValue",
        column: "currency",
        message: `Unsupported currency: ${rawCurrency}.`,
        rowNumber,
      });
    }
    if (rawExchange && !exchanges.includes(rawExchange as AssetExchange)) {
      errors.push({
        code: "invalidValue",
        column: "exchange",
        message: `Unsupported exchange: ${rawExchange}.`,
        rowNumber,
      });
    }
    if (rawInstrumentType && !isInstrumentType(rawInstrumentType)) {
      errors.push({
        code: "invalidValue",
        column: "instrument_type",
        message: `Unsupported instrument type: ${rawInstrumentType}.`,
        rowNumber,
      });
    }
    if (rawInstrumentType === "ppf" || rawAssetClass === "cash") {
      errors.push({
        code: "unsupportedInstrument",
        message: rawInstrumentType === "ppf"
          ? "PPF must be added through the dedicated PPF account flow."
          : "Cash must be added through Cash Ledger, not holdings import.",
        rowNumber,
      });
    }
    if (rawSector && !isSectorType(rawSector)) {
      errors.push({
        code: "invalidValue",
        column: "sector",
        message: `Unsupported sector: ${rawSector}.`,
        rowNumber,
      });
    }

    const quantity = parsePositiveNumber(
      valueFor(record, indexes, "quantity"),
      "quantity",
      rowNumber,
      errors,
    );
    const averageCost = parsePositiveNumber(
      valueFor(record, indexes, "average_cost"),
      "average_cost",
      rowNumber,
      errors,
    );
    const currentPrice = parsePositiveNumber(
      valueFor(record, indexes, "current_price"),
      "current_price",
      rowNumber,
      errors,
    );
    const valuationAsOf = parseOptionalDate({
      column: "valuation_as_of",
      errors,
      now,
      rowNumber,
      value: valueFor(record, indexes, "valuation_as_of"),
    });
    const firstPurchaseDate = parseOptionalDate({
      column: "first_purchase_date",
      errors,
      now,
      rowNumber,
      value: valueFor(record, indexes, "first_purchase_date"),
    });

    if (currentPrice !== undefined && valuationAsOf === undefined) {
      errors.push({
        code: "invalidDate",
        column: "valuation_as_of",
        message: "valuation as of is required when current price is supplied.",
        rowNumber,
      });
    }

    if (
      errors.length === rowErrorsBefore &&
      quantity !== undefined &&
      averageCost !== undefined
    ) {
      rows.push({
        ...(rawAssetClass ? { assetClass: rawAssetClass as AssetClass } : {}),
        averageCost,
        currency: rawCurrency as Currency,
        ...(currentPrice === undefined ? {} : { currentPrice }),
        ...(rawExchange ? { exchange: rawExchange as AssetExchange } : {}),
        firstPurchaseDate: firstPurchaseDate ?? null,
        ...(rawInstrumentType
          ? { instrumentType: rawInstrumentType as InstrumentType }
          : {}),
        name: name || ticker,
        quantity,
        rowNumber,
        ...(rawSector ? { sectorType: rawSector as SectorType } : {}),
        ...(symbol ? { symbol } : {}),
        ...(ticker ? { ticker } : {}),
        ...(valuationAsOf ? { valuationAsOf } : {}),
      });
    }
  }

  return { errors, rows: errors.length === 0 ? rows : [] };
}

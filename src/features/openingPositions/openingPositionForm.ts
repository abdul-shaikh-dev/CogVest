import type {
  AssetClass,
  ConvictionScore,
  InstrumentType,
  SectorType,
} from "@/src/types";
import { isInstrumentType, isSectorType } from "@/src/domain/assets";

export type OpeningPositionFormValues = {
  assetClass: AssetClass;
  assetName: string;
  averageCostPrice: string;
  conviction?: string;
  currentPrice: string;
  date: string;
  instrumentType: string;
  notes?: string;
  quoteSourceId?: string;
  quantity: string;
  sectorType: string;
  symbol: string;
  ticker: string;
};

export type ValidOpeningPositionForm = {
  assetClass: AssetClass;
  assetName: string;
  averageCostPrice: number;
  conviction?: ConvictionScore;
  currentPrice: number;
  date: string;
  instrumentType: InstrumentType;
  notes?: string;
  quoteSourceId: string;
  quantity: number;
  sectorType: SectorType;
  symbol: string;
  ticker: string;
};

export type OpeningPositionFormResult =
  | {
      errors: Partial<Record<keyof OpeningPositionFormValues, string>>;
      isValid: false;
    }
  | {
      isValid: true;
      value: ValidOpeningPositionForm;
    };

function parsePositiveNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export function validateOpeningPositionForm(
  values: OpeningPositionFormValues,
): OpeningPositionFormResult {
  const errors: Partial<Record<keyof OpeningPositionFormValues, string>> = {};
  const quantity = parsePositiveNumber(values.quantity);
  const averageCostPrice = parsePositiveNumber(values.averageCostPrice);
  const currentPrice = parsePositiveNumber(values.currentPrice);
  const conviction =
    values.conviction && values.conviction.trim().length > 0
      ? Number(values.conviction)
      : undefined;

  if (values.assetName.trim().length === 0) {
    errors.assetName = "Asset name is required.";
  }

  if (values.symbol.trim().length === 0) {
    errors.symbol = "Symbol is required.";
  }

  if (values.ticker.trim().length === 0) {
    errors.ticker = "Ticker is required.";
  }

  if (quantity === null) {
    errors.quantity = "Quantity must be greater than zero.";
  }

  if (averageCostPrice === null) {
    errors.averageCostPrice = "Average cost must be greater than zero.";
  }

  if (currentPrice === null) {
    errors.currentPrice = "Current price must be greater than zero.";
  }

  if (!isValidDateInput(values.date)) {
    errors.date = "Date must use YYYY-MM-DD.";
  }

  if (!isInstrumentType(values.instrumentType)) {
    errors.instrumentType = "Instrument type is not supported.";
  }

  if (!isSectorType(values.sectorType)) {
    errors.sectorType = "Sector type is not supported.";
  }

  if (
    conviction !== undefined &&
    (!Number.isInteger(conviction) || conviction < 1 || conviction > 5)
  ) {
    errors.conviction = "Conviction must be between 1 and 5.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      errors,
      isValid: false,
    };
  }

  return {
    isValid: true,
    value: {
      assetClass: values.assetClass,
      assetName: values.assetName.trim(),
      averageCostPrice: averageCostPrice as number,
      conviction: conviction as ConvictionScore | undefined,
      currentPrice: currentPrice as number,
      date: values.date,
      instrumentType: values.instrumentType as InstrumentType,
      notes: values.notes?.trim() || undefined,
      quoteSourceId:
        values.quoteSourceId?.trim() ||
        values.ticker.trim(),
      quantity: quantity as number,
      sectorType: values.sectorType as SectorType,
      symbol: values.symbol.trim().toUpperCase(),
      ticker: values.ticker.trim().toUpperCase(),
    },
  };
}

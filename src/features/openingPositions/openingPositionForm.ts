import type {
  AssetClass,
  ConvictionScore,
  InstrumentType,
  SectorType,
} from "@/src/types";
import { isInstrumentType, isSectorType } from "@/src/domain/assets";
import {
  isFutureCalendarDate,
  parseCalendarDate,
} from "@/src/domain/dates";
import {
  normalizeQuantity,
  normalizeUnitPrice,
} from "@/src/domain/precision";

export type OpeningPositionFormValues = {
  assetClass: AssetClass;
  assetName: string;
  averageCostPrice: string;
  conviction?: string;
  currentPrice: string;
  date: string;
  dateUnknown?: boolean;
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
  date: string | null;
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

export function validateOpeningPositionForm(
  values: OpeningPositionFormValues,
  now = new Date(),
): OpeningPositionFormResult {
  const errors: Partial<Record<keyof OpeningPositionFormValues, string>> = {};
  const parsedQuantity = parsePositiveNumber(values.quantity);
  const parsedAverageCostPrice = parsePositiveNumber(values.averageCostPrice);
  const parsedCurrentPrice = parsePositiveNumber(values.currentPrice);
  const quantity =
    parsedQuantity === null ? null : normalizeQuantity(parsedQuantity);
  const averageCostPrice =
    parsedAverageCostPrice === null
      ? null
      : normalizeUnitPrice(parsedAverageCostPrice);
  const currentPrice =
    parsedCurrentPrice === null
      ? null
      : normalizeUnitPrice(parsedCurrentPrice);
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

  if (quantity === null || quantity === 0) {
    errors.quantity = "Quantity must be greater than zero.";
  }

  if (averageCostPrice === null || averageCostPrice === 0) {
    errors.averageCostPrice = "Average cost must be greater than zero.";
  }

  if (currentPrice === null || currentPrice === 0) {
    errors.currentPrice = "Current price must be greater than zero.";
  }

  if (!values.dateUnknown && !parseCalendarDate(values.date)) {
    errors.date = "Date must use YYYY-MM-DD.";
  } else if (!values.dateUnknown && isFutureCalendarDate(values.date, now)) {
    errors.date = "Date cannot be in the future.";
  }

  if (!isInstrumentType(values.instrumentType)) {
    errors.instrumentType = "Instrument type is not supported.";
  }

  if (values.sectorType.trim().length > 0 && !isSectorType(values.sectorType)) {
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
      date: values.dateUnknown ? null : values.date,
      instrumentType: values.instrumentType as InstrumentType,
      notes: values.notes?.trim() || undefined,
      quoteSourceId:
        values.quoteSourceId?.trim() ||
        values.ticker.trim(),
      quantity: quantity as number,
      sectorType: (values.sectorType.trim() || "other") as SectorType,
      symbol: values.symbol.trim().toUpperCase(),
      ticker: values.ticker.trim().toUpperCase(),
    },
  };
}

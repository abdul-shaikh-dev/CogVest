import {
  decimal,
  normalizeMoney,
  normalizePercentage,
  roundHalfUp,
} from "@/src/domain/precision";
import type { Currency } from "@/src/types";

// Fixed locales/options allow reuse without caching any portfolio values.
const currencyFormatters = new Map<Currency, Intl.NumberFormat>();
let inrFormatter: Intl.NumberFormat | undefined;
let dateFormatter: Intl.DateTimeFormat | undefined;

export function formatCurrency(value: number, currency: Currency) {
  const normalizedValue = normalizeMoney(value);
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      currency,
      currencyDisplay: "symbol",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(normalizedValue);
}

export function formatINR(value: number) {
  const normalizedValue = normalizeMoney(value);
  const sign = normalizedValue < 0 ? "-" : "";
  const absoluteValue = Math.abs(normalizedValue);
  inrFormatter ??= new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
  const formatted = inrFormatter.format(absoluteValue);

  return `${sign}₹${formatted}`;
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatCompactINR(value: number) {
  const sign = value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);

  if (absoluteValue < 1000) {
    return `${sign}₹${roundHalfUp(absoluteValue, 0)}`;
  }

  const compactScales = [
    { suffix: "Cr", value: 10000000 },
    { suffix: "L", value: 100000 },
    { suffix: "K", value: 1000 },
  ];
  const scale = compactScales.find((item) => absoluteValue >= item.value);
  const scaledValue = decimal(absoluteValue).dividedBy(scale?.value ?? 1);
  const rounded = roundHalfUp(scaledValue, 2).toFixed(2);

  return `${sign}₹${trimTrailingZeros(rounded)}${scale?.suffix ?? ""}`;
}

export function formatPercentage(value: number) {
  const normalizedValue = normalizePercentage(value);
  const sign = normalizedValue > 0 ? "+" : "";

  return `${sign}${normalizedValue.toFixed(2)}%`;
}

export function formatDate(isoDate: string) {
  dateFormatter ??= new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });
  return dateFormatter.format(new Date(isoDate));
}

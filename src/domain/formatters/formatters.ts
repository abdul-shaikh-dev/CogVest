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

const inrCompactScales = [
  { suffix: "K", value: 1_000 },
  { suffix: "L", value: 100_000 },
  { suffix: "Cr", value: 10_000_000 },
];
// Lakh and crore are Indian units; other currencies use thousands and millions.
const internationalCompactScales = [
  { suffix: "K", value: 1_000 },
  { suffix: "M", value: 1_000_000 },
  { suffix: "B", value: 1_000_000_000 },
];

/**
 * The value rounded in the unit it falls in, moved up a unit when the
 * rounding reaches it (#668): ₹99,999.99 is "₹1L", not "₹100K". Null when
 * it rounds below one thousand.
 */
function compactParts(absoluteValue: number, currency: Currency, fractionDigits: number) {
  const scales = currency === "INR" ? inrCompactScales : internationalCompactScales;
  let index = 0;
  scales.forEach((scale, position) => { if (absoluteValue >= scale.value) index = position; });
  for (;;) {
    const scale = scales[index];
    const rounded = roundHalfUp(decimal(absoluteValue).dividedBy(scale.value), fractionDigits);
    const next = scales[index + 1];
    if (next && rounded >= next.value / scale.value) {
      index += 1;
      continue;
    }
    return rounded >= 1 ? { amount: rounded.toFixed(fractionDigits), suffix: scale.suffix } : null;
  }
}

export function formatCompactINR(value: number) {
  const sign = value < 0 ? "-" : "";
  const wholeRupees = roundHalfUp(Math.abs(value), 0);

  if (wholeRupees < 1000) {
    return `${sign}₹${wholeRupees}`;
  }

  // At least ₹999.50, so it reaches at least 1.00K.
  const parts = compactParts(Math.abs(value), "INR", 2)!;
  return `${sign}₹${trimTrailingZeros(parts.amount)}${parts.suffix}`;
}

const currencySymbols: Record<Currency, string> = { INR: "₹", USD: "$" };

/**
 * A chart axis label: one decimal in lakh/crore for INR and in K/M/B for
 * other currencies, never lakh or crore for USD (#668). Small values keep
 * their digits, with three decimals below one.
 */
export function formatCompactAxisValue(amount: number, currency: Currency) {
  const sign = amount < 0 ? "-" : "";
  const absoluteValue = Math.abs(amount);
  const parts = compactParts(absoluteValue, currency, 1);
  const body = parts && absoluteValue >= 999.5
    ? `${parts.amount}${parts.suffix}`
    : roundHalfUp(absoluteValue, absoluteValue > 0 && absoluteValue < 1 ? 3 : 0).toString();
  return `${sign}${currencySymbols[currency]}${body}`;
}

const priceFormatters = new Map<string, Intl.NumberFormat>();

/** A unit price in its own currency: up to six decimals below one, two otherwise. */
export function formatPrice(value: number, currency: Currency) {
  const maximumFractionDigits = Math.abs(value) < 1 ? 6 : 2;
  const key = `${currency}:${maximumFractionDigits}`;
  let formatter = priceFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      currency,
      maximumFractionDigits,
      style: "currency",
    });
    priceFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

export function formatPercentage(value: number) {
  const normalizedValue = normalizePercentage(value);
  const sign = normalizedValue > 0 ? "+" : "";

  return `${sign}${normalizedValue.toFixed(2)}%`;
}

// The en-IN short month names. Built here rather than by Intl, because Android
// 14 and older spell the en-IN date "05-Jan-2026" while newer releases spell it
// "05 Jan 2026" (#779): their bundled ICU date patterns differ.
const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"] as const;

/**
 * "05 Jan 2026" on every Android version. `utc` reads the calendar day in UTC
 * (for stored ISO dates); otherwise the phone's local day. `padDay: false`
 * gives "5 Jan 2026".
 */
export function formatDayMonthYear(date: Date, { padDay = true, utc = false }: { padDay?: boolean; utc?: boolean } = {}) {
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid time value");
  const day = utc ? date.getUTCDate() : date.getDate();
  const month = utc ? date.getUTCMonth() : date.getMonth();
  const year = utc ? date.getUTCFullYear() : date.getFullYear();
  return `${padDay ? String(day).padStart(2, "0") : day} ${shortMonthNames[month]} ${year}`;
}

export function formatDate(isoDate: string) {
  return formatDayMonthYear(new Date(isoDate), { utc: true });
}

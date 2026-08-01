import {
  decimal,
  normalizeMoney,
  normalizePercentage,
  roundHalfUp,
} from "@/src/domain/precision";

export function formatINR(value: number) {
  const normalizedValue = normalizeMoney(value);
  const sign = normalizedValue < 0 ? "-" : "";
  const absoluteValue = Math.abs(normalizedValue);
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(absoluteValue);

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
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(isoDate));
}

export function formatINR(value: number) {
  const sign = value < 0 ? "-" : "";
  const absoluteValue = Math.abs(value);
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
    return `${sign}₹${Math.round(absoluteValue)}`;
  }

  const compactScales = [
    { suffix: "Cr", value: 10000000 },
    { suffix: "L", value: 100000 },
    { suffix: "K", value: 1000 },
  ];
  const scale = compactScales.find((item) => absoluteValue >= item.value);
  const scaledValue = absoluteValue / (scale?.value ?? 1);
  const rounded = scaledValue.toFixed(2);

  return `${sign}₹${trimTrailingZeros(rounded)}${scale?.suffix ?? ""}`;
}

export function formatPercentage(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(2)}%`;
}

export function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(isoDate));
}

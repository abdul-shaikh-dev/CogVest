import { parseUsdmTimestamp } from "./usdmFutures";

export function futuresEntryDate(value: string): Date | undefined {
  try { return new Date(parseUsdmTimestamp(value)); } catch { return undefined; }
}

export function replaceFuturesTimePart(value: string, selected: Date, part: "date" | "time", fallback: Date): string {
  const result = futuresEntryDate(value) ?? new Date(fallback);
  if (part === "date") result.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
  else result.setHours(selected.getHours(), selected.getMinutes());
  const fraction = futuresEntryDate(value) ? /\.(\d+)(?:Z|[+-]\d\d:\d\d)$/.exec(value)?.[1] : undefined;
  return fraction ? result.toISOString().replace(/\.\d{3}Z$/, `.${fraction}Z`) : result.toISOString();
}

export function futuresTimeZone(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  return `UTC${minutes >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
}

export type FuturesEntryField = { value: string; label: string; timestamp?: boolean; optional?: boolean };

export function futuresEntryErrors(fields: Record<string, FuturesEntryField>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (!field.value.trim()) {
      if (!field.optional) errors[key] = `Enter ${field.label.toLowerCase()}.`;
    } else if (field.timestamp && !futuresEntryDate(field.value)) errors[key] = "Choose a valid date and time with timezone.";
  }
  return errors;
}

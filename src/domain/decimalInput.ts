const unsignedDecimal = /^(?:\d+\.?\d*|\.\d+)$/u;
const signedDecimal = /^-?(?:\d+\.?\d*|\.\d+)$/u;

/**
 * Parses a plain decimal the person typed or a CSV cell holds: "12", "12.5",
 * "12." or ".5" (#719). Anything else is NaN, including hex ("0x10"), exponent
 * ("1e5"), grouping separators, "Infinity" and signs. `allowNegative` admits a
 * leading minus for the few fields that can legitimately be negative.
 */
export function parseDecimalInput(value: string, { allowNegative = false } = {}): number {
  const trimmed = value.trim();
  return (allowNegative ? signedDecimal : unsignedDecimal).test(trimmed) ? Number(trimmed) : Number.NaN;
}

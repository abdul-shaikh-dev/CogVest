/**
 * Orders machine keys (ISO dates, months, record ids) by UTF-16 code unit.
 * ISO dates and months sort the same as with localeCompare. Hermes on Android
 * runs localeCompare through locale collation, about 50 times slower, which
 * made sorting records the main startup cost on large portfolios (#138).
 * Text people read, such as asset names, still sorts with localeCompare.
 */
export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

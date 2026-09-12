export type MutualFundAllocation = "debt" | "equity";

export function inferMutualFundAllocationFromName(
  name: string,
): MutualFundAllocation | undefined {
  const normalized = name.trim().toUpperCase();
  if (/\b(?:ARBITRAGE|BALANCED|HYBRID|MULTI[ -]ASSET|EQUITY SAVINGS|DYNAMIC ASSET ALLOCATION|GOLD|SILVER|COMMODIT)/u.test(normalized)) {
    return undefined;
  }
  if (/\b(?:DEBT|BOND|GILT|MONEY MARKET|OVERNIGHT|LIQUID|CREDIT RISK|BANKING AND PSU|CORPORATE BOND|FLOATER|FIXED MATURITY|TARGET MATURITY|LOW DURATION|SHORT DURATION|MEDIUM DURATION|LONG DURATION|SDL|G[ -]SEC|TREASURY)\b/u.test(normalized)) {
    return "debt";
  }
  if (/\b(?:EQUITY|ELSS|TAX SAVER|FLEXI CAP|LARGE CAP|MID CAP|SMALL CAP|MULTI CAP|BLUECHIP|FOCUSED|CONTRA|VALUE FUND|NIFTY|SENSEX|NASDAQ|S\s*(?:&|AND)\s*P|STOCK MARKET)\b/u.test(normalized)) {
    return "equity";
  }
  return undefined;
}

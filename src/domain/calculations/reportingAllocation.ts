import type { Holding } from "@/src/types";
import { decimal, normalizeMoney, normalizePercentage, sumFinancialValues } from "../precision";

export type ReportingAllocationClass = "equity" | "debt" | "crypto" | "cash";

// Callers supply legacy-deduplicated holdings and independently valued accounts.
// Negative Futures equity stays unavailable rather than being hidden by spot gains.
export function calculateReportingAllocation(input: {
  holdings: readonly Holding[];
  cashBalance: number;
  ppfConfirmedBalance: number;
  futuresEquityInr: number | null;
}) {
  if (input.futuresEquityInr === null || input.futuresEquityInr < 0 ||
      ![input.cashBalance, input.ppfConfirmedBalance, input.futuresEquityInr].every(Number.isFinite) ||
      input.holdings.some(holding => holding.valuation.status === "pending")) return [];
  const values = {
    equity: decimal(0), debt: decimal(input.ppfConfirmedBalance),
    crypto: decimal(input.futuresEquityInr), cash: decimal(input.cashBalance),
  };
  let spotCrypto = decimal(0);
  for (const holding of input.holdings) {
    const value = holding.calculationBasis?.currentValue ?? holding.currentValue;
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return [];
    const category = holding.asset.assetClass === "stock" || holding.asset.assetClass === "etf"
      ? "equity" : holding.asset.assetClass;
    values[category] = values[category].plus(value);
    if (category === "crypto") spotCrypto = spotCrypto.plus(value);
  }
  const total = sumFinancialValues(Object.values(values));
  const futures = normalizeMoney(input.futuresEquityInr);
  return (["equity", "debt", "crypto", "cash"] as const).map(assetClass => ({
    assetClass,
    value: normalizeMoney(values[assetClass]),
    percentage: total.greaterThan(0)
      ? normalizePercentage(values[assetClass].dividedBy(total).times(100)) : null,
    cryptoBreakdown: assetClass === "crypto" ? {
      spot: normalizeMoney(spotCrypto), futures,
    } : null,
  }));
}

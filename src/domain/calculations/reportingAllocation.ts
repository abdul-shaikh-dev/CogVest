import type { Holding } from "@/src/types";
import { decimal, normalizeMoney, normalizePercentage, sumFinancialValues } from "../precision";

export type ReportingAllocationClass = "equity" | "debt" | "crypto" | "cash";

// Callers supply legacy-deduplicated holdings and independently valued accounts.
// Negative Futures equity stays unavailable rather than being hidden by spot gains.
export function calculateReportingAllocation(input: {
  holdings: readonly Holding[];
  cashBalance: number;
  ppfConfirmedBalance: number;
  epfRecordedBalance?: number | null;
  futuresEquityInr: number | null;
}) {
  const epf = input.epfRecordedBalance === undefined ? 0 : input.epfRecordedBalance;
  if (epf === null || !Number.isFinite(epf) || epf < 0 || input.futuresEquityInr === null || input.futuresEquityInr < 0 ||
      ![input.cashBalance, input.ppfConfirmedBalance, input.futuresEquityInr].every(Number.isFinite) ||
      input.holdings.some(holding => holding.valuation.status === "pending")) return [];
  const values = {
    equity: decimal(0), debt: decimal(input.ppfConfirmedBalance).plus(epf),
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

export type UnpricedHolding = { assetId: string; name: string; invested: number };

/**
 * Allocation of the priced part of the portfolio when some holdings have no
 * current value yet (#782). Unpriced holdings are listed, with what was
 * invested in them, rather than counted as zero. Null when anything other than
 * an unpriced holding makes allocation unavailable (Futures, EPF or Cash).
 */
export function calculatePricedReportingAllocation(input: Parameters<typeof calculateReportingAllocation>[0]) {
  const isPriced = (holding: Holding) => {
    const value = holding.calculationBasis?.currentValue ?? holding.currentValue;
    return holding.valuation.status !== "pending" && value !== null && value !== undefined
      && Number.isFinite(Number(value));
  };
  const priced = input.holdings.filter(isPriced);
  const allocation = calculateReportingAllocation({ ...input, holdings: priced });
  if (allocation.length === 0) return null;
  const excluded: UnpricedHolding[] = input.holdings.filter(holding => !isPriced(holding)).map(holding => ({
    assetId: holding.asset.id,
    name: holding.asset.name,
    invested: normalizeMoney(holding.calculationBasis?.totalInvested ?? holding.totalInvested),
  }));
  return { allocation, excluded };
}

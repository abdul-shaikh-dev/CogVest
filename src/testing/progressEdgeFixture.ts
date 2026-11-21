import { buildGeneratedMonthEndSnapshot } from "@/src/domain/calculations/monthEndSnapshots";
import type { HistoricalPriceResult, resolveHistoricalPrice } from "@/src/services/quotes";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { MonthlySnapshot } from "@/src/types";
import type { PortfolioStoreState } from "@/src/store";
import type { StoreApi } from "zustand/vanilla";

export const progressEdgeNow = new Date("2026-09-02T12:00:00Z");

function snapshot(month: string, value: number): MonthlySnapshot {
  return {
    id: `progress-edge-${month}`, month, portfolioValue: value,
    investedValue: value === 0 ? 0 : 10000, monthlyInvestment: 0,
    equityValue: value, debtValue: 0, cryptoValue: 0, cashValue: 0,
  };
}

/**
 * July 2026 reviewed and saved by the user, then a PPF contribution back-dated
 * to June 2025 (#747): July no longer has it, while the estimated months
 * around it were rebuilt with it.
 */
function seedOutdatedSavedMonth(store: StoreApi<PortfolioStoreState>) {
  const state = store.getState();
  state.addAsset({ id: "progress-edge", name: "Synthetic History Fund", symbol: "EDGE", ticker: "EDGE.NS", currency: "INR", assetClass: "stock" });
  state.addOpeningPosition({ id: "progress-edge-opening", assetId: "progress-edge", date: "2025-09-01", quantity: 10, averageCostPrice: 1000, currentPrice: 1000 });
  state.addPpfAccount({
    balanceAsOf: "2025-04-01", confirmedBalance: 30000, createdAt: "2026-08-01T00:00:00Z", id: "progress-edge-ppf",
    nickname: "Synthetic PPF", opening: { kind: "financialYear", financialYearStart: 2025 }, provider: "Synthetic Bank", status: "active",
  });
  const records = store.getState();
  const july = buildGeneratedMonthEndSnapshot({
    assets: records.assets, cashEntries: [], existingSnapshots: [], historicalQuotes: {}, now: progressEdgeNow,
    openingPositions: records.openingPositions, ppfAccounts: records.ppfAccounts, ppfLedgerEntries: [],
    quoteCache: {}, targetMonth: "2026-07", trades: [],
  }).snapshot;
  if (!july) throw new Error("Synthetic July could not be built.");
  const automatic = records.monthlySnapshots.find((item) => item.month === "2026-07");
  if (automatic) store.getState().removeMonthlySnapshot(automatic.id);
  store.getState().addMonthlySnapshot({ ...july, generated: { ...july.generated!, source: "manual" }, id: "progress-edge-2026-07" });
  store.getState().addPpfLedgerEntry({
    accountId: "progress-edge-ppf", amount: 50000, date: "2025-06-10", fundingSource: "external",
    id: "progress-edge-ppf-june", recordedAt: "2026-08-15T00:00:00Z", type: "contribution",
  });
}

export function createProgressEdgeFixture(scenario: string, minimal: boolean) {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => progressEdgeNow });
  store.getState().updatePreferences({ displayMode: minimal ? "minimal" : "standard", defaultChartRange: "ALL" });
  const isFetching = scenario === "building" || scenario === "error";
  if (isFetching) {
    store.getState().addAsset({ id: "progress-edge", name: "Synthetic History Fund", symbol: "EDGE", ticker: "EDGE.NS", currency: "INR", assetClass: "stock" });
    store.getState().addOpeningPosition({ id: "progress-edge-opening", assetId: "progress-edge", date: "2026-06-01", quantity: 10, averageCostPrice: 1000 });
    store.getState().addMonthlySnapshot(snapshot("2026-06", 12000));
  } else if (scenario === "single") {
    store.getState().addMonthlySnapshot(snapshot("2026-08", 12000));
  } else if (scenario === "gap") {
    for (const [month, value] of [["2026-05", 10000], ["2026-07", 13000], ["2026-08", 12000]] as const) {
      store.getState().addMonthlySnapshot(snapshot(month, value));
    }
  } else if (scenario === "outdated") {
    seedOutdatedSavedMonth(store);
  } else if (scenario === "zero") {
    store.getState().addMonthlySnapshot(snapshot("2026-07", 0));
    store.getState().addMonthlySnapshot(snapshot("2026-08", 0));
  }
  let released = false;
  let disposed = false;
  let attempts = 0;
  const pending: Array<() => void> = [];
  const unavailable: HistoricalPriceResult = { ok: false, error: "Synthetic historical price unavailable" };
  const fetcher: typeof resolveHistoricalPrice = async ({ asset, targetMonth }) => {
    attempts += 1;
    if (disposed || scenario === "error") return unavailable;
    if (scenario === "building" && !released) {
      await new Promise<void>((resolve) => pending.push(resolve));
    }
    if (disposed) return unavailable;
    return { ok: true, quote: { assetId: asset.id, asOfMonth: targetMonth, basis: "historical-close", currency: "INR", fetchedAt: progressEdgeNow.toISOString(), price: 1500, source: "yahoo" } };
  };
  function release() {
    released = true;
    pending.splice(0).forEach((resolve) => resolve());
  }
  return { store, fetcher, attempts: () => attempts, release, dispose: () => { disposed = true; release(); } };
}

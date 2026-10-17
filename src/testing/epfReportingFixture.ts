import { createPortfolioStore } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";

export const epfReportingDate = new Date("2026-10-05T10:00:00Z");
export function createEpfReportingFixture() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => epfReportingDate });
  store.getState().addAsset({ id: "debt", name: "Debt holding", symbol: "DEBT", ticker: "DEBT", assetClass: "debt", currency: "INR" });
  store.getState().addOpeningPosition({ id: "debt-opening", assetId: "debt", date: "2026-01-01",
    quantity: 1, averageCostPrice: 10000, currentPrice: 10000 });
  store.getState().addPpfAccount({ id: "ppf", nickname: "PPF", provider: "Post Office", status: "active",
    balanceAsOf: "2026-10-01", confirmedBalance: 50000, createdAt: "2026-10-01T00:00:00Z",
    opening: { kind: "financialYear", financialYearStart: 2020 } });
  store.getState().applyEpfCommand({ commandId: "setup", reason: "Synthetic statement", change: { type: "accountPut", account: {
    id: "epf", nickname: "EPF", provider: "epfo", status: "active", currency: "INR", historyCompleteThrough: null,
    checkpoint: { date: "2026-01-01", balance: { total: 140000, components: null }, capital: null,
      source: "epfoStatement", recordedAt: "2026-01-02T00:00:00Z" },
  } } }, store.getState().getBackupRevision());
  return store;
}

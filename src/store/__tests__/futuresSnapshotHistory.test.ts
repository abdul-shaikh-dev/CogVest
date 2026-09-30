import { buildGeneratedMonthEndSnapshot, calculateMonthlyPerformance } from "@/src/domain/calculations";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey, type FuturesCashTransferInput } from "@/src/store";
import { formatLocalCalendarDate } from "@/src/domain/dates";

const now = () => new Date("2026-10-10T10:00:00Z");
const funding: FuturesCashTransferInput = {
  accountId: "wallet", cashEntryId: "cash-funding", eventId: "funding", at: "2026-08-15T09:00:00Z",
  amountUsdt: "100", cashAmountInr: 9000, conversionFeeInr: "0",
  inrPerUsdt: "90", rateObservedAt: "2026-08-15T09:00:00Z", rateSource: "Receipt",
};

function setup() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addCashEntry({ id: "deposit", date: "2026-07-01", amount: 20000, type: "addition", purpose: "capitalContribution", label: "Deposit" });
  store.getState().saveFuturesAccount({ id: "wallet", settlementAsset: "USDT", marginMode: "cross", positionMode: "one-way", openingAt: "2026-07-01T00:00:00Z", openingWalletUsdt: "0", events: [] });
  for (const targetMonth of ["2026-07", "2026-08", "2026-09"]) {
    const state = store.getState();
    const result = buildGeneratedMonthEndSnapshot({
      ...state, existingSnapshots: [], historicalQuotes: state.historicalQuoteCache, now: now(), targetMonth,
    });
    store.getState().addMonthlySnapshot(result.snapshot!);
  }
  return { storage, store };
}

describe("Futures Cash history", () => {
  it("uses the persisted local Cash month for a transfer near UTC midnight", () => {
    const { store } = setup();
    const at = new Date(2026, 8, 1, 0, 30).toISOString();
    store.getState().saveFuturesCashTransfer({ ...funding, at, rateObservedAt: at });
    expect(store.getState().cashEntries.find((entry) => entry.id === funding.cashEntryId)?.date).toBe(formatLocalCalendarDate(new Date(at)));
    expect(store.getState().monthlySnapshots.map((item) => item.portfolioValue)).toEqual([20000, 20000, 11000]);
    expect(store.getState().monthlySnapshots[2].performanceBasis).toMatchObject({ netExternalFlow: -9000 });
  });

  it("preserves non-Cash values and nonempty market-price provenance", () => {
    const { store } = setup();
    store.getState().addAsset({ id: "stock", assetClass: "stock", instrumentType: "stock", currency: "INR", name: "QA stock", symbol: "QA", ticker: "QA.NS", sectorType: "energy" });
    store.getState().addOpeningPosition({ id: "opening", assetId: "stock", date: "2026-07-01", quantity: 10, averageCostPrice: 100, currentPrice: 150 });
    const state = store.getState();
    const snapshot = buildGeneratedMonthEndSnapshot({
      ...state, existingSnapshots: [], historicalQuotes: {}, now: now(), targetMonth: "2026-08",
    }).snapshot!;
    expect(snapshot.generated?.priceEvidence).toHaveLength(1);
    store.getState().updateMonthlySnapshot({ ...snapshot, id: state.monthlySnapshots[1].id });
    const before = store.getState().monthlySnapshots[1];
    store.getState().saveFuturesCashTransfer(funding);
    expect(store.getState().monthlySnapshots[1]).toMatchObject({ equityValue: 1500, portfolioValue: 12500, cashValue: 11000, investedValue: before.investedValue, generated: before.generated });
    expect(store.getState().monthlySnapshots[1].generated).toBe(before.generated);
  });

  it("preserves ambiguous legacy Cash corrections during transfer, hydration and restore", () => {
    const { storage, store } = setup();
    const august = store.getState().monthlySnapshots[1];
    const legacy = { ...august, cashValue: 25000, portfolioValue: 25000,
      generated: { ...august.generated!, priceEvidence: undefined } };
    store.getState().updateMonthlySnapshot(legacy);
    store.getState().saveFuturesCashTransfer(funding);
    expect(store.getState().monthlySnapshots[1]).toMatchObject({ cashValue: 25000, portfolioValue: 25000 });
    const payload = store.getState().captureBackup().payload;
    payload.portfolio.monthlySnapshots[1] = legacy;
    storage.setRawItem(portfolioStorageKey, JSON.stringify(payload.portfolio));
    const restarted = createPortfolioStore({ storage, now });
    expect(restarted.getState().monthlySnapshots[1]).toMatchObject({ cashValue: 25000, portfolioValue: 25000, performanceBasis: { netExternalFlow: -9000 } });
    const destination = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    destination.getState().replaceFromBackup(payload, destination.getState().getBackupRevision());
    expect(destination.getState().monthlySnapshots).toEqual(restarted.getState().monthlySnapshots);
  });

  it("refreshes existing generated totals and basis without replacing price evidence", () => {
    const { storage, store } = setup();
    const before = store.getState().monthlySnapshots;
    store.getState().saveFuturesCashTransfer(funding);
    const snapshots = store.getState().monthlySnapshots;
    expect(snapshots.map((item) => item.portfolioValue)).toEqual([20000, 11000, 11000]);
    expect(snapshots[0]).toBe(before[0]);
    expect(snapshots[1].generated).toBe(before[1].generated);
    expect(snapshots.map((item) => item.id)).toEqual(before.map((item) => item.id));
    expect(calculateMonthlyPerformance(snapshots[0], snapshots[1])).toMatchObject({ marketMovement: 0, marketMovementPct: 0, netExternalFlow: -9000 });
    expect(calculateMonthlyPerformance(snapshots[1], snapshots[2])).toMatchObject({ marketMovement: 0, netExternalFlow: 0 });
    expect(createPortfolioStore({ storage, now }).getState().monthlySnapshots).toEqual(snapshots);
    expect(store.getState().captureBackup().payload.portfolio.monthlySnapshots).toEqual(snapshots);
  });

  it("refreshes old and new date ranges, conversion fees, returns and deletion", () => {
    const { store } = setup();
    store.getState().saveFuturesCashTransfer(funding);
    store.getState().saveFuturesCashTransfer({ ...funding, at: "2026-09-15T09:00:00Z", rateObservedAt: "2026-09-15T09:00:00Z", cashAmountInr: 9010, conversionFeeInr: "10" });
    let snapshots = store.getState().monthlySnapshots;
    expect(snapshots.map((item) => item.portfolioValue)).toEqual([20000, 20000, 10990]);
    expect(snapshots[1].performanceBasis).toMatchObject({ netExternalFlow: 0 });
    expect(snapshots[2].performanceBasis).toMatchObject({ netExternalFlow: -9010 });
    store.getState().saveFuturesCashTransfer({ ...funding, eventId: "return", cashEntryId: "cash-return", at: "2026-09-20T09:00:00Z", rateObservedAt: "2026-09-20T09:00:00Z", amountUsdt: "-20", cashAmountInr: 1795, conversionFeeInr: "5" });
    snapshots = store.getState().monthlySnapshots;
    expect(snapshots[2].portfolioValue).toBe(12785);
    expect(calculateMonthlyPerformance(snapshots[1], snapshots[2])).toMatchObject({ marketMovement: 0, netExternalFlow: -7215 });
    store.getState().deleteFuturesCashTransfer("wallet", "return");
    store.getState().deleteFuturesCashTransfer("wallet", funding.eventId);
    expect(store.getState().monthlySnapshots.map((item) => item.portfolioValue)).toEqual([20000, 20000, 20000]);
    expect(store.getState().monthlySnapshots[2].performanceBasis).toMatchObject({ netExternalFlow: 0 });
  });

  it("preserves manual totals and unavailable evidence while refreshing classified flow evidence", () => {
    const { store } = setup();
    const [july, august, september] = store.getState().monthlySnapshots;
    store.getState().updateMonthlySnapshot({ ...august, cashValue: 25000, portfolioValue: 25000, generated: { ...august.generated!, source: "manual" } });
    const manualSeptember = { ...september, generated: undefined, performanceBasis: { reason: "manual-snapshot" as const, status: "unavailable" as const, warnings: ["Manual evidence"] } };
    store.getState().updateMonthlySnapshot(manualSeptember);
    store.getState().saveFuturesCashTransfer(funding);
    expect(store.getState().monthlySnapshots[0]).toEqual(july);
    expect(store.getState().monthlySnapshots[1]).toMatchObject({ cashValue: 25000, portfolioValue: 25000, performanceBasis: { netExternalFlow: -9000 } });
    expect(store.getState().monthlySnapshots[2]).toEqual(manualSeptember);
  });

  it("repairs older persisted auto history once and applies the same repair on restore", () => {
    const { storage, store } = setup();
    const stale = store.getState().monthlySnapshots;
    store.getState().saveFuturesCashTransfer(funding);
    const payload = store.getState().captureBackup().payload;
    payload.portfolio.monthlySnapshots = stale;
    storage.setRawItem(portfolioStorageKey, JSON.stringify(payload.portfolio));
    const write = jest.spyOn(storage, "setItem");
    const restarted = createPortfolioStore({ storage, now });
    expect(restarted.getState().monthlySnapshots.map((item) => item.portfolioValue)).toEqual([20000, 11000, 11000]);
    expect(write).toHaveBeenCalledTimes(1);
    createPortfolioStore({ storage, now });
    expect(write).toHaveBeenCalledTimes(1);
    const destination = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    destination.getState().replaceFromBackup(payload, destination.getState().getBackupRevision());
    expect(destination.getState().monthlySnapshots).toEqual(restarted.getState().monthlySnapshots);
  });

  it.each(["create", "correct", "delete"] as const)("keeps snapshots and both ledgers unchanged on failed %s persistence", (action) => {
    const { storage, store } = setup();
    if (action !== "create") store.getState().saveFuturesCashTransfer(funding);
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    storage.setItem = () => { throw new Error("Storage full"); };
    expect(() => action === "delete" ? store.getState().deleteFuturesCashTransfer("wallet", funding.eventId) : store.getState().saveFuturesCashTransfer({ ...funding, amountUsdt: "50", cashAmountInr: 4500 })).toThrow("Storage full");
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
  });

  it("retains original persisted records and enters recovery when startup repair cannot be saved", () => {
    const { storage, store } = setup();
    const stale = store.getState().monthlySnapshots;
    store.getState().saveFuturesCashTransfer(funding);
    const payload = store.getState().captureBackup().payload;
    storage.setRawItem(portfolioStorageKey, JSON.stringify({ ...payload.portfolio, monthlySnapshots: stale }));
    const raw = storage.getRawItem(portfolioStorageKey);
    storage.setItem = () => { throw new Error("Storage full"); };
    expect(createPortfolioStore({ storage, now }).getState().storageRecovery).toBeDefined();
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
  });
});

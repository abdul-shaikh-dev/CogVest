import { calculateUsdmPortfolioContribution, replayUsdmFutures, type UsdmFuturesAccount } from "@/src/domain/usdmFutures";
import { validateBackupPayload } from "@/src/domain/portfolioBackup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey, type FuturesCashTransferInput } from "@/src/store";

const now = () => new Date("2026-09-10T10:00:00Z");
const openingAt = "2026-09-01T00:00:00Z";
const at = "2026-09-09T09:00:00Z";
const account: UsdmFuturesAccount = {
  id: "binance-usdm-main", settlementAsset: "USDT", marginMode: "cross", positionMode: "one-way",
  openingAt, openingWalletUsdt: "0", events: [],
};
const funding: FuturesCashTransferInput = {
  accountId: account.id, cashEntryId: "cash-funding", eventId: "wallet-funding", at,
  amountUsdt: "100", cashAmountInr: 9010, conversionFeeInr: "10",
  inrPerUsdt: "90", rateObservedAt: at, rateSource: "Dated conversion receipt",
};

function fundedStore(cash = 20000) {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now });
  store.getState().addCashEntry({ id: "cash-opening", amount: cash, date: "2026-09-01", label: "Opening Cash", purpose: "capitalContribution", type: "addition" });
  store.getState().saveFuturesAccount(account);
  return { storage, store };
}

describe("linked INR Cash and USDT Futures funding", () => {
  it("moves value exactly once and separately records the open position", () => {
    const { storage, store } = fundedStore();
    store.getState().saveFuturesCashTransfer(funding);
    const cashEntries = store.getState().cashEntries;
    expect(cashEntries.find((item) => item.id === funding.cashEntryId)).toMatchObject({ amount: 9010, purpose: "futuresTransfer", type: "withdrawal", linkedFutures: { accountId: account.id, eventId: funding.eventId } });
    expect(store.getState().futuresAccounts[0].events).toHaveLength(1);
    expect(replayUsdmFutures(store.getState().futuresAccounts[0], { asOf: now().toISOString(), marks: [] }).positions).toEqual([]);

    const withPosition: UsdmFuturesAccount = {
      ...store.getState().futuresAccounts[0],
      events: [...store.getState().futuresAccounts[0].events, { id: "buy", type: "execution", at: "2026-09-09T09:01:00Z", contract: "BTCUSDT", side: "buy", quantity: "1", price: "100", feeUsdt: "0", leverage: "5" }],
      eventRates: [...store.getState().futuresAccounts[0].eventRates!, { eventId: "buy", observedAt: "2026-09-09T09:01:00Z", inrPerUsdt: "90", source: "Dated quote" }],
      valuation: {
        asOf: "2026-09-10T09:00:00Z",
        marks: [{ contract: "BTCUSDT", priceUsdt: "110", observedAt: "2026-09-10T09:00:00Z", source: "Binance mark" }],
        inrRate: { inrPerUsdt: "90", observedAt: "2026-09-10T09:00:00Z", source: "Dated quote" },
        reconciliation: { observedWalletUsdt: "100", observedAt: "2026-09-10T09:00:00Z", source: "Binance Futures wallet", allOpenPositionsConfirmed: true, allWalletEventsConfirmed: true, portfolioBoundaryConfirmed: true },
      },
    };
    store.getState().saveFuturesAccount(withPosition);
    const replay = replayUsdmFutures(withPosition, { asOf: now().toISOString(), marks: withPosition.valuation!.marks });
    expect(replay.positions[0]).toMatchObject({ signedQuantity: "1", unrealizedPnlUsdt: "10" });
    expect(calculateUsdmPortfolioContribution(withPosition, now().toISOString(), cashEntries)).toMatchObject({ status: "ready", equityInr: "9900.00", investedInr: "9010.00", pnlInr: "890.00" });
    expect(cashEntries.reduce((sum, item) => sum + (item.type === "addition" ? item.amount : -item.amount), 0)).toBe(10990);
    const restarted = createPortfolioStore({ storage, now });
    expect(restarted.getState().cashEntries).toEqual(cashEntries);
    expect(restarted.getState().futuresAccounts[0]).toEqual(withPosition);
    const destination = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    destination.getState().replaceFromBackup(store.getState().captureBackup().payload, destination.getState().captureBackup().revision);
    expect(destination.getState().cashEntries).toEqual(cashEntries);
  });

  it("rejects insufficient dated Cash, mismatched conversion and future funding atomically", () => {
    const { storage, store } = fundedStore(1000);
    const before = storage.getRawItem(portfolioStorageKey);
    expect(() => store.getState().saveFuturesCashTransfer(funding)).toThrow(/negative/);
    expect(() => store.getState().saveFuturesCashTransfer({ ...funding, cashAmountInr: 900 })).toThrow(/reconcile/);
    expect(() => store.getState().saveFuturesCashTransfer({ ...funding, cashAmountInr: 900.001 })).toThrow(/paise/);
    expect(() => store.getState().saveFuturesCashTransfer({ ...funding, at: "2026-09-11T00:00:00Z" })).toThrow(/future/);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(before);
    expect(store.getState().futuresAccounts[0].events).toEqual([]);
  });

  it("dates the Cash leg by local calendar day across the UTC midnight boundary", () => {
    const storage = createMemoryJsonStorage();
    const localNow = () => new Date("2026-09-10T02:00:00+05:30");
    const store = createPortfolioStore({ storage, now: localNow });
    store.getState().addCashEntry({ id: "cash-opening", amount: 10000, date: "2026-09-10", label: "Opening Cash", purpose: "capitalContribution", type: "addition" });
    store.getState().saveFuturesAccount({ ...account, openingAt: "2026-09-09T23:00:00+05:30" });
    store.getState().saveFuturesCashTransfer({
      ...funding, at: "2026-09-10T01:30:00+05:30", cashAmountInr: 9000,
      conversionFeeInr: "0", rateObservedAt: "2026-09-10T01:30:00+05:30",
    });
    expect(store.getState().cashEntries.find((entry) => entry.id === funding.cashEntryId)?.date)
      .toBe("2026-09-10");
    expect(store.getState().cashEntries.find((entry) => entry.id === funding.cashEntryId)?.date)
      .not.toBe("2026-09-09");
    expect(store.getState().futuresAccounts[0].events[0]).toMatchObject({ cashDate: "2026-09-10" });
    expect(createPortfolioStore({ storage, now: localNow }).getState().cashEntries).toHaveLength(2);
  });

  it("corrects and removes both sides while rejecting one-sided edits", () => {
    const { store } = fundedStore();
    store.getState().saveFuturesCashTransfer(funding);
    const linkedCash = store.getState().cashEntries.find((item) => item.id === funding.cashEntryId)!;
    expect(store.getState().correctManualCashEntry({ ...linkedCash, amount: 9020 })).toMatchObject({ status: "rejected", reason: "linkedEntry" });
    expect(() => store.getState().removeCashEntry(linkedCash.id)).toThrow(/Linked cash/);
    expect(() => store.getState().deleteFuturesAccount(account.id)).toThrow(/Remove linked Cash/);
    expect(() => store.getState().saveFuturesAccount({ ...store.getState().futuresAccounts[0], events: [], eventRates: [] })).toThrow(/matching/);
    store.getState().saveFuturesCashTransfer({ ...funding, amountUsdt: "50", cashAmountInr: 4505, conversionFeeInr: "5" });
    expect(store.getState().cashEntries.find((item) => item.id === linkedCash.id)?.amount).toBe(4505);
    expect(store.getState().futuresAccounts[0].events[0]).toMatchObject({ amountUsdt: "50" });
    store.getState().deleteFuturesCashTransfer(account.id, funding.eventId);
    expect(store.getState().cashEntries).toHaveLength(1);
    expect(store.getState().futuresAccounts[0].events).toEqual([]);
  });

  it("keeps unlinked internal Spot transfers pending and rejects a detached backup link", () => {
    const { store } = fundedStore();
    store.getState().saveFuturesCashTransfer(funding);
    const tampered = store.getState().captureBackup().payload;
    tampered.portfolio.cashEntries = tampered.portfolio.cashEntries.filter((item) => item.id !== funding.cashEntryId);
    expect(() => validateBackupPayload(tampered)).toThrow(/linked|matching/i);
    const current = store.getState().futuresAccounts[0];
    expect(calculateUsdmPortfolioContribution({ ...current, events: [...current.events, { type: "transfer", id: "spot", at, amountUsdt: "1", transferBoundary: "internal" }] }, now().toISOString(), store.getState().cashEntries)).toMatchObject({ status: "pending" });
  });

  it("returns USDT to Cash without treating it as an external contribution", () => {
    const { store } = fundedStore();
    store.getState().saveFuturesCashTransfer(funding);
    store.getState().saveFuturesCashTransfer({ ...funding, cashEntryId: "cash-return", eventId: "wallet-return", at: "2026-09-09T10:00:00Z", amountUsdt: "-20", cashAmountInr: 1795, conversionFeeInr: "5", rateObservedAt: "2026-09-09T10:00:00Z" });
    expect(store.getState().cashEntries.find((item) => item.id === "cash-return")).toMatchObject({ amount: 1795, type: "addition", purpose: "futuresTransfer" });
    const current = store.getState().futuresAccounts[0];
    expect(replayUsdmFutures(current, { asOf: now().toISOString(), marks: [] }).walletUsdt).toBe("80");
    expect(store.getState().cashEntries.reduce((sum, item) => sum + (item.type === "addition" ? item.amount : -item.amount), 0)).toBe(12785);
    const valued: UsdmFuturesAccount = { ...current, valuation: {
      asOf: "2026-09-10T09:00:00Z", marks: [],
      inrRate: { inrPerUsdt: "90", observedAt: "2026-09-10T09:00:00Z", source: "Dated quote" },
      reconciliation: { observedWalletUsdt: "80", observedAt: "2026-09-10T09:00:00Z", source: "Binance Futures wallet", allOpenPositionsConfirmed: true, allWalletEventsConfirmed: true, portfolioBoundaryConfirmed: true },
    } };
    store.getState().saveFuturesAccount(valued);
    expect(calculateUsdmPortfolioContribution(valued, now().toISOString(), store.getState().cashEntries)).toMatchObject({ status: "ready", equityInr: "7200.00", investedInr: "7215.00", pnlInr: "-15.00" });
    store.getState().deleteFuturesCashTransfer(account.id, "wallet-return");
    expect(store.getState().cashEntries.some((item) => item.id === "cash-return")).toBe(false);
  });

  it("leaves both ledgers unchanged if persistence fails", () => {
    const { storage, store } = fundedStore();
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    const original = storage.setItem;
    storage.setItem = () => { throw new Error("Storage full"); };
    expect(() => store.getState().saveFuturesCashTransfer(funding)).toThrow("Storage full");
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    storage.setItem = original;
  });
});

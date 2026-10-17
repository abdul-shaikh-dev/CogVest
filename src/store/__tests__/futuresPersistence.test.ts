import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { UsdmFuturesAccount } from "@/src/domain/usdmFutures";

const now = () => new Date("2026-09-10T10:00:00.000Z");
const account: UsdmFuturesAccount = {
  id: "futures-usdt",
  settlementAsset: "USDT",
  marginMode: "cross",
  positionMode: "one-way",
  openingAt: "2026-01-01T00:00:00Z",
  openingWalletUsdt: "1000.00000001",
  events: [
    { id: "open", type: "execution", at: "2026-01-02T00:00:00Z", contract: "BTCUSDT", side: "buy", quantity: "0.5", price: "100", feeUsdt: "0.00000001" },
    { id: "close", type: "execution", at: "2026-01-03T00:00:00Z", contract: "BTCUSDT", side: "sell", quantity: "0.5", price: "110", feeUsdt: "0.00000001" },
  ],
};

describe("Futures account persistence", () => {
  it("saves and corrects raw executions, survives restart and backup replacement", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    store.getState().saveFuturesAccount(account);
    expect(store.getState().futuresAccounts).toEqual([account]);
    expect(createPortfolioStore({ storage, now }).getState().futuresAccounts).toEqual([account]);

    const corrected = { ...account, events: [account.events[0], { ...account.events[1], price: "120" }] } as UsdmFuturesAccount;
    store.getState().saveFuturesAccount(corrected);
    expect(store.getState().futuresAccounts).toEqual([corrected]);
    expect(createPortfolioStore({ storage, now }).getState().futuresAccounts).toEqual([corrected]);

    const payload = store.getState().captureBackup().payload;
    const destination = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    destination.getState().replaceFromBackup(payload, destination.getState().captureBackup().revision);
    expect(destination.getState().futuresAccounts).toEqual([corrected]);
  });

  it("rejects invalid records before writing memory or storage", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    const before = store.getState();
    expect(() => store.getState().saveFuturesAccount({ ...account, settlementAsset: "USDC" as "USDT" })).toThrow();
    expect(() => store.getState().saveFuturesAccount({ ...account, extra: "discarded" } as UsdmFuturesAccount)).toThrow();
    expect(() => store.getState().saveFuturesAccount({ ...account, events: [...account.events, { ...account.events[0], id: "close" }] })).toThrow();
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBeNull();
  });

  it("keeps the old value when storage rejects a correction", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    store.getState().saveFuturesAccount(account);
    const before = storage.getRawItem(portfolioStorageKey);
    const state = store.getState();
    const originalSet = storage.setItem;
    storage.setItem = () => { throw new Error("Storage full"); };
    expect(() => store.getState().saveFuturesAccount({ ...account, openingWalletUsdt: "2000" })).toThrow("Storage full");
    expect(store.getState()).toBe(state);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(before);
    storage.setItem = originalSet;
  });

  it("migrates a V13 portfolio to an empty Futures collection", () => {
    const storage = createMemoryJsonStorage({ [portfolioStorageKey]: { schemaVersion: 13, assets: [], cashEntries: [], monthlySnapshots: [], openingPositions: [], ppfAccounts: [], ppfLedgerEntries: [], preferences: { maskWealthValues: false }, trades: [] } });
    const store = createPortfolioStore({ storage, now });
    expect(store.getState().futuresAccounts).toEqual([]);
    expect(store.getState().schemaVersion).toBe(16);
  });

  it("preserves closed trades from before the wallet cutover across restart and restore", () => {
    const historical: UsdmFuturesAccount = {
      ...account,
      events: [
        { ...account.events[0], id: "old-open", at: "2025-12-29T00:00:00Z" },
        { ...account.events[1], id: "old-close", at: "2025-12-30T00:00:00Z" },
      ],
    };
    const storage = createMemoryJsonStorage();
    const source = createPortfolioStore({ storage, now });
    source.getState().saveFuturesAccount(historical);
    const restarted = createPortfolioStore({ storage, now });
    expect(restarted.getState().futuresAccounts).toEqual([historical]);
    const destination = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    destination.getState().replaceFromBackup(
      restarted.getState().captureBackup().payload,
      destination.getState().captureBackup().revision,
    );
    expect(destination.getState().futuresAccounts).toEqual([historical]);
  });

  it("round-trips dated FX, wallet and portfolio-boundary evidence", () => {
    const complete: UsdmFuturesAccount = {
      ...account,
      openingRate: { inrPerUsdt: "90", observedAt: account.openingAt, source: "Historical INR quote" },
      eventRates: account.events.map((event) => ({ eventId: event.id, inrPerUsdt: "91", observedAt: event.at, source: "Historical INR quote" })),
      valuation: {
        asOf: "2026-09-10T09:00:00Z", marks: [],
        inrRate: { inrPerUsdt: "92", observedAt: "2026-09-10T09:00:00Z", source: "Manual INR quote" },
        reconciliation: { observedWalletUsdt: "1004.99999999", observedAt: "2026-09-10T09:00:00Z", source: "Binance Futures wallet", allOpenPositionsConfirmed: true, allWalletEventsConfirmed: true, portfolioBoundaryConfirmed: true },
      },
    };
    const storage = createMemoryJsonStorage();
    const source = createPortfolioStore({ storage, now });
    source.getState().saveFuturesAccount(complete);
    expect(createPortfolioStore({ storage, now }).getState().futuresAccounts).toEqual([complete]);
    const destination = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    destination.getState().replaceFromBackup(source.getState().captureBackup().payload, destination.getState().captureBackup().revision);
    expect(destination.getState().futuresAccounts).toEqual([complete]);
    const before = source.getState();
    expect(() => source.getState().saveFuturesAccount({ ...complete, eventRates: [{ ...complete.eventRates![0], eventId: "unknown" }] })).toThrow("unknown event");
    expect(() => source.getState().saveFuturesAccount({ ...complete, valuation: { ...complete.valuation!, asOf: "2026-09-11T09:00:00Z" } })).toThrow();
    expect(source.getState()).toBe(before);
  });

  it("deletes the entire wallet atomically and leaves no pending portfolio contribution", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now });
    store.getState().saveFuturesAccount(account);
    store.getState().deleteFuturesAccount(account.id);
    expect(store.getState().futuresAccounts).toEqual([]);
    expect(createPortfolioStore({ storage, now }).getState().futuresAccounts).toEqual([]);
  });
});

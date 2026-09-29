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
    expect(store.getState().schemaVersion).toBe(14);
  });
});

import { describeSaveFailure } from "@/src/store/saveFailure";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import { UnloadablePortfolioError } from "@/src/store/persistence";
import type { Asset } from "@/src/types";

// #712: a save must never leave records that quarantine the portfolio at the
// next start.
const now = () => new Date("2026-06-30T12:00:00.000Z");
const ppf = {
  assetClass: "debt",
  currency: "INR",
  id: "asset-ppf",
  instrumentType: "ppf",
  name: "PPF",
  sectorType: "fixedIncome",
  symbol: "PPF",
  ticker: "PPF",
} as Asset;

function linkedPpfStore() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ now, storage });
  store.getState().addAsset(ppf);
  store.getState().addOpeningPosition({
    assetId: ppf.id, averageCostPrice: 1, date: "2026-01-01", id: "op-ppf", quantity: 1000,
  } as never);
  store.getState().addPpfAccount({
    balanceAsOf: "2026-02-01",
    confirmedBalance: 1000,
    createdAt: "2026-02-01T10:00:00.000Z",
    id: "ppf-account",
    legacyAssetId: ppf.id,
    nickname: "Primary",
    opening: { kind: "financialYear", financialYearStart: 2025 },
    provider: "India Post",
    status: "active",
  });
  return { storage, store };
}

function expectCleanReopen(storage: ReturnType<typeof createMemoryJsonStorage>) {
  const reopened = createPortfolioStore({ now, storage });
  expect(reopened.getState().storageRecovery).toBeUndefined();
  expect(reopened.getState().ppfAccounts).toHaveLength(1);
  expect(reopened.getState().assets.map((asset) => asset.id)).toContain(ppf.id);
  expect(() => reopened.getState().captureBackup()).not.toThrow();
}

describe("assets linked to a PPF account (#712)", () => {
  it("refuses to delete the linked holding and reopens cleanly", () => {
    const { storage, store } = linkedPpfStore();

    expect(store.getState().deleteAsset(ppf.id)).toEqual({ reason: "linkedPpf", status: "rejected" });
    expectCleanReopen(storage);
  });

  it("refuses to change the linked holding away from PPF and reopens cleanly", () => {
    const { storage, store } = linkedPpfStore();

    expect(store.getState().correctAsset({ ...ppf, instrumentType: "fixedDeposit" } as Asset))
      .toEqual({ reason: "linkedPpf", status: "rejected" });
    expect(store.getState().assets.find((asset) => asset.id === ppf.id)?.instrumentType).toBe("ppf");
    expectCleanReopen(storage);
  });

  it("still allows other corrections to the linked holding", () => {
    const { storage, store } = linkedPpfStore();

    expect(store.getState().correctAsset({ ...ppf, name: "Post office PPF" }).status).toBe("applied");
    expectCleanReopen(storage);
  });
});

describe("asset metadata and load-time checks (#712)", () => {
  it("drops an invalid ISIN instead of saving it", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });

    store.getState().addAsset({ ...ppf, id: "fd", instrumentType: "fixedDeposit", isin: "BAD", ticker: "FD", symbol: "FD" } as Asset);

    expect(store.getState().assets[0]).not.toHaveProperty("isin");
    const reopened = createPortfolioStore({ now, storage });
    expect(reopened.getState().storageRecovery).toBeUndefined();
    expect(reopened.getState().assets).toHaveLength(1);
  });

  it("refuses any write the next start could not load, leaving storage untouched", () => {
    const { storage, store } = linkedPpfStore();
    const before = storage.getRawItem(portfolioStorageKey);
    // Simulate a future write path that forgets a graph rule.
    store.setState({ assets: store.getState().assets.filter((asset) => asset.id !== ppf.id) });

    let error: unknown;
    try {
      store.getState().addCashEntry({
        amount: 100, date: "2026-03-01", id: "cash", label: "Cash", purpose: "capitalContribution", type: "addition",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(UnloadablePortfolioError);
    expect(describeSaveFailure(error, "fallback")).toMatch(/nothing was saved/);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(before);
    expectCleanReopen(storage);
  });
});

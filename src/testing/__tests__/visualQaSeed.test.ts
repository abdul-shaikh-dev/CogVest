import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import {
  canUseVisualQaHarness,
  resolveVisualQaQuote,
  seedVisualQaPortfolio,
  visualQaAssetLookupResults,
  visualQaSeedToken,
} from "@/src/testing/visualQaSeed";

describe("visual QA harness access", () => {
  it("requires both a development build and the local token", () => {
    expect(
      canUseVisualQaHarness({
        isDevelopment: true,
        token: visualQaSeedToken,
      }),
    ).toBe(true);
    expect(
      canUseVisualQaHarness({ isDevelopment: true, token: "wrong" }),
    ).toBe(false);
  });

  it("cannot be enabled in a release build with the known token", () => {
    expect(
      canUseVisualQaHarness({
        isDevelopment: false,
        token: visualQaSeedToken,
      }),
    ).toBe(false);
  });
});

describe("seedVisualQaPortfolio", () => {
  it("optionally seeds sixty consecutive months without changing the latest baseline", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    seedVisualQaPortfolio(store, { longHistory: true });
    const snapshots = store.getState().monthlySnapshots;
    expect(snapshots).toHaveLength(60);
    expect(new Set(snapshots.map((item) => item.month)).size).toBe(60);
    expect(snapshots[0].month).toBe("2021-06");
    expect(snapshots[52].month).toBe("2025-10");
    expect(snapshots[53].month).toBe("2025-11");
    expect(snapshots.at(-1)).toMatchObject({
      month: "2026-05", portfolioValue: 1987450,
    });
    snapshots.forEach((item) => {
      expect(item.portfolioValue).toBe(
        item.equityValue + item.debtValue + item.cryptoValue + item.cashValue,
      );
    });
    seedVisualQaPortfolio(store);
    expect(store.getState().monthlySnapshots).toHaveLength(7);
  });

  it("creates a deterministic V1 parity dataset", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    seedVisualQaPortfolio(store);

    const state = store.getState();

    expect(state.assets.map((asset) => asset.assetClass)).toEqual([
      "stock",
      "etf",
      "debt",
      "crypto",
      "debt",
    ]);
    expect(
      state.assets.find((asset) => asset.isin === "INF000000001"),
    ).toMatchObject({
      instrumentType: "mutualFund",
      name: "Sample Equity Fund",
    });
    expect(
      state.openingPositions.some(
        (position) => position.assetId === "visual-qa-asset-sample-fund",
      ),
    ).toBe(false);
    expect(state.cashEntries).toHaveLength(4);
    expect(state.openingPositions).toHaveLength(4);
    expect(state.openingPositions.some((position) => position.conviction)).toBe(
      true,
    );
    expect(state.monthlySnapshots).toHaveLength(7);
    expect(state.monthlySnapshots.map((snapshot) => snapshot.month)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
    ]);
    expect(state.monthlySnapshots.at(-1)).toMatchObject({
      investedValue: 1721000,
      monthlyInvestment: 45000,
      portfolioValue: 1987450,
    });
    expect(Object.values(state.quoteCache).map((quote) => quote.source)).toEqual([
      "yahoo",
      "yahoo",
      "manual",
      "coingecko",
    ]);
    expect(state.preferences.maskWealthValues).toBe(false);
    expect(state.preferences.hasCompletedOnboarding).toBe(true);
    expect(
      visualQaAssetLookupResults.find(
        (result) => result.quoteSourceId === "TCS.NS",
      ),
    ).toMatchObject({ name: "Tata Consultancy Services", provider: "yahoo" });
    expect(
      state.assets.some((asset) => asset.quoteSourceId === "TCS.NS"),
    ).toBe(false);
  });

  it("resets existing raw state before seeding", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addCashEntry({
      amount: 1,
      date: "2026-01-01T00:00:00.000Z",
      id: "old-cash",
      label: "Old cash",
      purpose: "capitalContribution",
      type: "addition",
    });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      id: "old-asset",
      instrumentType: "stock",
      name: "Old asset",
      sectorType: "other",
      symbol: "OLD",
      ticker: "OLD.NS",
    });
    store.getState().upsertHistoricalQuote({
      asOfMonth: "2026-01",
      assetId: "old-asset",
      basis: "historical-close",
      currency: "INR",
      fetchedAt: "2026-02-01T00:00:00.000Z",
      price: 999,
      source: "yahoo",
    });

    seedVisualQaPortfolio(store);
    seedVisualQaPortfolio(store);

    const state = store.getState();

    expect(state.cashEntries.map((entry) => entry.id)).not.toContain("old-cash");
    expect(state.assets).toHaveLength(5);
    expect(state.cashEntries).toHaveLength(4);
    expect(state.monthlySnapshots).toHaveLength(7);
    expect(state.historicalQuoteCache).toEqual({});
  });

  it("resolves the deterministic quote that belongs to each lookup identity", () => {
    const niftyLookup = visualQaAssetLookupResults.find(
      (result) => result.quoteSourceId === "NIFTYBEES.NS",
    );

    expect(niftyLookup).toBeDefined();
    expect(
      resolveVisualQaQuote({
        ...niftyLookup!,
        id: "generated-nifty-asset",
      }),
    ).toMatchObject({
      ok: true,
      quote: {
        assetId: "generated-nifty-asset",
        price: 255.32,
        source: "yahoo",
      },
    });

    const tcsLookup = visualQaAssetLookupResults.find(
      (result) => result.quoteSourceId === "TCS.NS",
    );

    expect(tcsLookup).toBeDefined();
    expect(
      resolveVisualQaQuote({
        ...tcsLookup!,
        id: "generated-tcs-asset",
      }),
    ).toMatchObject({
      ok: true,
      quote: {
        assetId: "generated-tcs-asset",
        price: 3150.25,
        source: "yahoo",
      },
    });
  });
});

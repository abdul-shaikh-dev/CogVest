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
  it("creates a deterministic V1 parity dataset", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    seedVisualQaPortfolio(store);

    const state = store.getState();

    expect(state.assets.map((asset) => asset.assetClass)).toEqual([
      "stock",
      "etf",
      "debt",
      "crypto",
    ]);
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

    seedVisualQaPortfolio(store);
    seedVisualQaPortfolio(store);

    const state = store.getState();

    expect(state.cashEntries.map((entry) => entry.id)).not.toContain("old-cash");
    expect(state.assets).toHaveLength(4);
    expect(state.cashEntries).toHaveLength(4);
    expect(state.monthlySnapshots).toHaveLength(7);
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
  });
});

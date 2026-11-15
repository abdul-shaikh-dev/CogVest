import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import {
  buildE2ePortfolioEvidence,
  toEvidenceKey,
} from "@/src/testing/e2eEvidence";

describe("buildE2ePortfolioEvidence", () => {
  it("projects persisted identity, quote, position, and derived-value evidence", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const state = store.getState();

    state.addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "asset-hdfc",
      instrumentType: "stock",
      name: "HDFC Bank",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "financialServices",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    state.addOpeningPosition({
      assetId: "asset-hdfc",
      averageCostPrice: 1500,
      date: "2026-01-01T00:00:00.000Z",
      id: "position-hdfc",
      notes: "Core bank",
      quantity: 2,
    });
    state.upsertQuote({
      asOf: "2026-01-02T00:00:00.000Z",
      assetId: "asset-hdfc",
      currency: "INR",
      price: 1678.25,
      source: "yahoo",
    });

    const evidence = buildE2ePortfolioEvidence(store.getState());

    expect(evidence).toMatchObject({
      assetCount: 1,
      cashEntryCount: 0,
      duplicateIdentityCount: 0,
      openingPositionCount: 1,
      importedTransactionCount: 0,
      ppfCount: 0,
      rollupTotals: {
        totalCurrentValue: 3356.5,
        totalInvested: 3000,
        valuationCoverage: { status: "complete" },
      },
      tradeCount: 0,
    });
    expect(evidence.assets[0]).toMatchObject({
      key: "hdfcbank-ns",
      holding: {
        currentValue: 3356.5,
        totalInvested: 3000,
        totalUnits: 2,
      },
      quote: {
        price: 1678.25,
        source: "yahoo",
      },
    });
  });

  it("projects PPF balances into Debt allocation without a synthetic asset", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    store.getState().addPpfAccount({
      balanceAsOf: "2026-01-01",
      confirmedBalance: 100000,
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "ppf-1",
      nickname: "Primary PPF",
      opening: { financialYearStart: 2020, kind: "financialYear" },
      provider: "India Post",
      status: "active",
    });

    const evidence = buildE2ePortfolioEvidence(
      store.getState(),
      new Date("2026-02-01T00:00:00.000Z"),
    );

    expect(evidence).toMatchObject({
      assetCount: 0,
      ppfConfirmedBalance: 100000,
      ppfCount: 1,
      rollupTotals: {
        totalCurrentValue: 100000,
        totalInvested: 100000,
      },
    });
    expect(evidence.allocation).toEqual([
      { assetClass: "debt", percentage: 100, value: 100000 },
    ]);
    expect(evidence.ppfAccounts[0]?.account.legacyAssetId).toBeUndefined();
  });

  it("reports every stored asset that conflicts with a canonical identity", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const baseAsset = {
      assetClass: "stock" as const,
      currency: "INR" as const,
      exchange: "NSE" as const,
      instrumentType: "stock" as const,
      name: "HDFC Bank",
      quoteSourceId: "HDFCBANK.NS",
      sectorType: "financialServices" as const,
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };

    store.setState({
      assets: [
        { ...baseAsset, id: "asset-one" },
        { ...baseAsset, id: "asset-two" },
      ],
    });

    expect(buildE2ePortfolioEvidence(store.getState()).duplicateIdentityCount).toBe(
      2,
    );
  });

  it("reports cash, EPF, snapshot and value-mask state for smoke flows (#673)", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const state = store.getState();
    const now = new Date(2026, 3, 21, 12);

    expect(buildE2ePortfolioEvidence(state, now)).toMatchObject({
      cashBalance: 0,
      epfAccountCount: 0,
      epfEventCount: 0,
      latestSnapshotMonth: null,
      maskWealthValues: false,
      monthlySnapshotCount: 0,
    });

    state.addCashEntry({
      amount: 1000, date: "2026-04-20", id: "cash-1", label: "Broker cash",
      purpose: "capitalContribution", type: "addition",
    });
    state.addCashEntry({
      amount: 500, date: "2026-05-01", id: "cash-future", label: "Not yet",
      purpose: "capitalContribution", type: "addition",
    });
    state.updatePreferences({ maskWealthValues: true });
    const stored = store.getState();
    const evidence = buildE2ePortfolioEvidence({
      ...stored,
      epf: { ...stored.epf, accounts: [{}, {}] as never, events: [{}, {}, {}] as never },
      monthlySnapshots: [{ month: "2026-03" }, { month: "2026-01" }] as never,
    }, now);

    expect(evidence).toMatchObject({
      // A future-dated entry is stored but not yet in the balance.
      cashBalance: 1000,
      cashEntryCount: 2,
      epfAccountCount: 2,
      epfEventCount: 3,
      latestSnapshotMonth: "2026-03",
      maskWealthValues: true,
      monthlySnapshotCount: 2,
    });
  });

  it("normalizes provider identities for stable test IDs", () => {
    expect(toEvidenceKey(" HDFCBANK.NS ")).toBe("hdfcbank-ns");
    expect(toEvidenceKey("coingecko:bitcoin")).toBe("coingecko-bitcoin");
  });
});

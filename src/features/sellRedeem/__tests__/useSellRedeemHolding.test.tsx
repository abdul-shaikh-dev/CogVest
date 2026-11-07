import { act, renderHook } from "@testing-library/react-native";

import { useSellRedeemHolding } from "@/src/features/sellRedeem";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

const hdfc: Asset = {
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
};

function seedStore() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

  store.getState().addAsset(hdfc);
  store.getState().addOpeningPosition({
    assetId: hdfc.id,
    averageCostPrice: 1450,
    currentPrice: 1678,
    date: "2026-04-15",
    id: "opening-hdfc",
    quantity: 25,
  });
  store.getState().upsertQuote({
    asOf: "2026-05-20T10:00:00.000Z",
    assetId: hdfc.id,
    currency: "INR",
    price: 1700,
    source: "yahoo",
  });

  return store;
}

describe("useSellRedeemHolding", () => {
  it("never overwrites an entered execution price when the saved quote changes", async () => {
    const store = seedStore();
    const { result } = await renderHook(() => useSellRedeemHolding({
      assetId: hdfc.id,
      now: new Date("2026-05-20T10:05:00.000Z"),
      store,
    }));

    await act(() => result.current.setSellPrice("1650"));
    await act(() => store.getState().upsertQuote({
      asOf: "2026-05-20T10:04:00.000Z",
      assetId: hdfc.id,
      currency: "INR",
      price: 1710,
      source: "yahoo",
    }));

    expect(result.current.holding?.currentPrice).toBe(1710);
    expect(result.current.sellPrice).toBe("1650");

    await act(() => result.current.setSellPrice(""));
    await act(() => store.getState().upsertQuote({
      asOf: "2026-05-20T10:05:00.000Z",
      assetId: hdfc.id,
      currency: "INR",
      price: 1720,
      source: "yahoo",
    }));
    expect(result.current.sellPrice).toBe("");
  });

  it("previews a sale above pre-split units but rejects it before the split date", async () => {
    const store = seedStore();
    store.setState({
      openingPositions: store.getState().openingPositions.map((position) => ({ ...position, measuredAsOf: "2026-04-15" })),
      assets: [{ ...hdfc, stockSplits: [{
        id: "split", kind: "split", effectiveDate: "2026-05-01",
        oldIsin: "INE040A01026", newIsin: "INE040A01034", newShares: 2, oldShares: 1,
        evidence: { url: "https://www.nseindia.com/split.pdf", publishedDate: "2026-04-01", verifiedDate: "2026-04-02" },
      }] }],
    });
    const { result } = await renderHook(() => useSellRedeemHolding({ assetId: hdfc.id, store, now: new Date("2026-05-20T12:00:00Z") }));
    await act(() => result.current.setQuantity("30"));
    expect(result.current.availableUnits).toBe(50);
    expect(result.current.canSave).toBe(true);
    expect(result.current.preview?.remainingUnits).toBe(20);
    await act(() => result.current.setDate("2026-04-20"));
    expect(result.current.canSave).toBe(false);
    expect(result.current.preview).toBeNull();
  });

  it("blocks unresolved split holdings without crashing or allowing save", async () => {
    const store = seedStore();
    store.setState({ assets: [{ ...hdfc, stockSplits: [{
      id: "split", kind: "split", effectiveDate: "2026-05-01",
      oldIsin: "INE040A01026", newIsin: "INE040A01034", newShares: 2, oldShares: 1,
      evidence: { url: "https://www.nseindia.com/split.pdf", publishedDate: "2026-04-01", verifiedDate: "2026-04-02" },
    }] }] });
    const { result } = await renderHook(() => useSellRedeemHolding({ assetId: hdfc.id, store, now: new Date("2026-05-20T12:00:00Z") }));
    expect(result.current.canSave).toBe(false);
    expect(result.current.preview).toBeNull();
    expect(result.current.errors.quantity).toMatch(/unavailable/);
  });

  it("blocks a backdated sale before ownership instead of previewing today's inventory", async () => {
    const store = seedStore();
    const { result } = await renderHook(() => useSellRedeemHolding({ assetId: hdfc.id, store }));
    await act(() => {
      result.current.setQuantity("1");
      result.current.setDate("2026-04-01");
    });
    expect(result.current.canSave).toBe(false);
    expect(result.current.preview).toBeNull();
    expect(result.current.errors.quantity).toMatch(/Not enough units on this date/);
    await act(() => { result.current.save(); });
    expect(store.getState().trades).toHaveLength(0);
    expect(store.getState().cashEntries).toHaveLength(0);
  });
  it("creates a sell trade and linked cash proceeds by default", async () => {
    const store = seedStore();
    const { result } = await renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );

    await act(() => result.current.setQuantity("5"));
    await act(() => result.current.setSellPrice("1700"));
    await act(() => result.current.setFees("100"));
    await act(() => result.current.setDate("2026-05-20"));

    expect(result.current.preview).toMatchObject({
      grossProceeds: 8500,
      netProceeds: 8400,
      remainingUnits: 20,
    });
    await act(() => {
      result.current.save();
    });

    expect(store.getState().trades).toEqual([
      expect.objectContaining({
        assetId: hdfc.id,
        fees: 100,
        pricePerUnit: 1700,
        quantity: 5,
        totalValue: 8400,
        type: "sell",
      }),
    ]);
    expect(store.getState().cashEntries).toEqual([
      expect.objectContaining({
        amount: 8400,
        date: "2026-05-20",
        label: "HDFC Bank sale proceeds",
        linkedTradeId: expect.any(String),
        purpose: "saleProceeds",
        type: "addition",
      }),
    ]);
    expect(result.current.successMessage).toBe("Sell / redeem recorded.");
  });

  it("returns the completed result without duplicating a repeated sale", async () => {
    const store = seedStore();
    const { result } = await renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );
    let firstResult: ReturnType<typeof result.current.save> | undefined;
    let secondResult: ReturnType<typeof result.current.save> | undefined;

    await act(() => result.current.setQuantity("5"));
    await act(() => result.current.setSellPrice("1700"));
    await act(() => {
      firstResult = result.current.save();
      secondResult = result.current.save();
    });

    expect(firstResult).toEqual(secondResult);
    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().cashEntries).toHaveLength(1);
  });

  it("rejects selling more than available units", async () => {
    const store = seedStore();
    const { result } = await renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );

    await act(() => result.current.setQuantity("26"));
    await act(() => result.current.setSellPrice("1700"));
    await act(() => {
      result.current.save();
    });

    expect(result.current.errors.quantity).toBe(
      "Sell quantity exceeds available units.",
    );
    expect(store.getState().trades).toEqual([]);
  });

  it("rejects fees above gross proceeds", async () => {
    const store = seedStore();
    const { result } = await renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );

    await act(() => result.current.setQuantity("1"));
    await act(() => result.current.setSellPrice("100"));
    await act(() => result.current.setFees("101"));
    await act(() => {
      result.current.save();
    });

    expect(result.current.errors.fees).toBe("Fees must be less than gross proceeds.");
    expect(store.getState().trades).toEqual([]);
  });

  it("reports a missing holding state", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { result } = await renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );

    expect(result.current.status).toBe("not-found");
    expect(result.current.holding).toBeNull();
  });
});

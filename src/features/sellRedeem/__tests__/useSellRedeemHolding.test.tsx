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
  it("creates a sell trade and linked cash proceeds by default", () => {
    const store = seedStore();
    const { result } = renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );

    act(() => result.current.setQuantity("5"));
    act(() => result.current.setSellPrice("1700"));
    act(() => result.current.setFees("100"));
    act(() => result.current.setDate("2026-05-20"));

    expect(result.current.preview).toMatchObject({
      grossProceeds: 8500,
      netProceeds: 8400,
      remainingUnits: 20,
    });
    expect(result.current.linkCashEntry).toBe(true);
    expect(result.current.cashAmount).toBe("8400");

    act(() => {
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
        label: "HDFC Bank redemption proceeds",
        type: "addition",
      }),
    ]);
    expect(result.current.successMessage).toBe("Sell / redeem recorded.");
  });

  it("can save without linked cash proceeds", () => {
    const store = seedStore();
    const { result } = renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );

    act(() => result.current.setQuantity("2"));
    act(() => result.current.setSellPrice("1600"));
    act(() => result.current.setDate("2026-05-21"));
    act(() => result.current.setLinkCashEntry(false));
    act(() => {
      result.current.save();
    });

    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("rejects selling more than available units", () => {
    const store = seedStore();
    const { result } = renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );

    act(() => result.current.setQuantity("26"));
    act(() => result.current.setSellPrice("1700"));
    act(() => {
      result.current.save();
    });

    expect(result.current.errors.quantity).toBe(
      "Sell quantity exceeds available units.",
    );
    expect(store.getState().trades).toEqual([]);
  });

  it("rejects fees above gross proceeds", () => {
    const store = seedStore();
    const { result } = renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );

    act(() => result.current.setQuantity("1"));
    act(() => result.current.setSellPrice("100"));
    act(() => result.current.setFees("101"));
    act(() => {
      result.current.save();
    });

    expect(result.current.errors.fees).toBe("Fees cannot exceed gross proceeds.");
    expect(store.getState().trades).toEqual([]);
  });

  it("reports a missing holding state", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { result } = renderHook(() =>
      useSellRedeemHolding({ assetId: hdfc.id, store }),
    );

    expect(result.current.status).toBe("not-found");
    expect(result.current.holding).toBeNull();
  });
});

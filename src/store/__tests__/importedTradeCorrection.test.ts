import { calculateHolding, calculateRecordedSaleGains } from "@/src/domain/calculations/holdings";
import { normalizeTrade } from "@/src/domain/financialRecords";
import { tradeFlow } from "@/src/domain/xirrInputs";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, BuyTrade, ImportedTransactionProvenance, SellTrade } from "@/src/types";

// #716: correcting an imported trade must count its import charges once.
const now = new Date("2026-06-30T12:00:00.000Z");
const asset = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "stock", instrumentType: "stock",
  name: "Synthetic", sectorType: "other", symbol: "SYN", ticker: "SYN.NS",
} as Asset;
const provenance = (row: number, fees: number, taxes: number): ImportedTransactionProvenance => ({
  fees, importBatchId: "batch", originalRowNumber: row, sourceFormat: "zerodha-tradebook", sourceVersion: "1", taxes,
});
// Built the way the importer builds them: gross totalValue, charges in provenance.
const importedBuy = normalizeTrade<BuyTrade>({ assetId: asset.id, date: "2026-01-10", id: "buy",
  importProvenance: provenance(1, 20, 5), pricePerUnit: 100, quantity: 10, totalValue: 1000, type: "buy" });
const importedSale = normalizeTrade<SellTrade>({ assetId: asset.id, date: "2026-03-10", id: "sale",
  importProvenance: provenance(2, 10, 0), pricePerUnit: 120, quantity: 5, totalValue: 600, type: "sell" });

function storeWith(trades: (BuyTrade | SellTrade)[]) {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.setState({ assets: [asset], trades });
  return store;
}
type Store = ReturnType<typeof storeWith>;
const trade = (store: Store, id: string) => store.getState().trades.find((item) => item.id === id) as BuyTrade | SellTrade;
const invested = (store: Store) =>
  calculateHolding({ asset, currentPrice: 100, openingPositions: [], trades: store.getState().trades }).totalInvested;
const gains = (store: Store) =>
  calculateRecordedSaleGains({ assets: [asset], openingPositions: [], trades: store.getState().trades, now });
const flows = (store: Store) => store.getState().trades.map((item) => tradeFlow(item as BuyTrade).toNumber());
const correction = ({ totalValue: _totalValue, ...input }: BuyTrade | SellTrade) => input;

describe("correcting an imported trade (#716)", () => {
  it("leaves invested, realised gain and XIRR flows unchanged when charges are untouched", () => {
    const store = storeWith([importedBuy, importedSale]);
    const before = { flows: flows(store), gains: gains(store), invested: invested(store) };
    expect(before.invested).toBe(512.5); // (1,000 + 25) / 10 × 5 units left
    expect(before.flows).toEqual([-1025, 590]);

    expect(store.getState().correctTrade({ ...correction(importedBuy), date: "2026-01-11", notes: "Moved" }).status)
      .toBe("applied");
    expect(store.getState().correctTrade({ ...correction(importedSale), notes: "Checked" }).status).toBe("applied");

    expect({ flows: flows(store), gains: gains(store), invested: invested(store) }).toEqual(before);
    expect(trade(store, "buy").importProvenance).toMatchObject({ fees: 20, taxes: 5 });
  });

  it("refuses fees typed on top of the import charges", () => {
    const store = storeWith([importedBuy]);
    const before = store.getState().trades;

    expect(store.getState().correctTrade({ ...correction(importedBuy), fees: 25 }))
      .toEqual({ reason: "importedCharges", status: "rejected" });
    expect(store.getState().trades).toBe(before);
    expect(invested(store)).toBe(1025);
  });

  it("counts a quantity change once against the import charges", () => {
    const store = storeWith([importedBuy]);

    expect(store.getState().correctTrade({ ...correction(importedBuy), quantity: 20 }).status).toBe("applied");

    expect(trade(store, "buy").totalValue).toBe(2000);
    expect(invested(store)).toBe(2025);
  });

  it("repairs a trade an earlier correction double counted", () => {
    const doubled = normalizeTrade<BuyTrade>({ ...importedBuy, fees: 25, totalValue: 0 });
    const store = storeWith([doubled]);
    expect(invested(store)).toBe(1050);

    expect(store.getState().correctTrade({ ...correction(doubled), fees: 0 }).status).toBe("applied");

    expect(invested(store)).toBe(1025);
  });

  it("keeps fees editable once, for imports without charges and for manual trades", () => {
    const chargeFree = normalizeTrade<BuyTrade>({ ...importedBuy, importProvenance: provenance(1, 0, 0) });
    const manual = normalizeTrade<BuyTrade>({ assetId: asset.id, date: "2026-01-10", fees: 10, id: "buy",
      pricePerUnit: 100, quantity: 10, totalValue: 0, type: "buy" });

    for (const original of [chargeFree, manual]) {
      const store = storeWith([original]);
      expect(store.getState().correctTrade({ ...correction(original), fees: 30 }).status).toBe("applied");
      expect(invested(store)).toBe(1030);
    }
  });
});

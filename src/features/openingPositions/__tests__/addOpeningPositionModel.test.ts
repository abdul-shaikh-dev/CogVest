import {
  buildReviewOpeningPosition,
  commitOpeningPosition,
  createReviewedAsset,
  getAssetPhaseErrors,
  getClassPhaseErrors,
  getPositionPhaseErrors,
} from "@/src/features/openingPositions/addOpeningPositionModel";
import type { OpeningPositionFormValues } from "@/src/features/openingPositions/openingPositionForm";
import type { PortfolioStoreState } from "@/src/store";
import type { Asset, Quote } from "@/src/types";
import type { StoreApi } from "zustand/vanilla";

const now = new Date("2026-10-25T10:00:00.000Z");

const savedAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-saved",
  instrumentType: "stock",
  name: "Example Bank",
  quoteSourceId: "EXAMPLEBANK.NS",
  sectorType: "financialServices",
  symbol: "EXAMPLEBANK",
  ticker: "EXAMPLEBANK.NS",
};

function fields(overrides: Partial<OpeningPositionFormValues> = {}): OpeningPositionFormValues {
  return {
    assetClass: "stock",
    assetName: "Example Bank",
    averageCostPrice: "100",
    conviction: "",
    currentPrice: "120",
    date: "2025-04-01",
    dateUnknown: false,
    instrumentType: "stock",
    intendedHoldDays: "",
    notes: "",
    quoteSourceId: "EXAMPLEBANK.NS",
    quantity: "10",
    sectorType: "financialServices",
    symbol: "EXAMPLEBANK",
    ticker: "EXAMPLEBANK.NS",
    ...overrides,
  };
}

function snapshot(assets: Asset[] = [savedAsset]) {
  return {
    assets,
    openingPositions: [],
    quoteCache: {},
    trades: [],
  } as unknown as PortfolioStoreState;
}

describe("Add Holding phase errors", () => {
  it("requires asset name, symbol and ticker", () => {
    expect(getAssetPhaseErrors({ assetName: " ", symbol: "", ticker: "" })).toEqual({
      assetName: "Asset name is required.",
      symbol: "Symbol is required.",
      ticker: "Ticker is required.",
    });
    expect(getAssetPhaseErrors({ assetName: "A", symbol: "A", ticker: "A.NS" })).toEqual({});
  });

  it("checks only classification on the class phase", () => {
    expect(getClassPhaseErrors(fields({ quantity: "", averageCostPrice: "" }), now)).toEqual({});
    expect(getClassPhaseErrors(fields({ instrumentType: "unknown" }), now)).toEqual({
      instrumentType: "Instrument type is not supported.",
    });
  });

  it("checks only position fields on the position phase", () => {
    expect(getPositionPhaseErrors(fields({ assetName: "", symbol: "" }), now)).toEqual({});
    expect(
      getPositionPhaseErrors(fields({ quantity: "0", date: "2027-01-01" }), now),
    ).toEqual({
      date: "Date cannot be in the future.",
      quantity: "Quantity must be greater than zero.",
    });
  });
});

describe("createReviewedAsset", () => {
  const input = {
    assetClass: "stock" as const,
    assetName: " Example Bank ",
    instrumentType: "stock" as const,
    quoteSourceId: "",
    sectorType: "financialServices" as const,
    selectedAsset: undefined,
    selectedAssetId: "",
    selectedLookupResult: undefined,
    symbol: "examplebank",
    ticker: "examplebank.ns",
  };

  it("normalizes manual details into a new INR asset", () => {
    const asset = createReviewedAsset({ ...input, assets: [] });

    expect(asset).toMatchObject({
      currency: "INR",
      exchange: "NSE",
      name: "Example Bank",
      quoteSourceId: "examplebank.ns",
      symbol: "EXAMPLEBANK",
      ticker: "EXAMPLEBANK.NS",
    });
    expect(asset.id).toMatch(/^asset/);
  });

  it("reuses the id of the same saved instrument", () => {
    const asset = createReviewedAsset({
      ...input,
      assets: [savedAsset],
      quoteSourceId: "EXAMPLEBANK.NS",
    });

    expect(asset.id).toBe(savedAsset.id);
  });

  it("keeps a crypto ticker's case", () => {
    expect(
      createReviewedAsset({ ...input, assetClass: "crypto", assets: [], ticker: "btc-inr" })
        .ticker,
    ).toBe("btc-inr");
  });
});

describe("buildReviewOpeningPosition", () => {
  const providerQuote: Quote = {
    asOf: "2026-10-25T09:00:00.000Z",
    assetId: savedAsset.id,
    currency: "INR",
    price: 120,
    source: "yahoo",
  } as Quote;
  const value = {
    assetClass: "stock" as const,
    assetName: "Example Bank",
    averageCostPrice: 100,
    currentPrice: 120,
    date: "2025-04-01T00:00:00.000Z",
    instrumentType: "stock" as const,
    quantity: 10,
    quoteSourceId: "EXAMPLEBANK.NS",
    sectorType: "financialServices" as const,
    symbol: "EXAMPLEBANK",
    ticker: "EXAMPLEBANK.NS",
  };
  const base = {
    asset: savedAsset,
    commandId: "opening-1",
    now,
    quickSetupDuplicate: { kind: "new" as const },
    selectedAsset: savedAsset,
    snapshot: snapshot(),
  };

  it("does not store a price that matches the provider quote", () => {
    const position = buildReviewOpeningPosition({
      ...base,
      selectedLookupQuote: providerQuote,
      value,
    });

    expect(position.manualValuation).toBeUndefined();
    expect(position).toMatchObject({ assetId: savedAsset.id, id: "opening-1", quantity: 10 });
  });

  it("stores an edited price as a manual valuation", () => {
    const position = buildReviewOpeningPosition({
      ...base,
      selectedLookupQuote: providerQuote,
      value: { ...value, currentPrice: 125 },
    });

    expect(position.manualValuation).toEqual({
      asOf: now.toISOString(),
      currency: "INR",
      price: 125,
      provenance: "user",
      source: "manual",
    });
  });
});

describe("commitOpeningPosition", () => {
  it("refuses a quick setup update that was not applied", () => {
    const store = {
      getState: () => ({
        correctOpeningPosition: () => ({ status: "rejected" }),
      }),
    } as unknown as StoreApi<PortfolioStoreState>;

    expect(() =>
      commitOpeningPosition({
        commandId: "opening-1",
        quickSetupDuplicate: {
          kind: "update",
          message: "",
          openingPositionId: "opening-1",
        },
        quote: undefined,
        reviewAsset: savedAsset,
        reviewOpeningPosition: {
          assetId: savedAsset.id,
          averageCostPrice: 100,
          date: null,
          id: "opening-1",
          quantity: 10,
        },
        store,
      }),
    ).toThrow("Existing opening position could not be updated.");
  });
});

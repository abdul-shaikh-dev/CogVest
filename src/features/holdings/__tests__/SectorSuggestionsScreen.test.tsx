import { act, fireEvent, render } from "@testing-library/react-native";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, Holding } from "@/src/types";

import { describeSuggestion, getSectorRows, reviewableSuggestions } from "../holdingsSectors";
import { SectorBreakdownCard } from "../SectorBreakdownCard";
import { SectorSuggestionsScreen } from "../SectorSuggestionsScreen";

const itEtf: Asset = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "itbees", instrumentType: "stock",
  name: "Nippon India ETF Nifty IT", symbol: "ITBEES", ticker: "ITBEES.NS",
};
const bankFund: Asset = {
  assetClass: "stock", currency: "INR", id: "bank", instrumentType: "mutualFund",
  name: "Nifty Bank Index Fund", symbol: "INF000000002", ticker: "INF000000002",
};
const share: Asset = {
  assetClass: "stock", currency: "INR", exchange: "NSE", id: "bob", instrumentType: "stock",
  name: "Bank of Baroda", symbol: "BANKBARODA", ticker: "BANKBARODA.NS",
};

function store() {
  const portfolio = createPortfolioStore({ storage: createMemoryJsonStorage() });
  for (const asset of [itEtf, bankFund, share]) portfolio.getState().addAsset(asset);
  return portfolio;
}

describe("sector view model", () => {
  const holding = (asset: Partial<Asset>, currentValue: number) =>
    ({ asset: { ...itEtf, ...asset }, currentValue, valuation: { status: "valued" } }) as unknown as Holding;

  it("lists sectors by value with Unknown last", () => {
    expect(getSectorRows([
      holding({ id: "a", sectorType: "other" }, 600),
      holding({ id: "b", sectorType: "technology" }, 300),
      holding({ id: "c", sectorType: "financialServices" }, 100),
    ])).toEqual([
      { key: "technology", label: "Technology", percentage: 30 },
      { key: "financialServices", label: "Financial Services", percentage: 10 },
      { key: "other", label: "Unknown", percentage: 60 },
    ]);
  });

  it("leaves PPF-linked and demerged records out of the review", () => {
    expect(reviewableSuggestions([itEtf, bankFund, share], []).map((item) => item.assetId)).toEqual(["itbees", "bank"]);
    expect(reviewableSuggestions([itEtf, bankFund], [{ legacyAssetId: "bank" }]).map((item) => item.assetId)).toEqual(["itbees"]);
    expect(reviewableSuggestions([
      { ...share, demerger: { childAssetId: "itbees", eventId: "e" } }, itEtf,
    ], []).map((item) => item.assetId)).toEqual([]);
  });

  it("describes each change", () => {
    const [etf] = reviewableSuggestions([itEtf], []);
    expect(describeSuggestion(etf)).toEqual(["Sector: Unknown → Technology", "Type: Stock → ETF"]);
  });
});

describe("SectorBreakdownCard", () => {
  it("shows each sector and offers the review when there are suggestions", async () => {
    const onReview = jest.fn();
    const screen = await render(
      <SectorBreakdownCard
        available
        onReviewSuggestions={onReview}
        rows={[{ key: "technology", label: "Technology", percentage: 40 }, { key: "other", label: "Unknown", percentage: 60 }]}
        suggestionCount={2}
      />,
    );
    expect(screen.getByTestId("holdings-sector-technology-pct").props.children).toEqual(["40", "%"]);
    expect(screen.getByText("Unknown")).toBeTruthy();
    fireEvent.press(screen.getByText("Review 2 sector suggestions"));
    expect(onReview).toHaveBeenCalled();
  });

  it("says why the breakdown is unavailable", async () => {
    const screen = await render(<SectorBreakdownCard available={false} rows={[]} suggestionCount={0} />);
    expect(screen.getByText("Unavailable until every market holding has a price.")).toBeTruthy();
    expect(screen.queryByTestId("holdings-sector-review")).toBeNull();
  });
});

describe("SectorSuggestionsScreen", () => {
  it("applies only the ticked suggestions and never touches a company share", async () => {
    const portfolio = store();
    const screen = await render(<SectorSuggestionsScreen onClose={jest.fn()} store={portfolio} />);
    expect(screen.queryByText("Bank of Baroda")).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId("sector-suggestion-bank"));
    });
    expect(screen.getByText("Apply 1 change")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId("sector-suggestions-apply"));
    });
    expect(screen.getByText("1 holding updated")).toBeTruthy();
    const assets = portfolio.getState().assets;
    expect(assets.find((asset) => asset.id === "itbees")).toMatchObject({ assetClass: "etf", instrumentType: "etf", sectorType: "technology" });
    expect(assets.find((asset) => asset.id === "bank")?.sectorType).toBe("other");
    expect(assets.find((asset) => asset.id === "bob")).toMatchObject({ assetClass: "stock", sectorType: "other" });
  });

  it("says when there is nothing to suggest", async () => {
    const portfolio = createPortfolioStore({ storage: createMemoryJsonStorage() });
    portfolio.getState().addAsset(share);
    const screen = await render(<SectorSuggestionsScreen onClose={jest.fn()} store={portfolio} />);
    expect(screen.getByText("Nothing to suggest")).toBeTruthy();
  });
});

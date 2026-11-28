import { act, fireEvent, render } from "@testing-library/react-native";

import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset, BuyTrade, CashEntry, Holding } from "@/src/types";

import { describeSuggestion, getSectorRows, reviewableSuggestions, unknownSectorAssets } from "../holdingsSectors";
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

const deposit: CashEntry = { amount: 5000, date: "2026-01-01", id: "deposit", label: "Deposit", purpose: "capitalContribution", type: "addition" };
const buyShare: BuyTrade = { assetId: "bob", date: "2026-01-05", id: "buy", pricePerUnit: 200, quantity: 2, totalValue: 400, type: "buy" };

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
      { key: "technology", label: "Technology", percentage: 30, value: 300 },
      { key: "financialServices", label: "Financial Services", percentage: 10, value: 100 },
      { key: "other", label: "Unknown", percentage: 60, value: 600 },
    ]);
  });

  it("gives no amounts when a holding is not priced in INR", () => {
    const rows = getSectorRows([
      holding({ id: "a", sectorType: "technology" }, 300),
      holding({ currency: "USD", id: "b", sectorType: "technology" }, 100),
    ]);
    expect(rows).toEqual([{ key: "technology", label: "Technology", percentage: 100 }]);
  });

  it("lists Unknown holdings without a suggestion, once each, by name", () => {
    const holdings = [
      holding({ ...share, id: "bob", name: "Bank of Baroda" }, 100),
      holding({ ...share, id: "bob", name: "Bank of Baroda" }, 50),
      holding({ ...share, id: "acme", name: "Acme Ltd", sectorType: undefined }, 100),
      holding({ ...share, id: "set", name: "Set Ltd", sectorType: "energy" }, 100),
      holding({ ...itEtf }, 100),
      holding({ ...share, assetClass: "cash", id: "cash", name: "Cash fund" }, 100),
      holding({ ...share, id: "ppf", instrumentType: "ppf", name: "Old PPF" }, 100),
    ];
    const suggestions = reviewableSuggestions([itEtf, share], []);
    expect(unknownSectorAssets(holdings, suggestions).map((asset) => asset.id)).toEqual(["acme", "bob"]);
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
        masked={false}
        onReviewSectors={onReview}
        rows={[{ key: "technology", label: "Technology", percentage: 40, value: 4000 }, { key: "other", label: "Unknown", percentage: 60, value: 6000 }]}
        suggestionCount={2}
        unknownCount={1}
      />,
    );
    expect(screen.getByTestId("holdings-sector-technology-pct").props.children).toEqual(["40", "%"]);
    expect(screen.getByTestId("holdings-sector-technology-value").props.children).toBe("₹4,000.00");
    expect(screen.getByLabelText("Technology 40 percent, ₹4,000.00")).toBeTruthy();
    expect(screen.getByText("Unknown")).toBeTruthy();
    fireEvent.press(screen.getByText("Review 2 sector suggestions"));
    expect(onReview).toHaveBeenCalled();
  });

  it("masks the amounts like every other value", async () => {
    const screen = await render(
      <SectorBreakdownCard available masked rows={[{ key: "technology", label: "Technology", percentage: 100, value: 4000 }]} suggestionCount={0} unknownCount={0} />,
    );
    expect(screen.queryByText("₹4,000.00")).toBeNull();
    expect(screen.getByLabelText("Technology 100 percent, Amount hidden")).toBeTruthy();
    expect(screen.queryByTestId("holdings-sector-review")).toBeNull();
  });

  it("offers to set sectors when Unknown holdings have no suggestion, and says when amounts are left out", async () => {
    const onReview = jest.fn();
    const screen = await render(
      <SectorBreakdownCard available masked={false} onReviewSectors={onReview} rows={[{ key: "other", label: "Unknown", percentage: 100 }]} suggestionCount={0} unknownCount={2} />,
    );
    expect(screen.queryByTestId("holdings-sector-other-value")).toBeNull();
    expect(screen.getByText("Amounts are hidden because some holdings aren't priced in INR.")).toBeTruthy();
    fireEvent.press(screen.getByText("Set sectors for 2 Unknown holdings"));
    expect(onReview).toHaveBeenCalled();
  });

  it("shows the share held in international holdings", async () => {
    const screen = await render(
      <SectorBreakdownCard available internationalPct={25} masked={false} rows={[{ key: "technology", label: "Technology", percentage: 100, value: 4000 }]} suggestionCount={0} unknownCount={0} />,
    );
    expect(screen.getByTestId("holdings-sector-international")).toHaveTextContent("International holdings: 25% of holding value, within the sectors above.");
  });

  it("says why the breakdown is unavailable", async () => {
    const screen = await render(<SectorBreakdownCard available={false} masked={false} rows={[]} suggestionCount={0} unknownCount={0} />);
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
    expect(assets.find((asset) => asset.id === "itbees")).toMatchObject({ assetClass: "etf", instrumentType: "etf", sectorBasis: "schemeName", sectorType: "technology" });
    expect(assets.find((asset) => asset.id === "bank")?.sectorType).toBe("other");
    expect(assets.find((asset) => asset.id === "bob")).toMatchObject({ assetClass: "stock", sectorType: "other" });
  });

  it("lists held Unknown holdings with no suggestion and drops one once its sector is set", async () => {
    const portfolio = createPortfolioStore({ storage: createMemoryJsonStorage() });
    portfolio.getState().addAsset(share);
    portfolio.getState().addCashEntry(deposit);
    portfolio.getState().addTrade(buyShare);
    const onEditAsset = jest.fn();
    const screen = await render(<SectorSuggestionsScreen onClose={jest.fn()} onEditAsset={onEditAsset} store={portfolio} />);
    expect(screen.getByText("Bank of Baroda")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId("sector-unknown-bob"));
    });
    expect(onEditAsset).toHaveBeenCalledWith("bob");
    await act(async () => {
      portfolio.getState().applyAssetClassifications([{ assetClass: "stock", assetId: "bob", sectorType: "financialServices" }]);
    });
    expect(screen.queryByTestId("sector-unknown-bob")).toBeNull();
    expect(screen.getByText("Nothing to set")).toBeTruthy();
  });

  it("marks an overseas fund international and says why each Unknown holding has no sector (#823)", async () => {
    const portfolio = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const nasdaq: Asset = { ...bankFund, id: "nasdaq", name: "Sample Nasdaq 100 FoF", sectorType: "technology" };
    portfolio.getState().addAsset(nasdaq);
    portfolio.getState().addAsset({ ...share, sectorBasis: "providerHadNone" });
    portfolio.getState().addCashEntry(deposit);
    portfolio.getState().addTrade(buyShare);
    const screen = await render(<SectorSuggestionsScreen onClose={jest.fn()} onEditAsset={jest.fn()} store={portfolio} />);
    expect(screen.getByText("Market: International")).toBeTruthy();
    expect(screen.getByText("Sector: Unknown · the price provider has none")).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId("sector-suggestions-apply"));
    });
    // The sector was already set, so only the marker changes and the basis stays unrecorded.
    const saved = portfolio.getState().assets.find((asset) => asset.id === "nasdaq");
    expect(saved).toMatchObject({ international: true, sectorType: "technology" });
    expect(saved).not.toHaveProperty("sectorBasis");
  });

  it("says when there is nothing to set", async () => {
    const portfolio = createPortfolioStore({ storage: createMemoryJsonStorage() });
    portfolio.getState().addAsset(share);
    const screen = await render(<SectorSuggestionsScreen onClose={jest.fn()} store={portfolio} />);
    expect(screen.getByText("Nothing to set")).toBeTruthy();
  });
});

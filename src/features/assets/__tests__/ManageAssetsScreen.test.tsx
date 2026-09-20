import { act, fireEvent, render } from "@testing-library/react-native";

import { ManageAssetsScreen } from "@/src/features/assets";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { Asset } from "@/src/types";

const activeAsset: Asset = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "asset-active",
  instrumentType: "stock",
  name: "Active Bank",
  quoteSourceId: "ACTIVE.NS",
  sectorType: "financialServices",
  symbol: "ACTIVE",
  ticker: "ACTIVE.NS",
};

const closedAsset: Asset = {
  ...activeAsset,
  id: "asset-closed",
  name: "Closed Fund",
  quoteSourceId: "CLOSED.NS",
  symbol: "CLOSED",
  ticker: "CLOSED.NS",
};

describe("ManageAssetsScreen", () => {
  it("keeps Back in the fixed header and exposes complete asset identity", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const longFund: Asset = {
      ...activeAsset,
      id: "asset-long-fund",
      instrumentType: "mutualFund",
      isin: "INF109KC13E2",
      name: "ICICI Prudential Nifty IT Index Fund - Direct Plan - Growth (Non-Demat)",
      symbol: "INF109KC13E2",
      ticker: "INF109KC13E2",
    };
    store.getState().addAsset(longFund);
    const onBack = jest.fn();
    const screen = render(<ManageAssetsScreen onBack={onBack} onReviewAsset={jest.fn()} store={store} />);

    expect(screen.getByTestId("manage-assets-back")).toHaveProp("accessibilityLabel", "Back to Holdings");
    fireEvent.press(screen.getByTestId("manage-assets-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId(`manage-asset-name-${longFund.id}`).props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId(`manage-asset-${longFund.id}`).props.accessibilityLabel).toContain(
      "ICICI Prudential Nifty IT Index Fund - Direct Plan - Growth (Non-Demat), INF109KC13E2, Mutual Fund, Equity, Closed",
    );
  });

  it("searches by name, symbol, ticker, and ISIN without losing the query", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const searchableAsset: Asset = {
      ...activeAsset,
      isin: "INE040A01034",
      name: "HDFC Bank Limited",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    };
    store.getState().addAsset(searchableAsset);
    store.getState().addAsset(closedAsset);
    const screen = render(<ManageAssetsScreen onBack={jest.fn()} onReviewAsset={jest.fn()} store={store} />);
    const input = screen.getByTestId("manage-assets-search-input");

    for (const query of ["hdfc bank", "HDFCBANK", "hdfcbank.ns", "INE040A01034"]) {
      fireEvent.changeText(input, query);
      expect(screen.getByTestId("manage-assets-result-count")).toHaveTextContent("1 of 2 assets");
      expect(screen.getByText("HDFC Bank Limited")).toBeTruthy();
      expect(screen.queryByText("Closed Fund")).toBeNull();
      expect(input).toHaveProp("value", query);
    }
  });

  it("preserves search context while a reviewed asset changes", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(activeAsset);
    store.getState().addAsset(closedAsset);
    const onReviewAsset = jest.fn();
    const screen = render(<ManageAssetsScreen onBack={jest.fn()} onReviewAsset={onReviewAsset} store={store} />);

    fireEvent.changeText(screen.getByTestId("manage-assets-search-input"), "Closed Fund");
    fireEvent.press(screen.getByTestId(`manage-asset-${closedAsset.id}`));
    expect(onReviewAsset).toHaveBeenCalledWith(closedAsset.id);

    act(() => store.setState({ assets: [activeAsset] }));
    expect(screen.getByTestId("manage-assets-search-input")).toHaveProp("value", "Closed Fund");
    expect(screen.getByText("No matching assets")).toBeTruthy();
  });

  it.each([4, 30, 52])("renders a searchable %i-asset fixture", (count) => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.setState({
      assets: Array.from({ length: count }, (_, index): Asset => ({
        ...activeAsset,
        id: `asset-${index}`,
        name: index === count - 1
          ? "Navi Nasdaq100 US Specific Equity Passive Fund of Fund - Direct Plan - Growth (Non-Demat)"
          : `Saved Asset ${index + 1}`,
        quoteSourceId: `ASSET${index}.NS`,
        symbol: `ASSET${index}`,
        ticker: `ASSET${index}.NS`,
      })),
    });
    const screen = render(<ManageAssetsScreen onBack={jest.fn()} onReviewAsset={jest.fn()} store={store} />);

    expect(screen.getByTestId("manage-assets-result-count")).toHaveTextContent(`${count} assets`);
    fireEvent.changeText(screen.getByTestId("manage-assets-search-input"), "Navi Nasdaq100");
    expect(screen.getByTestId("manage-assets-result-count")).toHaveTextContent(`1 of ${count} assets`);
    expect(screen.getByText(/Navi Nasdaq100 US Specific Equity Passive Fund/u)).toBeTruthy();
  });

  it("keeps post-split residual units active and labels unresolved quantities unavailable", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const stockSplits: NonNullable<Asset["stockSplits"]> = [{
      id: "split", kind: "split", effectiveDate: "2026-02-01",
      oldIsin: "INE040A01026", newIsin: "INE040A01034", newShares: 2, oldShares: 1,
      evidence: { url: "https://www.nseindia.com/split.pdf", publishedDate: "2026-01-01", verifiedDate: "2026-01-02" },
    }];
    store.setState({
      assets: [{ ...activeAsset, stockSplits }, { ...closedAsset, stockSplits }],
      openingPositions: [{ assetId: closedAsset.id, id: "unmeasured", date: "2026-01-01", quantity: 1, averageCostPrice: 100 }],
      trades: [
        { assetId: activeAsset.id, id: "buy", date: "2026-01-01", type: "buy", quantity: 2, pricePerUnit: 100, totalValue: 200 },
        { assetId: activeAsset.id, id: "sell", date: "2026-03-01", type: "sell", quantity: 2, pricePerUnit: 100, totalValue: 200 },
      ],
    });
    const { getByText, queryByText } = render(<ManageAssetsScreen onBack={jest.fn()} onReviewAsset={jest.fn()} store={store} />);
    expect(getByText("Active")).toBeTruthy();
    expect(getByText("Unavailable")).toBeTruthy();
    expect(queryByText("Closed")).toBeNull();
  });

  it("lists active and fully sold assets and opens review by stable ID", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset(activeAsset);
    store.getState().addAsset(closedAsset);
    store.getState().addOpeningPosition({
      assetId: activeAsset.id,
      averageCostPrice: 100,
      currentPrice: 120,
      date: "2026-01-01",
      id: "opening-active",
      quantity: 2,
    });
    store.getState().addTrade({
      assetId: closedAsset.id,
      date: "2026-01-01",
      id: "buy-closed",
      pricePerUnit: 100,
      quantity: 1,
      totalValue: 100,
      type: "buy",
    });
    store.getState().addTrade({
      assetId: closedAsset.id,
      date: "2026-02-01",
      id: "sell-closed",
      pricePerUnit: 110,
      quantity: 1,
      totalValue: 110,
      type: "sell",
    });
    const onReviewAsset = jest.fn();
    const { getAllByText, getByTestId, getByText } = render(
      <ManageAssetsScreen
        onBack={jest.fn()}
        onReviewAsset={onReviewAsset}
        store={store}
      />,
    );

    expect(getByText("Active Bank")).toBeTruthy();
    expect(getByText("Closed Fund")).toBeTruthy();
    expect(getAllByText("Active")).toHaveLength(1);
    expect(getAllByText("Closed")).toHaveLength(1);
    fireEvent.press(getByTestId(`manage-asset-${closedAsset.id}`));
    expect(onReviewAsset).toHaveBeenCalledWith(closedAsset.id);
  });
});

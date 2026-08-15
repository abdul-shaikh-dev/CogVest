import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { HoldingImportScreen } from "@/src/features/holdingImport";
import { MASKED_INR_VALUE } from "@/src/components/common";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const header =
  "cogvest_version,name,ticker,symbol,asset_class,instrument_type,sector,currency,exchange,quantity,average_cost,current_price,valuation_as_of,first_purchase_date";
const lookup: AssetLookupResult = {
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "yahoo:HDFCBANK.NS",
  instrumentType: "stock",
  instrumentTypeConfidence: "provider",
  metadataReviewMessage: "Ready",
  name: "HDFC Bank Limited",
  provider: "yahoo",
  quoteSourceId: "HDFCBANK.NS",
  sectorType: "financialServices",
  sectorTypeConfidence: "provider",
  sourceLabel: "Yahoo Finance",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
};

function fileWith(row: string) {
  const text = `${header}\n${row}`;
  return async () => ({ name: "holdings.csv", size: text.length, text });
}

describe("HoldingImportScreen", () => {
  it("previews and atomically imports an exact provider holding", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onImported = jest.fn();
    const { getByTestId, getByText } = render(
      <HoldingImportScreen
        now={() => new Date("2026-08-15T12:00:00.000Z")}
        onCancel={jest.fn()}
        onImported={onImported}
        pickCsvFile={fileWith(
          "1,HDFC Bank,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,25,1450,,,2024-04-15",
        )}
        resolveQuote={async ({ asset }) => ({
          ok: true,
          quote: {
            asOf: "2026-08-15T10:00:00.000Z",
            assetId: asset.id,
            currency: "INR",
            price: 1678.25,
            source: "yahoo",
          },
        })}
        searchAssetLookupResults={async () => ({ failures: [], results: [lookup] })}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() => expect(getByTestId("holding-import-summary")).toBeTruthy());
    expect(getByText("Row 2 • 25 units")).toBeTruthy();
    expect(getByText("HDFC Bank Limited • HDFCBANK.NS • Equity • INR")).toBeTruthy();
    expect(getByText("₹36,250.00")).toBeTruthy();
    expect(getByText("₹41,956.25")).toBeTruthy();

    fireEvent.press(getByTestId("confirm-holdings-import"));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(store.getState().assets).toHaveLength(1);
    expect(store.getState().openingPositions).toHaveLength(1);
    expect(store.getState().quoteCache[lookup.id]?.price).toBe(1678.25);
  });

  it("requires explicit selection for a non-exact provider result", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const candidate = { ...lookup, id: "yahoo:HDFC.NS", ticker: "HDFC.NS" };
    const { getByTestId, getByText, queryByTestId } = render(
      <HoldingImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={fileWith(
          "1,HDFC Bank,,,stock,stock,financialServices,INR,NSE,25,1450,,,,",
        )}
        resolveQuote={async () => ({ error: "Unavailable", ok: false })}
        searchAssetLookupResults={async () => ({ failures: [], results: [candidate] })}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() =>
      expect(
        getByTestId("holding-import-row-2-candidate-yahoo:HDFC.NS"),
      ).toBeTruthy(),
    );
    expect(queryByTestId("holding-import-summary")).toBeNull();

    fireEvent.press(
      getByTestId("holding-import-row-2-candidate-yahoo:HDFC.NS"),
    );
    await waitFor(() => expect(getByTestId("holding-import-summary")).toBeTruthy());
  });

  it("requires explicit manual conversion and keeps missing valuation pending", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText } = render(
      <HoldingImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={fileWith(
          "1,Private Debt,PRIVATE-DEBT,PRIVATE,debt,debt,fixedIncome,INR,,3,200,,,,",
        )}
        searchAssetLookupResults={async () => ({
          failures: ["Provider unavailable"],
          results: [],
        })}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() =>
      expect(getByTestId("holding-import-row-2-manual")).toBeTruthy(),
    );
    fireEvent.press(getByTestId("holding-import-row-2-manual"));

    await waitFor(() => expect(getByTestId("holding-import-summary")).toBeTruthy());
    expect(getByText("Row 2 • 3 units")).toBeTruthy();
    expect(getByText("1 holding valuation is still pending.")).toBeTruthy();
  });

  it("shows parser errors without mutating the portfolio", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText, queryByTestId } = render(
      <HoldingImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={fileWith(
          "1,Bad,BAD.NS,BAD,stock,stock,other,INR,NSE,0,100,,,,",
        )}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() => expect(getByText(/quantity must be a positive number/u)).toBeTruthy());
    expect(queryByTestId("holding-import-summary")).toBeNull();
    expect(store.getState().assets).toEqual([]);
  });

  it("keeps cancellation and oversized files mutation-free", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const search = jest.fn();
    const { getByTestId, getByText, queryByTestId, rerender } = render(
      <HoldingImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={async () => undefined}
        searchAssetLookupResults={search}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() => expect(search).not.toHaveBeenCalled());
    expect(queryByTestId("holding-import-summary")).toBeNull();

    rerender(
      <HoldingImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={async () => ({ name: "large.csv", size: 1_000_001, text: "x" })}
        searchAssetLookupResults={search}
        store={store}
      />,
    );
    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() => expect(getByText(/CSV file is too large/u)).toBeTruthy());
    expect(store.getState().assets).toEqual([]);
  });

  it("offers explicit manual recovery when lookup throws", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByTestId, getByText } = render(
      <HoldingImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={fileWith(
          "1,Private Debt,PRIVATE-DEBT,PRIVATE,debt,debt,fixedIncome,INR,,3,200,,,,",
        )}
        searchAssetLookupResults={async () => {
          throw new Error("network down");
        }}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() =>
      expect(getByTestId("holding-import-row-2-manual")).toBeTruthy(),
    );
    expect(getByText(/Asset lookup is unavailable/u)).toBeTruthy();
  });

  it("requires explicit confirmation before replacing an existing opening position", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const asset = { ...lookup, ...{ id: lookup.id } };
    store.getState().addAsset({
      assetClass: asset.assetClass,
      currency: asset.currency,
      exchange: asset.exchange,
      id: asset.id,
      instrumentType: asset.instrumentType,
      name: asset.name,
      quoteSourceId: asset.quoteSourceId,
      sectorType: asset.sectorType,
      symbol: asset.symbol,
      ticker: asset.ticker,
    });
    store.getState().addOpeningPosition({
      assetId: asset.id,
      averageCostPrice: 1400,
      date: "2024-04-15",
      id: "existing-opening",
      quantity: 20,
    });
    const { getByTestId, getByText, queryByTestId } = render(
      <HoldingImportScreen
        now={() => new Date("2026-08-15T12:00:00.000Z")}
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={fileWith(
          "1,HDFC Bank,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,25,1450,1678.25,2026-08-01,2024-04-15",
        )}
        searchAssetLookupResults={async () => ({ failures: [], results: [lookup] })}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() =>
      expect(getByTestId("holding-import-row-2-update")).toBeTruthy(),
    );
    expect(queryByTestId("holding-import-summary")).toBeNull();
    fireEvent.press(getByTestId("holding-import-row-2-update"));
    await waitFor(() => expect(getByTestId("holding-import-summary")).toBeTruthy());
    expect(
      getByText("Current price ₹1,678.25 • Manual • as of 2026-08-01"),
    ).toBeTruthy();
    fireEvent.press(getByTestId("confirm-holdings-import"));
    await waitFor(() =>
      expect(store.getState().openingPositions[0]).toMatchObject({ quantity: 25 }),
    );
    expect(store.getState().openingPositions).toHaveLength(1);
  });

  it("masks imported prices and portfolio totals when value masking is active", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ maskWealthValues: true });
    const { getAllByText, getByTestId, queryByText } = render(
      <HoldingImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={fileWith(
          "1,HDFC Bank,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,25,1450,1678.25,2026-08-01,2024-04-15",
        )}
        searchAssetLookupResults={async () => ({ failures: [], results: [lookup] })}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() => expect(getByTestId("holding-import-summary")).toBeTruthy());
    expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThanOrEqual(3);
    expect(queryByText("₹36,250.00")).toBeNull();
    expect(queryByText("₹41,956.25")).toBeNull();
  });

  it("clears an earlier preview when replacement file resolution fails", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const first = await fileWith(
      "1,HDFC Bank,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,25,1450,1678.25,2026-08-01,2024-04-15",
    )();
    const second = await fileWith(
      "1,HDFC Bank,HDFCBANK.NS,HDFCBANK,stock,stock,financialServices,INR,NSE,25,1450,,,2024-04-15",
    )();
    const pickCsvFile = jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({ ...second, name: "replacement.csv" });
    const { getByTestId, getByText, queryByTestId } = render(
      <HoldingImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={pickCsvFile}
        resolveQuote={async () => {
          throw new Error("quote provider failed");
        }}
        searchAssetLookupResults={async () => ({ failures: [], results: [lookup] })}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() => expect(getByTestId("holding-import-summary")).toBeTruthy());
    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() =>
      expect(getByText("This CSV could not be read. Choose the template again.")).toBeTruthy(),
    );
    expect(queryByTestId("holding-import-summary")).toBeNull();
    expect(queryByTestId("holding-import-row-2")).toBeNull();
    expect(store.getState().assets).toEqual([]);
  });

  it("imports a representative 21-row portfolio from preview to one batch", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const rows = Array.from({ length: 21 }, (_, index) => {
      const ticker = `ASSET${index}.NS`;
      return `1,Asset ${index},${ticker},ASSET${index},stock,stock,other,INR,NSE,${index + 1},100,110,2026-08-01,2024-04-15`;
    });
    const csv = `${header}\n${rows.join("\n")}`;
    const onImported = jest.fn();
    const { getAllByText, getByTestId } = render(
      <HoldingImportScreen
        onCancel={jest.fn()}
        onImported={onImported}
        pickCsvFile={async () => ({ name: "portfolio.csv", size: csv.length, text: csv })}
        searchAssetLookupResults={async ({ query }) => {
          const symbol = query.replace(".NS", "");
          return {
            failures: [],
            results: [
              {
                ...lookup,
                id: `yahoo:${query}`,
                name: symbol,
                quoteSourceId: query,
                symbol,
                ticker: query,
              },
            ],
          };
        }}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-holdings-csv"));
    await waitFor(() => expect(getByTestId("holding-import-summary")).toBeTruthy());
    expect(getAllByText("21")).toHaveLength(2);
    fireEvent.press(getByTestId("confirm-holdings-import"));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(store.getState().assets).toHaveLength(21);
    expect(store.getState().openingPositions).toHaveLength(21);
  });
});

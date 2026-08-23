import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { TransactionImportScreen } from "@/src/features/transactionImport";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const header = "cogvest_version,transaction_type,trade_date,isin,exchange,symbol,currency,quantity,unit_price,acquisition_cost,settlement_date,external_id,account,fees,taxes,description,notes";
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

describe("TransactionImportScreen", () => {
  it("requires asset selection before an atomic transaction import", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onImported = jest.fn();
    const text = `${header}\n1,buy,2025-04-01,,NSE,HDFCBANK,INR,2,100,,,order-1,broker,0,0,HDFC purchase,`;
    const { getByTestId, queryByTestId } = render(
      <TransactionImportScreen
        onCancel={jest.fn()}
        onImported={onImported}
        pickCsvFile={async () => ({ name: "history.csv", size: text.length, text })}
        searchAssetLookupResults={async () => ({ failures: [], results: [lookup] })}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-transaction-csv"));
    await waitFor(() =>
      expect(
        getByTestId("transaction-import-asset-symbol:NSE:HDFCBANK-candidate-yahoo:HDFCBANK.NS"),
      ).toBeTruthy(),
    );
    expect(queryByTestId("confirm-transaction-import")).toBeTruthy();
    expect(store.getState().trades).toEqual([]);

    fireEvent.press(
      getByTestId("transaction-import-asset-symbol:NSE:HDFCBANK-candidate-yahoo:HDFCBANK.NS"),
    );
    await waitFor(() =>
      expect(getByTestId("confirm-transaction-import").props.accessibilityState?.disabled).not.toBe(true),
    );
    expect(store.getState().trades).toEqual([]);

    fireEvent.press(getByTestId("confirm-transaction-import"));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(store.getState().cashEntries).toEqual([]);
    expect(store.getState().trades).toHaveLength(1);
  });

  it("blocks supplemental import until the opening baseline cutover is confirmed", async () => {
    const store = createPortfolioStore({
      now: () => new Date("2026-08-23T00:00:00.000Z"),
      storage: createMemoryJsonStorage(),
    });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "asset-hdfc",
      name: "HDFC Bank",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    store.getState().addOpeningPosition({
      assetId: "asset-hdfc",
      averageCostPrice: 100,
      date: "2024-01-01",
      id: "opening-hdfc",
      quantity: 2,
    });
    const text = `${header}\n1,buy,2025-04-01,,NSE,HDFCBANK,INR,1,120,,,order-1,broker,0,0,HDFC purchase,`;
    const { getByTestId } = render(
      <TransactionImportScreen
        now={() => new Date("2026-08-23T00:00:00.000Z")}
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={async () => ({ name: "history.csv", size: text.length, text })}
        searchAssetLookupResults={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-transaction-csv"));
    await waitFor(() =>
      expect(getByTestId("transaction-import-shared-cutover")).toBeTruthy(),
    );
    expect(
      getByTestId("confirm-transaction-import").props.accessibilityState
        ?.disabled,
    ).toBe(true);

    fireEvent.press(getByTestId("transaction-import-shared-cutover"));
    fireEvent(
      getByTestId("transaction-import-shared-cutover-picker"),
      "onChange",
      {
        nativeEvent: {
          timestamp: new Date(2025, 2, 1, 12).getTime(),
        },
      },
    );
    await waitFor(() =>
      expect(
        getByTestId("confirm-transaction-import").props.accessibilityState
          ?.disabled,
      ).not.toBe(true),
    );
  });

  it("keeps an unsupported-only file visible for review", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const text = `${header}\n1,ipo`;
    const { getByTestId, getByText, queryByTestId } = render(
      <TransactionImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={async () => ({ name: "unsupported.csv", size: text.length, text })}
        searchAssetLookupResults={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("select-transaction-csv"));

    await waitFor(() =>
      expect(getByTestId("transaction-import-dry-run")).toBeTruthy(),
    );
    expect(getByText("Skipped unsupported events")).toBeTruthy();
    expect(getByText("This file has no supported transaction rows to import.")).toBeTruthy();
    expect(queryByTestId("transaction-import-asset-isin:INE000000001")).toBeNull();
    expect(
      getByTestId("confirm-transaction-import").props.accessibilityState
        ?.disabled,
    ).toBe(true);
  });
});

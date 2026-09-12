import { fireEvent, render, waitFor, within } from "@testing-library/react-native";
import { Keyboard, ScrollView } from "react-native";

import { TransactionImportScreen } from "@/src/features/transactionImport";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { parseTransactionCsv } from "@/src/domain/transactionCsv";
import { buildTransactionImportPlan } from "../transactionImport";

const header = "cogvest_version,transaction_type,trade_date,isin,exchange,symbol,currency,quantity,unit_price,acquisition_cost,settlement_date,external_id,account,fees,taxes,description,notes";
const zerodhaHeader = "symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time";
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
  it("explains missing pre-statement holdings before matching or confirmation", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onImported = jest.fn();
    const screen = render(<TransactionImportScreen
      onCancel={jest.fn()}
      onImported={onImported}
      pickCsvFile={jest.fn()}
      pickCasStatement={async () => ({ size: 4096, uri: "content://synthetic.pdf" })}
      readCasStatement={async () => ({ pageCount: 1, normalization: {
        coverage: { from: "2024-01-01", to: "2024-12-31" },
        errors: [], parserErrors: [], preservedCharges: [], rows: [], unsupportedEvents: [],
        schemes: [{ folioLabel: "Folio 1", isin: "INF000000001", name: "Sample Fund", registrar: "CAMS", openingUnits: "5", closingUnits: "5", events: [], importableTransactions: 0 }],
      } })}
      searchAssetLookupResults={jest.fn()}
      store={store}
    />);
    fireEvent.press(screen.getByTestId("transaction-import-source-camsKfinCasPdfV1"));
    fireEvent.press(screen.getByTestId("select-cas-statement"));
    await waitFor(() => expect(screen.getByTestId("cas-opening-history-error")).toBeTruthy());
    expect(screen.getByText("Earlier holdings need a starting balance")).toBeTruthy();
    expect(screen.getByTestId("confirm-transaction-import")).toBeDisabled();
    fireEvent.press(screen.getByTestId("confirm-transaction-import"));
    expect(onImported).not.toHaveBeenCalled();
    expect(store.getState().trades).toEqual([]);
    expect(store.getState().openingPositions).toEqual([]);
  });

  it("scrolls to the password's content position after the keyboard opens", () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    const metrics = jest.spyOn(Keyboard, "metrics").mockReturnValue({ screenX: 0, screenY: 500, width: 360, height: 300 });
    let onKeyboardDidShow: (() => void) | undefined;
    const keyboardListener = jest.spyOn(Keyboard, "addListener").mockImplementation((event, listener) => {
      if (event === "keyboardDidShow") onKeyboardDidShow = listener as () => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
    });
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(
      <TransactionImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(screen.getByTestId("transaction-import-source-camsKfinCasPdfV1"));
    fireEvent(screen.getByTestId("transaction-import-source-card"), "layout", { nativeEvent: { layout: { y: 120 } } });
    fireEvent(screen.getByTestId("cas-statement-password-field"), "layout", { nativeEvent: { layout: { y: 240 } } });
    fireEvent(screen.getByTestId("cas-statement-password"), "focus");
    scrollTo.mockClear();
    onKeyboardDidShow?.();

    expect(scrollTo).toHaveBeenCalledWith({ animated: false, y: 344 });
    metrics.mockRestore();
    keyboardListener.mockRestore();
    scrollTo.mockRestore();
  });

  it("resets the import scroll position when the source changes", () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(
      <TransactionImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(screen.getByTestId("transaction-import-source-camsKfinCasPdfV1"));

    expect(scrollTo).toHaveBeenCalledWith({ animated: false, y: 0 });
    scrollTo.mockRestore();
  });

  it("offers an explicit share-adjustment action for already saved transactions", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const asset = { ...lookup, isin: "INE040A01034" };
    store.getState().addAsset(asset);
    const text = `${header}\n1,buy,2025-01-02,INE040A01034,NSE,HDFCBANK,INR,10,100,,,old-buy,,,,,`;
    const parsed = parseTransactionCsv(text);
    const initial = buildTransactionImportPlan({ batchId: "legacy", mode: "supplemental", state: store.getState(), resolutions: parsed.rows.map((row) => ({ row, asset, status: "ready" as const })) });
    store.getState().addTrade(initial.command!.transactions[0]);
    const onImported = jest.fn();
    const screen = render(<TransactionImportScreen onCancel={jest.fn()} onImported={onImported} pickCsvFile={async () => ({ name: "saved.csv", size: text.length, text })} searchAssetLookupResults={async () => ({ failures: [], results: [lookup] })} store={store} />);
    fireEvent.press(screen.getByTestId("select-transaction-csv"));
    await waitFor(() => expect(screen.getByText("Apply share adjustments")).toBeTruthy());
    expect(screen.getByText(/Your transactions are already saved/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("confirm-transaction-import"));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().assets[0].stockSplits).toHaveLength(1);
  });

  it("surfaces historical collisions before accepting matches or offering import", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const text = `${zerodhaHeader}\nHDFCBANK,INE000000001,2024-01-02,NSE,EQ,EQ,buy,false,1,100,one,one,2024-01-02T10:00:00\nHDFCBANK,INE000000002,2025-01-02,NSE,EQ,EQ,buy,false,1,100,two,two,2025-01-02T10:00:00`;
    const screen = render(<TransactionImportScreen onCancel={jest.fn()} onImported={jest.fn()} pickCsvFile={async () => ({ name: "history.csv", size: text.length, text })} searchAssetLookupResults={async () => ({ failures: [], results: [lookup] })} store={store} />);
    fireEvent.press(screen.getByTestId("transaction-import-source-zerodhaTradebookEqV1"));
    fireEvent.press(screen.getByTestId("select-transaction-csv"));
    await waitFor(() => expect(screen.getByTestId("transaction-import-identity-conflicts")).toBeTruthy());
    expect(screen.queryByTestId("transaction-import-accept-matches")).toBeNull();
    expect(screen.queryByTestId("confirm-transaction-import")).toBeNull();
    expect(screen.getByTestId("transaction-import-row-accounting").props.children.join("")).toContain("2 parsed rows");
    expect(store.getState().trades).toHaveLength(0);
  });

  it("searches each historical symbol for the same ISIN instead of caching only the first", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const text = `${zerodhaHeader}\nOLDNAME,INE000000001,2024-01-02,NSE,EQ,EQ,buy,false,1,100,one,one,2024-01-02T10:00:00\nHDFCBANK,INE000000001,2025-01-02,NSE,EQ,EQ,buy,false,1,100,two,two,2025-01-02T10:00:00`;
    const search = jest.fn(async ({ query }: { query: string }) => ({ failures: [], results: query === "HDFCBANK" ? [lookup] : [] }));
    const screen = render(<TransactionImportScreen onCancel={jest.fn()} onImported={jest.fn()} pickCsvFile={async () => ({ name: "history.csv", size: text.length, text })} searchAssetLookupResults={search} store={store} />);
    fireEvent.press(screen.getByTestId("transaction-import-source-zerodhaTradebookEqV1"));
    fireEvent.press(screen.getByTestId("select-transaction-csv"));
    await waitFor(() => expect(screen.getByTestId("transaction-import-asset-isin:INE000000001-candidate-yahoo:HDFCBANK.NS")).toBeTruthy());
    expect(search).toHaveBeenCalledWith({ query: "OLDNAME" });
    expect(search).toHaveBeenCalledWith({ query: "HDFCBANK" });
    expect(screen.queryByTestId("transaction-import-accept-matches")).toBeNull();
  });

  it("does not reuse incompatible currency candidates when replacing a CSV", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const first = `${header}\n1,buy,2025-04-01,INE000000001,,,INR,2,100,,,one,,,,,`;
    const second = first.replace(",INR,", ",USD,");
    const picker = jest.fn().mockResolvedValueOnce({ name: "first.csv", size: first.length, text: first }).mockResolvedValueOnce({ name: "second.csv", size: second.length, text: second });
    const search = jest.fn().mockResolvedValueOnce({ failures: [], results: [lookup] }).mockResolvedValueOnce({ failures: [], results: [] });
    const screen = render(<TransactionImportScreen onCancel={jest.fn()} onImported={jest.fn()} pickCsvFile={picker} searchAssetLookupResults={search} store={store} />);
    fireEvent.press(screen.getByTestId("select-transaction-csv"));
    await waitFor(() => expect(screen.getByTestId("transaction-import-asset-isin:INE000000001-candidate-yahoo:HDFCBANK.NS")).toBeTruthy());
    fireEvent.press(screen.getByTestId("select-transaction-csv"));
    await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("transaction-import-asset-isin:INE000000001-candidate-yahoo:HDFCBANK.NS")).toBeNull();
    expect(store.getState().trades).toHaveLength(0);
  });

  it("accepts exact Tradebook matches once and keeps them when annual files change", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onImported = jest.fn();
    const first = `${zerodhaHeader}\nHDFCBANK,INE000000001,2024-01-02,NSE,EQ,EQ,buy,false,1,100,trade-1,order-1,2024-01-02T10:00:00`;
    const second = `${zerodhaHeader}\nHDFCBANK,INE000000001,2025-01-02,NSE,EQ,EQ,buy,false,2,110,trade-2,order-2,2025-01-02T10:00:00`;
    const search = jest.fn(async ({ query }: { query: string }) => ({ failures: [], results: query === "HDFCBANK" ? [lookup] : [] }));
    const picker = jest.fn().mockResolvedValueOnce({ name: "first.csv", size: first.length, text: first })
      .mockResolvedValueOnce({ name: "second.csv", size: second.length, text: second });
    const screen = render(<TransactionImportScreen onCancel={jest.fn()} onImported={onImported} pickCsvFile={picker} searchAssetLookupResults={search} store={store} />);
    fireEvent.press(screen.getByTestId("transaction-import-source-zerodhaTradebookEqV1"));
    fireEvent.press(screen.getByTestId("select-transaction-csv"));
    await waitFor(() => expect(screen.getByTestId("transaction-import-accept-matches")).toBeTruthy());
    expect(store.getState().trades).toHaveLength(0);
    fireEvent.press(screen.getByTestId("transaction-import-accept-matches"));
    await waitFor(() => expect(screen.getByTestId("transaction-import-match-summary")).toHaveTextContent(/1 matched • 0 to confirm/u));
    expect(screen.queryByTestId("transaction-import-asset-isin:INE000000001-candidate-yahoo:HDFCBANK.NS")).toBeNull();
    fireEvent.press(screen.getByTestId("select-transaction-csv"));
    await waitFor(() => expect(screen.getByTestId("transaction-import-summary-additions")).toHaveTextContent("2"));
    expect(screen.getByTestId("transaction-import-match-summary")).toHaveTextContent(/1 matched • 0 to confirm/u);
    expect(search).toHaveBeenCalledTimes(2);
    fireEvent.press(screen.getByTestId("transaction-import-file-1-up"));
    await waitFor(() => expect(screen.getByTestId("transaction-import-summary-additions")).toHaveTextContent("2"));
    expect(search).toHaveBeenCalledTimes(2);
    fireEvent.press(screen.getByTestId("confirm-transaction-import"));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(store.getState().trades).toHaveLength(2);
    expect(store.getState().assets).toHaveLength(1);
    expect(store.getState().cashEntries).toHaveLength(0);
  });

  it("keeps CAS identity private while retrying a password and importing reviewed rows", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "debt",
      currency: "INR",
      id: "asset-sample-fund",
      isin: "INF000000001",
      instrumentType: "mutualFund",
      name: "My saved fund",
      symbol: "SAMPLE",
      ticker: "SAMPLE",
    });
    const readCasStatement = jest
      .fn()
      .mockRejectedValueOnce(new Error("This statement requires its PDF password."))
      .mockResolvedValueOnce({
        normalization: {
          errors: [],
          parserErrors: [],
          preservedNotices: [{ date: "2024-02-01", folioLabel: "Folio 1", rowNumber: 13, type: "cancelled" }],
          preservedCharges: [
            {
              amount: "0.05",
              date: "2024-01-02",
              folioLabel: "Folio 1",
              rowNumber: 12,
              type: "stampDuty",
            },
          ],
          rows: [
            {
              account: `folio_${"a".repeat(64)}`,
              currency: "INR",
              description: "SIP purchase",
              externalId: "cas:2024-01-02:purchaseSip:8:125:8",
              fingerprint: "cas-row-fingerprint",
              identity: { kind: "isin", value: "INF000000001" },
              isin: "INF000000001",
              quantity: 8,
              rowNumber: 11,
              source: {
                format: "cams-kfin-cas",
                version: "combined-detailed-v1",
              },
              tradeDate: "2024-01-02",
              transactionType: "buy",
              unitPrice: 125,
            },
          ],
          schemes: [
            {
              closingUnits: "8",
              events: [],
              folioLabel: "Folio 1",
              importableTransactions: 1,
              isin: "INF000000001",
              name: "Sample Equity Fund",
              openingUnits: "0",
              registrar: "CAMS",
            },
          ],
          unsupportedEvents: [],
        },
        pageCount: 8,
      });
    const onImported = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <TransactionImportScreen
        onCancel={jest.fn()}
        onImported={onImported}
        pickCasStatement={async () => ({
          size: 4096,
          uri: "content://private-statement.pdf",
        })}
        pickCsvFile={jest.fn()}
        readCasStatement={readCasStatement}
        searchAssetLookupResults={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("transaction-import-source-camsKfinCasPdfV1"));
    fireEvent.press(getByTestId("select-cas-statement"));
    await waitFor(() =>
      expect(getByText("This statement requires its PDF password.")).toBeTruthy(),
    );
    expect(queryByText(/private-statement/iu)).toBeNull();

    fireEvent.changeText(getByTestId("cas-statement-password"), "transient-password");
    fireEvent.press(getByTestId("read-cas-statement"));
    await waitFor(() => expect(getByTestId("cas-statement-review")).toBeTruthy());
    expect(getByText("Statement selected")).toBeTruthy();
    expect(getByText("Folio 1 • CAMS • INF000000001")).toBeTruthy();
    expect(getByText("Cancellation notice retained in this review")).toBeTruthy();
    expect(getByText("Folio 1 · 2024-02-01 · Cancelled")).toBeTruthy();
    expect(store.getState().trades).toHaveLength(0);
    expect(getByTestId("cas-preserved-charges")).toHaveTextContent(
      /1 stamp-duty entry is preserved/u,
    );
    expect(readCasStatement).toHaveBeenNthCalledWith(1, {
      password: undefined,
      source: { size: 4096, uri: "content://private-statement.pdf" },
    });
    expect(readCasStatement).toHaveBeenNthCalledWith(2, {
      password: "transient-password",
      source: { size: 4096, uri: "content://private-statement.pdf" },
    });
    expect(getByTestId("cas-statement-password")).toHaveProp("value", "");

    fireEvent.press(getByTestId("confirm-transaction-import"));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(store.getState().trades).toHaveLength(1);
    expect(store.getState().assets).toHaveLength(1);
    expect(store.getState().assets[0]).toMatchObject({
      id: "asset-sample-fund",
      name: "My saved fund",
      symbol: "SAMPLE",
    });
    await waitFor(() =>
      expect(getByTestId("transaction-import-summary-duplicates")).toHaveTextContent("1"),
    );
    expect(
      getByTestId("confirm-transaction-import").props.accessibilityState
        ?.disabled,
    ).toBe(true);
    expect(JSON.stringify(store.getState())).not.toContain("transient-password");
    expect(JSON.stringify(store.getState())).not.toContain("private-statement.pdf");
  });

  it("creates one local mutual-fund holding from a verified CAS scheme on a fresh portfolio", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const searchAssetLookupResults = jest.fn();
    const onImported = jest.fn();
    const screen = render(
      <TransactionImportScreen
        onCancel={jest.fn()}
        onImported={onImported}
        lookupAmfiSchemeClassifications={async () => ({
          classifications: {
            INF000000001: {
              allocation: "equity",
              category: "Equity Scheme - Sectoral/Thematic",
              schemeName: "Sample Equity Fund - Direct Growth",
            },
          },
        })}
        pickCasStatement={async () => ({
          size: 4096,
          uri: "content://synthetic-statement.pdf",
        })}
        pickCsvFile={jest.fn()}
        readCasStatement={async () => ({
          normalization: {
            errors: [],
            parserErrors: [],
            preservedCharges: [],
            rows: [
              {
                account: `folio_${"a".repeat(64)}`,
                currency: "INR",
                description: "Purchase",
                externalId: "cas:2024-01-02:purchase:10:100:10",
                fingerprint: "synthetic-cas-row",
                identity: { kind: "isin", value: "INF000000001" },
                isin: "INF000000001",
                quantity: 10,
                rowNumber: 11,
                source: {
                  format: "cams-kfin-cas",
                  version: "combined-detailed-v1",
                },
                tradeDate: "2024-01-02",
                transactionType: "buy",
                unitPrice: 100,
              },
              {
                account: `folio_${"b".repeat(64)}`,
                currency: "INR",
                description: "Purchase",
                externalId: "cas:2024-02-02:purchase:5:110:5",
                fingerprint: "synthetic-cas-row-two",
                identity: { kind: "isin", value: "INF000000001" },
                isin: "INF000000001",
                quantity: 5,
                rowNumber: 21,
                source: {
                  format: "cams-kfin-cas",
                  version: "combined-detailed-v1",
                },
                tradeDate: "2024-02-02",
                transactionType: "buy",
                unitPrice: 110,
              },
            ],
            schemes: [
              {
                closingUnits: "10",
                events: [],
                folioLabel: "Folio 1",
                importableTransactions: 1,
                isin: "INF000000001",
                name: "Sample Equity Fund - Direct Growth",
                openingUnits: "0",
                registrar: "CAMS",
              },
              {
                closingUnits: "5",
                events: [],
                folioLabel: "Folio 2",
                importableTransactions: 1,
                isin: "INF000000001",
                name: "Sample Equity Fund - Direct Growth",
                openingUnits: "0",
                registrar: "KFINTECH",
              },
            ],
            unsupportedEvents: [],
          },
          pageCount: 2,
        })}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.press(
      screen.getByTestId("transaction-import-source-camsKfinCasPdfV1"),
    );
    fireEvent.press(screen.getByTestId("select-cas-statement"));

    await waitFor(() =>
      expect(screen.getByTestId("transaction-import-match-summary"))
        .toHaveTextContent(/1 classified • 0 need classification/u),
    );
    expect(searchAssetLookupResults).not.toHaveBeenCalled();
    expect(screen.queryByText(/No matching listing was found/u)).toBeNull();
    expect(screen.queryByText(/undefined/u)).toBeNull();
    fireEvent.press(screen.getByTestId("transaction-import-show-matched"));
    expect(screen.getByText("INF000000001 • From statement")).toBeTruthy();

    fireEvent.press(screen.getByTestId("confirm-transaction-import"));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));

    expect(store.getState().assets).toEqual([
      expect.objectContaining({
        assetClass: "stock",
        currency: "INR",
        id: "cas:INF000000001",
        instrumentType: "mutualFund",
        isin: "INF000000001",
        name: "Sample Equity Fund - Direct Growth",
        sectorType: "other",
        symbol: "INF000000001",
        ticker: "INF000000001",
      }),
    ]);
    expect(store.getState().assets[0]).not.toHaveProperty("exchange");
    expect(store.getState().assets[0]).not.toHaveProperty("quoteSourceId");
    expect(store.getState().trades).toHaveLength(2);
    expect(store.getState().trades.every(
      (trade) => trade.assetId === "cas:INF000000001",
    )).toBe(true);
  });

  it("asks once how an AMFI hybrid fund should appear in allocation", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onImported = jest.fn();
    const searchAssetLookupResults = jest.fn();
    const screen = render(
      <TransactionImportScreen
        lookupAmfiSchemeClassifications={async () => ({
          classifications: {
            INF000000004: {
              category: "Hybrid Schemes - Arbitrage Fund",
              schemeName: "Sample Arbitrage Fund - Direct Growth",
            },
          },
        })}
        onCancel={jest.fn()}
        onImported={onImported}
        pickCasStatement={async () => ({ size: 4096, uri: "content://synthetic-hybrid.pdf" })}
        pickCsvFile={jest.fn()}
        readCasStatement={async () => ({
          normalization: {
            errors: [], parserErrors: [], preservedCharges: [], unsupportedEvents: [],
            rows: [1, 2].map((rowNumber) => ({
              account: `folio_${"a".repeat(64)}`,
              currency: "INR" as const,
              description: "Purchase",
              externalId: `cas:hybrid:${rowNumber}`,
              fingerprint: `cas-hybrid-${rowNumber}`,
              identity: { kind: "isin" as const, value: "INF000000004" },
              isin: "INF000000004",
              quantity: 5,
              rowNumber,
              source: { format: "cams-kfin-cas" as const, version: "combined-detailed-v1" as const },
              tradeDate: `2024-0${rowNumber}-02`,
              transactionType: "buy" as const,
              unitPrice: 100,
            })),
            schemes: [{
              closingUnits: "10", events: [], folioLabel: "Folio 1",
              importableTransactions: 2, isin: "INF000000004",
              name: "Sample Arbitrage Fund - Direct Growth", openingUnits: "0",
              registrar: "CAMS" as const,
            }],
          },
          pageCount: 1,
        })}
        searchAssetLookupResults={searchAssetLookupResults}
        store={store}
      />,
    );

    fireEvent.press(screen.getByTestId("transaction-import-source-camsKfinCasPdfV1"));
    fireEvent.press(screen.getByTestId("select-cas-statement"));
    await waitFor(() => expect(screen.getByTestId("transaction-import-match-summary"))
      .toHaveTextContent(/0 classified • 1 need classification/u));
    expect(screen.getByText(/Fund identity is verified from the statement/u)).toBeTruthy();
    expect(searchAssetLookupResults).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-transaction-import")).toBeNull();

    fireEvent.press(screen.getByText("Classify as Equity"));
    await waitFor(() => expect(screen.getByTestId("transaction-import-match-summary"))
      .toHaveTextContent(/1 classified • 0 need classification/u));
    fireEvent.press(screen.getByTestId("confirm-transaction-import"));
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
    expect(store.getState().assets).toEqual([expect.objectContaining({
      assetClass: "stock",
      id: "cas:INF000000004",
      instrumentType: "arbitrageFund",
      isin: "INF000000004",
    })]);
    expect(store.getState().trades).toHaveLength(2);
  });

  it("adds, reorders, and removes annual Zerodha files before one dry run", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "asset-example",
      isin: "INE000000001",
      name: "Example",
      symbol: "EXAMPLE",
      ticker: "EXAMPLE.NS",
    });
    const firstText = `${zerodhaHeader}\nEXAMPLE,INE000000001,2024-01-02,NSE,EQ,EQ,buy,false,1,100,trade-1,order-1,2024-01-02T10:00:00`;
    const secondText = `${zerodhaHeader}\nEXAMPLE,INE000000001,2025-01-02,NSE,EQ,EQ,buy,false,1,110,trade-2,order-2,2025-01-02T10:00:00`;
    const pickCsvFile = jest
      .fn()
      .mockResolvedValueOnce({ name: "year-one.csv", size: firstText.length, text: firstText })
      .mockResolvedValueOnce({ name: "year-two.csv", size: secondText.length, text: secondText });
    const { getByTestId, queryByText } = render(
      <TransactionImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={pickCsvFile}
        searchAssetLookupResults={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("transaction-import-source-zerodhaTradebookEqV1"));
    fireEvent.press(getByTestId("select-transaction-csv"));
    await waitFor(() => expect(queryByText("1. year-one.csv")).toBeTruthy());
    fireEvent.press(getByTestId("select-transaction-csv"));
    await waitFor(() => expect(queryByText("2. year-two.csv")).toBeTruthy());

    fireEvent.press(getByTestId("transaction-import-file-1-up"));
    await waitFor(() =>
      expect(within(getByTestId("transaction-import-file-0")).getByText("1. year-two.csv")).toBeTruthy(),
    );
    fireEvent.press(getByTestId("transaction-import-file-0-remove"));
    await waitFor(() => expect(queryByText("year-two.csv")).toBeNull());
    expect(queryByText("1. year-one.csv")).toBeTruthy();
  });

  it("requires the Zerodha external-activity confirmation for full history", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      exchange: "NSE",
      id: "asset-example",
      isin: "INE000000001",
      name: "Example",
      symbol: "EXAMPLE",
      ticker: "EXAMPLE.NS",
    });
    store.getState().addOpeningPosition({
      assetId: "asset-example",
      averageCostPrice: 100,
      date: "2024-01-02",
      id: "opening-example",
      measuredAsOf: "2025-01-01",
      quantity: 1,
    });
    const text = `${zerodhaHeader}\nEXAMPLE,INE000000001,2024-01-02,NSE,EQ,EQ,buy,false,1,100,trade-1,order-1,2024-01-02T10:00:00`;
    const pickCsvFile = jest
      .fn()
      .mockResolvedValueOnce({ name: "tradebook.csv", size: text.length, text })
      .mockResolvedValueOnce({ name: "tradebook-2.csv", size: text.length, text });
    const { getByTestId } = render(
      <TransactionImportScreen
        onCancel={jest.fn()}
        onImported={jest.fn()}
        pickCsvFile={pickCsvFile}
        searchAssetLookupResults={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("transaction-import-source-zerodhaTradebookEqV1"));
    fireEvent.press(getByTestId("transaction-import-mode-full-history"));
    fireEvent.press(getByTestId("select-transaction-csv"));
    await waitFor(() => expect(getByTestId("transaction-import-source-coverage")).toBeTruthy());
    expect(getByTestId("confirm-transaction-import").props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(getByTestId("transaction-import-no-external-activity"));
    await waitFor(() =>
      expect(getByTestId("confirm-transaction-import").props.accessibilityState?.disabled).not.toBe(true),
    );

    fireEvent.press(getByTestId("select-transaction-csv"));
    await waitFor(() =>
      expect(getByTestId("confirm-transaction-import").props.accessibilityState?.disabled).toBe(true),
    );
  });

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
    expect(queryByTestId("confirm-transaction-import")).toBeNull();
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

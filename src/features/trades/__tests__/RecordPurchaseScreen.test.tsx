import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { usePreventRemove } from "expo-router/react-navigation";
import { RecordPurchaseScreen } from "../RecordPurchaseScreen";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { Asset } from "@/src/types";
import { mapYahooQuoteToLookupResult } from "@/src/services/assetLookup";

jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));
const now = new Date("2026-09-20T10:00:00Z");
const asset: Asset = { id: "asset", name: "Accounting Test Asset", symbol: "ACCT", ticker: "ACCT.NS", currency: "INR", assetClass: "stock", exchange: "NSE" };
async function setup(amount = 1000, masked = false) {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now: () => now });
  store.getState().addAsset(asset);
  store.getState().addCashEntry({ id: "deposit", date: "2026-09-01", amount, label: "Contribution", purpose: "capitalContribution", type: "addition" });
  store.getState().updatePreferences({ maskWealthValues: masked });
  const onSaved = jest.fn();
  const onCancel = jest.fn();
  const ui = await render(<RecordPurchaseScreen store={store} now={now} onSaved={onSaved} onCancel={onCancel} searchAssets={async () => ({ results: [], failures: ["unavailable"] })} />);
  return { ui, store, storage, onSaved, onCancel };
}
async function details(ui: Awaited<ReturnType<typeof render>>, quantity = "2") {
  await fireEvent.press(ui.getByTestId("existing-asset-asset"));
  await fireEvent.changeText(ui.getByTestId("purchase-quantity"), quantity);
  await fireEvent.changeText(ui.getByTestId("purchase-price"), "100");
  await fireEvent.changeText(ui.getByTestId("purchase-fees"), "5");
  await fireEvent.press(ui.getByTestId("purchase-review-button"));
}

describe("Record purchase", () => {
  it("shares asset discovery labels and shows progress without changing saved identity", async () => {
    const { ui, store } = await setup();
    expect(ui.getByText("Search asset")).toBeTruthy();
    expect(ui.getByText("Saved assets")).toBeTruthy();
    expect(ui.getByPlaceholderText("Name, symbol, or ticker")).toBeTruthy();
    expect(ui.getByLabelText("Record purchase progress")).toHaveProp("accessibilityValue", {
      min: 1, max: 3, now: 1, text: "Step 1 of 3: Choose asset",
    });
    await fireEvent.press(ui.getByTestId("existing-asset-asset"));
    expect(ui.getByLabelText("Record purchase progress")).toHaveProp("accessibilityValue", {
      min: 1, max: 3, now: 2, text: "Step 2 of 3",
    });
    await fireEvent.press(ui.getByTestId("purchase-back"));
    expect(ui.getByText("Search asset")).toBeTruthy();
    expect(store.getState().trades).toEqual([]);
  });
  it("persists a searched listing's asset identity without provider-only metadata", async () => {
    const { ui, store, onSaved, onCancel } = await setup();
    await ui.rerender(<RecordPurchaseScreen store={store} now={now} onSaved={onSaved} onCancel={onCancel}
      searchAssets={async () => ({ failures: [], results: [mapYahooQuoteToLookupResult({ symbol: "NEW.NS", quoteType: "EQUITY", longname: "New investment" })!] })} />);
    await fireEvent.changeText(ui.getByTestId("purchase-search"), "NEW");
    await act(async () => { await fireEvent.press(ui.getByTestId("purchase-search-button")); });
    await fireEvent.press(ui.getByTestId("asset-lookup-result-yahoo:NEW.NS"));
    await fireEvent.changeText(ui.getByTestId("purchase-quantity"), "2");
    await fireEvent.changeText(ui.getByTestId("purchase-price"), "100");
    await fireEvent.press(ui.getByTestId("purchase-review-button"));
    await fireEvent.press(ui.getByTestId("purchase-confirm"));
    expect(store.getState().assets).toHaveLength(2);
    expect(store.getState().assets[1]).not.toHaveProperty("provider");
    expect(() => store.getState().captureBackup()).not.toThrow();
  });
  it("reviews and atomically records units, cost including fees and linked Cash without fabricating a quote", async () => {
    const { ui, store, storage, onSaved } = await setup();
    await details(ui);
    expect(ui.getByTestId("purchase-review-quantity")).toHaveTextContent("2");
    expect(ui.getByTestId("purchase-review-price")).toHaveTextContent("₹100.00");
    expect(ui.getByTestId("purchase-review-fees")).toHaveTextContent("₹5.00");
    expect(ui.getByTestId("purchase-review-date")).toHaveTextContent("2026-09-20");
    expect(ui.getByTestId("purchase-cash-debit")).toHaveTextContent("₹205.00");
    expect(store.getState().trades).toHaveLength(0);
    await fireEvent.press(ui.getByTestId("purchase-confirm"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(store.getState().trades[0]).toMatchObject({ assetId: "asset", quantity: 2, fees: 5, totalValue: 205 });
    expect(store.getState().cashEntries[1]).toMatchObject({ amount: 205, linkedTradeId: store.getState().trades[0].id, purpose: "purchaseFunding" });
    expect(createPortfolioStore({ storage, now: () => now }).getState().trades).toEqual(store.getState().trades);
    expect(store.getState().quoteCache).toEqual({});
    expect(store.getState().assets).toHaveLength(1);
  });
  it("keeps insufficient funds on review without writing or signaling success", async () => {
    const { ui, store, storage, onSaved } = await setup(100);
    const raw = storage.getRawItem(portfolioStorageKey);
    await details(ui);
    await fireEvent.press(ui.getByTestId("purchase-confirm"));
    expect(ui.getByTestId("purchase-save-error")).toHaveTextContent(/Not enough Cash/);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    expect(store.getState().trades).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });
  it("masks review aggregate amounts and preserves a draft through Back and canceled exit", async () => {
    const { ui, onCancel } = await setup(1000, true);
    await details(ui);
    expect(ui.getByTestId("purchase-cash-debit")).toHaveTextContent("₹••••");
    expect(ui.getByTestId("purchase-available-cash")).toHaveTextContent("₹••••");
    expect(ui.getByTestId("purchase-cash-debit")).toHaveProp("accessibilityLabel", "Amount hidden");
    expect(ui.getByTestId("purchase-available-cash")).toHaveProp("accessibilityLabel", "Amount hidden");
    await fireEvent.press(ui.getByTestId("purchase-back"));
    expect(ui.getByTestId("purchase-quantity")).toHaveProp("value", "2");
    await fireEvent.press(ui.getByTestId("purchase-cancel"));
    await fireEvent.press(ui.getByTestId("purchase-keep-editing"));
    expect(ui.getByTestId("purchase-quantity")).toHaveProp("value", "2");
    expect(onCancel).not.toHaveBeenCalled();
    const [prevented] = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
    expect(prevented).toBe(true);
    await fireEvent.press(ui.getByTestId("purchase-cancel"));
    await fireEvent.press(ui.getByTestId("purchase-discard"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it("keeps failed persistence retryable without mutations", async () => {
    const { ui, store, storage, onSaved } = await setup();
    await details(ui);
    const before = store.getState();
    const write = storage.setItem;
    storage.setItem = () => { throw new Error("full"); };
    await fireEvent.press(ui.getByTestId("purchase-confirm"));
    expect(ui.getByTestId("purchase-save-error")).toHaveTextContent(/Your records are unchanged/);
    expect(store.getState()).toBe(before);
    expect(onSaved).not.toHaveBeenCalled();
    storage.setItem = write;
    await fireEvent.press(ui.getByTestId("purchase-confirm"));
    expect(store.getState().trades).toHaveLength(1);
  });
  it("keeps saved identity selection available when provider search fails", async () => {
    const { ui } = await setup();
    await fireEvent.changeText(ui.getByTestId("purchase-search"), "Accounting");
    await act(async () => { await fireEvent.press(ui.getByTestId("purchase-search-button")); });
    expect(ui.getByText(/Some listings are unavailable/)).toBeTruthy();
    await fireEvent.press(ui.getByTestId("existing-asset-asset"));
    expect(ui.getByText(/Current price unavailable/)).toBeTruthy();
    expect(ui.queryByText("Ticker")).toBeNull();
    expect(ui.queryByText("Sector type")).toBeNull();
  });
  it("rejects backdated funding gaps even when current Cash is sufficient", async () => {
    const { ui, store, storage } = await setup();
    await act(() => {
      store.getState().addCashEntry({ id: "withdrawal", date: "2026-09-10", amount: 900, label: "Other use", purpose: "withdrawal", type: "withdrawal" });
      store.getState().addCashEntry({ id: "later-deposit", date: "2026-09-15", amount: 1000, label: "Later funding", purpose: "capitalContribution", type: "addition" });
    });
    await details(ui);
    await fireEvent.press(ui.getByTestId("purchase-back"));
    await fireEvent.press(ui.getByTestId("purchase-date"));
    await fireEvent(ui.getByTestId("purchase-date-picker"), "onChange", { nativeEvent: { timestamp: new Date("2026-09-05T10:00:00Z").getTime() } });
    await fireEvent.press(ui.getByTestId("purchase-review-button"));
    const raw = storage.getRawItem(portfolioStorageKey);
    await fireEvent.press(ui.getByTestId("purchase-confirm"));
    expect(ui.getByTestId("purchase-save-error")).toHaveTextContent(/dated Cash funding/);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    expect(store.getState().trades).toHaveLength(0);
  });
});

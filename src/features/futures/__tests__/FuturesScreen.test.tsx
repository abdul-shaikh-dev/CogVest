import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert, BackHandler } from "react-native";
import { usePreventRemove } from "@react-navigation/native";

import { FuturesScreen } from "@/src/features/futures/FuturesScreen";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const mockDispatch = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: jest.fn(),
  useFocusEffect: (effect: () => void) => require("react").useEffect(effect, [effect]),
}));

beforeEach(() => jest.clearAllMocks());
function setTime(screen: ReturnType<typeof render>, id: string, value: string) {
  if (!screen.queryByTestId(id)) fireEvent.press(screen.getByTestId(`${id}-exact-toggle`));
  fireEvent.changeText(screen.getByTestId(id), value);
}

describe("manual Futures screen", () => {
  it("rejects invalid dates and incomplete observation evidence without persisting", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(<FuturesScreen onBack={() => {}} store={store} />);
    setTime(screen, "futures-opening-at", "2026-02-30T10:00:00Z");
    fireEvent.press(screen.getByTestId("futures-save-account"));
    expect(screen.getByText("Choose a valid date and time with timezone.")).toBeTruthy();
    expect(store.getState().futuresAccounts).toEqual([]);
    setTime(screen, "futures-opening-at", "2026-09-01T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-opening-rate"), "90");
    fireEvent.press(screen.getByTestId("futures-save-account"));
    expect(screen.getByText("Enter rate observation time.")).toBeTruthy();
    expect(screen.getByText("Enter rate source.")).toBeTruthy();
    expect(store.getState().futuresAccounts).toEqual([]);
  });

  it("keeps incomplete executions and valuations out of saved records", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(<FuturesScreen onBack={() => {}} store={store} />);
    fireEvent.press(screen.getByTestId("futures-save-account"));
    const before = JSON.stringify(store.getState().futuresAccounts);
    fireEvent.press(screen.getByTestId("futures-add-event"));
    fireEvent.press(screen.getByTestId("futures-save-event"));
    expect(screen.getByText("Enter quantity.")).toBeTruthy();
    expect(store.getState().futuresAccounts[0].events).toEqual([]);
    fireEvent.press(screen.getByTestId("futures-save-valuation"));
    expect(screen.getByText("Enter observed wallet balance.")).toBeTruthy();
    expect(JSON.stringify(store.getState().futuresAccounts)).toBe(before);
  });

  it("protects wallet drafts on visible, hardware and route exits without writing data", () => {
    let hardwareBack: (() => boolean) | undefined;
    const listener = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, callback) => {
      hardwareBack = callback as () => boolean;
      return { remove: jest.fn() };
    });
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onBack = jest.fn();
    const screen = render(<FuturesScreen onBack={onBack} store={store} />);
    fireEvent.changeText(screen.getByTestId("futures-opening-wallet"), "1000");
    fireEvent.press(screen.getByTestId("futures-back"));
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId("futures-keep-editing"));
    expect(screen.getByTestId("futures-opening-wallet").props.value).toBe("1000");
    act(() => { expect(hardwareBack?.()).toBe(true); });
    fireEvent.press(screen.getByTestId("futures-keep-editing"));
    const guard = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
    expect(guard[0]).toBe(true);
    const action = { type: "POP" };
    act(() => guard[1]({ data: { action } } as never));
    fireEvent.press(screen.getByTestId("futures-discard"));
    expect(mockDispatch).toHaveBeenCalledWith(action);
    expect(store.getState().futuresAccounts).toEqual([]);
    listener.mockRestore();
  });

  it("does not protect untouched or committed wallets", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onBack = jest.fn();
    const screen = render(<FuturesScreen onBack={onBack} store={store} />);
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(false);
    fireEvent.changeText(screen.getByTestId("futures-opening-wallet"), "1000");
    fireEvent.press(screen.getByTestId("futures-save-account"));
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(false);
    fireEvent.press(screen.getByTestId("futures-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it.each(["execution", "cash", "valuation"])("keeps and explicitly discards %s edits without changing stored records", (kind) => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const onBack = jest.fn();
    const screen = render(<FuturesScreen onBack={onBack} store={store} />);
    fireEvent.press(screen.getByTestId("futures-save-account"));
    const before = JSON.stringify(store.getState().futuresAccounts);
    if (kind === "execution") fireEvent.press(screen.getByTestId("futures-add-event"));
    if (kind === "cash") fireEvent.press(screen.getByTestId("futures-add-cash-funding"));
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(false);
    const field = kind === "execution" ? "futures-quantity" : kind === "cash" ? "futures-cash-usdt" : "futures-observed-wallet";
    fireEvent.changeText(screen.getByTestId(field), "123");
    fireEvent.press(screen.getByTestId("futures-back"));
    fireEvent.press(screen.getByTestId("futures-keep-editing"));
    expect(screen.getByTestId(field).props.value).toBe("123");
    fireEvent.press(screen.getByTestId("futures-back"));
    fireEvent.press(screen.getByTestId("futures-discard"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(store.getState().futuresAccounts)).toBe(before);
    expect(store.getState().cashEntries).toEqual([]);
  });

  it("uses independent checkboxes and guards local cancellation while keeping unrelated drafts", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const screen = render(<FuturesScreen onBack={() => {}} store={store} />);
    fireEvent.press(screen.getByTestId("futures-save-account"));
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    fireEvent.press(screen.getByTestId("futures-positions-confirmed"));
    fireEvent.press(screen.getByTestId("futures-events-confirmed"));
    expect(screen.getByTestId("futures-positions-confirmed").props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId("futures-events-confirmed").props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId("futures-boundary-confirmed").props.accessibilityState.checked).toBe(false);
    fireEvent.press(screen.getByTestId("futures-add-event"));
    fireEvent.changeText(screen.getByTestId("futures-price"), "50");
    fireEvent.press(screen.getByTestId("futures-cancel-event"));
    fireEvent.press(screen.getByTestId("futures-keep-editing"));
    expect(screen.getByTestId("futures-price").props.value).toBe("50");
    fireEvent.press(screen.getByTestId("futures-cancel-event"));
    fireEvent.press(screen.getByTestId("futures-discard"));
    expect(screen.queryByTestId("futures-price")).toBeNull();
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(true);
  });

  it("keeps a new execution draft when another persisted activity is deleted", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().saveFuturesAccount({ id: "binance-usdm-main", marginMode: "cross", positionMode: "one-way", settlementAsset: "USDT", openingAt: "2026-09-01T00:00:00Z", openingWalletUsdt: "1000", events: [{ id: "existing", type: "execution", at: "2026-09-02T00:00:00Z", contract: "BTCUSDT", side: "buy", quantity: "1", price: "100", feeUsdt: "0", leverage: "10" }] });
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const screen = render(<FuturesScreen onBack={() => {}} store={store} />);
    fireEvent.press(screen.getByTestId("futures-add-event"));
    fireEvent.changeText(screen.getByTestId("futures-quantity"), "2");
    fireEvent.press(screen.getByTestId("delete-futures-existing"));
    act(() => { alert.mock.calls.at(-1)?.[2]?.find((button) => button.text === "Delete activity")?.onPress?.(); });
    expect(store.getState().futuresAccounts[0].events).toEqual([]);
    expect(screen.getByTestId("futures-quantity").props.value).toBe("2");
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(true);
    alert.mockRestore();
  });
  it("records a linked Cash funding movement without opening a position", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => new Date("2026-09-29T12:00:00Z") });
    store.getState().addCashEntry({ id: "cash-opening", amount: 10000, date: "2026-09-01", label: "Opening Cash", purpose: "capitalContribution", type: "addition" });
    const screen = render(<FuturesScreen onBack={() => {}} store={store} />);
    setTime(screen, "futures-opening-at", "2026-09-01T00:00:00Z");
    fireEvent.press(screen.getByTestId("futures-save-account"));
    fireEvent.press(screen.getByTestId("futures-add-cash-funding"));
    setTime(screen, "futures-cash-at", "2026-09-02T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-cash-usdt"), "100");
    fireEvent.changeText(screen.getByTestId("futures-cash-inr"), "9010");
    fireEvent.changeText(screen.getByTestId("futures-cash-fee"), "10");
    fireEvent.changeText(screen.getByTestId("futures-cash-rate"), "90");
    setTime(screen, "futures-cash-rate-at", "2026-09-02T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-cash-rate-source"), "Conversion receipt");
    fireEvent.press(screen.getByTestId("futures-save-cash-funding"));
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(false);
    expect(store.getState().cashEntries[1]).toMatchObject({ amount: 9010, purpose: "futuresTransfer", type: "withdrawal" });
    expect(store.getState().futuresAccounts[0].events).toMatchObject([{ type: "transfer", amountUsdt: "100" }]);
    expect(screen.getAllByText(/100 USDT/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/BTCUSDT · Long/)).toBeNull();
  });

  it("records and corrects a closed trade with a reconciled USDT wallet", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now: () => new Date("2026-09-29T12:00:00Z") });
    const screen = render(<FuturesScreen onBack={() => {}} store={store} />);
    setTime(screen, "futures-opening-at", "2026-09-01T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-opening-wallet"), "1000");
    fireEvent.changeText(screen.getByTestId("futures-opening-rate"), "90");
    setTime(screen, "futures-opening-rate-at", "2026-09-01T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-opening-rate-source"), "Dated INR quote");
    fireEvent.press(screen.getByTestId("futures-save-account"));
    expect(store.getState().futuresAccounts[0].openingWalletUsdt).toBe("1000");

    fireEvent.press(screen.getByTestId("futures-add-event"));
    setTime(screen, "futures-event-at", "2026-09-02T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-quantity"), "1");
    fireEvent.changeText(screen.getByTestId("futures-price"), "100");
    fireEvent.changeText(screen.getByTestId("futures-fee"), "1");
    fireEvent.changeText(screen.getByTestId("futures-leverage"), "10");
    fireEvent.changeText(screen.getByTestId("futures-event-rate"), "90");
    setTime(screen, "futures-event-rate-at", "2026-09-02T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-event-rate-source"), "Dated INR quote");
    fireEvent.press(screen.getByTestId("futures-save-event"));
    expect(store.getState().futuresAccounts[0].events).toHaveLength(1);

    fireEvent.press(screen.getByTestId("futures-add-event"));
    fireEvent.press(screen.getByTestId("futures-type-execution"));
    setTime(screen, "futures-event-at", "2026-09-03T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-quantity"), "1");
    fireEvent.changeText(screen.getByTestId("futures-price"), "110");
    fireEvent.changeText(screen.getByTestId("futures-fee"), "1");
    fireEvent.changeText(screen.getByTestId("futures-leverage"), "10");
    fireEvent.changeText(screen.getByTestId("futures-event-rate"), "90");
    setTime(screen, "futures-event-rate-at", "2026-09-03T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-event-rate-source"), "Dated INR quote");
    fireEvent.press(screen.getByText("Sell"));
    fireEvent.press(screen.getByTestId("futures-save-event"));
    expect(store.getState().futuresAccounts[0].events).toHaveLength(2);
    expect(screen.getByText("Closed trades")).toBeTruthy();
    const closingId = store.getState().futuresAccounts[0].events[1].id;
    fireEvent.press(screen.getByTestId(`edit-futures-${closingId}`));
    fireEvent.changeText(screen.getByTestId("futures-price"), "120");
    fireEvent.press(screen.getByTestId("futures-save-event"));
    expect(store.getState().futuresAccounts[0].events.find((event) => event.id === closingId)).toMatchObject({ price: "120" });

    setTime(screen, "futures-valuation-at", "2026-09-29T11:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-observed-wallet"), "1018");
    setTime(screen, "futures-observed-wallet-at", "2026-09-29T11:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-wallet-source"), "Binance Futures wallet");
    fireEvent.changeText(screen.getByTestId("futures-current-rate"), "90");
    setTime(screen, "futures-current-rate-at", "2026-09-29T11:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-current-rate-source"), "Dated INR quote");
    fireEvent.press(screen.getByTestId("futures-positions-confirmed"));
    fireEvent.press(screen.getByTestId("futures-events-confirmed"));
    fireEvent.press(screen.getByTestId("futures-boundary-confirmed"));
    fireEvent.press(screen.getByTestId("futures-save-valuation"));
    expect(store.getState().futuresAccounts[0].valuation?.reconciliation.observedWalletUsdt).toBe("1018");
    expect(jest.mocked(usePreventRemove).mock.calls.at(-1)?.[0]).toBe(false);
    const restarted = createPortfolioStore({ storage, now: () => new Date("2026-09-29T12:00:00Z") });
    expect(restarted.getState().futuresAccounts[0].events).toHaveLength(2);
    expect(restarted.getState().futuresAccounts[0].valuation?.reconciliation.portfolioBoundaryConfirmed).toBe(true);
    expect(screen.getByText(/1 @ 100 USDT/)).toBeTruthy();
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    expect(screen.queryByText(/1 @ 100 USDT/)).toBeNull();
    expect(screen.queryByText(/1 @ 120 USDT/)).toBeNull();
  });
});

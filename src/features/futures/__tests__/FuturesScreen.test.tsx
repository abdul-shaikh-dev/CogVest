import { act, fireEvent, render } from "@testing-library/react-native";

import { FuturesScreen } from "@/src/features/futures/FuturesScreen";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

describe("manual Futures screen", () => {
  it("records and corrects a closed trade with a reconciled USDT wallet", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ storage, now: () => new Date("2026-09-29T12:00:00Z") });
    const screen = render(<FuturesScreen onBack={() => {}} store={store} />);
    fireEvent.changeText(screen.getByTestId("futures-opening-at"), "2026-09-01T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-opening-wallet"), "1000");
    fireEvent.changeText(screen.getByTestId("futures-opening-rate"), "90");
    fireEvent.changeText(screen.getByTestId("futures-opening-rate-at"), "2026-09-01T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-opening-rate-source"), "Dated INR quote");
    fireEvent.press(screen.getByTestId("futures-save-account"));
    expect(store.getState().futuresAccounts[0].openingWalletUsdt).toBe("1000");

    fireEvent.press(screen.getByTestId("futures-add-event"));
    fireEvent.changeText(screen.getByTestId("futures-event-at"), "2026-09-02T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-quantity"), "1");
    fireEvent.changeText(screen.getByTestId("futures-price"), "100");
    fireEvent.changeText(screen.getByTestId("futures-fee"), "1");
    fireEvent.changeText(screen.getByTestId("futures-leverage"), "10");
    fireEvent.changeText(screen.getByTestId("futures-event-rate"), "90");
    fireEvent.changeText(screen.getByTestId("futures-event-rate-at"), "2026-09-02T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-event-rate-source"), "Dated INR quote");
    fireEvent.press(screen.getByTestId("futures-save-event"));
    expect(store.getState().futuresAccounts[0].events).toHaveLength(1);

    fireEvent.press(screen.getByTestId("futures-add-event"));
    fireEvent.press(screen.getByTestId("futures-type-execution"));
    fireEvent.changeText(screen.getByTestId("futures-event-at"), "2026-09-03T00:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-quantity"), "1");
    fireEvent.changeText(screen.getByTestId("futures-price"), "110");
    fireEvent.changeText(screen.getByTestId("futures-fee"), "1");
    fireEvent.changeText(screen.getByTestId("futures-leverage"), "10");
    fireEvent.changeText(screen.getByTestId("futures-event-rate"), "90");
    fireEvent.changeText(screen.getByTestId("futures-event-rate-at"), "2026-09-03T00:00:00Z");
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

    fireEvent.changeText(screen.getByTestId("futures-valuation-at"), "2026-09-29T11:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-observed-wallet"), "1018");
    fireEvent.changeText(screen.getByTestId("futures-observed-wallet-at"), "2026-09-29T11:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-wallet-source"), "Binance Futures wallet");
    fireEvent.changeText(screen.getByTestId("futures-current-rate"), "90");
    fireEvent.changeText(screen.getByTestId("futures-current-rate-at"), "2026-09-29T11:00:00Z");
    fireEvent.changeText(screen.getByTestId("futures-current-rate-source"), "Dated INR quote");
    fireEvent.press(screen.getByTestId("futures-positions-confirmed"));
    fireEvent.press(screen.getByTestId("futures-events-confirmed"));
    fireEvent.press(screen.getByTestId("futures-boundary-confirmed"));
    fireEvent.press(screen.getByTestId("futures-save-valuation"));
    expect(store.getState().futuresAccounts[0].valuation?.reconciliation.observedWalletUsdt).toBe("1018");
    const restarted = createPortfolioStore({ storage, now: () => new Date("2026-09-29T12:00:00Z") });
    expect(restarted.getState().futuresAccounts[0].events).toHaveLength(2);
    expect(restarted.getState().futuresAccounts[0].valuation?.reconciliation.portfolioBoundaryConfirmed).toBe(true);
    expect(screen.getByText(/1 @ 100 USDT/)).toBeTruthy();
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    expect(screen.queryByText(/1 @ 100 USDT/)).toBeNull();
    expect(screen.queryByText(/1 @ 120 USDT/)).toBeNull();
  });
});

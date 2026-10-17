import { act, fireEvent, render, renderHook } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { EpfAccountScreen, EpfBalanceUpdateScreen } from "@/src/features/epf";
import { useDashboard } from "@/src/features/dashboard/useDashboard";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const now = new Date("2026-10-17T10:00:00.000Z");

function setup() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ now: () => now, storage });
  return { store, storage };
}

function seedAccount(store: ReturnType<typeof setup>["store"], extra: { legacyAssetId?: string } = {}) {
  store.getState().applyEpfCommand({ commandId: "seed", reason: "Statement", change: { type: "accountPut", account: {
    id: "acme", nickname: "Acme EPF", provider: "epfo", status: "active", currency: "INR", historyCompleteThrough: null,
    checkpoint: { date: "2026-03-31", balance: { total: 140000, components: { employee: 100000, employer: 40000 } },
      capital: null, source: "epfoStatement", recordedAt: "2026-04-01T00:00:00Z" }, ...extra,
  } } }, store.getState().getBackupRevision());
}

function dashboardTotal(store: ReturnType<typeof setup>["store"]) {
  const hook = renderHook(() => useDashboard({ store, now }));
  const value = hook.result.current.totalValue;
  hook.unmount();
  return value;
}

function addAccount(store: ReturnType<typeof setup>["store"], employee = "100000", employer = "40000") {
  const onComplete = jest.fn();
  const screen = render(<EpfAccountScreen now={now} onBack={jest.fn()} onComplete={onComplete} onUpdateBalance={jest.fn()} store={store} />);
  fireEvent.changeText(screen.getByTestId("epf-nickname-input"), "Acme EPF");
  fireEvent.changeText(screen.getByTestId("epf-employee-input"), employee);
  fireEvent.changeText(screen.getByTestId("epf-employer-input"), employer);
  fireEvent.press(screen.getByTestId("review-epf-account"));
  fireEvent.press(screen.getByTestId("save-epf-account"));
  return { screen, onComplete, id: store.getState().epf.accounts[0]?.id };
}

describe("Add EPF account", () => {
  it("lets a fresh user add EPF from statement balances only and updates Debt and wealth", () => {
    const { store } = setup();
    const screen = render(<EpfAccountScreen now={now} onBack={jest.fn()} onComplete={jest.fn()} onUpdateBalance={jest.fn()} store={store} />);
    expect(screen.getByTestId("epf-eps-note")).toHaveTextContent(/Leave out the EPS pension contribution/);
    fireEvent.changeText(screen.getByTestId("epf-nickname-input"), "Acme EPF");
    fireEvent.changeText(screen.getByTestId("epf-employee-input"), "100000");
    fireEvent.changeText(screen.getByTestId("epf-employer-input"), "40000");
    expect(screen.getByTestId("epf-form-total")).toHaveTextContent("₹1,40,000.00");
    fireEvent.press(screen.getByTestId("review-epf-account"));
    expect(screen.getByTestId("epf-review-total")).toHaveTextContent("₹1,40,000.00");
    expect(store.getState().epf.accounts).toEqual([]);
    fireEvent.press(screen.getByTestId("save-epf-account"));

    expect(store.getState().epf.accounts).toEqual([expect.objectContaining({
      nickname: "Acme EPF", provider: "epfo", status: "active",
      checkpoint: expect.objectContaining({ date: "2026-10-17", capital: null,
        balance: { total: 140000, components: { employee: 100000, employer: 40000 } } }),
    })]);
    expect(screen.getByTestId("epf-account-total").props.accessibilityLabel).toBe("₹1,40,000.00");
    expect(screen.getByTestId("epf-capital")).toHaveTextContent("Unknown");
    screen.unmount();
    const { result } = renderHook(() => useDashboard({ store, now }));
    expect(result.current.totalValue).toBe(140000);
    expect(result.current.allocation.find((item) => item.assetClass === "debt")).toMatchObject({ value: 140000 });
    expect(result.current.investedCapitalComplete).toBe(false);
  });

  it("keeps the draft on invalid input and saves nothing", () => {
    const { store, storage } = setup();
    const before = storage.getRawItem("cogvest:v1:portfolio");
    const screen = render(<EpfAccountScreen now={now} onBack={jest.fn()} onComplete={jest.fn()} onUpdateBalance={jest.fn()} store={store} />);
    fireEvent.changeText(screen.getByTestId("epf-employee-input"), "1.234");
    fireEvent.changeText(screen.getByTestId("epf-employer-input"), "40000");
    fireEvent.press(screen.getByTestId("review-epf-account"));
    expect(screen.getByText("Add a nickname, such as the employer or period.")).toBeTruthy();
    expect(screen.getByText(/employee EPF balance in rupees/)).toBeTruthy();
    expect(screen.getByTestId("epf-employer-input")).toHaveProp("value", "40000");
    expect(screen.queryByTestId("epf-account-review-screen")).toBeNull();
    expect(store.getState().epf.accounts).toEqual([]);
    expect(storage.getRawItem("cogvest:v1:portfolio")).toBe(before);
  });

  it("asks before discarding a draft and leaves data untouched when cancelled", () => {
    const { store } = setup();
    const onBack = jest.fn();
    let backHandler: () => boolean = () => false;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_, handler) => {
      backHandler = handler as () => boolean;
      return { remove: jest.fn() };
    });
    const screen = render(<EpfAccountScreen now={now} onBack={onBack} onComplete={jest.fn()} onUpdateBalance={jest.fn()} store={store} />);
    fireEvent.changeText(screen.getByTestId("epf-employee-input"), "5");
    act(() => { backHandler(); });
    expect(screen.getByTestId("epf-account-exit-confirmation")).toBeTruthy();
    fireEvent.press(screen.getByTestId("keep-editing-epf-account"));
    expect(screen.getByTestId("epf-employee-input")).toHaveProp("value", "5");
    act(() => { backHandler(); });
    fireEvent.press(screen.getByTestId("discard-epf-account"));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(store.getState().epf.accounts).toEqual([]);
    jest.restoreAllMocks();
  });

  it("accepts zero balances and shows the split only on request", () => {
    const { store } = setup();
    const { screen } = addAccount(store, "0", "0");
    expect(screen.getByTestId("epf-account-total").props.accessibilityLabel).toBe("₹0.00");
    expect(screen.queryByTestId("epf-breakdown")).toBeNull();
    fireEvent.press(screen.getByTestId("epf-breakdown-toggle"));
    expect(screen.getByTestId("epf-employee-balance").props.accessibilityLabel).toBe("₹0.00");
  });
});

describe("EPF account detail", () => {
  it("masks values, requires a reveal before editing, and keeps closed accounts valued", () => {
    const { store } = setup();
    const { id } = addAccount(store);
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    const screen = render(<EpfAccountScreen accountId={id} now={now} onBack={jest.fn()} onComplete={jest.fn()} onUpdateBalance={jest.fn()} store={store} />);
    expect(screen.getByTestId("epf-account-total").props.accessibilityLabel).toBe("Amount hidden");
    fireEvent.press(screen.getByTestId("edit-epf-account"));
    expect(screen.getByTestId("reveal-epf-account")).toBeTruthy();
    expect(screen.queryByTestId("epf-employee-input")).toBeNull();

    const account = store.getState().epf.accounts[0];
    act(() => store.getState().applyEpfCommand({ commandId: "close", reason: "Left job",
      change: { type: "accountPut", account: { ...account, status: "closed" } } }, store.getState().getBackupRevision()));
    const { result } = renderHook(() => useDashboard({ store, now }));
    expect(result.current.totalValue).toBe(140000);
  });

  it("links an older holding explicitly and replaces it in totals without deleting it", () => {
    const { store } = setup();
    store.getState().addAsset({ id: "old-epf", name: "Old EPF", symbol: "EPF", ticker: "EPF", assetClass: "debt", currency: "INR", instrumentType: "other" });
    store.getState().addAsset({ id: "stock", name: "Stock", symbol: "S", ticker: "S.NS", assetClass: "stock", currency: "INR", instrumentType: "stock" });
    store.getState().addOpeningPosition({ id: "old-opening", assetId: "old-epf", date: "2025-01-01", quantity: 1, averageCostPrice: 120000, currentPrice: 130000 });
    seedAccount(store);
    expect(dashboardTotal(store)).toBe(270000);

    const screen = render(<EpfAccountScreen accountId="acme" now={now} onBack={jest.fn()} onComplete={jest.fn()} onUpdateBalance={jest.fn()} store={store} />);
    fireEvent.press(screen.getByTestId("epf-legacy-choose"));
    expect(screen.queryByTestId("epf-legacy-option-stock")).toBeNull();
    fireEvent.press(screen.getByTestId("epf-legacy-option-old-epf"));
    expect(screen.getByTestId("epf-legacy-confirm")).toHaveTextContent(/holding and its records stay unchanged/);
    fireEvent.press(screen.getByTestId("epf-legacy-confirm-link"));
    expect(store.getState().epf.accounts[0].legacyAssetId).toBe("old-epf");
    expect(screen.getByTestId("epf-legacy-linked")).toHaveTextContent(/Replaces Old EPF/);
    expect(store.getState().assets.some((asset) => asset.id === "old-epf")).toBe(true);
    screen.unmount();
    expect(dashboardTotal(store)).toBe(140000);
  });

  it("unlinks an older holding and restores it to totals", () => {
    const { store } = setup();
    store.getState().addAsset({ id: "old-epf", name: "Old EPF", symbol: "EPF", ticker: "EPF", assetClass: "debt", currency: "INR", instrumentType: "other" });
    seedAccount(store, { legacyAssetId: "old-epf" });
    const screen = render(<EpfAccountScreen accountId="acme" now={now} onBack={jest.fn()} onComplete={jest.fn()} onUpdateBalance={jest.fn()} store={store} />);
    fireEvent.press(screen.getByTestId("epf-legacy-unlink"));
    expect(store.getState().epf.accounts[0].legacyAssetId).toBeUndefined();
    expect(screen.getByTestId("epf-legacy-choose")).toBeTruthy();
  });

  it("shows deletion impact, removes the account and its entries, and can be cancelled", () => {
    const { store } = setup();
    seedAccount(store);
    act(() => store.getState().applyEpfCommand({ commandId: "rec", reason: "Statement", change: { type: "eventPut", cash: null, event: {
      id: "rec", type: "reconciliation", accountId: "acme", effectiveDate: "2026-09-30", postedDate: "2026-09-30",
      recordedAt: now.toISOString(), evidence: "EPFO passbook", reason: "Statement", capital: null,
      balance: { total: 150000, components: { employee: 105000, employer: 45000 } } } } }, store.getState().getBackupRevision()));
    const onBack = jest.fn();
    const screen = render(<EpfAccountScreen accountId="acme" now={now} onBack={onBack} onComplete={jest.fn()} onUpdateBalance={jest.fn()} store={store} />);
    fireEvent.press(screen.getByTestId("delete-epf-account"));
    expect(screen.getByTestId("delete-epf-impact")).toHaveTextContent(/its 1 recorded entry/);
    fireEvent.press(screen.getByText("Keep account"));
    expect(store.getState().epf.accounts).toHaveLength(1);
    fireEvent.press(screen.getByTestId("delete-epf-account"));
    fireEvent.press(screen.getByTestId("confirm-delete-epf-account"));
    expect(store.getState().epf.accounts).toEqual([]);
    expect(store.getState().epf.events).toEqual([]);
    expect(onBack).toHaveBeenCalled();
  });

  it("blocks deletion while a transfer links another tracked account", () => {
    const { store } = setup();
    const base = { nickname: "EPF", provider: "epfo" as const, status: "active" as const, currency: "INR" as const,
      historyCompleteThrough: null, checkpoint: { date: "2026-01-01", balance: { total: 100000, components: null },
        capital: null, source: "epfoStatement" as const, recordedAt: "2026-01-02T00:00:00Z" } };
    const apply = (commandId: string, change: Parameters<ReturnType<typeof store.getState>["applyEpfCommand"]>[0]["change"]) =>
      act(() => store.getState().applyEpfCommand({ commandId, reason: "Setup", change }, store.getState().getBackupRevision()));
    apply("a", { type: "accountPut", account: { ...base, id: "a" } });
    apply("b", { type: "accountPut", account: { ...base, id: "b" } });
    apply("t", { type: "eventPut", cash: null, event: { id: "t", type: "transfer", sourceId: "a", destinationId: "b",
      amount: { total: 50000, components: null }, capital: null, status: "completed", effectiveDate: "2026-02-01",
      creditDate: "2026-02-03", postedDate: "2026-02-03", recordedAt: "2026-02-04T00:00:00Z", evidence: "Claim" } });
    const screen = render(<EpfAccountScreen accountId="a" now={now} onBack={jest.fn()} onComplete={jest.fn()} onUpdateBalance={jest.fn()} store={store} />);
    fireEvent.press(screen.getByTestId("delete-epf-account"));
    expect(screen.getByTestId("delete-epf-blocked")).toHaveTextContent(/1 transfer with another EPF account/);
    expect(screen.queryByTestId("confirm-delete-epf-account")).toBeNull();
    expect(store.getState().epf.accounts).toHaveLength(2);
  });
});

describe("Update EPF balance", () => {
  function updateSetup() {
    const { store } = setup();
    const account = { id: "acme", nickname: "Acme EPF", provider: "epfo" as const, status: "active" as const,
      currency: "INR" as const, historyCompleteThrough: null, checkpoint: { date: "2026-03-31",
        balance: { total: 140000, components: { employee: 100000, employer: 40000 } }, capital: null,
        source: "epfoStatement" as const, recordedAt: "2026-04-01T00:00:00Z" } };
    store.getState().applyEpfCommand({ commandId: "setup", reason: "Statement", change: { type: "accountPut", account } },
      store.getState().getBackupRevision());
    const onComplete = jest.fn();
    const screen = render(<EpfBalanceUpdateScreen accountId="acme" now={now} onBack={jest.fn()} onComplete={onComplete} store={store} />);
    return { store, screen, onComplete };
  }

  it("reviews prior, new and difference as a correction, not a deposit or return", () => {
    const { store, screen, onComplete } = updateSetup();
    expect(screen.getByTestId("epf-update-current")).toHaveTextContent("Currently ₹1,40,000.00, as of 31 Mar 2026.");
    fireEvent.changeText(screen.getByTestId("epf-update-employee-input"), "104000");
    fireEvent.changeText(screen.getByTestId("epf-update-employer-input"), "41567");
    fireEvent.press(screen.getByTestId("epf-update-history-complete"));
    fireEvent.press(screen.getByTestId("review-epf-update"));
    expect(screen.getByTestId("epf-update-previous")).toHaveTextContent("₹1,40,000.00");
    expect(screen.getByTestId("epf-update-new")).toHaveTextContent("₹1,45,567.00");
    expect(screen.getByTestId("epf-update-difference")).toHaveTextContent("+₹5,567.00");
    expect(screen.getByTestId("epf-update-explanation")).toHaveTextContent(/not counted as a contribution or as earned interest/);
    fireEvent.press(screen.getByTestId("save-epf-update"));
    expect(onComplete).toHaveBeenCalled();
    expect(store.getState().epf.events).toEqual([expect.objectContaining({ type: "reconciliation", effectiveDate: "2026-10-17",
      capital: null, balance: { total: 145567, components: { employee: 104000, employer: 41567 } } })]);
    expect(store.getState().epf.accounts[0].historyCompleteThrough).toBe("2026-10-17");
    const { result } = renderHook(() => useDashboard({ store, now }));
    expect(result.current.totalValue).toBe(145567);
    expect(result.current.monthlyMetrics.investment).toBe(0);
  });

  it("explains a date on or before the starting balance and keeps the entered values", () => {
    const { store, screen } = updateSetup();
    fireEvent.changeText(screen.getByTestId("epf-update-employee-input"), "1");
    fireEvent.changeText(screen.getByTestId("epf-update-employer-input"), "2");
    fireEvent.press(screen.getByTestId("epf-update-date"));
    fireEvent(screen.getByTestId("epf-update-date-picker"), "onChange", {
      nativeEvent: { timestamp: new Date("2026-03-31T12:00:00.000Z").getTime() }, type: "set",
    });
    fireEvent.press(screen.getByTestId("review-epf-update"));
    expect(screen.getByText(/Use a date after the starting balance \(31 Mar 2026\)/)).toBeTruthy();
    expect(screen.queryByTestId("epf-update-review-screen")).toBeNull();
    expect(store.getState().epf.events).toEqual([]);
    expect(screen.getByTestId("epf-update-employer-input")).toHaveProp("value", "2");
  });

  it("does not save when the review is abandoned", () => {
    const { store, screen } = updateSetup();
    fireEvent.changeText(screen.getByTestId("epf-update-employee-input"), "1");
    fireEvent.changeText(screen.getByTestId("epf-update-employer-input"), "1");
    fireEvent.press(screen.getByTestId("review-epf-update"));
    fireEvent.press(screen.getByText("Edit balance"));
    expect(screen.getByTestId("epf-update-employee-input")).toHaveProp("value", "1");
    expect(store.getState().epf.events).toEqual([]);
    expect(store.getState().epf.accounts[0].historyCompleteThrough).toBeNull();
  });
});

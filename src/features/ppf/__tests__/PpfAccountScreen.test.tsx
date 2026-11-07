import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { BackHandler, ScrollView, TextInput } from "react-native";

import { PpfAccountScreen } from "@/src/features/ppf";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

const backPress = { type: "hardwareBackPress", timeStamp: 0 };

const now = new Date("2026-08-15T10:00:00.000Z");

const account: PpfAccount = {
  balanceAsOf: "2026-07-31",
  confirmedBalance: 100_000,
  createdAt: "2026-08-01T10:00:00.000Z",
  id: "ppf-1",
  nickname: "Primary PPF",
  opening: { financialYearStart: 2020, kind: "financialYear" },
  provider: "India Post",
  status: "active",
};

describe("PpfAccountScreen", () => {
  it.each(["standard", "minimal"] as const)("prioritizes the balance before optional identifiers in %s mode", async (displayMode) => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ displayMode });
    const screen = await render(<PpfAccountScreen now={now} onBack={jest.fn()} onComplete={jest.fn()} onEntry={jest.fn()} store={store} />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf("ppf-provider-input")).toBeLessThan(tree.indexOf("ppf-balance-input"));
    expect(tree.indexOf("ppf-balance-date")).toBeLessThan(tree.indexOf("ppf-opening-mode"));
    expect(tree.indexOf("ppf-opening-mode")).toBeLessThan(tree.indexOf("ppf-suffix-input"));
    expect(screen.getByText("Balance confirmed on")).toBeTruthy();
    expect(screen.getByText("Account suffix (optional)")).toBeTruthy();
    expect(store.getState().ppfAccounts).toEqual([]);
  });

  it("retains optional identifiers and baseline contributions through review and save", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    const screen = await render(<PpfAccountScreen now={now} onBack={jest.fn()} onComplete={jest.fn()} onEntry={jest.fn()} store={store} />);
    await fireEvent.changeText(screen.getByTestId("ppf-provider-input"), "India Post");
    await fireEvent.changeText(screen.getByTestId("ppf-balance-input"), "250000");
    await fireEvent.changeText(screen.getByTestId("ppf-suffix-input"), "1234");
    await fireEvent.changeText(screen.getByTestId("ppf-fy-contribution-input"), "5000");
    await fireEvent.press(screen.getByTestId("review-ppf-account"));
    await fireEvent.press(screen.getByTestId("edit-ppf-account-details"));
    expect(screen.getByTestId("ppf-suffix-input")).toHaveProp("value", "1234");
    expect(screen.getByTestId("ppf-fy-contribution-input")).toHaveProp("value", "5000");
    await fireEvent.press(screen.getByTestId("review-ppf-account"));
    await fireEvent.press(screen.getByTestId("save-ppf-account"));
    expect(store.getState().ppfAccounts[0]).toMatchObject({
      accountNumberSuffix: "1234",
      confirmedBalance: 250000,
      balanceAsOf: "2026-08-15",
      baselineFinancialYearContributions: { amount: 5000, financialYearStart: 2026 },
    });
  });

  it("reveals the first invalid field inline without clearing entered values", async () => {
    const focus = jest.spyOn(TextInput.prototype, "focus");
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    const screen = await render(
      <PpfAccountScreen
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    await fireEvent.changeText(screen.getByTestId("ppf-suffix-input"), "123456");
    await fireEvent.changeText(screen.getByTestId("ppf-balance-input"), "250000");
    await fireEvent(screen.getByTestId("ppf-account-section"), "layout", {
      nativeEvent: { layout: { y: 400 } },
    });
    await fireEvent(screen.getByTestId("ppf-provider-field"), "layout", {
      nativeEvent: { layout: { y: 160 } },
    });
    await fireEvent.press(screen.getByTestId("review-ppf-account"));

    expect(screen.getByText("Bank or Post Office is required.")).toBeTruthy();
    expect(screen.getByText("Account suffix must contain the final 2 to 4 digits only.")).toBeTruthy();
    expect(screen.queryByText("Provider is required.")).toBeNull();
    expect(screen.getByTestId("ppf-suffix-input")).toHaveProp("value", "123456");
    expect(screen.getByTestId("ppf-balance-input")).toHaveProp("value", "250000");
    expect(store.getState().ppfAccounts).toEqual([]);
    await waitFor(() => expect(focus).toHaveBeenCalled());
    expect(scrollTo).toHaveBeenCalledWith({ animated: true, y: 544 });

    await fireEvent.changeText(screen.getByTestId("ppf-provider-input"), "India Post");
    expect(screen.queryByText("Bank or Post Office is required.")).toBeNull();
    expect(screen.getByTestId("ppf-suffix-input")).toHaveProp("value", "123456");
    expect(screen.getByTestId("ppf-balance-input")).toHaveProp("value", "250000");

    focus.mockRestore();
    scrollTo.mockRestore();
  });

  it("reveals an invalid suffix in its relocated optional section", async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    const screen = await render(<PpfAccountScreen now={now} onBack={jest.fn()} onComplete={jest.fn()} onEntry={jest.fn()} store={store} />);
    try {
      await fireEvent.changeText(screen.getByTestId("ppf-provider-input"), "India Post");
      await fireEvent.changeText(screen.getByTestId("ppf-balance-input"), "250000");
      await fireEvent.changeText(screen.getByTestId("ppf-suffix-input"), "123456");
      await fireEvent(screen.getByTestId("ppf-identification-section"), "layout", { nativeEvent: { layout: { y: 1200 } } });
      await fireEvent(screen.getByTestId("ppf-suffix-field"), "layout", { nativeEvent: { layout: { y: 60 } } });
      await fireEvent.press(screen.getByTestId("review-ppf-account"));
      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ animated: true, y: 1244 }));
      expect(screen.getByText("Account suffix must contain the final 2 to 4 digits only.")).toBeTruthy();
      expect(store.getState().ppfAccounts).toEqual([]);
    } finally {
      scrollTo.mockRestore();
    }
  });

  it("reviews and saves a dedicated PPF account without market fields", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    const onComplete = jest.fn();
    const { getByTestId, getByText, queryByText } = await render(
      <PpfAccountScreen
        now={now}
        onBack={jest.fn()}
        onComplete={onComplete}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    await fireEvent.changeText(getByTestId("ppf-provider-input"), "India Post");
    await fireEvent.changeText(getByTestId("ppf-balance-input"), "100000");
    await fireEvent.press(getByTestId("review-ppf-account"));

    expect(getByText("Review PPF account")).toBeTruthy();
    expect(getByText("CogVest starts tracking from this balance. It does not rebuild earlier contributions or interest.")).toBeTruthy();
    expect(queryByText("Quantity")).toBeNull();
    expect(queryByText("Current price")).toBeNull();

    await fireEvent.press(getByTestId("save-ppf-account"));
    expect(store.getState().ppfAccounts).toHaveLength(1);
    expect(onComplete).toHaveBeenCalledWith(store.getState().ppfAccounts[0].id);
    expect(getByTestId("ppf-account-screen")).toBeTruthy();
    expect(getByText("My PPF")).toBeTruthy();
  });

  it("returns from account review to populated fields and protects dirty exit", async () => {
    let hardwareBack: (() => boolean) | undefined;
    const backSpy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      hardwareBack = () => handler(backPress) === true;
      return { remove: jest.fn() };
    });
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    const onBack = jest.fn();
    const screen = await render(<PpfAccountScreen now={now} onBack={onBack} onComplete={jest.fn()} onEntry={jest.fn()} store={store} />);

    await fireEvent.changeText(screen.getByTestId("ppf-provider-input"), "India Post");
    await fireEvent.changeText(screen.getByTestId("ppf-balance-input"), "100000");
    await fireEvent.press(screen.getByTestId("review-ppf-account"));
    await act(() => { hardwareBack?.(); });
    expect(screen.getByTestId("ppf-balance-input")).toHaveProp("value", "100000");
    expect(onBack).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText("Back"));
    expect(screen.getByText("Discard account changes?")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("keep-editing-ppf-account"));
    expect(screen.getByTestId("ppf-provider-input")).toHaveProp("value", "India Post");
    backSpy.mockRestore();
  });

  it("separates confirmed balance, official interest, and estimated interest", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    const interest: PpfLedgerEntry = {
      accountId: account.id,
      amount: 7_100,
      date: "2026-08-01",
      financialYearStart: 2026,
      id: "interest",
      recordedAt: "2026-08-01T10:00:00.000Z",
      type: "interestCredit",
    };
    store.getState().addPpfAccount(account);
    store.getState().addPpfLedgerEntry(interest);

    const { getByTestId, getByText } = await render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    expect(getByTestId("ppf-confirmed-balance-card")).toBeTruthy();
    expect(getByText("Officially credited")).toBeTruthy();
    expect(getByText("Estimated, not credited")).toBeTruthy();
    expect(
      getByText(
        "Your starting balance may include historic interest. CogVest cannot infer a lifetime gain percentage from it.",
      ),
    ).toBeTruthy();
    expect(getByText("₹1,07,100.00")).toBeTruthy();
    expect(
      getByText("Ledger applied through 01 Aug 2026 • official records remain authoritative"),
    ).toBeTruthy();
  });

  it("places ledger actions before secondary interest and timeline content", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    const onEntry = jest.fn();
    const onImport = jest.fn();
    store.getState().addPpfAccount(account);

    const screen = await render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={onEntry}
        onImport={onImport}
        store={store}
      />,
    );
    const tree = JSON.stringify(screen.toJSON());

    expect(tree.indexOf("ppf-ledger-actions")).toBeLessThan(
      tree.indexOf("ppf-interest-card"),
    );
    await fireEvent.press(screen.getByTestId("add-ppf-entry"));
    await fireEvent.press(screen.getByTestId("ppf-import-csv"));
    expect(onEntry).toHaveBeenCalledWith(account.id);
    expect(onImport).toHaveBeenCalledWith(account.id);
  });

  it("does not imply that same-day baseline interest was estimated", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount({ ...account, balanceAsOf: "2026-08-15" });

    const { getByText, queryByText } = await render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    expect(getByText("No completed estimate period yet")).toBeTruthy();
    expect(getByText("Not available yet")).toBeTruthy();
    expect(queryByText("Through 15 Aug 2026")).toBeNull();
  });

  it("keeps unavailable estimated interest readable while masking wealth", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ maskWealthValues: true });
    store.getState().addPpfAccount({ ...account, balanceAsOf: "2026-08-15" });

    const { getByText, queryByText } = await render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    expect(getByText("Not available yet")).toBeTruthy();
    expect(queryByText("₹1,00,000.00")).toBeNull();
  });

  it("requires reveal before editing a saved PPF baseline", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    await act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    const screen = await render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    await fireEvent.press(screen.getByTestId("edit-ppf-account"));
    expect(screen.getByText("Reveal to review")).toBeTruthy();
    expect(screen.queryByTestId("ppf-balance-input")).toBeNull();
    await fireEvent.press(screen.getByTestId("reveal-ppf-account-button"));
    expect(screen.getByTestId("ppf-balance-input")).toHaveProp("value", "100000");

    await act(() => store.getState().updatePreferences({ maskWealthValues: false }));
    await act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    await waitFor(() => {
      expect(screen.getByText("Reveal to review")).toBeTruthy();
      expect(screen.queryByTestId("ppf-balance-input")).toBeNull();
    });
  });

  it("renders same-day ledger entries in the deterministic replay order", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    store.getState().addPpfLedgerEntry({
      accountId: account.id,
      amount: 500,
      date: "2026-08-01",
      id: "contribution",
      recordedAt: "2026-08-01T10:00:00.000Z",
      type: "contribution",
    });
    store.getState().addPpfLedgerEntry({
      accountId: account.id,
      amount: 200,
      date: "2026-08-01",
      id: "withdrawal",
      recordedAt: "2026-08-01T11:00:00.000Z",
      type: "withdrawal",
    });

    const { getAllByText } = await render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    expect(
      getAllByText(/^(Contribution|Withdrawal)$/).map((node) => node.props.children),
    ).toEqual(["Withdrawal", "Contribution"]);
  });

  it("clears hidden extension metadata when changing account status", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount({
      ...account,
      confirmedExtensionStartFinancialYear: 2036,
      status: "extendedWithContributions",
    });
    const { getByTestId, getByText } = await render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    await fireEvent.press(getByTestId("edit-ppf-account"));
    await fireEvent.press(getByTestId("ppf-status-picker"));
    await fireEvent.press(getByTestId("ppf-status-active"));
    await fireEvent.press(getByTestId("review-ppf-account"));

    expect(getByText("Review PPF account")).toBeTruthy();
    await fireEvent.press(getByTestId("save-ppf-account"));
    expect(store.getState().ppfAccounts[0]).toMatchObject({ status: "active" });
    expect(
      store.getState().ppfAccounts[0]?.confirmedExtensionStartFinancialYear,
    ).toBeUndefined();
    expect(getByTestId("ppf-account-screen")).toBeTruthy();
  });

  it("returns to saved details after editing instead of retaining stale form state", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    const { getByTestId, getByText } = await render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    await fireEvent.press(getByTestId("edit-ppf-account"));
    await fireEvent.changeText(getByTestId("ppf-nickname-input"), "Updated PPF");
    await fireEvent.press(getByTestId("review-ppf-account"));
    await fireEvent.press(getByTestId("save-ppf-account"));

    expect(store.getState().ppfAccounts[0]).toMatchObject({ nickname: "Updated PPF" });
    expect(getByTestId("ppf-account-screen")).toBeTruthy();
    expect(getByText("Updated PPF")).toBeTruthy();
  });

  it("offers an explicit return to portfolio setup after saving", async () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    const onContinuePortfolioSetup = jest.fn();
    store.getState().addPpfAccount(account);
    const { getByTestId } = await render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onContinuePortfolioSetup={onContinuePortfolioSetup}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    await fireEvent.press(getByTestId("continue-portfolio-setup"));
    expect(onContinuePortfolioSetup).toHaveBeenCalledTimes(1);
  });
});

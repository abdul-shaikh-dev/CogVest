import { fireEvent, render } from "@testing-library/react-native";

import { PpfAccountScreen } from "@/src/features/ppf";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

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
  it("reviews and saves a dedicated PPF account without market fields", () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    const onComplete = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <PpfAccountScreen
        now={now}
        onBack={jest.fn()}
        onComplete={onComplete}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    fireEvent.changeText(getByTestId("ppf-provider-input"), "India Post");
    fireEvent.changeText(getByTestId("ppf-balance-input"), "100000");
    fireEvent.press(getByTestId("review-ppf-account"));

    expect(getByText("Review PPF account")).toBeTruthy();
    expect(getByText("This balance becomes CogVest's confirmed baseline. Earlier contributions and interest are not reconstructed.")).toBeTruthy();
    expect(queryByText("Quantity")).toBeNull();
    expect(queryByText("Current price")).toBeNull();

    fireEvent.press(getByTestId("save-ppf-account"));
    expect(store.getState().ppfAccounts).toHaveLength(1);
    expect(onComplete).toHaveBeenCalledWith(store.getState().ppfAccounts[0].id);
  });

  it("separates confirmed balance, official interest, and estimated interest", () => {
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

    const { getByTestId, getByText } = render(
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
    expect(getByText("₹1,07,100.00")).toBeTruthy();
    expect(
      getByText("Ledger applied through 01 Aug 2026 • official records remain authoritative"),
    ).toBeTruthy();
  });

  it("does not imply that same-day baseline interest was estimated", () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount({ ...account, balanceAsOf: "2026-08-15" });

    const { getByText, queryByText } = render(
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

  it("keeps unavailable estimated interest readable while masking wealth", () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().updatePreferences({ maskWealthValues: true });
    store.getState().addPpfAccount({ ...account, balanceAsOf: "2026-08-15" });

    const { getByText } = render(
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
  });

  it("renders same-day ledger entries in the deterministic replay order", () => {
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

    const { getAllByText } = render(
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

  it("clears hidden extension metadata when changing account status", () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount({
      ...account,
      confirmedExtensionStartFinancialYear: 2036,
      status: "extendedWithContributions",
    });
    const { getByTestId, getByText } = render(
      <PpfAccountScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        onEntry={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("edit-ppf-account"));
    fireEvent.press(getByTestId("ppf-status-picker"));
    fireEvent.press(getByTestId("ppf-status-active"));
    fireEvent.press(getByTestId("review-ppf-account"));

    expect(getByText("Review PPF account")).toBeTruthy();
    fireEvent.press(getByTestId("save-ppf-account"));
    expect(store.getState().ppfAccounts[0]).toMatchObject({ status: "active" });
    expect(
      store.getState().ppfAccounts[0]?.confirmedExtensionStartFinancialYear,
    ).toBeUndefined();
  });
});

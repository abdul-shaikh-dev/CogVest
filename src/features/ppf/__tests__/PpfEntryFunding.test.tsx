import { fireEvent, render } from "@testing-library/react-native";

import { PpfEntryScreen } from "@/src/features/ppf";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { PpfAccount } from "@/src/types";

const now = new Date("2026-08-15T10:00:00.000Z");
const account: PpfAccount = {
  balanceAsOf: "2026-07-31", confirmedBalance: 100_000, createdAt: "2026-08-01T10:00:00.000Z", id: "ppf-1",
  nickname: "Primary PPF", opening: { financialYearStart: 2020, kind: "financialYear" }, provider: "India Post", status: "active",
};

function setup(cash: number) {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  store.getState().addPpfAccount(account);
  store.getState().addCashEntry({ id: "dep", amount: cash, date: "2026-08-01", label: "Deposit", purpose: "capitalContribution", type: "addition" });
  const onComplete = jest.fn();
  const screen = render(<PpfEntryScreen accountId={account.id} now={now} onBack={jest.fn()} onComplete={onComplete} store={store} />);
  fireEvent.changeText(screen.getByTestId("ppf-entry-amount"), "5000");
  fireEvent.press(screen.getByTestId("ppf-entry-funding-picker"));
  fireEvent.press(screen.getByTestId("ppf-entry-funding-cash"));
  fireEvent.press(screen.getByTestId("review-ppf-entry"));
  return { onComplete, screen, store };
}

describe("PPF entry funding source (D11)", () => {
  it("records a deposit from Cash with its Cash withdrawal", () => {
    const { onComplete, screen, store } = setup(10_000);
    expect(screen.getByText("From Cash")).toBeTruthy();
    fireEvent.press(screen.getByTestId("save-ppf-entry"));
    expect(onComplete).toHaveBeenCalled();
    expect(store.getState().ppfLedgerEntries[0]).toMatchObject({ amount: 5000, fundingSource: "cash" });
    expect(store.getState().cashEntries.find((entry) => entry.linkedPpf)).toMatchObject({ amount: 5000, type: "withdrawal", purpose: "ppfTransfer" });
  });

  it("explains when Cash can't cover the deposit, and saves nothing", () => {
    const { onComplete, screen, store } = setup(1000);
    fireEvent.press(screen.getByTestId("save-ppf-entry"));
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText("Cash doesn't cover this deposit on that date. Record the Cash deposit first, or choose From outside CogVest.")).toBeTruthy();
    expect(store.getState().ppfLedgerEntries).toEqual([]);
  });
});

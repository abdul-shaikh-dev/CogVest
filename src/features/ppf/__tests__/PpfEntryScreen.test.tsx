import { fireEvent, render } from "@testing-library/react-native";

import { PpfEntryScreen } from "@/src/features/ppf";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { PpfAccount } from "@/src/types";

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

describe("PpfEntryScreen", () => {
  it("reviews and saves a valid contribution", () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    const onComplete = jest.fn();
    const { getByTestId, getByText } = render(
      <PpfEntryScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={onComplete}
        store={store}
      />,
    );

    fireEvent.changeText(getByTestId("ppf-entry-amount"), "500");
    fireEvent.press(getByTestId("review-ppf-entry"));
    expect(getByText("Review PPF entry")).toBeTruthy();
    fireEvent.press(getByTestId("save-ppf-entry"));

    expect(store.getState().ppfLedgerEntries).toEqual([
      expect.objectContaining({ amount: 500, type: "contribution" }),
    ]);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("requires a reason before reviewing a balance correction", () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    const { getByTestId, getByText } = render(
      <PpfEntryScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    fireEvent.press(getByTestId("ppf-entry-type-picker"));
    fireEvent.press(getByTestId("ppf-entry-type-reconciliation"));
    fireEvent.changeText(getByTestId("ppf-entry-amount"), "99000");
    fireEvent.press(getByTestId("review-ppf-entry"));

    expect(getByText("Reconciliation reason is required.")).toBeTruthy();
  });
});

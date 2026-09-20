import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { BackHandler, TextInput } from "react-native";

import { PpfEntryScreen } from "@/src/features/ppf";
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

describe("PpfEntryScreen", () => {
  it("keeps a new blank entry usable while masking is enabled", () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    store.getState().updatePreferences({ maskWealthValues: true });
    const screen = render(
      <PpfEntryScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    expect(screen.getByTestId("ppf-entry-amount")).toBeTruthy();
    expect(screen.queryByTestId("reveal-ppf-entry")).toBeNull();
  });

  it("requires reveal for an existing entry and resets when masking returns", async () => {
    const entry: PpfLedgerEntry = {
      accountId: account.id,
      amount: 500,
      date: "2026-08-01",
      id: "ppf-entry-1",
      recordedAt: "2026-08-01T10:00:00.000Z",
      type: "contribution",
    };
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    store.getState().addPpfLedgerEntry(entry);
    store.getState().updatePreferences({ maskWealthValues: true });
    const screen = render(
      <PpfEntryScreen
        accountId={account.id}
        entryId={entry.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    expect(screen.getByText("Reveal to review")).toBeTruthy();
    expect(screen.queryByTestId("ppf-entry-amount")).toBeNull();
    fireEvent.press(screen.getByTestId("reveal-ppf-entry-button"));
    expect(screen.getByTestId("ppf-entry-amount")).toHaveProp("value", "500");

    act(() => store.getState().updatePreferences({ maskWealthValues: false }));
    act(() => store.getState().updatePreferences({ maskWealthValues: true }));
    await waitFor(() => {
      expect(screen.getByText("Reveal to review")).toBeTruthy();
      expect(screen.queryByTestId("ppf-entry-amount")).toBeNull();
    });
  });

  it("keeps optional notes and contribution guidance behind retained disclosures", () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    const screen = render(
      <PpfEntryScreen
        accountId={account.id}
        now={now}
        onBack={jest.fn()}
        onComplete={jest.fn()}
        store={store}
      />,
    );

    expect(screen.queryByTestId("ppf-entry-notes")).toBeNull();
    expect(screen.queryByTestId("ppf-contribution-rules-details")).toBeNull();
    fireEvent.press(screen.getByTestId("ppf-entry-note-toggle"));
    fireEvent.changeText(screen.getByTestId("ppf-entry-notes"), "Passbook note");
    fireEvent.press(screen.getByTestId("ppf-entry-note-toggle"));
    expect(screen.queryByTestId("ppf-entry-notes")).toBeNull();
    fireEvent.press(screen.getByTestId("ppf-entry-note-toggle"));
    expect(screen.getByTestId("ppf-entry-notes")).toHaveProp(
      "value",
      "Passbook note",
    );

    fireEvent.press(screen.getByTestId("ppf-contribution-rules-toggle"));
    expect(screen.getByTestId("ppf-contribution-rules-details")).toBeTruthy();
  });

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

  it("returns from review to the populated editor through visible and system Back", () => {
    let hardwareBack: (() => boolean) | undefined;
    const backSpy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_event, handler) => {
      hardwareBack = () => handler() === true;
      return { remove: jest.fn() };
    });
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    const onBack = jest.fn();
    const screen = render(<PpfEntryScreen accountId={account.id} now={now} onBack={onBack} onComplete={jest.fn()} store={store} />);

    fireEvent.changeText(screen.getByTestId("ppf-entry-amount"), "500");
    fireEvent.press(screen.getByTestId("review-ppf-entry"));
    fireEvent.press(screen.getByLabelText("Back to entry editor"));
    expect(screen.getByTestId("ppf-entry-amount")).toHaveProp("value", "500");
    expect(onBack).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("review-ppf-entry"));
    act(() => { hardwareBack?.(); });
    expect(screen.getByTestId("ppf-entry-amount")).toHaveProp("value", "500");
    expect(onBack).not.toHaveBeenCalled();
    backSpy.mockRestore();
  });

  it("requires a deliberate choice before leaving a dirty entry", () => {
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    const onBack = jest.fn();
    const screen = render(<PpfEntryScreen accountId={account.id} now={now} onBack={onBack} onComplete={jest.fn()} store={store} />);

    fireEvent.changeText(screen.getByTestId("ppf-entry-amount"), "750");
    fireEvent.press(screen.getByLabelText("Back to PPF account"));
    expect(screen.getByText("Discard entry changes?")).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId("keep-editing-ppf-entry"));
    expect(screen.getByTestId("ppf-entry-amount")).toHaveProp("value", "750");
  });

  it("places amount, date, and reason errors at their owning fields", async () => {
    const focus = jest.spyOn(TextInput.prototype, "focus");
    const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
    store.getState().addPpfAccount(account);
    const screen = render(<PpfEntryScreen accountId={account.id} now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);

    fireEvent.press(screen.getByTestId("review-ppf-entry"));
    expect(screen.getByText("Entry amount must be greater than zero.")).toBeTruthy();
    await waitFor(() => expect(focus).toHaveBeenCalled());

    fireEvent.changeText(screen.getByTestId("ppf-entry-amount"), "500");
    fireEvent.press(screen.getByTestId("ppf-entry-date"));
    fireEvent(screen.getByTestId("ppf-entry-date-picker"), "onChange", {
      nativeEvent: { timestamp: new Date("2026-08-20T12:00:00.000Z").getTime() },
      type: "set",
    });
    fireEvent.press(screen.getByTestId("review-ppf-entry"));
    expect(screen.getByText("Entry date must be a valid non-future date.")).toBeTruthy();

    fireEvent.press(screen.getByTestId("ppf-entry-type-picker"));
    fireEvent.press(screen.getByTestId("ppf-entry-type-reconciliation"));
    fireEvent.press(screen.getByTestId("review-ppf-entry"));
    expect(screen.getByText("Reconciliation reason is required.")).toBeTruthy();
    focus.mockRestore();
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

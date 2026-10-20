import { act, fireEvent, render } from "@testing-library/react-native";

import { EpfAccountScreen, EpfEntryScreen } from "@/src/features/epf";
import { calculateEpfLedger, type EpfAccount } from "@/src/domain/epf";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

const now = new Date("2026-10-17T10:00:00.000Z");
const account = (id: string, nickname: string, total: number, employee = total, employer = 0): EpfAccount => ({
  id, nickname, provider: "epfo", status: "active", currency: "INR", historyCompleteThrough: null,
  checkpoint: { date: "2026-03-31", balance: { total, components: { employee, employer } }, capital: null,
    source: "epfoStatement", recordedAt: "2026-04-01T00:00:00Z" },
});

function setup(accounts = [account("acme", "Acme", 140000, 100000, 40000)]) {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  for (const item of accounts) {
    store.getState().applyEpfCommand({ commandId: `seed-${item.id}`, reason: "Statement", change: { type: "accountPut", account: item } },
      store.getState().getBackupRevision());
  }
  return store;
}

function total(store: ReturnType<typeof setup>) {
  const { accounts, events } = store.getState().epf;
  const result = calculateEpfLedger({ accounts, events }, "2026-10-17", "2026-10-17");
  if (!result.ok) throw new Error(result.errors.join());
  return result;
}

function enter(store: ReturnType<typeof setup>, steps: (screen: ReturnType<typeof render>) => void, accountId = "acme") {
  const onComplete = jest.fn();
  const screen = render(<EpfEntryScreen accountId={accountId} now={now} onBack={jest.fn()} onComplete={onComplete} store={store} />);
  steps(screen);
  return { screen, onComplete };
}

function choose(screen: ReturnType<typeof render>, prefix: string, value: string) {
  fireEvent.press(screen.getByTestId(`${prefix}-picker`));
  fireEvent.press(screen.getByTestId(`${prefix}-${value}`));
}

function setDate(screen: ReturnType<typeof render>, testID: string, date: string) {
  fireEvent.press(screen.getByTestId(testID));
  fireEvent(screen.getByTestId(`${testID}-picker`), "onChange", {
    nativeEvent: { timestamp: new Date(`${date}T12:00:00.000Z`).getTime() }, type: "set",
  });
}

test("contributions and official interest reach 142,567 with capital and return kept separate", () => {
  const store = setup();
  enter(store, (screen) => {
    fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "1200");
    fireEvent.press(screen.getByTestId("epf-entry-voluntary"));
    setDate(screen, "epf-entry-date", "2026-05-05");
    fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-effect-acme")).toHaveTextContent("₹1,40,000.00 → ₹1,41,200.00");
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent(/money put in, not as a return.*Cash is unchanged/);
    fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  enter(store, (screen) => {
    choose(screen, "epf-entry-kind", "employerContribution");
    fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "367");
    setDate(screen, "epf-entry-date", "2026-05-05");
    fireEvent.press(screen.getByTestId("review-epf-entry"));
    fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  enter(store, (screen) => {
    choose(screen, "epf-entry-kind", "interest");
    fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "1000");
    setDate(screen, "epf-entry-date", "2026-05-31");
    setDate(screen, "epf-entry-posted-date", "2026-07-15");
    fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent("Counted as return earned, not as money put in.");
    expect(screen.getByTestId("epf-entry-effect-total")).toHaveTextContent("₹1,41,567.00 → ₹1,42,567.00");
    fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  expect(total(store).total).toBe(142567);
  expect(store.getState().epf.events.map((event) => event.type)).toEqual(["contribution", "contribution", "interest"]);
  expect(store.getState().epf.events[0]).toMatchObject({ party: "employee", voluntary: true });
  expect(store.getState().epf.events[2]).toMatchObject({ effectiveDate: "2026-05-31", postedDate: "2026-07-15" });
  expect(store.getState().cashEntries).toEqual([]);
});

test("a withdrawal into tracked Cash saves both records together and deleting it removes both", () => {
  const store = setup();
  enter(store, (screen) => {
    choose(screen, "epf-entry-kind", "withdrawal");
    fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "5000");
    choose(screen, "epf-entry-destination", "cash");
    setDate(screen, "epf-entry-date", "2026-06-01");
    fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent("Your tracked Cash increases by ₹5,000.00. Both records are saved together.");
    fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  const [withdrawal] = store.getState().epf.events;
  const link = store.getState().epf.cashLinks[0];
  expect(link.eventId).toBe(withdrawal.id);
  expect(store.getState().cashEntries.find((entry) => entry.id === link.cashEntryId)).toMatchObject({
    amount: 5000, type: "addition", purpose: "epfTransfer", date: "2026-06-01" });
  expect(total(store).total).toBe(135000);

  const screen = render(<EpfEntryScreen accountId="acme" entryId={withdrawal.id} now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);
  fireEvent.press(screen.getByTestId("delete-epf-entry"));
  expect(screen.getByTestId("delete-epf-entry-impact")).toHaveTextContent(/linked Cash entry is removed too/);
  fireEvent.press(screen.getByTestId("confirm-delete-epf-entry"));
  expect(store.getState().epf.events).toEqual([]);
  expect(store.getState().cashEntries.some((entry) => entry.id === link.cashEntryId)).toBe(false);
});

test("a final settlement records the interest paid with the claim, empties the account and shows it as settled", () => {
  const store = setup();
  enter(store, (screen) => {
    choose(screen, "epf-entry-kind", "withdrawal");
    fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "144000");
    fireEvent.changeText(screen.getByTestId("epf-entry-employee-input"), "103000");
    fireEvent.changeText(screen.getByTestId("epf-entry-employer-input"), "41000");
    fireEvent.press(screen.getByTestId("epf-entry-settlement"));
    expect(screen.getByText("Settled on")).toBeTruthy();
    fireEvent.changeText(screen.getByTestId("epf-entry-settlement-interest-input"), "4000");
    fireEvent.changeText(screen.getByTestId("epf-entry-settlement-interest-employee-input"), "3000");
    fireEvent.changeText(screen.getByTestId("epf-entry-settlement-interest-employer-input"), "1000");
    setDate(screen, "epf-entry-date", "2026-06-01");
    fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-effect-acme")).toHaveTextContent("₹1,40,000.00 → ₹0.00");
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent("Pays out the whole balance, including ₹4,000.00 interest " +
      "credited with the claim. The interest counts as return, and the account ends at ₹0.");
    fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  expect(total(store)).toMatchObject({ total: 0, capital: 0 });
  expect(store.getState().epf.events[0]).toMatchObject({ settlement: { interest: { total: 4000 } } });

  const detail = render(<EpfAccountScreen accountId="acme" now={now} onBack={jest.fn()} onComplete={jest.fn()}
    onUpdateBalance={jest.fn()} store={store} />);
  expect(detail.getByText("EPFO · Settled on 01 Jun 2026")).toBeTruthy();
  expect(detail.getByTestId("epf-capital")).toHaveTextContent("₹0.00");
  expect(detail.getByTestId("epf-account-evidence")).toHaveTextContent("Paid out in full on 01 Jun 2026");
  expect(detail.getByText("Nothing remains invested after the final settlement.")).toBeTruthy();
  expect(detail.queryByTestId("update-epf-balance")).toBeNull();
});

test("a 50,000 transfer keeps combined EPF unchanged in transit, completes from either side, and never duplicates", () => {
  const store = setup([account("acme", "Acme", 140000, 100000, 40000), account("beta", "Beta", 0)]);
  enter(store, (screen) => {
    choose(screen, "epf-entry-kind", "transferOut");
    fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "50000");
    choose(screen, "epf-entry-target", "beta");
    choose(screen, "epf-entry-transfer-status", "inTransit");
    setDate(screen, "epf-entry-date", "2026-06-01");
    fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-effect-acme")).toHaveTextContent("₹1,40,000.00 → ₹90,000.00");
    expect(screen.getByTestId("epf-entry-effect-total")).toHaveTextContent("₹1,40,000.00 → ₹1,40,000.00");
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent(/₹50,000.00 is counted once as moving/);
    fireEvent.press(screen.getByTestId("save-epf-entry"));
    fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  expect(store.getState().epf.events).toHaveLength(1);
  expect(total(store)).toMatchObject({ total: 140000, inTransit: 50000 });
  const [transfer] = store.getState().epf.events;

  // Opened from the receiving account, the transfer is still edited as Acme → Beta.
  const screen = render(<EpfEntryScreen accountId="beta" entryId={transfer.id} now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);
  choose(screen, "epf-entry-transfer-status", "completed");
  setDate(screen, "epf-entry-credit-date", "2026-06-10");
  fireEvent.press(screen.getByTestId("review-epf-entry"));
  expect(screen.getByTestId("epf-entry-effect-beta")).toHaveTextContent("₹0.00 → ₹50,000.00");
  fireEvent.press(screen.getByTestId("save-epf-entry"));
  expect(store.getState().epf.events).toEqual([expect.objectContaining({ id: transfer.id, sourceId: "acme", destinationId: "beta",
    status: "completed", creditDate: "2026-06-10" })]);
  const result = total(store);
  expect(result).toMatchObject({ total: 140000, inTransit: 0 });
  expect(result.ok && result.accounts.map((item) => item.balance.total)).toEqual([90000, 50000]);
});

test("asks for the receiving account first when no other account is tracked", () => {
  const store = setup();
  enter(store, (screen) => {
    choose(screen, "epf-entry-kind", "transferOut");
    expect(screen.getByTestId("epf-entry-no-target")).toHaveTextContent(/Add the receiving EPF account first/);
  });
});

test("records a provider reversal from the entry, keeping the original in history", () => {
  const store = setup();
  enter(store, (screen) => {
    choose(screen, "epf-entry-kind", "employerContribution");
    fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "367");
    setDate(screen, "epf-entry-date", "2026-05-05");
    fireEvent.press(screen.getByTestId("review-epf-entry"));
    fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  const [contribution] = store.getState().epf.events;
  const onComplete = jest.fn();
  const screen = render(<EpfEntryScreen accountId="acme" entryId={contribution.id} now={now} onBack={jest.fn()} onComplete={onComplete} store={store} />);
  fireEvent.press(screen.getByTestId("reverse-epf-entry"));
  fireEvent.press(screen.getByTestId("save-epf-reversal"));
  expect(screen.getByText("Say why the provider reversed it.")).toBeTruthy();
  fireEvent.changeText(screen.getByTestId("epf-reversal-reason-input"), "Employer correction");
  fireEvent.press(screen.getByTestId("save-epf-reversal"));
  expect(onComplete).toHaveBeenCalled();
  expect(store.getState().epf.events).toEqual([contribution, expect.objectContaining({ type: "reversal", reversesId: contribution.id, reason: "Employer correction" })]);
  expect(total(store).total).toBe(140000);
});

test("invalid input keeps the draft, cancelling saves nothing, and balance updates are read-only here", () => {
  const store = setup();
  const before = JSON.stringify(store.getState().epf);
  const { screen } = enter(store, (view) => {
    fireEvent.changeText(view.getByTestId("epf-entry-amount-input"), "12.345");
    setDate(view, "epf-entry-date", "2026-03-31");
    fireEvent.press(view.getByTestId("review-epf-entry"));
  });
  expect(screen.getByText(/amount from your statement/)).toBeTruthy();
  expect(screen.getByText(/already includes earlier activity/)).toBeTruthy();
  expect(screen.getByTestId("epf-entry-amount-input")).toHaveProp("value", "12.345");
  expect(JSON.stringify(store.getState().epf)).toBe(before);

  act(() => store.getState().applyEpfCommand({ commandId: "rec", reason: "Statement", change: { type: "eventPut", cash: null, event: {
    id: "rec", type: "reconciliation", accountId: "acme", effectiveDate: "2026-09-30", postedDate: "2026-09-30",
    recordedAt: now.toISOString(), evidence: "EPFO passbook", reason: "Annual statement", capital: null,
    balance: { total: 150000, components: null } } } }, store.getState().getBackupRevision()));
  const view = render(<EpfEntryScreen accountId="acme" entryId="rec" now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);
  expect(view.getByTestId("epf-entry-summary")).toHaveTextContent(/Annual statement/);
  expect(view.queryByTestId("epf-entry-amount-input")).toBeNull();
  expect(view.queryByTestId("reverse-epf-entry")).toBeNull();
  expect(view.getByTestId("delete-epf-entry")).toBeTruthy();
});

test("masks values until revealed, and the account activity lists signed entries that open the entry", () => {
  const store = setup();
  enter(store, (screen) => {
    fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "1200");
    setDate(screen, "epf-entry-date", "2026-05-05");
    fireEvent.press(screen.getByTestId("review-epf-entry"));
    fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  const [event] = store.getState().epf.events;
  const onOpenEntry = jest.fn();
  const detail = render(<EpfAccountScreen accountId="acme" now={now} onBack={jest.fn()} onComplete={jest.fn()}
    onOpenEntry={onOpenEntry} onUpdateBalance={jest.fn()} store={store} />);
  fireEvent.press(detail.getByTestId("epf-activity-toggle"));
  expect(detail.getByTestId(`epf-event-${event.id}`)).toHaveTextContent(/Employee contribution.*\+₹1,200.00/);
  fireEvent.press(detail.getByTestId(`epf-event-${event.id}`));
  expect(onOpenEntry).toHaveBeenCalledWith("acme", event.id);
  fireEvent.press(detail.getByTestId("add-epf-entry"));
  expect(onOpenEntry).toHaveBeenLastCalledWith("acme", undefined);
  detail.unmount();

  act(() => store.getState().updatePreferences({ maskWealthValues: true }));
  const masked = render(<EpfEntryScreen accountId="acme" now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);
  expect(masked.getByTestId("reveal-epf-entry")).toBeTruthy();
  expect(masked.queryByTestId("epf-entry-amount-input")).toBeNull();
});

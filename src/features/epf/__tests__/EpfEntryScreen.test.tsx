import { act, fireEvent, render } from "@testing-library/react-native";

import { EpfAccountScreen, EpfEntryScreen } from "@/src/features/epf";
import { calculateEpfLedger, type EpfAccount } from "@/src/domain/epf";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

type RenderedScreen = Awaited<ReturnType<typeof render>>;

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

async function enter(store: ReturnType<typeof setup>, steps: (screen: RenderedScreen) => void | Promise<void>, accountId = "acme") {
  const onComplete = jest.fn();
  const screen = await render(<EpfEntryScreen accountId={accountId} now={now} onBack={jest.fn()} onComplete={onComplete} store={store} />);
  await steps(screen);
  return { screen, onComplete };
}

async function choose(screen: Awaited<ReturnType<typeof render>>, prefix: string, value: string) {
  await fireEvent.press(screen.getByTestId(`${prefix}-picker`));
  await fireEvent.press(screen.getByTestId(`${prefix}-${value}`));
}

async function setDate(screen: Awaited<ReturnType<typeof render>>, testID: string, date: string) {
  await fireEvent.press(screen.getByTestId(testID));
  await fireEvent(screen.getByTestId(`${testID}-picker`), "onChange", {
    nativeEvent: { timestamp: new Date(`${date}T12:00:00.000Z`).getTime() }, type: "set",
  });
}

test("contributions and official interest reach 142,567 with capital and return kept separate", async () => {
  const store = setup();
  await enter(store, async (screen) => {
    await fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "1200");
    await fireEvent.press(screen.getByTestId("epf-entry-voluntary"));
    await setDate(screen, "epf-entry-date", "2026-05-05");
    await fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-effect-acme")).toHaveTextContent("₹1,40,000.00 → ₹1,41,200.00");
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent(/money put in, not as a return.*Cash is unchanged/);
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  await enter(store, async (screen) => {
    await choose(screen, "epf-entry-kind", "employerContribution");
    await fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "367");
    await setDate(screen, "epf-entry-date", "2026-05-05");
    await fireEvent.press(screen.getByTestId("review-epf-entry"));
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  await enter(store, async (screen) => {
    await choose(screen, "epf-entry-kind", "interest");
    await fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "1000");
    await setDate(screen, "epf-entry-date", "2026-05-31");
    await setDate(screen, "epf-entry-posted-date", "2026-07-15");
    await fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent("Counted as return earned, not as money put in.");
    expect(screen.getByTestId("epf-entry-effect-total")).toHaveTextContent("₹1,41,567.00 → ₹1,42,567.00");
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  expect(total(store).total).toBe(142567);
  expect(store.getState().epf.events.map((event) => event.type)).toEqual(["contribution", "contribution", "interest"]);
  expect(store.getState().epf.events[0]).toMatchObject({ party: "employee", voluntary: true });
  expect(store.getState().epf.events[2]).toMatchObject({ effectiveDate: "2026-05-31", postedDate: "2026-07-15" });
  expect(store.getState().cashEntries).toEqual([]);
});

test("a withdrawal into tracked Cash saves both records together and deleting it removes both", async () => {
  const store = setup();
  await enter(store, async (screen) => {
    await choose(screen, "epf-entry-kind", "withdrawal");
    await fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "5000");
    await choose(screen, "epf-entry-destination", "cash");
    await setDate(screen, "epf-entry-date", "2026-06-01");
    await fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent("Your tracked Cash increases by ₹5,000.00. Both records are saved together.");
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  const [withdrawal] = store.getState().epf.events;
  const link = store.getState().epf.cashLinks[0];
  expect(link.eventId).toBe(withdrawal.id);
  expect(store.getState().cashEntries.find((entry) => entry.id === link.cashEntryId)).toMatchObject({
    amount: 5000, type: "addition", purpose: "epfTransfer", date: "2026-06-01" });
  expect(total(store).total).toBe(135000);

  const screen = await render(<EpfEntryScreen accountId="acme" entryId={withdrawal.id} now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);
  await fireEvent.press(screen.getByTestId("delete-epf-entry"));
  expect(screen.getByTestId("delete-epf-entry-impact")).toHaveTextContent(/linked Cash entry is removed too/);
  await fireEvent.press(screen.getByTestId("confirm-delete-epf-entry"));
  expect(store.getState().epf.events).toEqual([]);
  expect(store.getState().cashEntries.some((entry) => entry.id === link.cashEntryId)).toBe(false);
});

test("a final settlement records the interest paid with the claim, empties the account and shows it as settled", async () => {
  const store = setup();
  await enter(store, async (screen) => {
    await choose(screen, "epf-entry-kind", "withdrawal");
    await fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "144000");
    await fireEvent.changeText(screen.getByTestId("epf-entry-employee-input"), "103000");
    await fireEvent.changeText(screen.getByTestId("epf-entry-employer-input"), "41000");
    await fireEvent.press(screen.getByTestId("epf-entry-settlement"));
    expect(screen.getByText("Settled on")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("epf-entry-settlement-interest-input"), "4000");
    await fireEvent.changeText(screen.getByTestId("epf-entry-settlement-interest-employee-input"), "3000");
    await fireEvent.changeText(screen.getByTestId("epf-entry-settlement-interest-employer-input"), "1000");
    await setDate(screen, "epf-entry-date", "2026-06-01");
    await fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-effect-acme")).toHaveTextContent("₹1,40,000.00 → ₹0.00");
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent("Pays out the whole balance, including ₹4,000.00 interest " +
      "credited with the claim. The interest counts as return, and the account ends at ₹0.");
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  expect(total(store)).toMatchObject({ total: 0, capital: 0 });
  expect(store.getState().epf.events[0]).toMatchObject({ settlement: { interest: { total: 4000 } } });

  const detail = await render(<EpfAccountScreen accountId="acme" now={now} onBack={jest.fn()} onComplete={jest.fn()}
    onUpdateBalance={jest.fn()} store={store} />);
  expect(detail.getByText("EPFO · Settled on 01 Jun 2026")).toBeTruthy();
  expect(detail.getByTestId("epf-capital")).toHaveTextContent("₹0.00");
  expect(detail.getByTestId("epf-account-evidence")).toHaveTextContent("Paid out in full on 01 Jun 2026");
  expect(detail.getByText("Nothing remains invested after the final settlement.")).toBeTruthy();
  expect(detail.queryByTestId("update-epf-balance")).toBeNull();
});

test("a 50,000 transfer keeps combined EPF unchanged in transit, completes from either side, and never duplicates", async () => {
  const store = setup([account("acme", "Acme", 140000, 100000, 40000), account("beta", "Beta", 0)]);
  await enter(store, async (screen) => {
    await choose(screen, "epf-entry-kind", "transferOut");
    await fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "50000");
    await choose(screen, "epf-entry-target", "beta");
    await choose(screen, "epf-entry-transfer-status", "inTransit");
    await setDate(screen, "epf-entry-date", "2026-06-01");
    await fireEvent.press(screen.getByTestId("review-epf-entry"));
    expect(screen.getByTestId("epf-entry-effect-acme")).toHaveTextContent("₹1,40,000.00 → ₹90,000.00");
    expect(screen.getByTestId("epf-entry-effect-total")).toHaveTextContent("₹1,40,000.00 → ₹1,40,000.00");
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent(/₹50,000.00 is counted once as moving/);
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  expect(store.getState().epf.events).toHaveLength(1);
  expect(total(store)).toMatchObject({ total: 140000, inTransit: 50000 });
  const [transfer] = store.getState().epf.events;

  // Opened from the receiving account, the transfer is still edited as Acme → Beta.
  const screen = await render(<EpfEntryScreen accountId="beta" entryId={transfer.id} now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);
  await choose(screen, "epf-entry-transfer-status", "completed");
  await setDate(screen, "epf-entry-credit-date", "2026-06-10");
  await fireEvent.press(screen.getByTestId("review-epf-entry"));
  expect(screen.getByTestId("epf-entry-effect-beta")).toHaveTextContent("₹0.00 → ₹50,000.00");
  await fireEvent.press(screen.getByTestId("save-epf-entry"));
  expect(store.getState().epf.events).toEqual([expect.objectContaining({ id: transfer.id, sourceId: "acme", destinationId: "beta",
    status: "completed", creditDate: "2026-06-10" })]);
  const result = total(store);
  expect(result).toMatchObject({ total: 140000, inTransit: 0 });
  expect(result.ok && result.accounts.map((item) => item.balance.total)).toEqual([90000, 50000]);
});

test("asks for the receiving account first when no other account is tracked", async () => {
  const store = setup();
  await enter(store, async (screen) => {
    await choose(screen, "epf-entry-kind", "transferOut");
    expect(screen.getByTestId("epf-entry-no-target")).toHaveTextContent(/Add the receiving EPF account first/);
  });
});

test("records a provider reversal from the entry, keeping the original in history", async () => {
  const store = setup();
  await enter(store, async (screen) => {
    await choose(screen, "epf-entry-kind", "employerContribution");
    await fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "367");
    await setDate(screen, "epf-entry-date", "2026-05-05");
    await fireEvent.press(screen.getByTestId("review-epf-entry"));
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  const [contribution] = store.getState().epf.events;
  const onComplete = jest.fn();
  const screen = await render(<EpfEntryScreen accountId="acme" entryId={contribution.id} now={now} onBack={jest.fn()} onComplete={onComplete} store={store} />);
  await fireEvent.press(screen.getByTestId("reverse-epf-entry"));
  await fireEvent.press(screen.getByTestId("save-epf-reversal"));
  expect(screen.getByText("Say why the provider reversed it.")).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId("epf-reversal-reason-input"), "Employer correction");
  await fireEvent.press(screen.getByTestId("save-epf-reversal"));
  expect(onComplete).toHaveBeenCalled();
  expect(store.getState().epf.events).toEqual([contribution, expect.objectContaining({ type: "reversal", reversesId: contribution.id, reason: "Employer correction" })]);
  expect(total(store).total).toBe(140000);
});

test("invalid input keeps the draft, cancelling saves nothing, and balance updates are read-only here", async () => {
  const store = setup();
  const before = JSON.stringify(store.getState().epf);
  const { screen } = await enter(store, async (view) => {
    await fireEvent.changeText(view.getByTestId("epf-entry-amount-input"), "12.345");
    await setDate(view, "epf-entry-date", "2026-03-31");
    await fireEvent.press(view.getByTestId("review-epf-entry"));
  });
  expect(screen.getByText(/amount from your statement/)).toBeTruthy();
  expect(screen.getByText(/already includes earlier activity/)).toBeTruthy();
  expect(screen.getByTestId("epf-entry-amount-input")).toHaveProp("value", "12.345");
  expect(JSON.stringify(store.getState().epf)).toBe(before);

  await act(() => store.getState().applyEpfCommand({ commandId: "rec", reason: "Statement", change: { type: "eventPut", cash: null, event: {
    id: "rec", type: "reconciliation", accountId: "acme", effectiveDate: "2026-09-30", postedDate: "2026-09-30",
    recordedAt: now.toISOString(), evidence: "EPFO passbook", reason: "Annual statement", capital: null,
    balance: { total: 150000, components: null } } } }, store.getState().getBackupRevision()));
  const view = await render(<EpfEntryScreen accountId="acme" entryId="rec" now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);
  expect(view.getByTestId("epf-entry-summary")).toHaveTextContent(/Annual statement/);
  expect(view.queryByTestId("epf-entry-amount-input")).toBeNull();
  expect(view.queryByTestId("reverse-epf-entry")).toBeNull();
  expect(view.getByTestId("delete-epf-entry")).toBeTruthy();
});

test("masks values until revealed, and the account activity lists signed entries that open the entry", async () => {
  const store = setup();
  await enter(store, async (screen) => {
    await fireEvent.changeText(screen.getByTestId("epf-entry-amount-input"), "1200");
    await setDate(screen, "epf-entry-date", "2026-05-05");
    await fireEvent.press(screen.getByTestId("review-epf-entry"));
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  const [event] = store.getState().epf.events;
  const onOpenEntry = jest.fn();
  const detail = await render(<EpfAccountScreen accountId="acme" now={now} onBack={jest.fn()} onComplete={jest.fn()}
    onOpenEntry={onOpenEntry} onUpdateBalance={jest.fn()} store={store} />);
  await fireEvent.press(detail.getByTestId("epf-activity-toggle"));
  expect(detail.getByTestId(`epf-event-${event.id}`)).toHaveTextContent(/Employee contribution.*\+₹1,200.00/);
  await fireEvent.press(detail.getByTestId(`epf-event-${event.id}`));
  expect(onOpenEntry).toHaveBeenCalledWith("acme", event.id);
  await fireEvent.press(detail.getByTestId("add-epf-entry"));
  expect(onOpenEntry).toHaveBeenLastCalledWith("acme", undefined);
  await detail.unmount();

  await act(() => store.getState().updatePreferences({ maskWealthValues: true }));
  const masked = await render(<EpfEntryScreen accountId="acme" now={now} onBack={jest.fn()} onComplete={jest.fn()} store={store} />);
  expect(masked.getByTestId("reveal-epf-entry")).toBeTruthy();
  expect(masked.queryByTestId("epf-entry-amount-input")).toBeNull();
});

test("a financial year summary reconciles a whole year to the passbook in one entry", async () => {
  const old = account("acme", "Acme", 140000, 100000, 40000);
  const store = setup([{ ...old, checkpoint: { ...old.checkpoint, date: "2024-03-31" } }]);
  const fill = async (screen: Awaited<ReturnType<typeof render>>, closingEmployee: string) => {
    await choose(screen, "epf-entry-kind", "yearSummary");
    await choose(screen, "epf-summary-year", "2024-04-01");
    for (const [id, value] of [["contribution-employee", "21600"], ["contribution-employer", "6600"], ["interest-employee", "9500"],
      ["interest-employer", "3800"], ["closing-employee", closingEmployee], ["closing-employer", "50400"]]) {
      await fireEvent.changeText(screen.getByTestId(`epf-summary-${id}-input`), value);
    }
    expect(screen.queryByTestId("epf-entry-amount-input")).toBeNull();
    await fireEvent.press(screen.getByTestId("review-epf-entry"));
  };
  await enter(store, async (screen) => {
    await fill(screen, "131550");
    expect(screen.getByTestId("epf-entry-error")).toHaveTextContent(/employee ₹1,31,100.00 calculated, ₹1,31,550.00 in the passbook/);
  });
  const { onComplete } = await enter(store, async (screen) => {
    await fill(screen, "131100");
    expect(screen.getByTestId("epf-entry-summary-period")).toHaveTextContent("01 Apr 2024 – 31 Mar 2025");
    expect(screen.getByTestId("epf-entry-effect-acme")).toHaveTextContent("₹1,40,000.00 → ₹1,81,500.00");
    expect(screen.getByTestId("epf-entry-role")).toHaveTextContent(/matches the passbook closing balance/);
    await fireEvent.press(screen.getByTestId("save-epf-entry"));
  });
  expect(onComplete).toHaveBeenCalled();
  expect(total(store).accounts[0].balance).toEqual({ total: 181500, components: { employee: 131100, employer: 50400 } });
  expect(store.getState().epf.events[0]).toMatchObject({ type: "yearSummary", periodStart: "2024-04-01", effectiveDate: "2025-03-31" });
});

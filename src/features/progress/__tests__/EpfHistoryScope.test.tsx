import { act, render } from "@testing-library/react-native";

import { EpfHistoryScope } from "../EpfHistoryScope";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { EpfAccount } from "@/src/domain/epf";
import type { EpfChange } from "@/src/domain/epf/persistence";

const now = new Date("2026-07-10T10:00:00Z");
const account = (id: string, date: string, total: number, historyCompleteThrough: string | null = null): EpfAccount => ({
  id, nickname: id, provider: "epfo", status: "active", currency: "INR", historyCompleteThrough,
  checkpoint: { date, balance: { total, components: null }, capital: null, source: "epfoStatement", recordedAt: `${date}T10:00:00Z` },
});
function setup() {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => now });
  let sequence = 0;
  const apply = (change: EpfChange) => act(() => store.getState().applyEpfCommand(
    { commandId: `c${++sequence}`, reason: "Statement", change }, store.getState().getBackupRevision()));
  return { store, apply };
}

test("renders nothing without EPF accounts", () => {
  const { store } = setup();
  expect(render(<EpfHistoryScope maskWealthValues={false} now={now} store={store} />).toJSON()).toBeNull();
});

test("follows the selected month and separates contributions, interest and reconciliation", () => {
  const { store, apply } = setup();
  apply({ type: "accountPut", account: account("a", "2026-03-15", 140000, "2026-07-01") });
  const base = { accountId: "a", postedDate: "2026-04-30", recordedAt: "2026-05-01T00:00:00Z", evidence: "Passbook" };
  apply({ type: "eventPut", cash: null, event: { ...base, id: "employer", type: "contribution", party: "employer", amount: 367, effectiveDate: "2026-04-05" } });
  apply({ type: "eventPut", cash: null, event: { ...base, id: "interest", type: "interest", amount: { total: 1000, components: null }, effectiveDate: "2026-04-30" } });
  apply({ type: "eventPut", cash: null, event: { ...base, id: "fix", type: "reconciliation", balance: { total: 141500, components: null },
    capital: null, reason: "Annual statement", effectiveDate: "2026-05-31", postedDate: "2026-05-31" } });
  const view = render(<EpfHistoryScope maskWealthValues={false} month="2026-04" now={now} store={store} />);
  expect(view.getByText("EPF at end of April 2026")).toBeTruthy();
  expect(view.getByTestId("progress-epf-month-value").props.accessibilityLabel).toBe("₹1,41,367.00");
  expect(view.getByTestId("progress-epf-month-status")).toHaveTextContent("Confirmed month-end balance.");
  expect(view.getByTestId("progress-epf-month-contributions").props.accessibilityLabel).toBe("₹367.00");
  expect(view.getByTestId("progress-epf-month-interest").props.accessibilityLabel).toBe("₹1,000.00");
  view.rerender(<EpfHistoryScope maskWealthValues month="2026-05" now={now} store={store} />);
  expect(view.getByText(/not a contribution or return/)).toBeTruthy();
  expect(view.queryByTestId("progress-epf-month-contributions")).toBeNull();
  expect(view.getByTestId("progress-epf-month-value").props.accessibilityLabel).toBe("Amount hidden");
});

test("an account without a balance for the month shows unavailable, not a partial total", () => {
  const { store, apply } = setup();
  apply({ type: "accountPut", account: account("a", "2026-03-15", 140000) });
  apply({ type: "accountPut", account: account("b", "2026-06-10", 60000) });
  const view = render(<EpfHistoryScope maskWealthValues={false} month="2026-04" now={now} store={store} />);
  expect(view.getByTestId("progress-epf-month-value")).toHaveTextContent("Unavailable");
  expect(view.getByTestId("progress-epf-month-status")).toHaveTextContent(/1 of 2 accounts recorded./);
  view.rerender(<EpfHistoryScope maskWealthValues={false} month="2026-01" now={now} store={store} />);
  expect(view.getByText("EPF at end of January 2026")).toBeTruthy();
  expect(view.getByTestId("progress-epf-month-value")).toHaveTextContent("Unavailable");
  expect(view.getByTestId("progress-epf-month-status")).toHaveTextContent(/not counted as zero/);
  view.rerender(<EpfHistoryScope maskWealthValues={false} now={now} store={store} />);
  expect(view.getByText("EPF at end of June 2026")).toBeTruthy();
  expect(view.getByTestId("progress-epf-month-value").props.accessibilityLabel).toBe("₹2,00,000.00");
});

test("discloses money moving between tracked accounts without changing combined value", () => {
  const { store, apply } = setup();
  apply({ type: "accountPut", account: account("a", "2026-03-15", 140000) });
  apply({ type: "accountPut", account: account("b", "2026-03-15", 0) });
  apply({ type: "eventPut", cash: null, event: { id: "move", type: "transfer", sourceId: "a", destinationId: "b",
    status: "inTransit", amount: { total: 50000, components: null }, capital: null, creditDate: null,
    effectiveDate: "2026-05-20", postedDate: "2026-05-20", recordedAt: "2026-05-21T00:00:00Z", evidence: "Claim" } });
  const view = render(<EpfHistoryScope maskWealthValues={false} month="2026-06" now={now} store={store} />);
  expect(view.getByTestId("progress-epf-month-value").props.accessibilityLabel).toBe("₹1,40,000.00");
  expect(view.getByTestId("progress-epf-month-transit").props.accessibilityLabel).toBe("₹50,000.00");
});

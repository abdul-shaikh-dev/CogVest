import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";

import { PpfImportScreen } from "../PpfImportScreen";
import { mergeSaveLabel } from "../PpfMergePreview";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { PpfAccount } from "@/src/types";

const now = () => new Date("2026-11-21T12:00:00.000Z");
const account: PpfAccount = {
  balanceAsOf: "2024-04-01", confirmedBalance: 30_000, createdAt: "2026-06-01T00:00:00.000Z", id: "ppf",
  nickname: "Synthetic PPF", opening: { financialYearStart: 2020, kind: "financialYear" }, provider: "Synthetic bank", status: "active",
};
const passbook = [
  "Date,Narration,Type,Amount,Closing Balance",
  "15/03/2024,Before the opening balance,Deposit,10000,30000",
  "12/05/2024,NB Subscription,Deposit,\"50,000\",\"80,000\"",
  "05/12/2024,NB Subscription,Deposit,\"25,000\",\"1,05,000\"",
  "31-Mar-2025,Interest paid,Interest,\"6,500\",\"1,11,500\"",
].join("\n");

function seededStore() {
  const store = createPortfolioStore({ now, storage: createMemoryJsonStorage() });
  store.getState().addPpfAccount(account);
  store.getState().addPpfLedgerEntry({ accountId: "ppf", amount: 50_000, date: "2024-05-10", id: "typed-may", recordedAt: "2026-06-01T00:00:00.000Z", type: "contribution" });
  store.getState().addPpfLedgerEntry({ accountId: "ppf", amount: 20_000, date: "2024-12-05", id: "typed-dec", recordedAt: "2026-06-01T00:00:00.000Z", type: "contribution" });
  return store;
}

async function review(store: ReturnType<typeof seededStore>, text = passbook) {
  const onImported = jest.fn();
  await render(
    <PpfImportScreen
      accountId="ppf" now={now} onCancel={jest.fn()} onImported={onImported} store={store}
      pickCsvFile={jest.fn(async () => ({ name: "passbook.csv", size: text.length, text }))}
      saveCsvTemplate={jest.fn(async () => "cogvest-ppf-v1.csv")}
    />,
  );
  await fireEvent.press(screen.getByTestId("ppf-import-choose-csv"));
  await waitFor(() => expect(screen.getByText("Selected: passbook.csv")).toBeTruthy());
  await fireEvent.press(screen.getByTestId("ppf-merge-preview"));
  await screen.findByTestId("ppf-merge-preview-screen");
  return onImported;
}

const amounts = (store: ReturnType<typeof seededStore>) => store.getState().ppfLedgerEntries
  .map((entry) => [entry.date, "amount" in entry ? entry.amount : null]).sort();

describe("adding a PPF file to existing entries (#748)", () => {
  test("is the default, sorts the rows, and adds only the new ones after review", async () => {
    const store = seededStore();
    const before = store.getState().ppfLedgerEntries;
    const onImported = await review(store);
    expect(store.getState().ppfLedgerEntries).toBe(before);
    const count = (status: string) => within(screen.getByTestId(`ppf-merge-count-${status}`));
    expect(count("new").getByText("1")).toBeTruthy();
    expect(count("recorded").getByText("1")).toBeTruthy();
    expect(count("differs").getByText("1")).toBeTruthy();
    expect(count("beforeOpening").getByText("1")).toBeTruthy();
    expect(screen.getByTestId("ppf-merge-row-3")).toHaveTextContent(/Already recorded/);
    expect(screen.getByTestId("ppf-merge-year-2024")).toBeTruthy();
    expect(screen.getByTestId("ppf-merge-save")).toHaveTextContent("Add 1 entry");
    await fireEvent.press(screen.getByTestId("ppf-merge-save"));
    expect(onImported).toHaveBeenCalledWith("ppf");
    expect(amounts(store)).toEqual([["2024-05-10", 50_000], ["2024-12-05", 20_000], ["2025-03-31", 6500]]);
  });

  test("a differing row keeps the user's amount unless they choose the file's", async () => {
    const store = seededStore();
    await review(store);
    expect(screen.getAllByTestId("ppf-merge-warning").map((node) => node.props.children))
      .toContain("Row 4: the file shows a balance your records wouldn't reach once saved. An earlier entry may be missing or differ.");
    await fireEvent.press(screen.getByTestId("ppf-merge-use-file-4"));
    expect(screen.getByTestId("ppf-merge-save")).toHaveTextContent("Add 1 entry and correct 1");
    await fireEvent.press(screen.getByTestId("ppf-merge-save"));
    expect(amounts(store)).toEqual([["2024-05-10", 50_000], ["2024-12-05", 25_000], ["2025-03-31", 6500]]);
  });

  test("lists every problem with its row and column, shows what was read, and saves nothing", async () => {
    const store = seededStore();
    const before = store.getState().ppfLedgerEntries;
    await review(store, "Txn Ref,Debit,Credit\nA1,,500\n");
    expect(screen.getAllByTestId("ppf-merge-error")[0]).toHaveTextContent(`Columns: Column "Txn Ref" isn't one CogVest reads.`, { exact: false });
    expect(screen.getByTestId("ppf-merge-first-rows")).toHaveTextContent(/Txn Ref \| Debit \| Credit/);
    expect(screen.getByTestId("ppf-merge-save").props.accessibilityState).toMatchObject({ disabled: true });
    expect(store.getState().ppfLedgerEntries).toBe(before);
  });

  test("a file already in the records has nothing to add", async () => {
    const store = seededStore();
    await review(store, "date,type,amount\n2024-05-10,contribution,50000\n");
    expect(screen.getByTestId("ppf-merge-nothing-new")).toBeTruthy();
    expect(screen.getByTestId("ppf-merge-save").props.accessibilityState).toMatchObject({ disabled: true });
  });

  test("repeated rows can be saved only after confirming they are separate deposits", async () => {
    const store = seededStore();
    await review(store, "date,type,amount\n2025-01-15,deposit,500\n2025-01-15,deposit,500\n");
    expect(screen.getByTestId("ppf-merge-save").props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId("ppf-merge-confirm-duplicates"));
    await fireEvent.press(screen.getByTestId("ppf-merge-save"));
    expect(store.getState().ppfLedgerEntries).toHaveLength(4);
  });

  test("a save refused because the account changed says so and changes nothing", async () => {
    const store = seededStore();
    await review(store);
    await act(async () => { store.getState().addPpfLedgerEntry({ accountId: "ppf", amount: 1000, date: "2025-02-01", id: "typed-later", recordedAt: "2026-06-02T00:00:00.000Z", type: "contribution" }); });
    const before = store.getState().ppfLedgerEntries;
    await fireEvent.press(screen.getByTestId("ppf-merge-save"));
    expect(screen.getByTestId("ppf-merge-save-error")).toHaveTextContent("This account changed. Review the file again before saving.");
    expect(store.getState().ppfLedgerEntries).toBe(before);
  });

  test("masked amounts stay hidden in the review", async () => {
    const store = seededStore();
    store.getState().updatePreferences({ maskWealthValues: true });
    await review(store);
    expect(within(screen.getByTestId("ppf-merge-row-5")).queryByText("₹6,500.00")).toBeNull();
    expect(within(screen.getByTestId("ppf-merge-differs-4")).queryByText("₹25,000.00")).toBeNull();
  });
});

test("save labels read naturally", () => {
  expect(mergeSaveLabel(1, 0)).toBe("Add 1 entry");
  expect(mergeSaveLabel(3, 2)).toBe("Add 3 entries and correct 2");
  expect(mergeSaveLabel(0, 1)).toBe("Correct 1 entry");
});

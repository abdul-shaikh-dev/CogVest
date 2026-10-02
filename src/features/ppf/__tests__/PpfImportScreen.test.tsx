import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { createStore, type StoreApi } from "zustand/vanilla";

import { PpfImportScreen } from "../PpfImportScreen";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { calculatePpfConfirmedBalance } from "@/src/domain/ppf";
import type { PortfolioStoreState } from "@/src/store";
import type { PpfAccount, PpfLedgerEntry } from "@/src/types";

const today = new Date("2026-09-10T10:00:00.000Z");
const csv = "date,type,amount,note\n2026-08-01,contribution,5000,August contribution\n";
const account: PpfAccount = {
  balanceAsOf: "2026-07-31",
  confirmedBalance: 100_000,
  createdAt: "2026-08-01T10:00:00.000Z",
  id: "ppf-import-account",
  nickname: "Primary PPF",
  opening: { financialYearStart: 2020, kind: "financialYear" },
  provider: "India Post",
  status: "active",
};

function createMockStore({
  entries = [],
  result = { status: "applied" as const },
}: {
  entries?: PpfLedgerEntry[];
  result?: ReturnType<PortfolioStoreState["importPpfCsv"]>;
} = {}) {
  const importPpfCsv = jest.fn(() => result);
  const store = createStore(() => ({
    importPpfCsv,
    ppfAccounts: [account],
    ppfLedgerEntries: entries,
    preferences: { maskWealthValues: false },
  })) as unknown as StoreApi<PortfolioStoreState>;
  return { importPpfCsv, store };
}

function renderScreen(overrides: Partial<React.ComponentProps<typeof PpfImportScreen>> = {}) {
  const mocked = createMockStore();
  const props = {
    accountId: account.id,
    now: () => today,
    onCancel: jest.fn(),
    onImported: jest.fn(),
    pickCsvFile: jest.fn(async () => ({ name: "ppf.csv", size: csv.length, text: csv })),
    saveCsvTemplate: jest.fn(async () => "cogvest-ppf-v1.csv"),
    store: mocked.store,
    ...overrides,
  };
  return { ...render(<PpfImportScreen {...props} />), mocked, props };
}

async function preview(screen: ReturnType<typeof render>) {
  fireEvent.press(screen.getByTestId("ppf-import-choose-csv"));
  await waitFor(() => expect(screen.getByText("Selected: ppf.csv")).toBeTruthy());
  fireEvent.changeText(screen.getByTestId("ppf-import-baseline-contribution"), "0");
  fireEvent.press(screen.getByTestId("ppf-import-complete-through-today"));
  fireEvent.press(screen.getByTestId("ppf-import-preview"));
  await waitFor(() => expect(screen.getByTestId("ppf-import-preview-screen")).toBeTruthy());
}

describe("PpfImportScreen", () => {
  it("shows repeated rows and resulting balance without pretending duplicates were skipped", async () => {
    const repeated = `${csv}2026-08-01,contribution,5000,August contribution\n`;
    const screen = renderScreen({ pickCsvFile: jest.fn(async () => ({ name: "ppf.csv", size: repeated.length, text: repeated })) });
    await preview(screen);
    expect(screen.getByTestId("ppf-import-counts")).toHaveTextContent("Parsed entries2Repeated rows1Issues to resolve0");
    expect(screen.getByTestId("ppf-import-closing-balance")).toHaveTextContent("₹1,10,000.00");
    expect(screen.getByTestId("ppf-import-confirm-duplicates")).toBeTruthy();
    expect(screen.mocked.importPpfCsv).not.toHaveBeenCalled();
  });

  it("keeps unsupported rows visible as blocking errors, not zero-value additions", async () => {
    const invalid = "date,type,amount,note\n2026-08-01,loan,5000,Unsupported\n";
    const screen = renderScreen({ pickCsvFile: jest.fn(async () => ({ name: "ppf.csv", size: invalid.length, text: invalid })) });
    await preview(screen);
    expect(screen.getByTestId("ppf-import-counts")).toHaveTextContent(/Issues to resolve1/);
    expect(screen.getByText("Import blocked. Correct the issues below; no rows will be saved.")).toBeTruthy();
    expect(screen.queryByTestId("ppf-import-closing-balance")).toBeNull();
    fireEvent.press(screen.getByTestId("ppf-import-save"));
    expect(screen.mocked.importPpfCsv).not.toHaveBeenCalled();
  });

  it("preserves unrelated accounts and saves only the reviewed ledger after returning from preview", async () => {
    const store = createPortfolioStore({ now: () => today, storage: createMemoryJsonStorage() });
    const other = { ...account, id: "unrelated", nickname: "Other PPF" };
    store.getState().addPpfAccount(account);
    store.getState().addPpfAccount(other);
    const before = store.getState().ppfAccounts;
    const screen = renderScreen({ store });
    await preview(screen);
    fireEvent.press(screen.getByTestId("ppf-import-preview-back"));
    expect(store.getState().ppfAccounts).toEqual(before);
    expect(store.getState().ppfLedgerEntries).toEqual([]);
    fireEvent.press(screen.getByTestId("ppf-import-preview"));
    fireEvent.press(screen.getByTestId("ppf-import-save"));
    await waitFor(() => expect(screen.props.onImported).toHaveBeenCalledWith(account.id));
    const saved = store.getState();
    expect(saved.ppfAccounts.find((item) => item.id === other.id)).toEqual(other);
    expect(saved.ppfLedgerEntries).toEqual([expect.objectContaining({ accountId: account.id, date: "2026-08-01", amount: 5000, type: "contribution", notes: "August contribution" })]);
    expect(calculatePpfConfirmedBalance(saved.ppfAccounts[0], saved.ppfLedgerEntries, "2026-09-10").confirmedBalance).toBe(105000);
  });

  it("explains that the opening balance must not be repeated in CSV activity", () => {
    const screen = renderScreen();

    expect(screen.getByTestId("ppf-import-baseline-example")).toHaveTextContent(/Opening balance stays separate/u);
    expect(screen.getByTestId("ppf-import-baseline-example")).toHaveTextContent(/Do not add that INR 100,000 again as a contribution row/u);
  });

  it("creates a detached preview without mutating the store", async () => {
    const screen = renderScreen();
    await preview(screen);

    expect(screen.mocked.importPpfCsv).not.toHaveBeenCalled();
    expect(screen.getByText("Primary PPF • no changes saved yet")).toBeTruthy();
    expect(screen.getByText("CSV rows (1)")).toBeTruthy();
    expect(screen.getByText("Preview only. Saving replaces this account's imported checkpoint and ledger only after confirmation.")).toBeTruthy();
  });

  it("saves the previewed input and expected state only after confirmation", async () => {
    const screen = renderScreen();
    await preview(screen);
    fireEvent.press(screen.getByTestId("ppf-import-save"));

    expect(screen.mocked.importPpfCsv).toHaveBeenCalledWith(expect.objectContaining({
      confirmDuplicateRows: false,
      confirmReplacement: false,
      expectedState: expect.any(String),
      input: expect.objectContaining({ accountId: account.id, csv }),
    }));
    expect(screen.props.onImported).toHaveBeenCalledWith(account.id);
  });

  it("keeps the previous file when picker selection is canceled", async () => {
    const pickCsvFile = jest
      .fn()
      .mockResolvedValueOnce({ name: "first.csv", size: csv.length, text: csv })
      .mockResolvedValueOnce(undefined);
    const screen = renderScreen({ pickCsvFile });
    fireEvent.press(screen.getByTestId("ppf-import-choose-csv"));
    await waitFor(() => expect(screen.getByText("Selected: first.csv")).toBeTruthy());
    fireEvent.press(screen.getByTestId("ppf-import-choose-csv"));
    await waitFor(() => expect(pickCsvFile).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Selected: first.csv")).toBeTruthy();
  });

  it("keeps invalid input in the preview and does not save", async () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByTestId("ppf-import-choose-csv"));
    await waitFor(() => expect(screen.getByText("Selected: ppf.csv")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("ppf-import-baseline-contribution"), "0");
    fireEvent.press(screen.getByTestId("ppf-import-preview"));
    await waitFor(() => expect(screen.getByTestId("ppf-import-preview-screen")).toBeTruthy());

    expect(screen.getAllByText(/Confirm that the history is complete through today/u).length).toBeGreaterThan(0);
    expect(screen.mocked.importPpfCsv).not.toHaveBeenCalled();
  });

  it("returns to the form and clears stale validation after the input is fixed", async () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByTestId("ppf-import-choose-csv"));
    await waitFor(() => expect(screen.getByText("Selected: ppf.csv")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("ppf-import-baseline-contribution"), "0");
    fireEvent.press(screen.getByTestId("ppf-import-preview"));
    await waitFor(() => expect(screen.getByTestId("ppf-import-preview-error")).toBeTruthy());

    fireEvent.press(screen.getByTestId("ppf-import-preview-back"));
    expect(screen.getByTestId("ppf-import-screen")).toBeTruthy();
    fireEvent.press(screen.getByTestId("ppf-import-complete-through-today"));
    fireEvent.press(screen.getByTestId("ppf-import-preview"));
    await waitFor(() => expect(screen.getByTestId("ppf-import-preview-screen")).toBeTruthy());
    expect(screen.queryByTestId("ppf-import-preview-error")).toBeNull();
  });

  it("reports template and picker failures without false success", async () => {
    const screen = renderScreen({
      pickCsvFile: jest.fn(async () => { throw new Error("denied"); }),
      saveCsvTemplate: jest.fn(async () => { throw new Error("denied"); }),
    });
    fireEvent.press(screen.getByTestId("ppf-import-save-template"));
    await waitFor(() => expect(screen.getByTestId("ppf-import-template-status")).toHaveTextContent("The template could not be saved. Choose another folder and try again."));
    fireEvent.press(screen.getByTestId("ppf-import-choose-csv"));
    await waitFor(() => expect(screen.getByTestId("ppf-import-file-error")).toHaveTextContent("The CSV could not be read. Check access and try again."));
  });

  it("requires replacement confirmation and surfaces stale rejection", async () => {
    const oldEntry: PpfLedgerEntry = {
      accountId: account.id,
      amount: 500,
      date: "2026-08-02",
      id: "old-entry",
      recordedAt: "2026-08-02T10:00:00.000Z",
      type: "contribution",
    };
    const mocked = createMockStore({
      entries: [oldEntry],
      result: { reason: "This account changed. Generate a fresh preview before saving.", status: "rejected" },
    });
    const screen = renderScreen({ store: mocked.store });
    await preview(screen);

    expect(screen.getByTestId("ppf-import-confirm-replacement")).toBeTruthy();
    fireEvent.press(screen.getByTestId("ppf-import-save"));
    expect(mocked.importPpfCsv).not.toHaveBeenCalled();
    expect(screen.getByText("Confirm replacement of the existing PPF checkpoint and ledger before saving.")).toBeTruthy();

    fireEvent.press(screen.getByTestId("ppf-import-confirm-replacement"));
    fireEvent.press(screen.getByTestId("ppf-import-save"));
    expect(mocked.importPpfCsv).toHaveBeenCalled();
    expect(screen.getByText("This account changed. Generate a fresh preview before saving.")).toBeTruthy();
  });
});

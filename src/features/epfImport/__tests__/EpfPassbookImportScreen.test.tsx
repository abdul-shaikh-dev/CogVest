import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { calculateEpfLedger, type EpfAccount } from "@/src/domain/epf";
import { readEpfoPassbook } from "@/src/domain/epf/passbook";
import { EpfPassbookImportScreen } from "@/src/features/epfImport";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import { passbookChain } from "@/src/testing/epfPassbookFixture";

const now = new Date("2025-08-20T10:00:00.000Z");
const files = {
  "old-2021.pdf": passbookChain.oldFirstYear,
  "old-2022.pdf": passbookChain.oldClaimYear,
  "new-2022.pdf": passbookChain.newFirstYear,
  "scan.pdf": "Not a passbook at all",
} as const;
type FileName = keyof typeof files;

function setup(accounts: EpfAccount[] = []) {
  const store = createPortfolioStore({ now: () => now, storage: createMemoryJsonStorage() });
  for (const item of accounts) {
    store.getState().applyEpfCommand({ commandId: `seed-${item.id}`, reason: "Statement", change: { type: "accountPut", account: item } },
      store.getState().getBackupRevision());
  }
  return store;
}

async function open(store: ReturnType<typeof setup>, picks: FileName[][]) {
  const queue = [...picks];
  const onComplete = jest.fn();
  const screen = await render(
    <EpfPassbookImportScreen now={now} onBack={jest.fn()} onComplete={onComplete} store={store}
      pickPassbooks={async () => (queue.shift() ?? []).map((name) => ({ name, size: 1, uri: `file:///${name}` }))}
      readPassbook={async (source) => readEpfoPassbook(files[source.uri.replace("file:///", "") as FileName])} />,
  );
  return { screen, onComplete };
}

async function pick(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(screen.getByTestId("choose-epf-passbooks"));
  await waitFor(() => expect(screen.getByTestId("choose-epf-passbooks")).toHaveTextContent("Add more passbooks"));
}

const ledger = (store: ReturnType<typeof setup>) => {
  const { accounts, events } = store.getState().epf;
  const result = calculateEpfLedger({ accounts, events }, "2025-08-20", "2025-08-20");
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result;
};

test("two member IDs become two accounts, saved together and matching the passbooks", async () => {
  const store = setup();
  const { screen, onComplete } = await open(store, [["new-2022.pdf", "scan.pdf"], ["old-2022.pdf", "old-2021.pdf"]]);
  await pick(screen);
  expect(screen.getByTestId("epf-import-rejected")).toHaveTextContent(/scan\.pdf/);
  await pick(screen);

  // Members are listed oldest first, by the last four digits only.
  expect(screen.getByTestId("epf-import-member-0")).toHaveTextContent(/Member ID ending 0001.*FY 2021-22, FY 2022-23/);
  expect(screen.getByTestId("epf-import-member-1")).toHaveTextContent(/Member ID ending 0002.*FY 2022-23/);
  await fireEvent.changeText(screen.getByTestId("epf-import-member-0-nickname"), "First job");
  await fireEvent.changeText(screen.getByTestId("epf-import-member-1-nickname"), "Second job");
  await fireEvent.press(screen.getByTestId("review-epf-import"));

  expect(screen.getByTestId("epf-import-account-0")).toHaveTextContent(/First job.*New EPF account/);
  expect(screen.getByTestId("epf-import-account-1-balance")).toHaveTextContent("New → ₹35,560.00");
  expect(screen.getByTestId("epf-import-total")).toHaveTextContent("₹0.00 → ₹35,560.00");
  expect(screen.queryByTestId("epf-import-warnings")).toBeNull();
  await fireEvent.press(screen.getByTestId("save-epf-import"));

  const saved = store.getState().epf;
  expect(saved.accounts.map((item) => [item.nickname, item.status])).toEqual([["First job", "transferred"], ["Second job", "active"]]);
  expect(onComplete).toHaveBeenCalledWith(saved.accounts[1].id);
  expect(ledger(store)).toMatchObject({ total: 35560, capital: 33840, inTransit: 0 });
  // One audit entry for the whole import, and the member IDs are not stored anywhere.
  expect(store.getState().epf.audit.filter((entry) => entry.reason === "Import EPFO passbooks")).toHaveLength(1);
  expect(JSON.stringify(store.getState().epf)).not.toMatch(/ABCDE0000/);
});

test("importing the same passbooks again changes nothing", async () => {
  const store = setup();
  const first = await open(store, [["old-2021.pdf"]]);
  await pick(first.screen);
  await fireEvent.press(first.screen.getByTestId("review-epf-import"));
  await fireEvent.press(first.screen.getByTestId("save-epf-import"));
  const [account] = store.getState().epf.accounts;

  const again = await open(store, [["old-2021.pdf"]]);
  await pick(again.screen);
  await fireEvent.press(again.screen.getByTestId("epf-import-member-0-target-picker"));
  await fireEvent.press(again.screen.getByTestId(`epf-import-member-0-target-${account.id}`));
  await fireEvent.press(again.screen.getByTestId("review-epf-import"));
  expect(again.screen.getByTestId("epf-import-nothing-changes")).toBeTruthy();
  expect(again.screen.queryByTestId("save-epf-import")).toBeNull();
});

test("a new account can't reuse an existing account's name, and nothing is saved", async () => {
  const store = setup([{ id: "acme", nickname: "EPF 0001", provider: "epfo", status: "active", currency: "INR",
    historyCompleteThrough: null, checkpoint: { date: "2025-03-31", balance: { total: 1000, components: { employee: 1000, employer: 0 } },
      capital: null, source: "epfoStatement", recordedAt: "2025-04-01T00:00:00Z" } }]);
  const { screen } = await open(store, [["old-2021.pdf"]]);
  await pick(screen);
  await fireEvent.press(screen.getByTestId("review-epf-import"));
  expect(screen.getByTestId("epf-import-member-0")).toHaveTextContent(/already has this name/);
  expect(screen.queryByTestId("epf-import-review-screen")).toBeNull();
  expect(store.getState().epf.accounts).toHaveLength(1);
});

test("a later passbook that doesn't continue an existing account's balance is refused", async () => {
  const store = setup([{ id: "acme", nickname: "Acme", provider: "epfo", status: "active", currency: "INR",
    historyCompleteThrough: null, checkpoint: { date: "2021-03-31", balance: { total: 1000, components: { employee: 1000, employer: 0 } },
      capital: null, source: "epfoStatement", recordedAt: "2021-04-01T00:00:00Z" } }]);
  const { screen } = await open(store, [["old-2021.pdf"]]);
  await pick(screen);
  await fireEvent.press(screen.getByTestId("epf-import-member-0-target-picker"));
  await fireEvent.press(screen.getByTestId("epf-import-member-0-target-acme"));
  await fireEvent.press(screen.getByTestId("review-epf-import"));
  expect(screen.getByTestId("epf-import-problems")).toBeTruthy();
  expect(store.getState().epf.events).toHaveLength(0);
});

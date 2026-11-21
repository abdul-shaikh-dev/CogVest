import { planPpfCsvMerge, type PpfMergeInput } from "@/src/domain/ppfCsvMerge";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import type { PpfAccount } from "@/src/types";

const now = () => new Date("2026-11-21T12:00:00.000Z");
const account: PpfAccount = {
  balanceAsOf: "2024-04-01", confirmedBalance: 30_000, createdAt: "2026-06-01T00:00:00.000Z", id: "ppf",
  nickname: "Synthetic PPF", opening: { financialYearStart: 2020, kind: "financialYear" }, provider: "Synthetic bank", status: "active",
};
const csv = "date,type,amount,note\n2024-05-12,deposit,50000,From the passbook\n2024-12-05,deposit,25000,\n2025-03-31,interest,6500,\n";

function seeded() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ now, storage });
  store.getState().addPpfAccount(account);
  store.getState().addPpfLedgerEntry({
    accountId: "ppf", amount: 50_000, date: "2024-05-10", fundingSource: "external", id: "typed-may", recordedAt: "2026-06-01T00:00:00.000Z", type: "contribution",
  });
  store.getState().addPpfLedgerEntry({
    accountId: "ppf", amount: 20_000, date: "2024-12-05", id: "typed-dec", recordedAt: "2026-06-01T00:00:00.000Z", type: "contribution",
  });
  return { storage, store };
}

function command(store: ReturnType<typeof seeded>["store"], input: PpfMergeInput = { accountId: "ppf", csv }, confirmDuplicateRows = false) {
  const state = store.getState();
  return { confirmDuplicateRows, expectedState: planPpfCsvMerge(input, state.ppfAccounts, state.ppfLedgerEntries, now()).expectedState, input };
}

const ledgerSummary = (store: ReturnType<typeof seeded>["store"]) => store.getState().ppfLedgerEntries
  .map((entry) => [entry.date, entry.type, "amount" in entry ? entry.amount : null]).sort();

describe("saving a CogVest PPF CSV as additions (#748)", () => {
  test("adds only the new rows, keeps typed entries, rebuilds months and survives a restart", () => {
    const { storage, store } = seeded();
    const typed = store.getState().ppfLedgerEntries;
    const march = () => store.getState().monthlySnapshots.find((item) => item.month === "2025-03");
    const before = march()?.debtValue;
    expect(store.getState().mergePpfCsv(command(store))).toEqual({ added: 1, corrected: 0, status: "applied" });
    expect(ledgerSummary(store)).toEqual([
      ["2024-05-10", "contribution", 50_000], ["2024-12-05", "contribution", 20_000], ["2025-03-31", "interestCredit", 6500],
    ]);
    for (const entry of typed) expect(store.getState().ppfLedgerEntries).toContain(entry);
    expect(march()?.debtValue).toBe((before ?? 0) + 6500);
    expect(createPortfolioStore({ now, storage }).getState().ppfLedgerEntries).toEqual(store.getState().ppfLedgerEntries);
  });

  test("applies a differing row's file amount only when the user chose it", () => {
    const { store } = seeded();
    const input = { accountId: "ppf", csv, useFileAmounts: [3] };
    expect(store.getState().mergePpfCsv(command(store, input))).toEqual({ added: 1, corrected: 1, status: "applied" });
    expect(store.getState().ppfLedgerEntries.find((entry) => entry.id === "typed-dec")).toMatchObject({ amount: 25_000 });
  });

  test("importing the same file again changes nothing", () => {
    const { store } = seeded();
    store.getState().mergePpfCsv(command(store));
    const after = store.getState();
    expect(store.getState().mergePpfCsv(command(store))).toEqual({ status: "alreadyApplied" });
    expect(store.getState()).toBe(after);
  });

  test("a preview made before the account changed is refused, changing nothing", () => {
    const { storage, store } = seeded();
    const stale = command(store);
    store.getState().addPpfLedgerEntry({
      accountId: "ppf", amount: 1000, date: "2025-01-10", id: "typed-later", recordedAt: "2026-06-02T00:00:00.000Z", type: "contribution",
    });
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    expect(store.getState().mergePpfCsv(stale)).toEqual({ reason: "This account changed. Review the file again before saving.", status: "rejected" });
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
  });

  test("repeated identical rows need confirmation that they are separate deposits", () => {
    const { store } = seeded();
    const input = { accountId: "ppf", csv: "date,type,amount\n2025-01-15,deposit,500\n2025-01-15,deposit,500\n" };
    expect(store.getState().mergePpfCsv(command(store, input)).status).toBe("rejected");
    expect(store.getState().mergePpfCsv(command(store, input, true))).toEqual({ added: 2, corrected: 0, status: "applied" });
  });

  test("a file with errors saves nothing", () => {
    const { store } = seeded();
    const before = store.getState();
    const input = { accountId: "ppf", csv: "date,type,amount\n31/02/2025,deposit,500\n" };
    expect(store.getState().mergePpfCsv(command(store, input)).status).toBe("rejected");
    expect(store.getState()).toBe(before);
  });

  test("a failed save keeps live state, disk and restart unchanged; a retry saves", () => {
    const { storage, store } = seeded();
    const before = store.getState();
    const raw = storage.getRawItem(portfolioStorageKey);
    const write = storage.setItem;
    storage.setItem = () => { throw new Error("Storage full"); };
    expect(() => store.getState().mergePpfCsv(command(store))).toThrow("Storage full");
    expect(store.getState()).toBe(before);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    storage.setItem = write;
    expect(store.getState().mergePpfCsv(command(store)).status).toBe("applied");
    expect(createPortfolioStore({ now, storage }).getState().ppfLedgerEntries).toHaveLength(3);
  });

  test("an entry linked to Cash is never changed, even if the file differs", () => {
    const storage = createMemoryJsonStorage();
    const store = createPortfolioStore({ now, storage });
    store.getState().addPpfAccount(account);
    store.getState().addCashEntry({ amount: 100_000, date: "2024-04-02", id: "cash-in", label: "Deposit", purpose: "capitalContribution", type: "addition" });
    const linked = { accountId: "ppf", amount: 20_000, date: "2024-12-05", fundingSource: "cash" as const, id: "cash-dec", recordedAt: "2026-06-01T00:00:00.000Z", type: "contribution" as const };
    expect(store.getState().addPpfLedgerEntry(linked)).toMatchObject({ status: "applied" });
    const entry = store.getState().ppfLedgerEntries.find((item) => item.id === "cash-dec");
    const input = { accountId: "ppf", csv: "date,type,amount\n2024-12-05,deposit,25000\n", useFileAmounts: [2] };
    expect(store.getState().mergePpfCsv(command(store, input))).toEqual({ status: "alreadyApplied" });
    expect(store.getState().ppfLedgerEntries.find((item) => item.id === "cash-dec")).toBe(entry);
  });
});

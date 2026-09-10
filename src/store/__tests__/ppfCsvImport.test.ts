import { createHash } from "node:crypto";

import { createPortfolioBackup, parsePortfolioBackup } from "@/src/domain/portfolioBackup";
import { planPpfCsvImport, type PpfCsvImportInput } from "@/src/domain/ppfCsvImport";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import type { MonthlySnapshot, PpfAccount, PpfLedgerEntry } from "@/src/types";

const now = () => new Date("2026-09-11T12:00:00.000Z");
const primary: PpfAccount = {
  balanceAsOf: "2025-03-31",
  confirmedBalance: 10_000,
  createdAt: "2025-04-01T00:00:00.000Z",
  id: "ppf-primary",
  nickname: "Primary",
  opening: { financialYearStart: 2020, kind: "financialYear" },
  provider: "Synthetic provider",
  status: "active",
};
const secondary: PpfAccount = {
  ...primary,
  id: "ppf-secondary",
  nickname: "Secondary",
};

function input(overrides: Partial<PpfCsvImportInput> = {}): PpfCsvImportInput {
  return {
    accountId: primary.id,
    balanceAsOf: "2025-03-31",
    baselineFyContribution: 0,
    completeThrough: "2026-09-11",
    csv: "date,type,amount,note\n2025-04-02,contribution,500,Deposit\n2025-12-31,interest,100,Credit\n",
    openingBalance: 10_000,
    ...overrides,
  };
}

function command(store: ReturnType<typeof createPortfolioStore>, overrides: Partial<{
  confirmDuplicateRows: boolean;
  confirmReplacement: boolean;
  expectedState: string;
  input: PpfCsvImportInput;
}> = {}) {
  const state = store.getState();
  const plan = planPpfCsvImport(
    overrides.input ?? input(),
    state.ppfAccounts,
    state.ppfLedgerEntries,
    now(),
  );
  return {
    confirmDuplicateRows: false,
    confirmReplacement: false,
    expectedState: plan.expectedState,
    input: overrides.input ?? input(),
    ...overrides,
  };
}

function seededStore() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ now, storage });
  expect(store.getState().addPpfAccount(primary)).toMatchObject({ status: "applied" });
  return { storage, store };
}

describe("PPF CSV store import", () => {
  it("recognizes the same financial timeline after persistence validation and reload", () => {
    const { store, storage } = seededStore();
    expect(store.getState().importPpfCsv(command(store))).toEqual({ status: "applied" });
    const reloaded = createPortfolioStore({ now, storage });
    const before = structuredClone(reloaded.getState().ppfLedgerEntries);
    expect(reloaded.getState().importPpfCsv(command(reloaded))).toEqual({ status: "alreadyApplied" });
    expect(reloaded.getState().ppfLedgerEntries).toEqual(before);
  });
  it("rebuilds covered month-end values without inventing earlier history", () => {
    const { store } = seededStore();
    expect(store.getState().importPpfCsv(command(store))).toEqual({ status: "applied" });
    expect(store.getState().monthlySnapshots.find((snapshot) => snapshot.month === "2025-04"))
      .toMatchObject({ portfolioValue: 10500, debtValue: 10500 });
    expect(store.getState().monthlySnapshots.find((snapshot) => snapshot.month === "2025-12"))
      .toMatchObject({ portfolioValue: 10600, investedValue: 10500 });
    expect(store.getState().monthlySnapshots.find((snapshot) => snapshot.month === "2025-02")).toBeUndefined();
  });
  it("replaces only the selected baseline and prevents a duplicate full import from mutating IDs or timestamps", () => {
    const { store } = seededStore();
    const previous: PpfLedgerEntry = {
      accountId: primary.id,
      amount: 500,
      date: "2025-04-02",
      id: "manual-entry",
      recordedAt: "2025-04-02T09:00:00.000Z",
      type: "contribution",
    };
    expect(store.getState().addPpfLedgerEntry(previous)).toMatchObject({ status: "applied" });

    const preview = command(store);
    expect(store.getState().importPpfCsv(preview)).toMatchObject({
      reason: "Confirm replacement of this account's checkpoint and history.",
      status: "rejected",
    });
    expect(store.getState().ppfLedgerEntries).toEqual([previous]);

    expect(store.getState().importPpfCsv({ ...preview, confirmReplacement: true })).toEqual({ status: "applied" });
    const afterFirst = structuredClone({
      accounts: store.getState().ppfAccounts,
      entries: store.getState().ppfLedgerEntries,
      snapshots: store.getState().monthlySnapshots,
    });
    const appliedPlan = planPpfCsvImport(input(), afterFirst.accounts, afterFirst.entries, now());

    expect(appliedPlan.alreadyApplied).toBe(true);
    expect(store.getState().importPpfCsv({
      ...command(store),
      confirmReplacement: true,
    })).toEqual({ status: "alreadyApplied" });
    expect({
      accounts: store.getState().ppfAccounts,
      entries: store.getState().ppfLedgerEntries,
      snapshots: store.getState().monthlySnapshots,
    }).toEqual(afterFirst);
  });

  it("requires confirmation for repeated rows and preserves both rows after confirmation", () => {
    const { store } = seededStore();
    const repeatedInput = input({
      csv: "date,type,amount,note\n2025-04-02,contribution,500,Same\n2025-04-02,contribution,500,Same\n",
    });
    const preview = command(store, { input: repeatedInput });

    expect(store.getState().importPpfCsv(preview)).toMatchObject({
      reason: "Confirm that the repeated rows represent separate transactions.",
      status: "rejected",
    });
    expect(store.getState().importPpfCsv({ ...preview, confirmDuplicateRows: true })).toEqual({ status: "applied" });
    expect(store.getState().ppfLedgerEntries).toHaveLength(2);
  });

  it("rejects a changed CSV submitted with a preview token for different input", () => {
    const { store } = seededStore();
    const previewA = command(store);
    const inputB = input({
      csv: "date,type,amount,note\n2025-04-02,contribution,600,Changed amount\n",
    });
    const before = structuredClone({
      accounts: store.getState().ppfAccounts,
      entries: store.getState().ppfLedgerEntries,
      snapshots: store.getState().monthlySnapshots,
    });

    expect(store.getState().importPpfCsv({
      ...previewA,
      confirmReplacement: true,
      input: inputB,
    })).toEqual({
      reason: "This account changed. Generate a fresh preview before saving.",
      status: "rejected",
    });
    expect({
      accounts: store.getState().ppfAccounts,
      entries: store.getState().ppfLedgerEntries,
      snapshots: store.getState().monthlySnapshots,
    }).toEqual(before);
  });

  it("rejects stale previews, malformed closing checkpoints, dates, rows, and negative timelines atomically", () => {
    const { store } = seededStore();
    const stale = command(store);
    expect(store.getState().addPpfLedgerEntry({
      accountId: primary.id, amount: 500, date: "2025-04-02", id: "concurrent", recordedAt: "2025-04-02T10:00:00.000Z", type: "contribution",
    })).toMatchObject({ status: "applied" });
    const beforeStale = structuredClone(store.getState().ppfLedgerEntries);
    expect(store.getState().importPpfCsv(stale)).toMatchObject({
      reason: "This account changed. Generate a fresh preview before saving.",
      status: "rejected",
    });
    expect(store.getState().ppfLedgerEntries).toEqual(beforeStale);

    for (const invalid of [
      input({ expectedClosingBalance: 1 }),
      input({ csv: "date,type,amount,note\n2025-02-30,contribution,500,Bad\n" }),
      input({ csv: "date,type,amount,note\n2025-04-02,withdrawal,10001,Too much\n" }),
    ]) {
      const before = structuredClone({ accounts: store.getState().ppfAccounts, entries: store.getState().ppfLedgerEntries });
      expect(store.getState().importPpfCsv(command(store, { input: invalid }))).toMatchObject({ status: "rejected" });
      expect({ accounts: store.getState().ppfAccounts, entries: store.getState().ppfLedgerEntries }).toEqual(before);
    }
  });

  it("retains other accounts and manual snapshots when replacing one account history", () => {
    const { store } = seededStore();
    expect(store.getState().addPpfAccount(secondary)).toMatchObject({ status: "applied" });
    const otherEntry: PpfLedgerEntry = {
      accountId: secondary.id, amount: 750, date: "2025-04-02", id: "secondary-entry", recordedAt: "2025-04-02T10:00:00.000Z", type: "contribution",
    };
    expect(store.getState().addPpfLedgerEntry(otherEntry)).toMatchObject({ status: "applied" });
    const manualSnapshot: MonthlySnapshot = {
      cashValue: 0, cryptoValue: 0, debtValue: 0, equityValue: 0, id: "manual-snapshot", investedValue: 0, month: "2025-01", monthlyInvestment: 0, portfolioValue: 0,
    };
    store.getState().addMonthlySnapshot(manualSnapshot);

    expect(store.getState().importPpfCsv(command(store))).toEqual({ status: "applied" });
    expect(store.getState().ppfAccounts).toEqual(expect.arrayContaining([secondary]));
    expect(store.getState().ppfLedgerEntries).toEqual(expect.arrayContaining([otherEntry]));
    expect(store.getState().monthlySnapshots).toEqual(expect.arrayContaining([manualSnapshot]));
  });

  it("leaves memory unchanged when CSV replacement persistence fails", () => {
    const { storage, store: seeded } = seededStore();
    const failingStorage = {
      ...storage,
      setItem: () => { throw new Error("simulated PPF CSV persistence failure"); },
    };
    const store = createPortfolioStore({ now, storage: failingStorage });
    const before = structuredClone({
      accounts: store.getState().ppfAccounts,
      entries: store.getState().ppfLedgerEntries,
      snapshots: store.getState().monthlySnapshots,
    });

    expect(() => store.getState().importPpfCsv(command(store))).toThrow("simulated PPF CSV persistence failure");
    expect({
      accounts: store.getState().ppfAccounts,
      entries: store.getState().ppfLedgerEntries,
      snapshots: store.getState().monthlySnapshots,
    }).toEqual(before);
    expect(seeded.getState().ppfAccounts).toEqual(before.accounts);
  });

  it("remains compatible with the portable backup format after import", async () => {
    const { store } = seededStore();
    expect(store.getState().importPpfCsv(command(store))).toEqual({ status: "applied" });
    const captured = store.getState().captureBackup();
    const digest = async (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
    const backup = await createPortfolioBackup(
      captured.payload,
      { appVersion: "test", createdAt: "2026-09-11T12:00:00.000Z" },
      digest,
    );

    expect((await parsePortfolioBackup(backup, digest)).payload).toEqual(captured.payload);
  });
});

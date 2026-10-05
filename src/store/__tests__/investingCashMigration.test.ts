import { createHash } from "node:crypto";
import { migrateInvestingCashEntry, migrateInvestingSnapshot } from "@/src/domain/investingCashMigration";
import { calculateCashBalance } from "@/src/domain/calculations";
import { createPortfolioBackup, parsePortfolioBackup, validateBackupPayload } from "@/src/domain/portfolioBackup";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import { seedVisualQaPortfolio } from "@/src/testing/visualQaSeed";
import type { CashEntry, MonthlySnapshot } from "@/src/types";

const now = () => new Date("2026-09-30T10:00:00Z");
const digest = async (value: string) => createHash("sha256").update(value).digest("hex");
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
function fixture() {
  const storage = createMemoryJsonStorage();
  let store = createPortfolioStore({ storage, now });
  seedVisualQaPortfolio(store);
  store = createPortfolioStore({ storage, now });
  store.getState().addPpfAccount({ id: "ppf", provider: "India Post", nickname: "PPF", balanceAsOf: "2026-05-01", confirmedBalance: 1000, createdAt: "2026-05-01T10:00:00Z", opening: { kind: "financialYear", financialYearStart: 2025 }, status: "active" });
  store.getState().addPpfLedgerEntry({ id: "ppf-contribution", accountId: "ppf", type: "contribution", date: "2026-05-03", amount: 500, recordedAt: "2026-05-03T10:00:00Z" });
  store.getState().addCashEntry({ id: "legacy-unknown", amount: 200, date: "2026-05-03", label: "Unclassified", purpose: "legacyUncategorized", type: "addition" });
  store.getState().saveFuturesAccount({ id: "wallet", marginMode: "cross", positionMode: "one-way", settlementAsset: "USDT", openingAt: "2026-05-01T00:00:00Z", openingWalletUsdt: "0", events: [] });
  store.getState().saveFuturesCashTransfer({ accountId: "wallet", eventId: "funding", cashEntryId: "cash-funding", at: "2026-05-04T10:00:00Z", amountUsdt: "100", cashAmountInr: 9000, inrPerUsdt: "90", rateObservedAt: "2026-05-04T10:00:00Z", rateSource: "Synthetic receipt", conversionFeeInr: "0" });
  const expected = store.getState().captureBackup().payload;
  const legacy = JSON.parse(JSON.stringify(expected));
  legacy.portfolio.schemaVersion = 14;
  delete legacy.portfolio.epf;
  legacy.portfolio.cashEntries[0].purpose = "income";
  legacy.portfolio.cashEntries[0].notes = "Salary money I chose to invest";
  expected.portfolio.cashEntries[0].notes = legacy.portfolio.cashEntries[0].notes;
  legacy.portfolio.monthlySnapshots.forEach((snapshot: Record<string, unknown>, index: number) => {
    snapshot.salary = index === 0 ? 0 : 165000;
    snapshot.monthlyExpense = 50000;
  });
  return { storage, expected, legacy };
}

describe("investing-only Cash migration", () => {
  it("rejects retired fields at live write boundaries without changing memory or storage", () => {
    const { storage } = fixture();
    const store = createPortfolioStore({ storage, now });
    const before = storage.getRawItem(portfolioStorageKey);
    expect(() => store.getState().addCashEntry({ id: "retired", date: "2026-05-01", amount: 10, label: "Old API", purpose: "income", type: "addition" } as unknown as CashEntry)).toThrow(/retired/);
    expect(() => store.getState().addMonthlySnapshot({ ...store.getState().monthlySnapshots[0], id: "retired", salary: 100 } as MonthlySnapshot)).toThrow(/retired/);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(before);
  });
  it("persists once, preserves the complete graph and financial values, and restarts identically", () => {
    const { storage, expected, legacy } = fixture();
    storage.setRawItem(portfolioStorageKey, JSON.stringify(legacy.portfolio));
    const write = jest.spyOn(storage, "setItem");
    const upgraded = createPortfolioStore({ storage, now });
    expect(upgraded.getState().storageRecovery).toBeUndefined();
    expect(upgraded.getState().captureBackup().payload).toEqual(expected);
    expect(write.mock.calls.filter(([key]) => key === portfolioStorageKey)).toHaveLength(1);
    const raw = storage.getRawItem(portfolioStorageKey);
    const restarted = createPortfolioStore({ storage, now });
    expect(restarted.getState().captureBackup().payload).toEqual(expected);
    expect(storage.getRawItem(portfolioStorageKey)).toBe(raw);
    expect(write.mock.calls.filter(([key]) => key === portfolioStorageKey)).toHaveLength(1);
    expect(calculateCashBalance(upgraded.getState().cashEntries, now())).toBe(calculateCashBalance(expected.portfolio.cashEntries, now()));
  });

  it("keeps the original recoverable and blocks writes if migration persistence fails", () => {
    const { storage, legacy } = fixture();
    const original = JSON.stringify(legacy.portfolio);
    storage.setRawItem(portfolioStorageKey, original);
    const write = storage.setItem;
    storage.setItem = (key, value) => { if (key === portfolioStorageKey) throw new Error("Disk full"); write(key, value); };
    const blocked = createPortfolioStore({ storage, now });
    expect(blocked.getState().storageRecovery).toBeDefined();
    expect(storage.getRawItem(portfolioStorageKey)).toBe(original);
    expect(() => blocked.getState().captureBackup()).toThrow(/recovery/);
    expect(() => blocked.getState().addCashEntry({ id: "blocked", date: "2026-05-01", amount: 10, label: "Blocked", purpose: "capitalContribution", type: "addition" })).toThrow();
    storage.setItem = write;
    expect(createPortfolioStore({ storage, now }).getState().cashEntries[0].purpose).toBe("capitalContribution");
  });

  it.each([9, 10, 11, 12, 13, 14])("verifies original V%s bytes, then migrates and restores without changing anything else", async (version) => {
    const { legacy, expected } = fixture();
    if (version < 14) {
      legacy.portfolio.futuresAccounts = undefined;
      legacy.portfolio.cashEntries = legacy.portfolio.cashEntries.filter((entry: { purpose: string }) => entry.purpose !== "futuresTransfer");
      expected.portfolio.futuresAccounts = [];
      expected.portfolio.cashEntries = expected.portfolio.cashEntries.filter((entry) => entry.purpose !== "futuresTransfer");
    }
    legacy.portfolio.schemaVersion = version;
    const body = JSON.parse(JSON.stringify({ format: "cogvest-portfolio-backup", formatVersion: 1, appVersion: "1.0.10", createdAt: now().toISOString(), payload: legacy }));
    const envelope = { ...body, checksum: await digest(canonical(body)) };
    const parsed = await parsePortfolioBackup(JSON.stringify(envelope), digest);
    expect(parsed.payload).toEqual(expected);
    const destination = createPortfolioStore({ storage: createMemoryJsonStorage(), now });
    destination.getState().replaceFromBackup(parsed.payload, destination.getState().getBackupRevision());
    expect(destination.getState().captureBackup().payload).toEqual(expected);
    const exported = JSON.parse(await createPortfolioBackup(parsed.payload, { appVersion: "1.0.10", createdAt: now().toISOString() }, digest));
    expect(exported.payload).toEqual(expected);
    envelope.payload.portfolio.cashEntries[0].amount += 1;
    await expect(parsePortfolioBackup(JSON.stringify(envelope), digest)).rejects.toThrow(/checksum/);
  });

  it("rejects invalid legacy fields and current-schema retired fields", () => {
    const { legacy } = fixture();
    legacy.portfolio.monthlySnapshots[0].salary = -1;
    expect(() => validateBackupPayload(legacy)).toThrow();
    legacy.portfolio.monthlySnapshots[0].salary = 100;
    legacy.portfolio.cashEntries[0].type = "withdrawal";
    expect(() => validateBackupPayload(legacy)).toThrow();
    legacy.portfolio.cashEntries[0].type = "addition";
    delete legacy.portfolio.cashEntries[0].purpose;
    expect(() => validateBackupPayload(legacy)).toThrow(/purpose/);
    legacy.portfolio.cashEntries[0].purpose = "income";
    legacy.portfolio.schemaVersion = 15;
    expect(() => validateBackupPayload(legacy)).toThrow();
  });

  it("does not classify ambiguous Cash or alter linked entries and is idempotent", () => {
    const { legacy } = fixture();
    for (const entry of legacy.portfolio.cashEntries) {
      const migrated = migrateInvestingCashEntry(entry);
      expect(migrateInvestingCashEntry(migrated)).toEqual(migrated);
      expect(migrated).toEqual({ ...entry, purpose: entry.purpose === "income" ? "capitalContribution" : entry.purpose });
    }
    for (const snapshot of legacy.portfolio.monthlySnapshots) {
      const { salary: _salary, monthlyExpense: _expense, ...expected } = snapshot;
      expect(migrateInvestingSnapshot(snapshot)).toEqual(expected);
      expect(migrateInvestingSnapshot(expected)).toEqual(expected);
    }
  });
});

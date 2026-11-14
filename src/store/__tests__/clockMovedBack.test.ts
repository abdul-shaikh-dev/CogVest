import { createPortfolioStore } from "@/src/store";
import { createMemoryJsonStorage } from "@/src/services/storage";
import type { EpfAccount, EpfEvent } from "@/src/domain/epf";
import { getRecordValidationReference } from "@/src/domain/recordValidationReference";

// Midday UTC keeps the calendar date the same in IST and UTC test runs.
const savedOn = new Date("2026-10-05T06:00:00Z");
const clockMovedBack = new Date("2026-10-04T06:00:00Z");

const epfAccount: EpfAccount = {
  id: "epf", nickname: "EPF", provider: "epfo", status: "active", currency: "INR",
  checkpoint: { date: "2026-10-01", balance: { total: 140000, components: { employee: 100000, employer: 40000 } },
    capital: null, source: "epfoStatement", recordedAt: "2026-10-01T06:00:00Z" },
  historyCompleteThrough: null,
};
const epfWithdrawal: EpfEvent = { id: "withdrawal", type: "withdrawal", accountId: "epf",
  effectiveDate: "2026-10-05", postedDate: "2026-10-05", recordedAt: "2026-10-05T06:00:00Z",
  evidence: "Statement", amount: { total: 5000, components: { employee: 5000, employer: 0 } },
  capitalReduction: null, destination: "unknown" };

/** Saves PPF and EPF records dated "today" (5 October 2026). */
function portfolioSavedToday() {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage, now: () => savedOn });
  store.getState().addPpfAccount({
    id: "ppf", nickname: "PPF", provider: "India Post", balanceAsOf: "2026-10-01", confirmedBalance: 100000,
    createdAt: "2026-10-01T06:00:00Z", opening: { kind: "financialYear", financialYearStart: 2020 }, status: "active",
  });
  store.getState().addPpfLedgerEntry({
    id: "ppf-contribution", accountId: "ppf", type: "contribution", date: "2026-10-05", amount: 500,
    recordedAt: "2026-10-05T06:00:00Z",
  });
  const apply = (change: Parameters<ReturnType<typeof store.getState>["applyEpfCommand"]>[0]["change"], id: string) =>
    store.getState().applyEpfCommand({ commandId: id, reason: "Confirmed evidence", change }, store.getState().getBackupRevision());
  apply({ type: "accountPut", account: epfAccount }, "epf-account");
  apply({ type: "eventPut", event: epfWithdrawal, cash: null }, "epf-withdrawal");
  return { storage, store };
}

describe("records dated after the device's today (#646)", () => {
  afterEach(() => jest.useRealTimers());

  it("still opens the portfolio after the clock moves back a day", () => {
    const { storage, store } = portfolioSavedToday();
    const expected = store.getState().captureBackup().payload.portfolio;
    jest.useFakeTimers({ now: clockMovedBack });

    const reopened = createPortfolioStore({ storage, now: () => clockMovedBack });

    expect(reopened.getState().storageRecovery).toBeUndefined();
    expect(reopened.getState().captureBackup().payload.portfolio).toEqual(expected);
    expect(reopened.getState().ppfLedgerEntries.map((entry) => entry.date)).toEqual(["2026-10-05"]);
    expect(reopened.getState().epf.events.map((event) => event.effectiveDate)).toEqual(["2026-10-05"]);
  });

  it("still saves unrelated records after the clock moves back", () => {
    const { storage } = portfolioSavedToday();
    jest.useFakeTimers({ now: clockMovedBack });
    const reopened = createPortfolioStore({ storage, now: () => clockMovedBack });

    reopened.getState().addCashEntry({
      id: "cash-1", amount: 1000, date: "2026-10-04", label: "Broker cash", purpose: "capitalContribution", type: "addition",
    });

    expect(reopened.getState().cashEntries.map((entry) => entry.id)).toContain("cash-1");
    expect(createPortfolioStore({ storage, now: () => clockMovedBack }).getState().cashEntries.map((entry) => entry.id))
      .toContain("cash-1");
  });

  it("restores a backup whose records are dated after the device's today", () => {
    const { store } = portfolioSavedToday();
    const backup = store.getState().captureBackup().payload;
    jest.useFakeTimers({ now: clockMovedBack });
    const target = createPortfolioStore({ storage: createMemoryJsonStorage(), now: () => clockMovedBack });

    target.getState().replaceFromBackup(backup, target.getState().getBackupRevision());

    expect(target.getState().captureBackup().payload.portfolio).toEqual(backup.portfolio);
  });

  it("still rejects a new PPF entry dated after today", () => {
    const { storage } = portfolioSavedToday();
    jest.useFakeTimers({ now: clockMovedBack });
    const reopened = createPortfolioStore({ storage, now: () => clockMovedBack });

    expect(reopened.getState().addPpfLedgerEntry({
      id: "ppf-future", accountId: "ppf", type: "contribution", date: "2026-10-06", amount: 500,
      recordedAt: "2026-10-04T06:00:00Z",
    })).toMatchObject({ status: "rejected" });
    expect(reopened.getState().ppfLedgerEntries.map((entry) => entry.id)).toEqual(["ppf-contribution"]);
  });
});

describe("getRecordValidationReference", () => {
  it("uses the device's today when every saved date is earlier", () => {
    expect(getRecordValidationReference(
      { ppfLedgerEntries: [{ date: "2026-10-01" }] },
      new Date("2026-10-04T06:00:00Z"),
    ).today).toBe("2026-10-04");
  });

  it("uses the latest saved PPF or EPF date when it is after the device's today", () => {
    const reference = getRecordValidationReference(
      {
        epf: { accounts: [epfAccount], events: [{ ...epfWithdrawal, postedDate: "2026-10-07" }], cashLinks: [], audit: [] },
        ppfAccounts: [{ balanceAsOf: "2026-10-06", opening: { kind: "date", openedOn: "2020-04-01" } }],
        ppfLedgerEntries: [{ date: "2026-10-05" }],
      },
      new Date("2026-10-04T06:00:00Z"),
    );
    expect(reference.today).toBe("2026-10-07");
    expect(reference.now.getDate()).toBe(7);
  });

  it("ignores malformed dates and malformed EPF state", () => {
    expect(getRecordValidationReference(
      { epf: { accounts: "bad" }, ppfLedgerEntries: [{ date: "2099-99-99" }, { date: 42 }, null] },
      new Date("2026-10-04T06:00:00Z"),
    ).today).toBe("2026-10-04");
  });
});

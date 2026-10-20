import {
  buildEpfAccount,
  buildEpfBalanceUpdate,
  draftFromEpfAccount,
  draftTotal,
  emptyEpfAccountDraft,
  parseInrAmount,
} from "../epfAccountForm";
import type { EpfAccount } from "@/src/domain/epf";

const now = new Date("2026-10-17T10:00:00Z");
const draft = { ...emptyEpfAccountDraft(now), nickname: "Acme EPF", employee: "100000", employer: "40000", date: "2026-03-31" };

test("parses exact rupee amounts without inventing or rounding paise", () => {
  expect(parseInrAmount("1,00,000.5")).toBe(100000.5);
  expect(parseInrAmount("0")).toBe(0);
  for (const bad of ["", "-1", "1.234", "abc", "1e5", "  "]) expect(parseInrAmount(bad)).toBeNull();
  expect(draftTotal({ employee: "100000", employer: "40000" })).toBe(140000);
  expect(draftTotal({ employee: "100000", employer: "" })).toBeNull();
});

test("builds a snapshot-only account from statement balances with unknown capital", () => {
  const result = buildEpfAccount({ ...draft, employerLabel: "  Acme Ltd  " }, { id: "epf-1", now });
  expect(result).toEqual({ ok: true, account: {
    id: "epf-1", nickname: "Acme EPF", provider: "epfo", employerLabel: "Acme Ltd", status: "active", currency: "INR",
    checkpoint: { date: "2026-03-31", balance: { total: 140000, components: { employee: 100000, employer: 40000 } },
      capital: null, source: "epfoStatement", recordedAt: now.toISOString() },
    historyCompleteThrough: null,
  } });
  const trust = buildEpfAccount({ ...draft, provider: "employerTrust" }, { id: "t", now });
  expect(trust.ok && trust.account.checkpoint.source).toBe("trustStatement");
  const own = buildEpfAccount({ ...draft, evidence: "ownRecord" }, { id: "o", now });
  expect(own.ok && own.account.checkpoint.source).toBe("userConfirmed");
});

test("zero balances are valid; missing, negative, future and oversized input is field-specific", () => {
  expect(buildEpfAccount({ ...draft, employee: "0", employer: "0" }, { id: "z", now }).ok).toBe(true);
  const result = buildEpfAccount({ ...draft, nickname: " ", employee: "-5", employer: "", date: "2026-12-01" }, { id: "x", now });
  expect(result.ok).toBe(false);
  expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["date", "employee", "employer", "nickname"]);
  const long = buildEpfAccount({ ...draft, nickname: "x".repeat(61) }, { id: "x", now });
  expect(!long.ok && long.errors.nickname).toMatch(/60/);
});

test("editing keeps identity, legacy link, provenance time and unknown capital unless the checkpoint changes", () => {
  const created = buildEpfAccount(draft, { id: "epf-1", now: new Date("2026-04-01T00:00:00Z") });
  if (!created.ok) throw new Error("setup");
  const existing: EpfAccount = { ...created.account, legacyAssetId: "old", historyCompleteThrough: "2026-06-30" };
  const renamed = buildEpfAccount({ ...draftFromEpfAccount(existing), nickname: "Acme" }, { existing, id: "ignored", now });
  expect(renamed.ok && renamed.account).toMatchObject({ id: "epf-1", nickname: "Acme", legacyAssetId: "old",
    historyCompleteThrough: "2026-06-30", checkpoint: { recordedAt: "2026-04-01T00:00:00.000Z", capital: null } });
  const moved = buildEpfAccount({ ...draftFromEpfAccount(existing), date: "2026-08-31" }, { existing, id: "ignored", now });
  expect(moved.ok && moved.account).toMatchObject({ historyCompleteThrough: null, checkpoint: { recordedAt: now.toISOString() } });
});

test("an account started from ₹0 has known capital until its balance is edited above zero", () => {
  const fresh = buildEpfAccount({ ...draft, employee: "0", employer: "0" }, { id: "z", now });
  expect(fresh.ok && fresh.account.checkpoint.capital).toBe(0);
  if (!fresh.ok) throw new Error("setup");
  const renamed = buildEpfAccount({ ...draftFromEpfAccount(fresh.account), nickname: "New job" }, { existing: fresh.account, id: "z", now });
  expect(renamed.ok && renamed.account.checkpoint.capital).toBe(0);
  const funded = buildEpfAccount({ ...draftFromEpfAccount(fresh.account), employee: "5000" }, { existing: fresh.account, id: "z", now });
  expect(funded.ok && funded.account.checkpoint.capital).toBeNull();
});

test("a total-only legacy checkpoint is not split by a guessed ratio", () => {
  const created = buildEpfAccount(draft, { id: "a", now });
  if (!created.ok) throw new Error("setup");
  const totalOnly: EpfAccount = { ...created.account, checkpoint: { ...created.account.checkpoint, balance: { total: 140000, components: null } } };
  expect(draftFromEpfAccount(totalOnly)).toMatchObject({ employee: "", employer: "" });
});

describe("balance update", () => {
  const created = buildEpfAccount(draft, { id: "a", now });
  if (!created.ok) throw new Error("setup");
  const account = created.account;
  const context = { account, accounts: [account], events: [], id: "r1", now, evidence: "statement" as const };

  test("records an explained reconciliation with prior, new and difference", () => {
    const result = buildEpfBalanceUpdate({ employee: "104000", employer: "41567", date: "2026-09-30", reason: "Annual statement" }, context);
    expect(result).toEqual({ ok: true, update: {
      previousTotal: 140000, newTotal: 145567, difference: 5567,
      event: { id: "r1", type: "reconciliation", accountId: "a", effectiveDate: "2026-09-30", postedDate: "2026-09-30",
        recordedAt: now.toISOString(), evidence: "EPFO passbook", reason: "Annual statement", capital: null,
        balance: { total: 145567, components: { employee: 104000, employer: 41567 } } },
    } });
  });

  test("a lower balance is a negative difference, not a withdrawal", () => {
    const result = buildEpfBalanceUpdate({ employee: "90000", employer: "40000", date: "2026-09-30", reason: "Correction" }, context);
    expect(result.ok && result.update.difference).toBe(-10000);
  });

  test("requires a reason and a date after the starting balance", () => {
    const result = buildEpfBalanceUpdate({ employee: "1", employer: "1", date: "2026-03-31", reason: " " }, context);
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["date", "reason"]);
    expect(!result.ok && result.errors.date).toMatch(/after the starting balance \(31 Mar 2026\)/);
  });
});

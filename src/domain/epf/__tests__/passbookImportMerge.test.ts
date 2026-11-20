import { calculateEpfLedger, type EpfAccount, type EpfEvent, type EpfLedger } from "@/src/domain/epf";
import { readEpfoPassbook } from "@/src/domain/epf/passbook";
import { planPassbookImport, type PassbookImportAccount } from "@/src/domain/epf/passbookImport";
import { mergePassbookImport, type PassbookBatchItem } from "@/src/domain/epf/passbookImportMerge";
import { layoutBRows, NEW_MEMBER_ID, OLD_MEMBER_ID, passbookChain, passbookText } from "@/src/testing/epfPassbookFixture";

const today = "2025-08-20";
const assignment: PassbookImportAccount[] = [
  { memberId: OLD_MEMBER_ID, id: "old", nickname: "First job" },
  { memberId: NEW_MEMBER_ID, id: "new", nickname: "Second job" },
];
function planFor(texts: string[], at = "2025-08-20T10:00:00Z", accounts = assignment) {
  const passbooks = texts.map((text) => {
    const result = readEpfoPassbook(text);
    if (!result.ok) throw new Error(result.message);
    return result.passbook;
  });
  const used = accounts.filter((item) => passbooks.some((passbook) => passbook.memberId === item.memberId));
  const result = planPassbookImport(passbooks, used, { now: new Date(at), today });
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.plan;
}
function apply(ledger: EpfLedger, changes: readonly PassbookBatchItem[]): EpfLedger {
  const accounts = new Map(ledger.accounts.map((item) => [item.id, item]));
  const events = new Map(ledger.events.map((item) => [item.id, item]));
  for (const change of changes) {
    if (change.type === "accountPut") accounts.set(change.account.id, change.account);
    else if (change.type === "eventPut") events.set(change.event.id, change.event);
    else events.delete(change.id);
  }
  return { accounts: [...accounts.values()], events: [...events.values()] };
}
function merge(ledger: EpfLedger, texts: string[], at?: string) {
  const result = mergePassbookImport(ledger, planFor(texts, at), today);
  if (!result.ok) throw new Error(result.conflicts.join(" "));
  return { ...result, ledger: apply(ledger, result.changes) };
}
const total = (ledger: EpfLedger) => {
  const result = calculateEpfLedger(ledger, today, today);
  if (!result.ok) throw new Error(result.errors.join(" "));
  return { total: result.total, inTransit: result.inTransit };
};
const empty: EpfLedger = { accounts: [], events: [] };
const all = [passbookChain.oldFirstYear, passbookChain.oldClaimYear, passbookChain.newFirstYear];

describe("merging a passbook import into saved EPF records (#740)", () => {
  test("a first import adds everything; importing the same files again changes nothing", () => {
    const first = merge(empty, all);
    expect(first.accountsAdded).toEqual(["old", "new"]);
    expect(first.records.every((record) => record.kind === "added")).toBe(true);
    expect(total(first.ledger)).toEqual({ total: 35560, inTransit: 0 });
    const again = merge(first.ledger, all, "2025-09-01T10:00:00Z");
    expect(again.changes).toEqual([]);
  });

  test("a closed year replaces the in-progress year imported before, after showing the difference", () => {
    const openYear = passbookText({ memberId: NEW_MEMBER_ID, year: 2023, opening: "27,180 8,380 2,000", printed: "15-08-2023",
      rows: [...layoutBRows("2023-03"), ...layoutBRows("2023-04")],
      totals: ["2,880 880 2,000", "0 0 0", "0 0 0"], interest: "0 0 0", closing: "30,060 9,260 4,000" });
    const closedYear = passbookText({ memberId: NEW_MEMBER_ID, year: 2023, opening: "27,180 8,380 2,000",
      rows: [...layoutBRows("2023-03"), ...layoutBRows("2023-04")],
      totals: ["2,880 880 2,000", "0 0 0", "0 0 0"], interest: "2,000 600 0", closing: "32,060 9,860 4,000" });
    const first = merge(empty, [...all, openYear]);
    const refreshed = merge(first.ledger, [...all, closedYear]);
    expect(refreshed.records).toEqual([expect.objectContaining({ kind: "updated",
      before: expect.objectContaining({ id: "epf-import-new-fy2023-summary", closing: null, effectiveDate: "2023-05-01" }),
      event: expect.objectContaining({ id: "epf-import-new-fy2023-summary", effectiveDate: "2024-03-31",
        interest: { employee: 2000, employer: 600 }, closing: { employee: 32060, employer: 9860 } }) })]);
    expect(total(refreshed.ledger).total).toBe(41920);
  });

  test("credits first imported as from an untracked account become one claim transfer once the old account is imported", () => {
    const newOnly = merge(empty, [passbookChain.newFirstYear]);
    expect(newOnly.ledger.events.filter((event) => event.type === "externalTransferIn")).toHaveLength(2);
    const both = merge(newOnly.ledger, all);
    expect(both.records.filter((record) => record.kind === "removed").map((record) => record.kind === "removed" && record.before.type))
      .toEqual(["externalTransferIn", "externalTransferIn"]);
    expect(both.ledger.events.filter((event) => event.type === "claimTransfer")).toHaveLength(1);
    expect(total(both.ledger)).toEqual({ total: 35560, inTransit: 0 });
  });

  test("an account made by hand with a later starting balance and no entries starts from the passbook instead", () => {
    const manual: EpfAccount = { id: "old", nickname: "First job", provider: "epfo", status: "active", currency: "INR",
      checkpoint: { date: "2022-03-31", balance: { total: 23210, components: null }, capital: null, source: "userConfirmed",
        recordedAt: "2025-01-01T00:00:00Z" }, historyCompleteThrough: null };
    const result = merge({ accounts: [manual], events: [] }, all);
    expect(result.startingBalancesMoved).toEqual(["old"]);
    expect(result.ledger.accounts.find((item) => item.id === "old")).toMatchObject({ nickname: "First job",
      status: "transferred", checkpoint: { date: "2021-03-31", source: "epfoStatement", capital: 0 } });
  });

  test("never overwrites entries recorded by hand, and blocks a passbook that doesn't follow the recorded balance", () => {
    const manual: EpfAccount = { id: "old", nickname: "First job", provider: "epfo", status: "active", currency: "INR",
      checkpoint: { date: "2022-03-31", balance: { total: 23210, components: null }, capital: null, source: "userConfirmed",
        recordedAt: "2025-01-01T00:00:00Z" }, historyCompleteThrough: null };
    const handEntry: EpfEvent = { id: "hand", type: "interest", accountId: "old", effectiveDate: "2022-04-30", postedDate: "2022-04-30",
      recordedAt: "2025-01-01T00:00:00Z", evidence: "Own record", amount: { total: 10, components: null } };
    expect(mergePassbookImport({ accounts: [manual], events: [handEntry] }, planFor(all), today)).toEqual({ ok: false,
      conflicts: [expect.stringContaining("First job already has entries recorded by hand")] });

    const earlier: EpfAccount = { ...manual, checkpoint: { ...manual.checkpoint, date: "2021-03-31", balance: { total: 100, components: null } } };
    expect(mergePassbookImport({ accounts: [earlier], events: [] }, planFor([passbookChain.oldClaimYear]), today)).toEqual({ ok: false,
      conflicts: [expect.stringContaining("opens with a different balance than CogVest has recorded")] });
  });
});

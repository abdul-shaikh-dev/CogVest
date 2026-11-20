import { calculateEpfLedger, type EpfEvent } from "@/src/domain/epf";
import { buildEpfMonthlyHistory } from "@/src/domain/epf/history";
import { readEpfoPassbook, type EpfoPassbook } from "@/src/domain/epf/passbook";
import { planPassbookImport, type PassbookImportAccount } from "@/src/domain/epf/passbookImport";
import { layoutBRows, NEW_MEMBER_ID, OLD_MEMBER_ID, passbookChain, passbookText } from "@/src/testing/epfPassbookFixture";

const now = new Date("2025-08-20T10:00:00Z");
const today = "2025-08-20";
const read = (text: string): EpfoPassbook => {
  const result = readEpfoPassbook(text);
  if (!result.ok) throw new Error(result.message);
  return result.passbook;
};
const assignment: PassbookImportAccount[] = [
  { memberId: OLD_MEMBER_ID, id: "old", nickname: "First job" },
  { memberId: NEW_MEMBER_ID, id: "new", nickname: "Second job" },
];
const plan = (texts: string[], accounts = assignment) => planPassbookImport(texts.map(read), accounts, { now, today });
const ok = (texts: string[]) => {
  const result = plan(texts);
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.plan;
};
const value = (events: EpfEvent[], accounts: ReturnType<typeof ok>["accounts"], asOf: string) => {
  const result = calculateEpfLedger({ accounts, events }, asOf, today);
  if (!result.ok) throw new Error(result.errors.join(" "));
  return { total: result.total, inTransit: result.inTransit, capital: result.capital,
    byAccount: Object.fromEntries(result.accounts.map((item) => [item.accountId, item.balance.total])) };
};
const all = [passbookChain.newFirstYear, passbookChain.oldClaimYear, passbookChain.oldFirstYear];

describe("planning an EPFO passbook import (#740)", () => {
  test("a whole history becomes one summary per year and one claim transfer, matching every passbook", () => {
    const result = ok(all);
    expect(result.accounts.map((item) => [item.id, item.status, item.checkpoint.date, item.checkpoint.capital]))
      .toEqual([["old", "transferred", "2021-03-31", 0], ["new", "active", "2022-03-31", 0]]);
    expect(result.events.map((event) => event.id).sort()).toEqual([
      "epf-import-new-fy2022-summary",
      "epf-import-old-fy2021-summary",
      "epf-import-old-fy2022-c1-employee", "epf-import-old-fy2022-c1-employer",
      "epf-import-old-fy2022-c2-employee", "epf-import-old-fy2022-c2-employer",
      "epf-import-old-fy2022-c3-employee", "epf-import-old-fy2022-c3-employer",
      "epf-import-old-fy2022-c4-employee", "epf-import-old-fy2022-c4-employer",
      "epf-import-old-fy2022-claim",
    ]);
    expect(result.events.find((event) => event.type === "claimTransfer")).toMatchObject({
      sourceId: "old", destinationId: "new", effectiveDate: "2022-09-05", status: "completed",
      payout: { total: 31400 }, interest: { total: 670, components: { employee: 460, employer: 210 } },
      credits: [{ date: "2022-08-10", amount: { total: 30730 } }, { date: "2023-01-20", amount: { total: 670 } }],
    });
    expect(result.years.map((item) => [item.accountId, item.year, item.status]))
      .toEqual([["old", 2021, "imported"], ["old", 2022, "imported"], ["new", 2022, "imported"]]);
    expect(result.excludedPension).toEqual([{ accountId: "old", amount: 16000 }, { accountId: "new", amount: 2000 }]);
    expect(result.warnings).toEqual([]);

    // The final balances are the passbooks' closing balances, and capital is known throughout.
    expect(value(result.events, result.accounts, today)).toEqual({ total: 35560, inTransit: 0, capital: 33840,
      byAccount: { old: 0, new: 35560 } });
  });

  test("the move between member IDs is counted once in every month, with the claim interest as return", () => {
    const result = ok(all);
    expect(value(result.events, result.accounts, "2022-08-31")).toMatchObject({ total: 30730, inTransit: 0, byAccount: { old: 0, new: 30730 } });
    expect(value(result.events, result.accounts, "2022-12-31")).toMatchObject({ total: 31400, inTransit: 670 });
    const history = buildEpfMonthlyHistory({ accounts: result.accounts, events: result.events, cashLinks: [], audit: [] }, today);
    if (!history.ok) throw new Error(history.errors.join(" "));
    expect(history.months.find((item) => item.month === "2022-09")?.flows.interest).toBe(670);
  });

  test("a claim without the new account's passbook is a settlement whose destination stays unknown", () => {
    const result = ok([passbookChain.oldFirstYear, passbookChain.oldClaimYear]);
    expect(result.events.find((event) => event.type === "withdrawal")).toMatchObject({ destination: "unknown",
      amount: { total: 31400 }, settlement: { interest: { total: 670 } } });
    expect(result.warnings).toEqual([expect.stringContaining("First job: the final claim isn't matched")]);
  });

  test("credits from a member ID that wasn't imported are external transfer-ins with unknown capital", () => {
    const result = ok([passbookChain.newFirstYear]);
    expect(result.events.filter((event) => event.type === "externalTransferIn")).toEqual([
      expect.objectContaining({ effectiveDate: "2022-08-10", capital: null }),
      expect.objectContaining({ effectiveDate: "2023-01-20", capital: null }),
    ]);
    expect(value(result.events, result.accounts, today)).toMatchObject({ total: 35560, capital: null });
  });

  test("the year still open when printed imports its contributions so far, without interest or a closing", () => {
    const open = passbookText({ memberId: NEW_MEMBER_ID, year: 2023, opening: "27,180 8,380 2,000", printed: "15-08-2023",
      rows: [...layoutBRows("2023-03"), ...layoutBRows("2023-04")],
      totals: ["2,880 880 2,000", "0 0 0", "0 0 0"], interest: "0 0 0", closing: "30,060 9,260 4,000" });
    const result = ok([...all, open]);
    expect(result.events.find((event) => event.id === "epf-import-new-fy2023-summary")).toMatchObject({
      type: "yearSummary", periodStart: "2023-04-01", effectiveDate: "2023-05-01", closing: null, interest: { employee: 0, employer: 0 } });
    expect(result.years.at(-1)).toMatchObject({ accountId: "new", year: 2023, status: "inProgress" });
    expect(result.warnings).toEqual([expect.stringContaining("FY 2023-24 is still in progress")]);
  });

  test("a gap or a broken chain blocks that year and every later one for the account", () => {
    const gapped = passbookText({ year: 2023, opening: "0 0 16,000", rows: [], totals: ["0 0 0", "0 0 0", "0 0 0"],
      interest: "0 0 0", closing: "0 0 16,000" });
    const chainBroken = ok([passbookChain.oldFirstYear, passbookChain.oldClaimYear.replace("17,780 5,430 12,000", "17,781 5,430 12,000")
      .replace("24,000 7,400 0\nInt.", "24,001 7,400 0\nInt.").replace("DR Claim 0 0 24,000", "DR Claim 0 0 24,001")]);
    expect(chainBroken.years.find((item) => item.year === 2022)).toMatchObject({ status: "blocked",
      message: "FY 2022-23 opens with a different balance than the previous year closed with." });
    const afterClaim = ok([passbookChain.oldFirstYear, passbookChain.oldClaimYear, gapped]);
    expect(afterClaim.years.find((item) => item.year === 2023)).toMatchObject({ status: "blocked",
      message: expect.stringContaining("closed by its final claim") });
  });

  test("refuses to plan without an account for each member ID, or with two different passbooks for one year", () => {
    expect(plan(all, assignment.slice(0, 1))).toEqual({ ok: false, errors: ["Choose an EPF account for every passbook before importing."] });
    const changed = passbookChain.oldFirstYear.replace("500 150 0", "400 250 0").replace("17,780 5,430", "17,680 5,530");
    expect(plan([passbookChain.oldFirstYear, changed])).toEqual({ ok: false,
      errors: ["Two different passbooks were chosen for First job, FY 2021-22. Keep only one."] });
    expect(ok([passbookChain.oldFirstYear, passbookChain.oldFirstYear]).years).toHaveLength(1);
  });
});

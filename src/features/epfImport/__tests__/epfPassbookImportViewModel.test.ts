import type { EpfAccount } from "@/src/domain/epf";
import { readEpfoPassbook } from "@/src/domain/epf/passbook";
import { NEW_MEMBER_ID, OLD_MEMBER_ID, passbookChain } from "@/src/testing/epfPassbookFixture";
import { buildAssignment, financialYearLabel, groupPassbooks, NEW_ACCOUNT, targetOptions } from "../epfPassbookImportViewModel";

const account = (id: string, nickname: string, provider: EpfAccount["provider"] = "epfo"): EpfAccount => ({
  id, nickname, provider, status: "active", currency: "INR", historyCompleteThrough: null,
  checkpoint: { date: "2021-03-31", balance: { total: 0, components: { employee: 0, employer: 0 } }, capital: 0,
    source: "epfoStatement", recordedAt: "2021-04-01T00:00:00Z" },
});
const picked = (key: string, text: string) => ({ key, name: `${key}.pdf`, result: readEpfoPassbook(text) });
const { groups } = groupPassbooks([picked("b", passbookChain.newFirstYear), picked("a", passbookChain.oldFirstYear),
  picked("c", passbookChain.oldClaimYear)]);
const newIds = { [OLD_MEMBER_ID]: "id-old", [NEW_MEMBER_ID]: "id-new" };

test("groups passbooks by member ID, oldest first, showing only the last four digits", () => {
  expect(financialYearLabel(2009)).toBe("FY 2009-10");
  expect(groups).toEqual([
    { memberId: OLD_MEMBER_ID, label: "Member ID ending 0001", years: ["FY 2021-22", "FY 2022-23"] },
    { memberId: NEW_MEMBER_ID, label: "Member ID ending 0002", years: ["FY 2022-23"] },
  ]);
});

test("an existing account can take only one member ID, and only EPFO accounts are offered", () => {
  const accounts = [account("acme", "Acme"), account("trust", "Trust", "employerTrust")];
  const choices = { [OLD_MEMBER_ID]: { target: "acme", nickname: "" } };
  expect(targetOptions(accounts, choices, NEW_MEMBER_ID).map((item) => item.value)).toEqual([NEW_ACCOUNT]);
  expect(targetOptions(accounts, choices, OLD_MEMBER_ID).map((item) => item.value)).toEqual([NEW_ACCOUNT, "acme"]);
});

test("new accounts need distinct names that no saved account uses", () => {
  const same = { [OLD_MEMBER_ID]: { target: NEW_ACCOUNT, nickname: "Job" }, [NEW_MEMBER_ID]: { target: NEW_ACCOUNT, nickname: " job " } };
  expect(buildAssignment(groups, same, newIds, [])).toEqual({ ok: false, errors: {
    [OLD_MEMBER_ID]: "Give each new account its own name.", [NEW_MEMBER_ID]: "Give each new account its own name." } });
  expect(buildAssignment(groups, {}, newIds, [account("x", "epf 0002")])).toEqual({ ok: false,
    errors: { [NEW_MEMBER_ID]: "An EPF account already has this name. Choose another, or import into that account." } });
  expect(buildAssignment(groups, { [OLD_MEMBER_ID]: { target: "gone", nickname: "" } }, newIds, [])).toMatchObject({ ok: false,
    errors: { [OLD_MEMBER_ID]: "Choose the account again; it is no longer available." } });
  expect(buildAssignment(groups, {}, newIds, [])).toEqual({ ok: true, assignment: [
    { memberId: OLD_MEMBER_ID, id: "id-old", nickname: "EPF 0001" }, { memberId: NEW_MEMBER_ID, id: "id-new", nickname: "EPF 0002" }] });
});

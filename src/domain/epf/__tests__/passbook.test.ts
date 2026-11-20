import { readEpfoPassbook, type EpfoPassbook } from "@/src/domain/epf/passbook";
import { NEW_MEMBER_ID, OLD_MEMBER_ID, passbookText } from "@/src/testing/epfPassbookFixture";

const OLD_ID = OLD_MEMBER_ID;
const NEW_ID = NEW_MEMBER_ID;
const passbook = (input: Omit<Parameters<typeof passbookText>[0], "year"> & { year?: number }) => passbookText({ year: 2021, ...input });

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const layoutARows = months.map((month, index) => {
  const wageYear = index < 9 ? 2021 : 2022;
  const posted = index < 8 ? `01-${String(index + 5).padStart(2, "0")}-2021` : `01-${String(index - 7).padStart(2, "0")}-2022`;
  return `${month}-${wageYear} ${posted} CR Cont. for Due-Month ${posted.slice(3, 5)}${posted.slice(6)} 12,000 12,000 1,440 440 1,000`;
});
const layoutA = passbook({ opening: "50,000 20,000 30,000", rows: layoutARows,
  totals: ["17,280 5,280 12,000", "0 0 0", "0 0 0"], interest: "4,100 1,650 0", closing: "71,380 26,930 42,000" });

const claimYear = passbook({ year: 2022, opening: "58,500 24,400 35,000",
  rows: ["Aug-2022 05-09-2022 DR Claim 0 0 60,000 25,000 0"],
  totals: ["0 0 0", "0 0 0", "60,000 25,000 0"], interest: "1,500 600 0", closing: "0 0 35,000" });

const newAccount = passbook({ memberId: NEW_ID, year: 2022, opening: "0 0 0", printed: "15-02-2023", rows: [
  "TRANSFER IN - SAME OFFICE", "(Old Member Id-", "Jun-2022 10-08-2022 CR 0 0 58,500 24,400 0", `:${OLD_ID}`, ")",
  "Cont. for the Due-Month", "Aug-2022 01-09-2022 CR 12,000 12,000 1,440 440 1,000", "202209",
  "TRANSFER IN - INTEREST", "AMOUNT ONLY (Old Member", "Jan-2023 20-01-2023 CR Id- 0 0 1,500 600 0", `:${OLD_ID}`, ")",
  "Cont. for the Due-Month", "Jan-2023 01-02-2023 CR 12,000 12,000 1,440 440 1,000", "202302",
], totals: ["2,880 880 2,000", "60,000 25,000 0", "0 0 0"], interest: "0 0 0", closing: "62,880 25,880 2,000" });

const read = (text: string, pages?: number): EpfoPassbook => {
  const result = readEpfoPassbook(text, pages);
  if (!result.ok) throw new Error(result.message);
  return result.passbook;
};
const rejection = (text: string, pages?: number) => {
  const result = readEpfoPassbook(text, pages);
  return result.ok ? null : { reason: result.reason, message: result.message };
};

describe("EPFO member passbook reading (#740)", () => {
  test("reads a layout A year, with rows that add up to the totals and a closing that follows", () => {
    const year = read(layoutA);
    expect(year).toMatchObject({ layout: "A", memberId: OLD_ID, yearStart: "2021-04-01", yearEnd: "2022-03-31", open: false,
      opening: { date: "2021-03-31", amounts: { employee: 50000, employer: 20000, pension: 30000 } },
      interest: { date: "2022-03-31", amounts: { employee: 4100, employer: 1650, pension: 0 } },
      closing: { date: "2022-03-31", amounts: { employee: 71380, employer: 26930, pension: 42000 } } });
    expect(year.rows).toHaveLength(12);
    expect(year.rows[0]).toMatchObject({ kind: "contribution", wageMonth: "2021-04", date: "2021-05-01",
      amounts: { employee: 1440, employer: 440, pension: 1000 } });
  });

  test("reads layout B rows whose description wraps around them, and transfer-ins citing the old member ID", () => {
    const year = read(newAccount);
    expect(year).toMatchObject({ layout: "B", memberId: NEW_ID, open: true, printedOn: "2023-02-15" });
    expect(year.rows.map((row) => [row.kind, row.date, row.oldMemberId])).toEqual([
      ["transferIn", "2022-08-10", OLD_ID],
      ["contribution", "2022-09-01", null],
      ["transferInterest", "2023-01-20", OLD_ID],
      ["contribution", "2023-02-01", null],
    ]);
  });

  test("reads a final claim year that closes at zero EPF while keeping the pension balance", () => {
    const year = read(claimYear);
    expect(year.rows).toEqual([expect.objectContaining({ kind: "claim", date: "2022-09-05",
      amounts: { employee: 60000, employer: 25000, pension: 0 } })]);
    expect(year.closing.amounts).toEqual({ employee: 0, employer: 0, pension: 35000 });
  });

  test("blocks a passbook whose rows don't add up to a printed total, or whose year doesn't close", () => {
    expect(rejection(layoutA.replace("17,280 5,280 12,000", "17,280 5,281 12,000"))).toEqual({ reason: "doesNotAddUp",
      message: "The employer contributions don't add up to the passbook's yearly total." });
    expect(rejection(layoutA.replace("71,380 26,930", "71,381 26,930"))).toEqual({ reason: "doesNotAddUp",
      message: "The employee balance doesn't close: opening plus the year's entries isn't the closing balance." });
  });

  test("rejects other documents, multi-page files and entries it doesn't recognise, importing nothing", () => {
    expect(rejection("Consolidated Account Statement")?.reason).toBe("notPassbook");
    expect(rejection(layoutA, 2)?.reason).toBe("multiplePages");
    expect(rejection(claimYear.replace("DR Claim", "DR Advance"))).toEqual({ reason: "unknownRow",
      message: expect.stringContaining("DR entry CogVest doesn't recognise yet") });
    expect(rejection(layoutA.replace("Cont. for Due-Month 052021", "Arrears 052021"))?.reason).toBe("unknownRow");
    expect(rejection(newAccount.replace(`:${OLD_ID}`, ":unreadable"))).toEqual({ reason: "unknownRow",
      message: expect.stringContaining("transfer-in without the old member ID") });
    const mixed = newAccount
      .replace("Cont. for the Due-Month\nJan-2023 01-02-2023 CR", "Jan-2023 01-02-2023 CR Cont. for Due-Month 022023")
      .replace("1,440 440 1,000\n202302", "1,440 440 1,000");
    expect(rejection(mixed)?.reason).toBe("unknownLayout");
    expect(rejection(layoutA.replace(/^Closing Balance.*$/m, ""))?.reason).toBe("missingLine");
  });
});

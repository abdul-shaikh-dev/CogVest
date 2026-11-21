// Synthetic EPFO Member Passbook text (#740). It copies the structure the
// on-device extractor (PdfBox-Android, sorted by position) produces from real
// passbooks: unreadable legacy-font Hindi lines, the column headings split over
// two lines, wide rows whose amounts fall to the next line, and three balance
// columns. Every name, ID and amount is invented.

export const OLD_MEMBER_ID = "ABCDE00000000000000001";
export const NEW_MEMBER_ID = "ABCDE00000000000000002";

export function passbookText({ memberId = OLD_MEMBER_ID, year, opening, rows, totals, interest, closing, printed = "15-08-2025" }: {
  memberId?: string; year: number; opening: string; rows: string[]; totals: [string, string, string];
  interest: string; closing: string; printed?: string;
}) {
  return [
    "dezpkjh Hkfo / Member Passbook",
    "-".repeat(40),
    "LFkkiuk | Establishment ID/Name XXXXX0000000000 / SYNTHETIC EMPLOYER",
    `lnL; | Member ID/Name ${memberId} / SYNTHETIC MEMBER`,
    "tUe frfFk | Date of Birth 01-01-1990",
    ";w , u | UAN 100000000001",
    `bZih,Q [ foRrh; o"kZ - ${year}-${year + 1} ] / EPF Passbook [ Financial Year - ${year}-${year + 1} ]`,
    "fooj.k / Particulars Employee Employer Pension",
    "Balance Balance Balance",
    `OB Int. Updated upto 31/03/${year} ${opening}`,
    "/ Transaction fooj.k / Wages va'knku / Contribution",
    "Wage Month frfFk / / izdkj /",
    "/ Date / Type osru ,Q / EPF osru ,l / EPS izdkj / Lkkuk / Lkkuk /",
    "Employee Employer Pension",
    ...rows,
    `Total Contributions for the year [ ${year} ] ${totals[0]}`,
    `Total Transfer-Ins/VDRs for the year [ ${year} ] ${totals[1]}`,
    `Total Withdrawals for the year [ ${year} ] ${totals[2]}`,
    `Int. Updated upto 31/03/${year + 1} ${interest}`,
    `Closing Balance as on 31/03/${year + 1} ${closing}`,
    `fooj.k dk vUr Of Statement---------------------- Printed On : ${printed} 10:00:00`,
    "Page 1 of",
    "1",
  ].join("\n");
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A layout A contribution row for a wage month, posted on the 1st of the next month. */
export function layoutARow(wageMonth: string, amounts = "1,440 440 1,000") {
  const [year, month] = wageMonth.split("-").map(Number);
  const dueYear = month === 12 ? year + 1 : year;
  const due = String(month === 12 ? 1 : month + 1).padStart(2, "0");
  return `${monthNames[month - 1]}-${year} 01-${due}-${dueYear} CR Cont. for Due-Month ${due}${dueYear} 12,000 12,000 ${amounts}`;
}

/** A layout B contribution row: the due month leads the amounts on the line below. */
export function layoutBRows(wageMonth: string, amounts = "1,440 440 1,000") {
  const [year, month] = wageMonth.split("-").map(Number);
  const dueYear = month === 12 ? year + 1 : year;
  const due = String(month === 12 ? 1 : month + 1).padStart(2, "0");
  return [`${monthNames[month - 1]}-${year} 01-${due}-${dueYear} CR Cont. for the Due-Month`, `${dueYear}${due} 12,000 12,000 ${amounts}`];
}

const wageMonths = (year: number, from: number, count: number) => Array.from({ length: count }, (_, index) => {
  const month = ((from - 1 + index) % 12) + 1;
  return `${month < from ? year + 1 : year}-${String(month).padStart(2, "0")}`;
});

/**
 * Old account: FY 2021-22 from ₹0, then FY 2022-23 with four contributions and a
 * final claim on 5 Sep 2022 that pays 460 + 210 interest inside it.
 * New account: FY 2022-23 from ₹0, with the balance credited on 10 Aug 2022
 * (before the claim), two contributions, and the interest credited on 20 Jan 2023.
 */
export const passbookChain = {
  oldFirstYear: passbookText({ year: 2021, opening: "0 0 0",
    rows: wageMonths(2021, 3, 12).map((month) => layoutARow(month)),
    totals: ["17,280 5,280 12,000", "0 0 0", "0 0 0"], interest: "500 150 0", closing: "17,780 5,430 12,000" }),
  oldClaimYear: passbookText({ year: 2022, opening: "17,780 5,430 12,000",
    rows: [...wageMonths(2022, 3, 4).map((month) => layoutARow(month)), "Aug-2022 05-09-2022 DR Claim 0 0 24,000 7,400 0"],
    totals: ["5,760 1,760 4,000", "0 0 0", "24,000 7,400 0"], interest: "460 210 0", closing: "0 0 16,000" }),
  newFirstYear: passbookText({ memberId: NEW_MEMBER_ID, year: 2022, opening: "0 0 0", rows: [
    "TRANSFER IN - SAME OFFICE", "Jul-2022 10-08-2022 CR (Old Member Id-", `:${OLD_MEMBER_ID} 0 0 23,540 7,190 0`, ")",
    ...layoutBRows("2022-09"), ...layoutBRows("2022-10"),
    "TRANSFER IN - INTEREST", "AMOUNT ONLY (Old Member", "Dec-2022 20-01-2023 CR Id- 0 0 460 210 0", `:${OLD_MEMBER_ID}`, ")",
  ], totals: ["2,880 880 2,000", "24,000 7,400 0", "0 0 0"], interest: "300 100 0", closing: "27,180 8,380 2,000" }),
};

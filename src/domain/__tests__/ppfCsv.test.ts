import { checkPpfCsvBalances, parsePpfCsv, parsePpfCsvAmount, parsePpfCsvDate, ppfCsvTemplate, ppfCsvByteLength } from "../ppfCsv";
const now = new Date("2026-09-11T12:00:00Z");
const header = "date,type,amount,note\n";
describe("PPF CSV", () => {
  it("counts UTF-8 without a runtime TextEncoder", () => {
    expect(ppfCsvByteLength("INR ₹ café 😀")).toBe(new TextEncoder().encode("INR ₹ café 😀").length);
    const encoder = global.TextEncoder;
    try {
      Object.defineProperty(global, "TextEncoder", { value: undefined, configurable: true, writable: true });
      expect(parsePpfCsv(ppfCsvTemplate, now).errors).toEqual([]);
    } finally { global.TextEncoder = encoder; }
  });
  it("reads the template and supports BOM, reordered headers and quoted notes", () => {
    expect(parsePpfCsv(ppfCsvTemplate, now).rows).toHaveLength(3);
    expect(parsePpfCsv('\uFEFFtype,date,note,amount\r\ncontribution,2026-04-01,"a, b",500\r\n', now).rows[0].note).toBe("a, b");
  });
  it("preserves identical legitimate transactions for explicit preview", () => {
    expect(parsePpfCsv(header + "2026-04-01,contribution,500,\n".repeat(2), now).rows).toHaveLength(2);
  });
  it.each([
    "2026-02-30,contribution,500,", "2027-01-01,interest,500,",
    "2026-01-01,interest,-1,", "2026-01-01,interest,1e3,",
    "2026-01-01,interest,1.234,", "2026-01-01,contribution,501,",
    "2026-01-01,estimate,500,", '2026-01-01,interest,500,"x"tail',
    '2026-01-01,interest,500,"unclosed',
  ])("rejects malformed row %s atomically", (row) => {
    const result = parsePpfCsv(header + row, now);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.rows).toHaveLength(0);
  });
  it("rejects empty, invalid headers, excessive rows and oversized data", () => {
    for (const text of [header, "date,type,amount,amount\n", header + "2026-04-01,interest,1,\n".repeat(1001), "x".repeat(262145)]) {
      expect(parsePpfCsv(text, now).errors.length).toBeGreaterThan(0);
    }
  });
});

describe("forgiving CogVest PPF CSV (#748)", () => {
  it.each([
    ["2026-04-01", "2026-04-01"], ["01/04/2026", "2026-04-01"], ["1-4-2026", "2026-04-01"],
    ["01-Apr-2026", "2026-04-01"], ["1 April 2026", "2026-04-01"], ["31-MAR-2026", "2026-03-31"], ["15 Sept 2025", "2025-09-15"],
  ])("reads the date %s as %s, day first", (raw, iso) => {
    expect(parsePpfCsvDate(raw)).toBe(iso);
  });

  it.each(["04/31/2026", "2026/04/01", "31-Foo-2026", "1.4.2026", "30/02/2026", "April 1 2026"])("never guesses the date %s", (raw) => {
    expect(parsePpfCsvDate(raw)).toBeNull();
  });

  it.each([
    ["150000", 15_000_000], ["1,50,000.00", 15_000_000], ["150,000", 15_000_000], ["₹1,50,000", 15_000_000],
    ["Rs. 5,000.5", 500_050], ["INR 500", 50_000], ["500 INR", 50_000], ["12,34,567.89", 123_456_789],
  ])("reads the amount %s", (raw, paise) => {
    expect(parsePpfCsvAmount(raw)).toBe(paise);
  });

  it.each(["-500", "(500)", "5,00", "1,5000", "500.123", "1e3", "", "five"])("rejects the amount %s", (raw) => {
    expect(parsePpfCsvAmount(raw)).toBeNull();
  });

  it("reads passbook-style rows with any header case, aliases, words for types and blank lines", () => {
    const text = "Date,Narration,Type,Amount,Closing Balance\n01/04/2025,NB Subscription,Deposit,\"1,50,000.00\",\"1,80,000.00\"\n\n31-Mar-2026,Interest paid,Interest Credited,\"₹12,960\",\"1,92,960.00\"\n";
    const result = parsePpfCsv(text, now);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { rowNumber: 2, date: "2025-04-01", type: "contribution", amount: 150000, balance: 180000, note: "NB Subscription" },
      { rowNumber: 4, date: "2026-03-31", type: "interest", amount: 12960, balance: 192960, note: "Interest paid" },
    ]);
    expect(checkPpfCsvBalances(result.rows).opening).toEqual({ balance: 30000, before: "2025-04-01" });
  });

  it("reports every problem in one pass with its row and column", () => {
    const result = parsePpfCsv("date,type,amount\n31/02/2026,deposit,500\n2026-04-01,bonus,500\n2026-04-02,deposit,501\n", now);
    expect(result.rows).toEqual([]);
    expect(result.errors.map(({ rowNumber, column }) => [rowNumber, column])).toEqual([[2, "date"], [3, "type"], [4, "amount"]]);
  });

  it("stops at a row whose printed balance the rows before can't give, naming it", () => {
    const result = parsePpfCsv("date,type,amount,balance\n2025-04-01,contribution,1000,11000\n2025-05-01,contribution,1000,12500\n2025-06-01,withdrawal,500,12000\n", now);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([{ rowNumber: 3, column: "balance", message: "The rows before give a balance of ₹12,000.00 here, but the file shows ₹12,500.00." }]);
  });

  it("shows the first rows as read when the columns can't be matched", () => {
    const result = parsePpfCsv("Txn Ref,Debit,Credit\nA1,,500\n", now);
    expect(result.errors.map((error) => error.column)).toEqual(["Txn Ref", "Debit", "Credit", "date", "type", "amount"]);
    expect(result.firstRows).toEqual([["Txn Ref", "Debit", "Credit"], ["A1", "", "500"]]);
  });

  it("still reads the original strict template unchanged", () => {
    const result = parsePpfCsv("date,type,amount,note\n2025-04-02,contribution,5000,First\n2026-03-31,interest,350,\n", now);
    expect(result.rows).toEqual([
      { rowNumber: 2, date: "2025-04-02", type: "contribution", amount: 5000, note: "First" },
      { rowNumber: 3, date: "2026-03-31", type: "interest", amount: 350, note: "" },
    ]);
  });
});

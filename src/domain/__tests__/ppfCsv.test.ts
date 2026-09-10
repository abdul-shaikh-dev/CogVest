import { parsePpfCsv, ppfCsvTemplate, ppfCsvByteLength } from "../ppfCsv";
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

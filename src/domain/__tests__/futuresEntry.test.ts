import { futuresEntryDate, futuresEntryErrors, futuresTimeZone, replaceFuturesTimePart } from "../futuresEntry";

describe("Futures entry instants", () => {
  it("preserves the exact offset-bearing instant until an explicit edit", () => {
    const value = "2026-01-01T00:01:58.123+05:30";
    expect(futuresEntryDate(value)?.toISOString()).toBe("2025-12-31T18:31:58.123Z");
  });
  it.each(["2026-02-30T10:00:00Z", "2026-09-01T10:00:00", "not a date"])("rejects invalid or timezone-free evidence %s", (value) => {
    expect(futuresEntryDate(value)).toBeUndefined();
  });
  it("changes the calendar day without resetting historical time or precision", () => {
    const value = "2026-01-01T00:01:58.123+05:30";
    const original = new Date(value);
    const result = new Date(replaceFuturesTimePart(value, new Date(2024, 1, 29, 12, 0), "date", new Date()));
    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([2024, 1, 29]);
    expect([result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds()])
      .toEqual([original.getHours(), original.getMinutes(), 58, 123]);
  });
  it("changes clock time without resetting historical date or seconds", () => {
    const value = "2023-12-31T23:59:58.123-04:00";
    const original = new Date(value);
    const result = new Date(replaceFuturesTimePart(value, new Date(2026, 8, 1, 9, 30), "time", new Date()));
    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([original.getFullYear(), original.getMonth(), original.getDate()]);
    expect([result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds()]).toEqual([9, 30, 58, 123]);
  });
  it("uses a fallback only on explicit selection, and identifies missing evidence", () => {
    const fallback = new Date(2026, 8, 1, 10, 20, 30, 123);
    const result = new Date(replaceFuturesTimePart("", new Date(2026, 7, 1), "date", fallback));
    expect([result.getMonth(), result.getHours(), result.getMinutes(), result.getSeconds()]).toEqual([7, 10, 20, 30]);
    expect(futuresEntryErrors({ source: { label: "Rate source", value: " " }, time: { label: "Rate time", value: "", timestamp: true }, optional: { label: "Optional", value: "", optional: true } }))
      .toEqual({ source: "Enter rate source.", time: "Enter rate time." });
  });
  it("retains fractional seconds beyond JavaScript millisecond precision on explicit picker edits", () => {
    const result = replaceFuturesTimePart("2026-09-01T10:20:58.123456Z", new Date(2026, 8, 2), "date", new Date());
    expect(result).toMatch(/:58\.123456Z$/);
  });
  it.each([[-330, "UTC+05:30"], [240, "UTC-04:00"], [0, "UTC+00:00"]])("shows the explicit device offset %s", (offset, label) => {
    const date = new Date();
    jest.spyOn(date, "getTimezoneOffset").mockReturnValue(offset as number);
    expect(futuresTimeZone(date)).toBe(label);
  });
});

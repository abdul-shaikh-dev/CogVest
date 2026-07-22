import {
  calendarDateToLocalDate,
  formatLocalCalendarDate,
  getCalendarDatePart,
  isEffectiveCalendarDate,
  isFutureCalendarDate,
  parseCalendarDate,
} from "@/src/domain/dates";

describe("local calendar dates", () => {
  it.each([
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "26-04-20",
    "2026-4-20",
  ])("rejects invalid calendar date %s", (value) => {
    expect(parseCalendarDate(value)).toBeNull();
  });

  it("accepts valid leap days", () => {
    expect(parseCalendarDate("2024-02-29")).toEqual({
      day: 29,
      month: 2,
      year: 2024,
    });
    expect(parseCalendarDate("2000-02-29")).not.toBeNull();
    expect(parseCalendarDate("2100-02-29")).toBeNull();
  });

  it("uses the device local calendar instead of slicing UTC", () => {
    const earlyIndiaMorning = new Date("2026-07-21T19:15:00.000Z");
    jest.spyOn(earlyIndiaMorning, "getFullYear").mockReturnValue(2026);
    jest.spyOn(earlyIndiaMorning, "getMonth").mockReturnValue(6);
    jest.spyOn(earlyIndiaMorning, "getDate").mockReturnValue(22);

    expect(formatLocalCalendarDate(earlyIndiaMorning)).toBe("2026-07-22");
  });

  it("extracts and validates the calendar portion of legacy timestamps", () => {
    expect(getCalendarDatePart("2026-04-20T00:00:00.000Z")).toBe(
      "2026-04-20",
    );
    expect(getCalendarDatePart("2026-02-30T00:00:00.000Z")).toBeNull();
  });

  it("compares effective dates by local calendar day", () => {
    const now = new Date("2026-07-21T19:15:00.000Z");
    jest.spyOn(now, "getFullYear").mockReturnValue(2026);
    jest.spyOn(now, "getMonth").mockReturnValue(6);
    jest.spyOn(now, "getDate").mockReturnValue(22);

    expect(isEffectiveCalendarDate("2026-07-22", now)).toBe(true);
    expect(isFutureCalendarDate("2026-07-22", now)).toBe(false);
    expect(isEffectiveCalendarDate("2026-07-23", now)).toBe(false);
    expect(isFutureCalendarDate("2026-07-23", now)).toBe(true);
    expect(isEffectiveCalendarDate("not-a-date", now)).toBe(false);
  });

  it("converts picker values without UTC rollover", () => {
    const date = calendarDateToLocalDate("2026-07-22");

    expect(date).not.toBeNull();
    expect(formatLocalCalendarDate(date as Date)).toBe("2026-07-22");
  });
});

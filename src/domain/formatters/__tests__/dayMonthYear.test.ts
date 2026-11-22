import { formatDate, formatDayMonthYear } from "../formatters";

describe("dates the same on every Android version (#779)", () => {
  it("spells every month with spaces, never the hyphens of older Android ICU data", () => {
    const months = Array.from({ length: 12 }, (_, month) => formatDate(new Date(Date.UTC(2026, month, 5)).toISOString()));
    expect(months).toEqual([
      "05 Jan 2026", "05 Feb 2026", "05 Mar 2026", "05 Apr 2026", "05 May 2026", "05 Jun 2026",
      "05 Jul 2026", "05 Aug 2026", "05 Sept 2026", "05 Oct 2026", "05 Nov 2026", "05 Dec 2026",
    ]);
  });

  it("does not use Intl for the date, so a runtime with older date patterns cannot change it", () => {
    const spy = jest.spyOn(Intl, "DateTimeFormat");
    expect(formatDate("2026-10-23")).toBe("23 Oct 2026");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reads stored ISO dates by their UTC calendar day", () => {
    expect(formatDate("2026-03-31")).toBe("31 Mar 2026");
    expect(formatDate("2026-03-31T23:30:00.000Z")).toBe("31 Mar 2026");
  });

  it("reads a local date by the phone's calendar day, unpadded on request", () => {
    expect(formatDayMonthYear(new Date(2026, 0, 5, 23, 59), { padDay: false })).toBe("5 Jan 2026");
    expect(formatDayMonthYear(new Date(2026, 11, 31))).toBe("31 Dec 2026");
  });

  it("refuses an invalid date as Intl did", () => {
    expect(() => formatDate("not a date")).toThrow(RangeError);
  });
});

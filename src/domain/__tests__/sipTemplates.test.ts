import {
  dueSipInstalments,
  sipDueDate,
  sipPriceOnOrAfter,
  sipTemplateProblems,
  sipTemplatesProblems,
  sipUnits,
} from "@/src/domain/sipTemplates";
import type { SipTemplate } from "@/src/types";

function template(overrides: Partial<SipTemplate> = {}): SipTemplate {
  return {
    amountInr: 5000,
    assetId: "fund",
    createdAt: "2026-01-01T00:00:00.000Z",
    dayOfMonth: 5,
    funding: "cash",
    handledMonths: [],
    id: "sip-1",
    paused: false,
    startMonth: "2026-09",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("SIP templates (#766)", () => {
  it("clamps the instalment day to the end of a short month", () => {
    expect(sipDueDate("2026-02", 31)).toBe("2026-02-28");
    expect(sipDueDate("2028-02", 30)).toBe("2028-02-29");
    expect(sipDueDate("2026-04", 31)).toBe("2026-04-30");
    expect(sipDueDate("2026-05", 31)).toBe("2026-05-31");
    expect(sipDueDate("2026-05", 1)).toBe("2026-05-01");
  });

  it("lists each arrived, unhandled month oldest first, and nothing before its day", () => {
    const due = dueSipInstalments([template({ handledMonths: [{ month: "2026-10", status: "skipped" }] })], "2026-11-04");
    expect(due).toEqual([{ dueDate: "2026-09-05", month: "2026-09", templateId: "sip-1" }]);
    expect(dueSipInstalments([template()], "2026-11-05").map((item) => item.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  it("offers nothing for a paused template or a future start", () => {
    expect(dueSipInstalments([template({ paused: true })], "2026-11-25")).toEqual([]);
    expect(dueSipInstalments([template({ startMonth: "2026-12" })], "2026-11-25")).toEqual([]);
  });

  it("offers a confirmed month again once its purchase was deleted", () => {
    const confirmed = template({ handledMonths: [{ month: "2026-09", status: "confirmed", tradeId: "t-9" }], startMonth: "2026-09" });
    expect(dueSipInstalments([confirmed], "2026-09-30", new Set(["t-9"]))).toEqual([]);
    expect(dueSipInstalments([confirmed], "2026-09-30", new Set())).toHaveLength(1);
    expect(dueSipInstalments([confirmed], "2026-09-30")).toEqual([]);
  });

  it("sorts across templates by date, then id", () => {
    const due = dueSipInstalments([
      template({ dayOfMonth: 20, id: "b", startMonth: "2026-11" }),
      template({ dayOfMonth: 20, id: "a", startMonth: "2026-11" }),
      template({ dayOfMonth: 2, id: "c", startMonth: "2026-11" }),
    ], "2026-11-25");
    expect(due.map((item) => item.templateId)).toEqual(["c", "a", "b"]);
  });

  it("rejects bad fields and handled months", () => {
    expect(sipTemplateProblems(template())).toEqual({});
    expect(Object.keys(sipTemplateProblems(template({
      amountInr: 10.123, assetId: "", dayOfMonth: 32, startMonth: "2026-13",
      handledMonths: [{ month: "2026-09", status: "skipped" }, { month: "2026-09", status: "skipped" }],
    }))).sort()).toEqual(["amountInr", "assetId", "dayOfMonth", "handledMonths", "startMonth"]);
    expect(sipTemplateProblems(template({ handledMonths: [{ month: "2026-09", status: "confirmed", tradeId: "" }] })))
      .toHaveProperty("handledMonths");
  });

  it("rejects duplicate ids, unknown holdings and too many templates", () => {
    expect(sipTemplatesProblems([template(), template()])).toContain("Two SIPs share an id.");
    expect(sipTemplatesProblems([template()], new Set(["other"]))).toEqual(["SIP sip-1 names a holding that does not exist."]);
    expect(sipTemplatesProblems(Array.from({ length: 51 }, (_, index) => template({ id: `s${index}` })))).toHaveLength(1);
  });

  it("rounds fund units down to three places and share units down to whole units", () => {
    expect(sipUnits(5000, 123.4567, false)).toBe(40.5);
    expect(sipUnits(5000, 333, false)).toBe(15.015);
    expect(sipUnits(5000, 333, true)).toBe(15);
    expect(sipUnits(5000, 0, true)).toBe(0);
  });

  it("takes the next trading day's price when the due date is a holiday", () => {
    const points = [
      { close: 99, date: "2026-11-03" },
      { close: 101, date: "2026-11-06" },
      { close: 0, date: "2026-11-05" },
      { close: 102, date: "2026-11-09" },
    ];
    expect(sipPriceOnOrAfter(points, "2026-11-05")).toEqual({ close: 101, date: "2026-11-06" });
    expect(sipPriceOnOrAfter(points, "2026-11-10")).toBeNull();
  });
});

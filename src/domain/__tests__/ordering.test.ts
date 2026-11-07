import { compareCodeUnits } from "../ordering";

const sorted = (values: string[], compare: (a: string, b: string) => number) =>
  [...values].sort(compare);

describe("compareCodeUnits", () => {
  it("orders ISO dates, months and timestamps as localeCompare does", () => {
    const values = [
      "2026-11-07",
      "2025-12-31",
      "2026-01-01",
      "2026-01",
      "2025-12",
      "2026-01-01T09:15:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "",
    ];
    expect(sorted(values, compareCodeUnits))
      .toEqual(sorted(values, (a, b) => a.localeCompare(b)));
  });

  it("orders generated record ids as localeCompare does", () => {
    const ids = ["trade_mh9x2k1a_0f3k9z", "trade_mh9x2k1a_0a7b", "trade_mh9x2j9z_zz", "trade_mh9x2k1b_00"];
    expect(sorted(ids, compareCodeUnits)).toEqual(sorted(ids, (a, b) => a.localeCompare(b)));
  });

  it("is a total order that breaks ties by code unit, not by locale", () => {
    expect(compareCodeUnits("a", "a")).toBe(0);
    expect(compareCodeUnits("a", "b")).toBe(-1);
    expect(compareCodeUnits("b", "a")).toBe(1);
    // Uppercase sorts before lowercase, unlike locale collation.
    expect(sorted(["b", "B", "a", "A"], compareCodeUnits)).toEqual(["A", "B", "a", "b"]);
  });
});

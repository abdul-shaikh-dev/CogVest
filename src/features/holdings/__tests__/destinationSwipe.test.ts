import { destinationAfterSwipe, isHorizontalIntent } from "../destinationSwipe";

describe("Holdings destination swipe", () => {
  it("switches left to PPF and right to Market", () => {
    expect(destinationAfterSwipe(-80, 5)).toBe("ppf");
    expect(destinationAfterSwipe(80, -5)).toBe("market");
  });
  it("moves one step through Market, PPF and EPF and stops at the ends", () => {
    const all = ["market", "ppf", "epf"] as const;
    expect(destinationAfterSwipe(-80, 0, all, "market")).toBe("ppf");
    expect(destinationAfterSwipe(-80, 0, all, "ppf")).toBe("epf");
    expect(destinationAfterSwipe(-80, 0, all, "epf")).toBeUndefined();
    expect(destinationAfterSwipe(80, 0, all, "epf")).toBe("ppf");
    expect(destinationAfterSwipe(80, 0, ["market", "epf"], "epf")).toBe("market");
    expect(destinationAfterSwipe(80, 0, all, "market")).toBeUndefined();
  });
  it("ignores taps, short swipes, vertical scrolling and diagonal gestures", () => {
    for (const [dx, dy] of [[0, 0], [45, 2], [10, 120], [80, 80], [Infinity, 0], [NaN, 0]]) {
      expect(destinationAfterSwipe(dx, dy)).toBeUndefined();
    }
    expect(isHorizontalIntent(10, 0)).toBe(false);
    expect(isHorizontalIntent(30, 2)).toBe(true);
  });
});

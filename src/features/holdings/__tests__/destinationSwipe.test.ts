import { destinationAfterSwipe, isHorizontalIntent } from "../destinationSwipe";

describe("Holdings destination swipe", () => {
  it("switches left to PPF and right to Market", () => {
    expect(destinationAfterSwipe(-80, 5)).toBe("ppf");
    expect(destinationAfterSwipe(80, -5)).toBe("market");
  });
  it("ignores taps, short swipes, vertical scrolling and diagonal gestures", () => {
    for (const [dx, dy] of [[0, 0], [45, 2], [10, 120], [80, 80], [Infinity, 0], [NaN, 0]]) {
      expect(destinationAfterSwipe(dx, dy)).toBeUndefined();
    }
    expect(isHorizontalIntent(10, 0)).toBe(false);
    expect(isHorizontalIntent(30, 2)).toBe(true);
  });
});

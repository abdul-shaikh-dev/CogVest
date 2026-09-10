export type HoldingsDestination = "market" | "ppf";

export function isHorizontalIntent(dx: number, dy: number) {
  return Math.abs(dx) >= 24 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

export function destinationAfterSwipe(dx: number, dy: number): HoldingsDestination | undefined {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) ||
      Math.abs(dx) < 60 || !isHorizontalIntent(dx, dy)) return undefined;
  return dx < 0 ? "ppf" : "market";
}

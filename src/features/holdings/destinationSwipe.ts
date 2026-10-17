export type HoldingsDestination = "market" | "ppf" | "epf";

export function isHorizontalIntent(dx: number, dy: number) {
  return Math.abs(dx) >= 24 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

/** Swiping left moves to the next available destination, right to the previous one. */
export function destinationAfterSwipe(
  dx: number,
  dy: number,
  destinations: readonly HoldingsDestination[] = ["market", "ppf"],
  current: HoldingsDestination = dx < 0 ? "market" : "ppf",
): HoldingsDestination | undefined {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) ||
      Math.abs(dx) < 60 || !isHorizontalIntent(dx, dy)) return undefined;
  const index = destinations.indexOf(current);
  return index < 0 ? undefined : destinations[dx < 0 ? index + 1 : index - 1];
}

import type { BehaviorInsightDetail } from "@/src/domain/calculations/behaviorInsightDetails";

/**
 * Whether a pattern has something to say. A trading-frequency window with no
 * buys or sells is available but empty (#806).
 */
export function hasObservation(detail: BehaviorInsightDetail) {
  if (detail.availability !== "available") return false;
  if (detail.kind !== "frequency") return true;
  return detail.facts.some((fact) => (fact.label === "Buys" || fact.label === "Sells") && fact.value > 0);
}

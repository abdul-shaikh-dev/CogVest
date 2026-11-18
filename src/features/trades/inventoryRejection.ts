import { formatDate } from "@/src/domain/formatters";
import type { InventoryRejection } from "@/src/store";
import type { Trade } from "@/src/types";

function describeTrades(ids: string[], trades: Trade[]) {
  const named = ids
    .map((id) => trades.find((trade) => trade.id === id))
    .filter((trade): trade is Trade => trade !== undefined)
    .map((trade) => `${trade.type === "buy" ? "purchase" : trade.type === "sell" ? "sale" : "transaction"} on ${formatDate(trade.date)}`);
  if (named.length === 0) return null;
  if (named.length <= 2) return named.join(" and ");
  return `${named.slice(0, 2).join(", ")} and ${named.length - 2} more`;
}

/**
 * Explains why a correction to a holding's opening position or a transaction
 * was refused because of the holding's dated units (#713), naming the
 * transactions that depend on it.
 */
export function inventoryRejectionMessage(
  rejection: Pick<InventoryRejection, "dependentTradeIds" | "reason">,
  trades: Trade[],
  change: "openingPosition" | "transaction",
) {
  const named = describeTrades(rejection.dependentTradeIds, trades);
  if (rejection.reason === "hidesTrades") {
    return change === "openingPosition"
      ? `This change would move the holding's starting point past the ${named ?? "recorded transactions"}, so they would stop counting. Correct those transactions first.`
      : "This date is on or before the date the holding was measured from, so the transaction would stop counting. Choose a later date, or correct the opening position.";
  }
  return named
    ? `This change would leave the ${named} selling more units than were held. Correct or delete it first.`
    : "This change would sell more units than were held on some date. Correct the related sales first.";
}

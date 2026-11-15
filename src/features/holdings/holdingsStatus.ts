/**
 * Feedback the Holdings banner can show after another screen finishes.
 *
 * The Holdings route is reachable through the exported `cogvest://` scheme, so
 * any app or web page can open it with parameters. Screens therefore pass one
 * of these codes, never text, and the route shows only the matching message: a
 * link cannot make CogVest display words it did not write (#657).
 */
export const holdingsStatusMessages = {
  assetDeleted: "Asset and linked records deleted.",
  assetDeletedHistoryRefresh: "Asset deleted. Portfolio history will refresh automatically.",
  assetSaved: "Asset details saved.",
  assetSavedPricesRefresh: "Asset details saved. Its prices will refresh automatically.",
  openingPositionRemoved: "Opening position removed. Portfolio history updated.",
  openingPositionRemovedHistoryRefresh: "Opening position removed. History will refresh automatically.",
  openingPositionSaved: "Portfolio history updated.",
  openingPositionSavedHistoryRefresh: "Saved. Portfolio history will refresh automatically.",
  purchaseRecorded: "Purchase recorded.",
  transactionRemoved: "Transaction removed. Portfolio and cash records updated.",
  transactionRemovedHistoryRefresh: "Transaction removed. Portfolio history will refresh automatically.",
  transactionSaved: "Transaction saved. Portfolio and cash records updated.",
  transactionSavedHistoryRefresh: "Transaction saved. Portfolio history will refresh automatically.",
  transactionsImported: "Transaction history imported.",
} as const;

export type HoldingsStatus = keyof typeof holdingsStatusMessages;

/** The message for a known code; anything else, including free text, is ignored. */
export function getHoldingsStatusMessage(status: unknown): string | undefined {
  return typeof status === "string" && Object.prototype.hasOwnProperty.call(holdingsStatusMessages, status)
    ? holdingsStatusMessages[status as HoldingsStatus]
    : undefined;
}

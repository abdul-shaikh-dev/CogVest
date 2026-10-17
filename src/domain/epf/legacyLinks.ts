import type { Asset } from "@/src/types";
import type { EpfAccount } from "./model";

// Quoted securities and PPF records can never represent an EPF balance, so an
// EPF link cannot overlap a PPF legacy link (which requires a "ppf" asset).
const linkableInstrumentTypes = new Set<Asset["instrumentType"]>(["debt", "other"]);

/**
 * A linked legacy holding is replaced by its EPF account from the account's
 * checkpoint date. Before that baseline the holding remains the user's record.
 */
export function getLinkedLegacyEpfAssetIds(accounts: readonly EpfAccount[], asOf: string) {
  return new Set(accounts
    .filter((account) => account.legacyAssetId !== undefined && account.checkpoint.date <= asOf)
    .map((account) => account.legacyAssetId as string));
}

export function validateEpfLegacyLinks(
  accounts: readonly EpfAccount[],
  assets: readonly Pick<Asset, "id" | "assetClass" | "currency" | "instrumentType">[],
) {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const seen = new Set<string>();
  for (const account of accounts) {
    const assetId = account.legacyAssetId;
    if (assetId === undefined) continue;
    const asset = assetsById.get(assetId);
    const linkable = asset?.instrumentType === undefined
      ? asset?.assetClass === "debt" : linkableInstrumentTypes.has(asset.instrumentType);
    if (!asset || asset.currency !== "INR" || !linkable) {
      throw new Error("Linked legacy EPF holding must be a persisted INR debt or other holding.");
    }
    if (seen.has(assetId)) throw new Error("A legacy holding can be linked to only one EPF account.");
    seen.add(assetId);
  }
}

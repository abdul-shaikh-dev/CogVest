/**
 * Groups records by asset in one pass, so per-asset work reads its own group
 * instead of filtering every record once per asset (#664, #720). Assets with
 * no records have no entry; read with `?? []`.
 */
export function groupByAsset<Item extends { assetId: string }>(items: readonly Item[]) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const group = groups.get(item.assetId);
    if (group) group.push(item);
    else groups.set(item.assetId, [item]);
  }
  return groups;
}

import type { Asset } from "@/src/types";

function normalizeIdentityPart(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

export function normalizeIsin(value?: string) {
  const normalized = normalizeIdentityPart(value);

  return /^[A-Z0-9]{12}$/.test(normalized) ? normalized : undefined;
}

export function findCanonicalAsset(
  assets: Asset[],
  candidate: Asset,
): Asset | undefined {
  const exactAsset = assets.find((asset) => asset.id === candidate.id);

  if (exactAsset) {
    return exactAsset;
  }

  const isin = normalizeIsin(candidate.isin);

  if (isin) {
    const isinMatch = assets.find((asset) => normalizeIsin(asset.isin) === isin);

    if (isinMatch) {
      return isinMatch;
    }
  }

  const providerId = normalizeIdentityPart(candidate.quoteSourceId);

  if (providerId) {
    const providerMatch = assets.find(
      (asset) => normalizeIdentityPart(asset.quoteSourceId) === providerId,
    );

    if (providerMatch) {
      return providerMatch;
    }
  }

  const ticker = normalizeIdentityPart(candidate.ticker);
  const exchange = normalizeIdentityPart(candidate.exchange);

  if (!ticker || !exchange) {
    return undefined;
  }

  return assets.find(
    (asset) =>
      normalizeIdentityPart(asset.ticker) === ticker &&
      normalizeIdentityPart(asset.exchange) === exchange,
  );
}

export function hasCanonicalAssetConflict(
  assets: Asset[],
  candidate: Asset,
) {
  const otherAssets = assets.filter((asset) => asset.id !== candidate.id);
  const canonicalAsset = findCanonicalAsset(otherAssets, candidate);

  return canonicalAsset !== undefined;
}

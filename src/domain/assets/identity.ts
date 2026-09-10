import type { Asset } from "@/src/types";

function normalizeIdentityPart(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

function exchangeTickerKey(asset: Asset) {
  const ticker = normalizeIdentityPart(asset.ticker);
  const exchange = normalizeIdentityPart(asset.exchange);

  return ticker && exchange ? `${exchange}:${ticker}` : undefined;
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

export type CanonicalAssetMatcher = {
  add: (asset: Asset) => void;
  find: (candidate: Asset) => Asset | undefined;
};

export function createCanonicalAssetMatcher(
  assets: Asset[],
): CanonicalAssetMatcher {
  const assetsById = new Map<string, Asset>();
  const assetsByIsin = new Map<string, Asset>();
  const assetsByProviderId = new Map<string, Asset>();
  const assetsByExchangeTicker = new Map<string, Asset>();

  const add = (asset: Asset) => {
    if (!assetsById.has(asset.id)) assetsById.set(asset.id, asset);

    const isin = normalizeIsin(asset.isin);
    if (isin && !assetsByIsin.has(isin)) assetsByIsin.set(isin, asset);

    const providerId = normalizeIdentityPart(asset.quoteSourceId);
    if (providerId && !assetsByProviderId.has(providerId)) {
      assetsByProviderId.set(providerId, asset);
    }

    const tickerKey = exchangeTickerKey(asset);
    if (tickerKey && !assetsByExchangeTicker.has(tickerKey)) {
      assetsByExchangeTicker.set(tickerKey, asset);
    }
  };

  for (const asset of assets) add(asset);

  return {
    add,
    find(candidate) {
      const exactAsset = assetsById.get(candidate.id);
      if (exactAsset) return exactAsset;

      const isin = normalizeIsin(candidate.isin);
      if (isin) {
        const isinMatch = assetsByIsin.get(isin);
        if (isinMatch) return isinMatch;
      }

      const providerId = normalizeIdentityPart(candidate.quoteSourceId);
      if (providerId) {
        const providerMatch = assetsByProviderId.get(providerId);
        if (providerMatch) return providerMatch;
      }

      const tickerKey = exchangeTickerKey(candidate);
      return tickerKey ? assetsByExchangeTicker.get(tickerKey) : undefined;
    },
  };
}

export function hasCanonicalAssetConflict(
  assets: Asset[],
  candidate: Asset,
) {
  const otherAssets = assets.filter((asset) => asset.id !== candidate.id);
  const canonicalAsset = findCanonicalAsset(otherAssets, candidate);

  return canonicalAsset !== undefined;
}

import type { Asset, Quote, QuoteCache } from "@/src/types";

export const V1_REPORTING_CURRENCY = "INR" as const;

export type PortfolioCurrencyIssue = {
  assetId: string;
  assetName: string;
  message: string;
};

function isSupportedIndianTicker(asset: Asset) {
  return (
    asset.exchange === "NSE" ||
    asset.exchange === "BSE" ||
    /\.(NS|BO)$/u.test(asset.ticker)
  );
}

export function getV1AssetCurrencyIssue(asset: Asset): string | undefined {
  if (asset.currency !== V1_REPORTING_CURRENCY) {
    return `${asset.name} uses ${asset.currency}; CogVest V1 supports INR holdings only.`;
  }

  if (
    (asset.assetClass === "stock" || asset.assetClass === "etf") &&
    !isSupportedIndianTicker(asset)
  ) {
    return `${asset.name} is not linked to a supported NSE or BSE instrument.`;
  }

  if (asset.assetClass === "crypto" && asset.exchange !== "CRYPTO") {
    return `${asset.name} is not linked to the supported crypto quote source.`;
  }

  return undefined;
}

export function getV1QuoteCurrencyIssue(
  asset: Asset,
  quote?: Pick<Quote, "currency">,
): string | undefined {
  const assetIssue = getV1AssetCurrencyIssue(asset);

  if (assetIssue) {
    return assetIssue;
  }

  if (quote && quote.currency !== V1_REPORTING_CURRENCY) {
    return `${asset.name} has a ${quote.currency} quote; it was excluded from INR totals.`;
  }

  return undefined;
}

export function isV1SupportedAsset(asset: Asset) {
  return getV1AssetCurrencyIssue(asset) === undefined;
}

export function isV1CompatibleQuote(
  asset: Asset,
  quote?: Pick<Quote, "currency">,
) {
  return getV1QuoteCurrencyIssue(asset, quote) === undefined;
}

export function getPortfolioCurrencyIssues(
  assets: Asset[],
  quoteCache: QuoteCache,
): PortfolioCurrencyIssue[] {
  return assets.flatMap((asset) => {
    const message = getV1QuoteCurrencyIssue(asset, quoteCache[asset.id]);

    return message
      ? [{ assetId: asset.id, assetName: asset.name, message }]
      : [];
  });
}

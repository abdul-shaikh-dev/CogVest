import type { QuoteCache } from "@/src/types";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";

import type {
  QuoteRefreshFailure,
  QuoteResult,
  RefreshQuotesInput,
  ResolveQuoteInput,
} from "./types";
import { fetchCoinGeckoQuote } from "./coinGecko";
import { fetchYahooQuote } from "./yahooFinance";

export async function resolveQuote({
  asset,
  cachedQuote,
  fetcher,
  now,
}: ResolveQuoteInput): Promise<QuoteResult> {
  const currencyIssue = getV1AssetCurrencyIssue(asset);

  if (currencyIssue) {
    return {
      error: currencyIssue,
      ok: false,
    };
  }

  if (asset.assetClass === "debt") {
    if (cachedQuote) {
      return {
        ok: true,
        quote: cachedQuote,
      };
    }

    return {
      error: "Debt assets require a manual current price.",
      ok: false,
    };
  }

  const result =
    asset.assetClass === "crypto"
      ? await fetchCoinGeckoQuote({ asset, fetcher, now })
      : await fetchYahooQuote({ asset, fetcher, now });

  if (result.ok || !cachedQuote) {
    return result;
  }

  return {
    ...result,
    fallbackQuote: cachedQuote,
  };
}

export async function refreshQuotes({
  assets,
  cachedQuotes = {},
  fetcher,
  now,
}: RefreshQuotesInput) {
  const quoteCache: QuoteCache = {};
  const failures: QuoteRefreshFailure[] = [];

  for (const asset of assets) {
    if (asset.assetClass === "cash") {
      continue;
    }

    const result = await resolveQuote({
      asset,
      cachedQuote: cachedQuotes[asset.id],
      fetcher,
      now,
    });

    if (result.ok) {
      quoteCache[asset.id] = result.quote;
      continue;
    }

    failures.push({
      assetId: asset.id,
      error: result.error,
    });

    if (result.fallbackQuote) {
      quoteCache[asset.id] = result.fallbackQuote;
    }
  }

  return {
    failures,
    quoteCache,
  };
}

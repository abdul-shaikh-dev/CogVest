import type { QuoteCache } from "@/src/types";

import type {
  QuoteRefreshFailure,
  QuoteResult,
  RefreshQuotesInput,
  ResolveQuoteInput,
} from "./types";
import { fetchCoinGeckoQuote } from "./coinGecko";
import { fetchYahooQuote } from "./yahooFinance";
import { createManualQuote } from "./utils";

export async function resolveQuote({
  asset,
  fetcher,
  manualPrice,
  now,
}: ResolveQuoteInput): Promise<QuoteResult> {
  if (asset.assetClass === "debt") {
    if (manualPrice !== undefined) {
      return {
        ok: true,
        quote: createManualQuote({ asset, now, price: manualPrice }),
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

  if (result.ok || manualPrice === undefined) {
    return result;
  }

  return {
    ...result,
    fallbackQuote: createManualQuote({ asset, now, price: manualPrice }),
  };
}

export async function refreshQuotes({
  assets,
  fetcher,
  manualPrices = {},
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
      fetcher,
      manualPrice: manualPrices[asset.id],
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

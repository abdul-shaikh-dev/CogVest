import type { QuoteCache } from "@/src/types";
import { getV1AssetCurrencyIssue } from "@/src/domain/portfolioCurrency";

import type {
  QuoteRefreshFailure,
  QuoteRefreshResult,
  QuoteRefreshTimeout,
  QuoteResult,
  RefreshQuotesInput,
  ResolveQuoteInput,
} from "./types";
import { fetchCoinGeckoQuote } from "./coinGecko";
import { fetchYahooQuote } from "./yahooFinance";

export const QUOTE_REFRESH_TIMEOUT_MS = 10_000;
export const QUOTE_REFRESH_MAX_CONCURRENCY = 4;

export async function resolveQuote({
  asset,
  cachedQuote,
  fetcher,
  now,
  signal,
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
      ? await fetchCoinGeckoQuote({ asset, fetcher, now, signal })
      : await fetchYahooQuote({ asset, fetcher, now, signal });

  if (result.ok || !cachedQuote) {
    return result;
  }

  return {
    ...result,
    fallbackQuote: cachedQuote,
  };
}

type RefreshAttempt =
  | {
      kind: "completed";
      result: QuoteResult;
    }
  | {
      kind: "cancelled";
    }
  | {
      kind: "timedOut";
    };

function resolveQuoteWithDeadline(
  input: ResolveQuoteInput,
  signal?: AbortSignal,
): Promise<RefreshAttempt> {
  if (signal?.aborted) {
    return Promise.resolve({ kind: "cancelled" });
  }

  const controller = new AbortController();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (attempt: RefreshAttempt) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleCancellation);
      resolve(attempt);
    };
    const handleCancellation = () => {
      controller.abort();
      finish({ kind: "cancelled" });
    };
    const timeoutId = setTimeout(() => {
      controller.abort();
      finish({ kind: "timedOut" });
    }, QUOTE_REFRESH_TIMEOUT_MS);

    signal?.addEventListener("abort", handleCancellation, { once: true });
    void resolveQuote({
      ...input,
      signal: controller.signal,
    }).then((result) => {
      finish({ kind: "completed", result });
    });
  });
}

export async function refreshQuotes({
  assets,
  cachedQuotes = {},
  fetcher,
  now,
  signal,
}: RefreshQuotesInput): Promise<QuoteRefreshResult> {
  const providerAssets = assets.filter(
    (asset) => asset.assetClass !== "cash" && asset.assetClass !== "debt",
  );
  const attempts: Array<RefreshAttempt | undefined> = new Array(
    providerAssets.length,
  );
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < providerAssets.length) {
      const index = nextIndex;
      nextIndex += 1;
      const asset = providerAssets[index];

      attempts[index] = await resolveQuoteWithDeadline(
        {
          asset,
          cachedQuote: cachedQuotes[asset.id],
          fetcher,
          now,
        },
        signal,
      );
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          QUOTE_REFRESH_MAX_CONCURRENCY,
          providerAssets.length,
        ),
      },
      () => worker(),
    ),
  );

  const quoteCache: QuoteCache = {};
  const failed: QuoteRefreshFailure[] = [];
  const timedOut: QuoteRefreshTimeout[] = [];
  const updated: string[] = [];

  attempts.forEach((attempt, index) => {
    const asset = providerAssets[index];
    const cachedQuote = cachedQuotes[asset.id];

    if (!attempt || attempt.kind === "cancelled") {
      failed.push({
        assetId: asset.id,
        error: "Quote refresh was cancelled.",
      });
      if (cachedQuote) {
        quoteCache[asset.id] = cachedQuote;
      }
      return;
    }

    if (attempt.kind === "timedOut") {
      timedOut.push({
        assetId: asset.id,
        error: "Quote provider did not respond within 10 seconds.",
      });
      if (cachedQuote) {
        quoteCache[asset.id] = cachedQuote;
      }
      return;
    }

    if (attempt.result.ok) {
      quoteCache[asset.id] = attempt.result.quote;
      updated.push(asset.id);
      return;
    }

    failed.push({
      assetId: asset.id,
      error: attempt.result.error,
    });

    if (attempt.result.fallbackQuote) {
      quoteCache[asset.id] = attempt.result.fallbackQuote;
    }
  });

  return {
    failed,
    quoteCache,
    timedOut,
    updated,
  };
}

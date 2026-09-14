import { formatDate } from "@/src/domain/formatters";
import type { Holding, Quote, QuoteSource } from "@/src/types";

import { classifyQuoteFreshness, type QuoteFreshness } from "./freshness";

export type QuoteContext = {
  asOf: string | null;
  freshness: QuoteFreshness;
  label: string;
  source: QuoteSource | null;
};

const sourceLabels: Record<QuoteSource, string> = {
  amfi: "AMFI NAV",
  coingecko: "CoinGecko",
  manual: "Manual price",
  yahoo: "Yahoo Finance",
};

function formatAsOf(asOf: string, source: QuoteSource) {
  const date = new Date(asOf);
  if (!Number.isFinite(date.getTime())) return null;

  if (source === "amfi" || source === "manual" || /^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    return formatDate(asOf);
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
    year: "numeric",
  }).format(date);
}

export function getHoldingQuoteContext(
  holding: Holding,
  quote: Quote | undefined,
  now = new Date(),
): QuoteContext {
  if (holding.currentPrice === null || holding.valuation.status === "pending") {
    return {
      asOf: null,
      freshness: "missing",
      label: "Unavailable · no saved quote",
      source: null,
    };
  }

  const source = quote?.source ?? holding.valuation.source;
  const asOf = quote?.asOf ?? holding.valuation.asOf;
  const candidate = asOf
    ? { assetId: holding.asset.id, asOf, currency: holding.asset.currency, price: holding.currentPrice, source }
    : undefined;
  const freshness = classifyQuoteFreshness(candidate, now);
  const formattedAsOf = asOf ? formatAsOf(asOf, source) : null;
  const stateLabel = freshness === "current"
    ? "Fresh"
    : freshness === "stale"
      ? "Stale"
      : freshness === "manual"
        ? "Manual"
        : "Unavailable";

  return {
    asOf: asOf ?? null,
    freshness,
    label: formattedAsOf
      ? source === "manual"
        ? `Manual price · recorded ${formattedAsOf}`
        : `${stateLabel} · ${sourceLabels[source]} · as of ${formattedAsOf}`
      : source === "manual"
        ? "Manual price · date unavailable"
        : `${stateLabel} · ${sourceLabels[source]} · date unavailable`,
    source,
  };
}

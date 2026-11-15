import { normalizeIsin } from "@/src/domain/assets";
import type { QuoteProviderInput, QuoteResult } from "@/src/services/quotes/types";
import { defaultNow, roundQuoteNumber } from "@/src/services/quotes/utils";

import { lookupAmfiSchemeClassifications } from "./amfiSchemeCatalog";

const mutualFundInstrumentTypes = new Set([
  "arbitrageFund",
  "liquidFund",
  "mutualFund",
]);

export function isMutualFundAsset(
  asset: QuoteProviderInput["asset"],
) {
  return Boolean(
    asset.instrumentType && mutualFundInstrumentTypes.has(asset.instrumentType),
  );
}

export async function fetchAmfiQuote({
  asset,
  fetcher,
  now = defaultNow,
}: QuoteProviderInput): Promise<QuoteResult> {
  const isin = normalizeIsin(asset.isin);
  if (!isin) {
    return {
      error: "A valid mutual-fund ISIN is required for AMFI NAV refresh.",
      ok: false,
    };
  }

  const result = await lookupAmfiSchemeClassifications({
    ...(fetcher ? { fetcher } : {}),
    isins: [isin],
  });
  const record = result.classifications[isin];
  if (!record || record.nav === undefined || !record.asOf) {
    return {
      // The catalog's own failure message is about fund categories, not prices (#658).
      error: result.failure
        ? "AMFI NAVs are unavailable right now. The last saved price stays in use."
        : "AMFI did not provide a valid current NAV for this ISIN.",
      ok: false,
    };
  }

  return {
    ok: true,
    quote: {
      assetId: asset.id,
      asOf: record.asOf,
      currency: "INR",
      fetchedAt: now(),
      price: roundQuoteNumber(record.nav),
      source: "amfi",
    },
  };
}

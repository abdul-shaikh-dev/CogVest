import { normalizeIsin } from "@/src/domain/assets";
import type { QuoteProviderInput, QuoteResult } from "@/src/services/quotes/types";
import { roundQuoteNumber } from "@/src/services/quotes/utils";

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
      error: result.failure ?? "AMFI did not provide a valid current NAV for this ISIN.",
      ok: false,
    };
  }

  return {
    ok: true,
    quote: {
      assetId: asset.id,
      asOf: record.asOf,
      currency: "INR",
      price: roundQuoteNumber(record.nav),
      source: "amfi",
    },
  };
}

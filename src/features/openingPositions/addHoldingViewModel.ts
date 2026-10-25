import {
  equitySectorTypeOptions,
  getInstrumentTypeOptions,
  instrumentTypeLabel,
  sectorTypeLabel,
} from "@/src/domain/assets";
import { formatINR } from "@/src/domain/formatters";
import type { AssetLookupResult } from "@/src/services/assetLookup";
import type { AssetClass, InstrumentType, Quote, SectorType } from "@/src/types";

// Pure view logic for Add Holding: option lists and quote provenance copy.

export function formatSignedINR(value: number) {
  const amount = formatINR(value);

  return value > 0 ? `+${amount}` : amount;
}

export function quoteSourceLabel(quote: Quote) {
  if (quote.source === "amfi") {
    return "AMFI";
  }
  if (quote.source === "yahoo") {
    return "Yahoo Finance";
  }

  if (quote.source === "coingecko") {
    return "CoinGecko";
  }

  return "manual";
}

/** Instrument choices for an asset class, keeping an existing out-of-list value selectable. */
export function getInstrumentOptions(assetClass: AssetClass, instrumentType: InstrumentType) {
  const availableInstrumentTypes: InstrumentType[] = getInstrumentTypeOptions(
    assetClass,
  ).filter((value) => value !== "ppf");
  return (
    availableInstrumentTypes.includes(instrumentType)
      ? availableInstrumentTypes
      : [...availableInstrumentTypes, instrumentType]
  ).map(
    (value) => ({
      label: instrumentTypeLabel(value),
      value,
    }),
  );
}

/** Equity sector choices, keeping an existing out-of-list value selectable. */
export function getSectorOptions(sectorType: SectorType) {
  const availableSectorTypes = equitySectorTypeOptions.includes(sectorType)
    ? equitySectorTypeOptions
    : [...equitySectorTypeOptions, sectorType];
  return availableSectorTypes.map((value) => ({
    label: sectorTypeLabel(value),
    value,
  }));
}

/** How the review describes the price that will be saved with the holding. */
export function getReviewQuoteSourceLabel({
  currentPrice,
  preservesProviderQuote,
  selectedLookupQuote,
  selectedLookupResult,
  selectedSavedQuote,
}: {
  currentPrice: string;
  preservesProviderQuote: boolean;
  selectedLookupQuote?: Quote;
  selectedLookupResult?: AssetLookupResult;
  selectedSavedQuote?: Quote;
}) {
  return currentPrice.trim().length === 0
    ? "Valuation pending"
    : selectedLookupResult
    ? selectedLookupQuote && preservesProviderQuote
      ? `Live quote • ${selectedLookupResult.sourceLabel}`
      : `Manual price • ${selectedLookupResult.sourceLabel} identity`
    : selectedSavedQuote && preservesProviderQuote
      ? selectedSavedQuote.source === "manual"
        ? "Saved manual price"
        : `Saved live quote • ${quoteSourceLabel(selectedSavedQuote)}`
      : "Manual price";
}

# Issue 84 Asset Lookup And Price Autofill Design

## Goal
Reduce Add Holding friction by letting users search for assets by familiar names or symbols, select a result, and autofill the technical fields CogVest needs for quote fetching.

## Scope
This issue improves the current Add Holding screen only. It does not implement the broader multi-phase Add Holding redesign from issue #79.

In scope:
- Search public asset metadata from Yahoo Finance and CoinGecko.
- Show concise result rows with provider, name, symbol/ticker, and asset class.
- Autofill asset name, symbol, ticker, quote source ID, asset class, exchange, currency, instrument type, and sector defaults when a result is selected.
- Try fetching the current price for the selected result.
- Populate current price when quote fetching succeeds.
- Keep manual entry and manual current-price fallback fully available.
- Debounce remote lookup input.
- Avoid sending local portfolio holdings, quantities, costs, cash, notes, or conviction data to lookup providers.

Out of scope:
- Logos.
- Advanced ranking.
- Exchange picker.
- Import/export.
- Full V3 advanced asset search.
- Replacing the current Add Holding layout with the issue #79 multi-phase flow.

## Data Flow
`AddOpeningPositionForm` owns the UI state. It calls a new lookup service with only the search query. The lookup service returns normalized `AssetLookupResult` objects. When the user selects a result, the form builds a temporary `Asset`, fills form fields from that metadata, and calls the existing quote resolver to fetch one current price.

The app persists nothing until the user reviews and saves the holding. Existing manual save behavior remains unchanged.

## Lookup Providers
Yahoo Finance search is used for stocks and ETFs. NSE `.NS` and BSE `.BO` symbols map to INR assets and known exchanges. ETF quote types map to ETF metadata; other equity-like results map to stock metadata.

CoinGecko search is used for crypto assets. CoinGecko coin IDs are preserved as `quoteSourceId` so existing CoinGecko simple-price quote fetching works.

Provider failures are non-fatal. If one provider fails, the other provider can still return results. If both fail, the UI shows a calm warning and manual entry remains available.

## UI Behavior
Add Holding gets an asset lookup field above manual asset fields:
- Empty query: no network call.
- Fewer than two characters: prompt to keep typing.
- Debounced query: show loading copy and result rows.
- Select result: fill metadata, attempt current price, and show whether live price autofill succeeded or manual price is still needed.

Manual fields stay editable after selection. Editing manual metadata clears the selected existing asset/review state as it does today.

## Testing
Add unit tests for:
- Yahoo result mapping for NSE stock and ETF-like results.
- CoinGecko result mapping.
- Partial provider failure.
- Selected lookup result autofills Add Holding fields.
- Successful quote lookup autofills current price.
- Quote failure leaves manual price entry available.
- Existing manual Add Holding path still works.

## Acceptance Criteria
- Users can search assets without knowing exact provider identifiers.
- Selecting a result autofills the key Add Holding metadata fields.
- Current price autofills when the quote provider returns a price.
- Manual fallback still works when search or quote fetching fails.
- No production portfolio data is sent to lookup services.
- Typecheck and tests pass.

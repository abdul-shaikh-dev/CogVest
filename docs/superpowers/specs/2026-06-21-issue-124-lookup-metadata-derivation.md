# Issue 124 Add Holding Metadata Derivation Design

## Context

Issue #124 follows the Add Holding lookup-flow polish from issue #117. The app
already lets the user search public asset directories, explicitly select a
result, review the selected asset, fetch a live current price, and manually
fallback when lookup or quote fetching fails.

This issue owns the metadata derivation behavior behind that flow. The goal is
to reduce manual entry for ticker, symbol, exchange, quote source, instrument
type, sector/type, and current price without silently saving guessed values as
facts.

## Goals

- Keep lookup selection explicit. Search results must never auto-pick the first
  result.
- Auto-fill reliable provider values after selection: name, symbol, ticker,
  exchange, currency, quote source, asset class, and live current price where
  available.
- Make instrument type and sector/type reviewable suggestions.
- Distinguish confident provider/inference values from low-confidence defaults.
- Avoid blindly saving incorrect sector metadata, especially for Yahoo Finance
  equity results where sector is not available in the current search response.
- Preserve manual fallback and user overrides.
- Keep provider mapping logic outside React components.
- Persist only the final user-confirmed asset/opening-position records.

## Non-Goals

- Do not add a backend, auth, cloud sync, or server-side finance API.
- Do not add Python `yfinance`; this work uses the existing client-side Yahoo
  Finance and CoinGecko lookup seams.
- Do not implement advanced V3 asset search.
- Do not redesign Holdings, Dashboard, Cash, Progress, or Settings.
- Do not add a new multi-screen Add Holding route; keep the existing progressive
  form.

## Provider Strategy

### Yahoo Finance

The current Yahoo search endpoint reliably provides identity and listing fields
such as ticker, display name, quote type, and symbol. It does not reliably
provide business sector in the current app response shape.

For Yahoo results:

- Treat name, ticker, symbol, exchange, currency, quote source, and source label
  as provider-derived suggestions.
- Treat `quoteType: ETF` as a confident mapping to `assetClass: etf`,
  `instrumentType: etf`, and `sectorType: diversified`.
- Treat `quoteType: EQUITY` or missing/unknown stock-like quote types as
  stock-like for asset class and instrument type.
- Do not mark stock sector as provider-derived when Yahoo search does not
  provide a sector. Use `sectorType: other` with a review-required status rather
  than defaulting all stocks to `financialServices`.
- Continue using the Yahoo chart quote endpoint for live current price.

### CoinGecko

CoinGecko search results are crypto-specific and provide a reliable coin ID for
quote source mapping.

For CoinGecko results:

- Treat name, symbol, ticker/coin ID, `assetClass: crypto`,
  `instrumentType: crypto`, `sectorType: digitalAsset`, `exchange: CRYPTO`, and
  `currency: INR` as confident provider/inference suggestions.
- Continue using CoinGecko quote fetching for live INR current price.

## Metadata Confidence Model

Extend lookup results with metadata review information instead of adding logic
inside UI components.

Each lookup result should expose a small metadata suggestion summary:

- `instrumentTypeConfidence`: `provider` | `inferred` | `reviewRequired`
- `sectorTypeConfidence`: `provider` | `inferred` | `reviewRequired`
- `metadataReviewMessage`: short user-facing text explaining what needs review

Interpretation:

- `provider`: provider supplied or provider-specific mapping is reliable.
- `inferred`: CogVest inferred the value from a reliable provider category such
  as ETF or crypto.
- `reviewRequired`: CogVest cannot know this value confidently; user should
  confirm or edit before saving.

This confidence state is display/supporting state. It should not replace the
existing persisted `Asset` type unless a future issue explicitly adds persisted
metadata provenance.

## Add Holding UX

After selecting a lookup result:

- The Asset phase shows the selected asset summary from issue #117.
- The Confirm details phase shows provider suggestion copy:
  `Suggested details. Confirm anything marked for review.`
- Instrument type and sector/type remain editable.
- Fields marked `reviewRequired` should show a small inline hint, not a blocking
  warning, because manual review is the intended path.
- If the user edits instrument type or sector/type, the selected lookup summary
  should remain usable; editing metadata should not force the user back to an
  unselected asset state.
- If lookup or live quote fetching fails, the user can keep entering details
  manually.

## Data Flow

1. User types in the Add Holding search field.
2. `searchAssetLookupResults` fetches Yahoo and CoinGecko results.
3. Provider-specific mappers convert raw results into `AssetLookupResult`
   objects with metadata confidence and review messages.
4. User explicitly selects a lookup result.
5. `useAddOpeningPosition` applies selected identity/metadata values to the
   form and fetches the live current price through the existing quote resolver.
6. User reviews/edits details in Confirm details and Position.
7. Review/save persists only the final asset and opening position.

## Error Handling

- Search provider failures continue to be partial: one provider may fail while
  the other still returns results.
- No-result and provider-error states remain manual fallback states.
- Quote failures clear current price and show manual price fallback.
- Low-confidence metadata is not an error; it is a review-required hint.

## Testing

Add or update tests for:

- Yahoo equity lookup maps sector to `other` with sector review required when no
  sector exists in the search response.
- Yahoo ETF lookup maps instrument/sector confidently.
- CoinGecko lookup maps crypto metadata confidently.
- Add Holding selection displays review-required metadata copy/hints.
- User can override instrument type and sector/type before save.
- Metadata editing does not clear the selected lookup asset summary.
- Manual fallback still works when lookup or quote fetch fails.

Verification before PR:

- `npm run typecheck`
- `npm test -- --runInBand src/services/assetLookup/__tests__/assetLookup.test.ts src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`
- `npm test -- --runInBand`
- `npm run doctor`
- `npm run android:smoke`
- `npm run test:v1:pc`

## Acceptance Criteria Mapping

- Selecting a lookup result populates identity and metadata suggestions.
- Instrument type and sector/type remain editable before save.
- Missing/ambiguous sector metadata is marked review-required instead of saved
  as a confident default.
- Current price comes from live quote when available, otherwise manual fallback.
- Manual entry still works when lookup fails.
- Provider mapping stays in `src/services/assetLookup`, not UI components.
- Tests cover successful derivation, missing metadata, and manual override.

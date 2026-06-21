# Issue 124 Add Holding Metadata Derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add confidence-aware Add Holding lookup metadata so provider suggestions reduce manual entry without silently saving guessed instrument or sector values.

**Architecture:** Keep provider mapping in `src/services/assetLookup`. Extend `AssetLookupResult` with metadata confidence/review fields, consume those fields in `useAddOpeningPosition`, and render small review hints in `AddOpeningPositionForm`. Persisted `Asset` records remain unchanged; only final user-confirmed values are saved.

**Tech Stack:** Expo React Native, TypeScript, Jest, React Native Testing Library, existing Yahoo Finance/CoinGecko lookup services.

---

## File Map

- Modify: `src/services/assetLookup/index.ts`
  - Owns lookup result shape, Yahoo/CoinGecko mapping, and metadata confidence.
- Modify: `src/services/assetLookup/__tests__/assetLookup.test.ts`
  - Covers provider metadata mapping and confidence behavior.
- Modify: `src/features/openingPositions/useAddOpeningPosition.ts`
  - Carries selected lookup metadata review state and preserves selection when metadata fields are edited.
- Modify: `src/features/openingPositions/AddOpeningPositionForm.tsx`
  - Displays review hint copy in Confirm details.
- Modify: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`
  - Covers review hints, manual override, and selected summary retention.
- Verify existing: `e2e/add-holding-lookup.yaml`
  - Confirm stable IDs still cover lookup selection; update only if the UI test target changes.

---

### Task 1: Extend Lookup Metadata Confidence Types

**Files:**
- Modify: `src/services/assetLookup/index.ts`
- Modify: `src/services/assetLookup/__tests__/assetLookup.test.ts`

- [x] **Step 1: Add failing service expectations for metadata confidence**

Update `src/services/assetLookup/__tests__/assetLookup.test.ts` so the Yahoo equity test expects stock instrument confidence but sector review-required:

```ts
expect(
  mapYahooQuoteToLookupResult({
    exchange: "NSI",
    longname: "HDFC Bank Limited",
    quoteType: "EQUITY",
    shortname: "HDFC Bank",
    symbol: "HDFCBANK.NS",
  }),
).toEqual({
  assetClass: "stock",
  currency: "INR",
  exchange: "NSE",
  id: "yahoo:HDFCBANK.NS",
  instrumentType: "stock",
  instrumentTypeConfidence: "inferred",
  metadataReviewMessage: "Sector needs review. Yahoo did not provide a sector.",
  name: "HDFC Bank Limited",
  provider: "yahoo",
  quoteSourceId: "HDFCBANK.NS",
  sectorType: "other",
  sectorTypeConfidence: "reviewRequired",
  sourceLabel: "Yahoo Finance",
  symbol: "HDFCBANK",
  ticker: "HDFCBANK.NS",
});
```

Update the ETF and CoinGecko tests to expect:

```ts
instrumentTypeConfidence: "inferred",
sectorTypeConfidence: "inferred",
metadataReviewMessage: "Provider details look ready. Confirm before saving.",
```

- [x] **Step 2: Run service tests and confirm they fail**

Run:

```powershell
npm test -- --runInBand src/services/assetLookup/__tests__/assetLookup.test.ts
```

Expected: tests fail because `AssetLookupResult` does not yet include confidence fields and Yahoo equity still maps `sectorType` to `financialServices`.

- [x] **Step 3: Implement metadata confidence fields**

In `src/services/assetLookup/index.ts`, add:

```ts
export type AssetMetadataConfidence = "inferred" | "provider" | "reviewRequired";
```

Extend `AssetLookupResult`:

```ts
instrumentTypeConfidence: AssetMetadataConfidence;
metadataReviewMessage: string;
sectorTypeConfidence: AssetMetadataConfidence;
```

Update `mapYahooQuoteToLookupResult`:

```ts
const quoteType = quote.quoteType?.toUpperCase();
const isEtf = quoteType === "ETF";
const assetClass = isEtf ? "etf" : "stock";
const defaults = getDefaultAssetMetadata(assetClass);
const sectorType = isEtf ? defaults.sectorType : "other";
const sectorTypeConfidence = isEtf ? "inferred" : "reviewRequired";
```

Return:

```ts
instrumentType: defaults.instrumentType,
instrumentTypeConfidence: "inferred",
metadataReviewMessage: isEtf
  ? "Provider details look ready. Confirm before saving."
  : "Sector needs review. Yahoo did not provide a sector.",
sectorType,
sectorTypeConfidence,
```

Update `mapCoinGeckoCoinToLookupResult` with:

```ts
instrumentTypeConfidence: "inferred",
metadataReviewMessage: "Provider details look ready. Confirm before saving.",
sectorTypeConfidence: "inferred",
```

- [x] **Step 4: Run service tests and confirm they pass**

Run:

```powershell
npm test -- --runInBand src/services/assetLookup/__tests__/assetLookup.test.ts
```

Expected: service tests pass.

---

### Task 2: Carry Review Hints Through Add Holding State

**Files:**
- Modify: `src/features/openingPositions/useAddOpeningPosition.ts`
- Modify: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`

- [x] **Step 1: Add failing form tests for review hints and selection retention**

In `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`, update lookup fixtures to include confidence fields.

Add a test:

```ts
it("shows review-required metadata hints for low-confidence lookup fields", async () => {
  jest.useFakeTimers();
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  const lookupResult: AssetLookupResult = {
    assetClass: "stock",
    currency: "INR",
    exchange: "NSE",
    id: "yahoo:HDFCBANK.NS",
    instrumentType: "stock",
    instrumentTypeConfidence: "inferred",
    metadataReviewMessage: "Sector needs review. Yahoo did not provide a sector.",
    name: "HDFC Bank Limited",
    provider: "yahoo",
    quoteSourceId: "HDFCBANK.NS",
    sectorType: "other",
    sectorTypeConfidence: "reviewRequired",
    sourceLabel: "Yahoo Finance",
    symbol: "HDFCBANK",
    ticker: "HDFCBANK.NS",
  };
  const searchAssetLookupResults = jest.fn().mockResolvedValue({
    failures: [],
    results: [lookupResult],
  });
  const resolveQuote = jest.fn().mockResolvedValue({
    ok: true,
    quote: {
      assetId: "asset-id",
      asOf: "2026-05-10T10:00:00.000Z",
      currency: "INR",
      price: 1678.25,
      source: "yahoo",
    },
  });
  const { getByLabelText, getByTestId, getByText } = render(
    <AddOpeningPositionForm
      resolveQuote={resolveQuote}
      searchAssetLookupResults={searchAssetLookupResults}
      store={store}
    />,
  );

  fireEvent.changeText(getByLabelText("Search asset"), "hdfc bank");
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  await waitFor(() => {
    expect(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS")).toBeTruthy();
  });
  fireEvent.press(getByTestId("asset-lookup-result-yahoo:HDFCBANK.NS"));
  await waitFor(() => {
    expect(getByTestId("selected-asset-summary")).toBeTruthy();
  });

  fireEvent.press(getByText("Continue to classification"));

  expect(getByText("Suggested details. Confirm anything marked for review.")).toBeTruthy();
  expect(getByText("Sector needs review. Yahoo did not provide a sector.")).toBeTruthy();
  expect(getByLabelText("Sector type")).toHaveProp("value", "other");
});
```

Add a second test that edits `Sector type` after selecting a lookup result and verifies `selected-asset-summary` remains present when returning to the Asset phase:

```ts
fireEvent.changeText(getByLabelText("Sector type"), "financialServices");
fireEvent.press(getByText("Asset"));
expect(getByTestId("selected-asset-summary")).toBeTruthy();
```

- [x] **Step 2: Run form tests and confirm they fail**

Run:

```powershell
npm test -- --runInBand src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx
```

Expected: tests fail because review hint rendering and metadata-edit selection retention are not implemented yet.

- [x] **Step 3: Add controller metadata review state**

In `src/features/openingPositions/useAddOpeningPosition.ts`, add:

```ts
const defaultMetadataReviewMessage = "Manual details. Review before saving.";
const [metadataReviewMessage, setMetadataReviewMessage] = useState(
  defaultMetadataReviewMessage,
);
const [instrumentTypeConfidence, setInstrumentTypeConfidence] =
  useState<AssetLookupResult["instrumentTypeConfidence"]>("reviewRequired");
const [sectorTypeConfidence, setSectorTypeConfidence] =
  useState<AssetLookupResult["sectorTypeConfidence"]>("reviewRequired");
```

In `selectLookupResult(result)`, set these fields from the result.

In `selectAsset(asset)`, set:

```ts
setMetadataReviewMessage("Saved asset details. Confirm before continuing.");
setInstrumentTypeConfidence("provider");
setSectorTypeConfidence("provider");
```

In `changeSelectedAsset()`, reset these fields to manual defaults.

Do not call `clearSelectedAsset()` from instrument/sector text changes anymore. Metadata edits are user confirmation/correction, not asset identity changes.

Return:

```ts
instrumentTypeConfidence,
metadataReviewMessage,
sectorTypeConfidence,
```

- [x] **Step 4: Render review hints**

In `src/features/openingPositions/AddOpeningPositionForm.tsx`, destructure the three new controller values.

Replace the Confirm details copy with:

```tsx
<AppText color="secondary" testID="provider-metadata-review-copy" variant="caption">
  Suggested details. Confirm anything marked for review.
</AppText>
```

Below the selected asset summary or above the metadata inputs, render:

```tsx
<AppText color="secondary" testID="metadata-review-message" variant="caption">
  {metadataReviewMessage}
</AppText>
```

Below each metadata field, render conditional hint text:

```tsx
{instrumentTypeConfidence === "reviewRequired" ? (
  <AppText color="warning" testID="instrument-type-review-hint" variant="caption">
    Review instrument type before saving.
  </AppText>
) : null}
{sectorTypeConfidence === "reviewRequired" ? (
  <AppText color="warning" testID="sector-type-review-hint" variant="caption">
    Review sector/type before saving.
  </AppText>
) : null}
```

If `AppText` does not support `warning`, use `color="secondary"` and rely on the text; do not introduce a new theme token in this task.

- [x] **Step 5: Run form tests and confirm they pass**

Run:

```powershell
npm test -- --runInBand src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx
```

Expected: form tests pass.

---

### Task 3: Preserve Save and Override Behavior

**Files:**
- Modify: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`
- Modify: `src/features/openingPositions/useAddOpeningPosition.ts`

- [x] **Step 1: Add or update save test for manual metadata override**

Extend the lookup-selection test or add a new test that:

1. Selects a Yahoo equity lookup result with `sectorType: "other"`.
2. Continues to Confirm details.
3. Edits `Sector type` to `financialServices`.
4. Completes position fields.
5. Saves.
6. Expects persisted asset sector to be `financialServices`.

Expected assertion:

```ts
expect(store.getState().assets[0]).toMatchObject({
  instrumentType: "stock",
  sectorType: "financialServices",
  quoteSourceId: "HDFCBANK.NS",
});
```

- [x] **Step 2: Run the form test and confirm behavior**

Run:

```powershell
npm test -- --runInBand src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx
```

Expected: passes after Task 2 changes. If it fails because metadata edits clear selection or review state, fix the controller so only asset identity edits clear selected lookup state.

- [x] **Step 3: Confirm e2e lookup flow IDs are still valid**

Inspect `e2e/add-holding-lookup.yaml`.

Expected: no changes needed if it still taps `asset-lookup-result-*`, `continue-class-button`, `continue-position-button`, `review-holding-button`, and `save-holding-button`.

---

### Task 4: Full Verification

**Files:**
- No code changes unless verification finds defects.

- [x] **Step 1: Typecheck**

Run:

```powershell
npm run typecheck
```

Expected: exit 0.

- [x] **Step 2: Focused lookup/form tests**

Run:

```powershell
npm test -- --runInBand src/services/assetLookup/__tests__/assetLookup.test.ts src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx
```

Expected: both suites pass.

- [x] **Step 3: Full Jest**

Run:

```powershell
npm test -- --runInBand
```

Expected: all suites pass.

- [x] **Step 4: Expo doctor**

Run:

```powershell
npm run doctor
```

Expected: Expo doctor passes or warnings are documented.

- [x] **Step 5: Android smoke**

Run:

```powershell
npm run android:smoke
```

Expected: emulator and `com.abdulshaikh.cogvest` package status is printed. If the emulator is unavailable, document the exact reason.

- [x] **Step 6: V1 PC gate**

Run:

```powershell
npm run test:v1:pc
```

Expected: exit 0 or failures logged with defects.

---

### Task 5: Delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-06-21-issue-124-lookup-metadata-derivation.md`

- [x] **Step 1: Review diff**

Run:

```powershell
git diff --check
git diff --stat
git status --short --branch
```

Expected: only #124 files changed; no whitespace errors.

- [x] **Step 2: Commit implementation**

Run:

```powershell
git add src/services/assetLookup src/features/openingPositions docs/superpowers/plans/2026-06-21-issue-124-lookup-metadata-derivation.md
git commit -m "Derive Add Holding metadata with review hints"
```

- [x] **Step 3: Push branch**

Run:

```powershell
git push -u origin v1/issue-124-lookup-metadata-derivation
```

- [x] **Step 4: Create PR**

Create PR title:

```text
Derive Add Holding metadata with review hints
```

PR body must include:

```markdown
## Summary
- Adds confidence-aware metadata suggestions to lookup results.
- Marks low-confidence Yahoo equity sector data for review instead of saving a confident default.
- Shows Add Holding review hints while preserving manual override and fallback.

## Verification
- npm run typecheck
- npm test -- --runInBand src/services/assetLookup/__tests__/assetLookup.test.ts src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx
- npm test -- --runInBand
- npm run doctor
- npm run android:smoke
- npm run test:v1:pc

Closes #124
```

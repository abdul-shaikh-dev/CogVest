# Smart Month-End Snapshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically generate missing completed-month snapshots with V1 historical month-end prices and transparent fallbacks.

**Architecture:** Add a focused historical-price service, a pure monthly snapshot generator, and a small Progress integration layer. Keep provider/network code under `src/services/quotes`, pure derivation under `src/domain/calculations`, and UI state in `src/features/progress`.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, Zustand vanilla store, Jest, React Native Testing Library, Yahoo chart API, CoinGecko API, existing `react-native-gifted-charts` Progress charts.

---

## File Map

- Create `src/services/quotes/historicalPrices.ts`: provider URL builders and historical price fetchers.
- Modify `src/services/quotes/types.ts`: historical price input/result types.
- Modify `src/services/quotes/utils.ts`: add CoinGecko market-chart base URL and shared date helpers.
- Modify `src/services/quotes/index.ts`: export historical price functions/types.
- Create `src/services/quotes/__tests__/historicalPrices.test.ts`: provider URL, parsing, fallback tests.
- Modify `src/types/quote.ts`: add historical quote cache and price basis types.
- Modify `src/types/monthlySnapshot.ts`: add optional generated metadata.
- Modify `src/store/index.ts`: persist historical quote cache and preserve backwards compatibility.
- Modify `src/store/__tests__/portfolioStore.test.ts`: storage/migration tests.
- Create `src/domain/calculations/monthEndSnapshots.ts`: pure snapshot target-month and generated-payload logic.
- Create `src/domain/calculations/__tests__/monthEndSnapshots.test.ts`: pure generator tests.
- Modify `src/domain/calculations/index.ts`: export generator types/functions.
- Modify `src/features/progress/useProgress.ts`: call generator idempotently and expose status/edit state.
- Create `src/features/progress/useMonthEndSnapshotAutomation.ts`: reusable app-launch and Progress-open automation hook.
- Modify `src/features/progress/ProgressScreen.tsx`: replace manual default form with compact status/review UI.
- Modify `app/_layout.tsx`: run automatic snapshot generation on app launch through a headless component.
- Modify `src/features/progress/__tests__/useProgress.test.tsx`: automatic generation hook tests.
- Modify `src/features/progress/__tests__/ProgressScreen.test.tsx`: UI state tests.
- Modify `docs/testing/v1-core-flow-test-matrix.md` if the manual flow matrix still describes the old giant snapshot form.

---

## Task 1: Add Snapshot Metadata And Historical Cache Types

**Files:**
- Modify: `src/types/quote.ts`
- Modify: `src/types/monthlySnapshot.ts`
- Modify: `src/store/index.ts`
- Test: `src/store/__tests__/portfolioStore.test.ts`

- [x] **Step 1: Write failing storage/type tests**

Add a test proving historical quotes persist separately from the raw portfolio snapshot and generated metadata survives monthly snapshot persistence.

```ts
it("persists generated monthly snapshot metadata and historical quotes", () => {
  const storage = createMemoryJsonStorage();
  const store = createPortfolioStore({ storage });

  store.getState().addMonthlySnapshot({
    cashValue: 50000,
    cryptoValue: 100000,
    debtValue: 200000,
    equityValue: 700000,
    generated: {
      generatedAt: "2026-08-01T04:00:00.000Z",
      priceBasis: "mixed",
      source: "auto",
      warnings: ["1 asset used latest local fallback"],
    },
    id: "snapshot-2026-07",
    investedValue: 900000,
    month: "2026-07",
    monthlyInvestment: 45000,
    portfolioValue: 1050000,
    salary: 0,
  });
  store.getState().upsertHistoricalQuote({
    assetId: "asset-reliance",
    asOfMonth: "2026-07",
    basis: "historical-close",
    currency: "INR",
    fetchedAt: "2026-08-01T04:00:00.000Z",
    price: 2910,
    source: "yahoo",
  });

  const rehydrated = createPortfolioStore({ storage });

  expect(rehydrated.getState().monthlySnapshots[0]?.generated).toMatchObject({
    priceBasis: "mixed",
    source: "auto",
  });
  expect(
    rehydrated.getState().historicalQuoteCache["asset-reliance:2026-07"],
  ).toMatchObject({
    basis: "historical-close",
    price: 2910,
  });
});
```

Run:

```powershell
npm test -- src/store/__tests__/portfolioStore.test.ts
```

Expected: FAIL because `generated`, `historicalQuoteCache`, and `upsertHistoricalQuote` do not exist.

- [x] **Step 2: Extend quote/monthly snapshot types**

Add these types in `src/types/quote.ts`:

```ts
export type HistoricalPriceBasis =
  | "historical-close"
  | "cached-historical-close"
  | "latest-local-fallback"
  | "manual-fallback"
  | "unavailable";

export type HistoricalQuote = {
  assetId: string;
  asOfMonth: string;
  basis: HistoricalPriceBasis;
  currency: Currency;
  fetchedAt: string;
  price: number;
  source: QuoteSource;
};

export type HistoricalQuoteCache = Record<string, HistoricalQuote>;
```

Add this metadata in `src/types/monthlySnapshot.ts`:

```ts
export type MonthlySnapshotGenerationMetadata = {
  generatedAt: string;
  priceBasis:
    | "historical-close"
    | "mixed"
    | "latest-local-fallback"
    | "manual-fallback"
    | "unavailable";
  source: "auto" | "manual";
  warnings: string[];
};
```

Then add `generated?: MonthlySnapshotGenerationMetadata` to `MonthlySnapshot`.

- [x] **Step 3: Extend the store with historical quote cache**

In `src/store/index.ts`, add `historicalQuoteCacheStorageKey`, state field, action, read/write helpers, and a stable cache key:

```ts
export const historicalQuoteCacheStorageKey =
  "cogvest:v1:historical-quote-cache";

export function historicalQuoteCacheKey(assetId: string, asOfMonth: string) {
  return `${assetId}:${asOfMonth}`;
}
```

Add to `PortfolioStoreState`:

```ts
historicalQuoteCache: HistoricalQuoteCache;
upsertHistoricalQuote: (historicalQuote: HistoricalQuote) => void;
```

Persist historical quote cache separately from `portfolioStorageKey`, mirroring `quoteCache`.

- [x] **Step 4: Run storage tests**

Run:

```powershell
npm test -- src/store/__tests__/portfolioStore.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```powershell
git add src/types/quote.ts src/types/monthlySnapshot.ts src/store/index.ts src/store/__tests__/portfolioStore.test.ts
git commit -m "Add generated snapshot metadata storage"
```

---

## Task 2: Add Historical Price Provider Service

**Files:**
- Create: `src/services/quotes/historicalPrices.ts`
- Modify: `src/services/quotes/types.ts`
- Modify: `src/services/quotes/utils.ts`
- Modify: `src/services/quotes/index.ts`
- Test: `src/services/quotes/__tests__/historicalPrices.test.ts`

- [x] **Step 1: Write failing provider tests**

Create tests covering Yahoo historical close, CoinGecko history/range, cached fallback shape, and failure result.

```ts
it("builds Yahoo historical chart URLs around the target month end", () => {
  expect(buildYahooHistoricalChartUrl("RELIANCE.NS", "2026-07")).toContain(
    "https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS?",
  );
  expect(buildYahooHistoricalChartUrl("RELIANCE.NS", "2026-07")).toContain(
    "interval=1d",
  );
});

it("maps Yahoo historical closes to the latest close on or before month end", async () => {
  const fetcher = jest.fn().mockResolvedValue(
    response({
      chart: {
        result: [
          {
            indicators: {
              quote: [
                {
                  close: [2800, 2815, 2910],
                },
              ],
            },
            meta: {
              currency: "INR",
            },
            timestamp: [1785283200, 1785369600, 1785456000],
          },
        ],
      },
    }),
  );

  const result = await fetchYahooHistoricalPrice({
    asset: reliance,
    fetcher,
    targetMonth: "2026-07",
    now: () => "2026-08-01T04:00:00.000Z",
  });

  expect(result).toMatchObject({
    ok: true,
    quote: {
      assetId: reliance.id,
      asOfMonth: "2026-07",
      basis: "historical-close",
      price: 2910,
      source: "yahoo",
    },
  });
});
```

Run:

```powershell
npm test -- src/services/quotes/__tests__/historicalPrices.test.ts
```

Expected: FAIL because the file/functions do not exist.

- [x] **Step 2: Add historical service types**

Add in `src/services/quotes/types.ts`:

```ts
export type HistoricalPriceSuccess = {
  ok: true;
  quote: HistoricalQuote;
};

export type HistoricalPriceFailure = {
  error: string;
  ok: false;
};

export type HistoricalPriceResult =
  | HistoricalPriceSuccess
  | HistoricalPriceFailure;

export type HistoricalPriceProviderInput = {
  asset: Asset;
  fetcher?: QuoteFetcher;
  now?: QuoteNow;
  targetMonth: string;
};
```

- [x] **Step 3: Implement provider URL helpers and parsers**

Create `src/services/quotes/historicalPrices.ts` with:

```ts
export function getMonthEndDateUtc(targetMonth: string) {
  const [year, month] = targetMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0, 23, 59, 59));
}

export function buildYahooHistoricalChartUrl(ticker: string, targetMonth: string) {
  const monthEnd = getMonthEndDateUtc(targetMonth);
  const period2 = Math.floor(monthEnd.getTime() / 1000) + 1;
  const period1 = period2 - 14 * 24 * 60 * 60;
  const params = new URLSearchParams({
    interval: "1d",
    period1: String(period1),
    period2: String(period2),
  });

  return `${yahooChartBaseUrl}/${encodeURIComponent(ticker)}?${params.toString()}`;
}
```

Also add:

```ts
export async function fetchYahooHistoricalPrice(
  input: HistoricalPriceProviderInput,
): Promise<HistoricalPriceResult> {
  const response = await (input.fetcher ?? getDefaultFetcher())(
    buildYahooHistoricalChartUrl(
      input.asset.quoteSourceId ?? input.asset.ticker,
      input.targetMonth,
    ),
  );

  if (!response.ok) {
    return {
      error: `Yahoo historical price request failed with status ${response.status}.`,
      ok: false,
    };
  }

  const payload = (await response.json()) as YahooHistoricalChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const monthEndSeconds =
    Math.floor(getMonthEndDateUtc(input.targetMonth).getTime() / 1000) + 1;
  const latestClose = timestamps
    .map((timestamp, index) => ({ close: closes[index], timestamp }))
    .filter(
      (point) =>
        point.timestamp <= monthEndSeconds &&
        typeof point.close === "number" &&
        Number.isFinite(point.close),
    )
    .at(-1);

  if (!latestClose) {
    return {
      error: "Yahoo historical price response did not include a usable close.",
      ok: false,
    };
  }

  return {
    ok: true,
    quote: {
      assetId: input.asset.id,
      asOfMonth: input.targetMonth,
      basis: "historical-close",
      currency: "INR",
      fetchedAt: (input.now ?? defaultNow)(),
      price: roundQuoteNumber(latestClose.close),
      source: "yahoo",
    },
  };
}
```

For CoinGecko, add a URL builder using market chart range:

```ts
export function buildCoinGeckoHistoricalRangeUrl(coinId: string, targetMonth: string) {
  const monthEnd = getMonthEndDateUtc(targetMonth);
  const to = Math.floor(monthEnd.getTime() / 1000) + 1;
  const from = to - 3 * 24 * 60 * 60;
  const params = new URLSearchParams({
    from: String(from),
    to: String(to),
    vs_currency: "inr",
  });

  return `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(
    coinId,
  )}/market_chart/range?${params.toString()}`;
}
```

Then add `fetchCoinGeckoHistoricalPrice` that picks the last price point at or
before month end.

- [x] **Step 4: Add resolver with unsupported/manual fallback signal**

Add:

```ts
export async function resolveHistoricalPrice(
  input: HistoricalPriceProviderInput,
): Promise<HistoricalPriceResult> {
  if (input.asset.assetClass === "cash" || input.asset.assetClass === "debt") {
    return {
      error: "Historical provider prices are not available for this asset class.",
      ok: false,
    };
  }

  return input.asset.assetClass === "crypto"
    ? fetchCoinGeckoHistoricalPrice(input)
    : fetchYahooHistoricalPrice(input);
}
```

- [x] **Step 5: Export functions and run tests**

Modify `src/services/quotes/index.ts` to export historical helpers and types.

Run:

```powershell
npm test -- src/services/quotes/__tests__/historicalPrices.test.ts src/services/quotes/__tests__/quotes.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```powershell
git add src/services/quotes src/types/quote.ts
git commit -m "Add historical price lookup service"
```

---

## Task 3: Build Pure Month-End Snapshot Generator

**Files:**
- Create: `src/domain/calculations/monthEndSnapshots.ts`
- Modify: `src/domain/calculations/index.ts`
- Test: `src/domain/calculations/__tests__/monthEndSnapshots.test.ts`

- [x] **Step 1: Write failing generator tests**

Create tests for target-month calculation, no-data skip, idempotency, and generated values.

```ts
it("selects the previous completed month", () => {
  expect(getPreviousCompletedMonth(new Date("2026-08-15T10:00:00.000Z"))).toBe(
    "2026-07",
  );
  expect(getPreviousCompletedMonth(new Date("2026-01-01T10:00:00.000Z"))).toBe(
    "2025-12",
  );
});

it("returns skipped when target snapshot already exists", () => {
  const result = buildGeneratedMonthEndSnapshot({
    assets: [],
    cashEntries: [],
    existingSnapshots: [
      {
        cashValue: 0,
        cryptoValue: 0,
        debtValue: 0,
        equityValue: 0,
        id: "snapshot-2026-07",
        investedValue: 0,
        month: "2026-07",
        monthlyInvestment: 0,
        portfolioValue: 0,
        salary: 0,
      },
    ],
    historicalQuotes: {},
    now: new Date("2026-08-02T10:00:00.000Z"),
    openingPositions: [],
    quoteCache: {},
    trades: [],
  });

  expect(result.status).toBe("already-exists");
});
```

Run:

```powershell
npm test -- src/domain/calculations/__tests__/monthEndSnapshots.test.ts
```

Expected: FAIL because generator file does not exist.

- [x] **Step 2: Implement target-month and result types**

In `monthEndSnapshots.ts`, add:

```ts
export type GeneratedSnapshotStatus =
  | "already-exists"
  | "created"
  | "insufficient-data";

export type GeneratedMonthEndSnapshotResult = {
  snapshot: MonthlySnapshot | null;
  status: GeneratedSnapshotStatus;
  warnings: string[];
};
```

Add `getPreviousCompletedMonth(now: Date)` returning `YYYY-MM`.

- [x] **Step 3: Implement price selection**

Create a helper that prefers historical quotes, then latest local quotes, then
opening-position manual current price:

```ts
function getSnapshotPrice({
  asset,
  historicalQuotes,
  openingPositions,
  quoteCache,
  targetMonth,
}: SnapshotPriceInput): SnapshotPriceResult {
  const historical = historicalQuotes[historicalQuoteCacheKey(asset.id, targetMonth)];

  if (historical) {
    return { basis: historical.basis, price: historical.price };
  }

  const latest = quoteCache[asset.id];

  if (latest) {
    return { basis: "latest-local-fallback", price: latest.price };
  }

  const manual = [...openingPositions]
    .filter((position) => position.assetId === asset.id)
    .find((position) => position.currentPrice !== undefined)?.currentPrice;

  if (manual !== undefined) {
    return { basis: "manual-fallback", price: manual };
  }

  return { basis: "unavailable", price: null };
}
```

- [x] **Step 4: Implement generated snapshot calculation**

Use existing `calculateHoldings`, `calculateCashBalance`, `calculatePortfolioTotal`,
and asset-class grouping. Monthly investment must filter buys/opening positions
whose date falls inside `targetMonth`.

Set `salary: 0` and omit `monthlyExpense` by default because V1 cannot derive
those reliably.

- [x] **Step 5: Export and run tests**

Modify `src/domain/calculations/index.ts`.

Run:

```powershell
npm test -- src/domain/calculations/__tests__/monthEndSnapshots.test.ts src/domain/calculations/__tests__/holdings.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```powershell
git add src/domain/calculations
git commit -m "Add generated month-end snapshot calculation"
```

---

## Task 4: Integrate Automatic Generation In Progress Controller

**Files:**
- Modify: `src/features/progress/useProgress.ts`
- Create: `src/features/progress/useMonthEndSnapshotAutomation.ts`
- Test: `src/features/progress/__tests__/useProgress.test.tsx`

- [x] **Step 1: Write failing hook tests**

Replace the old manual-save-only test with tests for automatic generation.

```ts
it("auto-generates the previous completed month snapshot once", async () => {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  seedHoldingAndCash(store);

  const { result } = renderHook(() =>
    useProgress({
      now: new Date("2026-08-02T10:00:00.000Z"),
      store,
    }),
  );

  await act(async () => {
    await result.current.ensureMonthEndSnapshot();
  });

  expect(store.getState().monthlySnapshots).toHaveLength(1);
  expect(store.getState().monthlySnapshots[0]).toMatchObject({
    generated: {
      source: "auto",
    },
    month: "2026-07",
  });

  await act(async () => {
    await result.current.ensureMonthEndSnapshot();
  });

  expect(store.getState().monthlySnapshots).toHaveLength(1);
});
```

Run:

```powershell
npm test -- src/features/progress/__tests__/useProgress.test.tsx
```

Expected: FAIL because `now` and `ensureMonthEndSnapshot` do not exist.

- [x] **Step 2: Extend `useProgress` input**

Add optional inputs:

```ts
type UseProgressInput = {
  historicalPriceFetcher?: typeof resolveHistoricalPrice;
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
};
```

Use `now ?? new Date()` for target-month calculations and tests.

- [x] **Step 3: Add `ensureMonthEndSnapshot`**

Implement as an async function:

1. Determine target month.
2. For assets needing historical prices, resolve and cache historical prices.
3. Build generated snapshot from current store state.
4. Add the snapshot only when status is `created`.
5. Set a local `snapshotAutomationStatus` object for UI.

Do not trigger generation in render. Use an explicit function exposed from the hook first; the screen will call it from an effect in Task 5.

- [x] **Step 4: Add reusable automation hook**

Create `src/features/progress/useMonthEndSnapshotAutomation.ts`:

```ts
import { useEffect, useRef } from "react";
import type { StoreApi } from "zustand/vanilla";

import { getPortfolioStore, type PortfolioStoreState } from "@/src/store";

import { useProgress } from "./useProgress";

export function useMonthEndSnapshotAutomation({
  enabled = true,
  now,
  store = getPortfolioStore(),
}: {
  enabled?: boolean;
  now?: Date;
  store?: StoreApi<PortfolioStoreState>;
} = {}) {
  const hasRunRef = useRef(false);
  const progress = useProgress({ now, store });
  const ensureMonthEndSnapshot = progress.ensureMonthEndSnapshot;

  useEffect(() => {
    if (!enabled || hasRunRef.current) {
      return;
    }

    hasRunRef.current = true;
    void ensureMonthEndSnapshot();
  }, [enabled, ensureMonthEndSnapshot]);

  return progress.snapshotAutomationStatus;
}
```

- [x] **Step 5: Preserve manual edit capability**

Keep a renamed manual upsert function such as `saveSnapshotEdits()` for review/edit flows. It can reuse `validateProgressSnapshotForm` initially, but generated values should prefill fields when edit mode opens.

- [x] **Step 6: Run hook tests**

Run:

```powershell
npm test -- src/features/progress/__tests__/useProgress.test.tsx
```

Expected: PASS.

- [x] **Step 7: Commit**

```powershell
git add src/features/progress/useProgress.ts src/features/progress/useMonthEndSnapshotAutomation.ts src/features/progress/__tests__/useProgress.test.tsx
git commit -m "Auto-generate month-end snapshots in Progress"
```

---

## Task 5: Replace Manual Progress Form With Compact Snapshot Status UI

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `src/features/progress/ProgressScreen.tsx`
- Test: `src/features/progress/__tests__/ProgressScreen.test.tsx`
- Test: `src/__tests__/rootLayout.test.tsx`

- [x] **Step 1: Write failing UI tests**

Update tests to expect compact automation status and absence of the giant manual
form by default.

```ts
it("shows compact snapshot automation status instead of the manual form", () => {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

  const { getByText, queryByTestId } = render(
    <ProgressScreen
      now={new Date("2026-08-02T10:00:00.000Z")}
      store={store}
    />,
  );

  expect(getByText("Month-end snapshot")).toBeTruthy();
  expect(queryByTestId("snapshot-portfolio-input")).toBeNull();
});
```

Run:

```powershell
npm test -- src/features/progress/__tests__/ProgressScreen.test.tsx
```

Expected: FAIL until the screen accepts `now` and replaces the manual form.

- [x] **Step 2: Run automation on app launch**

In `app/_layout.tsx`, add a small headless component inside `SafeAreaProvider`:

```tsx
function MonthEndSnapshotAutomation() {
  useMonthEndSnapshotAutomation();

  return null;
}
```

Render it before `<Stack />`:

```tsx
<StatusBar style="light" />
<MonthEndSnapshotAutomation />
<Stack screenOptions={...}>
```

Update `src/__tests__/rootLayout.test.tsx` to mock
`useMonthEndSnapshotAutomation` and assert it is called when `RootLayout`
renders.

- [x] **Step 3: Call automation from Progress screen effect**

Import `useEffect` and call `progress.ensureMonthEndSnapshot()` once when the
screen mounts or when the store state changes enough to make a missing snapshot
possible.

Guard against repeated calls with hook-level idempotency and snapshot existence.

- [x] **Step 4: Add `SnapshotStatusCard` inside `ProgressScreen.tsx`**

Add a compact card:

```tsx
function SnapshotStatusCard({
  onReview,
  status,
}: {
  onReview: () => void;
  status: ProgressSnapshotAutomationStatus;
}) {
  return (
    <PremiumCard testID="month-end-snapshot-status-card">
      <SectionHeader title="Month-end snapshot" />
      <AppText color="secondary">{status.message}</AppText>
      {status.warnings.map((warning) => (
        <AppText key={warning} color="secondary" variant="caption">
          {warning}
        </AppText>
      ))}
      <AppButton title="Review snapshot" onPress={onReview} />
    </PremiumCard>
  );
}
```

- [x] **Step 5: Hide manual fields by default**

Remove the always-visible field list from the normal screen path. Render edit
fields only when `isReviewingSnapshot === true`.

The review form can initially reuse existing `FormTextField` components but it
must be behind a `Review snapshot` action.

- [x] **Step 6: Run screen tests**

Run:

```powershell
npm test -- src/features/progress/__tests__/ProgressScreen.test.tsx src/__tests__/rootLayout.test.tsx
```

Expected: PASS.

- [x] **Step 7: Commit**

```powershell
git add app/_layout.tsx src/features/progress/ProgressScreen.tsx src/features/progress/__tests__/ProgressScreen.test.tsx src/__tests__/rootLayout.test.tsx
git commit -m "Show compact month-end snapshot status"
```

---

## Task 6: Wire Historical Fetching Into Automatic Generation

**Files:**
- Modify: `src/features/progress/useProgress.ts`
- Modify: `src/features/progress/__tests__/useProgress.test.tsx`
- Modify: `src/services/quotes/__tests__/useQuoteRefresh.test.tsx` if quote-refresh touchpoint is added

- [ ] **Step 1: Write failing historical integration test**

Add a hook test where a historical fetcher returns prices and the generated
snapshot uses those prices instead of latest quote cache.

```ts
it("uses historical prices before latest local quote fallback", async () => {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  seedHoldingAndCash(store);
  store.getState().upsertQuote({
    assetId: "asset-hdfc",
    asOf: "2026-08-02T10:00:00.000Z",
    currency: "INR",
    price: 1800,
    source: "yahoo",
  });
  const historicalPriceFetcher = jest.fn().mockResolvedValue({
    ok: true,
    quote: {
      assetId: "asset-hdfc",
      asOfMonth: "2026-07",
      basis: "historical-close",
      currency: "INR",
      fetchedAt: "2026-08-02T10:00:00.000Z",
      price: 1600,
      source: "yahoo",
    },
  });

  const { result } = renderHook(() =>
    useProgress({
      historicalPriceFetcher,
      now: new Date("2026-08-02T10:00:00.000Z"),
      store,
    }),
  );

  await act(async () => {
    await result.current.ensureMonthEndSnapshot();
  });

  expect(store.getState().monthlySnapshots[0]?.equityValue).toBe(1600 * 10);
});
```

Run:

```powershell
npm test -- src/features/progress/__tests__/useProgress.test.tsx
```

Expected: FAIL until historical fetch results are cached before generation.

- [ ] **Step 2: Cache resolved historical quotes before generation**

Inside `ensureMonthEndSnapshot`, call the injected/default historical resolver
for non-cash holdings with missing historical cache. Upsert successful quotes
before calling the pure generator.

On failure, do not throw. Collect warnings and let the generator use latest/manual fallback.

- [ ] **Step 3: Keep quote-refresh touchpoint out of the first implementation**

Do not call snapshot generation from quote refresh in this task. App launch and
Progress open are the required V1 triggers. Quote refresh improves current quote
cache; the next app-launch or Progress-open automation pass can use those quotes
or fetch historical prices directly.

- [ ] **Step 4: Run integration tests**

Run:

```powershell
npm test -- src/features/progress/__tests__/useProgress.test.tsx src/services/quotes/__tests__/historicalPrices.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/progress/useProgress.ts src/features/progress/__tests__/useProgress.test.tsx
git commit -m "Use historical prices for generated snapshots"
```

---

## Task 7: Update Docs, Full Verification, And Android Evidence

**Files:**
- Modify: `docs/testing/v1-core-flow-test-matrix.md` if old manual snapshot expectations remain.
- Modify: `docs/testing/v1-pc-verification-checklist.md` if snapshot verification steps need the new behavior.

- [ ] **Step 1: Update testing docs**

Document the new expected behavior:

```md
- Open Progress after seeded portfolio data.
- Verify missing previous-month snapshot is generated automatically.
- Verify Progress shows compact Month-end snapshot status.
- Verify generated snapshot updates charts after enough history exists.
- Verify fallback status appears when historical provider lookup is unavailable.
```

- [ ] **Step 2: Run focused tests**

Run:

```powershell
npm test -- src/services/quotes/__tests__/historicalPrices.test.ts src/domain/calculations/__tests__/monthEndSnapshots.test.ts src/features/progress/__tests__/useProgress.test.tsx src/features/progress/__tests__/ProgressScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full V1 PC gate**

Run:

```powershell
npm run test:v1:pc
```

Expected: PASS. If it fails, record the failing command, failing test, and exact defect.

- [ ] **Step 4: Install/run on emulator**

Run:

```powershell
npm run android
```

Expected: app installs on `emulator-5554` or the active Android emulator.

- [ ] **Step 5: Capture Progress evidence**

Use the visual QA seed route, then capture screenshots:

```powershell
adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d 'cogvest://visual-qa-seed'
adb -s emulator-5554 shell input keyevent 4
adb -s emulator-5554 shell input tap 640 2730
adb -s emulator-5554 shell screencap -p /sdcard/cogvest-progress-smart-snapshot.png
adb -s emulator-5554 pull /sdcard/cogvest-progress-smart-snapshot.png G:\tmp\cogvest-progress-smart-snapshot.png
```

Expected: Progress screen renders without a black screen and shows the compact
snapshot status/review behavior.

- [ ] **Step 6: Run final git diff review**

Run:

```powershell
git diff --stat
git diff --check
```

Expected: no whitespace errors; changes align with #125 only.

- [ ] **Step 7: Commit verification/doc cleanup**

```powershell
git add docs/testing src
git commit -m "Verify smart month-end snapshots"
```

---

## Plan Self-Review

- Spec coverage: automatic previous-month generation is covered by Tasks 3-5; historical V1 pricing is covered by Tasks 2 and 6; fallback transparency is covered by Tasks 1, 3, and 5; Progress compact UI is covered by Task 5; verification is covered by Task 7.
- Scope boundary: issue #150 remains future hardening for precise calendars and richer provider coverage. This plan implements only the V1 closest-provider-close rule.
- Type consistency: `HistoricalQuote`, `HistoricalQuoteCache`, `MonthlySnapshot.generated`, `ensureMonthEndSnapshot`, and `historicalPriceFetcher` are introduced before use.
- Risk: provider endpoint shape may differ in live network behavior. Unit tests use mocked responses; emulator verification should also exercise fallback states so V1 does not depend on live provider success.

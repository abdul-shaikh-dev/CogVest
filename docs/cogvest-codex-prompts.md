# CogVest — Codex CLI Prompts

> Status: historical reference only.
>
> This was the original all-in prompt set and it contains stale V1 guidance,
> including Minimal Mode, LTCG UI, History, and older Add Trade wording. Do not
> use it as the current implementation source of truth. Use `AGENTS.md`,
> `DESIGN.md`, `docs/roadmap/cogvest-version-roadmap.md`, and the current
> GitHub issues instead.
---

## How to use these prompts

1. Create `AGENTS.md` in the repo root first (see below)
2. Keep `docs/cogvest-master-spec.md`, `docs/cogvest_standard_mode.png`,
   and `docs/cogvest_minimal_mode.png` in the repo
3. Run each prompt in sequence — do not skip issues
4. After each issue: review the output, run tests, commit before moving on
5. Never start an issue if its prerequisites are not committed and green

---

## AGENTS.md — Place in repo root before starting

```markdown
# CogVest — Agent Instructions

## Project
CogVest is an Android-first React Native portfolio tracker with
behavioural investing insights and Minimal Mode.

## What this app is
- A portfolio tracker for crypto, Indian stocks (NSE/BSE), ETFs, and cash
- Base currency is INR (Indian Rupees ₹) throughout
- Behaviour-aware: conviction scoring, LTCG tracking, patience analysis
- Minimal Mode: a calmer, lower-noise UI for long-term thinking
- Local-first: no backend, no login, no cloud sync

## Stack
- React Native + Expo SDK 52+
- TypeScript only. No JavaScript files.
- Expo Router (file-based navigation)
- MMKV for fast local persistence
- Zustand for state management
- React Native Reanimated for animations
- Victory Native for charts
- React Hook Form + Zod for forms and validation

## Non-negotiable rules
- Functional components with hooks only. No class components ever.
- Persist raw data, derive everything else. Never persist derived state.
- All amounts displayed in INR (₹). No USD display by default.
- Behaviour fields (conviction, intended hold) are always optional.
- Minimal Mode is a display preference — never removes core functionality.
- No backend. No auth. No cloud. Local device storage only.
- All domain calculations must be pure functions in src/domain/.
- No business logic inside components or store slices.
- TypeScript strict mode. No `any` types.
- Every domain function must have unit tests.

## Design language
- Material Design 3 influenced
- Dark background: #1C1B1F
- Primary accent: #2E7D52 (green)
- Standard Mode: full information density, red/green P&L colour cues
- Minimal Mode: calmer palette (#6B6B6B neutrals), reduced noise,
  long-term framing, less red/green emphasis
- Card radius: 12px
- Bottom tab navigation with centre FAB for Add Trade

## References
- Full spec: docs/cogvest-master-spec.md
- Standard Mode mockups: docs/cogvest_standard_mode.png
- Minimal Mode mockups: docs/cogvest_minimal_mode.png
```

---

## MILESTONE 1 — FOUNDATION

---

## Issue #1 — Project Scaffold

```
You are building CogVest, an Android-first React Native portfolio
tracker. Read AGENTS.md in the repo root for full project context,
rules, and design direction.

Task: Set up the complete project scaffold. This is Issue #1 and
has no prerequisites.

---

STEP 1 — Create the Expo project

Run:
  npx create-expo-app@latest cogvest --template blank-typescript

Change into the directory and configure:
  - tsconfig.json: set strict: true
  - app.json: set platforms to ["android"], name to "CogVest",
    slug to "cogvest"

---

STEP 2 — Install all dependencies

Install these packages:

Core navigation:
  npx expo install expo-router react-native-safe-area-context
  react-native-screens

Storage and state:
  npx expo install react-native-mmkv
  npm install zustand

Animations:
  npx expo install react-native-reanimated

Charts:
  npm install victory-native

Forms and validation:
  npm install react-hook-form zod @hookform/resolvers

UI utilities:
  npm install @expo/vector-icons
  npx expo install expo-haptics

Testing:
  npm install --save-dev jest @testing-library/react-native
  @testing-library/jest-native jest-expo ts-jest

---

STEP 3 — Configure Expo Router

Create app/_layout.tsx as the root layout with:
  - SafeAreaProvider wrapper
  - Stack navigator as root
  - The (tabs) group as the default route

Create app/(tabs)/_layout.tsx with bottom tab navigation:
  - 5 tabs: Dashboard, Holdings, Add Trade, History, Cash
  - Tab icons from @expo/vector-icons (Ionicons)
  - Add Trade tab renders as a centre FAB (raised, green, circular)
  - Active tint: #2E7D52
  - Background: #1C1B1F
  - Tab bar border: subtle #2A2A2A

Tab routes:
  app/(tabs)/dashboard.tsx   — placeholder
  app/(tabs)/holdings.tsx    — placeholder
  app/(tabs)/add-trade.tsx   — placeholder
  app/(tabs)/history.tsx     — placeholder
  app/(tabs)/cash.tsx        — placeholder

---

STEP 4 — Folder structure

Create the full folder structure from section 15.1 of
docs/cogvest-master-spec.md. Each folder should have an index.ts
or a placeholder .tsx file so the structure is visible.

Full structure to create:
  app/
    _layout.tsx
    (tabs)/
      _layout.tsx
      dashboard.tsx
      holdings.tsx
      add-trade.tsx
      history.tsx
      cash.tsx
    asset/[id].tsx
    settings.tsx

  src/
    components/
      cards/
      charts/
      common/
      forms/
    features/
      dashboard/
      holdings/
      trades/
      history/
      cash/
      insights/
      settings/
    store/
    services/
      quotes/
      storage/
      import-export/
    domain/
      calculations/
      formatters/
      validators/
    types/
    theme/
    utils/

---

STEP 5 — Configure testing

Create jest.config.js:
  - preset: jest-expo
  - transform TypeScript via ts-jest
  - setupFilesAfterFramework includes @testing-library/jest-native

Create a smoke test at src/__tests__/smoke.test.ts:
  test('true is true', () => expect(true).toBe(true))

Run: npx jest — must pass.

---

STEP 6 — Verify

Run: npx expo start
Confirm:
  - App starts without errors
  - All 5 tabs are visible and navigable
  - Each tab shows its placeholder screen title
  - TypeScript compiles: npx tsc --noEmit
  - Tests pass: npx jest

---

Acceptance criteria:
  ✓ npx expo start runs without errors
  ✓ All 5 tabs navigate correctly
  ✓ npx tsc --noEmit exits with 0 errors
  ✓ npx jest passes
  ✓ Folder structure matches spec section 15.1
  ✓ No JavaScript files — TypeScript only
```

---

## Issue #2 — Theme System

```
You are building CogVest. Read AGENTS.md for full context.

Task: Implement the complete theme system (Issue #2).
Prerequisite: Issue #1 is complete and committed.

---

STEP 1 — Colour tokens

Create src/theme/colors.ts with two complete colour palettes:

Standard Mode palette:
  background: {
    primary: '#1C1B1F',
    secondary: '#2A2930',
    card: '#2A2930',
    elevated: '#312F36',
  }
  text: {
    primary: '#E6E1E5',
    secondary: '#CAC4D0',
    disabled: '#6B6B6B',
    inverse: '#1C1B1F',
  }
  accent: {
    primary: '#2E7D52',      // primary green
    primaryLight: '#3DAB6E',
    primaryContainer: '#1A4A30',
  }
  semantic: {
    gain: '#00C48C',         // positive P&L
    loss: '#FF4D6D',         // negative P&L
    neutral: '#CAC4D0',
    warning: '#F5A623',      // LTCG warning amber
    ltcgEligible: '#2E7D52', // LTCG eligible green
  }
  border: {
    default: 'rgba(255,255,255,0.08)',
    subtle: 'rgba(255,255,255,0.04)',
    strong: 'rgba(255,255,255,0.16)',
  }
  assetClass: {
    crypto: '#F5A623',
    stock: '#4DA6FF',
    etf: '#A78BFA',
    cash: '#2DD4BF',
  }

Minimal Mode palette — extends Standard but overrides:
  semantic: {
    gain: '#4CAF50',         // softer green — less aggressive
    loss: '#EF5350',         // softer red — less aggressive
    neutral: '#9E9E9E',
  }
  text: {
    primary: '#E6E1E5',
    secondary: '#9E9E9E',    // more muted
    disabled: '#5A5A5A',
  }

Export both as:
  export const standardColors = { ... }
  export const minimalColors = { ... }

---

STEP 2 — Typography

Create src/theme/typography.ts:

  fontSizes: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    hero: 34,
  }
  fontWeights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  }
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  }

---

STEP 3 — Spacing

Create src/theme/spacing.ts:

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    screen: 16,   // default horizontal screen padding
  }
  radius: {
    sm: 6,
    md: 10,
    lg: 12,
    xl: 16,
    full: 999,
  }

---

STEP 4 — Theme context

Create src/theme/ThemeContext.tsx:

  - React context providing current colour palette
  - Reads displayMode from preferences store
  - Returns standardColors when mode is 'standard'
  - Returns minimalColors when mode is 'minimal'
  - Export useTheme() hook that returns current colours

Create src/theme/index.ts re-exporting everything.

---

STEP 5 — Common AppText component

Create src/components/common/AppText.tsx:

A typed text component that:
  - Accepts variant prop:
    'hero' | 'heading' | 'subheading' | 'body' |
    'caption' | 'label' | 'mono'
  - Applies correct fontSize and fontWeight per variant
  - 'mono' variant uses monospace font family (for prices)
  - Accepts color prop (defaults to theme text.primary)
  - Accepts all standard Text props via spread

---

STEP 6 — Currency formatter

Create src/domain/formatters/currency.ts:

  formatINR(value: number, options?: FormatOptions): string

  Rules:
  - ≥ 1,00,00,000 (1 Crore): "₹1.24Cr"
  - ≥ 1,00,000 (1 Lakh): "₹12.45L"
  - ≥ 1,000: "₹1,234"
  - < 1,000: "₹234.50"
  - Negative values: "-₹1.24L" (prefix minus before ₹)
  - options.compact: boolean (use Cr/L suffixes)
  - options.showSign: boolean (prefix + for positive values)
  - options.masked: boolean (returns "₹*** **,***.**")

Write unit tests for all formatting rules including edge cases:
  - exactly 1 Lakh
  - exactly 1 Crore
  - negative values
  - masked mode
  - zero

---

STEP 7 — Date formatters

Create src/domain/formatters/dates.ts:

  formatTradeDate(date: string): string
    → "22 Apr 2026"

  formatRelativeDate(date: string): string
    → "2 days ago" / "3 months ago" / "1 year ago"

  formatHeldDays(buyDate: string): string
    → "Held for 126 days" / "Held for 3 months"

  daysHeld(buyDate: string, sellDate?: string): number
    → days between buyDate and sellDate (or today)

Write unit tests for all formatters.

---

Acceptance criteria:
  ✓ Both colour palettes exported and typed
  ✓ useTheme() hook returns correct palette per mode
  ✓ AppText renders all variants without errors
  ✓ formatINR passes all unit tests including edge cases
  ✓ All formatters have unit tests
  ✓ npx tsc --noEmit exits clean
  ✓ npx jest passes
```

---

## Issue #3 — Data Model and Store

```
You are building CogVest. Read AGENTS.md for full context.

Task: Implement all TypeScript types, Zustand store slices,
and MMKV persistence (Issue #3).
Prerequisites: Issues #1 and #2 are complete and committed.

---

STEP 1 — TypeScript types

Create the following files in src/types/ matching the canonical
contracts in section 8 of docs/cogvest-master-spec.md:

src/types/asset.ts:
  export type AssetClass = "crypto" | "stock" | "etf" | "cash"
  export type Exchange = "NSE" | "BSE" | "CRYPTO"
  export type Currency = "INR" | "USD"

  export interface Asset {
    id: string
    name: string
    ticker: string         // e.g. "RELIANCE.NS" or "bitcoin"
    symbol: string         // e.g. "RELIANCE" or "BTC"
    assetClass: AssetClass
    currency: Currency
    exchange?: Exchange
    logoUrl?: string       // optional CoinGecko/Yahoo image URL
    isTaxEligible?: boolean // Indian equities/ETFs = true
  }

src/types/trade.ts:
  export type TradeType = "buy" | "sell"
  export type ConvictionLevel = 1 | 2 | 3 | 4 | 5

  export interface Trade {
    id: string
    assetId: string
    type: TradeType
    quantity: number
    pricePerUnit: number    // in INR
    totalValue: number      // quantity × pricePerUnit
    fees?: number
    date: string            // ISO 8601 date string
    notes?: string

    // Optional behaviour metadata
    conviction?: ConvictionLevel
    intendedHoldDays?: number
    whyThisTrade?: string
  }

src/types/holding.ts:
  export interface Holding {
    asset: Asset
    totalUnits: number
    averageCostPrice: number
    totalInvested: number
    currentPrice: number
    currentValue: number
    unrealisedPnL: number
    unrealisedPnLPct: number
    dayChangePct?: number
    heldDays?: number
    ltcgEligible?: boolean
    daysToLtcg?: number
    lastUpdated?: string
  }

src/types/cash.ts:
  export interface CashEntry {
    id: string
    label: string
    amount: number          // INR
    institution?: string
    type: 'addition' | 'withdrawal'
    date: string
    notes?: string
  }

src/types/quote.ts:
  export type QuoteSource = "yahoo" | "coingecko" | "manual"

  export interface Quote {
    assetId: string
    price: number           // in INR
    currency: Currency
    dayChangePct?: number
    dayChangeAbs?: number
    asOf: string            // ISO timestamp
    source: QuoteSource
  }

src/types/preferences.ts:
  export type DisplayMode = "standard" | "minimal"
  export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL"

  export interface MinimalModePrefs {
    hideDayChange: boolean
    hideTopMovers: boolean
    hideDashboardInsights: boolean
    maskPortfolioValues: boolean
    defaultChartRange: ChartRange
  }

  export interface Preferences {
    displayMode: DisplayMode
    minimal: MinimalModePrefs
    defaultChartRange: ChartRange
    hasCompletedOnboarding: boolean
  }

src/types/index.ts — re-export everything

---

STEP 2 — MMKV storage instance

Create src/services/storage/mmkv.ts:

  import { MMKV } from 'react-native-mmkv'

  export const storage = new MMKV({ id: 'cogvest-storage' })

  // Zustand MMKV persist middleware helper
  export const zustandMMKVStorage = {
    getItem: (name: string) => storage.getString(name) ?? null,
    setItem: (name: string, value: string) => storage.set(name, value),
    removeItem: (name: string) => storage.delete(name),
  }

---

STEP 3 — Zustand store slices

Create src/store/usePortfolioStore.ts with the following
combined store using Zustand + persist middleware:

Assets slice:
  assets: Asset[]
  addAsset: (asset: Asset) => void
  updateAsset: (id: string, updates: Partial<Asset>) => void
  removeAsset: (id: string) => void
  getAssetById: (id: string) => Asset | undefined

Trades slice:
  trades: Trade[]
  addTrade: (trade: Trade) => void
  updateTrade: (id: string, updates: Partial<Trade>) => void
  removeTrade: (id: string) => void
  getTradesByAssetId: (assetId: string) => Trade[]

Cash slice:
  cashEntries: CashEntry[]
  addCashEntry: (entry: CashEntry) => void
  removeCashEntry: (id: string) => void
  getTotalCash: () => number

Quotes slice:
  quotes: Record<string, Quote>  // keyed by assetId
  setQuote: (assetId: string, quote: Quote) => void
  getQuote: (assetId: string) => Quote | undefined
  setQuotes: (quotes: Quote[]) => void

Preferences slice:
  preferences: Preferences
  setDisplayMode: (mode: DisplayMode) => void
  setMinimalPref: <K extends keyof MinimalModePrefs>(
    key: K, value: MinimalModePrefs[K]
  ) => void
  setDefaultChartRange: (range: ChartRange) => void

Default preferences:
  displayMode: 'standard'
  minimal: {
    hideDayChange: false,
    hideTopMovers: false,
    hideDashboardInsights: false,
    maskPortfolioValues: false,
    defaultChartRange: '3M',
  }
  defaultChartRange: '1M'
  hasCompletedOnboarding: false

Persist configuration:
  - Use zustandMMKVStorage from step 2
  - Persist: assets, trades, cashEntries, preferences
  - Do NOT persist quotes in the main Zustand persist payload
    (quotes are cached separately as the last successful quote cache)
  - Storage key: 'cogvest-portfolio'

---

STEP 4 — Selectors

Create src/store/selectors.ts with pure selector functions:

  selectAssets(state): Asset[]
  selectTrades(state): Trade[]
  selectTradesByAsset(state, assetId): Trade[]
  selectCashEntries(state): CashEntry[]
  selectTotalCash(state): number
  selectQuotes(state): Record<string, Quote>
  selectQuoteByAssetId(state, assetId): Quote | undefined
  selectPreferences(state): Preferences
  selectDisplayMode(state): DisplayMode
  selectIsMinimalMode(state): boolean
  selectMinimalPrefs(state): MinimalModePrefs

---

STEP 5 — ID generation utility

Create src/utils/id.ts:
  export function generateId(): string
  Use crypto.randomUUID() or a nanoid equivalent.
  Must be unique across calls.

---

STEP 6 — Unit tests

Create src/store/__tests__/store.test.ts:

Test every store action:
  - addAsset, updateAsset, removeAsset
  - addTrade, updateTrade, removeTrade
  - addCashEntry, removeCashEntry, getTotalCash
  - setQuote, getQuote, setQuotes
  - setDisplayMode, setMinimalPref
  - selectIsMinimalMode returns correct value per displayMode

---

Acceptance criteria:
  ✓ All TypeScript interfaces match spec section 8 exactly
  ✓ Store persists to MMKV (assets, trades, cashEntries, preferences)
  ✓ Quotes are not persisted (intentional — always re-fetch)
  ✓ All CRUD operations tested and passing
  ✓ All selectors tested
  ✓ npx tsc --noEmit exits clean
  ✓ npx jest passes
```

---

## Issue #4 — Domain Calculations

```
You are building CogVest. Read AGENTS.md for full context.

Task: Implement all domain calculation functions as pure functions
(Issue #4). This is the most critical issue in the project.
Prerequisites: Issues #1, #2, #3 are complete and committed.

All functions must be:
  - Pure (no side effects, no external state)
  - Fully typed with TypeScript strict mode
  - Tested with comprehensive unit tests
  - Located in src/domain/calculations/

---

STEP 1 — Holdings calculation

Create src/domain/calculations/holdings.ts:

interface HoldingInput {
  asset: Asset
  trades: Trade[]
  currentPrice: number
  dayChangePct?: number
}

function calculateHolding(input: HoldingInput): Holding

Logic:
  const buys = trades.filter(t => t.type === 'buy')
  const sells = trades.filter(t => t.type === 'sell')

  totalUnits = sum(buys.quantity) - sum(sells.quantity)

  averageCostPrice:
    Weighted average of buy-side only.
    = sum(buy.quantity × buy.pricePerUnit) / sum(buy.quantity)
    If no buys: return 0

  totalInvested:
    = totalUnits × averageCostPrice
    (cost basis of remaining units only)

  currentValue = totalUnits × currentPrice

  unrealisedPnL = currentValue - totalInvested

  unrealisedPnLPct:
    = (unrealisedPnL / totalInvested) × 100
    If totalInvested is 0: return 0

  heldDays:
    Days since first buy date to today.
    If no buys: return 0

Unit tests must cover:
  - Standard buy: 10 units @ ₹100, price now ₹120 → P&L = ₹200
  - Multiple buys at different prices (weighted average)
  - Partial sell: buy 10, sell 3, check remaining units and cost basis
  - Full sell: all units sold, totalUnits = 0
  - Zero price: currentPrice = 0
  - Empty trades array

---

STEP 2 — LTCG calculation

Create src/domain/calculations/ltcg.ts:

IMPORTANT: Handle multiple buy lots separately.
Each buy is its own lot with its own LTCG eligibility date.

interface LtcgLot {
  buyDate: string       // ISO date
  quantity: number
  eligibleDate: string  // buyDate + 365 days
  isEligible: boolean   // today >= eligibleDate
  daysToEligibility: number // 0 if already eligible
}

function calculateLtcgLots(trades: Trade[]): LtcgLot[]
  Filter buy trades only.
  For each buy: calculate eligibility based on that buy's date.

function getLtcgSummary(lots: LtcgLot[]): LtcgSummary
  interface LtcgSummary {
    hasEligibleLots: boolean
    allLotsEligible: boolean
    nextEligibilityDays: number | null  // null if all eligible
    eligibleUnits: number
    ineligibleUnits: number
  }

function isHoldingLtcgEligible(trades: Trade[]): boolean
  Returns true if ALL remaining units are LTCG eligible.

function daysToFullLtcgEligibility(trades: Trade[]): number
  Returns days until the last ineligible lot becomes eligible.
  Returns 0 if all lots are already eligible.

Unit tests must cover:
  - Single buy, held < 365 days
  - Single buy, held >= 365 days (eligible)
  - Exactly 365 days held (boundary condition)
  - Multiple buys at different dates (mixed eligibility)
  - Buy + partial sell (sold lots don't count)
  - All units sold (no remaining lots)

---

STEP 3 — Portfolio and allocation calculation

Create src/domain/calculations/allocation.ts:

interface AllocationResult {
  crypto: AllocationSlice
  stocks: AllocationSlice
  etfs: AllocationSlice
  cash: AllocationSlice
  total: number
}

interface AllocationSlice {
  value: number       // INR
  percentage: number  // 0-100
  assetCount: number
}

function calculateAllocation(
  holdings: Holding[],
  cashTotal: number
): AllocationResult

Logic:
  Group holdings by assetClass.
  Sum currentValue per group.
  Add cashTotal to cash group.
  Calculate % of each group relative to total.
  If total is 0: all percentages are 0.

Unit tests:
  - Balanced portfolio across all 4 classes
  - Portfolio with only crypto
  - Zero total portfolio
  - Only cash

---

STEP 4 — P&L calculation

Create src/domain/calculations/pnl.ts:

function portfolioTotal(holdings: Holding[], cashTotal: number): number
  = sum(holding.currentValue) + cashTotal

function portfolioDayChange(
  holdings: Holding[],
  quotes: Record<string, Quote>
): { absChange: number; pctChange: number }
  Calculate total portfolio value using current prices.
  Calculate total portfolio value using (price / (1 + dayChangePct/100)).
  Return difference as absChange and pctChange.
  If no quotes with dayChangePct: return { absChange: 0, pctChange: 0 }

function realisedPnL(sells: Trade[], averageCostPrice: number): number
  = sum((sell.pricePerUnit - averageCostPrice) × sell.quantity)

function totalReturnPct(
  totalInvested: number,
  currentValue: number
): number
  = ((currentValue - totalInvested) / totalInvested) × 100
  If totalInvested is 0: return 0

Unit tests for all functions.

---

STEP 5 — Conviction analysis

Create src/domain/calculations/conviction.ts:

interface ConvictionAnalysis {
  hasEnoughData: boolean     // true if >= 5 rated trades
  highConvictionAvgReturn: number | null
  lowConvictionAvgReturn: number | null
  multiplier: number | null  // high / low return ratio
  insight: string | null     // human-readable insight string
}

function analyseConviction(
  trades: Trade[],
  holdings: Holding[]
): ConvictionAnalysis

Definitions:
  High conviction = conviction >= 4
  Low conviction = conviction <= 2
  hasEnoughData = >= 5 trades with conviction ratings

Return calculation:
  For each trade with conviction rating:
    Find corresponding holding.
    Use unrealisedPnLPct as the return proxy.
    (Realised P&L can be added later)

Insight string examples:
  "Your high conviction trades outperform low conviction trades by 2.1×."
  "Not enough data yet — rate more trades to unlock this insight."
  "Your conviction rating doesn't predict returns yet."

Unit tests:
  - Not enough data (< 5 rated trades) → hasEnoughData: false
  - High conviction outperforms → correct multiplier
  - Low conviction outperforms → correct multiplier
  - No high conviction trades → null multiplier

---

STEP 6 — Patience analysis

Create src/domain/calculations/patience.ts:

interface PatienceAnalysis {
  hasEnoughData: boolean     // true if >= 3 trades with intendedHoldDays
  averageIntendedDays: number | null
  averageActualDays: number | null
  earlyExitCount: number
  earlyExitRate: number | null  // percentage of early exits
  averagePatienceGap: number | null  // intended - actual (positive = exited early)
  insight: string | null
}

function analysePatienceFromSells(
  trades: Trade[]
): PatienceAnalysis

Logic:
  For completed sells with intendedHoldDays:
    Find corresponding buy(s) for the same assetId.
    Calculate actualHoldDays from first buy to sell date.
    patienceGap = intendedHoldDays - actualHoldDays
    earlyExit = patienceGap > 0

Insight examples:
  "You exited 70% of positions before your intended hold period."
  "Your patience is consistent — you stick to your targets."
  "Not enough data yet."

Unit tests:
  - No intended hold data → hasEnoughData: false
  - Consistent early exits
  - Consistent patient holds
  - Mixed pattern

---

STEP 7 — Trade frequency analysis

Create src/domain/calculations/frequency.ts:

interface FrequencyAnalysis {
  tradesLast7Days: number
  tradesLast30Days: number
  averageTradesPerWeek: number
  isHighFrequency: boolean   // > 3 trades in 7 days
  insight: string | null
}

function analyseTradeFrequency(trades: Trade[]): FrequencyAnalysis

High frequency threshold: > 3 trades in any rolling 7-day window.

Insight examples:
  "You made 5 trades in the last 7 days. Historically your
   high-frequency periods underperform patient periods."
  "Your trading pace looks measured this week."

Unit tests:
  - No trades
  - Single trade
  - High frequency week
  - Normal pace

---

STEP 8 — Top movers selector

Create src/domain/calculations/movers.ts:

interface Mover {
  holding: Holding
  dayChangePct: number
  direction: 'up' | 'down'
}

function getTopMovers(
  holdings: Holding[],
  limit: number = 3
): { gainers: Mover[]; losers: Mover[] }

Logic:
  Filter holdings with dayChangePct defined.
  Sort by absolute dayChangePct.
  Return top N gainers and top N losers.

Unit tests:
  - Empty holdings
  - All same day change
  - Mixed gainers and losers

---

Acceptance criteria:
  ✓ All functions are pure — no side effects, no store access
  ✓ LTCG handles multiple buy lots correctly
  ✓ Weighted average cost price calculation is correct
  ✓ All edge cases tested (zero values, empty arrays, boundaries)
  ✓ ConvictionAnalysis returns hasEnoughData: false when < 5 rated trades
  ✓ PatienceAnalysis returns hasEnoughData: false when < 3 hold targets
  ✓ npx tsc --noEmit exits clean
  ✓ npx jest passes with all tests green
```

---

## Issue #5 — API Services

```
You are building CogVest. Read AGENTS.md for full context.

Task: Implement all price fetching API services (Issue #5).
Prerequisites: Issues #1, #2, #3 are complete and committed.

---

STEP 1 — Yahoo Finance service (Indian stocks + ETFs)

Create src/services/quotes/yahooFinance.ts:

interface YahooQuoteResult {
  ticker: string       // e.g. "RELIANCE.NS"
  price: number        // INR
  dayChangePct: number
  dayChangeAbs: number
  currency: string
  lastUpdated: string
  name?: string
}

async function fetchYahooQuote(
  ticker: string
): Promise<YahooQuoteResult | null>

API endpoint:
  GET https://query1.finance.yahoo.com/v8/finance/chart/{ticker}
  Params: interval=1d&range=1d

Response parsing:
  price = result.meta.regularMarketPrice
  dayChangePct = ((price - previousClose) / previousClose) × 100
  previousClose = result.meta.chartPreviousClose

async function fetchYahooQuotes(
  tickers: string[]
): Promise<YahooQuoteResult[]>
  Batch by calling fetchYahooQuote for each.
  Use Promise.allSettled — never let one failure block others.
  Return only successful results.

Error handling:
  - Network timeout: return null, log warning
  - Invalid ticker: return null, log warning
  - Rate limit / 429: return null, log warning
  - Never throw — always return null on error

async function searchYahooAsset(
  query: string
): Promise<YahooSearchResult[]>
  API: GET https://query1.finance.yahoo.com/v1/finance/search?q={query}
  Return top 5 results filtered to exchange: NSE or BSE
  interface YahooSearchResult {
    symbol: string    // e.g. "RELIANCE.NS"
    name: string
    exchange: string
    type: string      // "EQUITY" | "ETF"
  }

---

STEP 2 — CoinGecko service (crypto)

Create src/services/quotes/coinGecko.ts:

interface CoinGeckoQuoteResult {
  coinId: string        // e.g. "bitcoin"
  price: number         // INR
  priceUsd: number
  dayChangePct: number
  lastUpdated: string
}

async function fetchCoinGeckoQuotes(
  coinIds: string[]
): Promise<CoinGeckoQuoteResult[]>

API endpoint:
  GET https://api.coingecko.com/api/v3/simple/price
  Params: ids={ids}&vs_currencies=inr,usd&include_24hr_change=true

Response parsing:
  price = data[coinId].inr
  priceUsd = data[coinId].usd
  dayChangePct = data[coinId].inr_24h_change

Batch up to 50 coin IDs per request.
Use Promise.allSettled for multiple batches.
Never throw — return empty array on error.

async function searchCoinGeckoAsset(
  query: string
): Promise<CoinGeckoSearchResult[]>
  API: GET https://api.coingecko.com/api/v3/search?query={query}
  Return top 5 coins from results.coins
  interface CoinGeckoSearchResult {
    id: string          // e.g. "bitcoin"
    symbol: string      // e.g. "BTC"
    name: string        // e.g. "Bitcoin"
    thumb: string       // small logo URL
  }

---

STEP 3 — FX service

Create src/services/quotes/fx.ts:

async function fetchUsdToInr(): Promise<number | null>
  API: GET https://open.er-api.com/v6/latest/USD
  Return rates.INR
  Cache result in MMKV with 1-hour TTL.
  Return cached value if within TTL.
  Return null on error.

---

STEP 4 — Quote resolver

Create src/services/quotes/quoteResolver.ts:

This is the unified entry point for all price fetching.

async function refreshAllQuotes(
  assets: Asset[]
): Promise<Quote[]>

Logic:
  1. Separate assets by class:
     - crypto → use coinGecko service (ticker = asset.ticker)
     - stock/etf → use yahoo service (ticker = asset.ticker + ".NS" or ".BO")
     - cash → skip (no price fetch needed)
  2. Fetch in parallel using Promise.allSettled
  3. Map results to Quote interface (src/types/quote.ts)
  4. Write successful quotes to a separate MMKV last quote cache
  5. Return array of Quote objects for successful fetches only

async function refreshQuoteForAsset(asset: Asset): Promise<Quote | null>
  Single asset refresh.

function mapYahooToQuote(result: YahooQuoteResult, assetId: string): Quote
function mapCoinGeckoToQuote(result: CoinGeckoQuoteResult, assetId: string): Quote

Quote cache policy:
  - Quotes are not persisted in the main Zustand persisted payload.
  - The last successful quote cache is raw cached market data and may be
    persisted separately in MMKV for offline/stale display.
  - Cached quotes must include asOf and source.

---

STEP 5 — Quote refresh hook

Create src/services/quotes/useQuoteRefresh.ts:

A React hook that:
  - Fetches quotes for all assets on mount
  - Exposes: { isRefreshing, lastRefreshed, refresh }
  - refresh() triggers a full quote refresh
  - Updates the store quotes slice on success
  - Never throws — surfaces errors via isError state
  - Debounces rapid refresh calls (500ms minimum between calls)

interface UseQuoteRefreshReturn {
  isRefreshing: boolean
  lastRefreshed: Date | null
  isError: boolean
  refresh: () => Promise<void>
}

---

STEP 6 — Mock service for testing

Create src/services/quotes/__mocks__/quoteResolver.ts:

Mock implementation that returns static test quotes.
Used in component and store tests so no real API calls are made.

---

Acceptance criteria:
  ✓ fetchYahooQuote returns correct INR price for RELIANCE.NS
  ✓ fetchCoinGeckoQuotes returns correct INR price for bitcoin
  ✓ Never throws on network error — always returns null/empty
  ✓ refreshAllQuotes handles mixed asset classes correctly
  ✓ FX rate is cached with 1-hour TTL
  ✓ Last successful quotes are cached separately from Zustand persistence
  ✓ Mock service is available for tests
  ✓ npx tsc --noEmit exits clean
```

---

## MILESTONE 2 — CORE SCREENS

---

## Issue #6 — Navigation Shell and Common Components

```
You are building CogVest. Read AGENTS.md for full context.

Task: Build the navigation shell and all reusable common components
(Issue #6).
Prerequisites: Issues #1–#5 complete and committed.

---

STEP 1 — Screen container

Create src/components/common/ScreenContainer.tsx:

Props:
  children: React.ReactNode
  scrollable?: boolean      // default true
  padding?: boolean         // default true (screen padding from theme)
  refreshing?: boolean
  onRefresh?: () => void

If scrollable: wraps children in ScrollView with pull-to-refresh
If not scrollable: wraps in View
Always applies SafeAreaView and background colour from theme.

---

STEP 2 — AppButton

Create src/components/common/AppButton.tsx:

Props:
  label: string
  onPress: () => void
  variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'    // default 'md'
  leftIcon?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean

primary: filled green (#2E7D52)
secondary: outlined green border, transparent background
ghost: no border, text only
danger: filled red

Loading state shows ActivityIndicator replacing label.

---

STEP 3 — Badge

Create src/components/common/Badge.tsx:

Props:
  label: string
  variant: 'gain' | 'loss' | 'neutral' | 'warning' |
           'ltcg' | 'ltcgSoon' | 'assetClass'
  size?: 'sm' | 'md'
  assetClass?: AssetClass  // used when variant is 'assetClass'

Renders a pill-shaped badge with appropriate background/text colour
from the theme semantic colours.

ltcg: green pill "LTCG Eligible"
ltcgSoon: amber pill "LTCG in X days"

---

STEP 4 — MaskedValue

Create src/components/common/MaskedValue.tsx:

Props:
  value: string         // the real value to show/hide
  masked: boolean       // from preferences.maskPortfolioValues
  style?: TextStyle

When masked: shows "₹*** **,***.**" using a monospaced font
When not masked: shows the real value
Smooth crossfade transition between states.

---

STEP 5 — EmptyState

Create src/components/common/EmptyState.tsx:

Props:
  icon: string          // Ionicons name
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void

Centred layout with icon, title, description, optional CTA.
Used on Holdings, History, Cash when empty.

---

STEP 6 — Segmented control

Create src/components/common/SegmentedControl.tsx:

Props:
  options: Array<{ label: string; value: string }>
  selected: string
  onChange: (value: string) => void

Used for Buy/Sell toggle on Add Trade screen.
Animates the active segment with Reanimated sliding indicator.

---

STEP 7 — Loading skeleton

Create src/components/common/Skeleton.tsx:

Props:
  width: number | string
  height: number
  borderRadius?: number

Animated shimmer effect using Reanimated.
Used on Holdings and Dashboard while prices are loading.

---

STEP 8 — Pull-to-refresh integration

Wire up useQuoteRefresh hook in ScreenContainer.
When onRefresh is called:
  - Trigger quote refresh via the hook
  - Show RefreshControl spinner

---

Acceptance criteria:
  ✓ All common components render without errors
  ✓ MaskedValue correctly masks/unmasks values
  ✓ SegmentedControl animation is smooth
  ✓ Skeleton shimmer animates correctly
  ✓ ScreenContainer pull-to-refresh triggers quote refresh
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #7 — Add Trade Screen

```
You are building CogVest. Read AGENTS.md for full context.

Task: Build the Add Trade screen (Issue #7).
This is the most important screen for the core workflow.
Target completion time: under 45 seconds per trade.
Prerequisites: Issues #1–#6 complete and committed.

Reference: Screen 3 in docs/cogvest_standard_mode.png

---

STEP 1 — Form state

Use React Hook Form + Zod for form management.

Create src/domain/validators/trade.ts:

const tradeSchema = z.object({
  type: z.enum(['buy', 'sell']),
  assetId: z.string().min(1, 'Asset is required'),
  quantity: z.number()
    .positive('Quantity must be greater than 0'),
  pricePerUnit: z.number()
    .positive('Price must be greater than 0'),
  date: z.string(),
  fees: z.number().min(0).optional(),
  conviction: z.number().min(1).max(5).optional(),
  intendedHoldDays: z.number().positive().optional(),
  whyThisTrade: z.string().optional(),
  notes: z.string().optional(),
})

export type TradeFormValues = z.infer<typeof tradeSchema>

Additional validation (not in schema — in onSubmit):
  - Sell: quantity cannot exceed current holding units
  - Sell: must have an existing holding for this asset

---

STEP 2 — Screen layout

Create app/(tabs)/add-trade.tsx:

Structure:
  1. Buy/Sell toggle (SegmentedControl)
  2. Asset class filter row (Crypto / Stocks / ETFs / Cash)
  3. Asset picker (see Step 3)
  4. Live price display (auto-fetched, overridable)
  5. Quantity + Price per unit (side by side)
  6. Total value (calculated, read-only display)
  7. Fees (optional, collapsible)
  8. Date picker (defaults to today)
  9. --- Behaviour section (optional, clearly labelled) ---
  10. Conviction selector (1–5 buttons)
  11. Why this trade? (text input)
  12. Intended hold period (dropdown: 1M/3M/6M/1Y/Custom)
  13. Review Trade button (sticky bottom)

The behaviour section (9–12) must be:
  - Clearly marked as "Optional"
  - Collapsible behind a "Add context (optional)" tap
  - Never required for form submission

---

STEP 3 — Asset picker

Create src/components/forms/AssetPicker.tsx:

Props:
  value: string | null   // selected assetId
  assetClass: AssetClass | null
  onChange: (assetId: string, asset: Asset) => void

Behaviour:
  1. Show recently used assets first (last 5, from MMKV)
  2. Search field: as user types, call appropriate search API
     - crypto: coinGecko.searchCoinGeckoAsset(query)
     - stock/etf: yahooFinance.searchYahooAsset(query)
  3. Show search results with logo, name, symbol
  4. On selection: save to recents, trigger live price fetch

---

STEP 4 — Conviction selector

Create src/components/forms/ConvictionSelector.tsx:

Props:
  value: ConvictionLevel | undefined
  onChange: (value: ConvictionLevel | undefined) => void

Renders 5 buttons labelled 1–5.
Label below: "Low conviction" on left, "High conviction" on right.
Active button has green fill.
Tapping active button deselects it (clears to undefined).
Layout exactly matches Screen 3 in docs/cogvest_standard_mode.png.

---

STEP 5 — Intended hold picker

Create src/components/forms/HoldPeriodPicker.tsx:

Props:
  value: number | undefined   // days
  onChange: (days: number | undefined) => void

Preset options:
  1 Month (30 days)
  3 Months (90 days)
  6 Months (180 days)
  1 Year (365 days)
  2 Years (730 days)
  Custom (opens numeric input)

Renders as a dropdown/modal picker.

---

STEP 6 — Review Trade modal

Before final submission show a Review Trade summary screen/modal:

Show:
  - Trade type (BUY/SELL) in large type
  - Asset name and symbol
  - Quantity × price per unit
  - Total value in INR
  - Date
  - Fees (if any)
  - Conviction (if set, shown as stars)
  - Intended hold (if set)

Two buttons: Edit (back) and Confirm

---

STEP 7 — Submit logic

On confirm:
  1. Create Asset if it doesn't exist in store
  2. Create Trade object with generateId()
  3. Add to store via addTrade()
  4. Show success feedback (haptic + brief toast)
  5. Navigate back to Holdings or Dashboard

---

STEP 8 — Sell validation

When type is 'sell':
  1. Look up current holding for selected asset
  2. If no holding exists: show error "You don't hold this asset"
  3. If quantity > holding.totalUnits: show error
     "Maximum sellable quantity is X"

---

Acceptance criteria:
  ✓ Trade logs in under 45 seconds for a standard buy
  ✓ Asset search returns results for Indian stocks and crypto
  ✓ Live price auto-populates on asset selection
  ✓ Total value updates as quantity/price changes
  ✓ Behaviour fields are optional and collapsible
  ✓ Sell validates quantity against current holding
  ✓ Review modal shows correct summary before confirm
  ✓ Trade is stored in MMKV after confirm
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #8 — Holdings Screen

```
You are building CogVest. Read AGENTS.md for full context.

Task: Build the Holdings screen in both Standard and Minimal Mode
(Issue #8).
Prerequisites: Issues #1–#7 complete and committed.

Reference: Screens 2 and 2A in docs/cogvest_standard_mode.png
           Screen 2 in docs/cogvest_minimal_mode.png

---

STEP 1 — Holdings derivation

Create src/features/holdings/useHoldings.ts:

A hook that:
  1. Reads assets, trades, quotes from store
  2. Derives holdings using calculateHolding() per asset
  3. Injects current price from quotes
  4. Adds LTCG data from calculateLtcgLots()
  5. Returns sorted holdings + loading state

interface UseHoldingsReturn {
  holdings: Holding[]
  isLoading: boolean
  totalValue: number
  totalInvested: number
  totalPnL: number
  totalPnLPct: number
}

---

STEP 2 — Holding card — Standard Mode

Create src/components/cards/HoldingCard.tsx:

Props:
  holding: Holding
  mode: DisplayMode
  masked: boolean
  onPress: () => void

Standard Mode layout (matches Screen 2 mockup):
  Row 1: Asset logo + name + symbol | current value (INR)
  Row 2: quantity + avg buy price    | invested value (INR)
  Row 3: P&L in INR and %           | day change badge
  Row 4: LTCG badge if relevant

LTCG badge rendering:
  - All lots eligible: green "LTCG Eligible" badge
  - Nearing eligibility (< 30 days): amber "LTCG in X days" badge
  - Not eligible: no badge

Colour coding:
  - P&L positive: gain colour from theme
  - P&L negative: loss colour from theme
  - Day change: same rules

Minimal Mode layout:
  Row 1: Asset logo + name | current value (INR, softer colour)
  Row 2: quantity           | LTCG badge only
  Hide: day change, P&L badge colour emphasis

Masked mode: wrap all INR values in MaskedValue component.

---

STEP 3 — Filter pills

Create src/components/common/FilterPills.tsx:

Props:
  options: Array<{ label: string; value: string }>
  selected: string
  onChange: (value: string) => void

Horizontal scrollable row of pills.
Active pill: green fill.
Inactive: outline.

Holdings filter options: All | Crypto | Stocks | ETFs | Cash

---

STEP 4 — Holdings screen

Create app/(tabs)/holdings.tsx:

Layout:
  1. Header: "Holdings" + count + filter icon
  2. Filter pills row (All/Crypto/Stocks/ETFs/Cash)
  3. Summary row: Current | Invested | P&L (column headers)
  4. Scrollable list of HoldingCard components
  5. Empty state if no holdings

Sort: default by current value descending.

Standard vs Minimal Mode:
  - Read displayMode from preferences store
  - Pass mode prop to HoldingCard
  - In Minimal Mode: hide the P&L summary row

Navigation:
  Tap holding card → navigate to app/asset/[id].tsx

---

STEP 5 — Skeleton loading state

While isLoading is true (quotes not yet fetched):
  Show 4 Skeleton cards instead of real holding cards.

---

Acceptance criteria:
  ✓ Holdings list correctly derives from trades (not hardcoded)
  ✓ LTCG badge shows for eligible Indian equity holdings
  ✓ Filter pills correctly filter by asset class
  ✓ Minimal Mode hides day change and reduces colour emphasis
  ✓ Masked mode hides all INR values
  ✓ Empty state shows when no holdings
  ✓ Skeleton shows while loading
  ✓ Tapping a holding navigates to Asset Detail
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #9 — Dashboard Screen

```
You are building CogVest. Read AGENTS.md for full context.

Task: Build the Dashboard screen in both Standard and Minimal Mode
(Issue #9).
Prerequisites: Issues #1–#8 complete and committed.

Reference: Screens 1 and 1A in docs/cogvest_standard_mode.png
           Screens 1 and 1A in docs/cogvest_minimal_mode.png

---

STEP 1 — Dashboard view model

Create src/features/dashboard/useDashboard.ts:

A hook that derives and returns:
  interface DashboardViewModel {
    totalPortfolioValue: number
    dayChangeAbs: number
    dayChangePct: number
    allocation: AllocationResult
    topMovers: { gainers: Mover[]; losers: Mover[] }
    activeInsight: string | null   // single insight string
    ltcgReminders: LtcgReminder[]
    lastRefreshed: Date | null
    isRefreshing: boolean
    refresh: () => Promise<void>
  }

  interface LtcgReminder {
    assetName: string
    symbol: string
    daysToLtcg: number
    isEligible: boolean
  }

ltcgReminders: holdings where daysToLtcg <= 30 or isEligible.
activeInsight: first available insight from conviction analysis,
  patience analysis, or frequency analysis. Rotates daily.

---

STEP 2 — Portfolio value card

Create src/components/cards/PortfolioValueCard.tsx:

Props:
  totalValue: number
  dayChangeAbs: number
  dayChangePct: number
  masked: boolean
  mode: DisplayMode

Standard Mode:
  Large hero number: ₹12,45,678.90
  Day change: +₹45,231.45 (3.77%) today — green/red

Minimal Mode:
  Same large hero number
  "Updated today · 7:45 AM" (last refresh time) instead of day change
  No day change amount shown

---

STEP 3 — Allocation donut chart

Create src/components/charts/AllocationDonutChart.tsx:

Props:
  allocation: AllocationResult
  mode: DisplayMode

Renders a donut chart using Victory Native VictoryPie.

Centre label: "4 Asset Classes" (or count of non-zero classes)

Legend below chart:
  ● Crypto   52.1%
  ● Indian Stocks 32.4%
  ● ETFs     10.8%
  ● Cash      4.7%

Colours from theme.assetClass.

Standard Mode: richer colours (gold, blue, purple, teal)
Minimal Mode: same structure but more muted palette

---

STEP 4 — Insight card

Create src/components/cards/InsightCard.tsx:

Props:
  insight: string
  onDismiss: () => void

Design (matches Screen 1 mockup):
  Light purple/blue tinted card
  Small "INSIGHT" label
  Insight text in readable body size
  "View details →" link (navigates to Mirror/Insights tab later)
  Dismiss X button

Only shown in Standard Mode.
Only shown when insight is not null.

---

STEP 5 — Top movers section

Create src/components/cards/TopMoversCard.tsx:

Props:
  movers: Mover[]
  onMoverPress: (assetId: string) => void

Shows top 2–3 movers (gainers and losers combined).
Each row: asset symbol + day change % + chevron.
Only shown in Standard Mode.
Only shown if displayMode is standard AND hideTopMovers is false.

---

STEP 6 — LTCG banner

Create src/components/cards/LtcgBannerCard.tsx:

Props:
  reminders: LtcgReminder[]

Shows a subtle banner if any holdings are nearing LTCG eligibility.
Example: "RELIANCE becomes LTCG eligible in 18 days"
If multiple: shows count and "View all" link.
Shown in both Standard and Minimal Mode (tax info is always useful).

---

STEP 7 — Dashboard screen

Create app/(tabs)/dashboard.tsx:

Standard Mode layout:
  1. Portfolio value card
  2. Insight card (if available)
  3. Allocation donut
  4. LTCG banner (if relevant)
  5. Top movers
  6. Add Trade CTA button

Minimal Mode layout:
  1. Portfolio value card (no day change)
  2. Allocation donut
  3. LTCG banner (if relevant)
  4. Add Trade CTA button
  (no insight card, no top movers)

Pull-to-refresh triggers full quote refresh.
Eye icon in header toggles masked values.

---

Acceptance criteria:
  ✓ Portfolio total is derived from holdings + cash (not hardcoded)
  ✓ Allocation donut shows correct percentages
  ✓ Day change is hidden in Minimal Mode
  ✓ Top movers only shown in Standard Mode
  ✓ Insight card only shown when insight is available
  ✓ LTCG banner appears when holdings within 30 days of eligibility
  ✓ Eye icon correctly toggles masked values
  ✓ Pull-to-refresh refreshes all quotes
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #10 — Asset Detail Screen

```
You are building CogVest. Read AGENTS.md for full context.

Task: Build the Asset Detail screen in Standard and Minimal Mode
(Issue #10).
Prerequisites: Issues #1–#9 complete and committed.

Reference: Screens 4 and 4A in docs/cogvest_standard_mode.png
           Screens 4 and 4A in docs/cogvest_minimal_mode.png

---

STEP 1 — Asset detail route

Create app/asset/[id].tsx:

Reads assetId from route params.
Derives holding data using calculateHolding().
Shows header with: back button, asset name+symbol, star bookmark,
overflow menu.

---

STEP 2 — Tab navigation within screen

Tabs: Overview | Chart | Trades | Insights

Standard Mode: all 4 tabs visible
Minimal Mode: Overview | Trades | Insights (no dedicated Chart tab —
  chart shown on Overview in long-term range)

---

STEP 3 — Overview tab

Show:
  Current price (large, monospaced)
  Day change (Standard Mode only)
  Your Position section:
    Quantity
    Avg Buy Price
    Current Value
    Unrealised P&L
    Held Days
    LTCG countdown or "LTCG Eligible" badge

Minimal Mode differences:
  No day change
  Long-term chart shown here by default (1Y range)
  LTCG info prominently shown

---

STEP 4 — Price chart

Create src/components/charts/AssetPriceChart.tsx:

Props:
  ticker: string
  assetClass: AssetClass
  mode: DisplayMode

Range selector: 1D | 1W | 1M | 3M | 1Y | ALL

Standard Mode default range: 1D
Minimal Mode default range: 1Y (reads preferences.minimal.defaultChartRange)

Fetch historical data:
  Yahoo Finance: /v8/finance/chart/{ticker}?interval=1d&range={range}
  CoinGecko: /coins/{id}/market_chart?vs_currency=inr&days={days}

Render using Victory Native VictoryLine.
Chart colours: gain colour if current > first price, loss colour otherwise.
Show gradient area fill below the line.

---

STEP 5 — Trades tab

List all trades for this asset in reverse chronological order.

Per trade row:
  Date | Buy/Sell tag | quantity @ price | total | conviction stars

Conviction shown as filled/unfilled stars (★★★☆☆) when set.

"Add Trade" button at bottom (navigates to Add Trade with
  asset pre-selected).

---

STEP 6 — Insights tab (placeholder for Issue #19)

Show placeholder: "Insights available once you have more trade history."
Wire it up properly in Issue #19.

---

Acceptance criteria:
  ✓ Correct holding data shown for each asset
  ✓ Price chart loads and renders for stocks and crypto
  ✓ Range selector changes chart data
  ✓ Minimal Mode defaults to 1Y chart
  ✓ LTCG status correctly shown for Indian equities
  ✓ Conviction stars render when set on trade
  ✓ Insights tab shows placeholder
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #11 — History Screen

```
You are building CogVest. Read AGENTS.md for full context.

Task: Build the History screen (Issue #11).
Prerequisites: Issues #1–#10 complete and committed.

Reference: Screen 5 in docs/cogvest_standard_mode.png
           Screen 5 in docs/cogvest_minimal_mode.png

---

STEP 1 — History screen

Create app/(tabs)/history.tsx:

Layout:
  1. Header: "History" + filter icon
  2. Filter pills: All | Buy | Sell
  3. Scrollable trade list (reverse chronological)
  4. Empty state if no trades

---

STEP 2 — Trade history row

Create src/components/cards/TradeHistoryRow.tsx:

Props:
  trade: Trade
  asset: Asset
  mode: DisplayMode

Layout (matches Screen 5 mockup):
  Left: asset logo + asset name + trade date
  Centre: quantity + "@" + price per unit
  Right: total value in INR
  Below: Conviction: X/5 shown as star rating when set

Standard Mode: Buy tag green, Sell tag red
Minimal Mode: reduced colour emphasis (neutral badges)

---

STEP 3 — Grouping by date

Group trades by date with section headers:
  "22 Apr 2026"
    [trade row]
    [trade row]
  "18 Apr 2026"
    [trade row]

Use SectionList for performance.

---

STEP 4 — Filters

All: all trades
Buy: filter type === 'buy'
Sell: filter type === 'sell'

Filter persists during session but not across app restarts.

---

Acceptance criteria:
  ✓ All trades shown in reverse chronological order
  ✓ Correctly grouped by date with headers
  ✓ Buy/Sell filter works correctly
  ✓ Conviction stars shown when set
  ✓ Empty state shown when no trades
  ✓ Minimal Mode reduces colour emphasis
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #12 — Cash Screen

```
You are building CogVest. Read AGENTS.md for full context.

Task: Build the Cash screen (Issue #12).
Prerequisites: Issues #1–#11 complete and committed.

Reference: Screen 6 in docs/cogvest_standard_mode.png
           Screen 6 in docs/cogvest_minimal_mode.png

---

STEP 1 — Cash screen

Create app/(tabs)/cash.tsx:

Layout:
  1. Current Cash Balance (large, hero number)
  2. Month change: "+₹15,500 this month" (sum of this month's additions)
  3. Add Cash + Withdraw buttons (side by side)
  4. Cash History section list (reverse chronological)
  5. Empty state if no cash entries

---

STEP 2 — Add/Withdraw modal

On "Add Cash" or "Withdraw" button tap:
  Show a bottom sheet modal with:
    Amount input (INR, numeric keyboard)
    Label input (e.g. "Emergency Fund", "Savings Account")
    Institution (optional)
    Date (defaults to today)
    Notes (optional)
    Confirm button

Creates a CashEntry with type 'addition' or 'withdrawal'.

---

STEP 3 — Cash history row

Per entry row:
  Date | Label | +/- Amount

Additions: green amount
Withdrawals: red amount

---

STEP 4 — Minimal Mode

Cash screen has minimal Minimal Mode differences:
  Same content, slightly reduced visual emphasis on amounts.
  No green/red on additions/withdrawals —
    use neutral text colour with +/- prefix instead.

---

Acceptance criteria:
  ✓ Cash total correctly sums all additions minus withdrawals
  ✓ Month change correctly sums current month only
  ✓ Add/Withdraw modal creates correct CashEntry type
  ✓ History shows entries in reverse chronological order
  ✓ Empty state shown when no cash entries
  ✓ Cash total feeds correctly into Dashboard portfolio total
  ✓ npx tsc --noEmit exits clean
```

---

## MILESTONE 3 — DIFFERENTIATION

---

## Issue #13 — Minimal Mode

```
You are building CogVest. Read AGENTS.md for full context.

Task: Implement complete Minimal Mode across all screens (Issue #13).
This includes the Settings screen and all mode-specific UI behaviour.
Prerequisites: Issues #1–#12 complete and committed.

Reference: docs/cogvest_minimal_mode.png — all screens
           Screen 7 in docs/cogvest_standard_mode.png (Settings)

---

STEP 1 — Settings screen

Create app/settings.tsx:

Section: Display Mode
  Standard Mode radio (full insights, daily updates, price changes)
  Minimal Mode radio (calmer, simplified view with less noise)

  Selecting a mode instantly updates preferences store.
  All open screens react immediately via useTheme() and store subscription.

Section: Minimal Mode Preferences (only shown when Minimal Mode active)
  Toggle: Hide day change & top movers
  Toggle: Hide dashboard insights
  Toggle: Mask portfolio values (separate from eye icon toggle)
  Setting: Default chart range (3 months / 6 months / 1 year)

Layout matches Screen 7 in docs/cogvest_standard_mode.png.

---

STEP 2 — Mode-aware component audit

Review every screen and component built in Issues #7–#12.
For each, verify Minimal Mode behaviour is correct:

Dashboard:
  ✓ Day change hidden (PortfolioValueCard)
  ✓ "Updated today · X:XX AM" shown instead
  ✓ Top movers hidden
  ✓ Insight card hidden
  ✓ Allocation donut still shown
  ✓ LTCG banner still shown
  ✓ Add Trade CTA still shown

Holdings:
  ✓ Day change % hidden on cards
  ✓ P&L colour emphasis reduced
  ✓ LTCG badges still shown
  ✓ Summary row (Current/Invested/P&L columns) hidden

Add Trade:
  ✓ Same in both modes (no difference — entry is neutral)

Asset Detail:
  ✓ Day change hidden
  ✓ Chart defaults to 1Y range
  ✓ Chart tab hidden (chart on Overview)
  ✓ Long-term framing in labels

History:
  ✓ Buy/Sell colour reduced (neutral badges)

Cash:
  ✓ Addition/withdrawal colour reduced

---

STEP 3 — Mode switch animation

When user switches mode in Settings:
  Apply a subtle fade transition (200ms) across the app.
  Do not use jarring instant redraws.

---

STEP 4 — Eye icon (header toggle)

On Dashboard and Holdings headers:
  Eye icon toggles maskPortfolioValues preference.
  Updates immediately — all MaskedValue components react.

---

Acceptance criteria:
  ✓ Settings screen allows switching between Standard and Minimal Mode
  ✓ Mode switch applies immediately across all screens
  ✓ All Minimal Mode preferences work correctly
  ✓ Day change hidden in Minimal Mode everywhere
  ✓ Top movers hidden in Minimal Mode
  ✓ Insight card hidden in Minimal Mode
  ✓ LTCG info visible in both modes
  ✓ Eye icon toggles masking on Dashboard and Holdings
  ✓ Mode switch has smooth fade transition
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #14 — Value Masking

```
You are building CogVest. Read AGENTS.md for full context.

Task: Implement complete value masking across all screens (Issue #14).
Prerequisites: Issues #1–#13 complete and committed.

Reference: Screens 1A, 2A, 4A in docs/cogvest_minimal_mode.png

---

STEP 1 — Masking scope

When maskPortfolioValues is true, mask ALL INR values across:
  - Dashboard: portfolio total, day change absolute amount
  - Holdings: current value, invested, P&L per holding
  - Asset Detail: current value, avg buy price, unrealised P&L
  - Cash: cash balance, entry amounts
  - History: total trade values

Do NOT mask:
  - Percentages (day change %, P&L %)
  - Quantities / units held
  - Price per unit (market data — not personal wealth data)
  - LTCG days countdown

---

STEP 2 — Masked display format

Masked format: "₹*** **,***.**"
  - Preserves the visual structure and length roughly
  - Uses asterisk (*) characters
  - Keeps the ₹ symbol

Large hero values: "₹**** **,***.**"

The exact masked mockup is shown in Screen 1A of
docs/cogvest_minimal_mode.png — match it precisely.

---

STEP 3 — Eye icon behaviour

Dashboard header: eye icon (open eye = values visible)
When tapped: toggles maskPortfolioValues in preferences store.
Change applies across entire app instantly.

The eye icon itself should have a subtle haptic tap via expo-haptics.

---

STEP 4 — Reveal on tap (optional but nice)

On a masked value, tapping it briefly reveals the real value
for 3 seconds, then re-masks.
This should work on: Portfolio Value card, individual holding values.
Implement using a local useState timer.

---

Acceptance criteria:
  ✓ All INR wealth values masked when preference is enabled
  ✓ Percentages and quantities NOT masked
  ✓ Market prices NOT masked
  ✓ Masked format matches mockup exactly
  ✓ Eye icon toggles masking with haptic feedback
  ✓ Tap-to-reveal works on key values
  ✓ Masking applies immediately across all screens
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #15 — LTCG Tracker

```
You are building CogVest. Read AGENTS.md for full context.

Task: Implement complete LTCG tracking across all relevant surfaces
(Issue #15).
Prerequisites: Issues #1–#14 complete and committed.

Reference: Holdings Screen 2 showing "LTCG in 18 days" and
"LTCG Eligible" badges.

---

STEP 1 — LTCG badge component

Create src/components/common/LtcgBadge.tsx:

Props:
  daysToLtcg: number    // 0 means eligible
  isEligible: boolean
  size?: 'sm' | 'md'

Rendering:
  isEligible = true: green pill "LTCG Eligible"
  daysToLtcg <= 30: amber pill "LTCG in X days"
  daysToLtcg > 30: no badge (not shown)

---

STEP 2 — Wire LTCG into holdings derivation

In useHoldings hook (Issue #8):
  After calculateHolding(), call calculateLtcgLots() for each holding.
  Attach ltcgEligible and daysToLtcg to each Holding.
  Only for assets where asset.isTaxEligible === true.
  (Indian stocks and ETFs — not crypto, not cash)

isTaxEligible should be set to true when:
  - exchange is NSE or BSE
  - assetClass is 'stock' or 'etf'

---

STEP 3 — Holdings screen

LtcgBadge is already rendered on HoldingCard (Issue #8).
Verify it shows correctly for:
  - RELIANCE held > 365 days: "LTCG Eligible"
  - HDFCBANK held 347 days: "LTCG in 18 days"
  - Crypto: no badge shown

---

STEP 4 — Asset Detail screen

On the Overview tab:
  Show LTCG status prominently in Your Position section.
  If eligible: green "LTCG Eligible" with checkmark
  If nearing: amber text "LTCG eligible in X days"
  If not close: show "Held for X days" only

---

STEP 5 — Dashboard LTCG banner

LtcgBannerCard (from Issue #9):
  Triggered when any holding has daysToLtcg <= 30.
  Single holding: "RELIANCE becomes LTCG eligible in 18 days"
  Multiple holdings: "2 holdings nearing LTCG eligibility · View"

---

STEP 6 — Multi-lot LTCG edge case

For a holding built across multiple buys at different dates:
  Each buy lot has its own LTCG eligibility date.
  Show the earliest ineligible lot's countdown.
  Example: bought 10 shares in April 2025 (eligible),
  bought 5 more in March 2026 (ineligible, 343 days).
  Show: "LTCG in 22 days" (for the newer lot).

---

Acceptance criteria:
  ✓ LTCG badge shows correctly on holding cards
  ✓ Crypto assets never show LTCG badge
  ✓ Multi-lot LTCG handled correctly
  ✓ Dashboard banner triggers for holdings <= 30 days away
  ✓ Asset Detail Overview shows LTCG status
  ✓ Exactly 365 days held = LTCG Eligible (boundary test)
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #16 — Conviction at Trade Entry

```
You are building CogVest. Read AGENTS.md for full context.

Task: Ensure conviction data flows correctly from trade entry
through to display and analysis readiness (Issue #16).
Prerequisites: Issues #1–#15 complete and committed.

---

STEP 1 — Verify Add Trade screen

ConvictionSelector (from Issue #7) must:
  - Default to no selection (undefined)
  - Allow deselection by tapping active value
  - Save correctly to Trade.conviction field

---

STEP 2 — Conviction display in History

TradeHistoryRow (from Issue #11) must show:
  Conviction: 4/5 ★★★★☆
  When conviction is set on the trade.

Render using filled/unfilled star characters.
Size: small, below the main trade info.

---

STEP 3 — Conviction in Asset Detail trades tab

Asset Detail Trades tab (from Issue #10):
  Each trade row shows conviction stars when set.
  Same rendering as History.

---

STEP 4 — Conviction readiness check

Create src/domain/calculations/conviction.ts has been built
in Issue #4. Verify:
  - analyseConviction() correctly identifies trades with ratings
  - Returns hasEnoughData: false when < 5 rated trades
  - Returns correct insight string when enough data exists

Create a test with 6 rated trades:
  3 high conviction (4-5) trades with +40% return
  3 low conviction (1-2) trades with +10% return
  Verify multiplier ≈ 4.0

---

STEP 5 — Conviction count display

On Dashboard insight card (Issue #9) when not enough conviction data:
  Show onboarding nudge: "Rate 5 more trades to unlock conviction insights"
  Only shown in Standard Mode.

---

Acceptance criteria:
  ✓ Conviction saves correctly from Add Trade
  ✓ Conviction stars render in History and Asset Detail
  ✓ analyseConviction() returns correct results with test data
  ✓ Onboarding nudge shows when < 5 rated trades
  ✓ npx tsc --noEmit exits clean
```

---

## MILESTONE 4 — BEHAVIOUR INSIGHTS

---

## Issue #17 — Behaviour Engine

```
You are building CogVest. Read AGENTS.md for full context.

Task: Build the complete behaviour insights engine (Issue #17).
Prerequisites: Issues #1–#16 complete and committed.

The domain calculation functions were built in Issue #4.
This issue wires them into a unified insights engine.

---

STEP 1 — Insights engine

Create src/features/insights/insightsEngine.ts:

interface InsightCard {
  id: string
  type: 'conviction' | 'patience' | 'frequency' |
        'holding_duration' | 'asset_class_performance'
  title: string
  body: string
  severity: 'positive' | 'neutral' | 'warning'
  dataPoints: number   // how many trades contributed to this insight
  generatedAt: string
}

function generateInsights(
  trades: Trade[],
  holdings: Holding[]
): InsightCard[]

Logic:
  1. Run analyseConviction() → if hasEnoughData, generate insight
  2. Run analysePatienceFromSells() → if hasEnoughData, generate insight
  3. Run analyseTradeFrequency() → if isHighFrequency, generate warning
  4. Calculate average holding duration → if notable, generate insight
  5. Filter out insights with not enough data
  6. Sort by severity: warning first, then positive, then neutral

Tone rule (enforced in this function):
  - Never use "you should" or "you must"
  - Use observational language: "Your X trades outperform Y by Z"
  - Warning tone max: "Your high-frequency periods have historically..."
  - Never: "You are overtrading"

---

STEP 2 — Insights store slice

Add to Zustand store:

  insights: InsightCard[]
  lastInsightUpdate: string | null
  refreshInsights: (trades: Trade[], holdings: Holding[]) => void

refreshInsights:
  Calls generateInsights()
  Updates store
  Called after every new trade is added

---

STEP 3 — Insight rotation

The Dashboard shows one insight at a time.
Rotation strategy:
  - Change active insight daily (persist which index was last shown)
  - If same insight shown yesterday: advance to next
  - If only one insight available: show it every time
  - If no insights: show null

Create src/features/insights/useActiveInsight.ts:
  Returns the current active InsightCard or null.

---

STEP 4 — Minimum data thresholds

Do not generate any insights until:
  - conviction: >= 5 trades with conviction ratings
  - patience: >= 3 sells with intendedHoldDays set
  - frequency: always (frequency data exists from day 1)
  - holding_duration: >= 5 trades total

These thresholds are already in the domain functions from Issue #4.
This step verifies they are respected in the engine.

---

STEP 5 — Unit tests for insights engine

Test generateInsights() with:
  - Empty trades → empty array
  - 4 rated trades → no conviction insight (below threshold)
  - 6 rated trades with clear pattern → conviction insight generated
  - High frequency week → frequency warning generated
  - All insights have correct tone (no "should/must" language)

---

Acceptance criteria:
  ✓ generateInsights() returns correctly typed InsightCard array
  ✓ Insights only generated above minimum data thresholds
  ✓ Tone is observational, never prescriptive
  ✓ Insights refresh after each new trade
  ✓ Active insight rotates daily
  ✓ Unit tests pass
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #18 — Dashboard Insight Card

```
You are building CogVest. Read AGENTS.md for full context.

Task: Wire the behaviour insights engine into the Dashboard
insight card (Issue #18).
Prerequisites: Issues #1–#17 complete and committed.

Reference: Dashboard Screen 1 in docs/cogvest_standard_mode.png
  showing the insight card.

---

STEP 1 — Wire insight into Dashboard

In useDashboard hook (Issue #9):
  Replace static/null activeInsight with:
    const insight = useActiveInsight()

---

STEP 2 — InsightCard component refinement

InsightCard from Issue #9 now receives a full InsightCard object.

Update props:
  insight: InsightCard
  onDismiss: () => void
  onViewDetails: () => void

Styling by severity:
  positive: blue/purple tint (matches Screen 1 mockup)
  neutral: grey tint
  warning: amber tint

"View details →" navigates to the Insights tab on the relevant
asset detail or to a full insights summary (Issue #19).

---

STEP 3 — Onboarding state

When insights array is empty (not enough data yet):
  Show a different card: "Add context to your trades"
  Body: "Rate your conviction on trades to unlock personalised insights."
  CTA: "Add a trade" button

This replaces the insight card when no insights are available.
Only in Standard Mode.

---

STEP 4 — Dismissal behaviour

When user taps X on insight card:
  Mark that insight as dismissed for 7 days (store in preferences)
  Advance to next available insight
  If all dismissed: show nothing (or onboarding card)

---

Acceptance criteria:
  ✓ Real insights from engine shown on Dashboard
  ✓ Severity drives card visual treatment
  ✓ Onboarding card shown when no insights available
  ✓ Dismissal hides insight for 7 days
  ✓ Standard Mode only — hidden in Minimal Mode
  ✓ npx tsc --noEmit exits clean
```

---

## Issue #19 — Asset Detail Insights Tab

```
You are building CogVest. Read AGENTS.md for full context.

Task: Build the Insights tab on the Asset Detail screen (Issue #19).
This completes the behaviour insights layer.
Prerequisites: Issues #1–#18 complete and committed.

---

STEP 1 — Asset-level insights

Create src/domain/calculations/assetInsights.ts:

interface AssetInsightSummary {
  assetName: string
  symbol: string
  totalTrades: number
  ratedTradesCount: number
  avgConviction: number | null
  bestConvictionLevel: ConvictionLevel | null
  averageHoldDays: number | null
  earlyExitCount: number
  insight: string | null
}

function generateAssetInsights(
  asset: Asset,
  trades: Trade[],
  holding: Holding
): AssetInsightSummary

Examples:
  "You've made 6 trades on SOL. Your average conviction was 3.8/5."
  "You've exited this position early 3 times before your intended hold."
  "Your average hold on BTC is 94 days."

---

STEP 2 — Insights tab screen

Replace placeholder from Issue #10 with real content.

Layout:
  Section: Your Behaviour on [Asset Name]
    - avg conviction (star display)
    - avg hold days
    - early exit count

  Section: Conviction breakdown
    List of trades with conviction ratings
    Each shows: date, conviction stars, entry price, current P&L

  Section: Key insight (if available)
    Single insight card for this specific asset

---

STEP 3 — Minimum data for asset insights

Show "Not enough data yet" state when:
  - Fewer than 3 trades for this asset
  - No conviction ratings at all for this asset

Show partial data when:
  - Some trades have conviction, some don't
  - Show what's available, skip what isn't

---

STEP 4 — Link from Dashboard

InsightCard "View details →" should navigate to the relevant
asset's Insights tab when the insight is asset-specific.
For portfolio-wide insights: navigate to a future summary screen
(leave as a TODO comment for now).

---

Acceptance criteria:
  ✓ Insights tab shows real data derived from trades
  ✓ Empty/partial state handled gracefully
  ✓ Conviction breakdown list is accurate
  ✓ "Not enough data" shown below 3 trades
  ✓ Navigation from Dashboard insight card works
  ✓ npx tsc --noEmit exits clean
  ✓ npx jest passes with all tests green
```

---

## Final verification prompt

Run this after all 19 issues are complete:

```
You are reviewing the completed CogVest app. Read AGENTS.md for
full context.

Perform a full verification pass:

1. Run: npx tsc --noEmit
   Must exit with 0 errors.

2. Run: npx jest
   Must exit with all tests passing.

3. Run: npx expo start
   App must launch without errors on Android.

4. Manual screen check — verify each screen matches its mockup:
   - Dashboard Standard Mode vs Screen 1 in docs/cogvest_standard_mode.png
   - Dashboard Minimal Mode vs Screen 1 in docs/cogvest_minimal_mode.png
   - Holdings Standard Mode vs Screen 2 in docs/cogvest_standard_mode.png
   - Holdings Minimal Mode vs Screen 2 in docs/cogvest_minimal_mode.png
   - Add Trade vs Screen 3 in docs/cogvest_standard_mode.png
   - Asset Detail Standard vs Screen 4 in docs/cogvest_standard_mode.png
   - Asset Detail Minimal vs Screen 4A in docs/cogvest_minimal_mode.png
   - History vs Screen 5 in both mockup files
   - Cash vs Screen 6 in both mockup files
   - Settings vs Screen 7 in docs/cogvest_standard_mode.png

5. Data flow check:
   - Add a BUY trade → verify it appears in Holdings and History
   - Add a SELL trade → verify holding units reduce correctly
   - Add cash → verify Dashboard total increases
   - Switch to Minimal Mode → verify day change disappears
   - Enable value masking → verify all INR values are masked

6. LTCG check:
   - Add a stock trade dated 366 days ago
   - Verify "LTCG Eligible" badge appears on Holdings
   - Verify LTCG status shown on Asset Detail

Report any issues found with file location and description.
Fix any issues found before marking complete.
```

---

*CogVest — Codex CLI prompt set — April 2026*
*19 issues · 4 milestones · React Native + Expo*

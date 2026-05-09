# CogVest Tracker — Master Product Spec
> Android-first personal portfolio tracker with behavioural insights and Minimal Mode  
> Covers: Crypto + Indian Stocks + ETFs + Cash  
> Last updated: April 2026

> Scope note: this is the broad product vision, not the current V1 execution
> contract. For V1 work, use `AGENTS.md`, `DESIGN.md`,
> `docs/roadmap/cogvest-version-roadmap.md`, and
> `docs/roadmap/v1-mvp-spec.md`. V1 user-facing language prefers Add Holding
> and Progress; Minimal Mode, LTCG UI, and old History-tab guidance are future
> scope unless a current issue explicitly says otherwise.

---

## 1. Product Summary

CogVest Tracker is an **Android-only, mobile-first portfolio app** designed for tracking a mixed portfolio of **crypto, Indian equities, ETFs, and cash**.

The app is intentionally built around three layers:

1. **Core portfolio tracking**  
   Holdings, trade logging, P&L, allocation, cash, history.

2. **Behaviour-aware investing insights**  
   Conviction, holding discipline, trade patterns, patience, overtrading signals.

3. **Minimal Mode**  
   A calmer, lower-noise portfolio view that reduces short-term emotional checking.

The goal is not just to answer:
- What do I own?
- What is it worth?

But also:
- How do I invest?
- Which behaviours help or hurt my returns?
- How can the UI reduce noise and improve decision quality?

---

## 2. Core Product Positioning

### Primary positioning

**A personal investing app that helps you understand both your portfolio and your investing behaviour.**

### Product identity

CogVest is not just a tracker.

It is:

A personal investing system that reflects how you think, not just what you own.

This is not just a tracker.
It is a:
- portfolio tracker
- investing journal
- behavioural feedback layer
- calm/low-noise portfolio interface

### Key product principles

- **Android-only first**
- **Local-first**: no backend, no login, no cloud sync in the first versions
- **INR-first**: base currency is INR throughout
- **Fast trade entry**: logging a trade should take ~30–45 seconds
- **Behaviour inputs are optional**
- **Derived insights should feel useful, not judgmental**
- **Minimal Mode should reduce compulsive checking, not remove utility**

---

## 3. Problem Statement

Excel works, but it creates friction:
- opening and editing spreadsheets on mobile is slow
- live prices require manual lookup
- P&L and allocation formulas become tedious
- frequent updates are easy to postpone
- there is no behavioural feedback loop

Most portfolio apps solve only the tracking problem.
Very few help the user understand:
- conviction vs hesitation
- holding discipline
- short-term reactive trading habits
- whether behaviour aligns with outcomes

This app aims to replace Excel while adding a behavioural edge.

---

## 4. Platform & Technical Direction

### Platform
- **Android app only**
- Built with **React Native + Expo**
- TypeScript only

### Core stack
- **React Native + Expo SDK 52+**
- **TypeScript**
- **Expo Router** for navigation
- **MMKV** for fast local persistence
- **Zustand** for state management
- **React Native Reanimated** for motion/polish
- **Victory Native** or equivalent for charts
- **React Hook Form + Zod** for forms and validation

### Not included initially
- iOS app
- web app
- login/authentication
- backend or cloud sync
- social features
- brokerage integrations
- push notifications

---

## 5. Differentiation / USP

### 5.1 Behaviour Pattern Layer

The strongest product differentiator.

The app should surface patterns in *how the user invests*, not just what they own.

Examples:
- “Your high conviction trades outperform low conviction trades by 2.1×.”
- “Your positions held for more than 90 days perform better than shorter holds.”
- “Your high-frequency trading periods historically underperform your patient periods.”

### 5.2 Conviction Score

When logging a trade, the user can optionally rate conviction from **1 to 5**.

This enables later insights such as:
- high-conviction vs low-conviction returns
- overconfidence vs hesitation patterns
- conviction consistency by asset class

### 5.3 India-Specific LTCG / STCG Awareness

The app should help the user understand tax-relevant holding duration for Indian equities / ETFs.

Examples:
- “RELIANCE becomes LTCG eligible in 18 days.”
- “2 holdings are nearing LTCG eligibility.”

This is highly useful and low-friction.

### 5.4 Patience Tracking

At trade entry, the user can optionally specify an intended holding period.

The app can later compare:
- intended hold duration
- actual hold duration
- early exit patterns

### 5.5 Discipline Score

A later-stage feature that summarizes execution quality.

This should measure process, not luck.
Example inputs:
- overtrading
- low-conviction trading frequency
- early exits
- alignment between plan and execution

### 5.6 Minimal Mode

Minimal Mode is both a UX feature and a product philosophy.

It gives the user a calmer version of the app by reducing:
- day-to-day noise
- red/green emotional triggers
- top movers / short-term dopamine loops
- information density

Minimal Mode strengthens the behavioural positioning of the product.

---

## 6. Minimal Mode

### Purpose

Minimal Mode is designed to support long-term thinking by reducing unnecessary volatility-focused UI.

### What Minimal Mode should reduce
- short-term emotional reactions
- compulsive checking behaviour
- overly aggressive visual gain/loss emphasis
- clutter and visual overload

### What Minimal Mode should preserve
- total portfolio value
- allocation
- holdings visibility
- trade entry
- trade history
- essential tax/status info

### Minimal Mode design principles
- calmer colours
- reduced green/red emphasis
- fewer gradients
- less dense cards
- long-term framing over short-term fluctuation
- optional masking of portfolio values

### Minimal Mode preferences
- hide day change
- hide top movers
- hide dashboard insights
- mask portfolio values
- use long-term chart range by default

---

## 7. API Strategy

### Indian Stocks & ETFs
Use Yahoo Finance informal APIs.

Examples:
- `https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS`
- `https://query1.finance.yahoo.com/v8/finance/chart/NIFTYBEES.NS`

Expected data:
- current price
- daily change
- historical chart data
- currency

### Crypto
Use CoinGecko.

Examples:
- `/simple/price?ids=bitcoin,solana&vs_currencies=inr,usd`
- `/coins/{id}/history?date={dd-mm-yyyy}`

Expected data:
- live price
- historical data
- INR conversion directly when available

### FX conversion
Use free USD→INR endpoint only if required.

### Refresh strategy
- refresh on app open
- refresh on pull-to-refresh
- no background polling in initial versions
- cache last successful quote locally

---

## 8. Data Model

### Core types

```typescript
export type AssetClass = "crypto" | "stock" | "etf" | "cash"

export interface Asset {
  id: string
  name: string
  ticker: string
  symbol: string
  assetClass: AssetClass
  currency: "INR" | "USD"
  exchange?: "NSE" | "BSE" | "CRYPTO"
  logoUrl?: string
  isTaxEligible?: boolean
}

export interface Trade {
  id: string
  assetId: string
  type: "buy" | "sell"
  quantity: number
  pricePerUnit: number
  totalValue: number
  fees?: number
  date: string // ISO string
  notes?: string

  // Behaviour layer
  conviction?: 1 | 2 | 3 | 4 | 5
  intendedHoldDays?: number
  whyThisTrade?: string
}

export interface CashEntry {
  id: string
  label: string
  amount: number
  institution?: string
  type: "addition" | "withdrawal"
  date: string
  notes?: string
}

export interface Quote {
  assetId: string
  price: number
  currency: "INR" | "USD"
  dayChangePct?: number
  dayChangeAbs?: number
  asOf: string
  source: "yahoo" | "coingecko" | "manual"
}

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

export type ChartRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL"

export interface MinimalModePrefs {
  hideDayChange: boolean
  hideTopMovers: boolean
  hideDashboardInsights: boolean
  maskPortfolioValues: boolean
  defaultChartRange: ChartRange
}

export interface Preferences {
  displayMode: "standard" | "minimal"
  minimal: MinimalModePrefs
  defaultChartRange: ChartRange
  hasCompletedOnboarding: boolean
}
```

### Storage rule

**Persist raw data, derive everything else.**

Persist:
- assets
- trades
- cashEntries
- preferences
- last successful quote cache

Derive:
- holdings
- portfolio summary
- allocation
- LTCG status
- conviction insights
- patience metrics
- dashboard insight cards

This reduces sync bugs and keeps state more reliable.

---

## 9. Core Calculations

### 9.1 Holdings

Holdings should be derived from all trades for an asset.

```typescript
function calculateHolding(trades: Trade[], currentPrice: number): Holding
```

Derived values:
- total units = buys − sells
- average cost price = weighted average of buy-side cost basis
- total invested = remaining units × average cost
- current value = total units × current price
- unrealised P&L = current value − total invested

### 9.2 Portfolio total

```text
Portfolio Total = sum(all holding current values) + cash balance
Cash balance = sum(additions) - sum(withdrawals)
```

### 9.3 Allocation

Allocation should be grouped by asset class:
- crypto
- stocks
- ETFs
- cash

### 9.4 Realised P&L

Later version.
Can initially be implemented as a pure helper if useful, but should not block
the core tracker MVP UI.

### 9.5 LTCG tracker

For Indian stocks / ETFs:

```typescript
Each buy is treated as its own lot.
eligibleDate = buyDate + 365 days
ltcgEligible = today >= eligibleDate
daysToLtcg = Math.max(0, eligibleDate - today)
```

Partial sells should reduce remaining lots using FIFO. A holding is fully
LTCG eligible only when all remaining units are eligible.

### 9.6 Conviction analysis

```typescript
highConviction = trades.filter(t => t.conviction && t.conviction >= 4)
lowConviction = trades.filter(t => t.conviction && t.conviction <= 2)
```

### 9.7 Patience analysis

```typescript
actualHoldDays = sellDate - buyDate
patienceGap = intendedHoldDays - actualHoldDays
```

---

## 10. Information Architecture / Screens

### Primary screens
- Dashboard
- Holdings
- Add Trade
- Asset Detail
- History
- Cash
- Settings

### Navigation model
Bottom tab navigation:
- Dashboard
- Holdings
- Add Trade
- History
- Cash

Asset Detail opens as a drill-down screen.
Settings can be in top-right navigation / modal.

---

## 11. Screen-by-Screen UI Spec

## 11.1 Dashboard — Standard Mode

### Purpose
At-a-glance portfolio overview.

### Show
- Total portfolio value
- Day change in INR and %
- Allocation donut by asset class
- Top movers today
- Add Trade CTA
- Rotating insight card (later versions)
- Optional LTCG reminder banner

### Example structure
```text
Total Portfolio Value
₹14,82,340
+₹8,420 today (+0.57%)

[Insight card]
Your high conviction trades outperform low conviction trades by 2.1×

[Allocation donut]
Crypto 42% · Stocks 31% · ETFs 18% · Cash 9%

[Top movers]
SOL +4.2%
RELIANCE -1.1%

[+ Add Trade]
```

### Notes
The insight card becomes a signature product surface once behavioural data exists.

---

## 11.2 Dashboard — Minimal Mode

### Purpose
A calmer dashboard that reduces short-term noise.

### Show
- Total portfolio value
- Updated timestamp
- Allocation donut
- Add Trade CTA

### Hide or de-emphasize
- daily P&L
- top movers
- rotating behaviour insight card by default
- strong gain/loss colour cues

### Optional
- masked portfolio values until eye icon tap

---

## 11.3 Holdings — Standard Mode

### Purpose
Detailed live view of all current holdings.

### Show per card
- asset symbol and name
- asset class
- quantity
- average cost
- current value
- unrealised P&L
- today’s movement
- LTCG badge where relevant

### Filters
- All
- Crypto
- Stocks
- ETFs
- Cash

### Sort options
- Highest value
- Highest gain
- Biggest loss
- Alphabetical

---

## 11.4 Holdings — Minimal Mode

### Purpose
Low-noise holdings list.

### Show per card
- asset name/symbol
- quantity / units
- current value
- LTCG badge

### Hide or reduce
- daily % change
- strong red/green emphasis
- large P&L badges

### Optional
- masked values mode

---

## 11.5 Add Trade

### Purpose
Fast trade entry with optional behavioural metadata.

### Required fields
- Trade type: Buy / Sell
- Asset class
- Asset
- Quantity
- Price per unit
- Date

### Optional fields
- Fees
- Conviction (1–5)
- Why this trade? note
- Intended hold period

### UX requirements
- must stay completable in under ~45 seconds
- conviction should be a quick button row, not a complex control
- behavioural fields must never be required
- sell quantity validation required
- price cannot be zero
- date cannot be future

### Example conviction UI
```text
Conviction
[1] [2] [3] [4] [5]
Low                  High
```

---

## 11.6 Asset Detail — Standard Mode

### Purpose
Full view of a position.

### Sections
- Position summary
- Price chart (1W / 1M / 3M / 1Y)
- Trade history for that asset
- Behaviour summary (later)
- Conviction analysis (later)
- Tax status / LTCG status

### Key metrics
- current value
- units held
- average cost
- unrealised P&L
- day change
- held days
- LTCG countdown / eligible state

---

## 11.7 Asset Detail — Minimal Mode

### Purpose
Long-term focused asset view.

### Show
- position summary
- long-term chart by default (3M or 1Y)
- held days
- LTCG status
- trade list

### Reduce or hide
- daily movement emphasis
- strong short-term chart framing
- aggressive P&L highlighting

---

## 11.8 History

### Purpose
Full cross-portfolio trade log.

### Show per row
- date
- asset
- buy/sell tag
- quantity
- price
- total
- conviction when present

### Filters
- asset class
- asset
- buy/sell
- conviction band
- date range

---

## 11.9 Cash

### Purpose
Track savings and cash balances.

### Show
- current total cash balance
- add cash / withdraw actions
- cash history entries

### Notes
Keep simple. No behavioural overlay required.

---

## 11.10 Settings

### Sections
- Display Mode
- Minimal Mode preferences
- Chart defaults
- value masking
- future export/import preferences

### Display Mode
- Standard Mode
- Minimal Mode

### Minimal Mode preferences
- Hide day change & top movers
- Hide dashboard insights
- Mask portfolio values
- Default chart range in Minimal Mode

---

## 12. Behaviour & Insights Engine

This should be phased in only after enough trade history exists.

### Candidate insights
- high vs low conviction performance
- average holding duration
- trades held > X days vs shorter holds
- overtrading pattern detection
- best performing asset class
- patience / early exit trends

### Insight card examples
- “Your high conviction trades outperform low conviction trades by 2.1×.”
- “You made 8 trades in the last 3 days. Historically, your high-frequency periods underperform.”
- “Your positions held over 90 days returned 3× more than positions exited early.”

### Tone rule
Insights should feel informative, not scolding.

---

## 13. UI Design Direction

### Visual character
- clean
- premium
- mobile-first
- compact but readable
- dark + light system adaptable
- strong card-based layout

### Standard Mode
- richer information density
- day change visible
- more red/green P&L cues
- insights and movers surfaced

### Minimal Mode
- calmer palette
- reduced motion / emphasis
- less red/green
- less chart obsession
- stronger long-term framing

## 13A. Visual Implementation Rules

### Elevation
- No drop shadows on cards
- Use subtle border: 1px solid rgba(255,255,255,0.08)
- Slightly elevated cards use rgba(255,255,255,0.04) background
- No coloured shadows anywhere

### Touch feedback
- Use Pressable with opacity: 0.75 on pressed state
- No Android ripple effect
- Haptic feedback on primary actions via expo-haptics

### Typography contrast
- Labels/captions: fontWeight 400, color text.secondary
- Body values: fontWeight 600, color text.primary
- INR amounts: fontWeight 800, fontFamily monospace
- Hero portfolio value: fontWeight 900, fontFamily monospace

### Spacing rhythm
- Within card: 12px between elements
- Between cards: 10px gap
- Screen horizontal padding: 16px
- Section headers: 20px margin top, 8px margin bottom

### Colour discipline
- Green (#2E7D52) only on: primary CTA, positive P&L, LTCG eligible
- Red (#FF4D6D) only on: negative P&L, sell actions
- Amber (#F5A623) only on: LTCG warning, neutral signals
- Never use green/red for decorative purposes

### Minimal Mode overrides
- Replace #00C48C gain colour with #4CAF50 (softer)
- Replace #FF4D6D loss colour with #EF5350 (softer)
- Reduce all semantic colour opacity by 30%
- Increase spacing between cards by 4px
---

## 14. Generated UI References

Use these mockups as visual references while building:

### Combined standard + minimal screen collage
- [App screens mockup](cogvest_standard_mode.png)

### Minimal Mode screen collage
- [Minimal Mode screens](cogvest_minimal_mode.png)

These mockups cover:
- Dashboard
- Holdings
- Add Trade
- Asset Detail
- History
- Cash
- Settings
- Standard vs Minimal Mode comparisons
- optional masked value views in Minimal Mode

---

## 15. App Architecture Blueprint

## 15.1 Folder structure

```text
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

mosrc/
  components/
    cards/
      PortfolioValueCard.tsx
      AllocationCard.tsx
      HoldingCard.tsx
      InsightCard.tsx
      TaxStatusCard.tsx
    charts/
      AllocationDonutChart.tsx
      AssetPriceChart.tsx
    common/
      ScreenContainer.tsx
      AppText.tsx
      AppButton.tsx
      SegmentedControl.tsx
      EmptyState.tsx
      MaskedValue.tsx
      Badge.tsx
    forms/
      ConvictionSelector.tsx
      HoldPeriodPicker.tsx
      AssetPicker.tsx

  features/
    dashboard/
    holdings/
    trades/
    history/
    cash/
    insights/
    settings/

  store/
    usePortfolioStore.ts
    selectors.ts
    persistence.ts

  services/
    quotes/
      yahooFinance.ts
      coinGecko.ts
      fx.ts
      quoteResolver.ts
    storage/
      mmkv.ts
    import-export/

  domain/
    calculations/
      holdings.ts
      allocation.ts
      pnl.ts
      ltcg.ts
      conviction.ts
      patience.ts
      insights.ts
    formatters/
      currency.ts
      dates.ts
      percentages.ts
    validators/
      trade.ts

  types/
    asset.ts
    cash.ts
    trade.ts
    holding.ts
    preferences.ts
    quote.ts

  theme/
    colors.ts
    spacing.ts
    typography.ts
    modes.ts

  utils/
    id.ts
```

## 15.2 State slices

Recommended Zustand slices:
- assets slice
- trades slice
- cash slice
- quotes slice
- preferences slice
- refresh / loading slice

## 15.3 Persistence

Persist via MMKV:
- trades
- assets
- cash entries
- preferences
- last quote cache

## 15.4 Selectors / derivation

Selectors should derive:
- holdings list
- dashboard summary
- top movers
- allocation
- asset detail view model
- behaviour insight cards

---

## 16. MVP Scope / Release Plan

Implementation note: the data model may include later-stage optional fields
from the first build so migrations are simpler. UI surfaces and insights should
still follow the phased release order below.

## v0.1 — Core Tracker
Goal: replace Excel for day-to-day usage.

Includes:
- Dashboard
- Holdings
- Add Trade
- Asset Detail
- History
- Cash
- price fetching
- local persistence

## v0.2 — First Differentiation
Goal: add lightweight unique value.

Includes:
- Conviction score at trade entry
- optional trade note
- LTCG/STCG tracking
- Minimal Mode
- display preferences

## v0.3 — Behaviour Insights
Goal: make the app behaviour-aware.

Includes:
- conviction vs returns
- holding duration analysis
- trade frequency insights
- dashboard insight card
- behaviour summary on asset detail

## v0.4 — Psychology Layer
Goal: deepen process awareness.

Includes:
- intended hold period
- patience tracking
- early exit analysis
- discipline score

---

## 17. What This Replaces

| Excel task | App equivalent |
|---|---|
| Manual price lookup | Auto refresh on open / pull-to-refresh |
| P&L formulas | Derived automatically |
| Allocation formulas | Dashboard donut + allocation summary |
| Trade log tab | Full history + asset trade history |
| Manual tax holding tracking | LTCG countdown / eligible badges |
| Notes in random cells | Trade note / conviction metadata |

---

## 18. Final Product Summary

Portfolio Tracker is an Android-first personal investing app with three layers:

1. **Track the portfolio**  
   Holdings, value, trades, allocation, cash.

2. **Understand investing behaviour**  
   Conviction, patience, frequency, discipline, insight cards.

3. **Reduce noise with Minimal Mode**  
   A calmer interface for long-term thinking.

This gives the product a clear identity:

> **Track your portfolio. Understand your behaviour.**


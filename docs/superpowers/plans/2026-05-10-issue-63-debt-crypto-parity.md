# Issue 63 Debt And Crypto Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support debt and crypto as first-class V1 portfolio categories with manual/live quote-safe valuation.

**Architecture:** Extend asset metadata defaults and form behavior so debt/crypto assets are easy to create, then verify the existing holding/dashboard pipeline derives totals and allocation correctly. Keep all derived values out of persistence.

**Tech Stack:** TypeScript, Expo React Native, Zustand vanilla store, Jest, React Native Testing Library.

---

### Task 1: Category Defaults

**Files:**
- Modify: `src/domain/assets/metadata.ts`
- Test: `src/domain/assets/__tests__/metadata.test.ts`

- [ ] Add practical debt instrument defaults for PPF, liquid funds, arbitrage funds, bonds, and fixed deposits.
- [ ] Keep crypto defaults INR-display friendly with CoinGecko `quoteSourceId` support.
- [ ] Test debt and crypto defaulting behavior.

### Task 2: Quote Fallback Safety

**Files:**
- Modify: `src/services/quotes/quoteResolver.ts`
- Test: `src/services/quotes/__tests__/quotes.test.ts`

- [ ] Skip unsupported live providers for debt-like assets and return manual fallback when available.
- [ ] Keep CoinGecko behavior for crypto.
- [ ] Test debt manual fallback and crypto provider failure fallback.

### Task 3: Derived Holding Coverage

**Files:**
- Modify: `src/domain/calculations/__tests__/holdings.test.ts`
- Test existing `src/domain/calculations/holdings.ts`

- [ ] Add debt opening-position test with manual current price.
- [ ] Add crypto opening/trade test with INR current value.
- [ ] Assert category allocation includes debt and crypto.

### Task 4: Entry Form Defaults

**Files:**
- Modify: `src/features/openingPositions/AddOpeningPositionForm.tsx`
- Modify: `src/features/trades/add-trade-form.tsx`
- Test: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`
- Test: `src/features/trades/__tests__/AddTradeForm.test.tsx`

- [ ] Ensure debt class selection defaults metadata to debt/fixed-income and exchange/currency-safe values.
- [ ] Ensure crypto class selection defaults metadata to crypto/digital asset and quote source id can be set to a CoinGecko id.
- [ ] Test debt and crypto creation from Add Holding or Add Trade.

### Task 5: Verification And Delivery

**Commands:**
- `npm run typecheck`
- `npm test`
- `npm run doctor`
- `git diff --check`

- [ ] Verify all commands.
- [ ] Commit on `v1/issue-63-debt-crypto-parity`.
- [ ] Push and open PR with `Closes #63`.


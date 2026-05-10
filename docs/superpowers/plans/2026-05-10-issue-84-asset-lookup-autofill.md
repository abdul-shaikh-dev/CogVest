# Issue 84 Asset Lookup Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight asset lookup and current-price autofill to Add Holding while preserving manual entry fallback.

**Architecture:** Create a focused `src/services/assetLookup/` service that normalizes Yahoo Finance and CoinGecko search responses. Inject lookup and quote dependencies into `AddOpeningPositionForm` so UI behavior is testable without live network calls.

**Tech Stack:** React Native, Expo Router, TypeScript, Jest, React Native Testing Library, existing quote resolver.

---

### Task 1: Asset Lookup Service

**Files:**
- Create: `src/services/assetLookup/index.ts`
- Create: `src/services/assetLookup/__tests__/assetLookup.test.ts`

- [x] Define `AssetLookupResult`, provider response types, and URL builders for Yahoo search and CoinGecko search.
- [x] Write tests for mapping NSE stock, ETF, crypto coin, and provider failure.
- [x] Implement provider-specific mapping and `searchAssetLookupResults`.
- [x] Export the service from `src/services/assetLookup/index.ts`.

### Task 2: Add Holding Dependency Injection And Autofill

**Files:**
- Modify: `src/features/openingPositions/AddOpeningPositionForm.tsx`
- Modify: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`

- [x] Extend form props with optional lookup and quote resolver functions.
- [x] Add debounced lookup state and result rendering.
- [x] On result selection, fill asset metadata and fetch one live quote.
- [x] Show non-blocking status text for lookup and quote success/failure.
- [x] Add tests for successful lookup+price autofill and quote failure manual fallback.
- [x] Re-run existing manual asset tests to confirm no regression.

### Task 3: Verification And Delivery

**Commands:**
- `npm test -- --runTestsByPath src/services/assetLookup/__tests__/assetLookup.test.ts src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`
- `npm run typecheck`
- `npm test`
- `npm run doctor`
- `git diff --check`

- [x] Verify focused tests.
- [x] Verify full static/test/doctor suite.
- [ ] Commit on `v1/issue-84-asset-lookup-autofill`.
- [ ] Push and open PR with `Closes #84`.

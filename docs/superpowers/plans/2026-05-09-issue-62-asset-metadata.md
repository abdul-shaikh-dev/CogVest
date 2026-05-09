# Issue 62 Asset Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand raw asset metadata for Excel tracker parity while preserving mobile-first Add Holding/Add Trade flows.

**Architecture:** Add metadata fields to the `Asset` type, normalize stored assets through a small domain helper during store rehydration, and derive sector/instrument allocation from holdings. Capture metadata in the two asset-entry forms with lightweight defaults.

**Tech Stack:** TypeScript, Expo React Native, Zustand vanilla store, Jest, React Native Testing Library.

---

### Task 1: Asset Metadata Model

**Files:**
- Modify: `src/types/asset.ts`
- Create: `src/domain/assets/metadata.ts`
- Create: `src/domain/assets/index.ts`
- Test: `src/domain/assets/__tests__/metadata.test.ts`

- [ ] Add `InstrumentType`, `SectorType`, and `quoteSourceId` to `Asset`.
- [ ] Add `normalizeAssetMetadata(asset)` to fill missing metadata from asset class.
- [ ] Test stock, ETF, debt, crypto, cash, and explicit metadata preservation.

### Task 2: Store Migration

**Files:**
- Modify: `src/store/index.ts`
- Test: `src/store/__tests__/portfolioStore.test.ts`

- [ ] Bump portfolio schema to v3.
- [ ] Normalize every stored asset in `readPortfolioSnapshot`.
- [ ] Keep v1/v2 snapshots readable and default missing metadata.
- [ ] Test persisted metadata and migration defaults.

### Task 3: Derived Metadata Rollups

**Files:**
- Modify: `src/domain/calculations/holdings.ts`
- Modify: `src/domain/calculations/index.ts`
- Test: `src/domain/calculations/__tests__/holdings.test.ts`

- [ ] Add `calculateMetadataAllocation(holdings, metadataKey)`.
- [ ] Export sector and instrument allocation helpers.
- [ ] Test values are derived from current holding values and not persisted.

### Task 4: Add Holding Metadata

**Files:**
- Modify: `src/features/openingPositions/openingPositionForm.ts`
- Modify: `src/features/openingPositions/AddOpeningPositionForm.tsx`
- Test: `src/features/openingPositions/__tests__/openingPositionForm.test.ts`
- Test: `src/features/openingPositions/__tests__/AddOpeningPositionForm.test.tsx`

- [ ] Validate and normalize instrument type, sector type, and quote source id.
- [ ] Render metadata fields in the Add Holding asset section.
- [ ] Save metadata into newly created assets.
- [ ] Keep selected existing asset metadata intact.

### Task 5: Add Trade Metadata

**Files:**
- Modify: `src/features/trades/add-trade-form.tsx`
- Test: `src/features/trades/__tests__/AddTradeForm.test.tsx`

- [ ] Add lightweight metadata fields for manual assets.
- [ ] Default manual asset metadata from stock/equity and ticker.
- [ ] Save metadata without changing normal buy/sell trade behavior.

### Task 6: Verification And Delivery

**Commands:**
- `npm run typecheck`
- `npm test`
- `npm run doctor`
- `git diff --check`

- [ ] Verify all commands.
- [ ] Commit on `v1/issue-62-asset-metadata`.
- [ ] Push and open PR with `Closes #62`.


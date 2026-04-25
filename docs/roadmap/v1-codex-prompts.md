# CogVest V1 Codex Prompts

Use these prompts in order. Each issue should remain independently testable and should not add V2/V3 scope.

## [V1] Scaffold Expo Android app

Create the Expo SDK 52+ TypeScript app with Expo Router tabs, Android-only config, strict TypeScript, Jest, and baseline scripts.

Files:
- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/dashboard.tsx`
- `app/(tabs)/holdings.tsx`
- `app/(tabs)/add-trade.tsx`
- `app/(tabs)/cash.tsx`
- `app/settings.tsx`
- `package.json`
- `tsconfig.json`
- `jest.config.js`

Acceptance:
- Tabs render.
- `npm run typecheck`, `npm test`, and `npx expo start` work.

## [V1] Add theme and common UI primitives

Create CogVest tokens and common UI primitives for dark Android UI.

Files:
- `src/theme/*`
- `src/components/common/AppText.tsx`
- `src/components/common/AppButton.tsx`
- `src/components/common/ScreenContainer.tsx`
- `src/components/common/MaskedValue.tsx`
- `src/components/common/EmptyState.tsx`

Acceptance:
- No shadows; subtle borders; primary green only for intended semantic actions.
- MaskedValue masks INR wealth values.

## [V1] Define types, store, and persistence

Create canonical TypeScript types, Zustand store slices, selectors, and MMKV persistence.

Files:
- `src/types/*`
- `src/store/usePortfolioStore.ts`
- `src/store/selectors.ts`
- `src/services/storage/mmkv.ts`
- `src/utils/id.ts`

Acceptance:
- Persist raw assets, trades, cash entries, preferences.
- Do not persist derived holdings/allocation/dashboard totals.
- Store action tests pass.

## [V1] Implement domain calculations and formatters

Implement pure calculations for V1.

Files:
- `src/domain/calculations/holdings.ts`
- `src/domain/calculations/allocation.ts`
- `src/domain/calculations/pnl.ts`
- `src/domain/calculations/conviction.ts`
- `src/domain/formatters/currency.ts`
- `src/domain/formatters/dates.ts`
- `src/domain/validators/trade.ts`

Acceptance:
- Unit tests cover weighted average, partial sells, zero totals, allocation, portfolio total, INR formatting, and conviction readiness.

## [V1] Add live quote services

Implement current quote fetching only.

Files:
- `src/services/quotes/yahooFinance.ts`
- `src/services/quotes/coinGecko.ts`
- `src/services/quotes/quoteResolver.ts`
- `src/services/quotes/useQuoteRefresh.ts`

Acceptance:
- Yahoo handles Indian stock/ETF current quotes.
- CoinGecko handles crypto current quotes.
- Failures return null/empty and do not throw into UI.
- Manual price fallback remains available.

## [V1] Build Add Trade form validation

Create form schema and validation logic before UI integration.

Files:
- `src/domain/validators/trade.ts`
- `src/features/trades/tradeForm.ts`
- `src/features/trades/__tests__/tradeForm.test.ts`

Acceptance:
- Price and quantity must be positive.
- Future dates are rejected.
- Sell quantity cannot exceed current holding.
- Conviction remains optional.

## [V1] Build Add Trade screen

Implement fast trade entry with live/manual price and optional conviction.

Files:
- `app/(tabs)/add-trade.tsx`
- `src/components/forms/ConvictionSelector.tsx`
- `src/components/forms/AssetPicker.tsx`
- `src/components/forms/TradeReviewSheet.tsx`

Acceptance:
- Standard buy can be logged in under 45 seconds.
- New assets can be created.
- Confirmed trade persists.

## [V1] Build Holdings derivation and screen

Derive holdings from trades and quotes, then render empty/filled states.

Files:
- `src/features/holdings/useHoldings.ts`
- `src/components/cards/HoldingCard.tsx`
- `app/(tabs)/holdings.tsx`

Acceptance:
- Holdings are not hardcoded.
- Values update after trades and quote refresh.
- No LTCG UI appears in V1.

## [V1] Build Dashboard MVP

Render total value, allocation, quote freshness, value masking, and conviction nudge.

Files:
- `src/features/dashboard/useDashboard.ts`
- `src/components/cards/PortfolioValueCard.tsx`
- `src/components/cards/AllocationCard.tsx`
- `src/components/cards/ConvictionNudgeCard.tsx`
- `app/(tabs)/dashboard.tsx`

Acceptance:
- Dashboard total equals holdings plus cash.
- Allocation derives from holdings/cash.
- No Minimal Mode or LTCG appears in V1.

## [V1] Build Cash screen

Implement local cash additions and withdrawals.

Files:
- `app/(tabs)/cash.tsx`
- `src/features/cash/useCash.ts`
- `src/components/cards/CashEntryRow.tsx`

Acceptance:
- Cash total equals additions minus withdrawals.
- Cash updates dashboard total.

## [V1] Build Settings and value masking

Implement simple settings and global masking preference.

Files:
- `app/settings.tsx`
- `src/features/settings/usePreferences.ts`
- Update all V1 value renderers.

Acceptance:
- Masking affects all INR wealth values.
- Quantities, percentages, and market prices are not masked.
- No Minimal Mode toggle in V1.

## [V1] Configure Android app identity and icons

Configure Android metadata for preview and release builds.

Files:
- `app.json` or `app.config.ts`
- asset placeholders if needed

Acceptance:
- App name is CogVest.
- Android package is documented as `com.abdulshaikh.cogvest`.

## [V1] Configure EAS build profiles

Add EAS profiles for development, preview APK, and production AAB.

Files:
- `eas.json`
- `docs/release/android-release-process.md`

Acceptance:
- Preview profile outputs APK.
- Production profile outputs AAB.

## [V1] Add Android preview workflow draft

Draft GitHub workflow for preview APK builds.

Files:
- `docs/release/github-actions-drafts.md`

Acceptance:
- Workflow includes install, typecheck, tests, Expo doctor, and EAS preview build.

## [V1] Add Android production workflow draft

Draft production AAB workflow without auto-submit.

Files:
- `docs/release/github-actions-drafts.md`

Acceptance:
- Workflow triggers on release tag/manual dispatch.
- Requires `EXPO_TOKEN`.

## [V1] Verify preview APK on device

Run the V1 dev-complete release gate.

Files:
- `docs/release/v1-release-checklist.md`

Acceptance:
- Preview APK builds.
- Preview APK installs on real Android device.
- EAS URL and manual test notes are recorded.

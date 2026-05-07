# V1 Issue Drafts

> Status: historical issue-draft reference. The live GitHub issues are the
> source of truth. User-facing V1 language should now prefer Add Holding,
> Dashboard, Holdings, Progress, Cash, and Settings; internal code may still use
> trade terminology until refactored.

Milestone: CogVest V1 MVP

## [V1] Scaffold Expo Android app

Labels: `v1`, `infra`, `frontend`, `feature`, `priority-high`

### Context
Create the Android-first Expo foundation for CogVest.

### Scope
- Create Expo SDK 52+ TypeScript app.
- Configure Expo Router tabs.
- Configure strict TypeScript and Jest.
- Add base scripts.

### Out of Scope
- Feature screens beyond placeholders.
- Runtime business logic.

### Technical Notes
- Files: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, tab placeholders, `package.json`, `tsconfig.json`, `jest.config.js`.

### Design Reference
- `docs/design/v1-ui-mockup-plan.md`
- Figma: https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d

### Acceptance Criteria
- Five core tabs are visible.
- App is Android-only.
- TypeScript strict mode is enabled.
- Smoke test passes.

### Test Steps
- Open app with Expo.
- Navigate tabs.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Add theme and common UI primitives

Labels: `v1`, `frontend`, `design`, `feature`, `priority-high`

### Context
Provide reusable UI primitives before screens are built.

### Scope
- Theme tokens.
- AppText, AppButton, ScreenContainer, EmptyState, MaskedValue.
- Pressable opacity feedback and dark card style.

### Out of Scope
- Full screen implementation.
- Minimal Mode.

### Technical Notes
- Files: `src/theme/*`, `src/components/common/*`.

### Design Reference
- `docs/design/v1-ui-mockup-plan.md`

### Acceptance Criteria
- Tokens match CogVest design rules.
- MaskedValue supports V1 masking format.
- No coloured shadows.

### Test Steps
- Render common components in tests or story-like screen.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Define types, store, and persistence

Labels: `v1`, `store`, `feature`, `priority-high`

### Context
Set the raw-data persistence contract.

### Scope
- Types for assets, trades, cash, quotes, holdings, preferences.
- Zustand store.
- MMKV persistence.
- Selectors.

### Out of Scope
- Derived holdings persistence.
- V2/V3 fields in UI.

### Technical Notes
- Files: `src/types/*`, `src/store/*`, `src/services/storage/mmkv.ts`, `src/utils/id.ts`.

### Design Reference
- `docs/roadmap/v1-mvp-spec.md`

### Acceptance Criteria
- Raw data persists.
- Derived values are not persisted.
- Quotes are cached separately from main persisted store if implemented.

### Test Steps
- Add/update/remove asset, trade, cash entry, preferences.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Implement domain calculations and formatters

Labels: `v1`, `domain`, `feature`, `testing`, `priority-high`

### Context
Portfolio values must be pure and testable.

### Scope
- Holdings.
- Allocation.
- Portfolio total/day change.
- INR/date formatting.
- Trade validation helpers.
- Conviction readiness.

### Out of Scope
- LTCG.
- Patience/frequency.
- Historical charts.

### Technical Notes
- Files: `src/domain/calculations/*`, `src/domain/formatters/*`, `src/domain/validators/trade.ts`.

### Design Reference
- `docs/roadmap/v1-mvp-spec.md`

### Acceptance Criteria
- Weighted average and partial sell tests pass.
- Zero/empty states are handled.
- Domain functions have no store access.

### Test Steps
- Run focused unit tests for each domain module.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Add live quote services

Labels: `v1`, `domain`, `feature`, `priority-high`

### Context
V1 should feel like a tracker, not a static ledger.

### Scope
- Yahoo Finance current quotes for Indian stocks/ETFs.
- CoinGecko current quotes for crypto.
- Quote resolver.
- Quote refresh hook.
- Manual fallback state.

### Out of Scope
- Historical charts.
- Advanced asset search.
- Background polling.

### Technical Notes
- Files: `src/services/quotes/*`.

### Design Reference
- `docs/roadmap/v1-mvp-spec.md`

### Acceptance Criteria
- Quote failures never crash UI.
- Current prices can refresh on app open/pull-to-refresh.
- Manual price fallback remains available.

### Test Steps
- Mock success and failure responses.
- Manually refresh quotes.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Build Add Holding validation

Labels: `v1`, `domain`, `testing`, `feature`, `priority-high`

### Context
Trade validation must be correct before the UI writes local data.

### Scope
- Zod schema.
- Future-date validation.
- Positive quantity/price.
- Sell quantity validation.

### Out of Scope
- UI layout.
- V2 intended hold behaviour.

### Technical Notes
- Files: `src/domain/validators/trade.ts`, `src/features/trades/tradeForm.ts`.

### Design Reference
- `docs/design/v1-ui-mockup-plan.md`

### Acceptance Criteria
- Invalid inputs return actionable errors.
- Conviction is optional.

### Test Steps
- Validate buy and sell form cases.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Build Add Holding screen

Labels: `v1`, `frontend`, `feature`, `priority-high`

### Context
Fast Add Holding entry is the core V1 workflow.

### Scope
- Buy/sell toggle.
- Asset selection/manual creation.
- Live/manual price.
- Quantity, fees, date, note.
- Optional conviction.
- Review and confirm.

### Out of Scope
- Intended hold period.
- Advanced search.

### Technical Notes
- Files: `app/(tabs)/add-trade.tsx`, `src/components/forms/*`.

### Design Reference
- `docs/design/v1-ui-mockup-plan.md`
- Figma: https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d

### Acceptance Criteria
- Standard buy can be logged in under 45 seconds.
- Confirmed trade persists.
- Haptic success feedback occurs.

### Test Steps
- Add buy trade.
- Add sell trade.
- Attempt invalid sell.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Build Holdings screen

Labels: `v1`, `frontend`, `store`, `feature`, `priority-high`

### Context
Holdings are the primary proof that trades are being derived correctly.

### Scope
- `useHoldings`.
- HoldingCard.
- Empty and filled states.
- Pull-to-refresh quote action.

### Out of Scope
- LTCG badges.
- Minimal Mode.

### Technical Notes
- Files: `src/features/holdings/useHoldings.ts`, `src/components/cards/HoldingCard.tsx`, `app/(tabs)/holdings.tsx`.

### Design Reference
- `docs/design/v1-ui-mockup-plan.md`

### Acceptance Criteria
- Holdings derive from trades and quotes.
- No hardcoded portfolio values.
- V1 shows no LTCG UI.

### Test Steps
- Add trade and verify holding appears.
- Refresh quote and verify value updates.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Build Dashboard MVP

Labels: `v1`, `frontend`, `store`, `feature`, `priority-high`

### Context
Dashboard gives the at-a-glance portfolio view.

### Scope
- Total value.
- Allocation.
- Quote freshness.
- Basic conviction nudge.
- Add Holding CTA.
- Value masking support.

### Out of Scope
- Minimal Mode.
- Top movers.
- LTCG banner.

### Technical Notes
- Files: `src/features/dashboard/useDashboard.ts`, dashboard cards, `app/(tabs)/dashboard.tsx`.

### Design Reference
- `docs/design/v1-ui-mockup-plan.md`

### Acceptance Criteria
- Total equals holdings plus cash.
- Allocation derives from current values.
- Conviction state shows not-enough-data guidance.

### Test Steps
- Add trade, add cash, verify total.
- Toggle masking.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Build Cash screen

Labels: `v1`, `frontend`, `store`, `feature`, `priority-medium`

### Context
Cash is part of total portfolio value.

### Scope
- Add cash.
- Withdraw cash.
- Cash history.
- Empty state.

### Out of Scope
- Behaviour overlay.
- Import/export.

### Technical Notes
- Files: `app/(tabs)/cash.tsx`, `src/features/cash/useCash.ts`, `src/components/cards/CashEntryRow.tsx`.

### Design Reference
- `docs/design/v1-ui-mockup-plan.md`

### Acceptance Criteria
- Cash total is additions minus withdrawals.
- Dashboard total includes cash.

### Test Steps
- Add and withdraw cash.
- Restart and verify persistence.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Build Settings and value masking

Labels: `v1`, `frontend`, `store`, `feature`, `priority-medium`

### Context
Users need privacy controls for portfolio values.

### Scope
- Simple settings screen.
- Global masking preference.
- Eye/toggle interaction.
- Apply masking to V1 INR wealth values.

### Out of Scope
- Minimal Mode settings.
- Export/import settings.

### Technical Notes
- Files: `app/settings.tsx`, preference hooks, value renderers.

### Design Reference
- `docs/design/v1-ui-mockup-plan.md`

### Acceptance Criteria
- Wealth values mask globally.
- Quantities and percentages remain visible.
- Setting persists after restart.

### Test Steps
- Toggle masking across dashboard, holdings, cash.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Configure Android app identity and icons

Labels: `v1`, `infra`, `release`, `testing`, `priority-high`

### Context
V1 preview/release builds need Android identity.

### Scope
- App name.
- Android package.
- Version fields.
- Icon/adaptive icon/splash placeholders or plan.

### Out of Scope
- Play Store auto-submit.

### Technical Notes
- Files: `app.json` or `app.config.ts`, assets as needed.

### Design Reference
- `docs/release/android-release-process.md`

### Acceptance Criteria
- App identity is configured for Android builds.
- No signing secrets are committed.

### Test Steps
- Inspect Expo config.
- Run Expo doctor.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Configure EAS build profiles

Labels: `v1`, `infra`, `release`, `testing`, `priority-high`

### Context
Preview APK and production AAB profiles must be defined.

### Scope
- `eas.json`.
- development, preview, production profiles.

### Out of Scope
- Triggering cloud builds without approval.

### Technical Notes
- Files: `eas.json`, `docs/release/android-release-process.md`.

### Design Reference
- `docs/release/android-release-process.md`

### Acceptance Criteria
- Preview outputs APK.
- Production outputs AAB.
- `EXPO_TOKEN` is documented, not committed.

### Test Steps
- Validate EAS config syntax.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Add Android preview build workflow draft

Labels: `v1`, `infra`, `release`, `testing`, `priority-medium`

### Context
Preview build automation should be documented before enabling.

### Scope
- Draft preview workflow.
- Include install/typecheck/test/Expo doctor/EAS preview build.

### Out of Scope
- Running paid/cloud build automatically.

### Technical Notes
- Files: `docs/release/github-actions-drafts.md`.

### Design Reference
- `docs/release/android-release-process.md`

### Acceptance Criteria
- Draft names required secret `EXPO_TOKEN`.
- Workflow does not require emulator.

### Test Steps
- Review workflow steps.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Add Android production build workflow draft

Labels: `v1`, `infra`, `release`, `testing`, `priority-medium`

### Context
Production AAB should be a release-candidate gate, not a dev-complete blocker.

### Scope
- Draft production AAB workflow.
- Manual/tag trigger.
- No auto-submit.

### Out of Scope
- Google Play service account setup.

### Technical Notes
- Files: `docs/release/github-actions-drafts.md`.

### Design Reference
- `docs/release/android-release-process.md`

### Acceptance Criteria
- Production workflow builds AAB.
- Play Store upload remains manual for V1.

### Test Steps
- Review trigger and secret usage.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

## [V1] Verify preview APK on emulator

Labels: `v1`, `infra`, `release`, `testing`, `priority-high`

### Context
V1 dev-complete requires an installable Android preview build.

### Scope
- Run V1 release checklist dev-complete gate.
- Build preview APK.
- Install on Android Emulator.
- Record build URL and manual QA notes.

### Out of Scope
- Production AAB.
- Play Store submission.

### Technical Notes
- Files: `docs/release/v1-release-checklist.md`.

### Design Reference
- `docs/release/v1-release-checklist.md`

### Acceptance Criteria
- Preview APK builds.
- APK installs on Android Emulator.
- Core manual flows pass or defects are logged.

### Test Steps
- Follow checklist in `docs/release/v1-release-checklist.md`.

### Commands
- `npx tsc --noEmit`
- `npx jest`
- `npx expo start`

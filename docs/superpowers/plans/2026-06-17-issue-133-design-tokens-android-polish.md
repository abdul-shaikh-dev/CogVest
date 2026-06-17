# Issue 133 Design Tokens and Android Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align CogVest's shared V1 UI foundation with DESIGN.md by fixing green tokens, Android touch targets, pressed-state feedback, and predictive back configuration.

**Architecture:** Keep this as a shared-layer change. Theme tokens live in `src/theme/index.ts`; common press behavior should be reusable from `src/components/common`; screen-specific chips should adopt the shared interaction/touch constants without changing screen business logic.

**Tech Stack:** React Native `Pressable`, Expo app config, TypeScript, Jest / React Native Testing Library.

---

### Task 1: Token Contract

**Files:**
- Modify: `src/theme/index.ts`
- Modify: `src/theme/__tests__/theme.test.ts`
- Modify: `DESIGN.md`

- [x] Update `colors.primary` to `#34C759` and `colors.deepGreen` to `#248A3D`, matching DESIGN.md.
- [x] Keep `colors.profit` as a separate semantic token even though it currently shares the same hex. This preserves the rule that CTA/selected state and financial gains are conceptually different.
- [x] Add interaction tokens for Android touch behavior:
  - `minimumTouchTarget: 48`
  - `stateLayerOpacity: 0.12`
  - `rippleColor: "rgba(255,255,255,0.12)"`
  - `primaryRippleColor: "rgba(0,0,0,0.18)"`
- [x] Update `theme.test.ts` to assert the final token values.
- [x] Update DESIGN.md wording to state the semantic distinction: Primary Green and Positive currently share `#34C759`, but agents must use `colors.primary` for actions/selected states and `colors.profit` for financial gains.

### Task 2: Shared Pressable Helpers

**Files:**
- Create: `src/components/common/pressableStyles.ts`
- Modify: `src/components/common/index.ts`
- Modify: `src/components/common/__tests__/commonComponents.test.tsx`

- [x] Create `pressableStyles.ts` with:
  - `androidRipple(color = interaction.rippleColor)`
  - `minimumTouchTargetStyle`
  - `getPressedStateStyle({ disabled, pressed })`
- [x] Keep opacity fallback for non-disabled pressed state, but centralize it.
- [x] Test helper output directly so screens can rely on the shared contract.
- [x] Export helpers from `src/components/common/index.ts`.

### Task 3: Common Components

**Files:**
- Modify: `src/components/common/AppButton.tsx`
- Modify: `src/components/common/Premium.tsx`
- Modify: `src/components/common/__tests__/commonComponents.test.tsx`

- [x] Update `AppButton` to use shared pressed-state helper and `android_ripple`.
- [x] Update `IconButton` to be 48x48 with Android ripple.
- [x] Update `GroupedListRow` pressables to use Android ripple and shared pressed-state helper.
- [x] Add tests that `IconButton` renders a 48dp touch target.

### Task 4: Screen-Specific Chips

**Files:**
- Modify: `src/features/progress/ProgressScreen.tsx`
- Modify: `src/features/holdings/HoldingsScreen.tsx`
- Modify: `src/features/progress/__tests__/ProgressScreen.test.tsx`
- Modify: `src/features/holdings/__tests__/HoldingsScreen.test.tsx`

- [x] Add Android ripple to Progress chart range chips.
- [x] Make Progress range chips at least 48dp tall.
- [x] Add Android ripple to Holdings filter chips.
- [x] Make Holdings filter chips at least 48dp tall.
- [x] Preserve existing testIDs and behavior.
- [x] Verify existing screen tests still assert the chip controls render and remain usable.

### Task 5: Predictive Back

**Files:**
- Modify: `app.json`
- Modify: `src/__tests__/androidIdentity.test.ts`

- [x] Set `expo.android.predictiveBackGestureEnabled` to `true`.
- [x] Add a test assertion documenting that predictive back is enabled for Android-first V1 behavior.

### Task 6: Verification and PR

**Commands:**
- `npm run typecheck`
- `npm test`
- `npm run doctor`
- `npm run android:smoke`

- [x] If emulator is unavailable, record the exact `adb`/smoke output instead of claiming emulator verification.
- [ ] Commit with a focused message.
- [ ] Push branch and open a PR with `Closes #133`.

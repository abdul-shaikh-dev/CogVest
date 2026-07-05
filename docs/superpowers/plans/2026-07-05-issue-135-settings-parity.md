# Issue #135 Settings Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved trust-first Settings screen contract from issue #135.

**Architecture:** Keep Settings behavior inside `src/features/settings`. Extend the existing `useSettings` hook to expose user-facing quote-source labels, then update `SettingsScreen` to render a compact local-first summary, real value masking control, quote status, compact app info, and disabled/deferred data action. Avoid adding real export, backup, cloud, analytics, account, or clear-data functionality.

**Tech Stack:** React Native, Expo, TypeScript, Zustand store, React Native Testing Library, existing CogVest common components/theme.

---

## File Structure

- Modify: `src/features/settings/useSettings.ts`
  - Derive user-facing quote source label: `Waiting`, `Live`, `Manual`, or `Mixed`.
  - Keep existing quote counts/latest quote data.
- Modify: `src/features/settings/SettingsScreen.tsx`
  - Implement compact trust-first hierarchy.
  - Rename user-facing `Provider status` to `Quote source`.
  - Remove unsupported working-looking rows.
  - Keep `value-mask-toggle`.
- Modify: `src/features/settings/__tests__/useSettings.test.tsx`
  - Cover quote source labels for empty/live/manual/mixed states.
- Modify: `src/features/settings/__tests__/SettingsScreen.test.tsx`
  - Cover privacy summary, value masking, quote wording, mixed state, deferred data action, and absent V2/V3 leaks.
- Optional Modify: `src/components/common/Premium.tsx`
  - Only if Settings needs a disabled/deferred row affordance that cannot be represented safely with existing `GroupedListRow`.
- No changes: domain calculations, persistence schema, other screens.

---

## Task 1: Derive User-Facing Quote Source Status

**Files:**
- Modify: `src/features/settings/useSettings.ts`
- Test: `src/features/settings/__tests__/useSettings.test.tsx`

- [ ] **Step 1: Write failing hook tests for quote source labels**

Add tests to `src/features/settings/__tests__/useSettings.test.tsx`:

```tsx
it("labels quote source as Live when only live quotes are cached", () => {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.getState().upsertQuote({
    assetId: "asset-live",
    asOf: "2026-05-15T10:00:00.000Z",
    currency: "INR",
    price: 100,
    source: "yahoo",
  });

  const { result } = renderHook(() => useSettings({ store }));

  expect(result.current.quoteStatus.quoteSourceLabel).toBe("Live");
});

it("labels quote source as Manual when only manual quotes are cached", () => {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.getState().upsertQuote({
    assetId: "asset-manual",
    asOf: "2026-05-15T10:00:00.000Z",
    currency: "INR",
    price: 100,
    source: "manual",
  });

  const { result } = renderHook(() => useSettings({ store }));

  expect(result.current.quoteStatus.quoteSourceLabel).toBe("Manual");
});

it("labels quote source as Mixed when live and manual quotes are cached", () => {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.getState().upsertQuote({
    assetId: "asset-live",
    asOf: "2026-05-15T10:00:00.000Z",
    currency: "INR",
    price: 100,
    source: "yahoo",
  });
  store.getState().upsertQuote({
    assetId: "asset-manual",
    asOf: "2026-05-16T10:00:00.000Z",
    currency: "INR",
    price: 200,
    source: "manual",
  });

  const { result } = renderHook(() => useSettings({ store }));

  expect(result.current.quoteStatus.quoteSourceLabel).toBe("Mixed");
});
```

Update the existing empty-state expectation to include:

```tsx
quoteSourceLabel: "Waiting",
```

- [ ] **Step 2: Run hook tests and verify they fail**

Run:

```bash
npm test -- src/features/settings/__tests__/useSettings.test.tsx
```

Expected: FAIL because `quoteSourceLabel` does not exist.

- [ ] **Step 3: Add quote source label type and derivation**

Modify `src/features/settings/useSettings.ts`:

```ts
export type SettingsQuoteSourceLabel = "Waiting" | "Live" | "Manual" | "Mixed";

export type SettingsQuoteStatus = {
  latestQuoteAsOf: string | null;
  latestQuoteLabel: string;
  liveQuoteCount: number;
  manualFallbackCount: number;
  providerStatus: "Live available" | "Manual only" | "Waiting for holdings";
  quoteCount: number;
  quoteSourceLabel: SettingsQuoteSourceLabel;
};

function getQuoteSourceLabel({
  liveQuoteCount,
  manualFallbackCount,
  quoteCount,
}: {
  liveQuoteCount: number;
  manualFallbackCount: number;
  quoteCount: number;
}): SettingsQuoteSourceLabel {
  if (quoteCount === 0) {
    return "Waiting";
  }

  if (liveQuoteCount > 0 && manualFallbackCount > 0) {
    return "Mixed";
  }

  if (liveQuoteCount > 0) {
    return "Live";
  }

  return "Manual";
}
```

Inside `deriveQuoteStatus`, compute:

```ts
const quoteSourceLabel = getQuoteSourceLabel({
  liveQuoteCount,
  manualFallbackCount,
  quoteCount: quotes.length,
});
```

Return `quoteSourceLabel` with the status object.

- [ ] **Step 4: Run hook tests and verify they pass**

Run:

```bash
npm test -- src/features/settings/__tests__/useSettings.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit hook derivation**

Run:

```bash
git add src/features/settings/useSettings.ts src/features/settings/__tests__/useSettings.test.tsx
git commit -m "Derive Settings quote source label"
```

---

## Task 2: Implement Trust-First Settings Layout

**Files:**
- Modify: `src/features/settings/SettingsScreen.tsx`
- Test: `src/features/settings/__tests__/SettingsScreen.test.tsx`

- [ ] **Step 1: Write failing screen tests for the new Settings contract**

Update `src/features/settings/__tests__/SettingsScreen.test.tsx`.

In the first test, assert:

```tsx
expect(getByText("Local only")).toBeTruthy();
expect(getByText("Your portfolio stays here")).toBeTruthy();
expect(getByText("Local storage")).toBeTruthy();
expect(getByText("Active")).toBeTruthy();
expect(getByText("Account")).toBeTruthy();
expect(getByText("Not required")).toBeTruthy();
expect(getByText("Cloud sync")).toBeTruthy();
expect(getByText("Off")).toBeTruthy();
expect(getByText("Analytics")).toBeTruthy();
expect(getByText("Value masking")).toBeTruthy();
expect(getByText("Preview ₹••,•••")).toBeTruthy();
```

In the quote-status test, replace `Provider status` assertions with:

```tsx
expect(getByText("Quote source")).toBeTruthy();
expect(queryByText("Provider status")).toBeNull();
expect(getByText("Mixed")).toBeTruthy();
```

Also assert unsupported working-looking rows are absent:

```tsx
expect(queryByText("Foreign asset summary")).toBeNull();
expect(queryByText("USD & crypto fallback")).toBeNull();
expect(queryByText(/Export/i)).toBeNull();
expect(queryByText(/Backup/i)).toBeNull();
expect(queryByText(/Minimal Mode/i)).toBeNull();
expect(queryByText(/LTCG/i)).toBeNull();
```

Assert data action remains deferred and non-button:

```tsx
expect(getByText("Clear local data")).toBeTruthy();
expect(getByText("Disabled until confirmation and backup guidance exist.")).toBeTruthy();
expect(getByText("Deferred")).toBeTruthy();
expect(queryByTestId("clear-local-data-button")).toBeNull();
```

- [ ] **Step 2: Run screen tests and verify they fail**

Run:

```bash
npm test -- src/features/settings/__tests__/SettingsScreen.test.tsx
```

Expected: FAIL because the new copy/layout is not implemented.

- [ ] **Step 3: Update Settings screen imports**

In `src/features/settings/SettingsScreen.tsx`, keep existing common components.

Add imports if needed:

```ts
import { Ionicons } from "@expo/vector-icons";
```

Use `Ionicons` only if the local trust pill or compact checklist needs a check icon. If text-only rows are sufficient with `GroupedListRow`, do not add the import.

- [ ] **Step 4: Implement header with local-only pill**

Replace the bare `ScreenHeader` call with an action pill:

```tsx
<ScreenHeader
  action={
    <View style={styles.localPill}>
      <View style={styles.localDot} />
      <AppText style={styles.localPillText} variant="caption" weight="bold">
        Local only
      </AppText>
    </View>
  }
  title="Settings"
  subtitle="Local-first controls"
/>
```

Add styles:

```ts
localDot: {
  backgroundColor: colors.primary,
  borderRadius: 4,
  height: 8,
  width: 8,
},
localPill: {
  alignItems: "center",
  backgroundColor: colors.surface.elevated,
  borderRadius: radii.pill,
  flexDirection: "row",
  gap: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
},
localPillText: {
  color: colors.primary,
},
```

- [ ] **Step 5: Replace Privacy card with compact trust summary**

Replace the existing `Privacy` `PremiumCard` with:

```tsx
<PremiumCard>
  <View style={styles.trustIntro}>
    <View style={styles.trustCopy}>
      <AppText variant="title" weight="bold">
        Your portfolio stays here
      </AppText>
      <AppText color="secondary">
        CogVest V1 is local-first by default. The key privacy guarantees are
        visible at a glance.
      </AppText>
    </View>
  </View>

  <GroupedListRow
    icon="phone-portrait-outline"
    title="Local storage"
    meta="Portfolio records stay on this Android device."
    value="Active"
  />
  <GroupedListRow
    icon="person-circle-outline"
    title="Account"
    meta="No sign-in or remote profile is required in V1."
    value="Not required"
  />
  <GroupedListRow
    icon="cloud-offline-outline"
    title="Cloud sync"
    meta="No portfolio data is sent to a backend."
    value="Off"
  />
  <GroupedListRow
    icon="analytics-outline"
    title="Analytics"
    meta="No product telemetry is enabled in V1."
    value="Off"
  />
</PremiumCard>
```

Add styles:

```ts
trustCopy: {
  gap: spacing.xs,
},
trustIntro: {
  paddingBottom: spacing.xs,
},
```

- [ ] **Step 6: Keep Value Masking as the primary real control**

Keep the existing `Pressable` and `testID="value-mask-toggle"`, but update the helper copy and add preview:

```tsx
<AppText color="secondary">
  Hide INR wealth values in shared or public spaces.
</AppText>
<AppText color="secondary" variant="caption">
  Quantities, percentages, and per-unit prices stay visible.
</AppText>
<View style={styles.maskPreview}>
  <AppText color="secondary" variant="caption" weight="medium">
    Preview ₹••,•••
  </AppText>
</View>
```

Add style:

```ts
maskPreview: {
  alignSelf: "flex-start",
  backgroundColor: colors.surface.elevated,
  borderRadius: radii.pill,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
},
```

- [ ] **Step 7: Update Quotes section copy and values**

In the Quotes card:

```tsx
<SectionHeader title="Quotes" />
```

Keep `Latest quote refresh`, then replace the provider row with:

```tsx
<GroupedListRow
  icon="pulse-outline"
  title="Quote source"
  meta={
    quoteStatus.quoteSourceLabel === "Mixed"
      ? "Some assets use live quotes; manual fallback stays ready."
      : quoteStatus.quoteSourceLabel === "Live"
        ? "Live quotes are available for cached assets."
        : quoteStatus.quoteSourceLabel === "Manual"
          ? "Cached prices are manual fallback values."
          : "Add holdings or refresh quotes to see quote source status."
  }
  value={quoteStatus.quoteSourceLabel}
/>
```

Keep `Manual fallback`, but make the meta direct:

```tsx
meta="Manual prices remain available when quote APIs fail."
```

- [ ] **Step 8: Replace Currency and Display cards with compact Currency & App card**

Remove:

- `Foreign asset summary`
- `USD & crypto fallback`
- `Density changes`

Replace the two cards with:

```tsx
<PremiumCard>
  <SectionHeader title="Currency & App" />
  <GroupedListRow
    icon="cash-outline"
    title="Base currency"
    meta="INR-first summaries across CogVest."
    value="INR"
  />
  <GroupedListRow
    icon="phone-portrait-outline"
    title="Version"
    meta="Android preview build for V1 testing."
    value="Preview"
  />
</PremiumCard>
```

- [ ] **Step 9: Update Data card to separated deferred destructive action**

Keep the Data card or use a distinct `PremiumCard` with destructive row, but update meta:

```tsx
<PremiumCard>
  <SectionHeader title="Data" />
  <GroupedListRow
    destructive
    icon="trash-outline"
    title="Clear local data"
    meta="Disabled until confirmation and backup guidance exist."
    value="Deferred"
  />
</PremiumCard>
```

Do not add `onPress`.
Do not add `clear-local-data-button`.

- [ ] **Step 10: Run screen tests and verify they pass**

Run:

```bash
npm test -- src/features/settings/__tests__/SettingsScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit Settings UI implementation**

Run:

```bash
git add src/features/settings/SettingsScreen.tsx src/features/settings/__tests__/SettingsScreen.test.tsx
git commit -m "Align Settings with V1 trust design"
```

---

## Task 3: Verify Settings Scope And Regression Coverage

**Files:**
- Modify if needed: `docs/testing/v1-core-flow-test-matrix.md`
- Modify if needed: `docs/testing/v1-pc-verification-checklist.md`

- [ ] **Step 1: Run all Settings tests**

Run:

```bash
npm test -- src/features/settings/__tests__
```

Expected: PASS.

- [ ] **Step 2: Run related common component tests**

Run:

```bash
npm test -- src/components/common/__tests__
```

Expected: PASS. If this path has no tests, record that and continue.

- [ ] **Step 3: Run static project checks**

Run:

```bash
npm run typecheck
npm test
```

Expected: PASS.

- [ ] **Step 4: Update V1 docs only if stale Settings language exists**

Search:

```bash
Select-String -Path docs\testing\*.md,docs\design\*.md -Pattern "Provider status","Foreign asset summary","USD & crypto fallback","Density changes"
```

If stale V1 Settings expectations remain, update them to:

- `Quote source`
- `Currency & App`
- local-first privacy summary
- value masking as real control
- clear local data deferred

Do not update unrelated docs.

- [ ] **Step 5: Commit docs if changed**

If docs changed:

```bash
git add docs
git commit -m "Refresh Settings parity docs"
```

If no docs changed, skip this commit.

---

## Task 4: Android Emulator Visual Verification

**Files:**
- No source files expected.
- Evidence artifact can be saved under `G:\tmp`.

- [ ] **Step 1: Install or launch current app on emulator**

If a native build is needed:

```bash
npm run android
```

If the app is already installed:

```bash
npm run android:smoke -- --strict
```

Expected: emulator detected and `com.abdulshaikh.cogvest` installed.

- [ ] **Step 2: Open Settings screen**

Use the emulator manually, Maestro, or adb/UIAutomator depending on what is most reliable in the session.

Expected visible content:

- `Settings`
- `Local-first controls`
- `Local only`
- `Your portfolio stays here`
- `Value masking`
- `Quotes`
- `Quote source`
- `Currency & App`
- `Clear local data`

- [ ] **Step 3: Capture screenshot evidence**

Run:

```bash
adb -s emulator-5554 shell screencap -p /sdcard/cogvest-settings-parity.png
adb -s emulator-5554 pull /sdcard/cogvest-settings-parity.png G:\tmp\cogvest-settings-parity.png
```

Expected: screenshot exists at `G:\tmp\cogvest-settings-parity.png`.

- [ ] **Step 4: Record emulator result in final response**

Document:

- whether emulator was detected
- whether app package was installed
- screenshot path
- any visual compromise or blocker

---

## Task 5: Final Verification And PR

**Files:**
- No new source changes expected unless verification finds defects.

- [ ] **Step 1: Run V1 PC verification if time allows**

Run:

```bash
npm run test:v1:pc
```

Expected: PASS. If too slow or emulator unavailable, document the exact blocker.

- [ ] **Step 2: Check final diff**

Run:

```bash
git diff --check
git status --short
git log --oneline -5
```

Expected:

- no whitespace errors
- only issue #135 files changed
- branch contains focused commits

- [ ] **Step 3: Push branch**

Run:

```bash
git push -u origin v1/issue-135-settings-parity
```

- [ ] **Step 4: Create PR**

Create PR with body including:

```markdown
Closes #135

## Summary
- Reworked Settings into a compact local-first trust surface.
- Promoted value masking as the primary real control.
- Replaced technical provider wording with quote source/fallback status.
- Kept unsupported/destructive data actions deferred and non-interactive.

## Verification
- npm run typecheck
- npm test
- npm run test:v1:pc (or documented blocker)
- Android emulator Settings screenshot: G:\tmp\cogvest-settings-parity.png
```

---

## Plan Self-Review

- Spec coverage: The plan covers trust-first IA, value masking, quote source copy, hidden unsupported controls, deferred destructive action, tests, docs, emulator verification, and PR close reference.
- Placeholder scan: No TODO/TBD placeholders remain.
- Type consistency: `quoteSourceLabel` is introduced in Task 1 before screen usage in Task 2. Existing `providerStatus` remains internal for compatibility but is not user-facing Settings copy.

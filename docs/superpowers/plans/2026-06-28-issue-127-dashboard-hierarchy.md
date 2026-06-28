# Issue #127 Dashboard Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Dashboard to match the accepted issue #127 hierarchy: portfolio answer first, compact visual allocation, quote freshness, wired actions, and no dead buttons.

**Architecture:** Keep business data in `useDashboard` and domain calculations. Keep navigation at the route boundary in `app/(tabs)/dashboard.tsx`; pass callbacks into `DashboardScreen` so the feature remains testable. Add small screen-local presentation helpers inside `DashboardScreen.tsx` unless a component proves reusable beyond Dashboard.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest, React Native Testing Library, existing CogVest theme tokens and common components.

---

## Reference Inputs

- Issue: #127 `[V1] Rework Dashboard information hierarchy, allocation visual, and dead actions`
- Spec: `docs/superpowers/specs/2026-06-28-issue-127-dashboard-hierarchy-design.md`
- Preview: `docs/design/screens/dashboard/issue-127/index.html`
- Baseline: `docs/design/v1-screen-baseline.md`

## File Structure

- Modify `app/(tabs)/dashboard.tsx`
  - Owns Expo Router callbacks for Dashboard actions.
  - Passes `onOpenHoldings` and `onOpenProgress` into `DashboardScreen`.

- Modify `src/features/dashboard/DashboardScreen.tsx`
  - Implements accepted Dashboard hierarchy.
  - Adds compact visual allocation card.
  - Adds quote freshness card labelled `Quotes updated`.
  - Adds next useful review card with `Open Progress`.
  - Removes or replaces dead `View details`.

- Modify `src/features/dashboard/__tests__/DashboardScreen.test.tsx`
  - Updates tests to assert new hierarchy and action wiring.
  - Keeps masking, refresh, empty state, and V1 non-goal assertions.

- No domain changes expected.
  - Existing `useDashboard` already exposes `allocation`, `rollupTotals`,
    `monthlyMetrics`, `latestQuoteAsOf`, `latestQuoteSource`, refresh state,
    and masking state.

## Task 1: Add Dashboard Navigation Callback Contract

**Files:**
- Modify: `src/features/dashboard/DashboardScreen.tsx`
- Modify: `app/(tabs)/dashboard.tsx`
- Test: `src/features/dashboard/__tests__/DashboardScreen.test.tsx`

- [ ] **Step 1: Write the failing callback test**

Add this test to `src/features/dashboard/__tests__/DashboardScreen.test.tsx`:

```tsx
it("wires Dashboard allocation and progress actions", () => {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  const onOpenHoldings = jest.fn();
  const onOpenProgress = jest.fn();

  store.getState().addAsset(asset);
  store.getState().addTrade({ ...buyTrade, conviction: 4 });
  store.getState().upsertQuote({
    asOf: "2026-04-22T10:00:00.000Z",
    assetId: asset.id,
    currency: "INR",
    price: 150,
    source: "yahoo",
  });

  const { getByTestId } = render(
    <DashboardScreen
      onOpenHoldings={onOpenHoldings}
      onOpenProgress={onOpenProgress}
      store={store}
    />,
  );

  fireEvent.press(getByTestId("dashboard-open-holdings"));
  fireEvent.press(getByTestId("dashboard-open-progress"));

  expect(onOpenHoldings).toHaveBeenCalledTimes(1);
  expect(onOpenProgress).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm test -- --runTestsByPath src/features/dashboard/__tests__/DashboardScreen.test.tsx --runInBand
```

Expected: FAIL because `onOpenHoldings`, `onOpenProgress`, and the test IDs do not exist yet.

- [ ] **Step 3: Extend Dashboard props**

In `src/features/dashboard/DashboardScreen.tsx`, update the prop type:

```tsx
type DashboardScreenProps = {
  onAddTrade?: () => void;
  onOpenHoldings?: () => void;
  onOpenProgress?: () => void;
  refreshQuotes?: RefreshQuotes;
  store?: StoreApi<PortfolioStoreState>;
};
```

Update the component signature:

```tsx
export function DashboardScreen({
  onAddTrade,
  onOpenHoldings,
  onOpenProgress,
  refreshQuotes,
  store = getPortfolioStore(),
}: DashboardScreenProps) {
```

- [ ] **Step 4: Wire route-level callbacks**

In `app/(tabs)/dashboard.tsx`, pass tab navigation callbacks:

```tsx
import { router } from "expo-router";

import { DashboardScreen as DashboardFeatureScreen } from "@/src/features/dashboard";

export default function DashboardScreen() {
  return (
    <DashboardFeatureScreen
      onAddTrade={() => {
        router.push("/add-holding");
      }}
      onOpenHoldings={() => {
        router.push("/(tabs)/holdings");
      }}
      onOpenProgress={() => {
        router.push("/(tabs)/progress");
      }}
    />
  );
}
```

- [ ] **Step 5: Run the focused test**

Run:

```powershell
npm test -- --runTestsByPath src/features/dashboard/__tests__/DashboardScreen.test.tsx --runInBand
```

Expected: still FAIL until Task 2 adds the controls.

## Task 2: Replace Row-Heavy Allocation With Visual Allocation Card

**Files:**
- Modify: `src/features/dashboard/DashboardScreen.tsx`
- Test: `src/features/dashboard/__tests__/DashboardScreen.test.tsx`

- [ ] **Step 1: Update hierarchy expectations**

Replace the old `keeps portfolio rollups below...` test with:

```tsx
it("keeps portfolio answer, allocation, quotes, and next review in the accepted order", () => {
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  store.getState().addAsset(asset);
  store.getState().addTrade({ ...buyTrade, conviction: 4 });
  store.getState().addCashEntry({
    amount: 50,
    date: "2026-04-22",
    id: "cash-1",
    label: "Broker cash",
    type: "addition",
  });
  store.getState().upsertQuote({
    asOf: "2026-04-22T10:00:00.000Z",
    assetId: asset.id,
    currency: "INR",
    price: 150,
    source: "yahoo",
  });

  const screen = render(<DashboardScreen store={store} />);
  const textNodes = screen.UNSAFE_getAllByType(Text)
    .map((node) => textContent(node.props.children))
    .filter(Boolean);

  const heroIndex = indexOfText(textNodes, "Portfolio value");
  const investedIndex = indexOfText(textNodes, "Invested");
  const allocationIndex = indexOfText(textNodes, "Allocation");
  const quotesIndex = indexOfText(textNodes, "Quotes updated");
  const reviewIndex = indexOfText(textNodes, "Record monthly snapshot");

  expect(investedIndex).toBeGreaterThan(heroIndex);
  expect(allocationIndex).toBeGreaterThan(investedIndex);
  expect(quotesIndex).toBeGreaterThan(allocationIndex);
  expect(reviewIndex).toBeGreaterThan(quotesIndex);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm test -- --runTestsByPath src/features/dashboard/__tests__/DashboardScreen.test.tsx --runInBand
```

Expected: FAIL because the screen still says `Portfolio Value`, `Quote Status`, and `Portfolio Rollups`.

- [ ] **Step 3: Add allocation visual helpers**

Inside `src/features/dashboard/DashboardScreen.tsx`, add these helper functions before the component:

```tsx
function getAllocationColor(assetClass: string) {
  if (assetClass === "cash") {
    return colors.cashBlue;
  }

  if (assetClass === "crypto") {
    return colors.cryptoAmber;
  }

  if (assetClass === "debt") {
    return colors.blue;
  }

  return colors.primary;
}

function getAllocationWidth(percentage: number) {
  return `${Math.min(100, Math.max(0, percentage))}%`;
}
```

Add `colors` import from `@/src/theme` if not already present:

```tsx
import { colors, spacing } from "@/src/theme";
```

- [ ] **Step 4: Render the visual allocation card**

Replace the existing allocation `PremiumCard` block with:

```tsx
{hasAllocation ? (
  <>
    <SectionHeader title="Allocation" />
    <PremiumCard testID="dashboard-allocation-card">
      <View style={styles.allocationSummary}>
        <View style={styles.allocationVisual} testID="dashboard-allocation-visual">
          {dashboard.allocation.map((item) => (
            <View
              key={item.assetClass}
              style={[
                styles.allocationSegment,
                {
                  backgroundColor: getAllocationColor(item.assetClass),
                  width: getAllocationWidth(item.percentage),
                },
              ]}
            />
          ))}
        </View>
        <AppButton
          title="Open Holdings"
          testID="dashboard-open-holdings"
          variant="secondary"
          onPress={onOpenHoldings}
        />
      </View>
      <View style={styles.allocationLegend}>
        {dashboard.allocation.map((item) => (
          <View key={item.assetClass} style={styles.allocationLegendRow}>
            <View
              style={[
                styles.allocationDot,
                { backgroundColor: getAllocationColor(item.assetClass) },
              ]}
            />
            <AppText color="secondary" variant="caption">
              {assetClassLabel(item.assetClass)}
            </AppText>
            <MaskedValue
              align="right"
              masked={dashboard.maskWealthValues}
              value={`${formatUnsignedPercentage(item.percentage)} · ${formatINR(
                item.value,
              )}`}
              variant="caption"
            />
          </View>
        ))}
      </View>
    </PremiumCard>
  </>
) : (
  <EmptyState
    actionLabel={onAddTrade ? "Add Holding" : undefined}
    actionTestID="add-trade-button"
    message="Add your first portfolio entry to build holdings automatically."
    title="No allocation yet"
    onAction={onAddTrade}
  />
)}
```

- [ ] **Step 5: Add styles**

Add these styles:

```tsx
allocationDot: {
  borderRadius: radii.pill,
  height: 8,
  width: 8,
},
allocationLegend: {
  gap: spacing.sm,
},
allocationLegendRow: {
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.sm,
  justifyContent: "space-between",
},
allocationSegment: {
  minWidth: 2,
},
allocationSummary: {
  gap: spacing.cardInner,
},
allocationVisual: {
  backgroundColor: colors.surface.elevated,
  borderRadius: radii.pill,
  flexDirection: "row",
  height: 14,
  overflow: "hidden",
},
```

Import `radii`:

```tsx
import { colors, radii, spacing } from "@/src/theme";
```

- [ ] **Step 6: Run the focused test**

Run:

```powershell
npm test -- --runTestsByPath src/features/dashboard/__tests__/DashboardScreen.test.tsx --runInBand
```

Expected: callback tests and allocation hierarchy should pass after Task 3 finishes quote/review text.

## Task 3: Rework Portfolio Hero, Quote Freshness, and Next Review

**Files:**
- Modify: `src/features/dashboard/DashboardScreen.tsx`
- Test: `src/features/dashboard/__tests__/DashboardScreen.test.tsx`

- [ ] **Step 1: Update content expectations**

In the populated Dashboard test, assert the new labels:

```tsx
expect(getByText("Portfolio value")).toBeTruthy();
expect(getByText("Quotes updated")).toBeTruthy();
expect(getByText("Record monthly snapshot")).toBeTruthy();
expect(getByText("Open Progress")).toBeTruthy();
expect(queryByText("Quote Status")).toBeNull();
expect(queryByText("Portfolio Rollups")).toBeNull();
expect(queryByText("View details")).toBeNull();
```

- [ ] **Step 2: Run focused test to verify current failures**

Run:

```powershell
npm test -- --runTestsByPath src/features/dashboard/__tests__/DashboardScreen.test.tsx --runInBand
```

Expected: FAIL for the new labels until implementation changes are made.

- [ ] **Step 3: Adjust the portfolio hero**

Replace:

```tsx
<HeroMetric
  label="Portfolio Value"
```

with:

```tsx
<HeroMetric
  label="Portfolio value"
```

Keep `subValue` derived from existing day change for now unless the UI review
finds it should switch to P&L percentage versus invested capital. Do not
hardcode the preview value.

- [ ] **Step 4: Replace Quote Status card**

Replace the current quote card:

```tsx
<PremiumCard>
  <SectionHeader title="Quote Status" />
  <AppText color="secondary">{quoteStatus}</AppText>
</PremiumCard>
```

with:

```tsx
<PremiumCard testID="dashboard-quote-card">
  <View style={styles.infoCardRow}>
    <CategoryIcon assetClass="neutral" />
    <View style={styles.infoCardCopy}>
      <AppText weight="bold">Quotes updated</AppText>
      <AppText color="secondary" variant="caption">
        {quoteStatus}
      </AppText>
    </View>
  </View>
</PremiumCard>
```

- [ ] **Step 5: Add next useful review card**

Place this after the quote freshness card:

```tsx
<PremiumCard testID="dashboard-next-review-card">
  <View style={styles.infoCardRow}>
    <CategoryIcon assetClass="neutral" />
    <View style={styles.infoCardCopy}>
      <AppText weight="bold">Record monthly snapshot</AppText>
      <AppText color="secondary" variant="caption">
        Review this month in Progress when your month-end data is ready.
      </AppText>
    </View>
    <AppButton
      title="Open Progress"
      testID="dashboard-open-progress"
      variant="secondary"
      onPress={onOpenProgress}
    />
  </View>
</PremiumCard>
```

- [ ] **Step 6: Remove Portfolio Rollups from Dashboard**

Delete the `sectorSnapshot`, `instrumentSnapshot`, and the entire
`Portfolio Rollups` card block from `DashboardScreen.tsx`.

Reason: #127 says Dashboard owns portfolio-level answers, while Holdings owns
position-review and metadata detail. Sector/instrument rollups can return in a
future dedicated details screen, but they should not be buried on Dashboard.

- [ ] **Step 7: Add info row styles**

Add:

```tsx
infoCardCopy: {
  flex: 1,
  gap: spacing.xs,
},
infoCardRow: {
  alignItems: "center",
  flexDirection: "row",
  gap: spacing.cardInner,
},
```

- [ ] **Step 8: Run focused test**

Run:

```powershell
npm test -- --runTestsByPath src/features/dashboard/__tests__/DashboardScreen.test.tsx --runInBand
```

Expected: Dashboard screen tests pass or fail only on stale assertions from old content.

## Task 4: Preserve Empty State and Value Masking

**Files:**
- Modify: `src/features/dashboard/__tests__/DashboardScreen.test.tsx`
- Modify: `src/features/dashboard/DashboardScreen.tsx` only if tests reveal a real regression.

- [ ] **Step 1: Update empty state assertions if needed**

Keep this existing behavior:

```tsx
expect(getByTestId("dashboard-screen")).toBeTruthy();
expect(getByTestId("add-trade-button")).toBeTruthy();
expect(getAllByText("₹0.00").length).toBeGreaterThan(0);
expect(getByText("No allocation yet")).toBeTruthy();
expect(
  getByText("Add your first portfolio entry to build holdings automatically."),
).toBeTruthy();
```

Do not add allocation/progress action expectations to the empty state unless
the controls are actually rendered.

- [ ] **Step 2: Keep masking assertions**

Keep or update this expectation:

```tsx
expect(getAllByText(MASKED_INR_VALUE).length).toBeGreaterThan(0);
expect(queryByText("₹300.00")).toBeNull();
expect(queryByText("+₹100.00")).toBeNull();
```

If allocation legend values include masked INR plus unmasked percentages, this
is acceptable. Percentages are not INR wealth values.

- [ ] **Step 3: Run focused test**

Run:

```powershell
npm test -- --runTestsByPath src/features/dashboard/__tests__/DashboardScreen.test.tsx --runInBand
```

Expected: PASS.

## Task 5: Full Verification

**Files:**
- No edits unless verification identifies a real defect.

- [ ] **Step 1: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 2: Run tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 3: Run Expo doctor**

Run:

```powershell
npm run doctor
```

Expected: PASS or document non-blocking warnings.

- [ ] **Step 4: Run V1 PC gate if emulator/app state is available**

Run:

```powershell
npm run test:v1:pc
```

Expected: PASS, or document the exact emulator/app-install blocker.

- [ ] **Step 5: Capture Android evidence if emulator is available**

Run the documented Android loop:

```powershell
npm run android
npm run android:smoke -- --strict
```

Then visually verify:

- Dashboard opens.
- Portfolio hero appears first.
- Allocation visual appears below portfolio metrics.
- `Open Holdings` navigates to Holdings.
- `Open Progress` navigates to Progress.
- Quote card says `Quotes updated`.
- No `View details` or vague `Open` remains on Dashboard.

## Task 6: Final Review and PR

**Files:**
- No source edits unless review finds a real defect.

- [ ] **Step 1: Review diff against spec**

Check:

```powershell
git diff -- src/features/dashboard "app/(tabs)/dashboard.tsx" src/features/dashboard/__tests__/DashboardScreen.test.tsx
```

Expected: diff only touches #127 scope.

- [ ] **Step 2: Run Impeccable detector if dashboard visual HTML changes**

Run:

```powershell
node C:\Users\abdul\.agents\skills\impeccable\scripts\detect.mjs --json docs\design\screens\dashboard\issue-127\index.html
```

Expected: `[]`.

- [ ] **Step 3: Commit implementation**

Run:

```powershell
git add "app/(tabs)/dashboard.tsx" src/features/dashboard/DashboardScreen.tsx src/features/dashboard/__tests__/DashboardScreen.test.tsx
git commit -m "feat: rework dashboard hierarchy"
```

- [ ] **Step 4: Push and open PR**

Run:

```powershell
git push -u origin v1/issue-127-dashboard-hierarchy
gh pr create --base main --head v1/issue-127-dashboard-hierarchy --title "[V1] Rework Dashboard hierarchy" --body "Closes #127"
```

The PR body must include `Closes #127`.

## Plan Self-Review

- Spec coverage: tasks cover portfolio hierarchy, visual allocation, quote freshness, wired `Open Holdings`/`Open Progress`, empty state, masking, verification, and PR closure.
- Placeholder scan: no implementation placeholder remains.
- Type consistency: callback names are `onOpenHoldings` and `onOpenProgress`; test IDs are `dashboard-open-holdings` and `dashboard-open-progress`.
- Scope check: no Holdings, Progress, Cash, Settings, Add Holding, or domain changes are planned beyond Dashboard navigation targets.

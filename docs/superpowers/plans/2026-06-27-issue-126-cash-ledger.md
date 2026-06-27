# Issue #126 Cash Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Cash Ledger into a deployable-capital screen with Deposit/Withdraw manual actions and derived Invested evidence.

**Architecture:** Keep the existing raw `CashEntry` model for manual cash movement. Use existing investment records (`trades` and `openingPositions`) to derive the `Invested` monthly metric, and remove the manual Investment Transfer entry mode from Cash Ledger UI. Improve Cash Ledger presentation through small focused helpers/components inside `src/features/cash` and preserve pure domain calculations.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, Zustand, React Native Testing Library, Jest.

---

## File Structure

- Modify `src/features/cash/useCash.ts`: expose a derived summary string or explicit monthly movement fields if useful; keep store writes simple.
- Modify `src/features/cash/CashScreen.tsx`: remove manual investment-transfer mode, reframe hero as deployable cash, add monthly movement evidence, and update copy.
- Modify `src/components/cards/CashEntryRow.tsx`: make rows explain deposit/withdrawal/invested source more clearly without turning into a table.
- Modify `src/features/cash/__tests__/useCash.test.tsx`: assert derived invested metric remains separate from manual cash actions.
- Modify `src/features/cash/__tests__/CashScreen.test.tsx`: assert only Deposit/Withdraw manual actions exist and Cash Ledger shows Invested as derived evidence.
- Optionally modify `src/types/cash.ts`: only if implementation needs a narrow metadata field; do not add this unless tests force it.

## Current Constraints

- Cash Ledger must not expose `Invest` or `Investment Transfer` as a primary manual action.
- `Invested` is user-facing copy for cash used in investments.
- Investment rows are derived/linked evidence from Add Holding / transaction flows where data exists.
- `Deployable cash` is the actual ledger balance from cash entries. Do not subtract derived investment records unless a real linked cash outflow exists; otherwise future linked flows can double-count outflows.
- Issue #146 owns asset sell/redeem and cash proceeds. Do not implement it here.
- Keep all existing value masking behavior.

---

### Task 1: Lock Cash Ledger State Semantics In Tests

**Files:**
- Modify: `src/features/cash/__tests__/useCash.test.tsx`
- Modify: `src/features/cash/useCash.ts`

- [ ] **Step 1: Add a failing hook test for manual cash actions vs derived invested**

Append this test to `describe("useCash", () => { ... })` in `src/features/cash/__tests__/useCash.test.tsx`:

```tsx
  it("keeps manual cash actions to deposit and withdrawal while deriving invested from investment records", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      id: "asset-hdfc",
      name: "HDFC Bank",
      symbol: "HDFCBANK",
      ticker: "HDFCBANK.NS",
    });
    store.getState().addCashEntry({
      amount: 70000,
      date: "2026-05-03",
      id: "cash-salary",
      label: "Salary added",
      type: "addition",
    });
    store.getState().addTrade({
      assetId: "asset-hdfc",
      date: "2026-05-05",
      id: "trade-buy",
      pricePerUnit: 1500,
      quantity: 10,
      totalValue: 15000,
      type: "buy",
    });

    const { result } = renderHook(() =>
      useCash({ now: new Date("2026-05-16T00:00:00.000Z"), store }),
    );

    expect(result.current.manualEntryModes).toEqual(["addition", "withdrawal"]);
    expect(result.current.monthlyMetrics).toMatchObject({
      added: 70000,
      available: 70000,
      invested: 15000,
    });
    expect(result.current.monthlyMovementSummary).toBe(
      "₹15K moved into investments this month",
    );
  });
```

- [ ] **Step 2: Run the focused hook test and verify it fails**

Run:

```powershell
npm test -- --runTestsByPath src/features/cash/__tests__/useCash.test.tsx --runInBand
```

Expected: FAIL because `manualEntryModes` and `monthlyMovementSummary` do not exist on `UseCashResult`.

- [ ] **Step 3: Implement the hook result fields**

In `src/features/cash/useCash.ts`, update imports:

```ts
import { formatCompactINR } from "@/src/domain/formatters";
```

Add this type near `AddCashEntryInput`:

```ts
export type ManualCashEntryMode = "addition" | "withdrawal";
```

Update `UseCashResult`:

```ts
export type UseCashResult = {
  addEntry: (entry: AddCashEntryInput) => CashEntry;
  balance: number;
  entries: CashEntry[];
  manualEntryModes: ManualCashEntryMode[];
  maskWealthValues: boolean;
  monthlyMetrics: CashMonthlyMetrics;
  monthlyMovementSummary: string;
};
```

Inside `useCash`, compute metrics once and return the new fields:

```ts
  const monthlyMetrics = calculateCashMonthlyMetrics({
    cashEntries: snapshot.cashEntries,
    now,
    openingPositions: snapshot.openingPositions,
    trades: snapshot.trades,
  });

  return {
    addEntry,
    balance: calculateCashBalance(snapshot.cashEntries),
    entries: sortCashEntries(snapshot.cashEntries),
    manualEntryModes: ["addition", "withdrawal"],
    maskWealthValues: snapshot.preferences.maskWealthValues,
    monthlyMetrics,
    monthlyMovementSummary:
      monthlyMetrics.invested > 0
        ? `${formatCompactINR(monthlyMetrics.invested)} moved into investments this month`
        : "No investment cash movement this month",
  };
```

Remove the old inline `monthlyMetrics: calculateCashMonthlyMetrics(...)` return field.

- [ ] **Step 4: Run the focused hook test and verify it passes**

Run:

```powershell
npm test -- --runTestsByPath src/features/cash/__tests__/useCash.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/features/cash/useCash.ts src/features/cash/__tests__/useCash.test.tsx
git commit -m "feat: derive cash ledger invested summary"
```

---

### Task 2: Remove Manual Investment Transfer From Cash Screen

**Files:**
- Modify: `src/features/cash/CashScreen.tsx`
- Modify: `src/features/cash/__tests__/CashScreen.test.tsx`

- [ ] **Step 1: Replace the old investment-transfer screen test**

In `src/features/cash/__tests__/CashScreen.test.tsx`, replace the test named `"records an investment transfer as a withdrawal and shows monthly metrics"` with:

```tsx
  it("shows invested as derived evidence without exposing a manual Invest action", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    store.getState().addAsset({
      assetClass: "stock",
      currency: "INR",
      id: "asset-reliance",
      name: "Reliance Industries",
      symbol: "RELIANCE",
      ticker: "RELIANCE.NS",
    });
    store.getState().addCashEntry({
      amount: 100000,
      date: "2026-05-01",
      id: "cash-salary",
      label: "Salary",
      type: "addition",
    });
    store.getState().addTrade({
      assetId: "asset-reliance",
      date: "2026-05-10",
      id: "trade-buy",
      pricePerUnit: 100,
      quantity: 200,
      totalValue: 20000,
      type: "buy",
    });

    const { getByText, queryByText } = render(
      <CashScreen
        now={new Date("2026-05-16T00:00:00.000Z")}
        store={store}
      />,
    );

    expect(getByText("Deployable cash")).toBeTruthy();
    expect(getByText("Invested")).toBeTruthy();
    expect(getByText("₹20K moved into investments this month")).toBeTruthy();
    expect(getByText("Deposit")).toBeTruthy();
    expect(getByText("Withdraw")).toBeTruthy();
    expect(queryByText("Invest")).toBeNull();
    expect(queryByText("Investment Transfer")).toBeNull();
  });
```

- [ ] **Step 2: Run the focused screen test and verify it fails**

Run:

```powershell
npm test -- --runTestsByPath src/features/cash/__tests__/CashScreen.test.tsx --runInBand
```

Expected: FAIL because the screen still renders `Investment Transfer`, labels hero as `Cash balance`, and does not show the movement summary.

- [ ] **Step 3: Update `CashScreen` types and helpers**

In `src/features/cash/CashScreen.tsx`, change:

```ts
type CashEntryMode = CashEntryType | "transfer";
```

to:

```ts
type CashEntryMode = CashEntryType;
```

Replace helper functions with:

```ts
function getCashEntryModeLabel(mode: CashEntryMode) {
  return mode === "addition" ? "Deposit" : "Withdraw";
}

function getCashEntryPlaceholder(mode: CashEntryMode) {
  return mode === "addition" ? "Broker cash" : "Withdrawal";
}
```

Delete `getStoredEntryType` entirely. In `submit()`, replace:

```ts
      type: getStoredEntryType(mode),
```

with:

```ts
      type: mode,
```

- [ ] **Step 4: Render only hook-provided manual modes**

Update the hook destructuring:

```ts
  const {
    addEntry,
    balance,
    entries,
    manualEntryModes,
    maskWealthValues,
    monthlyMetrics,
    monthlyMovementSummary,
  } = useCash({ now, store });
```

Replace:

```tsx
{(["addition", "withdrawal", "transfer"] as const).map((entryMode) => (
```

with:

```tsx
{manualEntryModes.map((entryMode) => (
```

- [ ] **Step 5: Reframe the hero and monthly evidence**

In `CashScreen.tsx`, update `ScreenHeader`:

```tsx
<ScreenHeader title="Cash Ledger" subtitle="Deployable capital • local only" />
```

Update `HeroMetric`:

```tsx
<HeroMetric
  label="Deployable cash"
  masked={maskWealthValues}
  value={formatINR(balance)}
  subValue={`Balance ${formatCompactINR(balance)}`}
  subValueTone="secondary"
/>
```

Keep `MetricGroup`, but ensure labels are:

```tsx
{
  label: "Added",
  masked: maskWealthValues,
  value: formatCompactINR(monthlyMetrics.added),
},
{
  label: "Invested",
  masked: maskWealthValues,
  value: formatCompactINR(monthlyMetrics.invested),
},
{
  label: "Kept",
  masked: maskWealthValues,
  value: formatCompactINR(Math.max(0, monthlyMetrics.added - monthlyMetrics.invested)),
},
{
  label: "Savings",
  value: formatSavingsRate(monthlyMetrics.savingsRate),
},
```

Add below `MetricGroup`:

```tsx
<PremiumCard style={styles.movementCard}>
  <SectionHeader title="This month" />
  <AppText color="secondary">{monthlyMovementSummary}</AppText>
</PremiumCard>
```

Add style:

```ts
  movementCard: {
    gap: spacing.sm,
  },
```

- [ ] **Step 6: Run the focused screen test and verify it passes**

Run:

```powershell
npm test -- --runTestsByPath src/features/cash/__tests__/CashScreen.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add src/features/cash/CashScreen.tsx src/features/cash/__tests__/CashScreen.test.tsx
git commit -m "feat: simplify cash ledger manual actions"
```

---

### Task 3: Improve Cash Ledger Rows And Empty State Copy

**Files:**
- Modify: `src/components/cards/CashEntryRow.tsx`
- Modify: `src/features/cash/CashScreen.tsx`
- Modify: `src/features/cash/__tests__/CashScreen.test.tsx`

- [ ] **Step 1: Add row-copy expectations**

In the `"adds and withdraws cash and shows history rows"` test in `CashScreen.test.tsx`, add assertions after the deposit wait:

```tsx
expect(getByText("Increased deployable cash")).toBeTruthy();
```

After the withdrawal wait, add:

```tsx
expect(getByText("Reduced deployable cash")).toBeTruthy();
```

In the empty-state test, replace:

```tsx
expect(getByText("Add available broker or bank cash to include it in portfolio value.")).toBeTruthy();
```

with:

```tsx
expect(getByText("Add broker or bank cash only when it should count toward portfolio value.")).toBeTruthy();
```

- [ ] **Step 2: Run the focused screen test and verify it fails**

Run:

```powershell
npm test -- --runTestsByPath src/features/cash/__tests__/CashScreen.test.tsx --runInBand
```

Expected: FAIL because row meta and empty-state copy still use old wording.

- [ ] **Step 3: Update row metadata**

In `src/components/cards/CashEntryRow.tsx`, add:

```ts
function getCashEntryMeta(entry: CashEntry) {
  const movement = entry.type === "addition"
    ? "Increased deployable cash"
    : "Reduced deployable cash";

  return `${movement} · ${formatDate(entry.date)}`;
}
```

Replace:

```tsx
{formatDate(entry.date)}
```

with:

```tsx
{getCashEntryMeta(entry)}
```

- [ ] **Step 4: Update empty-state copy**

In `src/features/cash/CashScreen.tsx`, update `EmptyState`:

```tsx
<EmptyState
  message="Add broker or bank cash only when it should count toward portfolio value."
  title="No cash movement yet"
/>
```

- [ ] **Step 5: Run the focused screen test and verify it passes**

Run:

```powershell
npm test -- --runTestsByPath src/features/cash/__tests__/CashScreen.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add src/components/cards/CashEntryRow.tsx src/features/cash/CashScreen.tsx src/features/cash/__tests__/CashScreen.test.tsx
git commit -m "feat: clarify cash ledger movement rows"
```

---

### Task 4: Final Verification And Android Evidence

**Files:**
- No source changes expected.

- [ ] **Step 1: Run Cash feature tests**

Run:

```powershell
npm test -- --runTestsByPath src/features/cash/__tests__/useCash.test.tsx src/features/cash/__tests__/CashScreen.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full static verification**

Run:

```powershell
npm run test:verify
```

Expected: PASS for typecheck, Jest, and Expo doctor.

- [ ] **Step 3: Run PC Android verification if emulator/app are available**

Run:

```powershell
npm run test:v1:pc
```

Expected: PASS if the emulator is running and the package is installed. If it fails because emulator/app is unavailable, document the exact reason in the final response and do not claim emulator verification.

- [ ] **Step 4: Capture manual Cash Ledger observations**

If emulator verification runs, open Cash Ledger and check:

- Screen title is `Cash Ledger`.
- Subtitle uses deployable/local language.
- Hero says `Deployable cash`.
- Manual action chips are only `Deposit` and `Withdraw`.
- No `Invest` or `Investment Transfer` primary action appears.
- `Invested` appears as evidence when investment records exist.
- Empty state is calm when there are no entries.

- [ ] **Step 5: Commit any test/docs follow-up**

If verification required any small fixes:

```powershell
git add <changed-files>
git commit -m "test: verify cash ledger behavior"
```

If no files changed, do not create an empty commit.

---

## Self-Review

- Spec coverage: The plan covers deployable-cash framing, Deposit/Withdraw-only actions, Invested as derived evidence, row explanations, empty state, value masking preservation, and Android verification.
- Scope check: The plan does not implement #146 asset sell/redeem behavior and does not add tax/LTCG/import/export features.
- Placeholder scan: No `TBD` or unspecified implementation steps remain.
- Type consistency: Manual cash modes use `"addition" | "withdrawal"` consistently; `CashMonthlyMetrics.invested` remains the derived invested amount.

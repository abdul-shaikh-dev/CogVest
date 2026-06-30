# Issue #146 Sell / Redeem Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a V1 sell/redeem flow that reduces holding units and links net proceeds into Cash Ledger by default.

**Architecture:** Keep the existing raw-record model. Add domain helpers for available quantity and proceeds, add a focused sell/redeem hook and screen, route Holdings into that screen, and display linked cash proceeds as cash movement evidence. Do not move asset exits into Cash Ledger.

**Tech Stack:** Expo Router, React Native, TypeScript, Zustand vanilla store, Jest, React Native Testing Library.

---

## File Map

- Modify: `src/domain/validators/trade.ts` to calculate available sell quantity from opening positions plus trades.
- Modify: `src/domain/validators/__tests__/trade.test.ts` to cover opening positions, prior sells, and over-sell rejection.
- Create: `src/domain/calculations/sellRedeem.ts` for pure proceeds and remaining-position preview calculations.
- Modify: `src/domain/calculations/index.ts` to export sell/redeem helpers.
- Create: `src/domain/calculations/__tests__/sellRedeem.test.ts` for proceeds, fee, and remaining-unit calculations.
- Create: `src/features/sellRedeem/useSellRedeemHolding.ts` for state, validation, preview, and save behavior.
- Create: `src/features/sellRedeem/SellRedeemScreen.tsx` for the V1 UI.
- Create: `src/features/sellRedeem/index.ts` for feature exports.
- Create: `src/features/sellRedeem/__tests__/useSellRedeemHolding.test.tsx` for hook/store behavior.
- Create: `src/features/sellRedeem/__tests__/SellRedeemScreen.test.tsx` for component behavior.
- Create: `app/sell-redeem.tsx` for the secondary route.
- Modify: `app/(tabs)/holdings.tsx` to pass a sell/redeem navigation callback.
- Modify: `src/features/holdings/HoldingsScreen.tsx` to expose a `Sell / redeem` action in expanded holding details.
- Modify: `src/features/holdings/__tests__/HoldingsScreen.test.tsx` to verify the entry point.
- Modify: `src/types/cash.ts` only if the implementation needs a minimal optional link marker for cash rows.
- Modify: `src/components/cards/CashEntryRow.tsx` only if linked proceeds need distinct movement copy beyond label text.
- Modify: `src/features/cash/__tests__/CashScreen.test.tsx` only if Cash Ledger row copy changes.

## Task 1: Domain Sell Quantity Validation

**Files:**
- Modify: `src/domain/validators/trade.ts`
- Modify: `src/domain/validators/__tests__/trade.test.ts`

- [ ] **Step 1: Add failing tests for opening-position availability**

Add tests that prove sell validation includes opening positions and subtracts previous sells:

```ts
import type { OpeningPosition, Trade } from "@/src/types";

const openingPosition: OpeningPosition = {
  assetId: "asset-1",
  averageCostPrice: 100,
  currentPrice: 120,
  date: "2026-04-01",
  id: "opening-1",
  quantity: 10,
};

const previousSell: Trade = {
  assetId: "asset-1",
  date: "2026-04-10",
  id: "sell-1",
  pricePerUnit: 120,
  quantity: 3,
  totalValue: 360,
  type: "sell",
};

expect(validateSellQuantity([previousSell], 7, [openingPosition])).toEqual({
  availableQuantity: 7,
  isValid: true,
});

expect(validateSellQuantity([previousSell], 8, [openingPosition])).toEqual({
  availableQuantity: 7,
  isValid: false,
  message: "Sell quantity exceeds available units.",
});
```

- [ ] **Step 2: Run the validator tests and confirm failure**

Run: `npm test -- src/domain/validators/__tests__/trade.test.ts`

Expected: TypeScript/Jest failure because `validateSellQuantity` does not accept opening positions yet.

- [ ] **Step 3: Update validator signatures**

Change `getAvailableQuantity` and `validateSellQuantity` to accept optional opening positions:

```ts
import type { OpeningPosition, Trade, TradeType } from "@/src/types";

export function getAvailableQuantity(
  trades: Trade[],
  openingPositions: OpeningPosition[] = [],
) {
  const openingQuantity = openingPositions.reduce(
    (quantity, position) => quantity + position.quantity,
    0,
  );

  return trades.reduce((quantity, trade) => {
    if (trade.type === "sell") {
      return quantity - trade.quantity;
    }

    return quantity + trade.quantity;
  }, openingQuantity);
}

export function validateSellQuantity(
  trades: Trade[],
  sellQuantity: number,
  openingPositions: OpeningPosition[] = [],
): SellQuantityResult {
  const availableQuantity = getAvailableQuantity(trades, openingPositions);

  if (sellQuantity > availableQuantity) {
    return {
      availableQuantity,
      isValid: false,
      message: "Sell quantity exceeds available units.",
    };
  }

  return {
    availableQuantity,
    isValid: true,
  };
}
```

- [ ] **Step 4: Run validator tests**

Run: `npm test -- src/domain/validators/__tests__/trade.test.ts`

Expected: PASS.

## Task 2: Pure Sell/Redeem Preview Calculations

**Files:**
- Create: `src/domain/calculations/sellRedeem.ts`
- Create: `src/domain/calculations/__tests__/sellRedeem.test.ts`
- Modify: `src/domain/calculations/index.ts`

- [ ] **Step 1: Add failing calculation tests**

Create tests for gross proceeds, net proceeds, fee rejection, remaining units, and remaining value:

```ts
import {
  calculateSellRedeemPreview,
  validateSellRedeemFees,
} from "@/src/domain/calculations";

expect(
  calculateSellRedeemPreview({
    availableUnits: 10,
    currentPrice: 150,
    fees: 25,
    quantity: 4,
    sellPrice: 200,
  }),
).toEqual({
  fees: 25,
  grossProceeds: 800,
  netProceeds: 775,
  remainingUnits: 6,
  remainingValue: 900,
});

expect(validateSellRedeemFees({ fees: 801, grossProceeds: 800 })).toEqual({
  isValid: false,
  message: "Fees cannot exceed gross proceeds.",
});
```

- [ ] **Step 2: Run the new calculation tests and confirm failure**

Run: `npm test -- src/domain/calculations/__tests__/sellRedeem.test.ts`

Expected: FAIL because the helper file does not exist.

- [ ] **Step 3: Implement pure helpers**

Create `src/domain/calculations/sellRedeem.ts`:

```ts
export type SellRedeemPreviewInput = {
  availableUnits: number;
  currentPrice: number;
  fees?: number;
  quantity: number;
  sellPrice: number;
};

export type SellRedeemPreview = {
  fees: number;
  grossProceeds: number;
  netProceeds: number;
  remainingUnits: number;
  remainingValue: number;
};

export function calculateSellRedeemPreview({
  availableUnits,
  currentPrice,
  fees = 0,
  quantity,
  sellPrice,
}: SellRedeemPreviewInput): SellRedeemPreview {
  const grossProceeds = quantity * sellPrice;
  const netProceeds = grossProceeds - fees;
  const remainingUnits = Math.max(0, availableUnits - quantity);

  return {
    fees,
    grossProceeds,
    netProceeds,
    remainingUnits,
    remainingValue: remainingUnits * currentPrice,
  };
}

export function validateSellRedeemFees({
  fees,
  grossProceeds,
}: {
  fees: number;
  grossProceeds: number;
}) {
  if (fees > grossProceeds) {
    return {
      isValid: false as const,
      message: "Fees cannot exceed gross proceeds.",
    };
  }

  return { isValid: true as const };
}
```

Export it from `src/domain/calculations/index.ts`:

```ts
export * from "./sellRedeem";
```

- [ ] **Step 4: Run calculation tests**

Run: `npm test -- src/domain/calculations/__tests__/sellRedeem.test.ts`

Expected: PASS.

## Task 3: Sell/Redeem Hook

**Files:**
- Create: `src/features/sellRedeem/useSellRedeemHolding.ts`
- Create: `src/features/sellRedeem/index.ts`
- Create: `src/features/sellRedeem/__tests__/useSellRedeemHolding.test.tsx`

- [ ] **Step 1: Add failing hook tests**

Test these behaviors:

```ts
const result = renderHook(() =>
  useSellRedeemHolding({ assetId: "asset-hdfc", store }),
);

act(() => result.current.setQuantity("5"));
act(() => result.current.setSellPrice("1700"));
act(() => result.current.setFees("100"));

expect(result.current.preview?.netProceeds).toBe(8400);
expect(result.current.linkCashEntry).toBe(true);

act(() => result.current.save());

expect(store.getState().trades).toEqual([
  expect.objectContaining({
    assetId: "asset-hdfc",
    pricePerUnit: 1700,
    quantity: 5,
    totalValue: 8400,
    type: "sell",
  }),
]);
expect(store.getState().cashEntries).toEqual([
  expect.objectContaining({
    amount: 8400,
    label: "HDFC Bank redemption proceeds",
    type: "addition",
  }),
]);
```

Also test:

- disabling `linkCashEntry` creates only the sell trade
- over-selling sets a quantity error
- fees above gross proceeds sets a fees error
- missing asset or no holding returns a not-found state

- [ ] **Step 2: Run hook tests and confirm failure**

Run: `npm test -- src/features/sellRedeem/__tests__/useSellRedeemHolding.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement hook state and save behavior**

Implement:

- state: `quantity`, `sellPrice`, `fees`, `date`, `notes`, `linkCashEntry`, `cashAmount`, `cashLabel`, `errors`, `successMessage`
- derived: `holding`, `availableUnits`, `preview`, `isReady`
- actions: setters, `toggleLinkCashEntry`, `save`

Use:

- `calculateHoldings` to find the current holding
- `validateSellQuantity(assetTrades, quantity, assetOpeningPositions)`
- `calculateSellRedeemPreview`
- `store.getState().addTrade`
- `store.getState().addCashEntry` when cash link is enabled

Trade object:

```ts
{
  assetId,
  date,
  fees: feeValue || undefined,
  id: createId("trade"),
  notes: notes.trim() || undefined,
  pricePerUnit: sellPriceValue,
  quantity: quantityValue,
  totalValue: preview.netProceeds,
  type: "sell",
}
```

Cash entry object:

```ts
{
  amount: cashAmountValue,
  date,
  id: createId("cash"),
  label: cashLabel.trim(),
  notes: notes.trim() || `Linked to ${asset.name} sell / redeem`,
  type: "addition",
}
```

- [ ] **Step 4: Run hook tests**

Run: `npm test -- src/features/sellRedeem/__tests__/useSellRedeemHolding.test.tsx`

Expected: PASS.

## Task 4: Sell/Redeem Screen And Route

**Files:**
- Create: `src/features/sellRedeem/SellRedeemScreen.tsx`
- Create: `src/features/sellRedeem/__tests__/SellRedeemScreen.test.tsx`
- Create: `app/sell-redeem.tsx`

- [ ] **Step 1: Add failing screen tests**

Cover:

- selected holding summary renders
- available units render
- preview renders after input
- `Add proceeds to Cash Ledger` is checked by default
- user can disable linked cash
- save shows success or calls optional `onSaved`
- missing asset shows empty/not-found state

Use test IDs:

- `sell-redeem-screen`
- `sell-redeem-quantity-input`
- `sell-redeem-price-input`
- `sell-redeem-fees-input`
- `sell-redeem-date-input`
- `sell-redeem-link-cash-toggle`
- `sell-redeem-cash-amount-input`
- `sell-redeem-cash-label-input`
- `sell-redeem-save-button`

- [ ] **Step 2: Run screen tests and confirm failure**

Run: `npm test -- src/features/sellRedeem/__tests__/SellRedeemScreen.test.tsx`

Expected: FAIL because the screen does not exist.

- [ ] **Step 3: Implement screen**

Use existing UI primitives:

- `ScreenContainer`
- `ScreenHeader`
- `PremiumCard`
- `MetricGroup`
- `AppButton`
- `FormTextField`
- `MaskedValue`
- `EmptyState`

Screen sections:

- header: `Sell / redeem`, subtitle `Record exit • local only`
- selected holding summary
- exit details form
- proceeds preview
- linked cash movement
- save button

Keep copy calm:

- `This reduces the holding and can add proceeds to deployable cash.`
- `Add proceeds to Cash Ledger`
- `Cash amount`
- `Cash label`

- [ ] **Step 4: Implement route**

Create `app/sell-redeem.tsx`:

```tsx
import { router, useLocalSearchParams } from "expo-router";

import { SellRedeemScreen } from "@/src/features/sellRedeem";

export default function SellRedeemRoute() {
  const params = useLocalSearchParams<{ assetId?: string }>();

  return (
    <SellRedeemScreen
      assetId={params.assetId ?? ""}
      onSaved={() => router.back()}
    />
  );
}
```

- [ ] **Step 5: Run screen tests**

Run: `npm test -- src/features/sellRedeem/__tests__/SellRedeemScreen.test.tsx`

Expected: PASS.

## Task 5: Holdings Entry Point

**Files:**
- Modify: `src/features/holdings/HoldingsScreen.tsx`
- Modify: `src/features/holdings/__tests__/HoldingsScreen.test.tsx`
- Modify: `app/(tabs)/holdings.tsx`

- [ ] **Step 1: Add failing Holdings test**

Test that expanded holding details show `Sell / redeem` and call a callback with the asset id:

```ts
const onSellRedeem = jest.fn();
const { getByTestId, getByText } = render(
  <HoldingsScreen store={store} onSellRedeem={onSellRedeem} />,
);

fireEvent.press(getByTestId("holding-row-asset-reliance"));
fireEvent.press(getByText("Sell / redeem"));

expect(onSellRedeem).toHaveBeenCalledWith("asset-reliance");
```

- [ ] **Step 2: Run Holdings test and confirm failure**

Run: `npm test -- src/features/holdings/__tests__/HoldingsScreen.test.tsx`

Expected: FAIL because the callback/action does not exist.

- [ ] **Step 3: Add callback prop and action button**

Add prop:

```ts
onSellRedeem?: (assetId: string) => void;
```

In expanded holding details, add an `AppButton`:

```tsx
{onSellRedeem ? (
  <AppButton
    title="Sell / redeem"
    testID={`holding-sell-redeem-${holding.asset.id}`}
    variant="secondary"
    onPress={() => onSellRedeem(holding.asset.id)}
  />
) : null}
```

- [ ] **Step 4: Wire route navigation**

Modify `app/(tabs)/holdings.tsx`:

```tsx
<HoldingsFeatureScreen
  onAddTrade={() => router.push("/add-holding")}
  onSellRedeem={(assetId) => {
    router.push({ pathname: "/sell-redeem", params: { assetId } });
  }}
/>
```

- [ ] **Step 5: Run Holdings tests**

Run: `npm test -- src/features/holdings/__tests__/HoldingsScreen.test.tsx`

Expected: PASS.

## Task 6: Cash Ledger Linked Proceeds Display

**Files:**
- Modify: `src/components/cards/CashEntryRow.tsx`
- Modify: `src/features/cash/__tests__/CashScreen.test.tsx`

- [ ] **Step 1: Add Cash Ledger row test for proceeds copy**

Seed a cash addition labelled `HDFC Bank redemption proceeds` and verify the row does not look like a generic deposit:

```ts
store.getState().addCashEntry({
  amount: 8400,
  date: "2026-05-20",
  id: "cash-proceeds",
  label: "HDFC Bank redemption proceeds",
  type: "addition",
});

expect(getByText("HDFC Bank redemption proceeds")).toBeTruthy();
expect(getByText("Added from asset exit")).toBeTruthy();
```

- [ ] **Step 2: Run CashScreen tests and confirm failure**

Run: `npm test -- src/features/cash/__tests__/CashScreen.test.tsx`

Expected: FAIL because the row copy still says `Increased deployable cash`.

- [ ] **Step 3: Add deterministic proceeds detection**

In `CashEntryRow.tsx`, update movement copy:

```ts
function isAssetExitProceeds(entry: CashEntry) {
  return /sale proceeds|redemption proceeds/i.test(entry.label);
}

function getCashEntryMovement(entry: CashEntry) {
  if (entry.type === "addition" && isAssetExitProceeds(entry)) {
    return "Added from asset exit";
  }

  return entry.type === "addition"
    ? "Increased deployable cash"
    : "Reduced deployable cash";
}
```

- [ ] **Step 4: Run CashScreen tests**

Run: `npm test -- src/features/cash/__tests__/CashScreen.test.tsx`

Expected: PASS.

## Task 7: Integration And Regression Verification

**Files:**
- Existing tests only, unless failures reveal missing coverage.

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npm test -- src/domain/validators/__tests__/trade.test.ts
npm test -- src/domain/calculations/__tests__/sellRedeem.test.ts
npm test -- src/features/sellRedeem/__tests__/useSellRedeemHolding.test.tsx
npm test -- src/features/sellRedeem/__tests__/SellRedeemScreen.test.tsx
npm test -- src/features/holdings/__tests__/HoldingsScreen.test.tsx
npm test -- src/features/cash/__tests__/CashScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full static verification**

Run:

```powershell
npm run typecheck
npm test
npm run doctor
```

Expected: PASS or documented Expo doctor warning that is unrelated to this change.

- [ ] **Step 3: Run Android harness if emulator is available**

Run:

```powershell
npm run android:doctor
npm run android:smoke -- --strict
```

Expected: emulator detected and app package detected if already installed.

- [ ] **Step 4: Run emulator app smoke for the new flow**

Use the local Expo/dev-build loop or installed APK, depending on current environment:

```powershell
npm run android
```

Manual emulator checks:

- Holdings opens.
- Expand a holding.
- `Sell / redeem` opens the exit flow.
- Partial sell saves.
- Holding quantity reduces.
- Cash Ledger shows the proceeds row.
- Disabling cash link does not add a proceeds row.

- [ ] **Step 5: Document any deferred visual/E2E work**

If Maestro coverage is not practical in this slice, add a concise note in the PR body under `Deferred` rather than silently skipping it.

## Task 8: Commit And PR

**Files:**
- All implementation files from Tasks 1-6.

- [ ] **Step 1: Check final diff**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only #146-related files changed.

- [ ] **Step 2: Commit implementation**

Run:

```powershell
git add app/sell-redeem.tsx app/(tabs)/holdings.tsx src/domain src/features src/components/cards
git commit -m "feat: add sell redeem flow"
```

- [ ] **Step 3: Push branch**

Run:

```powershell
git push -u origin v1/issue-146-sell-redeem-flow
```

- [ ] **Step 4: Open PR**

PR body must include:

```md
Closes #146

## Summary
- adds a holding-owned Sell / redeem flow
- links net proceeds into Cash Ledger by default
- validates sell quantity against opening positions and trades

## Verification
- npm run typecheck
- npm test
- npm run doctor
- npm run android:doctor
- npm run android:smoke -- --strict
```

Expected: GitHub shows issue #146 in `closingIssuesReferences`.

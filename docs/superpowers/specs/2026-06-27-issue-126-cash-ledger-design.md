# Issue #126 Cash Ledger Design Spec

## Goal

Make Cash Ledger feel like deployable capital and recent cash movement, not a
placeholder balance screen.

The accepted design direction is Option B from
`docs/design/cash-ledger-preview/index.html`.

## Product Boundary

Cash Ledger owns cash movement only:

- Deposit: money enters the portfolio cash pool.
- Withdraw: money leaves the portfolio cash pool.
- Invest / Investment Transfer: deployable cash moves into investments and
  reduces available cash.

Cash Ledger does not perform asset sell, redemption, or partial-exit logic.
Those flows belong to Holdings / asset transaction work and are tracked by
GitHub issue #146. If a sale or redemption produces cash before #146 exists in
the app, the user may manually record the cash as a Deposit, but Cash Ledger
must not imply that it sold the asset.

## Chosen UX Direction

Use the "deployable capital" framing:

- Screen title: `Cash Ledger`.
- Subtitle: `Deployable capital - local only` or `Manual ledger - local only`
  if the app wants to keep the existing baseline wording.
- Hero value: deployable cash first.
- Secondary context: total cash balance and current-month investment transfer.
- Monthly movement card: added, invested/transferred, and kept as cash.
- Quick entry: `Deposit`, `Withdraw`, `Invest`.
- Recent movement: rows explain what happened, not just the amount.

The screen should answer three questions quickly:

1. How much cash can I deploy now?
2. What changed this month?
3. What was the recent cash movement trail?

## Data Semantics

For V1, keep persisted cash entry semantics simple:

- `Deposit` maps to `CashEntryType = "addition"`.
- `Withdraw` maps to `CashEntryType = "withdrawal"`.
- `Invest` / `Investment Transfer` maps to `CashEntryType = "withdrawal"` with
  UI copy and metadata indicating investment transfer.

If the current `CashEntry` type cannot distinguish a normal withdrawal from an
investment transfer, the implementation should add the smallest durable field
needed to preserve that meaning, for example `category:
"deposit" | "withdrawal" | "investment_transfer"`, while keeping balance math
based on the existing addition/withdrawal direction.

Do not introduce tax lots, LTCG, brokerage settlement, or asset-sale behavior in
this issue.

## Screen Structure

### Header

- Title: `Cash Ledger`.
- Subtitle: local-first and deployable-capital framing.
- Actions: value mask and add entry if consistent with app navigation.

### Hero

Lead with `Deployable cash`.

Secondary context:

- Total cash balance.
- Current month investment transfer amount.
- Calm text such as `₹45K moved into investments this month`.

All values must use INR formatting and value masking.

### Monthly Movement

Show current-month cash movement as a compact evidence card:

- Added.
- Invested / transferred.
- Kept as cash or available.
- Savings/investment rate when computable.

This section should not become a dashboard duplicate. It exists to explain cash
movement only.

### Quick Entry

Entry modes:

- `Deposit`
- `Withdraw`
- `Invest`

Mode copy:

- Deposit: "Add money that is available for future investment."
- Withdraw: "Record money leaving the portfolio cash pool."
- Invest: "Move deployable cash into an investment."

The `Invest` action should clearly reduce cash. In implementation, its saved
row may still use withdrawal math.

### Recent Movement

Rows should include:

- human-readable label
- movement category
- date
- amount with sign
- short explanation when helpful

Examples:

- `Salary added` / `Increased deployable cash`
- `SIP transfer` / `Moved cash into investments`
- `Emergency reserve` / `Kept as cash reserve`

Rows should remain calm, compact, and scannable.

### Empty State

The empty state should teach the screen:

- No alarmist copy.
- Explain that cash entries are optional and local.
- Tell the user to add broker or bank cash only when it should count toward
  portfolio value.

## Implementation Constraints

- Keep all domain calculations pure.
- Keep business logic out of components.
- Do not implement issue #146 here.
- Do not add Minimal Mode, LTCG, import/export, cloud sync, or analytics.
- Preserve Android touch targets and keyboard safety.
- Preserve existing testIDs where possible; add stable ones only when needed for
  Maestro or component tests.

## Verification

Static/unit:

- Cash balance still derives from additions minus withdrawals.
- Investment transfer reduces deployable cash.
- Monthly cash movement derives current-month added, invested/transferred, kept
  cash, and savings/investment rate.
- Value masking hides cash values.
- Empty state remains useful.

Manual/emulator:

- Cash Ledger loads.
- Deposit entry saves and increases cash.
- Withdraw entry saves and reduces cash.
- Invest entry saves and reduces cash with investment-transfer copy.
- Recent movement rows explain the source/use of cash.
- Masking hides hero, metrics, and row amounts.

## Acceptance Criteria Mapping

- Clear identity: screen leads with deployable cash.
- Useful V1 behavior: monthly cash movement explains added, invested, and kept
  cash.
- Deposit/withdraw/invest supported: quick entry modes are explicit.
- Investment transfer behavior: reduces deployable cash and is labeled as an
  investment transfer.
- Empty state: explains how to start without implying missing setup.
- Tests: cover calculations and UI behavior.
- Android evidence: populated and empty ledger states should be captured when
  implementation is complete.

# Issue #126 Cash Ledger Design Spec

## Goal

Make Cash Ledger feel like deployable capital and recent cash movement, not a
placeholder balance screen.

The accepted design direction is Option B from
`docs/design/cash-ledger-preview/index.html`.

## Product Boundary

Cash Ledger owns manually recorded cash movement only:

- Deposit: money enters the portfolio cash pool.
- Withdraw: money leaves the portfolio cash pool.
- Invested: evidence derived from Add Holding / transaction records. It is not
  a manual Cash Ledger action.

Cash Ledger does not perform asset sell, redemption, or partial-exit logic.
Those flows belong to Holdings / asset transaction work and are tracked by
GitHub issue #146. If a sale or redemption produces cash before #146 exists in
the app, the user may manually record the cash as a Deposit, but Cash Ledger
must not imply that it sold the asset.

Cash Ledger should not expose `Invest` as a primary manual action. That wording
is ambiguous because users expect investing to create or update a holding.

## Chosen UX Direction

Use the "deployable capital" framing:

- Screen title: `Cash Ledger`.
- Subtitle: `Deployable capital - local only` or `Manual ledger - local only`
  if the app wants to keep the existing baseline wording.
- Hero value: deployable cash first.
- Secondary context: total cash balance and current-month invested amount.
- Monthly movement card: added, invested, and kept as cash.
- Quick entry: `Deposit`, `Withdraw`.
- Recent movement: rows explain what happened, not just the amount.

The screen should answer three questions quickly:

1. How much cash can I deploy now?
2. What changed this month?
3. What was the recent cash movement trail?

## Data Semantics

For V1, keep manual cash-entry semantics simple:

- `Deposit` maps to `CashEntryType = "addition"`.
- `Withdraw` maps to `CashEntryType = "withdrawal"`.

`Deployable cash` is the actual cash ledger balance from cash entries. Do not
subtract investment records from deployable cash unless the investment flow has
also created a real cash outflow; otherwise later linked-cash work can
double-count the same movement.

Investment evidence should be produced from Add Holding / transaction records
when available. If a future flow can confidently connect a cash deduction to an
investment entry, it may create a withdrawal-style cash row, but Cash Ledger
must still not ask the user to press an ambiguous `Invest` button.

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
- Current month invested amount.
- Calm text such as `₹45K moved into investments this month`.

All values must use INR formatting and value masking.

### Monthly Movement

Show current-month cash movement as a compact evidence card:

- Added.
- Invested.
- Kept as cash or available.
- Savings/investment rate when computable.

This section should not become a dashboard duplicate. It exists to explain cash
movement only.

### Quick Entry

Entry modes:

- `Deposit`
- `Withdraw`

Mode copy:

- Deposit: "Add money that is available for future investment."
- Withdraw: "Record money leaving the portfolio cash pool."
Investment evidence should appear as `Invested` context, not as a primary mode
in the cash entry control.

### Recent Movement

Rows should include:

- human-readable label
- movement category
- date
- amount with sign
- short explanation when helpful

Examples:

- `Salary added` / `Increased deployable cash`
- `SIP transfer` / `Reduced deployable cash`
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
- Invested evidence derives from current-month investment records without
  changing cash balance by itself.
- Monthly cash movement derives current-month added, invested, kept cash,
  and savings/investment rate.
- Value masking hides cash values.
- Empty state remains useful.

Manual/emulator:

- Cash Ledger loads.
- Deposit entry saves and increases cash.
- Withdraw entry saves and reduces cash.
- Invested evidence appears when investment records exist.
- Recent movement rows explain the source/use of cash.
- Masking hides hero, metrics, and row amounts.

## Acceptance Criteria Mapping

- Clear identity: screen leads with deployable cash.
- Useful V1 behavior: monthly cash movement explains added, invested, and kept
  cash.
- Deposit/withdraw supported: quick entry modes are explicit.
- Investment behavior: appears as derived `Invested` evidence, not a primary
  Cash Ledger action.
- Empty state: explains how to start without implying missing setup.
- Tests: cover calculations and UI behavior.
- Android evidence: populated and empty ledger states should be captured when
  implementation is complete.

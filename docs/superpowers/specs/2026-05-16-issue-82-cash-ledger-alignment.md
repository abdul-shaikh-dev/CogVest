# Issue #82 Cash Ledger Alignment Spec

## Goal

Align the V1 Cash Ledger with the approved Figma direction and Excel parity:
cash balance, monthly cash context, savings rate, and clear ledger entries.

## Scope

- Keep `CashEntry` raw storage as `addition` or `withdrawal`.
- Add an `Investment Transfer` UI mode that stores as a withdrawal, because in
  V1 it represents cash leaving available cash for investments.
- Show Figma-aligned metrics: Added, Invested, Available, Savings.
- Derive monthly added cash from current-month cash additions.
- Derive invested amount from current-month buy trades plus opening positions.
- Derive savings rate as current-month invested divided by current-month added
  cash when added cash exists; otherwise show `Not enough data`.
- Preserve value masking for cash balance, available cash, and ledger amounts.
- Improve recent ledger grouping and copy without changing storage semantics.

## Non-Goals

- No new cash entry database type or schema migration.
- No portfolio accounting engine for transfer matching.
- No import/export.
- No historical charting.
- No fake savings values.

## Data Rules

- Deposit maps to `CashEntry.type = "addition"`.
- Withdraw maps to `CashEntry.type = "withdrawal"`.
- Investment Transfer maps to `CashEntry.type = "withdrawal"` with the user's
  label and optional note preserved.
- Available cash is the current cash balance.
- Monthly invested comes from stored trades and opening positions, not from
  hardcoded UI values.
- Savings is `Not enough data` when current-month added cash is zero.

## UX Rules

- Entry modes are `Deposit`, `Withdraw`, and `Investment Transfer`.
- Ledger rows must show positive and negative movement clearly.
- Hero cash balance includes a masked-preview line so masking behavior is
  explicit.
- Cash remains local-first and low-noise.

## Acceptance Checklist

- Cash supports Deposit, Withdraw, and Investment Transfer.
- Metrics are derived from stored data.
- Savings is correct or explicitly unavailable.
- Ledger rows show movement direction clearly.
- Masking covers cash values.
- Tests cover deposit, withdrawal, transfer, metrics, and masking.

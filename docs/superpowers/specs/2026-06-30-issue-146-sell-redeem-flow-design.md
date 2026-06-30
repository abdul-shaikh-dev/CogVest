# Issue #146 Sell / Redeem Flow Design

## Status

Approved design direction for V1 implementation.

## Goal

Add a V1 asset exit flow that lets the user sell or redeem part of a holding, reduce the stored position, and link the resulting proceeds into Cash Ledger by default.

## Product Principle

Cash Ledger tracks cash movement. Holdings owns asset exits.

The user should not need to fake a sale by adding a manual cash deposit. CogVest should record the asset exit as a holding transaction and then create the related cash movement as a linked consequence.

## User-Facing Language

Use calm, portfolio-led language:

- `Sell / redeem`
- `Record exit`
- `Proceeds`
- `Remaining units`
- `Add proceeds to Cash Ledger`

Avoid trading-led language:

- `Place order`
- `Trade ticket`
- `Market sell`
- `Book profit`

## Entry Point

The primary V1 entry point is from a holding row or expanded holding details on the Holdings screen.

The flow should be available only for holdings with positive available units.

## Flow

1. User opens Holdings.
2. User expands or opens a holding.
3. User taps `Sell / redeem`.
4. CogVest opens a focused sell/redeem form for that holding.
5. Form shows available units and current known price.
6. User enters quantity, sell price, date, optional fees, and optional note.
7. CogVest shows a derived preview:
   - gross proceeds
   - fees
   - net proceeds
   - remaining units
   - remaining position value
8. `Add proceeds to Cash Ledger` is checked by default.
9. User can edit the linked cash amount/label or uncheck the cash link.
10. Save creates a `sell` trade and, if enabled, a linked cash `addition`.

## Default Cash-Link Behavior

The default behavior is:

- checked: `Add proceeds to Cash Ledger`
- amount: net proceeds
- cash type: `addition`
- label: `<Asset name> redemption proceeds` or `<Asset name> sale proceeds`
- note: optional user note plus enough deterministic context to understand the link

The user can:

- leave the default as-is
- edit the cash amount if settlement differs from calculated proceeds
- edit the cash label
- uncheck the link if proceeds should not count as deployable cash

## Domain Model Direction

Use the existing raw-record model:

- persist a `Trade` with `type: "sell"`
- persist a `CashEntry` with `type: "addition"` when cash linking is enabled
- continue deriving holdings, P&L, allocation, rollups, and snapshots from raw records

Do not persist derived remaining units or proceeds summaries.

## Required Domain Behavior

The sell/redeem validator must account for:

- opening positions
- buy trades
- prior sell trades

It must reject sell quantity above currently available units.

The holding calculation already treats sell trades as unit reductions and keeps average cost stable for remaining units. The implementation should preserve that behavior.

## Fees And Proceeds

Use this V1 calculation:

- `gross proceeds = quantity * sell price`
- `net proceeds = gross proceeds - fees`

Fees must be optional and non-negative.

If fees exceed gross proceeds, reject the form with a clear error.

## UI Requirements

The flow should feel like a premium ledger action, not a trading screen.

Minimum screen sections:

- selected holding summary
- exit details
- proceeds preview
- linked cash movement
- final save action

The selected holding summary should show:

- asset name
- symbol/ticker
- asset class
- available units
- current value or current known price

Exit details should capture:

- quantity to sell/redeem
- sell price
- date
- fees
- optional note

Proceeds preview should show:

- gross proceeds
- fees
- net proceeds
- remaining units
- remaining value estimate

Linked cash movement should show:

- checked by default
- cash amount
- cash label
- explanation that this adds proceeds to deployable cash

## Cash Ledger Requirements

Cash Ledger should continue exposing only manual cash movement actions:

- Deposit
- Withdraw

It should not become the entry point for asset exits.

When linked proceeds exist, Cash Ledger rows should make them distinguishable from generic deposits through their label/copy, for example:

- `HDFC Bank redemption proceeds`
- `Bitcoin sale proceeds`

## Out Of Scope

Do not implement:

- LTCG or tax calculations
- FIFO tax lots
- realized P&L reports
- broker import/export
- multi-account settlement modeling
- order execution or broker integration
- advanced audit trail UI

## Testing Requirements

Unit/domain tests:

- available quantity includes opening positions
- available quantity subtracts prior sell trades
- sell quantity above available units is rejected
- net proceeds subtract fees
- fees above gross proceeds are rejected
- saving with cash link creates sell trade plus linked cash addition
- saving without cash link creates only sell trade

Component tests:

- Holdings exposes `Sell / redeem` for an existing holding
- Sell/redeem form displays available units
- preview updates from quantity, price, and fees
- cash link is checked by default
- save creates the expected store records
- over-sell validation is visible

Android verification:

- seed or create a holding
- record a partial sell/redeem
- verify holding units reduce
- verify Cash Ledger shows linked proceeds
- verify disabling cash link does not add a cash row

## Acceptance Criteria Mapping

- A user can record an asset sell/redeem/exit without using Cash Ledger as the primary entry point.
- Recording an exit reduces the holding quantity/current position correctly.
- Sale proceeds are calculated from quantity and sell price.
- The user can create or confirm a linked cash inflow from sale proceeds.
- Cash Ledger displays linked proceeds as sale/redemption cash movement.
- Cash Ledger still only exposes Deposit and Withdraw manual actions.
- V1 copy clearly separates cash movement from asset exits.
- Tests cover holding quantity reduction, proceeds calculation, and linked cash inflow behavior.
- Android emulator evidence covers the sell/redeem flow and resulting Cash Ledger row.

## Open Implementation Notes

- Prefer adding a focused `useSellRedeemHolding` hook rather than expanding `useAddTrade`.
- Reuse existing `Trade` type where possible.
- If a `CashEntry` link identifier is needed for future auditability, introduce it in the smallest compatible way. Do not build a full audit trail in V1.
- If route structure allows it, use a secondary route such as `app/sell-redeem.tsx`; otherwise use a focused modal/screen launched from Holdings.

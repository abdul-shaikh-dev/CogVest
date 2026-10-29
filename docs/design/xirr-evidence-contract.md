# XIRR evidence and eligibility contract

30 October 2026. Related to #532 and #533. Approved by the owner on 30 October
2026, including the 7-day price limit and the fee handling in D4. No code,
schema, dependency or UI change accompanies this note.

[`portfolio-xirr-contract.md`](portfolio-xirr-contract.md) defines the three
boundaries and the event treatment, and #536 added a read-only whole-portfolio
audit. This note settles what that contract left open, so the input builders
(#533), the solver (#534) and presentation (#535) can proceed in that order:

1. how distributions are evidenced;
2. when per-asset and Investments XIRR are eligible from records that already
   exist;
3. the persisted measurement basis that Whole-portfolio XIRR needs.

Decisions D1–D12 are approved as written. Anything not decided here stays
unavailable, never estimated.

## Current records (schema 16)

| Record | Fields that matter for returns |
| --- | --- |
| `Trade` buy/sell | Asset, date, quantity, price, `totalValue`, optional `fees`; import provenance with optional fees/taxes |
| `Trade` transferIn/transferOut | Units only; optional acquisition cost; no fair value at transfer |
| `OpeningPosition` | Aggregate units and average cost; `date` may be null; optional `measuredAsOf` cutover |
| `CashEntry` | Purpose (`capitalContribution`, `purchaseFunding`, `saleProceeds`, `futuresTransfer`, `epfTransfer`, `withdrawal`, `legacyUncategorized`), links to trade/Futures/EPF |
| Splits, bonuses, demergers | Verified unit/identity adjustments; no cash |
| PPF ledger | Contributions, interest credits, withdrawals, reconciliations; no Cash link |
| EPF ledger | Employee/employer contributions, interest, withdrawals (external/unknown), transfers, reconciliations |
| Futures account | USDT events, Cash-linked or external transfers with dated INR rates, verified valuations |
| Quotes | Current and historical quotes with provenance and dates |

There is **no record of dividends, interest from securities or other
distributions** anywhere. That is the main gap.

## Decisions

### Distributions

**D1. Missing distributions block, unless the asset is confirmed to have paid
none.** (Owner decision, 30 October.) A per-asset or Investments result for an
asset is unavailable with the reason "Distributions not recorded" unless one of
these holds for the whole measured period:

- the asset class cannot distribute (crypto, a growth-option mutual fund, PPF,
  EPF, Futures); or
- the user has confirmed "no distributions in this period" for that asset (D3);
  or
- its distributions are recorded (D2) and confirmed complete.

A rate that silently leaves out income is never shown.

**D2. Record distributions as a new, separate record, not as Cash entries or
trades.** Proposed `Distribution` record (schema 17):

| Field | Meaning |
| --- | --- |
| `id`, `assetId` | Identity |
| `paidOn` | Date the money was received |
| `grossAmount`, `taxWithheld` | INR; net = gross − tax withheld |
| `treatment` | `paidToCash` (links one `CashEntry` with a new purpose `distribution`) or `paidOutside` (left the tracked portfolio) or `reinvested` (links the buy it funded) |
| `source` | `manual` or a future import; provenance like trades |

Effect on each boundary:

| Treatment | Per-asset | Investments | Whole-portfolio |
| --- | --- | --- | --- |
| `paidToCash` | +net on `paidOn` | +net (crosses into excluded Cash) | Internal; Cash already holds it |
| `paidOutside` | +net | +net | +net (leaves the portfolio) |
| `reinvested` | +net, and the linked buy stays a −flow | Internal (both sides inside) | Internal |

Tax withheld is not a flow for any boundary; it never reached the investor.

**D3. A per-asset, per-period "no distributions" confirmation**, stored with
the date confirmed and the period it covers. Adding a distribution inside a
confirmed period, or extending the period, invalidates it.

Mutual-fund IDCW options and stocks without that confirmation stay unavailable.
Growth options need the asset to be tagged as growth; until that tag exists,
they need D3 too.

### Per-asset XIRR from existing records

**D4. An asset is eligible from trades alone only when its full history is
recorded:**

- no `OpeningPosition` for it, or an opening position with a known `date` and
  a verified opening market value on that date (D9), which makes the result
  bounded-period, not lifetime;
- no `transferIn`/`transferOut` without fair-value evidence (D6);
- every buy and sell has a date, quantity and total. Fees count when recorded.
  A manual trade without a fee uses the total the user entered. An imported
  trade whose source has no fee column is labelled "fees not in source", not
  blocked;
- distributions satisfy D1;
- a terminal value exists (D7), or the position is fully sold.

Flows: buy = −(total + fees); sell = +(total − fees); distribution per D2;
terminal value = +units × end price. Splits, bonuses and demergers add no flow;
a demerger parent and child are measured together as one unit from the
demerger date (D5).

**D5. Demergers are measured on the combined parent-plus-child holding** from
the demerger date, because allocated cost is not a payout. Per-asset results
for parent or child alone, across the demerger date, are unavailable.

**D6. In-kind transfers.** A `transferIn` from outside the portfolio is a
−flow at its **fair value on the transfer date**, which needs a dated price
with provenance. Acquisition cost is never used. Without that price the asset
is unavailable for any period that includes the transfer. A transfer between
two tracked accounts is internal and adds no flow.

**D7. Terminal value** uses the latest quote for each included asset, as long
as it is no more than 7 calendar days before the measurement end date. Manual
quotes are allowed and labelled. A stale or missing quote makes the result
unavailable. The result's "as of" date is the earliest quote date used, not the
latest.

### Investments XIRR

**D8. Investments covers market assets, PPF, EPF and Futures net equity; Cash is
excluded.** The result always lists the included accounts. Flows crossing the
boundary:

- buys, PPF contributions, employee and employer EPF contributions and
  Cash-to-Futures transfers: − (money enters investments, wherever it came from);
  EPS is excluded;
- sale proceeds, PPF/EPF withdrawals and Futures transfers back to Cash: +;
- distributions per D2;
- external Futures transfers: dated INR flow at the recorded event rate; never
  today's FX;
- buys and sells without a linked Cash leg count as crossing the boundary,
  because Cash is outside it either way. They do not need D9.

It is eligible only when every included asset meets D4 and every included
account has history covering the period. A PPF/EPF account whose history starts
after the period start needs a confirmed balance on the period start date.
Futures needs a verified wallet valuation at both ends.

### Whole-portfolio XIRR

**D9. A persisted measurement basis** (schema 17), one per user:

| Field | Meaning |
| --- | --- |
| `startDate` | Period start |
| `kind` | `inception` (nothing was held before; lifetime) or `openingValue` (bounded period) |
| `openingValueInr` | For `openingValue`: verified total market value of every in-scope account at `startDate`, including Cash |
| `openingBreakdown` | Per account/asset values that sum to `openingValueInr`, each with date and source |
| `confirmedAt` | When the user confirmed it |

It is a declaration, not a transaction: it never changes Cash, holdings or
snapshots. Editing or deleting any record dated on or before `startDate`
clears `confirmedAt`.

**D10. External flows after the start date** come only from:

- Cash `capitalContribution` (−) and `withdrawal` (+);
- `paidOutside` distributions (+);
- external Futures transfers at the event rate;
- employer EPF contributions (−).

Cash-funded buys, sales into Cash, Cash↔Futures and Cash↔EPF transfers are
internal. Buys and sells without a Cash link, `legacyUncategorized` Cash and PPF
contributions with no recorded source make the result unavailable. Each comes
with a fix: link it, or reclassify it as an external contribution or withdrawal.

**D11. PPF needs a source for each contribution and withdrawal**: tracked Cash
(internal) or outside (external). Schema 17 adds an optional `fundingSource`
on PPF contribution and withdrawal entries. Legacy entries start unknown and
block until classified. They are never auto-classified on migration.

### Cross-cutting

**D12. Migration, backup and invalidation.**
- Schema 16 → 17 adds empty `distributions`, `distributionConfirmations` and
  `measurementBasis` collections, plus the optional PPF field. No existing record
  changes and nothing is auto-confirmed.
- Backup and restore include the new collections, with validation. Restoring an
  older backup yields an unconfirmed state.
- Any edit inside a confirmed period clears the affected confirmation. Results
  are always derived; nothing about XIRR is stored.

## What this enables, in order

| Batch | Scope | Schema |
| --- | --- | --- |
| 1 | Pure per-asset and Investments input builders (D4–D8). Every dividend-capable asset is unavailable until batch 2 | None |
| 2 | Distributions and no-distribution confirmations: records, entry UI, backup (D1–D3, D12) | 17 |
| 3 | Measurement basis and PPF funding source; whole-portfolio builder (D9–D11) | 17 (same release as batch 2, or 18) |
| #534 | Solver with oracle fixtures, after batch 1 | None |
| #535 | Presentation in holding detail and a compact Dashboard selector | None |

Batch 1 can start once D4–D8 are approved. Batches 2 and 3 are critical changes
(persistence and migration). Each needs failure-path tests, an adversarial diff
review and full verification.

## Unavailable reasons (user-facing, one line each)

| Reason | Shown as |
| --- | --- |
| Distributions not recorded | "Dividends or payouts aren't recorded for this period." |
| Opening history unknown | "Purchase dates before [date] aren't recorded." |
| Transfer without value | "A transfer in needs its value on the transfer date." |
| Demerger crossing | "Measured together with [child] after the demerger." |
| Stale terminal quote | "Price is older than 7 days." |
| Unlinked trade (whole-portfolio) | "Link this trade to Cash or mark its funding as external." |
| PPF funding unknown | "Say whether this PPF deposit came from Cash." |
| No measurement basis | "Set a start date and opening value to measure the whole portfolio." |
| No sign change / no unique rate | "A return can't be calculated from these flows." (from #534) |

## Not in scope

No benchmarks, time-weighted return, forecasts, recommendations, tax
treatment, new import adapters or backend. No averaging of per-asset rates into
a portfolio rate.

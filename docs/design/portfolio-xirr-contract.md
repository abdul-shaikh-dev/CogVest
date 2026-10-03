# XIRR boundaries and whole-portfolio readiness audit

3 October 2026. Related to #532 and #533. This is the first input-audit batch,
not a finished XIRR feature. No portfolio records, schema, dependencies or UI
change. The solver and display remain separate work.

## Boundary

The owner subsequently requested Investments XIRR, Whole-portfolio XIRR and
per-asset XIRR. They are separate measures, not fallback names for one calculation.
This batch's code audits only the whole-portfolio history boundary described
below. It does not yet implement the investments-only adapter.

Investments XIRR excludes tracked Cash and counts movements crossing its declared
investment boundary. Purchases paid from excluded Cash and redemptions returned
to that Cash can therefore be flows for Investments XIRR while remaining internal
for Whole-portfolio XIRR. Transfers between included investments must not create
two external flows. Asset/account inclusion, distributions, fees, in-kind
transfers, PPF and Futures handling need an explicit boundary matrix before this
adapter is eligible. Do not substitute Futures notional for net account value or
pretend idle Futures wallet cash is excluded if the whole wallet is valued.

Each measure has independent completeness, start/end dates and terminal-value
coverage. Imported trades may support more of the investment boundary, but
successful import alone does not prove distributions, transfer values or fees
are complete. Neither metric may use the other's eligibility as a shortcut.

Per-asset XIRR uses that asset's purchase/redemption/distribution flows and end
value, including fully sold assets where valid historical proceeds remain.
Fees and income need asset attribution. Do not count asset transfers as purchases
at acquisition cost; in-kind boundary events require dated fair-value evidence.
Splits/bonuses create no cash flow. Demergers require an explicit constituent
boundary/value treatment, not a synthetic cash payout at the allocated tax cost.
Cash is not offered as an ordinary security return. PPF account and Futures
contract/account support must be classified explicitly rather than treating
leverage/notional as an invested asset. The current preflight implements none of
these per-asset series. Portfolio XIRR must use the combined portfolio flow series,
never an arithmetic or value-weighted average of per-asset XIRRs.

The requested measure covers tracked market assets, tracked Cash, PPF and
Futures net account equity, including liabilities. The flow boundary must match
the terminal valuation boundary. Excluding an unsupported account cannot produce
a result labelled whole-portfolio XIRR. Closed investments remain relevant to
cash-flow history even though they no longer appear in Holdings.

Contributions crossing this boundary are negative from the investor's perspective;
withdrawals are positive. The final net valuation is a derived final flow, never
a transaction written to Cash. Internal movements must not enter the external
flow series. Existing monthly-performance classification is not a substitute:
its historical boundary explicitly excludes Futures.

## Evidence from the current model

| Record or path | What is known | What is not established |
| --- | --- | --- |
| `CashEntry` | Purpose, date, amount, optional trade/Futures link | Completeness of cash history or omitted broker cash/dividend records |
| Linked manual purchase/sale in `src/store/index.ts` | Atomic Cash leg equals trade total; buy includes fee, sale deducts fee | Whether the starting whole-portfolio cash history is complete |
| Tradebook/CAS imports | Executions, identity and optional fee/tax provenance | External funding dates, retained broker cash, complete distributions; import deliberately leaves Cash unchanged |
| `OpeningPosition` | Aggregate units and average cost, possible purchase/cutover date | Actual dated contributions or market value of the entire portfolio at an agreed start |
| PPF account and ledger | Confirmed balance/date, contributions, interest, withdrawals, reconciliations | Whether each contribution/withdrawal crosses the whole-portfolio boundary or comes from/goes to tracked Cash |
| Futures account | USDT events, internal/external transfer classification, Cash links, historical rates and reconciliation evidence | Lifetime funding before opening wallet cutover; consistent whole-portfolio starting evidence |
| Current Holdings and quotes | INR valuation, manual/fetched/pending status and provenance | A synchronized historical valuation of every account at an arbitrary chosen date |
| Monthly snapshots | Stored aggregate values and quality metadata | A complete external-flow ledger or independently verified lifetime funding |

Ordinary market records currently support INR only. Futures explicitly uses USDT
with INR rate evidence. USD, USDT and INR are not interchangeable.

## Event treatment for the eventual input builder

| Event | Treatment | Required evidence / failure policy |
| --- | --- | --- |
| Explicit contribution / withdrawal | Negative / positive external flow | Valid date and amount; no contradictory internal link; complete-history basis still required |
| Cash-funded purchase | Internal; no extra contribution | Exactly one matching Cash withdrawal and trade, same date/currency/total |
| Sale retained in tracked Cash | Internal; withdrawal occurs only when money actually exits | Matching net sale proceeds; do not also add gross sale or fees |
| Imported or unlinked buy/sell | Unresolved boundary, not automatically external | Reconciled cash evidence or a separately approved restricted measurement scope |
| Dividend/distribution | Retained cash or reinvestment is internal income; payout outside is an external positive flow | Recipient/boundary and date; no dedicated complete distribution history exists now |
| Fees, taxes, PPF interest, Futures funding/realised P&L | Affect account value, not contributions merely because balances change | Establish whether already included in recorded net movements; never deduct twice; externally paid charges need an explicit reviewed treatment |
| Split, bonus, demerger | No external cash flow | Preserve units/cost/identity handling; fractional cash payouts need separate actual evidence |
| Asset transfer | Internal only when both sides are in scope | Outside-boundary in-kind flows need transfer-date fair value, not acquisition cost; unknown boundary/value blocks |
| Cash/PPF transfer | Internal if both sides are tracked | No PPF-to-Cash linkage currently exists; do not assume all PPF entries are external |
| Cash/Futures transfer | Internal; conversion fee reduces net wealth once | Validate both links and actual INR Cash leg; monthly Progress treats this differently |
| External Futures transfer | External at dated INR equivalent, sign opposite the wallet movement | Explicit boundary, event rate and fee treatment; never today's FX |
| Aggregate opening / reconciliation | Not a synthetic contribution | Lifetime history unresolved; bounded-period basis needs verified opening net market value and later complete flows |
| Terminal value | One final signed net valuation at the end date | Include Cash, market holdings, confirmed PPF and Futures equity, not notional or equity plus collateral |

Date-only inputs use their recorded calendar dates, not conversion to device-local
midnight. The effective reporting date for exact Futures timestamps and transfer
settlement evidence must be settled in the final builder. No current audit output
converts Futures timestamps or proposes a historical FX rate.

Missing quotes/FX cannot mean zero. A later valuation adapter must expose the
individual observation dates, manual/fetched provenance and stale/missing status.
A portfolio observed on different dates must not silently present a synchronized
valuation. The freshness/as-of policy needs review before a ready input exists.

## Read-only implementation in this batch

`src/domain/portfolioXirrHistory.ts` audits existing records. It lists dated,
explicit INR Cash contributions/withdrawals with source IDs and identifies
consistent internal trade pairs. Invalid/duplicate IDs, malformed dates/amounts,
unmatched Cash legs, unlinked trades, foreign records, aggregate openings and
PPF/Futures gaps are explicit. Future Cash/trade/PPF events are not included in
the selected as-of audit. Account/opening history is conservatively flagged
without inferring a start date from its aggregate metadata.

This is a preflight, **not the solver input builder**. Its status is always
`needs-evidence`, including for a synthetically perfect Cash/trade ledger.
Schema 15 has no whole-portfolio completeness basis, and the audit cannot prove
the absence of omitted activity. `recordedExternalCashFlows` are facts from
recorded Cash entries only, not an eligible XIRR series. No terminal value is
manufactured. The audit is not wired into a production screen.

The audit assumes existing typed record structures, not arbitrary backup JSON;
backup validation remains the ingestion boundary. It does not replace financial
validation, reconcile all PPF/Futures events, assess price coverage, deduplicate
distinct records by economic meaning or prove opening/closing balances. Duplicate
IDs are withheld, not repaired. Reimport safeguards remain with the importer.

## Remaining decision and implementation

The user's tradebooks plus detailed CAS statements can reconstruct holdings but
do not by themselves establish cash-inclusive whole-portfolio XIRR. Do not ask
the user to repeatedly reimport those files to fill information they do not contain.

The owner confirmed whole-portfolio XIRR with additional missing cash-history
evidence, then expanded the request to include Investments XIRR as well.
The next design is a measurement-basis workflow using existing records
where possible: an explicitly verified start date and whole-portfolio opening
market value, complete subsequent boundary flows and reconciled end value.
It must distinguish a bounded-period result from lifetime XIRR. A completeness
checkbox alone cannot repair unlinked imports or missing income/FX evidence.
Historical flow entry/linkage and stored provenance need a scoped schema/UI
implementation with backup/restore and failure-path verification. The owner has
authorized adding the missing evidence, but this audit batch does not implement
that workflow or settle its persisted representation.

Do not silently fall back to Investments XIRR when Whole-portfolio XIRR is
unavailable. Present each as its own result with the included accounts/assets.

#533 remains open for review of this contract, the approved evidence workflow,
full input construction and terminal-value reconciliation. #534 and #535 must
not consume this preflight as a complete input. No new import adapter is requested.

### Required evidence-workflow design

- Choose lifetime only with a verified zero/inception boundary. Otherwise record
  a verified opening net market value and date, with an explicitly bounded period.
  Flow timing on the start date must state whether it is already in that value.
- Capture all in-scope accounts, including retired accounts with activity in the
  measured period. A zero present balance does not justify discarding their flows.
- Record missing actual external flows with dates, INR amounts/native FX evidence
  and provenance. Link to existing Cash/Futures records instead of duplicating them.
  Edits/deletions must invalidate affected confirmations and derived results.
- Reconcile retained broker cash against tracked Cash. Recording historical
  contributions without the corresponding internal movements must not inflate
  today's Cash balance. An XIRR-only audit record must never silently mutate Cash.
- Link PPF/Cash movements and verify both legs of Futures transfers. Explicitly
  identify externally paid/received flows, distributions and fees and check that
  their net effect is not already counted in portfolio value or another event.
- Confirm opening/end coverage, dates and income completeness using reviewed
  account evidence. A confirmation does not override arithmetic mismatches,
  unsupported currency, missing dates, invalid links or missing terminal values.
- Preserve evidence through versioned backup/restore. Legacy portfolios start
  unconfirmed; never auto-attest old data during migration. No raw statement
  attachment retention or secret storage is needed by this proposal.

## Verification

Synthetic unit tests cover one deposit plus linked buy/sell and withdrawal,
import-only records, link/amount/date/direction mismatches, duplicated IDs,
ambiguous Cash, future records, foreign/missing assets, opening/PPF/Futures gaps,
decimal sign handling and input immutability. This batch has no installed-app or
visual verification claim because it adds no UI or native integration.

`npm run test:verify` passed: typecheck, 192 suites / 2,043 tests, Expo Doctor
17/17. One suite and three tests remain skipped. The focused audit suite has
18 passing cases. The first sandboxed Jest attempt could not access its temporary
cache; the authorized retry passed. No APK, cloud build or release was created.

The numerical reference for the later solver is
[Microsoft XIRR](https://support.microsoft.com/en-us/excel/functions/xirr-function).
That formula does not determine whether CogVest's recorded history is complete.

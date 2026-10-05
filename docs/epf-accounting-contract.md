# EPF accounting contract

Issue #543, parent #542. This is a pure domain contract, not a persistence or
screen rollout. Existing PPF behavior is unchanged.

## Value and evidence

EPF is a dedicated INR account. Employee EPF and employer EPF component balances
make up its confirmed value. Voluntary employee contributions belong to the
employee component. EPS and EDLI are not valued accounts here; strict schemas
reject these fields/events rather than adding them to wealth.

Each account has a dated confirmed checkpoint and provenance. A complete
component breakdown must add exactly to the total. A legacy total-only balance
uses null components, never an invented ratio. Aggregate-only events retain
the total and make components unknown until a new evidenced reconciliation.

Capital is independently evidenced remaining contributed capital, not tax cost
basis. Null means unknown. A statement balance can contain years of interest and
does not establish lifetime capital. No contribution history is invented from
salary, statutory percentages, an opening value or a pension contribution.

Account status never removes money: inactive, transferred or closed records with
a nonzero balance remain valued. Currency, dates, finite exact-paise amounts,
component sums and references are validated before replay. Aggregate values are
bounded to safely representable paise. No rates or maturity rules are inherited
from PPF.

## Event effects

| Event | Confirmed value | Capital | Coverage and cash |
| --- | --- | --- | --- |
| Employee/employer contribution | Add actual contribution to its component | Add contribution only if prior capital is known | No automatic payroll or Cash entry |
| Official credited interest | Add evidenced credit | Unchanged | A return, not contribution; checkpoint interest is already included |
| Withdrawal | Subtract evidenced amount | Subtract evidenced capital reduction; otherwise unknown | Destination external or unknown; no automatic Cash credit |
| Transfer from untracked EPF | Add evidenced amount | Add evidenced transferred capital only if both bases are known | Origin-history limitation remains explicit |
| Matched tracked transfer | Debit source, credit destination | Move evidenced capital, never create it | One record owns both legs; no Cash write |
| Reconciliation | Replace with absolute confirmed value | Explicit evidenced capital or unknown | Reason required; difference is not classified as gain or deposit |
| Provider reversal | Inverse of referenced contribution, interest or withdrawal | Inverse of its known capital effect; unknown stays unknown | Explicit reason and original event required; return-flow review |

Known capital that would become negative is rejected, not floored. If the capital
split of a withdrawal or transfer is unavailable, the caller must use unknown.
Interest is never assigned a contribution-capital amount. Partial source capital
cannot turn into known destination capital through a transfer.

## Transfers and checkpoints

One transfer ID owns both accounts, amount and capital attribution. Requested
transfers have no financial effect. An evidenced debit creates an explicit
in-transit amount until the evidenced credit date. Total EPF includes this amount
once, separately from destination balance. The in-transit coverage reason must
be displayed by future reporting; it is not confirmed destination money.

Completed transfers with different debit/credit dates are replayed in two dated
steps. Same-day steps use recorded timestamp, event ID and debit-before-credit
as deterministic tie breakers. No independently editable counterpart entries
exist. Date ordering is calendar-day based; timestamps are provenance/tie breakers,
not value dates.

Both account checkpoints must precede the debit. A transfer that overlaps a
destination checkpoint is rejected because that checkpoint may already contain
the money. Resolve evidence/checkpoints explicitly; do not silently add it again.
Changes of source or destination checkpoint must replay the entire ledger.

Put replaces an event by its stable ID; an identical retry cannot duplicate it.
Remove deletes the whole event including both transfer legs. Full replay rejects
changes that invalidate later withdrawals, capital or components. Inputs remain
unchanged on success and failure. Correcting an erroneous entry means replacing
or removing the original event, not posting a guessed compensating deposit.
An actual provider reversal references its original contribution, interest or
withdrawal and has its own effective date and evidence. Duplicate reversals,
cross-account targets and reversals ordered before the original are rejected.
A returned inter-account transfer is a new evidenced transfer in the opposite
direction, not a reversal of one leg. An unexplained adjustment uses
reconciliation with return limitation.
Persistence #544 must retain an audit record of edits/removals and apply the
validated candidate atomically. This helper does not write or retain audit history.

## Historical value and return coverage

Effective date is evidenced separately from posting date, recording timestamp
and optional wage month. Wage month never supplies a missing credit date.
Replaying currently available evidence at a past date is a restated view, not
a reconstruction of what the user knew on that date. Delayed official interest
can affect its evidenced effective period; posting date alone is not proof of
an earlier effective date. Rebuilding saved snapshots is outside this issue.

Before an account checkpoint, its historical value is unavailable, not zero.
The result's total and capital are null if any account lacks that checkpoint;
coveredTotal reports only the evidenced subset. Account amounts after a
checkpoint are last-recorded values. historyComplete is false unless the user
has confirmed subsequent coverage through the requested date, or the date is
the checkpoint itself. Never label an incomplete carried value a confirmed
month-end balance. Component, capital and history uncertainty are separate.

coverageReasons describes pre-checkpoint data, incomplete history, unknown
capital/components, reconciliation, untracked origin, unknown withdrawal
destination and in-transit transfers. It is not an XIRR eligibility verdict:
known remaining capital does not establish dated lifetime contribution flows.
Likewise unknown lifetime capital need not block a future bounded-period return
using an evidenced opening value and complete subsequent flows.

## XIRR event map for #533

| Event | Per-account | Investments / Whole-portfolio |
| --- | --- | --- |
| Checkpoint | Possible bounded-period opening valuation, not lifetime deposit | Same; all included accounts need consistent opening evidence |
| Employee payroll contribution | Inflow to account | External inflow unless paired funding evidence places source inside the measured boundary |
| Employer EPF contribution | Inflow, never earned return | External contribution, never market gain |
| Interest | Internal earnings | Internal earnings |
| Tracked EPF transfer | Source outflow and destination inflow at evidenced dates | Internal when both sides belong to the boundary; transit must reconcile |
| Untracked-origin transfer | Account inflow with unknown prior history | Boundary/origin evidence needed; cannot assume complete lifetime flow |
| Withdrawal | Account outflow | External only if outside boundary; unknown destination blocks classification |
| Reconciliation | Unclassified correction | Unclassified correction; never synthesize a return flow |
| Provider reversal | Review inverse original flow at evidenced date | Review original event boundary; not automatically a new contribution |

Investor-sign convention is negative for contributions and positive for
withdrawals. No solver or production XIRR input builder is implemented here.
Tracked Cash linkage is deliberately not accepted as a bare string: #544/#533
must validate both records and their values before treating such a withdrawal
as an internal transfer. Until then record destination as unknown rather than
claiming cash linkage from unverified evidence.

## Verification boundary

Pure domain tests cover numeric examples, uncertainty, paise arithmetic, date
semantics, transfer retries/edits/deletions and invalid inputs. No screen,
persistence migration, backup format, APK or release changes are part of #543.
Those are #544 through #547. Do not close #542 from this domain-only change.

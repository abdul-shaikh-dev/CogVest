# Holding Duration Contract And Verification (#20)

## Reference And Boundaries

Jurisdiction: **India**. Rules reviewed **8 September 2026**.

Authoritative source: [Income Tax Department, Sale of Shares](https://www.incometaxindia.gov.in/en/sale-of-shares),
holding-period table and period-of-holding guidance. The reference for listed
securities is more than twelve months. The guidance also describes exceptions
and FIFO for dematerialised securities; this feature does not implement those
tax determinations. Fund treatment cannot safely be inferred from an ETF name.

`INDIA_HOLDING_DURATION_RULE` isolates the URL, review date, jurisdiction and
calendar-month threshold. Exactly the calendar anniversary is still within the
reference; the following date is beyond it. Leap-day anniversaries clamp to the
last day of February. These are date-display conventions for recorded history,
not a determination of the taxable holding period on a proposed sale.

## Supported Record Contract

- Explicit stock instrument and stock class, INR currency, NSE/BSE listing.
- Exactly one known dated acquisition: a buy or a non-aggregate opening position.
- Multiple acquisitions, aggregate opening balances (`measuredAsOf`), sales,
  transfers, missing/invalid dates and unknown instruments return unavailable.
- ETFs return unavailable because the current asset schema cannot distinguish
  the fund tax classifications and exceptions reliably. Adding inferred fund
  eligibility, or a user checkbox as proof, is deliberately avoided.
- Future records do not change today's observation. Corrected records recalculate
  immediately; removed holdings disappear from the view.
- No money, tax rate, tax liability, exemption or selling recommendation is shown.

## Legacy Audit

`Holding.heldDays`, `daysToLtcg`, and `ltcgEligible` were unused optional
declarations, not calculated values. They are removed with a compile-time
regression guard. Holdings are derived, not persisted; no migration is needed.
The existing persisted `Asset.isTaxEligible` field remains compatible with old
data but is never consumed by this feature. It is not proof of tax eligibility.

## UI Contract

Holdings > Portfolio insights > Holding duration opens a read-only screen.
No tax badges appear on Dashboard or holding rows. Masking hides asset names and
dates; Minimal Mode suppresses analysis. Back/Done return to the caller, or
Holdings for a direct launch without history. Official guidance opens only on an
explicit tap; browser failure is handled visibly.

## Verification

Domain tests cover exact anniversaries, leap years, unknown/future dates,
unsupported instruments, legacy fields and multi-lot/transfer ambiguity.
Component tests cover corrected dates, deletions, masking, Minimal Mode, unknown
ETF classification, exits and external-link failure.

- `npm run test:verify`: passed.
- `npm run test:v1:pc`: passed, 103 suites / 1,061 tests, Expo Doctor 17/17,
  Android readiness and strict package checks passed.
- Local `assembleDebug` x86_64 build/install succeeded. The known prebuild
  template-discovery delay was avoided using the existing native project; no
  native configuration or dependency changed.
- Maestro `holding-duration.yaml` passed on disposable `emulator-5556` with the
  current branch served by Metro. It verifies the Holdings entry, HDFC's recorded
  acquisition date, unavailable Nifty ETF classification, masking, Back and
  Minimal Mode. The original emulator and its data were untouched.
- Actual Android screenshot inspected against DESIGN.md. The correction pass
  shortened repeated disclaimers while retaining source/date/limits. Impeccable
  detector returned no findings; native screenshot inspection supplies the
  visual evidence, not that detector result. No independent subagent was used.
- Local evidence: `.expo/issue20-duration-final.png`, `.expo/issue20-maestro/`.
  Debug functional/visual verification only; release-mode performance, large
  font layouts and physical-phone behavior are not claimed. No EAS build ran.
- Some post-refresh/transition captures showed missing header text or a partially
  resized app surface; a subsequent capture contained the complete header and
  content. Treat this as a residual emulator rendering limitation, consistent
  with parked #299 but not independently attributed here. No claim of flawless
  repaint/animation behavior is made, and #299 was not reopened by this task.

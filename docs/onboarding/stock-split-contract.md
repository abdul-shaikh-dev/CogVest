# Stock splits: implementation contract (#333)

Status: bounded implementation in PR #340, 2026-09-11; #333 remains partial.
Parent: #338. Historical identity guard: #332. Bonus credits: #334.
Demergers: #335. Private broker reconciliation: #337.

## Approved behavior

Verified events apply automatically, with a summary of changes rather than a
confirmation for every event. Ambiguous events remain unresolved. This decision
does not authorize guessing event ratios, inferring events from price drops, or
treating a Yahoo listing match as proof of historical identity continuity.

Import still has its existing final batch confirmation. Automatic event planning
must not write holdings while the user is only previewing files. Commit source
transactions and applicable events atomically after that confirmation.

## Evidence and coverage

Use issuer or exchange announcements to establish event type, old/new identity,
ratio and effective ex-date. Record the record date separately; it is not a
substitute for the ex-date. A proposed announcement is not proof that the event
took effect. Keep source URL, publication date, verification date and a stable
event identity with the normalized event.

The first implementation uses a reviewed, versioned catalog of verified
events bundled with the app. This is bounded coverage, not an automatic feed of
every listed company's actions. No new paid provider, backend, credentials or
runtime scraping service is authorized by this contract. Provider action data
can identify a discrepancy, but cannot promote an unverified event into the
catalog. Unknown coverage must not be represented as a complete event history.

Source research:

- [Zerodha's Tradebook documentation](https://support.zerodha.com/category/console/reports/other-queries/articles/where-can-i-see-all-the-trades-i-ve-taken-for-a-particular-period)
  says corporate-action transactions are in the external tradebook. Ordinary
  execution CSVs alone therefore cannot establish complete event coverage.
- [Easy Trip's November 2022 announcement](https://www.easemytrip.com/investor-pdf/2022/Intimation-of-Record-Date-22-11-2022.pdf)
  describes a two-for-one subdivision and a separate three-for-one bonus, with a
  November 22 record date. This document alone does not establish the ex-date or
  completed identity transition. Do not encode the combined change as one split.
- [NSE's HDFC Bank 2019 circular](https://archives.nseindia.com/content/circulars/FAOP42168.pdf)
  explicitly distinguishes the September 19 ex-date from the September 20 record
  date and describes a two-for-one subdivision. Its derivatives adjustments are
  not a specification for CogVest's equity accounting. This is not evidence for
  later HDFC Bank events in the owner's portfolio.

No production event is approved merely by appearing in this research list.
Before catalog inclusion, verify final event evidence, exact old/new ISINs and
whether another event affects the same date or identity chain.

## Accounting and identity

Persist a distinct corporate-action record, not a zero-cost purchase, transfer,
or edited execution. Keep original CSV identifiers and transaction quantities.
An event contains kind, effective calendar date, old/new identity, positive
integer new/old share ratio, stable event ID and evidence revision. Do not
silently revise a previously applied event when a catalog revision disagrees.

Replay the event on its effective date before that day's executions. Apply it
only to ownership already established before the event. Measured opening
balances on or after the event are already in their measured units and must not
be split again. An acquisition date on a current opening balance is not enough
to infer its historical units; unresolved measurement dates block adjustment.

For quantity Q and remaining cost C, a new/old ratio N/D yields Q*N/D and the
same C. Average cost becomes C/(Q*N/D). Cash, monthly investment and realized
profit do not change merely because of a split. Preserve original acquisition
dates for holding-duration displays. Later disposals use the adjusted moving-
average basis; CogVest still does not claim FIFO tax accounting.

Support reverse splits only when the entitlement is exact whole shares under
the verified event. Fractional entitlements remain blocked in this first slice;
never round them away or invent cash-in-lieu. Combined split/bonus events remain
blocked until #334 supplies the other leg. Multiple same-day events require an
explicit verified ordering, not alphabetical or input-file order.

Resolve historical identities only through a complete verified event chain.
The #332 guard remains in place for unproven chains, even when current quote
selection is identical. Deduplicate by stable event identity across files,
reimport, restart and catalog refresh; changed event terms require reconciliation.

## History and price units

One effective-date replay must feed current holdings, disposal validation,
sale gains, import reconciliation, asset history and monthly snapshots. A split
is multiplicative: existing additive quantity sums cannot safely incorporate it.

Prices must declare their unit basis. Multiply historical quantities only by
prices in the corresponding historical units. Do not multiply historical units
by a present-unit split-adjusted close. Converting adjusted data back requires a
complete verified adjustment chain through the provider's adjustment horizon,
including events after the requested chart end date. Dividend-adjusted values
must not be used as historical cash-market closes.

Until that price contract is proven, affected history stays unavailable rather
than rendering fabricated performance. The month-end provider now requests
split evidence through the retrieval date and rejects cross-split prices,
including events after the requested month. Known pre-event cached prices are
also excluded from snapshot valuation.
Invalidate incompatible cached historical prices. Recompute affected automatic
snapshots when sound evidence exists, or mark them for reconciliation. Preserve
manually confirmed snapshots and disclose discrepancies without overwriting them.

## Implementation sequence

1. Add event types, strict validation and shared chronological replay. Cover
   split arithmetic, before/on/after-date ordering, opening cutovers, reverse
   splits, fractions, conflicting evidence and duplicate IDs with pure tests.
2. Add persisted event storage and atomic command validation. Wire hydration,
   deletion/correction integrity, backup/restore and stale-command failure tests.
   Old portfolios without events remain readable. Never discard unknown event
   data on restore or claim an older binary can safely read the new schema.
3. Verify and add bounded catalog entries; integrate import planning, identity
   chains and the automatic adjustment summary. Revalidate inside the commit
   command. No partial import or row deletion to bypass missing evidence.
4. Replace affected additive quantity paths and integrate price-basis/cache and
   snapshot reconciliation. Do not ship current quantity changes while history
   and disposal validation still use pre-split quantities.
5. Run full checks and independent financial-integrity review, then build and
   install a fresh standalone APK. Exercise import, restart, sale and restore
   with synthetic data; compare the authorized private broker baseline locally.

Known owners from the current source inspection:

- `src/domain/calculations/holdings.ts`, `transactionReconciliation.ts` and
  `transactionSemantics.ts`: accounting and execution ordering.
- `src/store/index.ts`, `persistedPortfolioSchema.ts`,
  `src/domain/portfolioBackup.ts`: state, sequence validation and recoverability.
- `src/features/transactionImport/`: matching, planning and preview.
- `src/domain/validators/trade.ts`, `src/features/assets/ManageAssetsScreen.tsx`
  and `src/features/progress/useProgress.ts`: additional quantity consumers.
- `src/domain/calculations/assetHistory.ts`, `monthEndSnapshots.ts`,
  `src/services/quotes/assetHistoryProvider.ts` and `historicalPrices.ts`:
  timeline valuation and historical provider conventions.

## Acceptance evidence

- Ten shares at INR 100 become twenty at INR 50 after a two-for-one split;
  invested basis remains INR 1,000. A sale of five at INR 60 afterwards realizes
  INR 50 before fees and leaves fifteen shares with INR 750 remaining basis.
- Buying on the ex-date is not split again. A measured post-event opening is
  unchanged. Pre-event sale quantities remain pre-event units.
- Repeat import, file reorder, restart and restore do not reapply an event.
  Failure, conflicting terms and fractional entitlement leave state unchanged.
- At an unchanged economic valuation, pre-event 10*100 and post-event 20*50
  agree; an adjusted pre-event close of 50 cannot produce an erroneous 10*50.
- Split events add no cash flow or monthly investment. Confirmed manual
  snapshots survive recalculation; uncertain price coverage is explicit.
- Final verification includes `npm run test:verify`, `npm run test:v1:pc`,
  synthetic standalone-APK E2E and a private discrepancy report. The broker
  screenshots are a point-in-time baseline, not a fixed live-price test oracle.

## Delivered slice and remaining gates

PR #340 adds shared effective-date quantity/cost replay, strict persisted event
validation (schema 10), import planning/commit, disposal validation, quantity
consumers, backup/restore, restart safety and automatic-snapshot invalidation.
Legacy schema-9 backups remain readable; older binaries must not read schema 10.
Manual snapshots are preserved. Attaching an event revisits older generated
history, not only the incoming transaction month. No event is a cash flow.

The only production catalog entry is IRCTC's five-for-one split on 2021-10-28:
INE335Y01012 to INE335Y01020. Evidence is NSE/CML/49897, dated 2021-10-11,
[mirrored by Steel City](https://www.steelcitynettrade.com/Circulars/Face%20Value%20Split%20%E2%80%93%20IRCTC.pdf).
This is a mirror of an exchange circular, not an NSE-hosted URL. The ex-date
and subdivision are independently corroborated by the
[MSE corporate-action record](https://www.msei.in/corporates/corporate-securities-information/corporate-update/default?symbol=IRCTC&type=4&vmode=vm).
Issuer filings establish the
[old ISIN](https://www.irctc.com/assets/images/CG%2030.09.2021.pdf) and
[new ISIN](https://www.irctc.com/assets/images/Annual%20Return%202023-24_7.29.24.pdf).

Verification: `npm run test:v1:pc` passes: 146 suites / 1,441 tests passed,
one suite / two tests skipped; typecheck passes and Expo Doctor passes 17/17.
Independent financial-integrity review found no remaining findings after
correction of event-shape, source-identity and older-snapshot invalidation gaps.

Fresh standalone release APK installed and verified with
`e2e/standalone/zerodha-stock-split.yaml`: synthetic purchase of 10 at INR 100,
five-for-one split, sale of 5 at INR 60; preview and restarted saved holding
show 45 units, INR 20 average cost and INR 900 invested. Screenshots were
inspected locally. This does not establish live-quote availability. Emulator:
Pixel_10_Pro, API 36, x86_64, 1280x2856, density 480, font scale 1.0; no Metro.
APK SHA-256: `7CFF637633D6D007603980619AC6F62BFA2CB09E083F097AA647AAC32BCCE1FE`.
Local evidence: `.expo/issue333-final-pc.log`,
`.expo/issue333-final-build.log`, `.expo/issue333-final-maestro.log`,
`.expo/issue333-position-restart.png`. These local artifacts are not committed.

Remaining: authorized private broker reconciliation (#337), additional verified
catalog coverage, and reconstructed cross-split historical prices. Current
history guards intentionally show unavailable data rather than wrong valuations.
Long historical lookups now cover the adjustment horizon and may fetch more
data; no throughput improvement is claimed. Native sale/restore journeys still
need dedicated evidence; their accounting and persistence paths have unit tests.
Easy Trip's combined split/bonus chain (#332/#334) and demergers (#335) are not
fixed by this slice. Do not close #333 or #332 on this bounded implementation.

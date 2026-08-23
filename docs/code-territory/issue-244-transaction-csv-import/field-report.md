# Field Report: Issue #244 Transaction CSV Import

## Completion

Complete. Pull request: https://github.com/abdul-shaikh-dev/CogVest/pull/255

Initial implementation commit: `02fd97e` (`Implement transaction CSV reconciliation import`).

## Outcome

CogVest can import the constrained V1 transaction CSV contract through a local,
review-first workflow. Users can choose supplemental or full-history mode,
resolve assets, inspect normalized records and conflicts, and confirm one atomic
batch. Full-history mode replaces an aggregate opening baseline only after exact
quantity and cost-basis reconciliation.

The import preserves native currency and source provenance, rejects duplicate or
ambiguous identities, blocks unknown-cost transfer-ins, leaves Cash Ledger
entries unchanged, and rebuilds affected automatic monthly snapshots without
double-counting the replaced opening position.

## Owned Delta

- Added the versioned CSV template, user guide, parser, normalized fingerprints,
  import planner, reconciliation rules, and failure diagnostics.
- Added discriminated buy, sell, transfer-in, and transfer-out records, opening
  baseline measurement dates, asset ISIN support, and persisted schema v9
  migration coverage.
- Added the transaction import route, Android file selection, review and
  confirmation states, Holdings launch action, and stable test identifiers.
- Updated holdings, snapshot, dashboard, progress, sell, and asset-management
  consumers to respect confirmed opening-position cutovers.
- Added domain, store, migration, UI, and installed-app E2E coverage.
- Aligned Expo SDK patch dependencies so Expo Doctor passes.

## Validation

- Focused regression validation: 5 suites, 82 tests passed.
- `npm run test:verify`: 90 suites and 813 tests passed; Expo Doctor passed 17/17.
- `git diff --check`: passed.
- `.\\android\\gradlew.bat -p android app:assembleDebug -PreactNativeArchitectures=x86_64`: passed.
- `npm run android:smoke -- --strict`: passed on `emulator-5554` with
  `com.abdulshaikh.cogvest` freshly installed.
- `npm run maestro:test -- e2e/transactions-csv-import.yaml`: passed. Persisted
  evidence showed 3 imported trades, 4 unchanged cash entries, 3 opening
  positions, and reconciled HDFC quantity 25, invested value ₹36,250.00, and
  current value ₹41,956.25.

## Review Corrections

Adversarial review identified and corrected three consequential defects:

- fingerprints now use normalized transaction values instead of raw CSV text;
- reconciliation and holdings share fee-inclusive acquisition cost semantics;
- cutover changes rebuild both old and new effective snapshot months, and
  monthly performance uses the explicit opening measurement date.

Targeted re-review found no remaining regression in these areas.

## Failures And Environment

- Task-caused: the three review findings above and one obsolete expectation were
  corrected before final verification.
- Environmental: the emulator initially lacked install space. Resetting only
  recompilable ART artifacts recovered space without clearing app data.
- Environmental: the Expo debug warning overlay intercepted one confirmation
  tap. The Maestro flow dismisses that overlay conditionally; production builds
  do not expose it.

## Residual Risk

The emulator journey covers the full-history happy path. Supplemental imports,
conflicts, unsupported events, atomic rollback, and retry behavior are covered
by domain and store tests rather than separate emulator journeys. Broker-specific
formats and corporate-action reconstruction remain explicitly outside issue
#244.

## Recovery

The persisted schema migration preserves legacy trades. Import application uses
a journaled atomic store command with rollback and retry tests. If a release
regression is discovered, revert the pull request; existing user records remain
recoverable through the migration and journal boundaries.

## Durable References

- `docs/code-territory/issue-244-transaction-csv-import/field-brief.md`
- `docs/import/transaction-csv-guide.md`
- `docs/import/templates/cogvest-transactions-v1.csv`

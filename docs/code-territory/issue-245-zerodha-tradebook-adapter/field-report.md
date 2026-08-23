# Field Report: Issue #245 Zerodha Tradebook Adapter

## Completion

Implementation and verification are complete on
`v1/issue-245-zerodha-tradebook-adapter`. Pull request delivery is pending.

## Outcome

CogVest can import the verified current Zerodha Equity Tradebook CSV format
through the existing local, review-first transaction pipeline. Users choose the
source, add up to ten annual files one at a time, remove or reorder files, and
review one atomic batch before saving.

Supported NSE/BSE delivery-equity buys and sells retain execution-level trade
IDs, order IDs, timestamps, source-file position, exchange, segment, symbol,
and adapter version. Overlapping files are idempotent, while partial fills with
different trade IDs remain separate transactions.

Full-history replacement requires explicit confirmation that the selected
history has no external Zerodha activity. The initial user confirmed there are
no IPO/OFS, buyback, transfer, or corporate-action records to reconcile.
Supplemental mode keeps opening positions and does not require that assertion.

## Owned Delta

- Added the exact-header Zerodha Tradebook parser and versioned import-source
  registry while preserving the CogVest CSV source.
- Added ordered multi-file selection, removal, reordering, source switching,
  stale-analysis protection, and bounded parsing.
- Added local source provenance to persisted imported transactions and enforced
  Full-history source coverage in both planning and the atomic store command.
- Corrected deduplication so reliable external IDs take precedence over
  financial fingerprints and distinct executions are not collapsed.
- Added parser, planner, store, schema, UI, and installed-Android E2E coverage,
  plus synthetic Tradebook fixtures containing no private user data.
- Updated onboarding and V1 verification documentation.

## Validation

- Focused importer/schema/route validation: 8 suites and 109 tests passed.
- Post-UI focused validation: 2 suites and 10 tests passed.
- Review-correction validation: 4 suites and 48 tests passed.
- `npm run test:verify`: 91 suites and 834 tests passed; Expo Doctor passed
  17/17 checks.
- Impeccable detector: no findings in `TransactionImportScreen.tsx`.
- `npm run android:apk:emulator`: fresh x86_64 debug APK built successfully.
- `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`: passed on
  `emulator-5554`.
- `npm run android:smoke -- --strict`: passed with
  `com.abdulshaikh.cogvest` installed.
- `npm run maestro:test -- e2e/zerodha-tradebook-import.yaml`: passed. The flow
  selected two overlapping files through Android DocumentsUI, showed 2 new
  transactions and 1 duplicate, replaced the exact HDFC opening position,
  preserved 4 Cash Ledger entries, and verified quantity 25, invested value
  ₹36,250.00, and current value ₹41,956.25. Re-import showed 0 additions and 3
  duplicates with persisted trade counts unchanged.

## Failures And Environment

- Environmental: the sandbox initially blocked the pinned Gradle download.
  The approved local build completed outside that network restriction; no EAS
  build was used.
- Environmental: Maestro needs to write its Windows logs under AppData and must
  run outside the filesystem sandbox.
- Environmental: the debug APK requires Metro. Metro was started in offline CI
  mode with a cleared cache before E2E.
- Environmental: Expo's development warning banner can cover the bottom confirm
  action. The E2E flow dismisses it conditionally; production builds do not show
  that banner.

## Residual Risk

The adapter intentionally supports only the verified current delivery-equity
Tradebook contract. Zerodha external-trades reports, intraday, auction, MTF,
F&O, commodities, currency derivatives, tax lots, and corporate-action
reconstruction remain unsupported and fail closed or stay visible for review.
The external-trades parser remains deferred because no authorized current CSV
schema is available.

## Review Corrections

The independent owned-diff review identified and verified four corrections:

- changing the selected Tradebook files now clears the Full-history external-
  activity confirmation;
- supplemental cutovers compare calendar dates, including Zerodha execution
  timestamps on the cutover day;
- parser rows fail closed when `trade_date` and `order_execution_time` disagree;
- changed execution provenance under an existing trade ID is a conflict, not a
  duplicate.

Persist-reload coverage also verifies that execution provenance survives a
restart and continues to deduplicate the same import batch.

## Recovery

The provenance fields are optional additions to the existing persisted schema,
so legacy imported transactions remain valid. Application uses the existing
journaled atomic command and rollback path. If a release regression is found,
revert the feature pull request; private source files and raw rows are never
committed.

## Durable References

- `docs/code-territory/issue-245-zerodha-tradebook-adapter/field-brief.md`
- `docs/onboarding/transaction-csv-import.md`
- `docs/testing/v1-core-flow-test-matrix.md`
- `e2e/zerodha-tradebook-import.yaml`

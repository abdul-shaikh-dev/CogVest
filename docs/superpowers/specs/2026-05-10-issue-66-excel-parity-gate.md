# Issue 66 Excel Parity Gate Design

## Goal
Make Excel tracker parity an explicit V1 dev-complete gate so future PRs can be evaluated against the real MVP: replacing daily investment tracking in `Portfolio.xlsm` without recreating Excel as a spreadsheet UI.

## Canonical Checklist
Create `docs/testing/excel-parity-checklist.md` as the source of truth for Excel parity verification. It maps workbook capabilities to CogVest features, implementation issues, automated tests, PC-only manual checks, and release-gate evidence.

## Product Principle
CogVest persists user-entered records and derives portfolio views from domain functions.

Persist:
- holdings/opening positions
- transactions
- cash entries
- monthly snapshots
- quote/manual price records

Derive:
- invested value
- current value
- P&L
- P&L %
- allocation
- total investment
- total current value
- monthly progression summaries

## Non-Goals
The checklist must explicitly prevent V1 from becoming a spreadsheet clone:
- no editable grid/table UI
- no formula editor
- no macro support
- no Excel import/export
- no advanced tax calculations
- no Minimal Mode
- no full behaviour insight engine
- no complex historical charting beyond basic monthly progression

## Docs To Update
Link the checklist from:
- `docs/testing/v1-testing-plan.md`
- `docs/testing/v1-core-flow-test-matrix.md`
- `docs/testing/v1-pc-verification-checklist.md`
- `docs/release/v1-release-checklist.md`
- `docs/release/android-release-process.md`
- `docs/roadmap/v1-mvp-spec.md`

## Verification
This is a docs-only issue. Verification is static:
- docs contain the #60 parity questions
- docs map #61-#65 to tests and manual PC verification
- release docs require the Excel parity checklist before V1 dev-complete
- normal repo checks still pass


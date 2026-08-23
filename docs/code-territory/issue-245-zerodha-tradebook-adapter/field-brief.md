# Field Brief: Issue #245 Zerodha Tradebook Adapter

## Objective

Add a versioned, local-only Zerodha Equity Tradebook adapter to the broker-neutral
transaction import and reconciliation pipeline delivered by issue #244. A user
can assemble multiple annual Tradebook CSV files, review normalized delivery
trades, reconcile them against opening positions, and commit one atomic batch.

## Verified Source Contract

Two user-authorized current Equity Tradebook exports establish this exact V1
header contract:

`symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time`

- Dates use ISO `YYYY-MM-DD`; execution timestamps use local ISO
  `YYYY-MM-DDTHH:mm:ss` without a timezone.
- Supported rows use `segment=EQ`, `series=EQ`, `auction=false`, an NSE or BSE
  exchange, a valid ISIN, positive quantity and price, and `buy` or `sell`.
- A trade ID identifies one execution and must remain the external import ID.
  An order ID can legitimately repeat for partial fills and must not deduplicate
  executions.
- The authorized raw exports remain outside the repository. Only synthetic,
  sanitized fixtures may be committed.

Official Zerodha documentation confirms that Tradebook CSV exports are limited
to 365 days and that IPO/OFS, buybacks, transfers, and corporate-action events
live in a separate Equity External Trades report. The initial user confirms no
such external activity. Zerodha does not publish that separate CSV schema.

## Decisions Most Likely To Change

- Keep the existing standardized CogVest CSV source and add a versioned source
  registry rather than embedding Zerodha columns in reconciliation logic.
- Expo SDK 54 cannot select several files in one picker action. Let users add
  files sequentially, then remove and reorder them before one dry run. Do not
  add a document-picker dependency.
- Supplemental Zerodha imports do not require an external-activity assertion.
  Full-history replacement requires explicit confirmation that the covered
  account and date range had no external trades or corporate actions.
- Unknown headers, segments, series, exchanges, auction rows, trade types, and
  malformed values fail closed or remain visible as unsupported. Never coerce
  them into delivery buys or sells.
- Preserve source file, source row, trade ID, order ID, execution timestamp,
  exchange, segment, symbol, and adapter version as local provenance.

## Territory

- Source contract and parser: `src/domain/transactionImportSources.ts`, a new
  Zerodha parser module, and nearby parser tests.
- Candidate and provenance types: `src/domain/transactionCsv.ts`,
  `src/types/trade.ts`, and persisted provenance validation.
- Import planning: `src/features/transactionImport/transactionImport.ts`.
- Controller and UI: `src/features/transactionImport/useTransactionImport.ts`,
  `TransactionImportScreen.tsx`, and `app/import-transactions.tsx`.
- Atomic enforcement: the transaction-import command path in `src/store/`.
- User guidance and verification: onboarding docs, sanitized fixtures, focused
  tests, and one installed-app Maestro journey.
- Worktree baseline: clean `origin/main` at `59332d0`; branch
  `v1/issue-245-zerodha-tradebook-adapter`.

## Route

1. Introduce a small source-adapter contract and source metadata while
   preserving the CogVest CSV parser and existing import behavior.
2. Add exact-header Zerodha format detection and normalization with sanitized
   fixtures for buy, sell, partial fill, duplicate/overlap, unsupported row,
   malformed row, and changed header cases.
3. Preserve execution timestamp ordering and fix deduplication so distinct
   executions with different reliable external IDs are not collapsed by a
   financial fingerprint.
4. Extend the controller to select a source and add, remove, and reorder up to a
   bounded set of single-picked files. Parse the complete ordered batch before
   resolving assets or mutating state.
5. Add the full-history external-activity confirmation and enforce it both in
   planning and the atomic store command.
6. Update the review UI and docs with local-only, annual-file, unsupported-event,
   and source-coverage language.
7. Validate parser, planner, store failure paths, migration compatibility,
   existing CogVest CSV behavior, and installed Android behavior.
8. Run a fresh adversarial owned-diff review before delivery.

## Preserve

- Current CogVest transaction CSV template and E2E behavior.
- Exact reconciliation before opening-position replacement.
- No historical Cash Ledger reconstruction.
- Existing atomic journal, retry, rollback, and snapshot cutover semantics.
- Manual buy/sell behavior and all legacy persisted trade records.
- Native INR valuation for supported Zerodha equity rows.

## Non-Goals

- Zerodha login, Kite Connect, XLSX, contract-note PDF, intraday, MTF, F&O,
  commodities, currency derivatives, corporate-action inference, tax-lot or
  FIFO claims, and arbitrary historical Tradebook layouts.
- Parsing Equity External Trades without an authorized current sample.
- Adding dependencies, cloud upload, analytics, or EAS builds.

## Acceptance And Validation

- Exact supported headers parse; changed or unknown formats fail closed with
  actionable source-specific copy.
- Multiple files can be added, reordered, removed, deduplicated, and reconciled
  as one atomic batch.
- Partial fills sharing an order ID remain separate; repeated trade IDs and
  overlapping files are idempotent.
- Unsupported rows remain visible and block full-history replacement.
- Full-history Zerodha commit is impossible without external-activity coverage
  confirmation; cancellation changes no state.
- No raw financial files, account identifiers, or real portfolio values enter
  repository fixtures, logs, screenshots, or documentation.
- Focused parser/planner/store/UI tests, `npm run test:verify`, a fresh local APK,
  strict Android smoke, and a Maestro flow all pass.

## Delivery

Commit, push, and a focused pull request are authorized by `AGENTS.md`. The pull
request body must include `Closes #245`. Do not merge or trigger EAS.

# Field Brief: Issue #244 Transaction CSV Import

## Decisions most likely to change

- Persist transactions as a discriminated `buy`, `sell`, `transferIn`, or
  `transferOut` union. Existing buy/sell records migrate without value changes.
- Store `OpeningPosition.measuredAsOf` separately from acquisition and record-time
  dates. Never infer it from first-purchase date.
- Use moving weighted-average cost for reconciliation without FIFO or tax claims.
- Historical imports never create or modify Cash Ledger entries.
- Full-history replacement is available only after exact quantity and cost-basis
  reconciliation and explicit confirmation.
- Unknown-cost transfer-ins remain visible in dry run but block every V1 commit;
  CogVest must not display partial cost basis as trustworthy invested value or P&L.

## Objective

Implement the versioned broker-neutral transaction CSV contract from GitHub
issue #244. Parse and normalize local files, resolve assets, detect duplicate or
conflicting identities, preview supplemental or full-history effects, reconcile
against aggregate opening positions, and commit the complete reviewed batch
atomically.

## Territory

- Owning types: `src/types/trade.ts`, `src/types/openingPosition.ts`.
- Owning persistence: `src/store/index.ts`,
  `src/store/persistedPortfolioSchema.ts`.
- Financial calculations: `src/domain/financialRecords.ts`,
  `src/domain/calculations/holdings.ts`,
  `src/domain/calculations/monthEndSnapshots.ts`, and quantity consumers.
- New parser and planner: `src/domain/transactionCsv.ts` and
  `src/features/transactionImport/`.
- New route and launch point: `app/import-transactions.tsx`, route registration,
  and the Holdings add menu.
- Android verification: a deterministic fixture, Maestro flow, and persisted
  evidence assertions.
- Worktree baseline: clean `origin/main` at branch creation; branch
  `v1/issue-244-transaction-csv-import`.

## Route

1. Add schema-v9 compatible transaction provenance, transfer records, and
   opening-position cutover storage with migration tests.
2. Centralize transaction direction, price/basis, and quantity helpers; replace
   buy-versus-everything assumptions while preserving manual buy/sell behavior.
3. Add the versioned ISO-only CSV parser, deterministic identity fingerprints,
   supported/unsupported classification, and focused parser tests.
4. Add asset resolution, supplemental/full-history planning, moving-average
   reconciliation, duplicate/conflict handling, and dry-run tests.
5. Add one journaled atomic store command that persists transactions, confirmed
   cutovers, optional exact opening-position replacement, and affected automatic
   snapshot regeneration without touching cash entries.
6. Add Android file selection, in-place review/correction, explicit confirmation,
   documentation, and stable accessibility/test IDs.
7. Run focused tests, migration and failure-path tests, `npm run test:verify`, a
   fresh local APK install, strict smoke, and representative Maestro E2E.
8. Run a fresh adversarial owned-diff review before delivery.

## Preserve

- Existing persisted buy/sell records and manual Add/Sell behavior.
- Linked cash semantics for manually funded buys and sale proceeds.
- Manual monthly snapshots; only affected automatic snapshots may regenerate.
- Current holdings CSV onboarding and Quick Portfolio Setup behavior.
- Native currency provenance and INR aggregation rules.

## Non-goals and scope gates

- No Zerodha, CAMS/KFintech, Binance, PDF, or arbitrary spreadsheet adapter.
- No corporate-action reconstruction, derivatives, cash-history reconstruction,
  tax advice, FIFO, advanced tax-lot claims, cloud sync, or EAS build.
- No new dependency unless current parser/platform capabilities prove
  insufficient and the user approves expansion.

## Validation

- Focused domain/store tests prove migration, transfer semantics,
  reconciliation, idempotency, conflicts, atomic failure recovery, and unchanged
  Cash Ledger state.
- `npm run test:verify` proves repository typecheck, Jest, and Expo Doctor.
- `npm run test:v1:pc` proves the installed Android baseline when applicable.
- Fresh local APK plus `npm run android:smoke -- --strict` proves the exact build
  is installed.
- `npm run maestro:test -- e2e/transactions-csv-import.yaml` proves real local
  file selection, reviewed import, resulting holdings/transactions, and no cash
  mutation.

## Delivery authorization

Commit, push, and a focused pull request are authorized by `AGENTS.md`.

- Commit convention: concise imperative subject.
- Ticket: `Closes #244` in the pull request body.

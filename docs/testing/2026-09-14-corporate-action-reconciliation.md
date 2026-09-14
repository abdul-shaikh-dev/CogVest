# Corporate-action portfolio reconciliation

## Scope

Issue #337 validates that the combined Zerodha import remains financially coherent
after the bounded split, bonus-share, demerger and historical-identity work. This
is a reconciliation gate, not a new corporate-action engine.

## Private local replay

The six supplied annual Tradebook files were read locally and never committed or
uploaded. One annual file had previously been edited by the owner while working
around an Easy Trip import failure, so this replay cannot prove that the local
files contain every row from the original broker exports.

CogVest's production parser and full-history planner accounted for every row in
the supplied files without unsupported or blocked rows. Every open-position
quantity matched the dated broker baseline exactly. Every invested value matched
within INR 0.10; this bound covers the observed difference between six-decimal
execution prices in the CSV and two-decimal invested values displayed by the
broker. No tolerance was applied to quantity or used to conceal a missing event.

Current value and P&L were not compared because the app and broker evidence did
not share a captured quote timestamp. No private position, account, trade or
portfolio values are reproduced here.

## Public regression evidence

`src/store/__tests__/corporateActionPortfolioImport.test.ts` combines invented
Zerodha-shaped rows for:

- an ordered split and bonus chain;
- standalone bonus shares;
- two demergers with conserved parent/child cost;
- renamed symbols sharing one historical ISIN;
- a fully closed position.

The test requires complete row accounting, exact resulting quantities and costs,
an atomic save, persistence after restart and a duplicate-only reimport.

Existing domain tests separately cover event evidence, ordering, invalid chains,
historical price unit reconciliation and month-end snapshots around corporate
actions.

## Remaining release evidence

- Perform the multi-file import on a fresh `v1.0.7-preview.1` installation, then
  restart and reimport to confirm duplicate-only behavior on the distributed APK.
- Compare current value and P&L only when both apps use the same captured prices
  or timestamp.
- Record whether the owner accepts the edited annual source file as the available
  baseline; otherwise obtain an unedited replacement before claiming complete
  source-history coverage.

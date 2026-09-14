# Corporate-action portfolio reconciliation

## Scope

Issue #337 validates that the combined Zerodha import remains financially coherent
after the bounded split, bonus-share, demerger and historical-identity work. This
is a reconciliation gate, not a new corporate-action engine.

## Private local replay

The six supplied annual Tradebook files were read locally and never committed or
uploaded. The owner confirmed that the successful fresh-device import used the
complete, unedited broker exports with every entry present.

CogVest's production parser and full-history planner accounted for every row in
the supplied files without unsupported or blocked rows. Every open-position
quantity matched the dated broker baseline exactly. Every invested value matched
within INR 0.10; this bound covers the observed difference between six-decimal
execution prices in the CSV and two-decimal invested values displayed by the
broker. No tolerance was applied to quantity or used to conceal a missing event.

Current value and P&L were not compared because the app and broker evidence did
not share a captured quote timestamp. No private position, account, trade or
portfolio values are reproduced here.

## Fresh Android preview evidence

The owner installed `v1.0.7-preview.1` without existing app data and imported all
six complete, unedited annual Tradebooks. The review reported every supplied row
as new, with zero duplicates, conflicts or unsupported events. It disclosed each
catalog-backed split, bonus and demerger before confirmation. The saved Holdings
screen then showed the expected open-position set and broker-aligned invested
costs. Private screenshots remain local and are not reproduced here.

After restarting CogVest, the owner selected the same six files again. The
review classified every supplied row as a duplicate, with no additions,
conflicts, unresolved matches or unsupported events. Final confirmation remained
disabled, so the duplicate-only review could not write another batch.

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

- Compare current value and P&L only when both apps use the same captured prices
  or timestamp.

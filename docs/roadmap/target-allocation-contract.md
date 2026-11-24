# Target Allocation Contract (#764)

An optional target mix for the Dashboard's four allocation classes, compared
with the actual allocation. It is information only. Setting or removing
targets never changes holdings, Cash, snapshots or quotes, and nothing on
screen says what to buy or sell.

## Record

`preferences.allocationTargets` holds `equity`, `debt`, `crypto` and `cash` as
percentages. Each is 0 to 100 with at most one decimal place, and together
they make exactly 100. A mix that does not is not saved. In the editor an empty
field counts as 0%. The field is absent until the user sets targets, and
removing them deletes it. It is an optional preference, so the saved-data
version is unchanged (V20). It travels with backup and restore, and a stored
or backed-up mix that breaks these rules is rejected.

Debt includes PPF and EPF, and Crypto includes Futures wallet equity, as in the
Dashboard allocation.

## Drift

Drift is shown only when the full Dashboard allocation is available: every
holding priced, and Cash and Futures equity at zero or above. Otherwise the
comparison says it needs that. It uses the same INR values as the allocation,
so the allocation's currency exclusions apply.

For each class: the actual share, the target and the gap in percentage points
(actual minus target), written as "N points above", "N points below" or "on
target", so it never relies on colour.

## New money without selling

The smallest portfolio total at which no class is above its target is the
largest of `value / target share` over classes with a target above 0%. The new
money is that total minus today's total, and each class takes
`total x target share - value`. Amounts show in whole rupees.

While a class with a 0% target holds money, new money alone cannot match the
targets, and the Dashboard says so instead of giving an amount.

## Display

Once targets are set, each row of the Dashboard allocation legend gains a bar
of the class's share with a line at its target, the target and the gap, so
each share is shown once. The new-money estimate sits under the legend.
Masking hides every amount. Minimal Mode folds it behind "Compare
with targets" until the user opens it. Targets are edited from Settings, under
Investment tools.

# Savings Goals Contract (#767)

Optional goals: a target amount in INR by a date, measured against the whole
portfolio or chosen holdings and accounts. A goal is a declaration. Saving,
editing or deleting one never changes holdings, Cash, snapshots or quotes.

## Record (schema V20)

`savingsGoals` holds up to 20 goals: id, name (up to 60 characters), target
amount in INR (above zero, at most two decimals), target date, the user's
assumed yearly return (0% to 30%, typed by the user with no pre-filled value),
and a scope. The scope is `portfolio`, or `selected` with holding asset ids,
Cash, PPF account ids and EPF account ids. Goals are included in backup and
restore. V19 records and backups migrate once to an empty list; a V19 record
that already carries goals, or any invalid goal, is rejected.

Deleting a holding or account does not change a goal. Chosen items that no
longer exist are left out of its value and the goal says how many.

## Values

- A whole-portfolio goal counts the Dashboard portfolio value, built by the
  same calculations, so the two always agree.
- A selected goal adds the chosen holdings' INR values, Cash, PPF confirmed
  balances and EPF balances. Holdings not valued in INR are left out and
  counted separately. Holdings linked to a PPF or EPF account are counted by
  that account.
- While any counted value is pending, progress is unavailable, never zero.

## Projection

Whole months left count a month once its day is reached. With `m` the monthly
rate equal to the yearly assumption and `n` the months left:

`target = value x (1 + m)^n + payment x ((1 + m)^n - 1) / m`

The payment is invested at each month end; at 0% the shortfall is divided
evenly. When growth alone reaches the target the payment is zero. Once the
target is reached the goal says so; once the date passes no payment is shown.
Projections are nominal rupees with no inflation adjustment and are always
labelled as estimates at the user's return. Monthly amounts show whole rupees.

## Display

Goals are a section on Progress; each opens its own screen with progress and
the edit form. A holding or account may back more than one goal; goals that
share one (or any goal next to a whole-portfolio goal) show a note that the
same money counts toward both. Progress is written as "N% reached" beside the
bar, so it never relies on colour. Masking hides every amount, including the
monthly estimate. Minimal Mode folds the section until the user opens it.

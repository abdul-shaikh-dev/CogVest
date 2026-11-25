# Benchmark Return Contract (#765)

Answers "Am I beating the index?" beside the whole-portfolio return (XIRR). It
is a hypothetical comparison. It never changes a record and is never saved.

## Benchmark

UTI Nifty 50 Index Fund, Direct Plan, Growth (ISIN `INF789F01XA0`), valued at
its daily NAV from AMFI. A fund's NAV already includes reinvested dividends
and the fund's costs, so no index-level adjustment is made.

## Calculation

The comparison uses the portfolio return's own dated flows, start and end:

- each money-in flow buys fund units at that day's NAV
- each money-out flow sells units at that day's NAV
- the portfolio's terminal value is ignored. The fund units left on the end
  date are valued at that day's NAV and become the benchmark's terminal value.

The benchmark return is the XIRR of those flows. NAV is published only on
trading days, so a flow uses the latest NAV on or before its date, at most 6
days earlier.

The comparison is unavailable, with a reason, when:

- a flow or the end date has no NAV within that gap
- money taken out would exceed the units the fund would have held
- no rate can be solved

It is shown only while the portfolio return itself is available.

## NAV history

AMFI history requests cover at most a year. The period is read in
calendar-year windows through the shared daily price cache. Nothing is fetched
until the user taps Compare. After that, cached windows are used, and only a
window older than a day is fetched again. A failed fetch says AMFI could not
be reached and offers to try again.

## Display

The comparison sits in the Dashboard return breakdown and shows:

- the fund's annual rate
- the gap in percentage points, written as "above" or "below" so it never
  relies on colour
- a note that it is hypothetical, which fund and NAV date it uses, that the
  portfolio includes Cash which the fund does not hold, and that it is not
  advice

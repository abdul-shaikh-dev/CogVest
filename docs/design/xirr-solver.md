# XIRR solver contract

30 October 2026. Related to #534 and #532. Implementation:
[`src/domain/xirr.ts`](../../src/domain/xirr.ts). Inputs come from the builders
in [`xirr-evidence-contract.md`](xirr-evidence-contract.md); the solver never
decides eligibility.

## Equation

Solve `sum(C_i / (1 + r)^(d_i / 365)) = 0`, where `d_i` is the whole number of
calendar days from the first flow. Dates are `YYYY-MM-DD` calendar dates turned
into UTC day numbers, so time zones and daylight saving never shift a day. The
365-day basis matches Excel's XIRR, so leap days count as part of the year.

Flows on the same date are netted first, in decimal arithmetic, before the
solver's floating-point work. Input order does not matter. The terminal value is
one more flow on the end date: it is netted with any trade that day, never
counted twice.

## Search range and uniqueness

- Range: `r` from −99.99% to +10,000% a year. The solver works in
  `x = ln(1 + r)`.
- A rate is returned only when **exactly one root is proven** in that range.
- Proof: the range is split into intervals. On each interval every term
  `C_i e^(−x t_i)` is monotone, so exact bounds for the function and its slope
  follow from the endpoint values.
  - An interval whose function bounds exclude zero has no root.
  - An interval whose slope bounds exclude zero has at most one root, present
    exactly when the endpoint values differ in sign.
  - Anything else is halved.
- Bounds within 1e-12 of zero (relative) never count as proof of a sign.
- The search stops after 20,000 intervals and reports `undetermined` rather
  than guessing. A root that only touches zero without crossing ends there too.
- Times are centred on the middle of the period, which multiplies the function
  by a positive factor. Roots don't move, and exponents stay finite for any
  period up to 150 years. Longer periods are `undetermined`.

The root is refined by bisection on `x` until the bracket is narrower than
1e-12, at most 200 steps, so there is no dependence on a starting guess.

## Results

| Result | Meaning |
| --- | --- |
| `rate` | Annual rate as a fraction, with start and end dates, the day count and `shortPeriod` |
| `invalid-flow` | Malformed date or a non-numeric or infinite amount (a data problem) |
| `no-negative-flow` / `no-positive-flow` | Nothing was invested, or nothing came back; a full loss lands here |
| `single-date` | Guard only: two signs always need two dates after netting |
| `no-rate-in-range` | Proven to have no root between −99.99% and +10,000% |
| `multiple-rates` | Two or more proven roots; no single rate is meaningful |
| `undetermined` | Roots couldn't be isolated within budget, or the period exceeds 150 years |

A result is never NaN, Infinity or a fallback 0%.

## Short periods

XIRR is annualised. A period shorter than 365 days still returns the rate, with
`shortPeriod: true`. Presentation (#535) must show it as annualised over that
many days, never as the gain for the period. Nothing switches to another
measure.

## Verification

[`src/domain/__tests__/xirr.test.ts`](../../src/domain/__tests__/xirr.test.ts):

- Exact cases: 10%, 0% and −10% over one year, and √2 − 1 at tiny and very
  large amounts over two years.
- Microsoft's documented example: 0.373362535 within 1e-8, Excel's own
  stopping tolerance.
- Six fixtures within 1e-9 of an independent oracle: 50-digit Python `decimal`
  bisection of the same equation. They cover irregular flows with a leap day,
  24 monthly contributions, a zero ending balance, a 40-year monthly history (481
  flows, under 250 ms) and a 59-day short period.
- Order independence and same-day netting.
- Failure paths: two exact roots (10% and 20%), no root, out of range, a double
  root, near-total loss (−99.9%), one-sign series, invalid and infinite inputs,
  and a 175-year span.
- Built inputs: per-asset rates for a held and a fully sold asset. The
  Investments rate is solved from the combined flows and differs from the
  average of the asset rates.

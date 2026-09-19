# Financial Label And Format Contract

This contract defines how CogVest names financial scope, comparisons, and
formats across Dashboard, Holdings, Progress, and per-holding history. It
changes presentation only. Financial formulas, denominators, persistence, and
provider behavior remain unchanged.

## Scope Labels

| Context | Included | Excluded | Required label or explanation |
| --- | --- | --- | --- |
| Dashboard portfolio value | Valued market holdings, recorded cash, and recorded PPF | Holdings without a usable valuation remain pending | Current portfolio value, qualified by valuation coverage |
| Dashboard allocation | Valued market holdings and recorded cash | Recorded PPF | `Share of market holdings and cash · recorded PPF excluded` |
| Holdings rows and detail | Valued market holdings | Cash and PPF | `Market holdings share` and `cash and PPF excluded` near the list |
| Portfolio Growth | Stored portfolio value and invested capital | None for complete snapshots | `Stored portfolio value compared with invested capital · not investment return` |
| Reconstructed Portfolio Growth | Reconstructed market holdings and cash | PPF | State that PPF is excluded; never mix reconstructed points with complete stored snapshots |
| Asset Momentum | Stored asset-class values | Cash; PPF when reconstructed coverage says so | `Asset values over time` and `not investment return` |
| Per-holding history | Native-currency observed prices or reconstructed holding value | Cash and unrelated holdings | Name the selected mode; holding value includes transactions and is not investment return |

Negative cash keeps the existing signed-exposure denominator and explanation.
If the denominator is zero, negative, incomplete, or unknown, show the existing
unavailable or pending state rather than a zero percentage.

## Comparisons

- Name the actual prior stored month beside a percentage comparison. Do not use
  an unexplained `vs prior` label.
- If the preceding stored month is absent, show `No prior stored month`.
- If the prior value is zero, show that the percentage is unavailable because
  the prior value was zero.
- Portfolio and asset value growth can include contributions, withdrawals, and
  transactions. Label it as value change, not investment return.
- Preserve partial, estimated, and reconstructed coverage labels. Missing
  valuation evidence must not be displayed as zero or silently bridged.

## Number And Date Formats

- Overview cards, lists, and chart axes may use compact Indian notation such as
  `K`, `L`, and `Cr` when space is constrained.
- Exact currency values use Indian grouping and two decimals in details and in
  unmasked accessibility labels whenever the visible value is compact.
- Wealth masking replaces both visible and accessible exact values with
  `Amount hidden`. Exact amounts must not remain in accessibility labels or
  explanatory copy while masked.
- Month summaries use `MMM yyyy` or `MMMM yyyy`. Daily observations use
  `dd MMM yyyy`. ISO dates remain internal or may appear only where an exact
  provider identifier is technically necessary.
- Native-currency history keeps the asset currency explicit. It must not imply
  historical INR conversion when none was performed.

## Boundaries

This vocabulary does not redefine investment return, tax lots, cost basis,
currency conversion, quote freshness, monthly snapshot construction, or any
financial denominator. Those behaviors remain owned by their domain contracts.

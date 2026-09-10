# Per-Asset History (#22)

## Approved Behavior

Extend Holding details with Price history and Your holding value. The latter is
the observed historical unit price multiplied by the quantity held on that date,
not today's quantity projected backwards and not investment return. Include buys,
sells and transfers; respect imported opening-position measured-date cutovers.
Unknown ownership and missing prices must not become fabricated zeroes.

Use native currency explicitly for both series. Do not apply today's USD/INR
rate to historical crypto observations. Existing INR portfolio summaries remain
unchanged. Holding-value changes include contributions and withdrawals; do not
label them profit or return.

## Delivery

1. Pure quantity reconstruction and deterministic bounded chart transformation,
   tested for cutovers, transfers, gaps and long histories.
2. Daily provider adapters using #26's cache, explicit errors, provenance and
   stale/offline coverage. No new provider subscription, backend or dependency.
3. A focused history section inside existing Holding details with mode and range
   controls, selected-date values, masking and truthful unsupported states.
4. Full tests, independent review, fresh APK and non-destructive emulator checks.

## Safety Boundaries

- Supported provider-linked stocks/ETFs use Yahoo daily prices; crypto uses
  CoinGecko daily observations. Manual assets, PPF and unsupported funds show
  an explanation instead of inventing a market curve.
- Yahoo stocks/ETFs remain INR-only under the current portfolio currency policy.
  Crypto retains INR or USD native identity. This does not enable foreign-stock
  onboarding or new currency conversion.
- CoinGecko uses `interval=daily`. A midnight observation is aligned to the
  preceding completed UTC day for end-of-day quantity reconstruction; it is not
  a guarantee of an exchange closing price. Non-midnight samples are excluded.
- Provider access may restrict available history. The ten-year cache/benchmark
  capability is not a promise that every provider supplies ten years free.
- Yahoo historical closes can be split-adjusted. If the fetched window contains
  a split affecting the requested history, do not multiply those prices by raw
  recorded quantities. Until corporate-action reconciliation is supported,
  explain that history cannot safely be reconstructed for that range.
- Native-currency charts do not represent historical INR-converted returns.
- Keep existing Monthly Progress, snapshots, quotes, backups and raw records
  unchanged. No daily-cache write may alter portfolio valuation.
- Range/asset changes must ignore stale completions. Fetch is bounded by the
  cache deadline; cached data remains visible during refresh or failure.
- Render at most 500 deterministic observations and preserve missing ownership
  boundaries. No animated long-history reveal or synthetic daily price filling.

## Implemented Interaction

The history section follows Your position inside Holding details. It has two
modes and 1M, 3M, 1Y, 5Y and 10Y presets, ending on the last completed UTC day.
The plot uses Gifted Charts with proportional calendar spacing, bounded sampling,
endpoint labels and a selected-point marker. Previous/Next selects observed
dates, not invented daily values. Currency, stale/partial state and source remain
visible; About this history discloses fetch date and interpretation limits.

Value change includes transactions and is not return. Percentages are suppressed
in Minimal Mode; masking removes the chart and financial readout entirely.
An upstream split invalidates disposable chart history and blocks reconstruction
for the affected requested range; protected valuation evidence is untouched.
Corporate-action reconstruction remains unsupported, not silently approximated.
Yahoo holding-value reconstruction additionally requires a successful adjustment
check in the current app session. This prevents a failed cache-clear operation
from reviving unsafe share-value history after restart. Offline cached price
history remains readable, while unverified share-value history is withheld.

Provider payloads have a 4 MiB pre-parse limit and bounded row counts. React
Native fetch may buffer a body before that limit can be checked; this is not a
streaming transport-memory guarantee. Provider calls use the cache's deadline.

Reference: [CoinGecko historical range documentation](https://docs.coingecko.com/reference/coins-id-market-chart-range).

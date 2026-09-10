# Quote Cache And Offline Policy (#26)

## Approved Ownership

The owner approved separating protected portfolio valuation evidence from
disposable daily chart data. Cache cleanup must not delete manual prices,
last-known valuations, saved monthly snapshots or month-end price evidence.
This contract supplies #22's cache foundation, not its chart UI or provider
history fetch adapters. No additional network provider or dependency is needed.

## Existing Inventory

| Data | Storage / consumers | Existing policy |
| --- | --- | --- |
| Current quotes | `cogvest:v1:quote-cache`, keyed by asset ID; Dashboard, Holdings, position entry and calculations | Latest stored value per asset; provider freshness 15 minutes; manual stays manual; failures/timeouts preserve fallback |
| Month-end evidence | `cogvest:v1:historical-quote-cache`, keyed by asset/month; Progress automation and snapshot rebuilding | Month-end records, not daily history; historical-close and fallback provenance retained |
| Portfolio records | `cogvest:v1:portfolio` | User records and snapshots; never chart-cache eviction candidates |

The current/month-end cache schemas are JSON records validated on load. Invalid
records currently quarantine the raw cache and surface storage recovery. Identity
corrections/deletion invalidate associated quotes through the existing asset-graph
journal. Full portfolio backup includes these two caches; its v1 format remains
unchanged. Current refresh already has four workers and a 10-second deadline.

There is no daily-history cache or daily-chart consumer in the current baseline.
The existing caches have no age/byte eviction rule. Their growth follows saved
assets/month-end evidence; this change intentionally does not impose a destructive
quota on that protected data. Original recovery and freshness rules remain intact.

## Disposable Daily History

Use a separate versioned envelope at `cogvest:v3:daily-price-cache`.
Identity includes provider, exact provider ID, native currency and price basis
(`close` versus `adjusted-close`), plus the requested calendar-date range.
Never substitute one currency, instrument or adjustment basis for another.

Each entry retains requested range, provider fetch timestamp, explicit coverage
completeness, and dated positive finite closes. No interpolated prices, zero-filled
gaps, inferred complete coverage or synthetic currency conversion. Providers may
omit non-trading days; complete means the provider answered the entire inclusive
requested range, not that every calendar day has a point. Adapters must explicitly
declare coverage completeness. Strictly validate dates, positive finite prices,
sorted unique in-range points, identities and non-future fetch timestamps.

Bounds:

- At most 10 calendar years and 4,000 points per entry, accommodating leap years
  and seven-day crypto markets. Older historical windows remain valid: this is a
  window-size limit, not automatic deletion of old calendar dates.
- At most 50,000 points across 64 entries and 8 MiB serialized UTF-8 storage.
  The required 10-assets/10-years fixture is about 36,530 points; these caps leave
  headroom without allowing unbounded overlapping range copies.
- Evict disposable entries in deterministic oldest-fetch order. Reads do not
  rewrite a large cache merely to update an access timestamp.
- Fetch age over 24 hours means stale, not deleted. Historical prices can be
  corrected upstream; the freshness label is not a claim of immutable accuracy.

## Offline And Refresh

Reads never initiate network access. A covering cached range can satisfy a
smaller request, with points sliced to that range and original provenance intact.
Prefer complete covering entries over newer partial entries. Do not merge
overlapping entries without a per-date provenance/coverage contract.
Missing coverage remains missing or explicitly partial; stale and partial are
separate facts. No cache value updates the protected portfolio quote stores.

Refresh is explicit and injectable for #22. Existing data stays readable during
refresh. Exact concurrent requests are deduplicated within a cache instance;
timeout, invalid responses and storage failure never become fresh success.
Clearing this cache invalidates earlier refreshes so late responses cannot refill
it. This operation touches only disposable chart data.

Corrupt disposable data can be replaced by a valid write. Incompatible envelope
versions are not silently overwritten: explicit cache clearing is required.
Parsing and writes enforce bounds; failures are typed rather than uncaught UI
exceptions. Saved financial records are never quarantined or reset by this cache.

## Backup And Delivery Boundary

Daily history is not added to the financial backup format or portfolio store.
Its keys use provider identity, not local asset IDs. Public market data may be
reused after a portfolio restore for the same provider identity; it contains no
portfolio records and is not restored from the backup. Explicit cache clearing
fences late refreshes through a persisted generation across service instances.
#22 must consume this service
without treating its coverage/freshness as current portfolio valuation. Any
future cache-clear UI must use the explicit service operation, not clear MMKV.

Verification covers retention/eviction boundaries, offline reads, partial/stale
data, corruption, future schemas, failed refreshes/writes and protected-key
preservation. A synthetic 10-year/10-asset fixture records UTF-8 size and write,
read and chart-transform costs on the PC and in an isolated Android MMKV namespace.
Run full verification and a fresh signed APK upgrade with data retained. No EAS
build, physical phone requirement, or resumption of parked #299 belongs here.

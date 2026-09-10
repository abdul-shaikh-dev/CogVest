# Advanced Asset Search (#23)

## Behavior Contract

Add Holding and rapid portfolio setup share discovery. Saved assets appear
before provider candidates; exact identities rank ahead of weaker matches.
Selection remains explicit and rechecks canonical identity before saving.
Search does not create holdings or overwrite confirmed details.

- Yahoo retains Indian stock/ETF mappings; CoinGecko supports crypto.
  Unsupported instruments retain manual entry. No provider is added.
- A 350 ms debounce and abort signal avoid unnecessary requests. Obsolete
  responses cannot replace the current query; previous-query results disappear.
- Results retain metadata confidence, source identity, ticker, exchange,
  currency and safe confirmation behavior.
- Providers may return fewer matches than requested. We rank/deduplicate the
  returned set, cap it at 100 and display 20 at a time. Load more reveals another
  20 already-returned candidates, not a fabricated provider cursor.
- Visible rows mount in batches of five inside the result-list component, not
  through repeated whole-form updates. The next-page button appears after the
  current page finishes mounting. Query/filter replacement immediately removes
  stale rows; append keeps existing rows mounted.
- Stock, ETF, saved debt, crypto, NSE and BSE filters work without refetching.
  Six saved assets initially keep the blank-query screen compact; a query shows
  up to 20, with explicit expansion for additional saved assets.
- Asset-class icons remain the fallback. Optional remote logos are omitted:
  no new dependency, remote image requests, or unbounded image cache.
- The last five selected queries stay local under
  `cogvest:recent-asset-searches:v1`. Typing alone does not save history. Clear
  recent searches removes it. This convenience state is excluded from portfolio
  backup. Corrupt history does not block asset entry.

## Non-Destructive Emulator Check

Build/install a fresh development APK using the PC harness documentation.
If the installed app has the private QA certificate, re-sign a development copy
with the existing local QA key; never uninstall to bypass a signing mismatch.

With Metro running, open:

```powershell
adb reverse tcp:8081 tcp:8081
adb shell am start -W -a android.intent.action.VIEW -d 'cogvest:///asset-search-qa?token=cogvest-local-visual-qa'
```

This development/token-gated route uses an isolated memory portfolio with 500
saved assets and 200 provider candidates. It does not reset the installed
portfolio or call external providers. Release builds cannot enable it.
Test exact saved/provider matches, filters, pagination, explicit selection and
manual entry. Warm up the form, then Reset metrics to start a fresh window.
Capture metrics ends that window and exports one `[asset-search-qa] metrics`
JSON console entry. Reset is required before collecting another window.

The buffer retains up to 2,000 measurements with an explicit dropped count. It
does not log during measured rendering; export/UI-report work happens after
capture stops sampling. Sampling pauses when the QA route is not focused.

Timing mode excludes React Profiler overhead. Append `&profile=1` to the QA URL
for a separate diagnostic run that also records raw React commit duration;
do not mix profiling and timing-only windows without labeling them.

Action metrics end at the **complete React commit**, not proof of native paint:
provider callback to complete page, query input to saved results, filter to
completion of both lists, and page action to completion of that list. Pair them
with installed-app visual checks; do not label them pixel-visible latency.
Network time/debounce is
not included in the provider callback metric. The 50 ms timer records sampled
lag above 100 ms; timer lag alone does not attribute the delay to exclusive JS
execution rather than native/debug/host scheduling. Cold/remount render context
is retained when it occurs inside a window. Never discard failing samples or
use an incomplete first batch as proof of full-page latency.

Debug observations are not standalone release performance certification or
network response guarantees. Record the AVD/API, APK identity, Metro/debug mode,
window coverage and dropped count with each result.

The user-approved #23 gate is complete search/filter updates within 500 ms,
no crashes or ANRs, and no persistent input or scrolling freezes. The 100 ms
timer threshold remains a diagnostic signal, not a hard merge cutoff. Retain
all excursions in evidence. Pair timing measurements with installed-app
journeys; functional success alone is not a latency measurement. Current
validation uses Pixel_10_Pro/API 36 debug/Metro, not Pixel 8 or a physical phone.

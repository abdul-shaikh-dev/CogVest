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
manual entry. Capture raw React commit durations, provider-result-to-render
latency and sampled event-loop lag after warm-up/reset. Debug observations are
not standalone release performance certification or network response guarantees.

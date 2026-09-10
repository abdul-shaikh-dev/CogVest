# Daily Price Cache Verification (#26)

## Scope

The cache is a foundation for #22, not an implemented chart or provider adapter.
See the [approved policy](../roadmap/quote-cache-offline-policy.md). Existing
current quotes, manual prices, monthly snapshots and month-end evidence are not
evicted. Financial backup contents and format are unchanged.

## Reproduce

PC (PowerShell, Node 24.11.1, Jest and in-memory JSON storage):

```powershell
$env:COGVEST_CACHE_BENCHMARK = '1'
npm test -- --runInBand src/testing/__tests__/dailyPriceCacheFixture.test.ts
Remove-Item Env:COGVEST_CACHE_BENCHMARK
npm run test:v1:pc
```

Android: follow the existing [local APK process](../release/android-release-process.md).
Build/install a fresh debug APK with the same signing identity as the installed
app, using `adb install -r`; never uninstall or reset portfolio data. Start Metro
on port 8081 and reverse that port for the emulator. Then run:

```powershell
npm run maestro:test -- e2e/discovery/quote-cache.yaml
```

The flow opens a development-only, token-gated `quote-cache-qa` route. Its button
clears only the separate `cogvest-daily-price-qa` MMKV instance's daily-cache key.
The deterministic fixture has 10 synthetic assets and 36,530 calendar-day points,
2016-01-01 through 2025-12-31. No provider request or real portfolio seed is used.
The result screen and `[quote-cache-qa] result` console JSON report bytes and
timings. Screenshot: `.expo/issue26-cache-benchmark.png` (local ignored evidence).

Cold read means a new service instance; it does not claim OS disk-cache eviction.
Each read phase requests all ten assets. Slice/transform reads 2025 and maps 3,650
finite chart values. These are JS timings, not frame/presentation measurements.

## Recorded Evidence: 10 September 2026

| Measurement | Windows / Jest | Pixel_10_Pro / API 36 / Hermes debug + Metro |
| --- | ---: | ---: |
| Serialized UTF-8 bytes | 1,351,556 | 1,351,559 |
| Ten sequential writes | 158 ms | 2,414.17 ms |
| Ten cold-service reads | 69 ms | 165.59 ms |
| Ten warm reads | 8 ms | 31.92 ms |
| One-year slice + mapping | 2 ms | 20.22 ms |

Small byte differences are the generation token, not different price points.
All ten writes stored, all reads hit with current/complete coverage, and all
3,650 mapped values were finite. Maestro passed; the result screenshot was
visually inspected. Emulator: `emulator-5554`, x86_64, 1280x2856, density 480,
font scale 1. No physical-phone or standalone-release smoothness claim.

An initial implementation repeatedly parsed/validated every point: ten warm
reads took 5,273 ms. Reusing a validated envelope fixes that repeated work while
still reading the raw storage value to observe sibling-instance changes.
Returned records are copied so callers cannot mutate the validated cache.

Bulk population is still synchronous and materially slower than warm reads:
the largest observed single write was 384.87 ms. #22 must not perform all ten
writes synchronously in a gesture/render handler. Measure real integration and
schedule work between interactions; consider batching/indexing only if measured
consumer costs justify it. No chart is wired to this cache yet.

## Upgrade And Isolation

`npm run android:apk:emulator` succeeded. Its debug APK was signed with the existing
local QA identity and installed with `adb install -r`. The app was stopped for
before/after MMKV SHA-256 checks; both files were byte-identical:

```text
mmkv.default     f526ce8e9a221d816f574605c0bed082c078f9666a492a8b76af9d86e1db7bc6
mmkv.default.crc 014a15fa88b2092a6874e3cfb1252a3f52536e216174da29f9ef393bad44eb3a
```

The upgraded app launched Dashboard and ran the fixture through current Metro
JavaScript. No uninstall, data reset, EAS build or backup migration was performed.
Store isolation tests separately verify eviction/clear/corruption do not alter
protected financial bytes, backup payload/revision, or cold-store recovery.

Final `npm run test:v1:pc` passed: typecheck, 119 Jest suites / 1,210 tests,
Expo Doctor 17/17, Android doctor and strict installed-package smoke. The final
Maestro run passed after freshness/coverage assertions and refresh-race fixes.
Independent owned-diff review found no remaining blockers after correction.

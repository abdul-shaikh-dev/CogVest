# Maestro E2E Run Log

Record every full-tier run (weekly and before a release gate) and any smoke run
used as PR evidence. Newest first. See [`maestro-e2e.md`](maestro-e2e.md) for
the run cadence.

## 2026-11-19: Smoke tier for per-asset grouping in replays (#720), 15 passed, 14m 30s

- Commit: fix/720-group-by-asset 1370053, version 1.0.32. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0. E2E APK (R8 on,
  x86_64) freshly built from 1370053, SHA-256 prefix f8f3027ed9193a47, Metro stopped.
  Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 14m 30s, within the 15-minute budget.
  Run from the G:\cv build worktree at the tested commit. No behaviour change is intended; every flow that reads holdings, sale gains or saves exercises the regrouped paths.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 11s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 03s |
| record-purchase | Pass | 0m 53s |
| payouts | Pass | 0m 52s |
| xirr-holding | Pass | 0m 37s |
| cash | Pass | 0m 57s |
| trade-correction | Pass | 2m 08s |
| holdings-csv-import | Pass | 1m 15s |
| epf-accounts | Pass | 1m 07s |
| ppf-account | Pass | 1m 23s |
| progress-snapshot-history | Pass | 0m 40s |
| value-masking | Pass | 1m 09s |
| persistence | Pass | 0m 40s |
| backup-roundtrip | Pass | 1m 12s |

## 2026-11-19: Smoke tier for strict decimal input and 48 dp targets (#719), 15 passed, 14m 27s

- Commit: fix/719-strict-decimals 4312a9e, version 1.0.32. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0. E2E APK (R8 on,
  x86_64) freshly built from 4312a9e, SHA-256 prefix c99b3b09d60e4923, Metro stopped.
  Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 14m 27s, within the 15-minute budget.
  Run from the G:\cv build worktree at the tested commit. cash, record-purchase, trade-correction, holdings-csv-import and ppf-account exercise the stricter parsing; the resized controls appear across the tier.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 12s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 05s |
| record-purchase | Pass | 0m 53s |
| payouts | Pass | 0m 52s |
| xirr-holding | Pass | 0m 38s |
| cash | Pass | 0m 57s |
| trade-correction | Pass | 2m 05s |
| holdings-csv-import | Pass | 1m 16s |
| epf-accounts | Pass | 1m 07s |
| ppf-account | Pass | 1m 24s |
| progress-snapshot-history | Pass | 0m 41s |
| value-masking | Pass | 1m 10s |
| persistence | Pass | 0m 40s |
| backup-roundtrip | Pass | 1m 09s |

## 2026-11-19: Smoke tier for restore privacy settings (#718), 14 passed, 14m 21s

- Commit: fix/718-restore-privacy 71d056c, version 1.0.32. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0. E2E APK (R8 on,
  x86_64) freshly built from 71d056c, SHA-256 prefix 511a3d6e131fd88e, Metro stopped.
  Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 14 passed, 1 failed, 14m 21s, within the 15-minute budget.
  backup-roundtrip failed in this run because the main checkout was switched to another branch mid-run, so the runner read the old flow (which expects the backup's masking to be restored) against this APK. Rerun alone from the #718 checkout on the same installed APK, the updated backup-roundtrip passed in 1m 26s: masking stays off on the cleared device and the backup's Light appearance returns, before and after a cold start.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 11s |
| navigation | Pass | 0m 22s |
| add-holding-lookup | Pass | 1m 02s |
| record-purchase | Pass | 0m 51s |
| payouts | Pass | 0m 50s |
| xirr-holding | Pass | 0m 36s |
| cash | Pass | 0m 56s |
| trade-correction | Pass | 2m 04s |
| holdings-csv-import | Pass | 1m 15s |
| epf-accounts | Pass | 1m 05s |
| ppf-account | Pass | 1m 20s |
| progress-snapshot-history | Pass | 0m 40s |
| value-masking | Pass | 1m 07s |
| persistence | Pass | 0m 37s |
| backup-roundtrip | Fail (stale flow file); rerun alone: Pass | 1m 24s; rerun 1m 26s |

## 2026-11-19: Smoke tier for quote precedence and refresh writes (#717), 15 passed, 14m 04s

- Commit: fix/717-quote-precedence 61abcee, version 1.0.32. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0. E2E APK (R8 on,
  x86_64) freshly built from 61abcee, SHA-256 prefix 5f45c28c97afa732, Metro stopped.
  Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 14m 04s, within the 15-minute budget.
  Dashboard, holdings, value-masking and add-holding-lookup flows exercise the changed quote paths.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 11s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 02s |
| record-purchase | Pass | 0m 49s |
| payouts | Pass | 0m 51s |
| xirr-holding | Pass | 0m 37s |
| cash | Pass | 0m 55s |
| trade-correction | Pass | 2m 02s |
| holdings-csv-import | Pass | 1m 16s |
| epf-accounts | Pass | 1m 07s |
| ppf-account | Pass | 1m 21s |
| progress-snapshot-history | Pass | 0m 39s |
| value-masking | Pass | 1m 09s |
| persistence | Pass | 0m 38s |
| backup-roundtrip | Pass | 1m 07s |

## 2026-11-19: Smoke tier for imported trade charges (#716), 15 passed, 13m 32s

- Commit: fix/716-imported-trade-charges d852267, version 1.0.32. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, cold-booted
  just before this run. E2E APK (R8 on, x86_64) freshly built from d852267,
  SHA-256 prefix 845e267125888a07, Metro stopped. Command: `npm run maestro:smoke`
  with `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 13m 32s, within the 15-minute budget.
  trade-correction exercises the changed correction screen.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 12s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 01s |
| record-purchase | Pass | 0m 49s |
| payouts | Pass | 0m 47s |
| xirr-holding | Pass | 0m 36s |
| cash | Pass | 0m 53s |
| trade-correction | Pass | 1m 56s |
| holdings-csv-import | Pass | 1m 10s |
| epf-accounts | Pass | 1m 04s |
| ppf-account | Pass | 1m 16s |
| progress-snapshot-history | Pass | 0m 39s |
| value-masking | Pass | 1m 05s |
| persistence | Pass | 0m 38s |
| backup-roundtrip | Pass | 1m 06s |

## 2026-11-19: Smoke tier for dated Cash shortfalls (#715), 15 passed, 15m 23s (over budget)

- Commit: fix/715-cash-timeline 1a103ef, version 1.0.32. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0. E2E APK (R8 on,
  x86_64) freshly built from 1a103ef, SHA-256 prefix 255908da160cd103, Metro
  stopped. Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- First run: 15 passed, 0 failed, 17m 28s. record-purchase took 3m 22s with no
  retried step. Run alone twice right after, it took 0m 54s and 0m 59s, so this
  was a one-off emulator stall.
- Second run (table): 15 passed, 0 failed, 15m 23s, 23s over the 15-minute
  budget. Every flow was 1-5s slower than the #714 run on the same AVD. That
  includes smoke-launch, navigation and add-holding-lookup, which do not touch
  the changed Cash rules. The budget is unchanged. The overage is reported as is,
  not explained away: rerun on a fresh emulator boot before the next release gate.
- cash, record-purchase, payouts, ppf-account and trade-correction exercise the
  changed Cash paths.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 15s |
| navigation | Pass | 0m 22s |
| add-holding-lookup | Pass | 1m 07s |
| record-purchase | Pass | 0m 56s |
| payouts | Pass | 0m 55s |
| xirr-holding | Pass | 0m 40s |
| cash | Pass | 0m 59s |
| trade-correction | Pass | 2m 16s |
| holdings-csv-import | Pass | 1m 18s |
| epf-accounts | Pass | 1m 11s |
| ppf-account | Pass | 1m 26s |
| progress-snapshot-history | Pass | 0m 46s |
| value-masking | Pass | 1m 15s |
| persistence | Pass | 0m 43s |
| backup-roundtrip | Pass | 1m 14s |

## 2026-11-19: Smoke tier for month-end snapshot refresh (#714), 15 passed, 14m 08s

- Commit: fix/714-snapshot-refresh 196b17c, version 1.0.32. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0. E2E APK (R8 on,
  x86_64) freshly built from 196b17c, SHA-256 prefix 7dc8dd08b369fada, Metro
  stopped. Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 14m 08s, within the 15-minute budget.
  progress-snapshot-history, cash, payouts and record-purchase exercise the
  changed store paths.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 12s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 02s |
| record-purchase | Pass | 0m 52s |
| payouts | Pass | 0m 48s |
| xirr-holding | Pass | 0m 37s |
| cash | Pass | 0m 55s |
| trade-correction | Pass | 2m 04s |
| holdings-csv-import | Pass | 1m 15s |
| epf-accounts | Pass | 1m 06s |
| ppf-account | Pass | 1m 21s |
| progress-snapshot-history | Pass | 0m 40s |
| value-masking | Pass | 1m 08s |
| persistence | Pass | 0m 40s |
| backup-roundtrip | Pass | 1m 07s |

## 2026-11-18: Smoke tier for inventory-safe corrections (#713), 15 passed, 13m 53s

- Commit: fix/713-inventory-corrections a158dfb, version 1.0.32. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0. E2E APK (R8 on,
  x86_64) freshly built from a158dfb, SHA-256 prefix 0ea339eeb58ebc46, Metro
  stopped. Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 13m 53s, within the 15-minute budget.
  trade-correction exercises the corrected store path.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 12s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 01s |
| record-purchase | Pass | 0m 48s |
| payouts | Pass | 0m 48s |
| xirr-holding | Pass | 0m 35s |
| cash | Pass | 0m 53s |
| trade-correction | Pass | 1m 57s |
| holdings-csv-import | Pass | 1m 14s |
| epf-accounts | Pass | 1m 04s |
| ppf-account | Pass | 1m 20s |
| progress-snapshot-history | Pass | 0m 42s |
| value-masking | Pass | 1m 10s |
| persistence | Pass | 0m 41s |
| backup-roundtrip | Pass | 1m 07s |

## 2026-11-18: Smoke tier for the Expo SDK 58 patch releases, 15 passed, 14m 09s

- Commit: chore/expo-58-patches (expo 58.0.26, expo-router 58.0.32, jest-expo
  58.0.15), version 1.0.32. AVD CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi,
  font scale 1.0, freshly booted. E2E APK (R8 on, x86_64) freshly built from the
  branch, SHA-256 prefix 34e3310bf14d489a, Metro stopped. Command:
  `npm run maestro:smoke` with `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 14m 09s, within the 15-minute budget.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 14s |
| navigation | Pass | 0m 25s |
| add-holding-lookup | Pass | 1m 02s |
| record-purchase | Pass | 0m 48s |
| payouts | Pass | 0m 49s |
| xirr-holding | Pass | 0m 35s |
| cash | Pass | 0m 55s |
| trade-correction | Pass | 2m 01s |
| holdings-csv-import | Pass | 1m 16s |
| epf-accounts | Pass | 1m 04s |
| ppf-account | Pass | 1m 21s |
| progress-snapshot-history | Pass | 0m 42s |
| value-masking | Pass | 1m 08s |
| persistence | Pass | 0m 39s |
| backup-roundtrip | Pass | 1m 10s |

## 2026-11-17: Smoke tier for the load-time write guard (#712), 15 passed, 13m 39s

- Commit: fix/712-ppf-linked-asset, version 1.0.32. AVD CogVest_UX_Proof, API 36,
  1280x2856 at 480 dpi, font scale 1.0, freshly booted. E2E APK (R8 on, x86_64)
  freshly built from the branch, SHA-256 prefix 86b3cca87a57b2f6, Metro stopped.
  Command: `npm run maestro:smoke` with `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 13m 39s, within the 15-minute budget. Every
  save in these flows now runs the load-time schema check first; no flow was
  refused or slowed noticeably. The earlier 18-20 minute runs were on an
  emulator that had been up for many hours.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 12s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 02s |
| record-purchase | Pass | 0m 49s |
| payouts | Pass | 0m 48s |
| xirr-holding | Pass | 0m 34s |
| cash | Pass | 0m 53s |
| trade-correction | Pass | 1m 55s |
| holdings-csv-import | Pass | 1m 12s |
| epf-accounts | Pass | 1m 03s |
| ppf-account | Pass | 1m 20s |
| progress-snapshot-history | Pass | 0m 39s |
| value-masking | Pass | 1m 07s |
| persistence | Pass | 0m 38s |
| backup-roundtrip | Pass | 1m 06s |


## 2026-11-17: Smoke tier for the low-impact polish (#670), 15 passed, 20m 34s

- Commit: ux/670-polish add4d01. AVD CogVest_UX_Proof, API 36, 1280x2856 at
  480 dpi, font scale 1.0, E2E APK (R8 on, x86_64) freshly built from add4d01,
  SHA-256 prefix 2a89e900fe4f3d69, Metro stopped. Command: `npm run maestro:smoke`
  with `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 20m 34s, over the 15-minute budget. Every
  flow ran about 5-15% slower than the #669 run on the same long-running
  emulator; no flow failed or retried.
- Screenshots inspected: the Cash ledger with a deposit (amount in the primary
  text colour, sign and arrow showing direction) and the Dashboard with the
  12sp tab labels and the "Hide values" toggle.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 19s |
| navigation | Pass | 0m 29s |
| add-holding-lookup | Pass | 1m 27s |
| record-purchase | Pass | 1m 17s |
| payouts | Pass | 1m 13s |
| xirr-holding | Pass | 0m 55s |
| cash | Pass | 1m 14s |
| trade-correction | Pass | 2m 54s |
| holdings-csv-import | Pass | 1m 40s |
| epf-accounts | Pass | 1m 32s |
| ppf-account | Pass | 1m 59s |
| progress-snapshot-history | Pass | 1m 01s |
| value-masking | Pass | 1m 39s |
| persistence | Pass | 1m 04s |
| backup-roundtrip | Pass | 1m 49s |

## 2026-11-17: Smoke tier for the shared money field (#669), 15 passed, 18m 18s

- Commit: ux/669-money-field 7e47c4d, version 1.0.31. AVD CogVest_UX_Proof,
  API 36, 1280x2856 at 480 dpi, font scale 1.0, E2E APK (R8 on, x86_64) freshly
  built from 7e47c4d, SHA-256 prefix 48c37eb87b1c9ec0, Metro stopped, Gradle
  daemons stopped. Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 18m 18s, over the 15-minute budget. No other
  host work ran; the emulator had been up for many hours, and every flow ran
  about 10-20% slower than in the 2026-11-16 runs. No flow failed or retried.
- Screenshots inspected (light and dark): the Cash deposit form with an amount
  error, and the Settings value-masking and screenshot switches.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 16s |
| navigation | Pass | 0m 28s |
| add-holding-lookup | Pass | 1m 17s |
| record-purchase | Pass | 1m 08s |
| payouts | Pass | 1m 08s |
| xirr-holding | Pass | 0m 50s |
| cash | Pass | 1m 10s |
| trade-correction | Pass | 2m 37s |
| holdings-csv-import | Pass | 1m 28s |
| epf-accounts | Pass | 1m 26s |
| ppf-account | Pass | 1m 43s |
| progress-snapshot-history | Pass | 0m 52s |
| value-masking | Pass | 1m 27s |
| persistence | Pass | 0m 55s |
| backup-roundtrip | Pass | 1m 34s |

## 2026-11-17: Smoke tier for the review stack (#662-#666), 15 passed, 18m 00s

- Commit: refactor/666-boundaries 2250a57, the tip of the stacked branches for
  #662, #663, #665, #664 and #666, version 1.0.31. AVD CogVest_UX_Proof, API 36,
  1280x2856 at 480 dpi, font scale 1.0, E2E APK (R8 on, x86_64) freshly built
  from 2250a57, SHA-256 prefix 3b3f338af2763c7f, Metro stopped, Gradle daemons
  stopped. Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 18m 00s, over the 15-minute budget. The host
  had just run an APK build and frame probes; no flow failed or retried.
- Screenshots inspected: Holdings on the 250-asset fixture, Add EPF account,
  and Monthly History month detail.
- #664 frame probe: Holdings scroll on the 250-asset fixture
  (`scripts/measure-android-frames.ps1 -Mode scroll`, 3 runs each). Janky
  frames went from 99.3-100% (main af7d23e) to 79.9-87.0% (2250a57), and slow
  UI-thread frames from 78-84 to 54-76. p90 was 150 ms in every run because
  emulator GPU emulation dominates, so these numbers compare builds only.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 16s |
| navigation | Pass | 0m 26s |
| add-holding-lookup | Pass | 1m 14s |
| record-purchase | Pass | 1m 06s |
| payouts | Pass | 1m 08s |
| xirr-holding | Pass | 0m 49s |
| cash | Pass | 1m 09s |
| trade-correction | Pass | 2m 36s |
| holdings-csv-import | Pass | 1m 31s |
| epf-accounts | Pass | 1m 22s |
| ppf-account | Pass | 1m 42s |
| progress-snapshot-history | Pass | 0m 53s |
| value-masking | Pass | 1m 26s |
| persistence | Pass | 0m 52s |
| backup-roundtrip | Pass | 1m 30s |

## 2026-11-17: Full tier after review phases 1-3 (#675), 64 passed, 1 flaky, 1h 30m 49s

- Commit: main af7d23e, version 1.0.31. AVD CogVest_UX_Proof, API 36,
  1280x2856 at 480 dpi, font scale 1.0, E2E APK (R8 on, x86_64) freshly built
  from af7d23e, SHA-256 prefix 3a44eb632decd3eb, Metro stopped, Gradle daemons
  stopped. Command: `npm run maestro:test` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Full tier: 65 flows, 64 passed, 1 failed, 1h 30m 49s of flow time.
- `settings-preference-hierarchy` failed at `assertVisible: "Newest price update
  date"`. The failure screenshot shows the scroll stopping with the price-date
  row behind the bottom tab bar: the element counted as found, but its text was
  not on screen. The flow passed alone on the same APK (1m 01s). This branch
  makes that scroll require the whole row on screen
  (`visibilityPercentage: 100`); the changed flow then passed twice (1m 00s
  each). Not an app defect.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 19s |
| navigation | Pass | 0m 22s |
| dashboard-valuation-basis | Pass | 0m 35s |
| add-trade | Pass | 1m 07s |
| add-holding-lookup | Pass | 1m 04s |
| add-holding-back | Pass | 1m 06s |
| add-holding-manual-semantics | Pass | 1m 18s |
| add-holding-pending-valuation | Pass | 1m 30s |
| add-holding-unknown-date | Pass | 0m 59s |
| add-holding-edited-quote | Pass | 0m 47s |
| add-holding-asset-switch | Pass | 1m 27s |
| add-holding-asset-class | Pass | 1m 19s |
| add-holding-review-hierarchy | Pass | 1m 11s |
| quick-portfolio-setup | Pass | 2m 41s |
| sell-quote-context | Pass | 0m 56s |
| holdings-csv-import | Pass | 1m 15s |
| transactions-csv-import | Pass | 1m 30s |
| cas-native-import | Pass | 2m 36s |
| cas-native-fresh-portfolio | Pass | 1m 41s |
| zerodha-tradebook-import | Pass | 2m 48s |
| futures-manual-wallet | Pass | 3m 26s |
| futures-draft-protection | Pass | 2m 36s |
| futures-timestamp-evidence | Pass | 3m 58s |
| futures-cash-funding | Pass | 2m 21s |
| investing-cash-migration | Pass | 0m 39s |
| epf-persistence | Pass | 0m 33s |
| epf-reporting | Pass | 0m 28s |
| epf-accounts | Pass | 1m 11s |
| epf-entries | Pass | 1m 40s |
| epf-corrections | Pass | 1m 18s |
| epf-matrix | Pass | 0m 53s |
| epf-progress-empty | Pass | 0m 51s |
| epf-year-summary | Pass | 1m 25s |
| holdings | Pass | 1m 05s |
| holdings-list-first | Pass | 1m 47s |
| holdings-list-first-layout | Pass | 0m 40s |
| ppf-account | Pass | 1m 25s |
| ppf-history-fallback | Pass | 2m 11s |
| opening-position-correction | Pass | 1m 28s |
| trade-correction | Pass | 3m 16s |
| bulk-transaction-delete | Pass | 0m 51s |
| asset-correction | Pass | 3m 30s |
| cash | Pass | 1m 11s |
| cash-entry-focus | Pass | 1m 52s |
| funded-buy-cash | Pass | 2m 08s |
| record-purchase | Pass | 1m 08s |
| payouts | Pass | 1m 07s |
| xirr-holding | Pass | 0m 54s |
| xirr-whole | Pass | 0m 31s |
| payout-coverage | Pass | 0m 43s |
| snapshot-review | Pass | 0m 25s |
| progress-chart-range | Pass | 1m 11s |
| progress-chart-month-navigation | Pass | 1m 16s |
| progress-snapshot-history | Pass | 0m 55s |
| value-masking | Pass | 1m 31s |
| minimal-mode | Pass | 1m 11s |
| insight-details | Pass | 0m 59s |
| holding-duration | Pass | 0m 49s |
| contextual-nudges | Pass | 2m 42s |
| persistence | Pass | 1m 17s |
| backup-roundtrip | Pass | 1m 35s |
| privacy-settings | Pass | 0m 25s |
| settings-preference-hierarchy | Fail (see notes; passed on rerun) | 1m 19s |
| shared-ui-hierarchy | Pass | 0m 47s |
| workflow-exit-navigation | Pass | 0m 50s |

## 2026-11-16: Smoke tier for compact values and chart axis labels (#668), 15 passed, 13m 45s

- Commit: fix/668-compact-inr 2149001, version 1.0.31. AVD CogVest_UX_Proof,
  API 36, 1280x2856 at 480 dpi, font scale 1.0, E2E APK (R8 on, x86_64) freshly
  built from 2149001, SHA-256 prefix 3a44eb632decd3eb, Metro stopped, Gradle
  daemons stopped. Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 13m 45s, within the 15-minute budget.
- `e2e/discovery/asset-history.yaml` passed. Its INR holding-value chart shows
  axis labels ₹1.1K, ₹747 and ₹373 and the price ₹1,000.00.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 11s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 01s |
| record-purchase | Pass | 0m 50s |
| payouts | Pass | 0m 47s |
| xirr-holding | Pass | 0m 35s |
| cash | Pass | 0m 54s |
| trade-correction | Pass | 2m 01s |
| holdings-csv-import | Pass | 1m 15s |
| epf-accounts | Pass | 1m 04s |
| ppf-account | Pass | 1m 20s |
| progress-snapshot-history | Pass | 0m 40s |
| value-masking | Pass | 1m 06s |
| persistence | Pass | 0m 37s |
| backup-roundtrip | Pass | 1m 04s |

## 2026-11-16: Smoke tier for the deletion message tone (#667), 15 passed, 13m 51s

- Commit: fix/667-delete-failure-style 734d2bf, version 1.0.31. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, E2E APK
  (R8 on, x86_64) freshly built from 734d2bf, SHA-256 prefix d9bb7b465793bb47,
  Metro stopped, Gradle daemons stopped. Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 13m 51s, within the 15-minute budget.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 12s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 00s |
| record-purchase | Pass | 0m 50s |
| payouts | Pass | 0m 49s |
| xirr-holding | Pass | 0m 36s |
| cash | Pass | 0m 54s |
| trade-correction | Pass | 2m 00s |
| holdings-csv-import | Pass | 1m 15s |
| epf-accounts | Pass | 1m 05s |
| ppf-account | Pass | 1m 20s |
| progress-snapshot-history | Pass | 0m 39s |
| value-masking | Pass | 1m 06s |
| persistence | Pass | 0m 37s |
| backup-roundtrip | Pass | 1m 07s |

## 2026-11-16: Smoke tier and Recovery flow for storage recovery (#654), 15 passed, 13m 24s

- Commit: fix/654-storage-recovery 7abbd63, version 1.0.31. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, E2E APK
  (R8 on, x86_64) freshly built from 7abbd63, SHA-256 prefix 16a66ab1d2e41bf0,
  Metro stopped, Gradle daemons stopped. Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 13m 24s, within the 15-minute budget.
- `e2e/visual/secondary-recovery.yaml` (`-e SIZE=normal`) passed. It covers the
  new Export recovery copies button, the saved-file message, and no export
  without a kept copy.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | Pass | 0m 12s |
| navigation | Pass | 0m 21s |
| add-holding-lookup | Pass | 1m 00s |
| record-purchase | Pass | 0m 49s |
| payouts | Pass | 0m 45s |
| xirr-holding | Pass | 0m 35s |
| cash | Pass | 0m 54s |
| trade-correction | Pass | 1m 55s |
| holdings-csv-import | Pass | 1m 10s |
| epf-accounts | Pass | 1m 03s |
| ppf-account | Pass | 1m 17s |
| progress-snapshot-history | Pass | 0m 38s |
| value-masking | Pass | 1m 03s |
| persistence | Pass | 0m 36s |
| backup-roundtrip | Pass | 1m 04s |

## 2026-11-15: Smoke tier with stored-data checks (#673), 15 passed, 18m 58s

- Commit: test/673-tz-stable-tests 933b9ae plus the two flow fixes below, version
  1.0.31. AVD CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0,
  E2E APK (R8 on, x86_64) freshly built from 933b9ae, 58.7 MB, SHA-256 prefix
  a2b03318109afebf, Metro stopped. Command: `npm run maestro:smoke` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Smoke tier: 15 passed, 0 failed, 18m 58s, over the 15-minute budget. The
  user chose to keep the tier as it is.
- The overrun has two causes:
  - The new stored-data checks and the backup round trip added by #671 account
    for about 1 to 2 minutes.
  - Flows this change doesn't touch also ran 10 to 20% slower than on 2026-11-10
    (navigation 29s against 24s, add-holding-lookup 1m 19s against 1m 10s),
    with unrelated Java processes running on the PC.
- An earlier run of the seven changed flows stalled because an idle Gradle
  daemon from the APK build was still running. trade-correction timed out in
  Maestro's text input. After `gradlew --stop`, every flow passed.
- That run also corrected two expectations:
  - The visual QA seed stores 7 monthly snapshots.
  - epf-accounts writes to its own synthetic database, which the evidence
    screen does not read, so its QA check page stays its stored-data assertion.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | PASS | 0m 18s |
| navigation | PASS | 0m 29s |
| add-holding-lookup | PASS | 1m 19s |
| record-purchase | PASS | 1m 13s |
| payouts | PASS | 1m 10s |
| xirr-holding | PASS | 0m 54s |
| cash | PASS | 1m 18s |
| trade-correction | PASS | 2m 44s |
| holdings-csv-import | PASS | 1m 33s |
| epf-accounts | PASS | 1m 23s |
| ppf-account | PASS | 1m 44s |
| progress-snapshot-history | PASS | 0m 53s |
| value-masking | PASS | 1m 29s |
| persistence | PASS | 0m 55s |
| backup-roundtrip | PASS | 1m 35s |

## 2026-11-15: Full tier with the backup round trip (#671), 64 passed, 1 failed

- Commit: test/671-backup-maestro-tier f7fb712, version 1.0.31. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, E2E APK
  (R8 on, x86_64) freshly built from f7fb712, 58.7 MB, SHA-256 prefix
  136af3fc8fb9c329, Metro stopped. Command: `npm run maestro:test` with
  `COGVEST_APP_ID=com.abdulshaikh.cogvest.e2e`.
- Full tier: 64 passed, 1 failed, 80m 38s.
- backup-roundtrip passed in 1m 27s: it exports with the value mask on,
  restores into a cleared app, checks the preview counts, the restored records
  and totals, and the value mask after a restart.
- transactions-csv-import failed: the app showed NIFTYBEES invested
  ₹48,363.60 where the flow expected ₹48,351.60. The ₹12 is the fixture's
  fees 10 and taxes 2, which #649 now adds to average cost, so the expectation
  was stale rather than the app being wrong. After the flow was updated,
  transactions-csv-import (1m 38s) and zerodha-tradebook-import (3m 11s) both
  passed.

## 2026-11-10: Victory Native chart migration (#138), smoke 14 passed

- Commit: feat/asset-history-victory 3b1f8d8, version 1.0.30. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, E2E APK
  (R8 on, x86_64) freshly built from 3b1f8d8, 59.4 MB, Metro stopped.
- Smoke tier: 14 passed, 0 failed, 12m 53s.
- Chart flows, all passed: progress-chart-month-navigation,
  progress-chart-range, minimal-mode, ppf-history-fallback,
  shared-ui-hierarchy, snapshot-review, epf-progress-empty, epf-reporting and
  dashboard-valuation-basis (7m 26s).
- Checked by hand with `adb shell input motionevent`: a press-and-hold drag
  on the Progress chart moves the inspected month across the range and keeps
  the month on release. The screenshot shows the zero y-axis label and the
  Portfolio fill ending at zero. Pinch, two-finger pan and Reset zoom still
  need a check on a real device, because the emulator cannot inject
  multi-touch.

## 2026-11-08: Bulk payout confirmation (#619), smoke 14 passed

- Commit: feat/619-bulk-payout-confirmation da16a9d, version 1.0.30. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, cold boot,
  E2E APK (R8 on) freshly built from da16a9d, Metro stopped.
- Smoke tier: 14 passed, 0 failed, 11m 44s.
- The new payout-coverage flow (added to the full tier) passed with payouts,
  xirr-whole and xirr-holding: 4 passed, 2m 07s. It confirms two of three
  holdings and asserts the stored coverage records, the holding with a
  recorded payout left unoffered, and the note falling from 3 holdings to 1.

## 2026-11-07: Code-unit ordering for dates and ids (#138), full tier 63 passed with one rerun

- Commit: perf/138-ordinal-compare 041a7db, version 1.0.30. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, cold boot,
  E2E APK (R8 on) freshly built from 041a7db, Metro stopped.
- Full tier: 62 passed, 1 failed, 75m 03s. trade-correction failed while
  typing the cash label: the Maestro driver returned `DEADLINE_EXCEEDED`
  after 120 s, before any trade step. Environmental. It passed on its own
  right after (1m 58s).
- Startup stall, probe builds of main (6789968) and 041a7db, 250-asset
  scale fixture, cold-booted AVD, builds alternated in blocks of four cold
  launches. Largest event-loop delay in the first 5 s window, in ms:
  - main: 307, 292, 284, 292, 441, 400, 326, 377 (median 317)
  - 041a7db: 181, 182, 175, 222, 188, 205, 209, 188 (median 188)
  - The window after it was 28 to 35 ms for both.

## 2026-11-07: R8 release shrinking (#618), full tier 63 passed with one rerun

- Commit: build/618-enable-r8 69ea519 (R8 on, pdfbox keep rules), version
  1.0.30. AVD CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0,
  E2E APK (minified, as it inherits from release) freshly built from 69ea519,
  Metro stopped. The E2E APK shrank from 53.3 MB to 45.8 MB.
- Full tier: 62 passed, 1 failed, 73m 05s. holdings-csv-import could not
  save its template: the emulator's Documents folder already held
  `cogvest-holdings-v1.csv` and copies (1) to (32) from earlier runs, and
  Android stops numbering after 32. Environmental; the runner's cleanup had
  targeted an unused folder. 75ee271 removes the saved copies before the
  flow, and the flow then passed on a fresh R8 build of 75ee271.
- cas-native-import and cas-native-fresh-portfolio also passed on their own
  before the tier, so pdfbox still parses the synthetic CAS PDF under R8.

## 2026-11-07: expo/fetch as the global fetch (#618), smoke 14 passed

- Commit: fix/618-expo-fetch 569ad87 (`EXPO_PUBLIC_USE_RN_FETCH` removed),
  version 1.0.30. AVD CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font
  scale 1.0, E2E APK freshly built from 569ad87, Metro stopped.
- Smoke tier: 14 passed, 0 failed, 11m 49s. add-holding-lookup makes live
  provider requests through expo/fetch.
- A temporary probe build (not committed) compared expo/fetch with React
  Native's fetch on the same AVD. Aborts before a response, app-level
  timeouts, error statuses, refused connections and live Yahoo, CoinGecko
  and AMFI calls behaved the same. The difference: React Native's fetch
  resolves only after the whole body, while expo/fetch resolves at the
  headers. Aborting mid-body then resolves `text()` with a partial body
  (7 of 59 bytes in the probe). The AMFI readers now reject that.

## 2026-11-07: SDK 58 startup links (#618), full tier 63 passed after a cold boot

- Commit: fix/618-startup-links f886dd4 (Expo SDK 58, React Native 0.88.1),
  version 1.0.30. AVD CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font
  scale 1.0, E2E APK freshly built from f886dd4, Metro stopped.
- First pass: 10 passed, 53 failed, 101m 04s. The emulator had been up for 6
  hours (load average about 34). From the eleventh flow on, the Maestro
  Android driver timed out on start and launches with clear state failed, so
  most failures took 4 seconds. Environmental.
- After a cold boot, the 53 failed flows ran again unchanged: 53 passed, 0
  failed, 63m 37s. Combined, all 63 flows passed on the same APK.
- add-holding-pending-valuation also failed in the first pass before the
  driver timeouts began, while scrolling to the manual-price entry. It passed
  on the rerun; watch it for flakiness.
- The 14 flows that the startup-link race broke in the SDK 58 gate all
  passed, as did the fixed epf-persistence, investing-cash-migration, cash
  and add-trade flows.

## 2026-11-06: Expo SDK 58 final gate (#618), full tier 46 passed, 17 failed

- Commit: main 29fad29 (PR #629 merged), version 1.0.30. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, freshly
  built E2E APK (`com.abdulshaikh.cogvest.e2e`), Metro stopped.
- Full tier: 46 passed, 17 failed, 61m 31s. **The gate fails.** All 17 flows
  were rerun one at a time; 9 passed on rerun and 6 failed again.
- **Startup deep-link race (pre-existing, fixed in #631, 14 flows).** A link
  that arrives while the app is still starting is sometimes dropped, and the
  app stays on the Dashboard. Reproduced without Maestro: an adb `VIEW` link
  sent 0.6 to 1.0 s after a cold launch was dropped 2 times in 8. Later
  investigation showed the race predates SDK 58 (SDK 54 release dropped 4 of
  16 early links, SDK 58 release 1 of 16). React Native drops a link that
  arrives before its instance is ready, and the launch `<Redirect>` in
  `app/index.tsx` can override one that arrives at the same moment. #631
  holds and replays such links; see the 2026-11-07 entry.
  - Failed, then passed on rerun: add-holding-lookup, add-holding-pending-
    valuation, add-holding-unknown-date, sell-quote-context,
    cas-native-fresh-portfolio, futures-manual-wallet,
    futures-timestamp-evidence, opening-position-correction,
    bulk-transaction-delete.
  - Failed again at a link step: holdings, privacy-settings, and
    dashboard-valuation-basis (3 of 5 isolated runs).
  - add-trade and cas-native-import failed again at later steps, after the
    seed link had worked. add-trade's Review button was below the fold
    (flow fixed in #631); cas-native-import passed in the 2026-11-07 run.
- **Stale QA fixtures (existing harness bug, not SDK; fixed in #631).**
  epf-persistence and investing-cash-migration stage "legacy" data from today's full snapshot,
  which still carries the schema 17/18 fields. Storage rejects it as
  `invalid-shape` and preserves it for recovery, so the legacy Cash is
  missing. Reproduced in Jest on main; removing those fields lets the
  migration pass. This has been broken since schema 17/18 (30 Oct). Real
  stored data never has those fields.
- **Double-tap save timing (flow, not product; fixed in #631).** cash
  double-taps Save to prove one save. On SDK 58 the return to the Cash list is fast enough that
  the second tap opens the new entry's review screen. That screen shows a
  single ₹1,000.00 Broker cash entry.
- Evidence: [`2026-11-06-sdk58-final-gates.md`](2026-11-06-sdk58-final-gates.md).

## 2026-11-01: Simplified portfolio XIRR (#610), smoke 14 passed

- Commit: main 8831291 (PRs #611 and #612 merged), version 1.0.29. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, freshly
  built E2E APK, Metro stopped.
- Smoke tier: 14 passed, 0 failed, 11m 37s. xirr-holding 0m 33s.
- xirr-holding now asserts the +10.00% holding rate with the unrecorded-payouts
  note, and that the note goes once payouts are confirmed. xirr-whole (full
  tier) asserts the automatic start from the zero-value December 2024
  snapshot: +10.00% a year, "Estimate with 1 assumption", Put in ₹10,000.00,
  Current value ₹11,000.00, the trade assumption note and the start screen.
- Both passed in light, dark and font scale 1.3. Screenshots:
  `docs/reviews/artifacts/2026-11-01-simple-portfolio-xirr/`.

## 2026-10-30: Whole-portfolio XIRR (#533, #535), smoke 13 passed plus 1 rerun

- Commit: main (PR #604 merged) plus the whole-portfolio UI change. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, freshly
  built E2E APK, Metro stopped.
- Smoke tier: 13 passed, 1 failed, 11m 34s. holdings-csv-import failed at
  "Launch app with clear state" before any app step, and passed unchanged on
  rerun. Environmental. ppf-account (changed PPF entry screen) passed in 1m 18s.
- New flow xirr-whole (full tier only): it chooses Whole portfolio on the
  `xirr-qa` Dashboard and asserts the missing-start reason. Then it confirms a
  start of 01 Jan 2025 and marks the unlinked trade as paid from outside, and
  asserts +10.00% a year, Put in ₹10,000.00 and Current value ₹11,000.00.
  Passed in light, dark and font scale 1.3. Screenshots:
  `docs/reviews/artifacts/2026-10-30-whole-portfolio-xirr/`.
- `npm run test:v1:pc` passed. Its strict smoke check covers the installed
  development package; the E2E APK above is the fresh build under test.

## 2026-10-30: Dashboard Investments XIRR (#535), smoke 14 passed

- Commit: main (PR #602 merged) plus the #535 Dashboard XIRR change. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, freshly
  built E2E APK, Metro stopped.
- Smoke tier: 14 passed, 0 failed, 12m 31s. xirr-holding 0m 36s.
- xirr-holding now also opens the `xirr-qa` Dashboard page and asserts the
  Investments rate (+10.00% a year), Put in ₹10,000.00 and Current value
  ₹11,000.00 from the breakdown.
- xirr-holding passed in dark mode and at font scale 1.3. Dashboard
  screenshots: `docs/reviews/artifacts/2026-10-30-holding-xirr/xirr-*-dashboard.png`.

## 2026-10-30: Holding XIRR (#535), smoke 14 passed

- Commit: main (PR #600 merged) plus the #535 holding XIRR change. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, freshly
  built E2E APK, Metro stopped.
- Smoke tier (now 14 flows with xirr-holding): 14 passed, 0 failed, 11m 49s.
  xirr-holding 0m 30s.
- xirr-holding uses the isolated `xirr-qa` fixture (fixed clock, no quote
  refresh). It asserts the unavailable reason, then confirms payouts, the
  +10.00% rate, the period line and both audited flow amounts.
- xirr-holding also passed in dark mode and at font scale 1.3. Screenshots:
  `docs/reviews/artifacts/2026-10-30-holding-xirr/`.

## 2026-10-30: Payout records UI (#533), smoke 12 passed plus 1 fixed

- Commit: main (8ed13d6, PR #599) plus the #533 payout UI. AVD CogVest_UX_Proof,
  API 36, 1280x2856 at 480 dpi, font scale 1.0, freshly built E2E APK, Metro
  stopped.
- Smoke tier (now 13 flows with the new payouts flow): 12 passed, 1 failed,
  11m 14s. payouts 0m 42s.
- trade-correction failed at its quantity assertion: the new "Dividends and
  payouts" row in holding details moved the restored scroll offset past the
  quantity. Task-caused. The flow now scrolls back to the quantity first and
  passed on rerun.
- payouts also ran in dark mode and at font scale 1.3. The large-text run first
  failed because the holding row started below the fold; the flow now scrolls
  to it, and passed.
- Screenshots, light, dark and font scale 1.3:
  `docs/reviews/artifacts/2026-10-30-payouts/`.

## 2026-10-29: Copy budget (#562), smoke 12 passed plus 6 copy flows

- Commit: main plus the #562 copy-budget change. AVD CogVest_UX_Proof, API 36,
  1280x2856 at 480 dpi, font scale 1.0, freshly built E2E APK, Metro stopped.
- Smoke tier: 12 passed, 0 failed, 10m 36s.
- Flows asserting the changed copy, by path: privacy-settings 0m 18s,
  visual/app-copy 0m 29s, visual/settings-choice-controls 0m 30s,
  visual/settings-layout 0m 42s, visual/settings-tool-groups-controls 0m 34s,
  futures-timestamp-evidence 3m 30s. All passed.
- visual/settings-layout first failed at its persisted value-mask assertion,
  a step before any changed line, and passed unchanged on rerun. Flaky.
- Screenshots, light, dark and font scale 1.3:
  `docs/reviews/artifacts/2026-10-29-copy-budget/`.

## 2026-10-29: Futures shared observation time (#562), 5 Futures flows passed

- Commit: main plus the #562 Futures valuation change. AVD CogVest_UX_Proof,
  API 36, 1280x2856 at 480 dpi, font scale 1.0, freshly built E2E APK, Metro
  stopped.
- By path: futures-manual-wallet 2m 56s, futures-draft-protection 2m 19s,
  futures-timestamp-evidence 3m 24s, futures-cash-funding 2m 09s. All passed.
- standalone/futures-negative-equity first failed at its opening step: since
  #458 the exact-timestamp inputs sit behind an "Exact timestamp" toggle, which
  the flow never opened. Pre-existing. With the toggles opened it passed
  (2m 39s).
- Screenshots, light, dark and font scale 1.3:
  `docs/reviews/artifacts/2026-10-29-futures-valuation-time/`.

## 2026-10-29: Add holdings sheet (#562), smoke 12 passed plus 4 sheet flows

- Commit: main plus the #562 Add holdings sheet regrouping. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, freshly
  built E2E APK, Metro stopped.
- Smoke tier: 12 passed, 0 failed, 10m 31s.
- Flows that open the sheet, by path: funded-buy-cash 1m 31s, asset-correction
  2m 20s, holdings-list-first 1m 34s, workflow-exit-navigation 0m 29s. All
  passed.
- Screenshots with and without Cash, light, dark and font scale 1.3:
  `docs/reviews/artifacts/2026-10-29-add-holdings-sheet/`.

## 2026-10-29: E2E build variant (#560), full tier 60 passed against the E2E APK, debug smoke 12 passed

- Commit: main plus the #560 E2E build variant. AVD CogVest_UX_Proof, API 36,
  1280x2856 at 480 dpi, font scale 1.0.
- Full tier against the E2E APK (`com.abdulshaikh.cogvest.e2e`, release-mode
  JavaScript bundled in, built locally with `npm run android:e2e`), with Metro
  stopped, the debug app also installed and no deviceidle allowlist: 60 passed,
  0 failed, 70m 27s.
- Smoke tier against a freshly built debug APK with Metro, through the same
  `${APP_ID}`/`${SCHEME}` flows: 12 passed, 0 failed, 13m 22s.
- Cold launch to `dashboard-screen`, three runs each: E2E build 2.30s, 2.35s,
  2.48s; debug build with Metro already warm 10.95s, 11.63s, 11.63s.
- After the review added `metro.config.js` (Metro cache keyed on the harness
  flag), the E2E APK was rebuilt; its bundle contains the flag. Smoke tier
  against it, Metro stopped: 12 passed, 0 failed, 13m 31s.

## 2026-10-28: Progress hook split (#561), smoke 12 passed plus 6 Progress flows

- Commit: main plus the #561 useProgress split. AVD CogVest_UX_Proof, API 36,
  1280x2856 at 480 dpi, font scale 1.0, debug build with the split JS served
  by Metro, warmed by one app launch first, on a fresh emulator boot.
- Smoke tier: 12 passed, 0 failed, 12m 30s. progress-snapshot-history 0m 47s.
- Progress flows: 6 passed, 0 failed, 6m 01s. progress-chart-range 0m 58s,
  progress-chart-month-navigation 1m 07s, snapshot-review 0m 25s,
  epf-progress-empty 0m 52s, ppf-history-fallback 2m 13s, epf-reporting
  0m 27s.

## 2026-10-28: transaction import screen split (#561), smoke 12 passed plus 4 import flows

- Commit: main plus the #561 TransactionImportScreen split. AVD
  CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi, font scale 1.0, debug build
  with the split JS served by Metro, warmed by one app launch first.
- First attempt, 2026-10-26: 4 passed, 8 failed. cash failed when the Maestro
  driver's `inputText` call hit its 120s deadline. The driver then stayed
  unreachable (gRPC UNAVAILABLE) and the emulator's shared storage crashed
  ("Transport endpoint is not connected" on `/sdcard`), so every later flow
  and an immediate rerun failed at launch or file setup. Environmental. The
  emulator was restarted.
- Smoke tier after the restart, 2026-10-27: 12 passed, 0 failed, 12m 53s.
- Import flows, 2026-10-28, on a fresh emulator boot: 4 passed, 0 failed,
  8m 33s. transactions-csv-import 1m 30s, zerodha-tradebook-import 2m 46s,
  cas-native-import 2m 36s, cas-native-fresh-portfolio 1m 41s.

## 2026-10-25: Add Holding hook split (#561), smoke 12 passed plus 11 Add Holding flows

- Commit: main plus the #561 useAddOpeningPosition split. AVD and build as
  below; the split JS served by Metro, warmed by one app launch first.
- Smoke tier: 12 passed, 0 failed, 15m 56s (56s over budget).
- By path: add-holding-asset-class 1m 56s, add-holding-asset-switch 1m 58s,
  add-holding-edited-quote 1m 04s, add-holding-manual-semantics 1m 42s,
  add-holding-pending-valuation 1m 56s, add-holding-review-hierarchy 1m 35s,
  add-holding-unknown-date 1m 17s, add-trade 1m 32s, quick-portfolio-setup
  3m 34s, workflow-exit-navigation 0m 49s. All passed.
- add-holding-back failed at launch, before any app code ran: the dev
  runtime showed "runtime not ready: Cannot create devtools websocket
  connections". Environmental. Rerun alone, it passed (1m 30s).

## 2026-10-25: transaction import hook split (#561), smoke 12 passed plus 4 import flows

- Commit: main plus the #561 useTransactionImport split. AVD and build as
  below; the split JS served by Metro.
- The emulator ran 2 to 3 times slower than in earlier runs today, in every
  flow, including flows the split does not touch. Environmental.
- First smoke run: 11 passed, 1 failed, 32m 46s. smoke-launch timed out on
  "Bundling 100.0%" with a cold Metro cache after a restart. Import flows:
  zerodha-tradebook-import 5m 37s, cas-native-import 6m 42s and
  cas-native-fresh-portfolio 3m 43s passed. transactions-csv-import saved the
  import and opened Holdings with "Transaction history imported.", but after
  its 10s wait for `holdings-screen`.
- Rerun of the two failures with Metro warm: smoke-launch 1m 22s,
  transactions-csv-import 2m 48s. Both passed.
- Second smoke run: 12 passed, 0 failed, 23m 41s. Over budget because of the
  slow emulator.

## 2026-10-25: Dashboard screen split (#561), smoke 12 passed plus 7 Dashboard flows

- Commit: main plus the #561 DashboardScreen split. AVD and build as below;
  the split JS served by Metro.
- Smoke tier: 12 passed, 0 failed, 14m 50s, inside the budget.
- By path: dashboard-valuation-basis 0m 37s, minimal-mode 1m 10s,
  epf-reporting 0m 32s, futures-cash-funding 2m 55s,
  add-holding-pending-valuation 3m 28s, quick-portfolio-setup 4m 48s,
  contextual-nudges 2m 49s. All passed.
- A screenshot of the seeded Dashboard matched the unsplit screen.

## 2026-10-25: progress-snapshot-history back fix, smoke 12 passed plus 4 back flows

- Commit: main plus the Modal back-request fix. AVD and build as below; the
  fix JS served by Metro.
- Cause of the earlier flake: React Native 0.81 can deliver one Android back
  press to a Modal's `onRequestClose` twice (about 41ms apart), so Monthly
  History stepped back from the month and then closed. The fix ignores a
  second request within 300ms.
- A scratch flow repeating month → back → assert 10 times passed (1m 50s);
  before the fix it failed by about the 10th press.
- progress-snapshot-history alone 3 times: 0m 46s, 0m 45s, 0m 46s.
- progress-chart-range 1m 00s, cash 0m 50s, cash-entry-focus 1m 27s.
- Smoke tier: 12 passed, 0 failed, 13m 42s.

## 2026-10-25: PPF account screen split (#561), smoke 11 of 12 then rerun, plus 3 PPF flows

- Commit: main plus the #561 PpfAccountScreen split. AVD and build as below;
  the split JS served by Metro.
- The first attempt failed in every flow within seconds: the emulator had
  exited, so Maestro found no device. Environmental. After restarting the AVD:
- Smoke tier: 11 passed, 1 failed, 18m 11s (over budget). ppf-account passed
  (2m 01s). progress-snapshot-history failed at the same step as on
  2026-10-23. That is now 2 of the last 3 smoke runs. It passed when rerun
  alone (0m 46s).
- By path: ppf-history-fallback 2m 13s, holdings-list-first 1m 47s,
  quick-portfolio-setup 2m 59s. All passed.

## 2026-10-23: Add Holding form split (#561), smoke 11 of 12 then rerun, plus 12 Add Holding flows

- Commit: main plus the #561 AddOpeningPositionForm split. AVD and build as
  below; the split JS served by Metro.
- Smoke tier: 11 passed, 1 failed, 16m 02s (over budget). The failure was
  progress-snapshot-history: the `back` from a month's detail closed the whole
  Monthly History panel while "Checking monthly history" was running, so
  `snapshot-month-2026-05` was not visible. The split doesn't touch that code.
  Rerun alone, it passed (0m 57s). Treat that `back` step as flaky while
  snapshot automation is running.
- By path: add-holding-asset-class 1m 59s, add-holding-asset-switch 1m 57s,
  add-holding-back 1m 23s, add-holding-edited-quote 1m 02s,
  add-holding-manual-semantics 1m 33s, add-holding-pending-valuation 1m 49s,
  add-holding-review-hierarchy 1m 31s, add-holding-unknown-date 1m 14s,
  add-trade 1m 30s, quick-portfolio-setup 3m 38s, workflow-exit-navigation
  0m 53s, contextual-nudges 2m 10s. All passed.

## 2026-10-23: Progress screen split (#561), smoke 12 passed plus 8 Progress flows

- Commit: main plus the #561 Progress split. AVD and build as below; the split
  JS served by Metro.
- Smoke tier: 12 passed, 0 failed, 14m 52s, inside the budget but close to it.
- By path: progress-chart-month-navigation 1m 15s, progress-chart-range
  1m 08s, snapshot-review 0m 31s, epf-progress-empty 0m 59s,
  ppf-history-fallback 2m 54s, epf-reporting 0m 36s, minimal-mode 1m 13s,
  contextual-nudges 2m 06s. All passed.

## 2026-10-22: Holdings screen split (#561), smoke 12 passed plus 10 Holdings flows

- Commit: main plus the #561 Holdings split. AVD and build as below; the
  debug build from earlier the same day, with the split JS served by Metro.
- Smoke tier: 12 passed, 0 failed, 15m 08s. That is 8s over budget because
  smoke-launch took 2m 13s on a cold Metro bundle; other flows were within
  their usual range.
- By path: holdings 1m 12s, holdings-list-first 1m 55s,
  holdings-list-first-layout 0m 49s, holding-duration 0m 48s, minimal-mode
  1m 15s, opening-position-correction 1m 31s, asset-correction 3m 12s,
  workflow-exit-navigation 0m 44s, sell-quote-context 1m 05s,
  add-holding-pending-valuation 1m 43s. All passed.

## 2026-10-22: final #559 batch, 13 flows passed

- Commit: main plus the final selector batch. AVD and build as below; flows
  run by path.
- bulk-transaction-delete 0m 43s, cash-entry-focus 1m 27s, contextual-nudges
  1m 54s, holding-duration 0m 46s, insight-details 0m 56s, minimal-mode 1m 06s,
  privacy-settings 0m 27s, settings-preference-hierarchy 1m 01s,
  epf-corrections 1m 24s, epf-reporting 0m 28s, workflow-exit-navigation
  0m 40s, ppf-history-fallback 2m 19s.
- dashboard-valuation-basis failed at `assertVisible: "₹15.9L"`, and so did
  the unchanged flow from main. It launched without clearing state, and the
  visual QA seed keeps an existing Futures wallet, so a Futures wallet left by
  an earlier flow raised the total to ₹23.1L. The full tier runs it before any
  Futures flow, which hid this. With `clearState: true` it passed (0m 33s),
  including directly after futures-cash-funding.

## 2026-10-22: import and add-holding flows after the #559 batches, 14 passed

- Commit: main plus the import and add-holding selector batches. AVD and build
  as below; flows run by path.
- zerodha-tradebook-import 2m 50s, quick-portfolio-setup 3m 00s.
- add-holding-asset-class 1m 31s, add-holding-asset-switch 1m 39s,
  add-holding-edited-quote 0m 50s, add-holding-manual-semantics 1m 22s,
  add-holding-pending-valuation 1m 37s, add-holding-review-hierarchy 1m 19s,
  add-holding-unknown-date 1m 02s, add-trade 1m 15s, asset-correction 2m 53s,
  funded-buy-cash 1m 50s, holdings 1m 09s, opening-position-correction 1m 29s.

## 2026-10-22: futures flows after the #559 futures selector batch, 3 passed

- Commit: `61788f1` (main) plus the futures selector batch and the
  `dashboard-review-futures` testID. AVD and build as below; flows run by path.
- futures-manual-wallet: PASS, 3m 17s. futures-cash-funding: PASS, 2m 21s.
- futures-timestamp-evidence: the first run failed scrolling to the INR equity
  value `₹90810`, a step the batch only annotated. The unchanged flow from main
  then passed (3m 53s), and the batch version passed twice (4m 07s, 4m 14s).
  Treat that scroll as flaky on this AVD.

## 2026-10-22: smoke tier after the #559 selector conversion, 12 passed, 0 failed, 12m 13s

- Commit: `c26a90f` (main) plus the #559 changes: selector lint, smoke-flow
  selectors converted to testIDs, and the `review-cash-entry-*` testID.
- AVD, build and command: as below.
- Per-flow durations are within 8 seconds of the previous run.

## 2026-10-22: smoke tier, 12 passed, 0 failed, 12m 15s

- Commit: `d48d8bf` (main) plus the #558 runner change.
- AVD: `CogVest_UX_Proof`, API 36, 1280x2856 at 480 dpi, font scale 1.0.
- Build: debug APK from `npm run android:apk:emulator`, served by Metro.
- Command: `npm run maestro:smoke`.

| Flow | Result | Duration |
| --- | --- | --- |
| smoke-launch | PASS | 0m 25s |
| navigation | PASS | 0m 24s |
| add-holding-lookup | PASS | 1m 10s |
| record-purchase | PASS | 0m 58s |
| cash | PASS | 0m 47s |
| trade-correction | PASS | 2m 00s |
| holdings-csv-import | PASS | 1m 11s |
| epf-accounts | PASS | 1m 09s |
| ppf-account | PASS | 1m 24s |
| progress-snapshot-history | PASS | 0m 42s |
| value-masking | PASS | 1m 17s |
| persistence | PASS | 0m 47s |

# Maestro E2E Run Log

Record every full-tier run (weekly and before a release gate) and any smoke run
used as PR evidence. Newest first. See [`maestro-e2e.md`](maestro-e2e.md) for
the run cadence.

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

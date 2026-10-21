# Maestro E2E Run Log

Record every full-tier run (weekly and before a release gate) and any smoke run
used as PR evidence. Newest first. See [`maestro-e2e.md`](maestro-e2e.md) for
the run cadence.

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

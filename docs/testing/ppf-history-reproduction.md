# PPF History Regression (#324)

## Contract

A recent PPF baseline does not establish historical PPF balances. Complete
portfolio snapshots remain blocked for those months; never backdate the current
balance or store an incomplete total as a full snapshot.

Progress can nevertheless reconstruct a separate market-and-cash chart from
dated records and the existing price evidence. This view excludes every PPF
account and linked legacy PPF record for every displayed month. It does not mix
with stored full snapshots. Estimated price fallback is disclosed, comparative
returns are hidden, and missing valuations break the series: show only the
latest uninterrupted valued run. The full snapshot history and review flow
remain unchanged. No persistence schema changes are required.

## Repeatable Native Check

Use a disposable emulator: the following flow clears CogVest's synthetic data.
Build and install a fresh local APK using the release process, then run:

```powershell
npm run maestro:test -- e2e/ppf-history-fallback.yaml
```

The flow creates a synthetic HDFC PPF account (FY 2020 opening, INR 720,000
confirmed baseline, INR 150,000 current-FY contribution) dated today. It then
adds 10 Reliance units at INR 2,500 cost and INR 2,600 manual current price, with
the first purchase dated in 2024 via the native calendar. The regression needs
at least two completed months after that date. Provider history may replace
estimated prices, so the native flow does not assert a fabricated fixed series.

It asserts that Progress renders both chart surfaces, the PPF exclusion notice,
and the market-plus-cash selected value without an ahead-of-invested claim.
It captures both chart screenshots. Deterministic domain/hook tests cover the
exact September 2024 / September 2026 case, stored snapshot non-mutation,
missing prices, legacy PPF exclusion, uniform coverage, warning deduplication,
custom ranges, value masking, and insufficient history.

## Verified 11 September 2026

- Reproduced the original failure on phone preview 1.0.2/build 3 using a
  September 2024 stock opening and a PPF checkpoint on 10 September 2026.
- Built a fresh privately signed x86_64 local release APK, installed with
  `adb install -r`, and passed the native flow on emulator-5554, Android API 36.
- APK SHA-256: `40A09ACAF98C3C809EA14F2F28E1E9A6F951B939BE5FC353A6243D4CF1FA052E`.
- APK also contained the pending #322 onboarding navigation changes in this
  worktree. This evidence does not claim that #322's complete acceptance criteria
  have been verified, nor is this emulator-only artifact a new phone release.
- Inspected both chart screenshots and the status panel. The original repeated
  monthly warnings became one PPF-history explanation. Cached provider prices
  updated the initial manual-price series during the run, as expected.
- `npm run test:v1:pc` passed: 1,275 tests, 17/17 Expo Doctor checks, emulator
  readiness and installed package smoke. An additional one-month UI regression
  then passed in the focused 42-test ProgressScreen suite.
- Independent code review findings were corrected and the correction pass had
  no material findings. No EAS build was triggered.

Local evidence is ignored under `.expo/ppf-snapshot-repro/`; Maestro logs are
under the local run `2026-09-11_005758`. Do not commit personal phone photos or
statements. The earlier temporary Android user was removed. Low emulator disk
space interrupted the initial stock-only control run; the final fresh-APK flow
completed on the original emulator user after cleanup.

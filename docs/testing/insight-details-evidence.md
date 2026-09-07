# Insight Detail Verification (#19)

Verified 8 September 2026 on `feat/issue-19-insight-details`.

## Contract And Coverage

- Dashboard investment-pattern rows open typed conviction, planned holding-period,
  and frequency details. UI does not recalculate financial results.
- Observation period, coverage counts, methodology and limitations accompany each
  result. Supporting records are revealed ten at a time, not an unbounded initial
  list. Insufficient conviction history does not display a distribution of zeroes.
- Masking hides observations and record evidence. Minimal Mode hides entries and
  suppresses deep-linked details. Unknown kinds have a safe exit.
- Component/domain tests cover corrected names, removed records and plans,
  orphaned/future records, available/insufficient states, Back/Done and hardware
  Back cleanup. No persistence schema or financial thresholds changed.
- The engine has no dismissal state. Done closes the screen; persistent dismissal
  is not claimed or silently introduced.

## Automated Results

- `npm run test:verify`: passed.
- `npm run test:v1:pc`: passed; 100 suites / 1,043 tests, Expo Doctor 17/17,
  Android readiness and strict installed-package smoke checks passed.
- `maestro --device emulator-5556 test e2e/insight-details.yaml`: passed.
  The journey seeds synthetic records with explicit confirmation, opens from
  Dashboard, verifies HDFC Bank's opening-position conviction 4/5, tests masking,
  all three kinds, an invalid link, safe exits and Minimal Mode.
- The new journey is registered in the default local Maestro runner. The existing
  Minimal Mode flow now expects Investment patterns instead of the old placeholder.

## Android And Visual Evidence

Used the disposable `CogVest_Render_Control` Android 16.1 AVD on port 5556.
The original emulator on 5554 and its retained data were not reset or replaced.
Built the current native project with local Gradle `assembleDebug` for x86_64,
installed `android/app/build/outputs/apk/debug/app-debug.apk`, and served this
branch's JavaScript through Metro. This is debug-app functional/visual evidence,
not standalone release-mode performance evidence. No EAS build ran.

Inspected actual empty and seeded conviction, frequency and Dashboard screenshots
against `DESIGN.md`: readable hierarchy, unobstructed controls, quiet grouped rows,
safe-area spacing, and no clipped text in the tested viewport. The correction pass
removed unnecessary zero-distribution rows and prominent repeated entry buttons.
Impeccable's source detector reported no findings; it does not prove native layout
correctness. Review was sequential, without independent subagents.

Local artifacts (ignored, not portable source contracts):

- `.expo/issue19-conviction-final.png`
- `.expo/issue19-dashboard-final.png`
- `.expo/issue19-frequency.png`
- `.expo/issue19-maestro/` (successful and initial failed-run diagnostics)

## Environment Notes

Initial Jest runs stalled; focused checks succeeded with `--watchman=false
--roots src`, then the normal aggregate commands passed. Expo prebuild also stalled
at native directory/template discovery. Since this task changes no native config
or dependencies, verification used the existing native Gradle project.

The disposable debug app initially could not reach `10.0.2.2:8081`. Use
`adb -s emulator-5556 reverse tcp:8081 tcp:8081`, then set **Change Bundle Location**
in the React Native developer menu to `localhost:8081`. A temporary Metro config
disabled Watchman during this session; it was removed rather than shipping an
unrelated tooling change. Wait for Dashboard after cold launch before opening the
seed link; the initial E2E attempt raced JavaScript startup and was corrected with
an explicit readiness assertion, not a weakened result assertion.

Performance investigation #299 remains parked. Large-font/physical-phone and full
release-mode verification are not claimed by this focused feature check.

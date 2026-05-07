# CogVest Verification Baseline

Date: 2026-05-06

Status: historical verification snapshot. #72 was later addressed by PR #78;
re-run `npm run test:v1:pc` and Maestro before using this as current release
evidence.

Environment:

- OS shell: Windows PowerShell
- Node: `v24.11.1`
- Emulator: `emulator-5554`
- Android app package: `com.abdulshaikh.cogvest`
- Maestro: `2.5.1`

## Commands Run

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | Pass | `tsc --noEmit` exited `0`. |
| `npm test` | Pass | `25` test suites passed, `79` tests passed. |
| `npm run doctor` | Pass | Expo Doctor ran `17` checks; `17/17` passed. |
| `npm run android:doctor` | Pass | Node, npm, npx, adb, `emulator-5554`, Expo CLI, package scripts, and Maestro detected. |
| `npm run android:smoke` | Pass | adb found, `emulator-5554` connected, package `com.abdulshaikh.cogvest` installed. |
| `npm run maestro:check` | Pass | Java, adb, `emulator-5554`, Maestro `2.5.1`, and app package detected. |
| `npm run test:v1:pc` | Pass | Typecheck, Jest, Expo Doctor, Android Doctor, and strict installed-app smoke all passed. |
| `$env:MAESTRO_CLI_NO_ANALYTICS='1'; npm run maestro:test` | Fail | `e2e/smoke-launch.yaml` passed; `e2e/navigation.yaml` failed after tapping `tab-holdings`. |

## Maestro Failure

Passing flow:

- `e2e/smoke-launch.yaml`
- Confirmed `dashboard-screen`, Dashboard text, Holdings text, Progress text,
  and absence of `Unmatched Route`.

Failing flow:

- `e2e/navigation.yaml`
- Failure point: after `tapOn id: tab-holdings`, assertion
  `id: holdings-screen is visible` failed.
- Maestro debug output: `C:\Users\abdul\.maestro\tests\2026-05-06_214033`

## Interpretation

The static and local harness gates are healthy. The app package is installed and
launches to Dashboard. Full emulator E2E is blocked by the known navigation
defect tracked as #72.

The V1 dev-complete gate cannot be considered fully satisfied until #72 is fixed
and the Maestro navigation/core-flow suite passes or defects are explicitly
logged for each failing flow.

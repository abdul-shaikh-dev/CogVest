# Monthly History table verification

Issue: #399. Synthetic local visual-QA data only; no personal portfolio data is in these captures.

## Installed build

- AVD: `CogVest_UX_Proof`, Android API 36, x86_64.
- Build: fresh local debug APK (`npm run android:apk:emulator`), installed with `adb install -r` after the final UI change.
- APK SHA-256: `D383C9506E2FEC2CAB6A6A60EBA5D9098DADF61DED478932DE63544E13CE3F2A`.
- Display: 1280x2856 px at 480 dpi (about 427dp), font scale 1.0; 1080x2400 px at 480 dpi (360dp), font scale 1.3.
- Maestro flow: `e2e/visual/monthly-history-table.yaml` passed at 360dp/130%, including horizontal scrolling and selecting 2016 from an 11-year, 120-month fixture. The short and long fixture captures also passed at the default configuration.

## Evidence

| Configuration | Short history | 120-month history | Oldest year selected |
| --- | --- | --- | --- |
| 427dp / 100% | [short](artifacts/2026-09-23-monthly-history/default-short.png) | [long](artifacts/2026-09-23-monthly-history/default-long.png) | Not captured |
| 360dp / 130% | [short](artifacts/2026-09-23-monthly-history/narrow-short.png) | [long](artifacts/2026-09-23-monthly-history/narrow-long.png) | [2016](artifacts/2026-09-23-monthly-history/narrow-oldest-year.png) |

The visible rows contain only month, portfolio value, and signed monthly change; their columns remain aligned at both sizes. The year selector stays on one line. The detail view and TalkBack labels retain the exact comparison month; unit tests cover missing months, zero baselines, estimated prices, masking, and cross-year comparisons.

## Checks

- `npm run test:verify`: passed (167 suites, 1754 tests; 1 suite and 3 tests pre-existing skipped; 17/17 Expo Doctor checks).
- `npm run test:v1:pc`: passed, including Android Doctor and strict installed-package smoke check.
- `e2e/progress-snapshot-history.yaml`: passed on the installed APK, asserting exact fixture values in month details plus year selection and Android Back behavior.
- No external price provider, actual portfolio, or release APK was tested by this UI-only change.

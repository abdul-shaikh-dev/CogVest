# Holdings List-First Verification

Scope: approved #278 preview, implementation in PR #279.
Baseline: `7d927f5` on `design/holdings-list-first`.
Date: 2026-09-06.

## Runtime Identity

`npm run android:apk:emulator` rebuilt the local debug APK successfully. Installed
with `adb -s emulator-5554 install -r android/app/build/outputs/apk/debug/app-debug.apk`.
SHA256: `AC6D159045E3AEBDF9EEC43F303D445009109EFBAFCEFD7B8F4AB3C2FF2A2F7A`.
The native hash is unchanged from the previous task because this change is
JavaScript-only. The freshly installed debug APK loads this branch's current
source from Metro on port 8081, with adb reverse configured.

This is not standalone release or physical-phone certification. No EAS build,
new dependency, financial schema, or provider change was made. Expo prebuild's
unrelated generated iOS script was removed rather than committed.

## Verification Results

- `npm run test:v1:pc`: passed; 97 suites, 984 tests, typecheck, Expo doctor
  17/17, Android doctor and strict installed-package smoke.
- Focused Holdings component suite: 33 passed. Covers four/30 positions, search,
  retained filters, single-row expansion, PPF-only/mixed/legacy records, correction
  callbacks, resumed setup, masking, quote failures, incomplete allocation and
  both reduced-motion preferences.
- Preview: eight DOM scenarios passed; loopback server returned HTTP 200.
- Native Maestro: `holdings.yaml`, `ppf-account.yaml`,
  `add-holding-pending-valuation.yaml`, `minimal-mode.yaml` and
  `asset-correction.yaml`, `holdings-list-first.yaml` and
  `holdings-list-first-layout.yaml` passed (seven distinct flows).

The new `holdings-list-first.yaml` checks the initial list, HDFC's stored
investment (25 x INR 1,450 = INR 36,250), expansion, insights, Android Back,
masking, management and both import destinations. It also creates a synthetic
INR 100,000 PPF account and checks its confirmed amount and Market/PPF navigation.
The original test expectation accidentally used a preview amount, not the seeded
record; it was corrected without changing production data or calculations.

`holdings-list-first-layout.yaml` passed at 360dp / 130% text. It checks empty,
no-results, first-row visibility and both Insights/Valuation panels. All flows
use synthetic developer data and are registered in the local Maestro runner.

## Visual Review

Default configuration: Pixel 10 Pro emulator, 1280 x 2856, density 480
(approximately 427dp wide), font scale 1.0. All four compact market rows fit
without pre-list scrolling; the acceptance threshold is three.

Narrow configuration: `adb shell wm size 1080x2400`, density 480 (360dp),
`adb shell settings put system font_scale 1.3`. The first row is fully visible
without scrolling. Header actions and filters wrap rather than shrinking text.
Panel headings now wrap without pushing Back/Close beyond the sheet; this was
caught by screenshot review after the visibility assertions had passed.

Impeccable-guided native review retained the approved colors and card details,
removed the front-loaded insight/PPF promotion stack, and corrected panel header
overflow. Owned-diff review also restored legacy PPF details/correction paths,
fixed its destination count, and withheld misleading incomplete allocation.

Restore after the narrow check:

```powershell
adb -s emulator-5554 shell am force-stop com.abdulshaikh.cogvest
adb -s emulator-5554 shell wm size reset
adb -s emulator-5554 shell settings put system font_scale 1.0
```

The emulator was restored to its default display settings before the final
regression journeys. Synthetic captures:

- [Default list](artifacts/holdings-list-first/top.png)
- [Expanded position](artifacts/holdings-list-first/expanded.png)
- [Insights](artifacts/holdings-list-first/insights.png)
- [Masked values](artifacts/holdings-list-first/masked.png)
- [Mixed PPF destination](artifacts/holdings-list-first/ppf.png)
- [360dp / 130% list](artifacts/holdings-list-first/enlarged.png)
- [Enlarged insights](artifacts/holdings-list-first/enlarged-insights.png)
- [Enlarged valuation panel](artifacts/holdings-list-first/enlarged-details.png)
- [Empty portfolio](artifacts/holdings-list-first/empty.png)
- [No search results](artifacts/holdings-list-first/no-results.png)
- [Pending valuation](artifacts/holdings-list-first/pending.png)

## Coverage Limits

Thirty-position rendering/search and legacy conversion/correction dispatch are
component-tested; native captures use four market positions and a PPF account.
Quick Setup resume is callback-tested, not a newly rerun full onboarding journey.
Imports are checked as reachable destinations, not re-certified parsers.
Provider failures are deterministic test scenarios, not a provider uptime claim.
No standalone release performance, full TalkBack, physical-phone or HTML
pixel-parity certification is claimed. Existing compact-row ellipsis and bottom
navigation typography are unchanged by this issue.

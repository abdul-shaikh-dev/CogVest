# Settings Preference Hierarchy: UX-14 / #288

Base: `e4399a6`. Branch: `fix/settings-preference-hierarchy`.

## Contract

Working Value masking and Standard/Minimal controls lead. The masking preview
and scope remain visible; its accessible hint names quantities, percentages and
unit prices that remain visible. Existing preference persistence is unchanged.

Privacy & storage is a compact disclosure with the existing app-private storage,
separate-encryption limitation, disabled backup/transfer and no account/cloud
sync/analytics facts retained. Price information is a separate disclosure using
plain source/date language. Saved provider prices are not called live availability;
the newest price-update date is explicitly not a refresh timestamp.

Settings's existing source summary reads separate quote records, not opening
position prices. The disclosure now states that initial-holding prices may also
be in use and points to Dashboard for valuation coverage. This avoids misleading
zero-valuation claims without changing selectors or financial behavior.

About is informational: INR reporting currency and configured Expo app version
(explicit unavailable fallback). The unimplemented Clear local data card is
removed, not implemented. No persistence, domain, dependencies or provider changes.

## Repeatable Verification

- `npm run test:v1:pc` for typecheck, tests, Expo doctor and Android readiness.
- Build/install fresh locally following `docs/release/android-release-process.md`.
  Debug builds need current-branch Metro on 8081 and `adb reverse tcp:8081 tcp:8081`.
- `npm run maestro:test -- e2e/settings-preference-hierarchy.yaml e2e/privacy-settings.yaml`.
  These reset synthetic emulator data. The preference journey checks masking and
  Minimal mode against actual Dashboard values/content, restarts the app, verifies
  persisted checked states, then restores Standard/unmasked and checks price/About
  information. The privacy journey checks encryption and backup limitations.
- Repeat the preference journey at 360dp / 130% text; capture original `wm size`
  and `font_scale`, then restore both afterward. This device uses 480 density:
  `adb shell wm size 1080x2410`, `adb shell settings put system font_scale 1.3`.

## Build Evidence

Expo prebuild stalled at native-directory creation. Its task-owned process was
stopped and confirmed exited before a single serial Gradle fallback:
`android\gradlew.bat -p android assembleDebug -PreactNativeArchitectures=x86_64`.
The unchanged native project built successfully in 1m55s. No overlapping build,
native configuration change, or cloud build was needed.

APK installed on Pixel_10_Pro / emulator-5554 at 2026-09-06 21:51:57. SHA256:
`AC6D159045E3AEBDF9EEC43F303D445009109EFBAFCEFD7B8F4AB3C2FF2A2F7A`.
This is the native-shell hash; current branch JavaScript is served by Metro.

## Review

Impeccable distillation informed preference-first order, short copy and disclosure
instead of unsupported controls. Independent Terra review identified the difference
between quote records and manual initial prices; the corrected wording explicitly
limits the summary's coverage. Historical audit content remains unchanged.

## Verification Results

- Full `test:v1:pc` gate passed: 97 suites / 1,007 tests, typecheck, Expo doctor
  17/17, Android readiness and strict package smoke.
- Focused Settings suite passed 9/9, including all source combinations, initial
  manual prices, disclosure states, preference persistence and version fallback.
- Standard Settings-tab journey and privacy journey passed. The same journeys
  passed at 360dp / 130% text. Native review found the price-date row's side-by-side
  explanation too narrow; it was changed to stacked text and focused tests passed.
- Initial debug launch failed because Metro was absent. After starting Metro,
  cold bundling exceeded the next run's launch wait; warm runs passed without
  changing assertions. These were development-runtime failures, not release tests.
- The preference flow uses the Settings tab, not only the standalone Settings
  deep link. It verifies actual masked Dashboard amounts and Minimal content
  before checking persisted states after restart.
- Final enlarged preference journey passed after the stacked-date correction;
  focused Settings plus Maestro inventory tests passed 10/10. Original
  1280x2856 size and 1.0 font scale were restored.

## Screenshots

- [Settings](artifacts/settings-preference-hierarchy/ux14-settings.png)
- [Price updates](artifacts/settings-preference-hierarchy/ux14-prices.png)
- [About](artifacts/settings-preference-hierarchy/ux14-about.png)
- [Enlarged Settings](artifacts/settings-preference-hierarchy/enlarged-settings.png)
- [Enlarged price updates](artifacts/settings-preference-hierarchy/enlarged-prices.png)
- [Enlarged About](artifacts/settings-preference-hierarchy/enlarged-about.png)
- [Enlarged privacy](artifacts/settings-preference-hierarchy/enlarged-privacy.png)
- [Enlarged backup limitation](artifacts/settings-preference-hierarchy/enlarged-backup.png)

## Limits

Debug APK plus Metro evidence is not standalone-release, live-provider availability,
physical-phone or full TalkBack certification. No real financial files are loaded.

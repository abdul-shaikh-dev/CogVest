# Settings choice and disclosure verification

Issue #403. Empty local test portfolio; no personal records in the evidence.

## Fresh installed build

- Built using `EXPO_OFFLINE=1 npm run android:apk:emulator`, then installed with `adb install -r`.
- Pixel_10_Pro, emulator-5554, API 36, x86_64. Debug APK with current branch JavaScript served by a restarted Metro server, not a release-bundle test.
- APK SHA-256: `D383C9506E2FEC2CAB6A6A60EBA5D9098DADF61DED478932DE63544E13CE3F2A`.
- Default: 1280x2856 / 480 dpi, approximately 427dp, font scale 1.0. Enlarged: 1080x2400 / 480 dpi, 360dp, font scale 1.3.
- Original display and accessibility settings restored after verification. No EAS build or submission.

## Visual review

| Surface | Evidence | Observed result |
| --- | --- | --- |
| Normal preferences | [427dp](artifacts/2026-09-26-settings-controls/issue403-default-choices.png) | Radio indicators replace Choose/Selected. Concrete descriptions and masking limitations remain visible. |
| Enlarged preferences | [360dp / 130%](artifacts/2026-09-26-settings-controls/issue403-narrow-choices.png) | Labels wrap within the radio row; indicators stay attached to their choice. |
| Navigation and disclosures | [Destinations](artifacts/2026-09-26-settings-controls/issue403-narrow-destinations.png) | Forward arrows identify backup destinations; down/up arrows identify expandable sections. Restore replacement and unencrypted-copy warnings remain explicit. |
| Privacy expanded | [Privacy](artifacts/2026-09-26-settings-controls/issue403-narrow-privacy.png) | Local storage, encryption limitations and manual-backup warning remain readable. Passive rows have no navigation arrow. |
| Prices expanded | [Prices](artifacts/2026-09-26-settings-controls/issue403-narrow-prices.png) | Matching disclosure indicator; price provenance and dates remain informational rather than buttons. |

No clipping or detached action label was found in the changed controls at these configurations. Existing informational detail rows still wrap more at large text; no dense-layout rewrite was made.

## Accessibility and checks

TalkBack was enabled for the installed app. Tap/double-tap interaction changed Standard to Minimal, turned masking off, and expanded Privacy. Android exposed `android.widget.Switch`, two `android.widget.RadioButton` nodes, and named disclosure buttons. The selected-state trees demonstrate exclusive mode selection and the masking state change:

- [Before selection](artifacts/2026-09-26-settings-controls/issue403-a11y.xml)
- [Minimal selected](artifacts/2026-09-26-settings-controls/issue403-a11y-selected.xml)
- [Masking off and privacy expanded](artifacts/2026-09-26-settings-controls/issue403-a11y-expanded.xml)

Decorative control icons are hidden from accessibility. Component tests verify expanded/collapsed state, choice hints, persisted preferences, passive row semantics and backup destinations. Spoken audio/pronunciation was not independently heard or recorded; this is not a full manual screen-reader audit.

- `npm run test:v1:pc`: passed (typecheck, 167 suites / 1762 tests, 17/17 Expo Doctor checks, Android Doctor, strict installed-package smoke). One suite / three tests remain pre-existing skips.
- `e2e/visual/settings-choice-controls.yaml`: passed at both sizes, including both display choices, masking, disclosures and explicit privacy/price text assertions.
- `git diff --check`: passed. Reviewed only the owned diff; preference storage, backup behavior and financial calculations are unchanged.

Reproduce using `maestro --device emulator-5554 test -e SHOT=issue403-default e2e/visual/settings-choice-controls.yaml`. This flow clears local test-app state. No performance-budget changes or release-mode performance claims.

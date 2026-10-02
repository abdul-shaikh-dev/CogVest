# Minimal disclosure verification

Date: 2026-10-02. Scope: design tracker #512, findings F2 and F7.
Base: `fe1949abb1c03c5526c665eeb33108b90198042a`.

## Changes checked

- Dashboard and Progress use a visible directional chevron for their Minimal-mode disclosures, with a stable accessible label and expanded state.
- Add Holding uses a secondary button for manual entry and chevrons for selectable asset rows. Instrument, venue and currency information remains visible.
- Minimal Holdings no longer explains returns that it does not display. Standard mode keeps that explanation.
- Minimal Dashboard uses a compact Progress link with the stored-value distinction intact.

No financial calculations, persistence, matching rules or records changed.

## Verification

`npm run test:v1:pc` passed: 189 suites and 1,993 tests passed; one suite and three tests skipped. Expo Doctor passed 17/17 checks. Android readiness and strict installed-package smoke checks passed. Earlier failures were tests querying the removed visual Select/Use text; those now query the preserved accessible button names, retaining their pagination assertions.

Built a fresh local x86_64 debug APK with `npm run android:apk:emulator` and installed it with `adb install -r`, without clearing data. JavaScript ran through Metro from this branch. This is not a signed preview-release test.

AVD: CogVest_UX_Proof, API 36, density 480, reduced motion enabled.

| Run | Display | Font scale | Result |
| --- | --- | --- | --- |
| Normal | 1280 x 2856 | 1.0 | Maestro passed; screenshots inspected |
| Large text | 1080 x 2400 | 1.3 | Maestro passed; screenshots inspected |

Run `maestro test -e SIZE=normal e2e/visual/minimal-disclosures.yaml` against the existing synthetic audit portfolio. Repeat with `SIZE=large` after changing the emulator display and font scale. The flow does not seed or clear data. It checks disclosure visibility, the compact Progress link, masking, manual-entry navigation without saving, the stored INR 82.03L snapshot and INR 50,000.00 cash balance. It restores Standard mode and unmasked values.

The inspected controls remained readable without overlap at both configurations. The larger manual-entry button wraps onto its own row. Price and estimate notices remain visible. The original audit is preserved in [the review HTML](../reviews/artifacts/2026-10-02-design-review/review.html).

## Screenshots

| State | Normal | Large text |
| --- | --- | --- |
| Dashboard expanded | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/normal/dashboard-expanded.png) | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/large/dashboard-expanded.png) |
| Dashboard compact Progress link | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/normal/progress-link.png) | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/large/progress-link.png) |
| Progress collapsed | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/normal/progress-collapsed.png) | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/large/progress-collapsed.png) |
| Progress expanded | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/normal/progress-expanded.png) | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/large/progress-expanded.png) |
| Minimal Holdings | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/normal/holdings.png) | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/large/holdings.png) |
| Add Holding | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/normal/add-holding.png) | [Image](../reviews/artifacts/2026-10-02-minimal-disclosures/large/add-holding.png) |

The initial normal Dashboard capture had a development toast and is not included. The clean compact-link capture shows the collapsed Dashboard instead. No TalkBack, physical-phone, release-build performance or cloud-build verification is claimed. Other #512 layout findings remain open.

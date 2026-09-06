# Dashboard Allocation Verification

Issue #297. Synthetic portfolio only; no user records reset.

- Fresh local x86_64 release APK installed on emulator-5554, without Metro or EAS.
- APK SHA-256: `E85B7BA9ACC1EEA7BC2479D3DF3466364E55F7FD7EAAB6CECAE03F6449576A52`.
- `normal.png`: 1280x2856, density 480, font scale 1.0.
- `enlarged.png`: 1080x2400 (360dp), font scale 1.3. Display overrides restored.
- Both screenshots inspected: neutral largest-class summary, proportional bar,
  consistent class icons, emphasized percentages, separate secondary amounts,
  and no overlapping row text. Enlarged rows deliberately stack.
- Opt-in `maestro test e2e/standalone/dashboard-allocation.yaml` verifies all
  classes and Open Holdings navigation on the populated release dataset.
- The first enlarged-text attempt only scrolled to the parent card and failed
  when lower rows remained below the viewport. Stable row IDs and explicit
  scrolling corrected the journey; no visibility assertions were removed.
- `npm run test:v1:pc` passed. Focused Dashboard coverage passed (23 tests),
  including masking, empty/incomplete valuation, signed negative-cash exposure,
  zero-value classes, and the summary percentage.

No financial calculations, chart dependencies, or quote behavior changed.
The prior chart PR #296 is independent of this branch.

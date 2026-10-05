# Appearance follow-up

Related to #537 and PR #538. This supersedes findings 1 and 2 in the
[initial appearance report](2026-10-04-appearance.md); its other coverage gaps
remain open. Historical captures are unchanged.

## Cash modal correction

The white strip was uncovered window space, not an incorrectly colored Android
navigation bar. After hiding the keyboard, the modal window was
`[0,0][1280,2856]`, while its KeyboardAvoidingView and cash panel stopped at
`[0,0][1280,2628]`. The second height adjustment left 228 pixels uncovered.

React Native's Android Modal already sets `SOFT_INPUT_ADJUST_RESIZE`. Replacing
the extra KeyboardAvoidingView with a flex View restores native resize ownership.
The ineffective native window-background override was removed; system-bar icon
updates remain. No input values, persistence or financial calculations changed.

On the fresh APK, the modal, root and panel all measure `[0,0][1280,2856]`
after keyboard dismissal. The focused label remains visible above the keyboard.
Maestro asserts the same unsaved amount `1234.56` and label after a foreground
Light-to-Dark switch and background/resume switches to both Light and Dark.
The draft was never submitted.

- [Keyboard open](artifacts/2026-10-04-appearance-followup/draft-keyboard-fixed-light.png)
- [Foreground Dark](artifacts/2026-10-04-appearance-followup/draft-fixed-dark.png)
- [Resume Light](artifacts/2026-10-04-appearance-followup/draft-fixed-resume-light.png)
- [Resume Dark](artifacts/2026-10-04-appearance-followup/draft-fixed-resume-dark.png)

## Holdings finding corrected

The initial report overstated the evidence for compressed spacing. Reinspection
of its original Light Standard screenshot does not show the claimed overlap.
Controlled Light/Dark and Minimal-to-Standard checks also show normal spacing.
No production Holdings layout changes were made, and this is not claimed as a
fixed Holdings defect.

Before the cash fix, native bounds placed the first metric columns at
`[60,918][332,1038]`, `[356,918][628,1038]`, and `[652,918][924,1038]`.
The 24-pixel gaps match the intended 8-dp spacing at 480 dpi.

- [Dark before the cash fix](artifacts/2026-10-04-appearance-followup/holdings-dark-before-fix.png)
- [Light Standard after Minimal](artifacts/2026-10-04-appearance-followup/standard-after-minimal.png)
- [Fresh APK Dark via deep link](artifacts/2026-10-04-appearance-followup/final-dark-deeplink.png)

Two post-install tab checks failed because a development warning banner covered
the tab targets. Dismissing the banner and rerunning passed. This is recorded as
test-environment interference, not evidence of a release navigation defect.

## Verification and limits

- Fresh local x86_64 debug APK built and installed without clearing data.
- SHA256: `AF207016F3D25D2CE8E19E7DCA0374405EF981E7F12A4CBA00EA7972CBBD9E95`.
- JavaScript served by local Metro; this is not release-bundled startup evidence.
- AVD CogVest_UX_Proof, API 36, 1280x2856, 480 dpi, font scale 1.0,
  reduced motion enabled.
- `npm run test:v1:pc` passed: 195 suites, 2,058 tests; one suite and three
  tests skipped. Expo doctor passed 17/17; strict installed-package smoke passed.
- Added a cash-wrapper regression test and retained lifecycle/idempotence tests
  for native modal appearance updates.
- Reusable Maestro draft preparation now clears existing text before entering
  its fixed synthetic values, allowing reruns without app-data resets.
- Final Maestro checks passed with 5 assets, 4 opening positions, 0 trades,
  4 cash entries, invested INR 12,37,551.60 and cash INR 50,000.00 unchanged.
  [Data evidence](artifacts/2026-10-04-appearance-followup/final-dark-data.png).

The remaining screen permutations and settled restart/override evidence listed
in the initial report are still due. No release-startup, physical-phone or
TalkBack claim. Keep #537 open and PR #538 in draft.

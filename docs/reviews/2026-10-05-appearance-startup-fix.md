# Appearance startup correction

Related to #537 and draft PR #538. Production fix: `43e6bca`.

The signed 1.0.21 recording exposed a bright native window after the brand splash
when Android Light was overridden by CogVest Dark. Android's generated AppTheme
had no explicit window background. It also exposed an `index` header while the
redirect route mounted.

## Change

`withStartupWindow` gives AppTheme the same opaque Private Ink background already
configured for the brand splash. It does not change the splash artwork, selected
React palette, native dialog themes or stored preference. Expo prebuild generated
`android:windowBackground` as `#11181C`; the plugin fails closed if AppTheme or
the expected opaque background configuration is missing.

The index redirect explicitly disables its native header and animation. Other
route transitions remain unchanged. No new dependency or storage change.

## Local verification

- Focused startup/root tests: 3 suites, 12 tests passed.
- Full `npm run test:v1:pc`: 196 suites, 2,060 tests passed; one suite and three
  tests skipped. Expo doctor 17/17 and strict Android smoke passed.
- Fresh debug APK built and installed without clearing data. SHA256:
  `DF2B5F919CAE50D261B9CC77EB6BD694925B712000BDEC5C3718AFF8027DF858`.
- AVD CogVest_UX_Proof, API 36, 1280x2856, 480 dpi, font scale 1.0.
  Dark overriding Android Light survived process restart.
- Maestro confirmed five assets, four opening positions, zero trades, four Cash
  entries, no PPF/Futures account, INR 12,37,551.60 invested and INR 50,000 cash.
- Regression tests cover idempotent native resource updates, preserving other
  theme items/splash resources, invalid integration points and redirect options.

## Signed verification

Version 1.0.22 (23), commit `43e6bca53e562ef1df1aa1f08826f7e3e1f90971`.
[Workflow 37295291268](https://github.com/abdul-shaikh-dev/CogVest/actions/runs/37295291268)
passed. EAS build `83a531c9-c5a3-4f5d-934d-3047f6ee0ff7` produced the signed
preview. APK SHA256:
`7D01851559B5566211F45149C89CD9A7FCE86D5EF84E963A0B1A22F0CC3D825C`.
Package identity, version, signature and absence of DEBUGGABLE were verified.
The APK was installed with `adb install -r` on emulator-5556 without clearing
data. No Metro reverse was configured. The existing emulator-5554 was untouched
by signed testing.

Environment: Pixel_10_Pro AVD, isolated task-local userdata, API 36.1 x86_64,
1280x2856, 480 dpi, font scale 1.0, normal animation scales, software graphics.
The public empty-portfolio UI was used; this is not a physical-phone check.

All four Maestro restart checks passed, including checked Settings preference
after restart. Each startup was recorded, with 8fps contact sheets inspected:

| App preference / Android | Observed startup |
| --- | --- |
| Dark / Light | Private Ink splash/window, then graphite; no bright blank surface observed |
| Follow system / Dark | Private Ink splash/window, then graphite |
| Light / Dark | Private Ink splash/window, then the selected light background and Dashboard |
| Follow system / Light | Private Ink splash/window, then the selected light background and Dashboard |

No transient `index` header was observed in the inspected frames. The earlier
bright-window reproduction is corrected in this signed build. Light launches
still transition from the intentionally fixed dark brand splash to the light
React surface; a brief empty selected-theme surface precedes Dashboard content.
This is not a claim of zero intermediate frames, exact OS/app splash matching,
or coverage on all Android versions. Videos are retained alongside contact
sheets rather than treating sampled frames as exhaustive timing proof.

The Dark-over-Light case was recorded a second time with the same observed
result. Final public-UI assertions passed: no holdings, no PPF account, no
Futures wallet, zero cash and no cash movements. No uninstall, clear-data or
signature bypass was used.

## Palette reference

The [interactive comparison](2026-10-05-appearance-comparison.html) and four
`reference-*.png` files in [the evidence directory](artifacts/2026-10-05-appearance-startup-fix/)
compare the original pitch-black tokens with neutral graphite and soft light.
They use identical synthetic values, dimensions and unmasked state, with
Dashboard/Holdings and Standard/Minimal examples, long names, signed gains and
losses, allocation bars and a price warning. Headless Edge rendered all four
states without browser errors; the captures were visually inspected.

These are schematic palette references reconstructed after implementation, not
native screenshots or proof of a previously approved matched comparison. The
user selected the new palettes earlier, but this publication needs review.
Historical installed screenshots and their differing data remain unchanged.

Keep #537 open and PR #538 draft. Comparison approval and separate live-font
issue #529 are not resolved by this change.

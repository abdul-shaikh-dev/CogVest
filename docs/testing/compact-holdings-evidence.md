# Compact Holdings verification

Verified on 2026-10-02 against base `4b2c31e087592cc7e97e004ca6549736c781c569`.

## Change

Both display modes use 12dp vertical row padding instead of 24dp, 8dp group
gaps instead of 16dp, and no extra 4dp margin above the weight bar. Priced rows
with a weight bar lose 44dp of whitespace. Font sizes, wrapping, values, masking,
weight bars, and detail actions are unchanged. No financial or stored-data logic
changed.

## Fresh APK

- Local release-mode x86_64 APK, version 1.0.17, versionCode 18.
- SHA256 `A0375F60A85C48F53FFDC42D1506055E31B9B97B2CB5521F56F9EF28F314996D`.
- Public debug signing key for emulator verification only. Not a distribution APK.
- Installed with `adb install -r`; existing synthetic data was not cleared.
- CogVest_UX_Proof AVD, API 36, density 480.
- Normal configuration: 1280x2856, font scale 1.0.
- Large-text configuration: 1080x2400, font scale 1.3, 360dp width.
- Display overrides were restored after testing.

## Checks

`npm run test:verify` and `npm run test:v1:pc` passed. Jest reported 189 passing
suites and 1,984 passing tests, with one suite and three tests skipped. The
focused Holdings suite passed all 52 tests. Expo Doctor passed 17/17 checks;
Android doctor and strict installed-package smoke passed.

All four combinations passed this native flow:

```powershell
maestro test -e MODE=standard -e SIZE=normal e2e/visual/holdings-compact.yaml
maestro test -e MODE=minimal -e SIZE=normal e2e/visual/holdings-compact.yaml
maestro test -e MODE=standard -e SIZE=large e2e/visual/holdings-compact.yaml
maestro test -e MODE=minimal -e SIZE=large e2e/visual/holdings-compact.yaml
```

The flow checks mode-specific metrics, opens holding details, verifies invested
capital of INR 11,00,000.00, masks displayed rupee values, and verifies cash of
INR 50,000.00 and an empty transaction ledger. It does not seed or reset data.

## Visual evidence

Inspected both modes at both sizes. Names, values, metrics and weight bars remain
readable without clipping within rows. Normal Standard now shows all four
fixture holdings completely; the previous capture cut off the fourth row.
Large text still grows rows naturally rather than squeezing text.

| Configuration | Standard | Minimal |
| --- | --- | --- |
| Normal | [Screenshot](../reviews/artifacts/2026-10-02-compact-holdings/normal/standard.png) | [Screenshot](../reviews/artifacts/2026-10-02-compact-holdings/normal/minimal.png) |
| Large | [Screenshot](../reviews/artifacts/2026-10-02-compact-holdings/large/standard.png) | [Screenshot](../reviews/artifacts/2026-10-02-compact-holdings/large/minimal.png) |
| Normal masked | [Screenshot](../reviews/artifacts/2026-10-02-compact-holdings/normal/standard-masked.png) | [Screenshot](../reviews/artifacts/2026-10-02-compact-holdings/normal/minimal-masked.png) |
| Large masked | [Screenshot](../reviews/artifacts/2026-10-02-compact-holdings/large/standard-masked.png) | [Screenshot](../reviews/artifacts/2026-10-02-compact-holdings/large/minimal-masked.png) |

Prior captures remain unchanged under
`docs/reviews/artifacts/2026-10-02-minimal507/{normal,large}/{standard,minimal}/holdings.png`.
The live Bitcoin quote changed between captures; this is not a calculation change.

This verifies a populated synthetic portfolio on an emulator, not a physical
phone, every possible asset name, TalkBack, or performance. No cloud build was
triggered for this spacing follow-up.

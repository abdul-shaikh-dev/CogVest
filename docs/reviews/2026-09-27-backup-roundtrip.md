# Fresh backup roundtrip evidence - tracker #401

## Scope and environment

This repeats the backup picker journey on merged main `d8c5df4` after #432.
Only test setup, file-list scrolling and settled control targeting changed.
No production backup format, financial logic or persistence code changed.
Historical reports and screenshots are unchanged.

- Fresh `EXPO_OFFLINE=1 npm run android:apk:emulator` succeeded (Gradle 16s),
  followed by successful `adb install -r`.
- Debug APK SHA256: `D383C9506E2FEC2CAB6A6A60EBA5D9098DADF61DED478932DE63544E13CE3F2A`.
- Current source served by offline Metro; not standalone release verification.
- Pixel_10_Pro, emulator-5554, Android 16 / API36, x86_64, portrait.
- Normal: 1280x2856/480dpi, approximately 427dp, font1.0.
- Enlarged: 1080x2400/480dpi, 360dp, font1.3; reset after testing.
- Synthetic visual-QA seed only. No user's phone, statements or private data.

## Results

Normal `backup-roundtrip.yaml` passed through real Android directory/file pickers:
export, changed masking/Minimal preferences, restore review, explicit Back to
review, Android Back, header Back, edge gesture, separate replacement confirmation,
persistent success acknowledgement, Dashboard, cold launch and re-export.
The restored HDFC position retained 25 shares, INR1,450 average and 15 April2024
date. Its invested INR36,250 and current INR41,956.25 are readable in the image.

Enlarged `backup-navigation.yaml` passed on retry: Back from review returned to
selection, re-selection produced review, confirmation and completion were usable,
and Back from completion returned to Dashboard without the acknowledgement.

Enlarged `backup-cancel-invalid.yaml` passed: cancelling each picker returned to
its warning without an error/status; the synthetic invalid file showed readable
validation feedback with no restore preview. The existing HDFC holding remained
present afterward. This flow does not assert full-payload equality after cancel.

The first enlarged attempt did not reach the file picker and stopped at the file
selector with a restore validation error visible. Cold-launching after the display
change and settling/centring the button passed. The cause of that initial failure
is not proven; it is not hidden or treated as a production fix. Development warning
overlays appear in enlarged evidence; they are not standalone release UI.

## Payload preservation, not exact equality

The two synthetic exports were pulled locally and compared with Node strict
deep-equality assertions. They are not published as raw backup files.

- Assets, cash entries, trades, PPF accounts/entries, preferences, CAS folio salt
  and current quote cache matched exactly.
- Each of the seven original monthly snapshots remained identical by ID.
- Every opening-position field except its legacy price representation matched.
  Four `currentPrice` fields became `manualValuation` records with the same price
  and asset currency, manual source, legacy provenance and unknown date.
- The second export contained 29 snapshots (22 additional) and changed historical
  quote cache. Cold launch enabled monthly history processing; this pass does not
  separately validate all generated prices or claim exact full-payload equality.

This legacy fixture normalisation and derived-data growth must not be described
as a byte-identical backup roundtrip. No missing original financial record was
found by the preservation assertions.

## Evidence

Published screenshots were visually inspected.

| State | Screenshot |
| --- | --- |
| Export | [Normal](artifacts/2026-09-27-backup-roundtrip/export.png) |
| Replacement confirmation | [Normal](artifacts/2026-09-27-backup-roundtrip/confirmation.png), [enlarged](artifacts/2026-09-27-backup-roundtrip/narrow-confirmation.png) |
| Completion | [Normal](artifacts/2026-09-27-backup-roundtrip/success.png), [enlarged](artifacts/2026-09-27-backup-roundtrip/narrow-success.png) |
| Holding after cold launch | [Restored holding](artifacts/2026-09-27-backup-roundtrip/restored-holding.png) |
| Invalid file, no restore preview | [Enlarged](artifacts/2026-09-27-backup-roundtrip/invalid.png) |

## Reproduction and limits

Use only a disposable emulator; `backup-roundtrip-seed.yaml` clears its app data.
The native picker must start in `Documents/CogVest-QA`. Run seed, normal roundtrip,
then enlarged backup-navigation with `BACKUP_FILE` set to the first export's name.
Run `backup-cancel-invalid.yaml` with its synthetic invalid fixture in that folder.
Keep Maestro UI work sequential; stop the Windows log-directory keeper afterward.

`npm run test:v1:pc` passed: 167 suites/1767 tests, existing one suite/three tests
skipped, typecheck, Expo Doctor17/17, Android Doctor and strict smoke.
No release build, EAS build, tag, Play submission, actual spoken TalkBack, 200%
text, provider failure injection or private portfolio roundtrip is claimed.
Tracker #401 remains open for import guidance, secondary masked flows and other
previously disclosed coverage gaps.

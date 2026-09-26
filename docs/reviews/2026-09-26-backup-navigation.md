# Backup navigation and feedback verification

Issue #411. All files and portfolio records in this run are synthetic QA data.

## Installed build

- Fresh local `EXPO_OFFLINE=1 npm run android:apk:emulator` build installed with
  `adb install -r`. Debug APK, current branch JavaScript served by restarted
  Metro; not a bundled-release test. No EAS build or physical-phone operation.
- APK SHA-256: `D383C9506E2FEC2CAB6A6A60EBA5D9098DADF61DED478932DE63544E13CE3F2A`.
- Pixel_10_Pro / emulator-5554, API 36, x86_64. Default 1280x2856 / 480 dpi,
  approximately 427dp, font scale 1.0. Narrow check: 1080x2400 / 480 dpi,
  360dp, font scale 1.3.
- Restored 1280x2856 and font scale 1.0 after the checks.

## Behavior checked

- Real Android directory and file pickers exported and reviewed a synthetic
  portfolio. Explicit Back to review, header Back, Android Back and left-edge
  swipe from confirmation all retained the populated review.
- Replacement still required the separate destructive action. Success survived
  the keyed navigation reset, remained visible, and opened Dashboard on request.
- After a cold launch, the restored holding had 25 shares, INR 1,450.00 average
  cost and 15 Apr 2024 opening date. Standard display mode was restored after
  changing it to Minimal before restore. A second export succeeded.
- Component tests cover picker cancellation, invalid/stale selection, deferred
  export and restore, blocked navigation while busy, duplicate action prevention,
  readable live errors, unmount abort and completion after the root remount.

## Visual evidence

| Surface | Evidence |
| --- | --- |
| Export acknowledgement | [427dp](artifacts/2026-09-26-backup-navigation/default-export.png) |
| Separate confirmation | [427dp](artifacts/2026-09-26-backup-navigation/default-confirmation.png) |
| Persistent completion | [427dp](artifacts/2026-09-26-backup-navigation/default-success.png) |
| Enlarged confirmation | [360dp / 130%](artifacts/2026-09-26-backup-navigation/narrow-confirmation.png) |
| Enlarged completion | [360dp / 130%](artifacts/2026-09-26-backup-navigation/narrow-success.png) |
| Invalid-file feedback | [360dp / 130%](artifacts/2026-09-26-backup-navigation/narrow-invalid.png) |
| Restored holding after cold launch | [Data check](artifacts/2026-09-26-backup-navigation/restored-holding.png) |

The default-size confirmation and completion have readable labels, intact
warnings, separated actions and no clipping. Export keeps the actual filename
and unencrypted-file warning visible.

At 360dp / 130%, the confirmation warning and destructive label wrap without
clipping, and both actions remain usable. Completion fits without truncation.
Android Back from review returns to selection; Android Back from completion
closes the acknowledgement and leaves Dashboard visible. The enlarged
confirmation and invalid-file screenshots include a Metro development-connection warning banner;
logcat identifies it as a debugger connection warning, not a restore failure.

## Verification and limitations

- `npm run test:v1:pc`: passed, including typecheck, 167 suites / 1,766 tests,
  Expo Doctor 17/17, Android Doctor and strict package smoke. The existing one
  skipped suite / three skipped tests remain unchanged.
- `e2e/standalone/backup-roundtrip.yaml`: passed. It now keeps the initial QA
  session alive, verifies the three Back paths and explicitly acknowledges success.
- `e2e/visual/backup-navigation.yaml`: passed at 360dp / 130%; file-list scrolling
  and settling before tapping are explicit to avoid off-screen/scrolling targets.
- `e2e/standalone/backup-cancel-invalid.yaml`: passed at 360dp / 130%. Both
  picker cancellations are neutral; an invalid file shows a readable error with
  no restore review, and the existing synthetic holding remains present.
- `git diff --check`: passed. Owned-diff review covered navigation guards,
  operation lifetime, the restore-epoch boundary and unchanged financial services.
- Deferred-operation tests verify disabled Back semantics and blocked navigation;
  real file-provider operations finish too quickly for a stable busy screenshot.
- Polite live-region properties are tested. Spoken TalkBack output was not
  independently heard or recorded; no claim of a complete screen-reader audit.
- Initial attempts exposed an emulator-wide blank screen, including Android
  Settings; reboot resolved it. A subsequent export correctly refused a changed
  portfolio when cold launch enabled background refresh during file selection.
  Keeping the synthetic QA session active removed that test interference without
  relaxing the production stale-data guard.

No backup format, persistence, financial calculation or encryption behavior changed.

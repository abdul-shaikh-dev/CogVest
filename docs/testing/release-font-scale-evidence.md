# Signed-preview font-scale verification

3 October 2026. Related to #512. Tracker remains open.

## Result

**Failed visual acceptance.** The live font-scale defect reproduces in the
standalone signed preview, in Standard and Minimal modes. It is not confined
to the Metro/debug environment. Cold reopening clears the observed Settings
clipping. No runtime correction is included in this evidence update.

A separate normal-text, narrow-width defect is also visible: Progress's
Difference and Difference % columns wrap words and the percentage suffix
across lines. The portfolio/invested amounts themselves retain their K suffix.

## Build and environment

- EAS preview [61000014-c4de-407a-925a-1c4d79a156ba](https://expo.dev/accounts/abdul_shaikh_dev/projects/cogvest/builds/61000014-c4de-407a-925a-1c4d79a156ba).
- Version 1.0.19, Android versionCode 20, source
  `5a27bcb388cecd76360e69b8cc54f6e563cfdf69`.
- APK SHA-256:
  `6C6BA1AF664E60262173AEB6AA8C7A08FFD5E5DEAB5CB0C288F5A2AD976DB3C9`.
- Installed package reports version 1.0.19 / 20 and has no DEBUGGABLE flag.
  Embedded release JavaScript, no Metro and no adb reverse entries.
- Pixel_10_Pro AVD, Android SDK/API 36, system-image directory android-36.1,
  Google APIs Play Store x86_64, emulator 36.5.11. Physical 1280x2856,
  overridden to 1080x2400 at density 480, approximately 360dp wide.
- Font scale 1.0 to 1.3 while the app is foregrounded. Animator duration setting
  was unset, not forced to zero.
- Separate headless `-read-only -no-snapshot-save` emulator on port 5556.
  Only its temporary app installation was replaced. The existing debug
  installation on CogVest_UX_Proof / port 5554 was untouched.

## Fixture and procedure

The normal backup-restore UI accepted a checksum-bearing synthetic backup.
It contains only three stored monthly snapshots, no assets or activity:
May 2026 INR 10,000, July INR 13,000, August INR 12,000. Invested value is
INR 10,000 for each month; equity equals portfolio value and all other asset
classes and monthly investment are zero. June is deliberately absent.
No developer QA route, real portfolio, provider response or credential was used.

1. Open Settings, select Standard, and use the Progress tab. Scroll to the
   portfolio chart summary. Assert Portfolio 12K and Invested 10K.
2. With Progress visible, run `adb -s emulator-5556 shell settings put system
   font_scale 1.3`. Do not force-stop, relaunch or navigate before capture.
3. The app returns to Settings, its original deep-link launch destination.
   Display becomes visibly truncated and descriptions lose lines. The app PID
   remains 5772; this does not prove the Activity was not recreated.
4. Cold-reopen through the launcher at 1.3. Settings now renders full headings
   and descriptions, including Display and Investment tools.
5. Reset to 1.0, cold-reopen through the launcher, choose Minimal, open Progress,
   expand comparisons and scroll to the same summary. Repeat the live 1.3 change.
6. The app returns to Dashboard. Text and setup buttons truncate, and tab text
   is unusually small. PID remains 8048. Cold-reopen at 1.3; Settings again
   renders normally with Minimal selected.
7. Open History through its normal control and assert the exact stored values
   and missing June. All assertions pass after the transitions and cold opens.

The route resets are observations associated with the configuration change,
not an established root-cause diagnosis. Standard used an initial Settings deep
link; Minimal used a launcher start. Investigation must check Activity/React
state and text measurement rather than assuming a single component is at fault.

## Screenshots

| State | Evidence |
| --- | --- |
| Standard, 100%, narrow comparison wrapping | [Before](../reviews/artifacts/2026-10-03-release-font/standard-before.png) |
| Standard, live 130%, clipped Settings | [Live](../reviews/artifacts/2026-10-03-release-font/standard-live-130-immediate.png) |
| Standard, cold 130%, readable Settings | [Cold](../reviews/artifacts/2026-10-03-release-font/standard-cold-130-settings.png) |
| Minimal, 100%, same comparison wrapping | [Before](../reviews/artifacts/2026-10-03-release-font/minimal-before.png) |
| Minimal, live 130%, clipped Dashboard | [Live](../reviews/artifacts/2026-10-03-release-font/minimal-live-130-immediate.png) |
| Minimal, cold 130%, readable Settings | [Cold](../reviews/artifacts/2026-10-03-release-font/minimal-cold-130-settings.png) |
| Stored months retained | [History](../reviews/artifacts/2026-10-03-release-font/history-after.png) |
| August exact values retained | [August](../reviews/artifacts/2026-10-03-release-font/august-after.png) |

These are full-frame captures, not cropped mockups. Scroll positions differ
between modes and between the live and cold screens. They establish the stated
defects and recovery, not pixel-matched all-screen acceptance.

## Test execution and limitations

Maestro passed the synthetic restore and the final exact-history assertions:
August INR 12,000 / 10,000 invested, July INR 13,000 / 10,000, May INR 10,000,
with no June row. Baseline chart accessibility assertions passed in both modes.
Those text assertions did not catch the visible mid-word wrapping.

The initial setup flows stopped twice because the restore-completion screen
was still open and deep links did not leave it. Tapping Open Dashboard and using
normal tabs resolved setup. The Standard post-transition chart assertion failed
because the app had returned to Settings; its failure is retained as a finding,
not treated as a passing visual run. Minimal used a direct screenshot after the
font setting changed, before any navigation or restart.

This is a focused preview font-scale test, not an all-screen, phone, TalkBack,
performance, live-edit draft-preservation or complete backup round-trip test.
The post-transition assertions cover the synthetic snapshot values, not all
persisted portfolio fields. No financial calculation or persistence code changed.

`npm run test:v1:pc` passed: typecheck, 191 suites / 2,023 tests, Expo Doctor
17/17, Android Doctor and strict installed-package smoke. One suite and three
tests remain skipped. The gate does not check rendered text and therefore does
not override the failed visual result. Both emulators were connected; explicit
preview install, identity, screenshots and Maestro commands targeted port 5556.
The temporary emulator was shut down after capture; the primary emulator and
its data were not modified.

## Required follow-up

- Correct live font-scale relayout and investigate the observed route reset.
  Retest 100% to 130% and back, without a manual restart, on a fresh signed APK
  in both modes. Preserve drafts and navigation state where applicable.
- Give the narrow Progress comparison metrics sufficient width or stack them.
  Inspect normal and enlarged text, preserving signs, complete percentages,
  masking and exact Portfolio/Invested values.
- Keep #512 open until fixes or an explicit agreed deferral and the remaining
  tracker dispositions have been reviewed. This build is not a visual sign-off.

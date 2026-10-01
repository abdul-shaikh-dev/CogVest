# Futures post-export verification

Follow-up to the draft blocker in [core screen hierarchy verification](core-screen-hierarchy-2026-10-02.md).

## Diagnosis

The failed debug runs logged repeated `ReactNativeJS: Cannot connect to Metro`
warnings. Android's view hierarchy also contained the clickable development
overlay labelled `Open debugger to view warnings.` near the bottom action.
After reproducing the post-export failure, dismissing that overlay and tapping
the same delete action opened the native confirmation. No restart, data change,
or application patch was needed for that control check.

This was debug-overlay interference with the automated interaction, not evidence
that backup export had changed wallet deletion behavior. Earlier runs that
restarted the app removed the overlay temporarily and obscured this distinction.
Do not hide development warnings globally to make tests pass.

## Changes

The Futures journey now checks for the warning overlay before pressing Delete.
It waits for app startup, checks the confirmation explicitly, cancels it and
asserts the wallet still holds 999 USDT, then continues through deletion and
restore. The folder-picker restriction and scroll-settle checks remain in place.
Application code, accounting, and backup format are unchanged in this follow-up.

## Build

- Fresh local `npm run android:apk:release -- --architecture=x86_64` build.
- Existing private emulator QA signing key, not the production key or public
  debug key. No cloud build, release publication, or tag push.
- APK SHA-256: `76E2785C872C826F4015F5B5AAD043069E37F01E2AE4AE2661BFD36313622C0F`.
- Installed with `adb install -r`. Android rejected `run-as` because the package
  is not debuggable. JavaScript is bundled in the APK; port 8081 reverse forwarding
  was removed.
- AVD CogVest_Perf, emulator-5554, API 36, x86_64, 1280 x 2856, density 480,
  font scale 1.0. The test clears only the disposable synthetic portfolio.

## Checks

- `npm run test:verify`: 185 suites and 1,904 tests passed. Existing skips remain
  at one suite and three tests. Expo doctor passed all 17 checks.
- `npm run android:doctor`: passed.
- `npm run android:smoke -- --strict`: passed on the new release APK.
- `maestro test e2e/futures-manual-wallet.yaml`: passed in one complete run on
  the release APK. It created 1,000 USDT, recorded the execution and fee, corrected
  entry price to 120 USDT, exported, cancelled deletion with 999 USDT unchanged,
  deleted the wallet, restored the selected backup, and cold-launched the app.
  Both after restore and after relaunch it asserted 999 USDT and quantity 1 at
  entry price 120 USDT. No restart occurred between export and confirmation.
- Visually inspected the [post-export confirmation](artifacts/futures-post-export-2026-10-02/confirmation.png)
  and [restored wallet after relaunch](artifacts/futures-post-export-2026-10-02/restored.png).

The draft blocker is resolved. No application behavior change was required.

This follow-up verifies the Futures journey on a standalone release APK. It does
not reclassify the earlier cross-screen debug captures as release screenshots or
claim physical-device, TalkBack, or performance verification.

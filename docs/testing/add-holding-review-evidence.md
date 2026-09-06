# Add Holding Entry And Review: UX-11 / #282

Branch: `fix/add-holding-review-hierarchy`, based on `a7a267e`.
Scope: presentation and interaction only; no controller, calculation, storage,
currency, provider or dependency changes.

## Contract

Position entry keeps quantity, cost, optional valuation and date available.
`Add notes or a holding plan` discloses conviction, planned days and notes.
Closing it retains values; invalid optional values reveal the fields and errors.
Quick Setup continues to omit these planning fields.

`Review holding` leads with identity, price-source status, financial results,
position values and cash impact. Save appears before `Holding details & edits`.
That disclosure retains identity/classification editing and populated optional
details without repeated identifiers or empty planning rows. Review remains
mandatory; all calculations and persisted values use the existing controller.
The Current price row also uses an unchanged cached provider quote for existing
assets, rather than incorrectly displaying Valuation pending beside a live value.

## Repeatable Native Checks

1. Run `npm run android:apk:emulator`, wait for `BUILD SUCCESSFUL`, then install
   `android/app/build/outputs/apk/debug/app-debug.apk` using `adb install -r`.
2. Keep Metro serving this working tree on port 8081, with adb reverse configured.
   This is a fresh debug shell plus current JavaScript, not standalone release QA.
3. Record the emulator's `wm size`, `wm density`, `font_scale` and secure
   `show_ime_with_hard_keyboard` / `stylus_handwriting_enabled` settings before
   changing them.
4. For a real docked-keyboard check, set
   `adb shell settings put secure show_ime_with_hard_keyboard 1`. Inspect the
   screenshot: a floating input toolbar does **not** prove keyboard-resize behavior.
   On this Gboard emulator, also set secure `stylus_handwriting_enabled` to `0`,
   force-stop `com.google.android.inputmethod.latin`, then focus another field.
   This removed the physical/stylus toolbar and exposed the docked numeric pad.
   Restore the original value (delete the override if it was absent) afterward.
5. Run `npm run maestro:test -- e2e/add-holding-review-hierarchy.yaml` with only
   synthetic emulator data. It clears app data, enters a holding, keeps the
   keyboard open while reaching Review, edits classification, saves, then asserts
   invested/current values and persisted position fields on the developer-only
   evidence route. Screenshots are written under `.expo/ux11-*`.
6. Repeat visual checkpoints at 360dp with 130% text. Scroll to actions rather
   than reducing text or demanding that an enlarged screen fit one viewport.
7. Restore all recorded device settings after testing.

The evidence route's position text includes date and measured-as-of fields.
Assert the current full record, not an older substring that omits those fields.
Do not remove value assertions merely to make a navigation test pass.
Manual opening-position prices are stored on `manualValuation`, not as provider
quote-cache entries. The guarded evidence route now exposes that price separately;
manual-price journeys assert both the persisted price and derived holding values.

## Verification Record

- `npm run test:v1:pc`: passed, 97 suites / 993 tests, typecheck, Expo doctor
  17/17, Android doctor and strict installed-package check.
- Add Holding plus Quick Setup component suites: 50 tests passed. Coverage
  includes disclosure state/retention, optional validation, edits, normal and
  quick saves, source states, and Minimal Mode.
- Fresh local debug APK built and installed on `emulator-5554` (Pixel 10 Pro).
  SHA256: `AC6D159045E3AEBDF9EEC43F303D445009109EFBAFCEFD7B8F4AB3C2FF2A2F7A`.
  The native shell hash stays unchanged for these JavaScript-only changes;
  Metro serves the current branch. No EAS or standalone release claim.
- 360dp / 130% native entry -> docked-keyboard Review -> classification edit ->
  save passed, with invested INR 200, current INR 250, quantity 2, no optional
  note/conviction and unknown date confirmed from persisted records.
- Impeccable simplification review led to on-demand planning/metadata, flattened
  financial presentation and separation between the card and primary action.
  Native enlarged-text review caught the half-width date overflow and cramped
  phase labels; both were corrected. It also exposed unreachable continuation
  behind a docked keyboard. Form-local
  [KeyboardAvoidingView](https://reactnative.dev/docs/0.81/keyboardavoidingview)
  fixed that path without changing the shared ScreenContainer.
- Independent Terra owned-diff review: no actionable task-caused findings.

Normal-width native journeys passed: hierarchy/keyboard/save, optional manual
price/notes, switching assets, provider reuse, edited provider price, and Quick
Setup (including save, relaunch, resume, unknown valuation and PPF). Each journey
asserts persisted records and/or derived values, not only navigation.

### Investigation Notes

An intermediate full-gate run reported all 992 tests passing but exited 1 because
of a pre-existing `MonthlyHistoryPanel.test.tsx` React Native timeout after Jest
teardown. The subsequent complete gate exited 0. No unrelated test was changed.
Task-caused async UI-state warnings were removed by resetting the optional
disclosure during Add another, not in a post-save effect; the new save test waits
for save completion.

The first manual-price E2E assertions were stale: opening valuations no longer
populate the quote cache, and evidence text gained date fields. Updated tests
assert the actual saved valuation, not a success message or an invented cache
record. A run interrupted by Fast Refresh after the final hook change was
discarded; final verification runs with production edits frozen.

The final unit regression verifies an existing asset's cached provider price on
Review. The final provider-reuse native rerun passed, asserting the displayed
INR 1,678.25 price before its second save and combined invested/current values
of INR 4,600 / INR 5,034.75 afterward.
Sandbox restrictions initially blocked Expo API access and Maestro log creation;
those checks were rerun with the required access.
Original display size (1280x2856), text scale (1.0) and keyboard settings were
restored after verification.

### Verification Limits

Lookup journeys use deterministic provider fixtures, not external-provider uptime
verification. Updated unknown-date, legacy add-trade and Minimal Mode YAML flows
were not separately rerun natively; related component coverage passed. This pass
does not certify a standalone release APK, a physical phone or full TalkBack use.

### Enlarged Captures

- [Position entry](artifacts/add-holding-review/enlarged-position.png)
- [Docked keyboard and reachable Review](artifacts/add-holding-review/enlarged-keyboard.png)
- [Financial review](artifacts/add-holding-review/enlarged-review.png)
- [Save action](artifacts/add-holding-review/enlarged-save.png)

### Default-Text Captures

- [Position entry](artifacts/add-holding-review/position.png)
- [Docked keyboard](artifacts/add-holding-review/keyboard.png)
- [Review and Save before optional details](artifacts/add-holding-review/review.png)

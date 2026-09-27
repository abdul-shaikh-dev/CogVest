# Enlarged-text journey verification - tracker #401

## Scope

Follow-up to the [integration report](2026-09-27-ux-integration-evidence.md).
This pass repeats its five normal-size saved-data journeys at 360dp / 130% text.
It does not replace historical evidence or claim complete tracker coverage.
Production financial code, persistence and layout are unchanged. The only flow
changes add screenshots after existing end-of-journey data assertions and scroll
to existing bulk-selection controls/assertions that can be off-screen.

## Installed environment

- Base: merged main `6818a5905ab5cb014d3de47911b0c696f51b4683` (#431).
- Fresh local `EXPO_OFFLINE=1 npm run android:apk:emulator`; Gradle succeeded in
  15s, followed by successful `adb install -r`.
- APK SHA256: `D383C9506E2FEC2CAB6A6A60EBA5D9098DADF61DED478932DE63544E13CE3F2A`.
- Native debug APK plus current source from offline Metro, not standalone release.
- Pixel_10_Pro, emulator-5554, Android 16 / API 36, x86_64, portrait.
- Override 1080x2400, 480dpi (360dp), font scale 1.3.
- Synthetic, disposable emulator data only. No private statements or phone data.
- Maestro runs sequentially; no concurrent native UI dumps. The existing Windows
  Maestro log-directory keeper is stopped and display/font settings restored
  by the runner's `finally` block.

## Reproduction

Install the matching debug APK, run offline Metro with port 8081 reversed, set
the emulator to the configuration above, then run sequentially:

```powershell
maestro --device emulator-5554 test e2e/add-holding-manual-semantics.yaml
maestro --device emulator-5554 test e2e/discovery/core-accounting.yaml
maestro --device emulator-5554 test e2e/bulk-transaction-delete.yaml
maestro --device emulator-5554 test e2e/cash-entry-focus.yaml
maestro --device emulator-5554 test e2e/ppf-account.yaml
```

These flows can clear app state. Use only a disposable synthetic emulator.

## Results

All five final journeys passed. The eight published screenshots were visually
inspected; no new production defect was demonstrated by this scoped pass.

| Journey | Original data assertions retained | Evidence |
| --- | --- | --- |
| Manual holding | One position; 2 units, INR 1,200 average, INR 2,400 invested, INR 2,600 current, INR 1,300 manual price, unknown date and retained note | [Saved state](artifacts/2026-09-27-enlarged-journeys/manual-holding-saved.png) |
| Sale | Partial: 16 units / INR 1,208 basis / INR 595 cash / INR 293 gain; full exit: 0 units / 0 basis / INR 2,990 cash / INR 1,187 gain after fees | [Full exit](artifacts/2026-09-27-enlarged-journeys/sale-full-exit.png) |
| Bulk deletion | Back/cancel retains selection; confirmed deletion leaves 10 units / INR 500 basis / zero cash | [Preview](artifacts/2026-09-27-enlarged-journeys/bulk-delete-preview.png), [result](artifacts/2026-09-27-enlarged-journeys/bulk-delete-result.png) |
| Cash | Cancelled draft unsaved, retained notes; INR 1,000 deposit and INR 250 withdrawal; INR 750 balance, exactly two entries | [Keyboard](artifacts/2026-09-27-enlarged-journeys/cash-keyboard.png), [ledger](artifacts/2026-09-27-enlarged-journeys/cash-ledger.png), [saved state](artifacts/2026-09-27-enlarged-journeys/cash-saved-entry-count.png) |
| PPF | Required-provider recovery, saved INR 100,000 account, note retained through review/Edit and Keep editing, explicit discard leaves balance unchanged; reopen from Holdings | [Reopened account](artifacts/2026-09-27-enlarged-journeys/ppf-reopened-balance.png) |

`npm run test:v1:pc` passed: typecheck, 167 suites / 1767 tests, Expo Doctor
17/17, Android Doctor and strict installed-package smoke. Existing skips remain
one suite / three tests. `git diff --check` passed. Emulator size was restored
to 1280x2856 and font scale to 1.0.

## Harness corrections

The first bulk-deletion run stopped after preview Back because "1 selected" was
above the retained scroll position. Its failure image still showed a checked
purchase and unchanged units/basis/cash. A second attempt passed Back/cancel and
confirmed deletion, but stopped at an off-screen "Back to Holdings" control.
The flow now scrolls to the original count and navigation actions; no financial
assertion, timeout or product behavior was relaxed. These are test-harness stops,
not proof of a data-loss defect.

Cash's first enlarged attempt saved the withdrawal but stopped at the top-card
balance assertion while retaining the ledger scroll position. Its screenshot
showed the cash ledger, not the balance card. The test now scrolls up before
asserting the original INR 750 balance; neither the amount nor save expectations
were changed.

## Boundaries

Accounting sales and bulk deletion use the existing in-memory accounting QA
route: their numeric assertions verify the live forms and calculation result,
not MMKV cold-restart persistence. Manual holding, Cash and PPF use the persisted
portfolio paths; reopening PPF is navigation, not a cold-restart assertion.

Remaining tracker work includes expanded source guidance, complete backup picker
roundtrip, secondary masked states and other destructive correction journeys.
Private six-Tradebook/CAS reimport, actual spoken TalkBack, 200% text, switch
access, foldables and release-mode performance are not executed here.
No cloud build, tag, release or Play submission is triggered.

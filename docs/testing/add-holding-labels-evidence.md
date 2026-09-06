# Add Holding Choice Labels: UX-10 / #280

Verified 2026-09-06 on `fix/add-holding-asset-class-labels`, based on `843e6e6`.
Only the Confirm details choice labels/accessibility names changed. Internal
classes, instrument defaults, persistence and grouped Equity summaries did not.

## Results

- `npm run test:v1:pc`: passed, 97 suites / 988 tests, typecheck, Expo doctor
  17/17, Android doctor and strict package smoke.
- Focused Add Opening Position suite: 40 passed. New coverage checks unique
  visible/accessibility names, selection state, compatible instrument options,
  class switching and stock/ETF records after review/save.
- `npm run maestro:test -- e2e/holdings.yaml`: passed for Stocks, invested INR
  180 and quantity 2.
- `npm run maestro:test -- e2e/add-holding-asset-class.yaml`: passed for switching
  ETFs/Stocks, ETF save, retained Equity grouping and persistence after relaunch.
  The first run sent a deep link before cold-start routing settled. The final
  test waits for Dashboard and uses the actual Holdings tab; the same data
  assertions remain. The new flow is registered in the local default runner.
- Visual capture at approximately 427dp / 100% and 360dp / 130% text: all four
  choices are distinct and readable. The narrow row wraps Crypto rather than
  clipping labels. Existing surrounding form layout is not redesigned here.

## Android Identity And Limits

`npm run android:apk:emulator` rebuilt successfully; `adb install -r` installed
`android/app/build/outputs/apk/debug/app-debug.apk` on `emulator-5554`.
SHA256: `AC6D159045E3AEBDF9EEC43F303D445009109EFBAFCEFD7B8F4AB3C2FF2A2F7A`.
This debug shell loads current branch JavaScript from Metro (8081); the native
hash is unchanged for this JS-only edit. No EAS or standalone release claim.
The build-generated unrelated iOS script was removed, not committed.

The narrow check used `wm size 1080x2400`, density 480 and `font_scale 1.3`.
Display size was reset and font scale restored to 1.0 afterward. All input was
synthetic. Accessible names are asserted; a full TalkBack audit is not claimed.
UX-11 entry/review simplification remains separate; the dated audit is unchanged.

## Captures

- [Stocks](artifacts/add-holding-labels/stocks.png)
- [ETFs](artifacts/add-holding-labels/etfs.png)
- [Enlarged choices](artifacts/add-holding-labels/enlarged-etfs.png)
- [Persisted ETF](artifacts/add-holding-labels/saved-etf.png)

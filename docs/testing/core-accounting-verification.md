# Core Tracking Accounting (#317)

## Contract And Scope

The owner confirmed moving weighted-average tracking on 10 September 2026.
This audit does not introduce FIFO tax lots, historical FX reconstruction,
schema changes, or a tax-reporting screen. Raw records remain authoritative.
See the core accounting section in `docs/cogvest-master-spec.md`.

## Implementation Map

| Behavior | Implementation / surface | Evidence |
| --- | --- | --- |
| Quantity, remaining cost and unrealized gain | `src/domain/calculations/holdings.ts`; Holdings and Dashboard | `holdings.test.ts`, `positionAccounting.test.ts` |
| Recorded sale gain | Shared `calculatePositionAccounting` replay and `calculateRecordedSaleGains`; Transactions, including closed holdings | `positionAccounting.test.ts`, `TradeHistoryScreen.test.tsx` |
| Fees and linked proceeds | `src/domain/financialRecords.ts`, `src/store/index.ts`, Sell / redeem | `coreAccounting.test.ts`, existing store and sell/redeem tests |
| Cutover and chronology | `src/domain/openingPositions.ts`, store `wouldOversellAsset`, sale form validation | Core accounting/store tests and `useSellRedeemHolding.test.tsx` |
| Correction/deletion | Existing `correctTrade` / `deleteTrade` graph commands | Existing store tests plus core accounting regressions |
| Known holding duration | `holdingDuration.ts`, `HoldingDurationScreen.tsx` | Duration domain/screen regressions; no production change |
| Currency and pending prices | Existing `portfolioCurrency.ts`, holding valuation provenance, quote coverage | Existing holdings tests; unsupported-currency gain/store regressions |

## Findings And Corrections

1. Linked-sale saving checked total inventory rather than the full dated timeline.
   It could accept sales before acquisition and double-count pre-cutover records.
   The command now validates dates, respects cutovers and rejects chronological
   oversells before writing proceeds. The form checks the same timeline before save.
2. Transactions displayed proceeds but no realized gain. The shared weighted-average
   replay now derives per-sale gain without altering existing holding calculations.
   Purchase fees enter cost basis; the saved net sale total already deducts sale fees.
   Unknown or unsupported history remains unavailable; it is never treated as zero.
3. The meaning of invested value after a sale was implicit. Holding details now say
   "Invested in remaining units" and identify the displayed percentage as unrealized.
4. Basic duration was already fail-closed. Added tests protect unknown dates,
   future records, multiple acquisitions, partial-sale ambiguity and masked dates.

Aggregate opening cost supports later average-cost gains, not reconstructed
historical lots. Transfers out remove basis but are not realized cash gains.
Current INR-only holding policy remains unchanged; unsupported foreign gains are
not converted using today's exchange rate. Corrections recalculate gains on read.

## Verification Procedure

```powershell
npm run test:v1:pc
npm run android:apk:emulator
# Sign with the existing installation identity when needed; never uninstall/reset.
adb -s emulator-5554 install -r path/to/fresh-qa.apk
adb -s emulator-5554 reverse tcp:8081 tcp:8081
npm run maestro:test -- e2e/discovery/core-accounting.yaml
```

The development-token-gated `accounting-qa` route initializes only an in-memory
store. Its invalid-token test proves fixture creation is blocked. No saved
portfolio is replaced, seeded, or reset. Maestro waits for Dashboard before its
deeplink, then scrolls each form field into view before interaction.

Fixture: opening 10 units at 50, purchase 10 at 100 with fee 10; total basis 1,510.
Sell 4 at 150 with fee 5: proceeds 595, realized gain 293, remaining 16 units and
basis 1,208. Sell remaining 16 at 150 with fee 5: proceeds 2,395, realized gain
1,187, zero units/basis and cumulative cash 2,990. Assertions cover actual derived
values, cash, full closure, Transactions visibility, and masking.

## Environment And Results

- `npm run test:v1:pc` passed: 127 suites / 1,255 tests, typecheck,
  Expo Doctor 17/17, Android doctor and strict installed-package smoke. The
  unrelated opt-in live-provider suite remains skipped in default runs.
- Fresh local x86_64 debug APK built and upgrade-installed successfully using
  the existing QA signing identity. SHA-256:
  `3D9560D1C34664FA83DB7FA5E0AC038B2AB9234623EDD8C83C528963F3C8CDB2`.
- Emulator: Pixel_10_Pro, API 36, 1280x2856, font scale 1.0, emulator-5554.
- The complete Maestro partial/full-sale and masking journey passed. Screenshots
  `.expo/issue317-transactions.png` and `.expo/issue317-full-exit.png` were visually
  inspected: net proceeds and gains remain distinct and readable without clipping.
- Independent financial review identified uncertainty persisting beyond a verified
  full exit. Corrected with tests: new fully costed ownership can recover a known
  basis after zero units; invalid-date or oversold history cannot. No remaining
  blocking findings after correction review.
- Initial build attempt hit sandbox network restrictions; the permitted local
  retry succeeded. Initial Maestro attempts needed a Dashboard-ready wait and
  explicit scrolling to the fee field. Those test setup corrections are committed.

The local debug APK uses current Metro JavaScript; this is not standalone-release
performance certification. No EAS build, physical phone or model-specific emulator
requirement applies. Historical tax accuracy and multi-lot duration remain outside
this issue; unavailable states preserve that boundary.

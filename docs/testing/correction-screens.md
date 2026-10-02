# Correction screen verification

Issue #486, parent #484. Checked on 2026-10-02.

## Scope

Snapshot review separates month-end totals, asset balances and optional notes. Balance fields share the available width and stack at larger font sizes. Existing reconciliation validation and generated-total suggestions are unchanged.

Manage Assets gives names and identifiers the full row width, with classification and status below. Review Asset separates identity, price matching and classification. Native currency and ISIN are read-only. Saving preserves the stored currency rather than replacing it with INR; unsupported currencies remain rejected under the existing V1 rules. Deletion failures are shown inside the confirmation instead of behind it.

## Environment

- AVD CogVest_UX_Proof, emulator-5554, Android API 36, x86_64.
- Normal display 1280x2856, density 480, font scale 1.0.
- Larger-text display 1080x2400, density 480, font scale 1.3.
- Fresh local release APK, bundled JavaScript, built with `npm run android:apk:release -- --architecture=x86_64`.
- Original APK SHA-256 `E3CCA822378894B08ADC4107F24AD0B8E3575A0F79A9AB88B2CFDCA5C7AB33D6`.
- Installed QA copy SHA-256 `6C5AC11D60A43171508858F9054850450A99650080D52772D3BBF6A7AFFC78AC`. A separate copy was signed with the local Android QA key for `adb install -r`; no production signing changes or app-data clearing.

## Automated coverage

`npm run test:v1:pc` passed with 187 suites and 1,955 tests. One suite and three tests were skipped. Type checking, Expo checks and Android readiness/smoke checks passed.

Added regression tests for exact saved snapshot content with an unrelated month preserved, stale snapshot rejection, asset cancellation, storage failure/retry with another asset preserved, unsupported-currency preservation and deletion errors inside the modal. Existing tests cover total/month validation, signed cash, rounding repair, temporary reveal, populated notes, duplicate identity, deletion impact and dependency rejection.

Visual inspection found that the shared screen header collapsed in Manage Assets at large text. Its stacked identity now keeps intrinsic height instead of retaining the row layout's flexible basis. A regression test covers the stacked style.

Successful snapshot saves and persistence-failure paths are verified with component/store tests. Native snapshot checks intentionally do not save over existing historical records. Physical-phone and TalkBack testing are not claimed.

## Native journeys and evidence

The flows use the existing synthetic QA portfolio, not personal imported data. Run the layout flow with `maestro test -e SHOT=normal e2e/visual/correction-screens-layout.yaml`, then repeat with `SHOT=large` after changing the display/font settings above. Run the save flow with `maestro test e2e/visual/asset-correction-save.yaml`.

Both layout configurations and the save flow passed on the final APK identified above. Final strict Android smoke passed. Display/font settings were restored to 1280x2856 and 1.0. The emulator's handwriting tutorial was temporarily disabled for automation; both secure/global handwriting settings were restored to their original unset state afterward.

- Layout flow: checks the saved total `8203323.12`, rejects an entered total of `1`, cancels and reopens the original snapshot, cancels a long-name asset edit, cancels deletion, restarts to verify the original name, and checks masked input plus explicit temporary reveal.
- Save flow: creates one current-date temporary purchase of two units at INR 100, checks cash changes from INR 50,000 to INR 49,800, renames its asset, restarts, and checks the saved name, symbol and ticker. Reviews the one-transaction/one-cash-movement deletion impact, cancels once, then removes only this temporary asset. Checks restored cash of INR 50,000, five original assets, and the original HDFC opening quantity of 25.
- Both flows avoid saving over or deleting the original historical snapshot and holdings. Store tests provide exact-object assertions for unrelated-record preservation.

Before screenshots: [snapshot](artifacts/correction-screens/before-snapshot.png), [asset list](artifacts/correction-screens/before-assets.png), [asset editor](artifacts/correction-screens/before-asset.png).

Normal screenshots: [snapshot balances](artifacts/correction-screens/normal/balances.png), [asset list](artifacts/correction-screens/normal/assets.png), [asset editor](artifacts/correction-screens/normal/asset.png), [keyboard](artifacts/correction-screens/normal/asset-keyboard.png), [deletion](artifacts/correction-screens/normal/deletion.png).

Large-text screenshots: [snapshot](artifacts/correction-screens/large/snapshot.png), [balances](artifacts/correction-screens/large/balances.png), [invalid total](artifacts/correction-screens/large/invalid-total.png), [asset list](artifacts/correction-screens/large/assets.png), [identity](artifacts/correction-screens/large/asset.png), [keyboard](artifacts/correction-screens/large/asset-keyboard.png), [deletion](artifacts/correction-screens/large/deletion.png).

The large-text correction pass fixed the overlapping header. Financial input values remain readable; the long editable name scrolls horizontally while its field stays above the keyboard. Confirmation actions remain reachable. The search placeholder clips at large text, but its accessibility label and search behavior remain available; it is not a stored asset identifier.

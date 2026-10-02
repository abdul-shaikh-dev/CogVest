# Transaction history layout verification

Issue #485, parent #484. Verified on 2026-10-02.

## Changes

Transaction amounts now have the same prominence as the row identity. A holding-specific list shows the holding name once; the global list identifies each holding. Dates and quantity/price details have separate lines. Transfers show units and explicitly labelled acquisition basis, never an invented execution total. Larger text stacks the amount below the identity.

Selection uses checkboxes, a selected count, scoped select-all, clear and cancel actions. Review deletion is beside those controls rather than below the whole history. The existing impact preview, linked-cash warnings and financial rejection paths are unchanged.

## Installed build

- AVD CogVest_UX_Proof, emulator-5554, Android API 36, x86_64.
- Normal display 1280x2856, density 480, font scale 1.0.
- Larger-text display 1080x2400, density 480, font scale 1.3.
- Fresh local release APK with bundled JavaScript, built with `npm run android:apk:release -- --architecture=x86_64`.
- Original APK SHA-256 `2F1A10C10C6AAFB80068CAAF9B70E316CE89836758AED2BC5A4952746267DAD7`.
- Separate locally re-signed QA copy SHA-256 `80BA3415021B43DB7647B3E6EC17CC9CC7E61D4227195FA62438575F66C05244`, installed with `adb install -r` to preserve the existing synthetic dataset. Production signing configuration was not changed.

## Checks

`npm run test:v1:pc` passed: 187 suites, 1,949 tests; 1 suite and 3 tests skipped. This includes type checking, Expo checks, Android readiness and strict installed-package smoke checks.

Focused screen tests cover scoped selection with another holding retained, linked-cash removal, Keep/Cancel, clearing selection, masked labels, sale net proceeds and realized gain, transfer basis, 60 mixed records with a long name, and oversell rejection. Store/domain regression suites cover the unchanged deletion dependency and atomicity rules.

On the freshly installed APK, `e2e/visual/transaction-history-layout.yaml` passed at both display configurations. It checked holding/global history, select all, clear, individual selection, deletion impact, Keep, Cancel and value masking. The normal and large selection captures were repeated after adding an animation-settling wait.

`e2e/visual/transaction-history-cleanup.yaml` passed. The only added QA purchase was 2 units at INR 100 plus INR 5 fees. Before deletion, cash was INR 49,795. After confirmed deletion, history was empty, cash was INR 50,000 and the original HDFC opening position remained at 25 units. Neither app data nor the original records were cleared. Font scale, display size and masking were restored.

## Visual evidence

The before image comes from the previously installed build. All after images come from the fresh APK identified above.

| State | Evidence |
| --- | --- |
| Before | [Holding history](artifacts/transaction-history-layout/before.png) |
| Normal | [Holding history](artifacts/transaction-history-layout/normal-holding.png), [selection](artifacts/transaction-history-layout/normal-selection.png) |
| Larger text | [Holding history](artifacts/transaction-history-layout/large-holding.png), [global history](artifacts/transaction-history-layout/large-all.png) |
| Larger-text deletion | [Selection](artifacts/transaction-history-layout/large-selection.png), [impact preview](artifacts/transaction-history-layout/large-preview.png) |

Inspected the attached images for amount/date hierarchy, wrapping, selection state and reachable preview actions. Some intermediate emulator captures had incomplete text redraws; settled selection captures were recaptured. Those partial frames are not used as layout evidence. Masking passed native visibility assertions, but a clean masked full-screen capture is not claimed.

Long/mixed histories, long names, sale/transfer semantics and blocked deletion have automated component/domain coverage, not a fresh native screenshot for every combination. No physical-phone, TalkBack or performance claim is made.

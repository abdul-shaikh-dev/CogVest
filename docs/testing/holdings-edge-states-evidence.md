# Holdings native edge-state evidence

3 October 2026. Related to #512; the tracker remains open.

## Scope and fixes

A fresh local debug APK exercised the real Holdings screen and detail panel with
an isolated, in-memory store. No user statements or saved portfolio records were
read or replaced. The fixture route requires both development mode and the local
QA token. Tests reject release access and fail if the persistent portfolio store
is accessed.

The native review reproduced three layout problems at 360dp and 130% text:

- The exact current value split immediately after its decimal point. Long exact
  values now use the existing title size rather than hero size. All digits and
  full Android font scaling remain; no ellipsis or reduced scaling was added.
- Long names shared too little width with the current value or pending label.
  On narrow or enlarged-text layouts, names over 60 characters and pending rows
  now put the value below the identity. Short, priced rows retain their layout.
- The pending-price explanation was squeezed beside its refresh button. These
  layouts now place the button below the explanation.

There are no financial, persistence, schema, asset-name or dependency changes.

## Native evidence

Device: CogVest_UX_Proof, Android API 36, density 480, reduced motion enabled
with animator duration scale 0. Normal captures use 1280x2856 and font scale 1.0;
large captures use 1080x2400 and font scale 1.3. The app was restarted after the
configuration change. These are settled layouts, not a live font-change test.

Build: `npm run android:apk:emulator`, x86_64 debug, installed with `adb install -r`.
JavaScript was served by local Metro. The final APK SHA-256 is
`4EED0BD682ED7AD7D548B3BF78A4B42FB2752A505084F29BD40B7F8F93AA8B06`.

[Before: split decimal](../reviews/artifacts/2026-10-03-holdings-edge/before/large-value.png)

| Configuration | List | Exact value | Masked | Missing price | Refresh failure | Empty |
| --- | --- | --- | --- | --- | --- | --- |
| Normal Standard | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/standard-list.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/standard-value.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/standard-masked.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/standard-pending.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/standard-failed-refresh.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/standard-empty.png) |
| Normal Minimal | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/minimal-list.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/minimal-value.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/minimal-masked.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/minimal-pending.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/minimal-failed-refresh.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/normal/minimal-empty.png) |
| Large Standard | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/standard-list.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/standard-value.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/standard-masked.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/standard-pending.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/standard-failed-refresh.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/standard-empty.png) |
| Large Minimal | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/minimal-list.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/minimal-value.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/minimal-masked.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/minimal-pending.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/minimal-failed-refresh.png) | [Image](../reviews/artifacts/2026-10-03-holdings-edge/large/minimal-empty.png) |

## Assertions and limits

`e2e/visual/holdings-edge-states.yaml` checks exact current value
INR 12,193,184,926.08 and invested value INR 9,449,718,533.76, hides and restores
the invested value, opens the failed-refresh detail, and checks the empty state.
The position has 123,456 units at cost 76,543.21 and manual price 98,765.43.
Quotes fail deterministically; the test does not call a live price provider.

The development reduced-motion toast is dismissed conditionally before capture.
That workaround is not a signed-release result. The isolated route omits
navigation callbacks into real portfolio editing, so its empty-state capture
does not establish onboarding CTA behavior. Quantities, unit prices and
percentages remain visible when wealth values are masked, as before.

Progress building/error states, single-point/missing-month charts and zero-only
History bars still need their separate native pass. This does not complete the
all-screen tracker or the release-equivalent live font-scale transition check.

## Verification result

All four Maestro runs passed: Standard and Minimal at both recorded display
configurations. The native review found no remaining clipping in the inspected
list, exact-value, masked, pending-price and failure layouts after correction.

`npm run test:v1:pc` passed: 190 suites, 2,015 tests, typecheck, Expo Doctor 17/17,
Android Doctor and strict installed-package smoke check. One suite and three
tests remain skipped. The focused route tests also verify the release/token
guard, isolated storage, exact amounts, Minimal visibility and failed refresh.
`git diff --check` and all 25 published image links pass.

The first sandboxed build could not access Gradle's network/cache; the authorized
retry built successfully. The emulator was restored to normal size and font
scale, the real Holdings route was reopened, and task-owned Metro/reverse-port
forwarding was stopped. Saved data and display preferences were not replaced.

# Daily-screen spacing verification

Date: 2026-10-02. Tracker #512, first F3 batch. Baseline `7976a98aaf3bc8bceac24b0c21500415271692c7`, after merging #515.

## Scope

Dashboard and Holdings opt into compact page headings and plain header icon buttons. Other screens keep the existing shared-component defaults. Header controls retain their 48dp minimum touch targets, accessible labels and full font scaling; plain controls have a light Android ripple visible against black.

Holdings reduces the gaps above the list without changing its rows, names, weight bars, numeric weights or separately labelled P&L metrics. Dashboard presents zero monthly net investment and cash change as a compact dated status. Nonzero activity and masked activity keep their metric group. The zero-state condition and its financial meaning are unchanged.

This is not completion of the full design tracker. Cash density and the other additional screen observations still need review in later batches. No financial, persistence, matching, dependency or schema changes.

## Installed verification

Final `npm run test:v1:pc` passed: 189 suites and 1,994 tests passed; one suite and three tests skipped. Typecheck, Expo Doctor 17/17, Android readiness and strict smoke checks passed. Ripple assertions initially queried the wrong rendered node, then needed an explicit TypeScript callback type; the corrected assertion and complete gate pass.

All four after-layout capture flows and the corrected action flow passed. Emulator display/font settings were restored, Standard mode left selected and values unmasked. Metro and the test port forwarding were stopped.

Rebuilt with `npm run android:apk:emulator` and installed with `adb install -r`. Local x86_64 debug APK 1.0.18, versionCode 19; branch JavaScript served through Metro. No clear-data, financial record edits or external quote refresh. This is not a signed cloud preview verification.

AVD CogVest_UX_Proof, API 36, density 480, reduced motion enabled. Synthetic four-position portfolio.

| Configuration | Display | Font scale | Coverage |
| --- | --- | --- | --- |
| Normal | 1280 x 2856 | 1.0 | Standard and Minimal Dashboard/Holdings |
| Large | 1080 x 2400 | 1.3 | Standard and Minimal Dashboard/Holdings |

`e2e/visual/daily-spacing.yaml` captures both screens and asserts the unchanged INR 50,000.00 cash balance. Run with `PHASE=before` or `after`, `SIZE=normal` or `large`, and `MODE=standard` or `minimal`.

`e2e/visual/daily-spacing-actions.yaml` checks masking, loss/all filters, search with keyboard dismissal, Add and More panels, and holding detail's INR 11,00,000.00 invested balance. The original action assertion expected Transactions, which this no-transactions fixture correctly omits; it now checks Valuation details. Cold-start baseline attempts missed Settings; settled retries captured the baseline. These initial attempts are not reported as passes.

## Visual comparison

All before/after screens were inspected. At normal size the first holding moves upward without changing row metrics. At 130% text, Minimal Holdings now brings the fourth holding's title into the initial viewport. Standard Dashboard reaches the first allocation category, where the baseline stopped within allocation scope text. Full scaling and existing large-text header stacking remain intact; no clipping or collisions were observed in the changed content.

Some captures include a transient debug warning toast over the bottom navigation. It is outside the changed controls; these images are retained unedited and are not evidence of unobscured bottom navigation. No production-warning conclusion is drawn from that debug overlay.

Metro logged Reanimated's development-only reduced-motion warning. Repeated development deep-link launches also logged a multiple-linking error; settled capture and action flows passed. This batch changes no linking configuration and does not establish a release-build reproduction of that launch issue.

| Screen | Normal before | Normal after | Large before | Large after |
| --- | --- | --- | --- | --- |
| Standard Holdings | [Image](../reviews/artifacts/2026-10-02-daily-spacing/before/normal/standard-holdings.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/after/normal/standard-holdings.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/before/large/standard-holdings.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/after/large/standard-holdings.png) |
| Standard Dashboard | [Image](../reviews/artifacts/2026-10-02-daily-spacing/before/normal/standard-dashboard.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/after/normal/standard-dashboard.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/before/large/standard-dashboard.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/after/large/standard-dashboard.png) |
| Minimal Holdings | [Image](../reviews/artifacts/2026-10-02-daily-spacing/before/normal/minimal-holdings.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/after/normal/minimal-holdings.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/before/large/minimal-holdings.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/after/large/minimal-holdings.png) |
| Minimal Dashboard | [Image](../reviews/artifacts/2026-10-02-daily-spacing/before/normal/minimal-dashboard.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/after/normal/minimal-dashboard.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/before/large/minimal-dashboard.png) | [Image](../reviews/artifacts/2026-10-02-daily-spacing/after/large/minimal-dashboard.png) |

## Limits

No TalkBack, physical-phone, tablet, landscape, live font-scale transition or performance claim. Existing automated coverage exercises masking, pending valuations, empty states and larger-text metrics; this visual pass uses the synthetic fixture, not every error state or long-name portfolio. Broader screen changes remain in #512. Original audit evidence is unchanged.

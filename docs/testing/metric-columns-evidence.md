# Separate amount and percentage metrics

Verified on 2026-10-02, based on `f2b74f1d6a18003e570b7666b47e787d25c1a0d4`.

## Scope

Holdings rows and details, Dashboard, and Add Holding review now give the P&L
amount and percentage their own headings and values. Holdings keeps the pair
together when the grid wraps at narrow widths or enlarged text. Progress uses
Difference and Difference % for its comparison against invested capital; those
values are not relabeled as profit. Minimal Mode retains its disclosures.

The source review also covered quick setup, monthly history, asset-history,
cash, and futures summaries. Quick setup already separates P&L and P&L %.
Allocation percentages and month-over-month comparisons describe different
measures and were not changed. No domain, persistence, or currency calculations
changed. A missing P&L percentage now has its own unavailable state rather than
the holdings row substituting zero.

## Verification

- Focused four-screen suite: 189 tests passed.
- `npm run test:v1:pc` passed, including 1,984 tests in 189 suites, Expo Doctor
  17/17, Android doctor, and strict installed-package smoke. Three tests and one
  suite remain skipped.
- Final `npm run test:verify` passed after the responsive Dashboard adjustment.
- Owned diff reviewed and `git diff --check` passed.
- Built and installed a fresh local debug x86_64 APK with Metro serving this
  source revision. Version 1.0.18, Android versionCode 19. No emulator data reset.
- APK SHA256: `4EED0BD682ED7AD7D548B3BF78A4B42FB2752A505084F29BD40B7F8F93AA8B06`.
- AVD CogVest_UX_Proof, API 36, density 480, reduced motion enabled.
- Normal: 1280x2856, font scale 1.0. Large: 1080x2400, font scale 1.3, 360dp.

Both runs of `e2e/visual/metric-columns.yaml` passed, with SIZE=normal and
SIZE=large. They verify labels, Minimal Mode hiding/expansion, masking, holding
invested capital INR 11,00,000.00, cash INR 50,000.00, and an empty transaction
ledger. Both normal and large runs of `holding-entry-layout.yaml` passed with
unsaved quantity 2, average cost INR 100, current price INR 125, invested INR 200,
current INR 250, P&L INR 50 and P&L 25%. Editing back preserves the draft inputs.
No holding or trade was saved by these flows.

An initial detail scroll raced the modal transition. Adding an explicit visible
heading/animation wait resolved it. An initial input attempt was intercepted by
Gboard's handwriting tutorial; temporarily disabling handwriting resolved it.
Display/font and handwriting settings were restored, Metro stopped, and its adb
reverse mapping removed after testing.

## Inspected screenshots

| Surface | Normal | 130% text |
| --- | --- | --- |
| Holdings | [Image](../reviews/artifacts/2026-10-02-metric-columns/normal/holdings.png) | [Image](../reviews/artifacts/2026-10-02-metric-columns/large/holdings.png) |
| Holding details | [Image](../reviews/artifacts/2026-10-02-metric-columns/normal/holding-detail.png) | [Image](../reviews/artifacts/2026-10-02-metric-columns/large/holding-detail.png) |
| Dashboard | [Image](../reviews/artifacts/2026-10-02-metric-columns/normal/dashboard.png) | [Image](../reviews/artifacts/2026-10-02-metric-columns/large/dashboard.png) |
| Progress | [Image](../reviews/artifacts/2026-10-02-metric-columns/normal/progress.png) | [Image](../reviews/artifacts/2026-10-02-metric-columns/large/progress.png) |
| Add Holding | [Image](../reviews/artifacts/2026-10-02-metric-columns/normal/add-holding.png) | [Image](../reviews/artifacts/2026-10-02-metric-columns/large/add-holding.png) |

The same folders include Minimal Holdings, expanded Minimal Dashboard, and masked
Dashboard captures. Values and headings remain readable without overlap. Normal
Holdings fits four complete fixture rows; enlarged text uses two metric rows
rather than shrinking the type.

This is emulator verification using a fresh development APK, not a signed cloud
preview, physical-phone, TalkBack, or performance certification. The debug APK
is not distributed. The requested preview uses the normal EAS signing workflow.

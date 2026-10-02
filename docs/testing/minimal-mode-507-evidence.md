# Minimal Mode hierarchy #507

Verified on 2 October 2026 against base `e3b2bbe`. This is a scoped presentation
change, not a financial-model, storage, performance or whole-app certification.

## Result

- Dashboard keeps portfolio value and allocation visible; `Invested & returns`
  expands the existing metrics. Price coverage and liability warnings remain.
- Holdings rows keep identity, value, numeric weight and the scaled weight bar.
  Invested/P&L move out of the list, not out of holding details. The spoken row
  summary follows the same hierarchy. Filters and essential actions remain.
- Progress defaults to one portfolio line and its selected-month value.
  `Comparisons & breakdowns` reveals the invested line, comparison, monthly
  metrics and asset-class chart. History and estimate/gap warnings remain.
- Mode changes reset disclosures. Expanding a chart does not reset its selected
  month; collapsing clears series emphasis so a hidden invested series cannot
  leave the remaining line dimmed.
- Standard retains its existing hierarchy. Domain calculations, persistence,
  import formats and quote behavior are unchanged. No new dependencies.

## Build and checks

- Fresh local release-mode x86_64 APK, 1.0.16 / Android versionCode 17.
- SHA256: `D803C7AA80C3855D602D9A95032EB78DCEFD78EECF335EC15B61B28B5321CD34`.
- Public local debug key used only for emulator verification; this APK is not
  for distribution. The first build correctly refused missing release signing
  credentials; local test-key environment values were then supplied without
  changing production signing configuration.
- Installed in place using `adb install -r`; existing synthetic data retained.
- AVD `CogVest_UX_Proof`, Android API 36, density 480.
- Normal: 1280x2856, font scale 1.0. Large: 1080x2400, 360dp width, font 1.3.
- `npm run test:v1:pc`: TypeScript, 189 suites / 1,982 tests passed, Expo Doctor
  17/17, Android doctor and strict installed-package smoke passed. One existing
  suite containing three tests remains skipped.
- Focused tests cover disclosures, masks, mode changes, unchanged stored
  snapshots, missing-month notices, pending valuation/refresh and PPF-excluded
  history in both modes. Existing persistence tests cover saved mode selection.

## Native evidence

`e2e/visual/minimal-mode-507.yaml` passed four runs: Standard and Minimal at both
sizes. All use the same existing synthetic portfolio, without resetting data.
Current prices may refresh independently; captured portfolio differences must
not be interpreted as a mode-dependent calculation.

The flow checks collapsed/expanded Dashboard, masked expanded amounts, Holdings
without per-row invested/P&L, holding detail performance, collapsed/expanded
Progress, and Monthly History's April comparison of -3.46%. It verifies Cash
remains INR 50,000, the transaction list stays empty, and Minimal persists after
cold restart with the Dashboard disclosure collapsed. These are sampled data
assertions, not a byte-for-byte backup comparison. Display size/font were
restored and the app stopped afterward.

| Screen | Standard | Minimal | Minimal at 130% |
| --- | --- | --- | --- |
| Dashboard | [Standard](../reviews/artifacts/2026-10-02-minimal507/normal/standard/dashboard.png) | [Minimal](../reviews/artifacts/2026-10-02-minimal507/normal/minimal/dashboard.png) | [Large](../reviews/artifacts/2026-10-02-minimal507/large/minimal/dashboard.png) |
| Holdings | [Standard](../reviews/artifacts/2026-10-02-minimal507/normal/standard/holdings.png) | [Minimal](../reviews/artifacts/2026-10-02-minimal507/normal/minimal/holdings.png) | [Large](../reviews/artifacts/2026-10-02-minimal507/large/minimal/holdings.png) |
| Progress | [Standard](../reviews/artifacts/2026-10-02-minimal507/normal/standard/chart.png) | [Minimal](../reviews/artifacts/2026-10-02-minimal507/normal/minimal/chart.png) | [Large](../reviews/artifacts/2026-10-02-minimal507/large/minimal/chart.png) |
| Holding detail | [Standard](../reviews/artifacts/2026-10-02-minimal507/normal/standard/holding-detail.png) | [Minimal](../reviews/artifacts/2026-10-02-minimal507/normal/minimal/holding-detail.png) | [Large](../reviews/artifacts/2026-10-02-minimal507/large/minimal/holding-detail.png) |

Expanded [comparison](../reviews/artifacts/2026-10-02-minimal507/normal/minimal/comparison.png),
[masked Dashboard](../reviews/artifacts/2026-10-02-minimal507/normal/minimal/dashboard-masked.png)
and [history](../reviews/artifacts/2026-10-02-minimal507/normal/minimal/history.png)
are included alongside matching large-font and Standard captures.

Visual review found readable values, retained provenance/estimate notices,
working disclosure controls and no new clipped text. Large-font content scrolls
rather than shrinking. The review also checked unchanged allocation scale,
partial-history scope, mask paths and chart selection when expanding details.

## Limits

No physical-phone, TalkBack, cloud-build or performance claim. Native visual
checks use the populated fixture; empty, missing-price and PPF-excluded states
are covered by component tests rather than a separate native fixture run. The
legacy developer-seeded `e2e/minimal-mode.yaml` expectations were updated, but
the non-destructive four-run flow above is the native evidence for this change.

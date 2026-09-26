# Progress hierarchy verification

Issue: #400. All captures use synthetic local visual-QA data, not a personal portfolio.

## Installed build and environment

- Fresh local debug APK built with `EXPO_OFFLINE=1 npm run android:apk:emulator` and installed on `emulator-5554`. The existing differently signed emulator installation was removed with the user's explicit approval.
- AVD: `Pixel_10_Pro`, API 36, x86_64. This is not the AVD used by the previous History review; no performance comparison is claimed.
- APK SHA-256: `D383C9506E2FEC2CAB6A6A60EBA5D9098DADF61DED478932DE63544E13CE3F2A`.
- Debug JavaScript was served from this branch by Metro. Metro was restarted after source corrections; this is installed-debug verification, not a bundled release-APK test.
- Normal: 1280x2856 px, 480 dpi, approximately 427dp wide, font scale 1.0.
- Enlarged: 1080x2400 px, 480 dpi, 360dp wide, font scale 1.3.
- Display overrides and TalkBack were restored to their original settings after testing. No cloud build was triggered.

## Visual evidence

| Case | Evidence | Result |
| --- | --- | --- |
| Normal, 3 months | [Overview](artifacts/2026-09-26-progress-hierarchy/issue400-default-3-overview.png), [chart](artifacts/2026-09-26-progress-hierarchy/issue400-default-3-portfolio.png), [Debt](artifacts/2026-09-26-progress-hierarchy/issue400-default-3-debt.png) | History beside the month; concise status; part of the plot visible without scrolling. Debt can be isolated on its own scale. |
| Normal, 120 months | [Chart](artifacts/2026-09-26-progress-hierarchy/issue400-default-120-portfolio.png) | Full range and endpoint years remain legible; the other chart's range remains independent. The sharp late decrease belongs to the synthetic fixture. |
| Enlarged, 12 months | [Overview](artifacts/2026-09-26-progress-hierarchy/issue400-narrow-12-overview.png), [chart](artifacts/2026-09-26-progress-hierarchy/issue400-narrow-12-portfolio.png), [Debt](artifacts/2026-09-26-progress-hierarchy/issue400-narrow-12-debt.png) | Summary and controls fit; selected values stack rather than overlap. |
| Enlarged, 60 months | [Debt](artifacts/2026-09-26-progress-hierarchy/issue400-narrow-60-debt.png) | Endpoint-only labels keep years separated without dropping observations. |
| Missing April, estimated May | [Portfolio](artifacts/2026-09-26-progress-hierarchy/issue400-narrow-gap-portfolio.png), [Debt](artifacts/2026-09-26-progress-hierarchy/issue400-narrow-gap-debt.png) | Both lines break before May; no area fill bridges the gap. Selected values are marked estimated, and changes across the missing month show an em dash. |
| Enlarged, masked | [Chart](artifacts/2026-09-26-progress-hierarchy/issue400-masked-chart.png) | Portfolio, invested amount, gap amount and currency axis values are masked. |
| Enlarged, Minimal | [Chart](artifacts/2026-09-26-progress-hierarchy/issue400-minimal-chart.png) | Numeric comparison and missing-month semantics remain available. |
| TalkBack enabled | [Focused summary](artifacts/2026-09-26-progress-hierarchy/issue400-talkback.png), [accessibility tree](artifacts/2026-09-26-progress-hierarchy/talkback-tree.xml) | TalkBack bound with touch exploration enabled; tap/swipe focused the grouped numeric summary. Previous/next controls expose chart-specific names. |

The first enlarged-text pass exposed crowded middle/final year labels. The correction uses endpoint-only axis labels for narrow enlarged-text plots. The 12-month rerun and 60-month capture verify the correction. The complete date range and previous/next controls still expose every stored month.

TalkBack verification is limited to service binding, focus interaction and exposed labels. Audio pronunciation/output and a complete spoken navigation journey were not independently heard or recorded; this is not a claim of a full manual screen-reader audit.

## Automated checks

- `npm run test:v1:pc`: passed, including typecheck, 167 passing Jest suites / 1761 passing tests, 17/17 Expo Doctor checks, Android Doctor and strict installed-package smoke. One suite and three tests remain pre-existing skips.
- Component/domain regressions cover unchanged values, calendar gaps, provisional points, entirely-zero versus partially-zero asset series, zero baselines, independent ranges, no-history/incomplete-PPF states, masking and accessible summaries.
- `e2e/visual/progress-hierarchy.yaml`: passed with `HISTORY=3`, `12`, `long` (60), `extended` (120), and `sparse`. Final 3/12 runs also assert the unchanged INR 19.87L portfolio and INR 17.21L invested values.
- `e2e/visual/progress-hierarchy-modes.yaml`: passed for masked and Minimal states, including hidden/restored amount assertions.
- `git diff --check`: passed.

Reproduce a history capture with `maestro --device emulator-5554 test -e HISTORY=12 -e SHOT=issue400-narrow-12 e2e/visual/progress-hierarchy.yaml`. Run the modes flow after seeding a history fixture. The explicit debug seed confirmation replaces emulator data; it cannot be enabled in a release build.

No financial records, persistence schema, external price provider or historical snapshot values were changed by the UI implementation. External-provider behavior and release-mode performance were not tested here; existing performance budgets are unchanged.

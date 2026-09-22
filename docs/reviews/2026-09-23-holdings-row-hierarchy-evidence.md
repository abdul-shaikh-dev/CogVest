# Holdings row hierarchy visual evidence

Issue: [#398](https://github.com/abdul-shaikh-dev/CogVest/issues/398)

## Setup

- Freshly built and installed local debug APK (`app-debug.apk`, SHA-256 `C3C2A9A6815383CE1391C109D7A7CB3F44727F31968A5474D1131F47717F0B13`). Metro served the debug JavaScript bundle.
- AVD `CogVest_UX_Proof`, Android API 36, emulator-5556.
- Tested at 1280 x 2856 px / 480 dpi (about 427dp), font scale 1.0; then 1080 x 2400 px / 480 dpi (360dp), font scale 1.3.
- Deterministic local visual QA portfolio only. The 4-position seed and 30-position seed were each loaded from a cleared app state; no private portfolio records were used.
- `maestro --device emulator-5556 test e2e/visual/holdings-row-hierarchy.yaml` passed at both configurations.
- Before captures used isolated commit `d2bdff8` (the pre-change row). Only its developer visual QA seed was extended with the same deterministic 30-position fixture. The installed debug APK loaded that checkout's JavaScript from Metro for the comparison; its native package was unchanged. The temporary baseline Maestro flow passed at both configurations.

## Before and after

| State | Before, 427dp / 100% | After, 427dp / 100% | Before, 360dp / 130% | After, 360dp / 130% |
| --- | --- | --- | --- | --- |
| Four holdings | [Baseline](artifacts/2026-09-23-holdings-row-hierarchy/09-before-four-default.png) | [Revised](artifacts/2026-09-23-holdings-row-hierarchy/01-four-default.png) | [Baseline](artifacts/2026-09-23-holdings-row-hierarchy/12-before-four-360dp-130font.png) | [Revised](artifacts/2026-09-23-holdings-row-hierarchy/05-four-360dp-130font.png) |
| Thirty holdings | [Baseline](artifacts/2026-09-23-holdings-row-hierarchy/10-before-thirty-default.png) | [Revised](artifacts/2026-09-23-holdings-row-hierarchy/03-thirty-default.png) | [Baseline](artifacts/2026-09-23-holdings-row-hierarchy/13-before-thirty-360dp-130font.png) | [Revised](artifacts/2026-09-23-holdings-row-hierarchy/07-thirty-360dp-130font.png) |
| Long-name search | [Baseline](artifacts/2026-09-23-holdings-row-hierarchy/11-before-long-name-default.png) | [Revised](artifacts/2026-09-23-holdings-row-hierarchy/04-long-name-default.png) | [Baseline](artifacts/2026-09-23-holdings-row-hierarchy/14-before-long-name-360dp-130font.png) | [Revised](artifacts/2026-09-23-holdings-row-hierarchy/08-long-name-360dp-130font.png) |

## Masking

| State | 427dp / 100% | 360dp / 130% |
| --- | --- | --- |
| Four holdings, masked | [Revised](artifacts/2026-09-23-holdings-row-hierarchy/02-four-masked-default.png) | [Revised](artifacts/2026-09-23-holdings-row-hierarchy/06-four-masked-360dp-130font.png) |

## Inspection

- Identity and current value remain first; Invested, signed P&L amount and percent, and Weight remain aligned below. No generic trend icon or repeated market-share sentence appears in a row.
- The baseline repeats the position count and market-share label; stock rows show the same rising icon regardless of return. The revised list uses a single count and shorter denominator note.
- At 360dp / 130%, the P&L percentage wraps below its amount. It remains within the P&L column; long holding names wrap without overlapping the current value or metrics.
- Masking hides the current, invested, and P&L amounts while preserving layout and percentage context.
- Maestro checked visible metric IDs and seed counts. Unit tests check pending values, small nonzero weights, fund identity, and spoken labels. An actual TalkBack listening session was not run.

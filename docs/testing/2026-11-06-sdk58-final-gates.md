# Expo SDK 58 final gates

6 November 2026, #618. Run on main `29fad29` after the four stepwise SDK PRs
(#625, #626, #627, #629) merged. Synthetic data only.

## Environment

- AVD `CogVest_UX_Proof`, Android 16 / API 36, x86_64, 1280x2856 at density
  480, font scale 1.0 unless stated. Emulator started with `-no-snapshot-save`.
- Local builds from a short-path checkout (`G:\cv58`) with `COGVEST_NINJA`
  pointing at Visual Studio 2022 Build Tools' ninja 1.12.1 for SDK 58 native
  builds. R8 stays off, as in SDK 57.
- No EAS build or Play submission was used.

## Signed upgrade proof: SDK 54 release to SDK 58 release

No 1.0.30 release APK or tag exists, so both sides were local release builds
signed with the owner's private upload key. Both report version 1.0.30 / code 31.

| Side | Source | APK size | APK SHA-256 |
| --- | --- | --- | --- |
| Baseline (SDK 54) | `15ac471`, main before #625 | 45.4 MB | `b4a35eff5b2ace649028862f67fbe25e00677617223571a8b671ed00e9eaf737` |
| Upgrade (SDK 58) | `29fad29`, main after #629 | 53.3 MB | `930de434036eeb9e97fd9081299f9d5089df93561d6e7580f88975a055100863` |

Both APKs passed `apksigner verify` with the same signing certificate
(SHA-256 `1226c508e732fc1ab1d4ffb4c1ab23d22c4924a599244f6d638e2e933e481b54`).
Neither package is debuggable.

Sequence:

1. Seeded the e2e app with the synthetic 250-asset scale fixture
   (`e2e/visual/scale-prepare.yaml`) and exported it with the normal backup UI.
2. Replaced the emulator's debug-signed QA install of the production package
   with the SDK 54 release, and restored that backup through Settings, Restore
   backup. The review showed 250 backup assets against 0 on the device.
3. Turned Wi-Fi and mobile data off, then exported the "before" backup with
   `e2e/standalone/upgrade-export.yaml`.
4. Installed the SDK 58 release over it with `adb install -r`. There was no
   uninstall, reset, restore or seeding, and no crash or ANR in logcat.
5. Exported the "after" backup with the same flow, pulled exactly the one new
   file each time, then turned Wi-Fi and mobile data back on.

Result of `src/testing/__tests__/upgradeBackupComparison.test.ts` with both
paths configured, in exact mode (no snapshot additions allowed):

```json
{"after":{"assets":250,"cashEntries":0,"monthlySnapshots":94,"openingPositions":250,"ppfAccounts":0,"ppfLedgerEntries":0,"trades":1000},
 "before":{"assets":250,"cashEntries":0,"monthlySnapshots":94,"openingPositions":250,"ppfAccounts":0,"ppfLedgerEntries":0,"trades":1000},
 "collectionsMatch":true,"payloadsMatch":true}
```

Both exports were 282,121 bytes. The complete payloads matched; only the
envelope metadata and checksum differed. This proves the SDK 54 to SDK 58
upgrade preserves the backup-format portfolio. Cash, PPF and EPF are empty in
this fixture and still rely on automated backup tests.

## `npm run test:v1:pc`

Passed on `29fad29`:
- typecheck, lint and the Maestro selector policy;
- Jest: 243 suites passed with 1 skipped, and 2,558 tests passed with 3 skipped;
- Expo Doctor 18/18 and Android Doctor;
- the strict installed-package smoke check, against the freshly installed SDK 58
  release.

## #529 live font-scale retest

Signed SDK 58 release with the restored 250-asset fixture. Font scale changed
with `adb shell settings put system font_scale` while the app was in the
foreground. No force-stop or relaunch before capture.

| Check | Result |
| --- | --- |
| Text at live 130% (Progress, Dashboard) | Reflows with no clipped or truncated text; tab labels stay readable |
| Two 100 → 130 → 100 cycles on Progress | Layout returns exactly to the 100% layout |
| Navigation after a live change | **Still resets to the launch route.** Settings (deep-link launch) returned to Progress; Cash (launcher start) returned to Dashboard |
| Process | Same PID throughout, so the Activity is recreated rather than the process restarted |

The clipping part of #529 no longer reproduces on these screens on SDK 58.
The navigation reset does, so unsaved drafts would still be lost. #529 stays
open; SDK 58 does not fix it on its own.

Screenshots (unedited): [`2026-11-06-sdk58-font-scale/`](../reviews/artifacts/2026-11-06-sdk58-font-scale/)

| State | File |
| --- | --- |
| Progress at 100% | `std-100-before.png` |
| Progress at live 130% | `std-130-live.png` |
| Progress back at 100%, second cycle | `std-100-cycle2.png` |
| Cash at 100% before the change | `cash-100.png` |
| Same task after live 130%: reset to Dashboard | `cash-130-live.png` |

## Full Maestro tier: failed on 6 November, passed after #631

46 passed, 17 failed, against a fresh E2E APK of `29fad29`. Details and
per-flow classification are logged in [`e2e-runs.md`](e2e-runs.md):

- **Startup deep-link race (pre-existing, not SDK 58):** 14 flows. A link
  received while the app is still starting is sometimes dropped, and the app
  stays on the Dashboard. Reproduced with adb alone (2 of 8 cold launches).
  Later probes showed the race predates SDK 58: SDK 54 release dropped 4 of 16
  early links and SDK 58 release 1 of 16. Fixed in #631.
- **Stale QA fixtures (existing, not SDK):** epf-persistence and
  investing-cash-migration. Their "legacy" fixtures still carry the schema
  17/18 fields, so storage rejects them. Reproduced in Jest; user migration is
  unaffected. Fixed in #631.
- **Flow timing (not product):** cash's double-tap Save now lands the second
  tap on the saved entry. Only one entry was saved. Fixed in #631.

On 7 November the full tier passed 63 of 63 on a fresh E2E APK of #631's
`f886dd4`, after an emulator cold boot. See [`e2e-runs.md`](e2e-runs.md).

## Gate summary

| Gate | Result |
| --- | --- |
| Signed upgrade proof (SDK 54 → 58) | Pass, `payloadsMatch: true` |
| `npm run test:v1:pc` | Pass |
| #529 font-scale retest | Clipping fixed; navigation reset still reproduces |
| Full Maestro tier | Failed 46/17 on `29fad29`; **passed 63/63** with #631 (`f886dd4`) |

With #631 merged, the startup-link race is fixed and the full tier passes, so
the SDK 58 gates are met. The #529 navigation reset remains open separately.

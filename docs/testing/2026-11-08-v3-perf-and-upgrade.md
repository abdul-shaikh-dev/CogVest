# V3 performance confirmation and schema-crossing upgrade

Recorded 8 November 2026 for #138, on main `78f13b6`: Expo SDK 58, R8 on,
the #637 ordering fix and #619. Synthetic data only. No EAS build or Play
submission was used.

## Environment

- AVD `CogVest_UX_Proof`, Android 16 / API 36, x86_64, 1280x2856 at density
  480, font scale 1.0, light mode. Cold-booted with `-no-snapshot-load` before
  the runs.
- Local builds from a short-path checkout (`G:\cvp`, plus `G:\cv26` for
  1.0.26), with `COGVEST_NINJA` pointing at the Visual Studio 2022 Build Tools
  ninja.
- Host apps stayed open. This is not a laboratory host-load guarantee.

## Performance confirmation

Build: e2e variant with `EXPO_PUBLIC_COGVEST_PERFORMANCE_PROBE=1`, made from a
fresh checkout so no stale bundle was reused. The bundle contains
`cogvest-performance`. APK SHA-256
`d28df1df725b676b953d561afc9addf830fe7e5f74a171ef05f6a5ae308a9441`.
Fixture: `e2e/visual/scale-prepare.yaml`, with 250 assets, 250 openings, 1,000
transactions, 94 snapshots and the 10-year daily caches.

### Event-loop stalls (target: none over 500 ms)

Method as in [2026-11-01](2026-11-01-v3-performance-rerun.md):
`scripts/measure-android-stalls.sh` with raw `adb input` and 11 s idle between
actions, attributed with `scripts/attribute-probe-windows.mjs`. Values are the
maximum delay in ms for pass 1 / pass 2.

| Action | Run 1 | Run 2 |
| --- | --- | --- |
| Idle | 19 / 18 | 18 / 24 |
| First Holdings open, then second | 98 / 45 | 100 / 82 |
| Holdings scroll down (6 flings) | 50 / 46 | 45 / 39 |
| Holdings scroll up | 41 / 60 | 39 / 50 |
| First Progress open, then second | 281 / 37 | 280 / 44 |
| Progress scroll to top | 40 / 39 | 63 / 35 |
| Range 3M | 114 / 101 | 116 / 118 |
| Range 6M | 119 / 94 | 77 / 159 |
| Range 1Y | 130 / 97 | 113 / 140 |
| Range All | 255 / 256 | 229 / 223 |
| Tab Dashboard | 46 / 49 | 39 / 40 |
| Tab Holdings revisit | 67 / 33 | 91 / 68 |
| Tab Progress revisit | 41 / 38 | 40 / 41 |
| Tab Dashboard revisit | 38 / 39 | 43 / 39 |
| Launch window | 324 | 222 |

**No window over 500 ms in either run** (0 of 72 and 0 of 71). The worst was
324 ms. Compared with the 2 November SDK 57 result, the margins widened. The
launch window fell from 470–478 ms to 222–324 ms, first Progress open from
398 ms to 280–281 ms, and Range All from 387–414 ms to 223–256 ms. No ANR,
`FATAL EXCEPTION` or crash entries.

### Cold launch to Dashboard (target 3 s)

`am force-stop`, then `am start`, with on-device `screencap | gzip` captures
timed from `/proc/uptime`, about every 0.25 s. Splash frames compress to about
90 KB and Dashboard frames to about 265 KB. Sample frames were checked by eye,
and the 265 KB frames show portfolio value, return, allocation and the tab bar.

| Run | Dashboard content (s) | Previous capture (s) |
| --- | ---: | ---: |
| 1 | 1.72 | 1.36 |
| 2 | 1.87 | 1.38 |
| 3 | 1.60 | 1.27 |
| 4 | 1.76 | 1.36 |
| 5 | 1.46 | 0.85 |

All five are under 3 s, with a median of 1.72 s (1.96 s on 1 November).

### Resume (target 1 s)

HOME, then `am start -W`: LaunchState HOT, TotalTime 116 / 113 / 232 / 267 / 292 ms.

### Not covered

Frame smoothness is not claimed. #299's measurement-validity problem is
unchanged and needs a physical device.

## Schema-crossing signed upgrade: 1.0.26 (schema 16) to main (schema 18)

Both sides are local release builds for x86_64, signed with the owner's private
upload key. Both pass `apksigner verify` with the same certificate (SHA-256
`1226c508e732fc1ab1d4ffb4c1ab23d22c4924a599244f6d638e2e933e481b54`). Neither
is debuggable.

| Side | Source | Version | Schema | APK SHA-256 |
| --- | --- | --- | --- | --- |
| Baseline | `v1.0.26-preview.1` (`b14e011`, SDK 54) | 1.0.26 / 27 | 16 | `b3197b162472dfb817412f07a118c74b0feb373a009363c3cdb4610f76d340a4` |
| Upgrade | `78f13b6` (main, SDK 58, R8) | 1.0.30 / 31 | 18 | `c0dab18fe16b75c08090e6b06c40fdf9eb595fcc85e362754d91c42c66e96d27` |

The upgrade crosses the schema 17 (payouts and coverage) and schema 18
(whole-portfolio measurement basis) migrations, plus SDK 54 → 58 and R8.

Sequence:

1. Exported the scale fixture from the e2e app as a schema-18 backup. Its
   schema-17/18 collections are empty: no distributions, no coverage, and a
   null measurement basis. Converted it to the equivalent schema-16 backup by
   removing those three keys and recomputing the checksum. 1.0.26's own
   `parsePortfolioBackup` accepted it (250 assets, 1,000 trades).
2. Replaced the emulator's production-package install with the 1.0.26 release.
   Restored that backup through Settings, Restore backup. The review showed
   250 assets, 250 openings, 1,000 records and 94 snapshots against 0 on the
   device.
3. Turned Wi-Fi and mobile data off, then exported the "before" backup from
   1.0.26 with the normal export UI. Envelope app version 1.0.26, schema 16.
4. Installed the main release over it with `adb install -r`. There was no
   uninstall, reset, restore or seeding. Logcat was cleared first and recorded
   no ANR or `FATAL EXCEPTION`.
5. Exported the "after" backup with the same UI: app version 1.0.30, schema 18.
   Then turned Wi-Fi and mobile data back on.

`src/testing/__tests__/upgradeBackupComparison.test.ts` with both paths, in
exact mode (no snapshot additions allowed):

```json
{"after":{"assets":250,"cashEntries":0,"monthlySnapshots":94,"openingPositions":250,"ppfAccounts":0,"ppfLedgerEntries":0,"trades":1000},
 "before":{"assets":250,"cashEntries":0,"monthlySnapshots":94,"openingPositions":250,"ppfAccounts":0,"ppfLedgerEntries":0,"trades":1000},
 "collectionsMatch":true,"payloadsMatch":true}
```

| Export | Bytes | SHA-256 |
| --- | ---: | --- |
| Before (1.0.26) | 282,052 | `7433168402c3e1b8bba1479cb9a1c7f43bed16a7312f6e9c4f7a36749f1ba9c8` |
| After (main) | 282,121 | `579ee2dfebc95f94ad657a7ca1155772b3e223af722d23ad660d86c76ed7272c` |

The comparator parses both exports with the current backup parser, which
normalises the schema-16 export to schema 18. The match therefore shows that
the device's stored-data migration produced exactly the portfolio that the
backup-path migration produces from the 1.0.26 export. Nothing was lost or
changed in the upgrade. The 69-byte difference is the three schema-18 keys and
the envelope metadata.

Limits:

- Cash, futures, PPF, EPF, payouts and coverage are empty in this fixture.
  Those collections still rely on the migration and backup unit tests.
- The baseline was seeded by restore, not by long-term use of 1.0.26. Its
  stored data is whatever 1.0.26 writes after a restore.

## Status for #138

| Gate | Result |
| --- | --- |
| Cold launch under 3 s | Pass, 1.46–1.87 s |
| Resume under 1 s | Pass, 113–292 ms |
| No event-loop stall over 500 ms | Pass, worst 324 ms over 143 windows |
| Fresh signed upgrade without data loss, crossing schema | Pass, `payloadsMatch: true` |
| Frame smoothness | Open, #299 needs a physical device |

# V3 closeout re-check on 1.0.32

Recorded 20 November 2026 for #138, on main `78755df` (1.0.32 / 33, schema 19).
The [8 November evidence](2026-11-08-v3-perf-and-upgrade.md) was recorded on
`78f13b6` (1.0.30, schema 18). This re-check was run because 153 commits have
landed since then, including:

- the #675 and #721 review fixes;
- the schema 19 migration of saved monthly figures (#680);
- preferences saved under their own key;
- recovery-copy and journal changes;
- the Cash shortfall, quote-priority and per-asset grouping changes that run
  on every save or holdings replay.

Synthetic data only. No EAS build or Play submission was used.

## Environment

- AVD `CogVest_UX_Proof`, Android 16 / API 36, x86_64, 1280x2856 at density
  480, font scale 1.0, light mode.
- Cold-booted with `-no-snapshot-load` about 25 minutes before the
  measurements. Gradle daemons were stopped and no build was running during
  them.
- Local builds from short-path worktrees: `G:\cv` for main and `G:\cvb` for the
  baseline, each with its own `npm ci`. CMake 3.31.6 ninja, `--max-workers=2`.
- Host apps stayed open. This is not a laboratory host-load guarantee.

## PC gate

`npm run test:v1:pc` on `78755df`, with each part run separately:

- `test:verify`:
  - typecheck, lint and Maestro lint;
  - Jest: 283 suites passed and 1 skipped; 2,941 tests passed and 3 skipped;
  - Expo Doctor 18/18.
- `android:doctor` passed.
- `android:smoke -- --strict` passed against the freshly installed signed
  1.0.32 release from the upgrade below.

The full Maestro tier ran on 19 November on `8d4f9f7`, which differs from
`78755df` only in docs. Of 65 flows, 56 passed in the run. The 9 that failed
were all caused by one emulator system-service crash, and each passed when
rerun alone. See [e2e-runs.md](e2e-runs.md).

## Performance

Build: e2e variant with `EXPO_PUBLIC_COGVEST_PERFORMANCE_PROBE=1`. The
generated asset folders were deleted first so the JavaScript bundle was rebuilt,
and the bundle contains `cogvest-performance`. APK SHA-256
`1b22c6737a07b662ab25244585162404388db449cd1a8b614f3a71e8a6674050`.

Fixture: `e2e/visual/scale-prepare.yaml`, re-seeded right after install. It has
250 assets, 250 openings, 1,000 transactions, 94 snapshots and the 10-year daily
caches.

### Event-loop stalls (target: none over 500 ms)

Method as on 8 November: `scripts/measure-android-stalls.sh` with raw
`adb input` and 11 s idle between actions, attributed with
`scripts/attribute-probe-windows.mjs`. The tab bar now has five tabs, but the
script's tap positions still land on Dashboard, Holdings, Progress and the
3M/6M/1Y/All range chips; this was checked on a screenshot before the runs.
Values are the maximum delay in ms for pass 1 / pass 2.

| Action | Run 1 | Run 2 |
| --- | --- | --- |
| Idle | 19 / 21 | 20 / 19 |
| First Holdings open, then second | 89 / 38 | 64 / 40 |
| Holdings scroll down (6 flings) | 35 / 28 | 24 / 40 |
| Holdings scroll up | 39 / 48 | 47 / 23 |
| First Progress open, then second | 202 / 75 | 246 / 133 |
| Progress scroll to top | 45 / 41 | 40 / 23 |
| Range 3M | 134 / 128 | 125 / 107 |
| Range 6M | 95 / 78 | 82 / 76 |
| Range 1Y | 130 / 108 | 125 / 88 |
| Range All | 133 / 139 | 159 / 186 |
| Tab Dashboard | 40 / 40 | 42 / 28 |
| Tab Holdings revisit | 41 / 40 | 40 / 38 |
| Tab Progress revisit | 89 / 84 | 134 / 49 |
| Tab Dashboard revisit | 26 / 38 | 42 / 43 |
| Launch window | 226 | 273 |

**No window over 500 ms in either run** (0 of 71 each). The worst was 273 ms,
in the launch window. Compared with 8 November:

- launch window: 222–324 → 226–273 ms;
- first Progress open: 280–281 → 202–246 ms;
- Range All: 223–256 → 133–186 ms.

No ANR, `FATAL EXCEPTION` or crash entries.

### Cold launch to Dashboard (target 3 s)

`am force-stop`, then `am start`, with on-device `screencap | gzip` captures
timed from `/proc/uptime`, about every 0.2 s. Splash frames compress to about
90 KB and Dashboard frames to about 266 KB. A frame captured 1.4 s into a
separate launch shows the fully rendered Dashboard: portfolio value, P&L, XIRR,
allocation and the tab bar.

| Run | Dashboard content (s) | Previous capture (s) |
| --- | ---: | ---: |
| 1 | 1.29 | 1.08 |
| 2 | 1.20 | 0.99 |
| 3 | 1.21 | 0.99 |
| 4 | 1.36 | 1.18 |
| 5 | 1.32 | 1.12 |

All five are under 3 s, with a median of 1.29 s (1.72 s on 8 November).

### Resume (target 1 s)

HOME, then `am start -W`: LaunchState HOT, TotalTime 155 / 151 / 149 / 140 /
161 ms.

## Signed upgrade across schema 19: 1.0.30 to 1.0.32

Both sides are local release builds for x86_64, signed with the owner's private
upload key. Both pass `apksigner verify` with the same certificate as on
8 November (SHA-256
`1226c508e732fc1ab1d4ffb4c1ab23d22c4924a599244f6d638e2e933e481b54`). The
installed APK hashes were checked on the device with `sha256sum` on the
`pm path` APK.

| Side | Source | Version | Schema | APK SHA-256 |
| --- | --- | --- | --- | --- |
| Baseline | `78f13b6` (main on 8 November) | 1.0.30 / 31 | 18 | `934a06e20986f6a46138ff3e6cc760e83e7b3d823acd89fccdd39c46abcd315b` |
| Upgrade | `78755df` (main) | 1.0.32 / 33 | 19 | `b921d97f8765d74f910137878957e86fc217ec0149e45bc43ddc61fd41850d6b` |

The baseline APK differs from the 8 November build of the same commit, because
local release builds are not byte-reproducible. The upgrade crosses:

- the schema 19 migration of saved monthly figures;
- preferences moving to their own storage key;
- the recovery-copy and journal changes;
- the switch from react-native-gifted-charts to Victory Native.

### Giving the migration work to do

The scale fixture's snapshots have no saved monthly figures (performance
basis), so on its own it would not exercise schema 19. The baseline backup was
prepared from an e2e export of the fixture. For every month, a temporary,
uncommitted script set the basis 1.0.30 would have saved: the one built before
#647, with no Cash entries and trades left out. This is the "before" basis the
schema 19 migration assumes. The script then:

- relabelled the backup as schema 18 and app version 1.0.30;
- recomputed the checksum.

All 94 months had a complete basis. The current backup parser's schema 19
migration changes 4 of them, the months with trades.

### Sequence

1. Uninstalled the old production-package install on the emulator, which held
   synthetic data from 8 November, and installed the 1.0.30 baseline fresh.
2. Restored the prepared backup through Restore backup. 1.0.30's own parser
   accepted it, and the review showed 250 assets, 250 openings, 1,000 records
   and 94 snapshots against 0 on the device.
3. Exported the "before" backup with the normal export UI
   (`e2e/standalone/upgrade-export.yaml`): app version 1.0.30, schema 18.
4. Cleared logcat and installed the 1.0.32 release over it with
   `adb install -r`. There was no uninstall, reset, restore or seeding.
5. Exported the "after" backup with the same flow: app version 1.0.32,
   schema 19. Logcat recorded no ANR or `FATAL EXCEPTION`.

Wi-Fi and mobile data stayed on: switching them off was not permitted in this
session. The fixture's tickers are synthetic and no saved price changed between
the exports, so the exact comparison below includes the quote caches.

### Result

`src/testing/__tests__/upgradeBackupComparison.test.ts` with both paths, in
exact mode (no snapshot additions allowed), 6 of 6 passed:

```json
{"after":{"assets":250,"cashEntries":0,"monthlySnapshots":94,"openingPositions":250,"ppfAccounts":0,"ppfLedgerEntries":0,"trades":1000},
 "before":{"assets":250,"cashEntries":0,"monthlySnapshots":94,"openingPositions":250,"ppfAccounts":0,"ppfLedgerEntries":0,"trades":1000},
 "collectionsMatch":true,"payloadsMatch":true}
```

| Export | Bytes | SHA-256 |
| --- | ---: | --- |
| Before (1.0.30) | 291,532 | `1b33ecce5b86bbe35d193e129dedc14f725c11f9ab08ac9d440488184261e199` |
| After (1.0.32) | 291,586 | `5295a34673756b314fcfeb2c380f0a6d36eed345c890263773acc71334c2bf03` |

The comparator parses both exports with the current backup parser, which
migrates the schema 18 export to schema 19. The match therefore shows that the
device's stored-data migration produced exactly what the backup-path migration
produces.

The raw exports also show that the device migration ran. 4 of the 94 saved
bases differ between "before" and "after". For example, 2021-06's net external
flow went from 0 to 561,250 and its weighted flow from 0 to 299,333.33. All
other records are unchanged.

Limits:

- Cash, futures, PPF, EPF, payouts and coverage are empty in this fixture.
  Those collections still rely on the migration and backup unit tests.
- The baseline was seeded by restore, not by long-term use of 1.0.30.
- Its saved bases were prepared to the pre-#647 rule, not saved by 1.0.30's own
  month-end automation.

## Status for #138

| Gate | Result |
| --- | --- |
| Cold launch under 3 s | Pass, 1.20–1.36 s |
| Resume under 1 s | Pass, 140–161 ms |
| No event-loop stall over 500 ms | Pass, worst 273 ms over 142 windows |
| Fresh signed upgrade without data loss, crossing schema 19 | Pass, `payloadsMatch: true`, migration applied on device |
| `test:v1:pc` | Pass |
| Frame smoothness | Pass on 8 November on the Galaxy S23 FE (#299, #642); not re-measured |

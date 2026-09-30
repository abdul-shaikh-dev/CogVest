# Investing-only Cash verification

Issue: #441. Branch: `investing-cash-without-income`.

## Preservation and compatibility

- Portfolio schema 15 maps legacy `income` additions to `capitalContribution`
  and removes only snapshot `salary` and `monthlyExpense`. Cash identifiers,
  values, dates, labels/notes, links, snapshot investment values and evidence are
  retained. Ambiguous Cash remains ambiguous.
- Unit tests compare the entire migrated backup payload, including PPF,
  purchase funding, linked Futures funding, preferences, CAS identity and quote
  caches. A second restart is byte-stable and does not repeat the migration write.
- Signed complete backups from schemas 9-14 are checked against their original
  checksum, validated, migrated, restored and re-exported. Malformed records,
  missing purposes, negative legacy metadata and retired current-schema fields
  are rejected. Storage failure retains the original raw record and blocks
  normal writes until recovery; new writes cannot reintroduce retired fields.
- Existing backup files and recovery copies are not rewritten. Preserved labels
  and notes can still mention salary. This is not a historical-text scrub.

## Installed Android Scope

Fresh local x86_64 debug APK built and installed with `adb install -r`:
`android/app/build/outputs/apk/debug/app-debug.apk`.

SHA-256: `2EC5856CB5FB65F807438F2C61D95E102F642DD6BDB9609414EEB2D1FE554CEE`.
Package `com.abdulshaikh.cogvest`, version 1.0.10 / code 11.
Expo dev-client with current JavaScript served by Metro on port 8081, not a
standalone preview bundle. AVD reported by Maestro: Pixel_10_Pro, emulator-5554,
Android API 36. Native display: 1280 x 2856, density 480, font scale 1.0.
The enlarged-text matrix uses a 1080 x 2400 override at density 480 and font
scale 1.3; overrides are restored afterward.

The development-only `investing-cash-qa` route uses a separate real MMKV database,
an explicit synthetic-data confirmation and a development/token gate. It never
replaces the default user portfolio. Schema 14 is staged once, then migrated on
app restart without reset/reseed. Full-payload equality and the linked Futures
transfer are asserted again after a second cold restart. This verifies real
native-storage migration, not an old standalone APK-to-new standalone APK upgrade.
No user portfolio, cloud build or Play submission was used.

## Automated Results

- `npm run test:v1:pc`: PASS, including `test:verify`, typecheck, 172 Jest suites,
  1,819 tests, Expo Doctor 17/17, Android doctor and installed package smoke.
  Existing exclusions: one suite / three tests skipped.
- Focused migration, backup, Cash, Progress, calculation and route tests passed.
- Maestro Cash add/delete: saved value asserted, repeated save does not duplicate,
  deletion restores the empty result.
- Maestro funded purchase: two units at INR 100, remaining Cash INR 800.
- Maestro Cash-to-Futures: INR 9,000 linked withdrawal from INR 10,000,
  remaining Cash INR 1,000 and wallet 100 USDT, still present after relaunch.
- Maestro legacy migration: complete payload equality across two cold restarts,
  Cash INR 41,200 and one linked Futures transfer; no income choice or retired
  snapshot inputs.
- Earlier sandbox-only Expo Doctor checks were blocked by network permission;
  the full authorized run passed. One Futures attempt lost its route while Metro
  reloaded edited JavaScript; the unchanged accounting flow passed on rerun with
  no concurrent source edits. A visual harness page-state reuse failure was fixed
  by remounting its page-local state and rerun.

## Visual Evidence

Artifacts: `artifacts/2026-09-30-investing-cash/`. Each configuration captures
Cash, its deposit and correction flows, Dashboard, Progress, monthly history,
month detail and snapshot correction. Prefixes identify default/narrow130 and
standard/minimal-masked modes. Synthetic free-text `Salary added` is deliberately
preserved; it is not an income input or income classification.

The focused visual review corrected the monthly-investment field to full width
after removing its former salary column. It also found a pre-existing snapshot
correction masking gap: the screen now requires an explicit local reveal, using
the existing shared control. Revealing does not change the global masking
preference, and reopening hides the fields again. Masked-gate screenshots and
post-reveal form screenshots are recorded separately.

Both visual matrix runs passed. Enlarged-text evidence was recaptured after a
cold launch: changing Android font scale while the process was running left stale
native text measurements in the first capture. The retained captures use the
correct cold-start configuration. Supplemental captures show Dashboard's two
remaining activity metrics and the full-width monthly-investment input.

Visual scope is the retired household controls and remaining investing controls,
not a new app-wide UX audit. The enlarged-text capture also exposed overflow in
the snapshot save/cancel row; its actions now wrap to remain fully on-screen.

Release scope limitation: standalone preview installation/upgrade on a physical
phone remains untested. The native debug/Metro evidence above must not be described
as standalone preview verification.

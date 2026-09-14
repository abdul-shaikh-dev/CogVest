# Bulk transaction deletion (#336)

## Safety contract

- Selection is scoped to the transactions shown on the current screen. The
  preview distinguishes all shown records from an individual selection.
- Preview and commit run the same full-portfolio validation. Missing or stale
  records, inconsistent cash links, a negative cash timeline, oversold holdings,
  or broken corporate-action dependencies block the entire selection.
- Linked purchase funding and sale proceeds are removed with their selected
  transactions. Unrelated cash entries, assets and opening positions remain.
- Automatic snapshots from the earliest affected month are rebuilt when price
  evidence permits. Manual snapshots remain unchanged.
- When every supporting record for a demerger is removed and neither side keeps
  dependent records, the now-unbacked link is detached. Partial deletion remains
  blocked when successor history would become invalid.
- Import provenance is deleted only with its transaction. CogVest stores no
  deletion tombstone, so deliberately importing the source again can restore the
  removed row; duplicate records that remain saved are still suppressed.
- Cancellation, Android back, validation failure and persistence failure do not
  change any portfolio record.

## Automated verification

Store and UI regressions cover selected-count and select-all scope, cancellation,
dependency failures, linked cash, automatic versus manual snapshots, durable
rollback, restart, backup/restore, corporate-action cleanup and deliberate
reimport. The full repository gate passed 160 suites with one skipped: 1,665
tests passed and two skipped. Expo Doctor passed 17/17 checks after its online
metadata checks were run with network access.

## Fresh Android verification

A fresh debug APK was built from the issue branch and installed after wiping only
the disposable emulator. APK SHA-256:
`A2F45CCA4C36D680ACD608B3C011668E88C69C9A96D4376DAB938ACD8C94171F`.

- AVD: Pixel_10_Pro, Android API 36, 1280x2856, density 480, font scale 1.0.
- Flow: `e2e/bulk-transaction-delete.yaml` using invented in-memory records.
- Android back closed the preview without deletion; cancelling selection left the
  purchase visible.
- Final confirmation removed exactly one selected purchase. The asserted result
  changed from 20 units and INR 1,510 basis to 10 units and INR 500 basis.
- The deletion preview screenshot was visually inspected for hierarchy,
  readability, destructive-action distinction and reachable controls.

No private portfolio or source statement was used for destructive verification.

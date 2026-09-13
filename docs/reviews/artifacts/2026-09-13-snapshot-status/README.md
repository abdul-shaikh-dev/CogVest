# Snapshot status Android verification

Verified on 13 September 2026 using a freshly built x86_64 debug APK installed
on `emulator-5554` at 1280 x 2856.

- `01-generating.png`: an active 32-month backfill names the current month,
  checked/total progress, latest stored month, and requirement to keep CogVest
  open. No correction action is shown.
- `02-estimated.png`: after backfill, the card changes to the estimated-history
  state instead of reporting a generic incomplete snapshot.
- `03-generating-font-130.png`: the generating state remains readable at 130%
  Android font scale. Android Back dismissed its detail surface; this flow has no
  keyboard or save mutation.

Deterministic tests cover empty, checking, complete, estimated, missing-price,
incomplete-PPF, record-incomplete, first-month waiting, and reconstructed-history
presentation states, including targeted routing and retry behavior.

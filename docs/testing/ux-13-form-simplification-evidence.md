# Form Simplification: UX-13 / #362

Verified 2026-09-19 on `ux-13-form-simplification`, based on `fd29d0d`.

## Contract

Add Holding keeps its four-phase progress and lookup-first path while reducing
duplicate labels and button-like chrome. Recent searches start collapsed and
manual entry remains visible as a secondary fallback.

Cash and PPF keep required financial fields and save/review actions visible.
Optional notes start collapsed and retain entered values when hidden or when the
user returns to the draft. PPF contribution limits keep a concise summary with
the longer explanation on demand. Settings uses the Standard/Minimal option
descriptions as its single explanation and removes the repeated Minimal nudge.
No persistence schema, calculation, provider, or financial validation changed.

## Verification Record

- Focused component suites: 4 passed, 79 tests. Coverage includes collapsed
  recents, manual fallback, optional-note retention, rule disclosure, and the
  absence of the redundant Settings nudge.
- `npm run test:verify`: passed, 164 suites / 1,697 tests, typecheck, and Expo
  Doctor 17/17.
- `npm run test:v1:pc`: passed with the same complete suite plus Android Doctor
  and strict installed-package smoke on `emulator-5554`.
- `npm run maestro:check`: passed with Maestro 2.5.1 and the installed package.
- Installed-app journeys passed for `contextual-nudges.yaml`,
  `cash-entry-focus.yaml`, `ppf-account.yaml`, and
  `add-holding-review-hierarchy.yaml`. They assert resulting holding and cash
  data, cash draft retention, PPF note retention through review/edit and Android
  Back, account persistence, and the Settings hierarchy.
- Impeccable static detection returned no findings for the four changed screens.
- A fresh local debug APK was built and installed. SHA256:
  `BD3F0D650F4796294CCA7E35D2ECA45B2E1C40206251940553EF372FCFD20022`.
  This is a Metro-backed debug build, not a standalone release claim.

## Android Visual Check

Device: Pixel 10 Pro AVD, Android API 36, density 480. Normal-width review used
approximately 427dp at 100% text. Narrow/enlarged review used an override of
1080x2410 (360dp) at 130% text with the real docked keyboard enabled.

The four Add Holding phases wrap without clipping and its lookup remains first.
Cash and PPF primary actions remain reachable with optional content collapsed.
Expanded multiline notes remain fully above the docked keyboard. Settings moves
directly from the display choices into Privacy & storage without repeated copy.
The emulator was restored to its physical 1280x2856 size, 100% text, and original
stylus-handwriting setting after capture; the task Metro process was stopped.

## Captures

- [Add Holding at normal text](artifacts/ux-13-form-simplification/add-holding-427dp-100.png)
- [Add Holding at enlarged text](artifacts/ux-13-form-simplification/add-holding-360dp-130.png)
- [Add Holding with keyboard](artifacts/ux-13-form-simplification/add-holding-keyboard-360dp-130.png)
- [Cash entry at enlarged text](artifacts/ux-13-form-simplification/cash-entry-360dp-130.png)
- [Cash note with keyboard](artifacts/ux-13-form-simplification/cash-note-keyboard-360dp-130.png)
- [PPF entry at enlarged text](artifacts/ux-13-form-simplification/ppf-entry-360dp-130.png)
- [PPF note with keyboard](artifacts/ux-13-form-simplification/ppf-note-keyboard-360dp-130.png)
- [Settings at enlarged text](artifacts/ux-13-form-simplification/settings-360dp-130.png)

## Limits

Synthetic local data only; no user financial files were loaded. Accessible
roles, states, labels, enlarged text, and keyboard behavior were checked, but a
full TalkBack certification and physical-phone run are not claimed. EAS builds
and release workflows were not triggered.

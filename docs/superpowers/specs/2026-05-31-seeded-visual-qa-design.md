# Seeded Visual QA Harness Design

## Goal

Issue #115 needs a repeatable PC-only way to seed a representative V1 portfolio and capture app screenshots against the accepted HTML/Figma baseline.

## Approach

Use a hidden deep link route, `cogvest:///visual-qa-seed`, that seeds the existing Zustand/MMKV portfolio store through normal store actions. The seed route is inert unless the app is a development build or the local visual QA token is supplied by the harness, so fake data is not exposed in normal user flows.

Add a host script, `npm run visual-qa:android`, that:

- Requires an installed local Android build on the Android emulator.
- Opens the dev-only seed deep link.
- Captures Dashboard, Holdings, Add Holding, Cash Ledger, Monthly Progress, and Settings screenshots with `adb`.
- Writes artifacts to `docs/testing/artifacts/visual-qa/latest`.

The harness deliberately avoids EAS, physical phones, default PR CI, and direct host-side MMKV file editing.

## Seed State

The seed state includes equity, debt, crypto, and cash; recent ledger entries; quotes/manual fallback metadata; optional conviction on one opening position; and multiple monthly snapshots so Progress charts render.

## Boundaries

- No production demo mode or linked demo UI.
- No cloud builds.
- No visual QA in default GitHub Actions.
- No fake data in normal app navigation unless the dev-only seed route is explicitly opened.

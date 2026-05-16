# Issue #76 Progress Route Naming Spec

## Goal

Normalize the V1 Progress route so file-based Expo Router names match the
user-facing Progress / Monthly Progress language.

## Scope

- Rename the tab route from `history` to `progress`.
- Keep the tab label `Progress`.
- Keep stable automation IDs: `tab-progress` and `progress-screen`.
- Remove the duplicate root-level Progress route unless tests prove it is
  required.
- Do not change Monthly Progress product behavior or UI layout.

## Non-Goals

- No Progress screen redesign.
- No monthly snapshot logic changes.
- No changes to Maestro IDs or user-facing labels.

## Acceptance Checklist

- The tab route file is `app/(tabs)/progress.tsx`.
- The tab layout registers `name="progress"`.
- The tab icon mapping uses `progress`, not `history`.
- `history` route references are removed from app code.
- Existing Progress screen tests and route tests pass.

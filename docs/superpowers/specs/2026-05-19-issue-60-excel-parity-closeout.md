# Issue #60 Excel Parity Closeout Spec

## Goal

Close out the V1 Excel tracker parity parent issue with current evidence, not
new product scope.

## Scope

- Verify that #61 through #66 have been implemented and closed.
- Run the V1 PC verification gate on the current branch.
- Record command evidence for static tests, Expo doctor, Android doctor, and
  strict installed-app smoke.
- Update stale housekeeping docs that still describe #60 parity as incomplete
  because they predate the V1 issue sequence.
- Add an evidence file under `docs/testing/` that maps #60 gate questions to
  current app locations and automated/manual evidence.

## Non-Goals

- No new portfolio features.
- No Excel import/export.
- No V2/V3 work.
- No EAS cloud build.
- No Play Store release work.

## Closure Rule

#60 can be closed only if:

- `npm run test:v1:pc` passes on this PC.
- Android smoke finds `com.abdulshaikh.cogvest` installed on the emulator.
- The parity evidence file documents every #60 question as pass or linked
  defect.
- Any stale docs are updated to avoid telling future agents the closed V1
  slices are still missing.

## Expected Output

- `docs/testing/excel-parity-verification-2026-05-19.md`
- Updated housekeeping status docs.
- PR body includes `Closes #60`.

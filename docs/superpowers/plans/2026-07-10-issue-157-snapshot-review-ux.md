# Issue #157: Snapshot Review UX Plan

## 1. Extract The Review Surface

- Add a feature-level `ReviewSnapshotScreen` using the existing `useProgress` form state and validation contract.
- On first load, run the idempotent automation check and prefill the form from the generated or latest snapshot without overwriting user edits.
- Add a cancel action and return to Progress after a successful save.

## 2. Wire Navigation

- Add an Expo Router route and stack entry for `review-snapshot`.
- Replace Progress's local review state and inline form with navigation from the compact status card.
- Keep the status card and automation message on Progress.

## 3. Preserve Test Coverage

- Move form-save and duplicate-month assertions to review-screen tests.
- Update Progress tests to assert navigation intent, compact status, and the automatic empty-state explanation.

## 4. Refresh Documentation And Verify

- Update the V1 test plan, PC checklist, core-flow matrix, and Excel parity checklist.
- Run focused Progress tests and `npm run test:v1:pc`.

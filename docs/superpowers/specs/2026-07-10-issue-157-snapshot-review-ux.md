# Issue #157: Snapshot Review UX

## Purpose

Monthly Progress automatically creates a missing completed-month snapshot. The review UI must make that automation clear without forcing a long data-entry form into the primary Progress screen.

## Accepted Design

- Monthly Progress keeps a compact `Month-end snapshot` status card near the top of the screen.
- `Review snapshot` opens a dedicated `Review Snapshot` route, not a modal or an expanded form at the bottom of Progress.
- The review route is an optional correction flow. It opens with the generated or latest snapshot values prefilled.
- The review route uses clear language: generated automatically, edit only when a correction is needed, and `Save snapshot changes`.
- Cancel/back returns to Progress without changing persisted data.

## Behavioural Contract

- Existing `ensureMonthEndSnapshot()` automation, derived calculations, validation, and update-versus-create persistence rules remain unchanged.
- Saving a review for an existing month updates that snapshot rather than creating a duplicate.
- Empty Progress copy explains that snapshots are created automatically once portfolio data exists.

## Scope

In scope: dedicated review route, moved form, navigation, tests, and V1 verification documentation.

Out of scope: automation-rule changes, historical-price retrieval changes, chart redesign, background jobs, and notifications.

## Acceptance Evidence

- Progress never implies that a user must manually record a snapshot.
- The full form is absent from the main Progress screen.
- Review values prefill from the generated/latest snapshot and save in place.
- Focused Progress tests and `npm run test:v1:pc` pass.

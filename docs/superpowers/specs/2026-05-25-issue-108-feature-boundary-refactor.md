# Issue 108 Feature Boundary Refactor Spec

## Goal

Refactor Add Holding, Add Trade, and Monthly Progress so feature orchestration lives in feature hooks/controllers while screens remain mostly presentational.

## Current State

- CogVest has no backend and no server routes.
- Third-party quote/search calls live under `src/services`.
- Raw state and persistence live under `src/store`.
- Pure calculations and validators live under `src/domain`.
- The main boundary problem is feature screens mixing UI rendering with orchestration.

## Target Architecture

- `AddOpeningPositionForm.tsx` renders the Add Holding flow and delegates state/actions to `useAddOpeningPosition`.
- `add-trade-form.tsx` renders the Add Trade/Add Holding legacy flow and delegates state/actions to `useAddTrade`.
- `ProgressScreen.tsx` renders the Monthly Progress screen and delegates snapshot form, derived metrics, and persistence actions to `useProgress`.
- Existing domain/service/store boundaries stay unchanged.

## Scope

- Create feature-local hooks/controllers.
- Move orchestration logic out of the three screen components.
- Preserve existing UI behavior and test IDs.
- Add hook/controller tests where logic is extracted.
- Keep this as a refactor: no new product behavior.

## Non-Goals

- No backend, auth, cloud sync, analytics, or push notifications.
- No V2/V3 features.
- No Minimal Mode or LTCG UI.
- No import/export or historical quote fetching.
- No visual redesign.
- No app-wide architecture rewrite.

## Acceptance Criteria

- Add Holding screen no longer owns lookup, quote resolution, validation, derived preview, and persistence orchestration in the component body.
- Add Trade screen no longer owns validation and persistence orchestration in the component body.
- Monthly Progress screen no longer owns snapshot calculation/persistence orchestration in the component body.
- Existing Add Holding, Add Trade, and Monthly Progress screen tests pass.
- Hook/controller tests cover moved orchestration.
- `src/domain` and `src/components` import-direction checks still pass.
- Backend dependency/route scan still shows no backend/auth/cloud addition.

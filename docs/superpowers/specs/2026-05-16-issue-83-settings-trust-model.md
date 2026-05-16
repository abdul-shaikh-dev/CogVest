# Issue #83 Settings Trust Model Spec

## Goal

Align V1 Settings with the local-first trust model so every row is either a
real control, a real status, or an explicit V1-deferred item.

## Scope

- Keep value masking as the only interactive Settings control in this slice.
- Derive quote status from stored quote cache data.
- Show local-first privacy guarantees clearly: local storage active, no account,
  no cloud sync, no analytics.
- Mark unsupported V1 items as locked or deferred instead of making them look
  configurable.
- Keep clear-local-data non-interactive until a confirmation/reset flow is
  implemented.

## Settings Row Classification

- Real control: Value masking toggle.
- Real status: local storage, account/cloud/analytics status, quote count,
  latest quote refresh, provider mix, manual fallback count, base currency.
- Deferred: display density changes, export/backup, clear local data.
- Hidden from V1 Settings: Minimal Mode, LTCG, cloud sync, auth, analytics.

## Quote Status Rules

- If quote cache is empty, show quote freshness as `No quotes yet`.
- If quote cache has entries, show latest quote date from the newest `asOf`
  value.
- Provider status is derived from quote sources:
  - no quotes: `Waiting for holdings`
  - at least one live source: `Live available`
  - only manual quotes: `Manual only`
- Manual fallback status shows the number of manual cached quotes.

## Data Safety Rules

- Do not implement destructive clearing in this issue.
- Clear local data must be visibly disabled/deferred and must not be pressable.
- Do not add fake settings values or V2/V3 controls.

## Acceptance Checklist

- Settings has no misleading controls.
- Value masking remains functional and tested.
- Quote rows reflect real quote cache state.
- Clear local data is clearly unavailable in V1.
- Local-first status is obvious and trustworthy.

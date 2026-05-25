# Issue 104 Add Holding Explicit Selection Design

## Goal

Align Add Holding lookup with the accepted V1 baseline: lookup results are
suggestions until the user explicitly selects one.

## Root Cause

`AddOpeningPositionForm` currently has two implicit selection paths:

- an effect that auto-selects exact symbol/ticker/quote-source matches
- search-submit handling that picks the preferred lookup result

Both paths can mutate asset fields and trigger quote lookup before the user
chooses a visible result. That contradicts `docs/design/v1-screen-baseline.md`.

## Required Behavior

- Typing a search query only fetches and displays lookup results.
- Exact matches do not autofill fields.
- Pressing Enter/Search in the lookup input does not pick a result.
- The user explicitly selects a visible result row.
- Selection autofills asset metadata and triggers live quote lookup.
- Quote failure after explicit selection leaves current price editable and shows
  manual fallback copy.
- Manual entry remains available without choosing a lookup result.

## Scope

Modify only the Add Holding lookup behavior and tests. Do not redesign the
entire flow, change quote providers, add advanced search, or add V2/V3 scope.

## Verification

- Focused tests prove exact-match lookup does not autofill before selection.
- Focused tests prove search submit does not auto-pick a result.
- Existing explicit-select quote success and fallback tests continue to pass.
- Existing manual Add Holding save flow continues to pass.

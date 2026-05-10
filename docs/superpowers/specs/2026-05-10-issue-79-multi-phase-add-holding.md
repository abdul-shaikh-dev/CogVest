# Issue 79 Multi-Phase Add Holding Design

## Goal
Turn Add Holding from one long form into a guided V1 opening-position flow that matches the current Figma direction while preserving Excel parity fields and issue #84 asset lookup/autofill.

## Scope
This issue changes only the Add Holding screen and its tests. It does not add new persistence models, import/export, Minimal Mode, tax UI, or spreadsheet-like grids.

## Flow
The screen uses four phases:
- Asset: search/select or manually enter asset name, symbol, ticker, and quote source ID.
- Class: choose asset class and edit instrument/sector metadata.
- Position: enter quantity, average cost, current price, acquisition date, optional conviction, and note.
- Review: show derived preview and save actions.

The phase stepper is always visible below the header. Users can move backward, and completed/previous phases remain editable by tapping the step or using Back.

## Validation Rules
Forward navigation validates only the current phase:
- Asset requires asset name, symbol, ticker, and quote source ID.
- Class requires valid asset class, instrument type, and sector type.
- Position requires valid quantity, average cost, current price, date, and optional conviction.
- Review runs the full existing `validateOpeningPositionForm` check before building the derived preview.

Existing full-form validation remains the final save gate.

## Data Flow
The component continues to own local form state and persists only on final Save Holding. The review phase builds the same `Asset` and `OpeningPosition` objects as today, uses `calculateHolding` for derived preview, and saves to the existing portfolio store.

Issue #84 lookup results remain part of the Asset phase. Selecting a lookup result still autofills metadata and attempts a one-off live quote. Manual fallback remains available.

## UI Direction
Use the existing true-dark premium components:
- Large `Add Holding` header with `Opening position • local only`.
- Compact stepper: Asset, Class, Position, Review.
- One focused card per phase instead of showing every field at once.
- Summary cards for prior phases so the user understands progress.
- Primary CTA changes by phase: Continue to classification, Continue to position, Review holding, Save Holding.
- Secondary action supports Back or Save and add another where applicable.

## Testing
Tests must cover:
- Initial screen shows Asset phase and stepper, not all later fields.
- Asset phase validates before moving forward.
- User can move Asset → Class → Position → Review.
- Back/step navigation allows editing previous phases.
- Review phase shows derived preview before save.
- Final save persists an opening position and no trade records.
- Existing lookup autofill still works inside the Asset phase.

## Acceptance Criteria
- Add Holding visibly supports Asset → Class → Position → Review.
- It is no longer one single long form.
- User-facing copy uses Add Holding/opening-position language.
- Derived values are shown before saving.
- Save behavior persists opening positions with raw data and derived calculations unchanged.
- Existing Add Holding tests pass after being updated to the phased behavior.

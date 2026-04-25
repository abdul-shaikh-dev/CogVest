# CogVest V3 Advanced and Polish Spec

## Goal

Add advanced market, tax, backup, and polish features after V1/V2 validate the product direction.

## Target User Value

The user can inspect historical performance, discover assets more easily, export local data, and rely on stronger tax/quote/release hardening.

## Included Features

- Historical asset charts.
- Advanced asset search.
- Import/export and local backup flows.
- Advanced FIFO multi-lot LTCG.
- Quote caching improvements and stale-state UI.
- Advanced dashboard widgets.
- UI polish, animations, and performance hardening.
- Optional Play Store submission automation.

## Explicitly Excluded Features

- Backend account system unless a later roadmap explicitly approves it.
- Cloud sync unless a later roadmap explicitly approves it.
- Brokerage integrations.
- Social features.

## Screens Included

- Asset Detail with historical charts.
- Advanced Asset Search.
- Import/Export.
- Advanced LTCG lot detail.
- Advanced dashboard widgets.

## Data Model Changes

- Export/import file schema.
- Quote cache metadata.
- Optional local data schema versioning.
- Lot-level derived views remain derived from raw trades.

## Domain Calculations Required

- Historical chart transforms.
- FIFO lot matching.
- Import validation.
- Export serialization.
- Quote cache freshness checks.

## Acceptance Criteria

- Import/export round trips V1/V2 raw data.
- FIFO LTCG handles partial sells and multiple lots.
- Historical charts gracefully fallback on API failure.
- UI remains performant on Android.

## Test Plan

- Unit tests for FIFO, import/export, quote cache, chart transforms.
- Component tests for fallback states.
- Limited Maestro release-flow coverage.

## Manual QA Checklist

- Export data, reinstall, import data.
- Check chart fallback offline.
- Validate multi-lot LTCG examples.
- Review Android performance on a real device.

## Definition of Done

- V1 and V2 gates still pass.
- Advanced features have tests and manual release notes.
- Data migration risks are documented.

## Release Gate

- V1/V2 gates still pass.
- Import/export works with sample files.
- FIFO tests cover boundaries.
- Performance is acceptable on Android.

## Release/Build Requirements

- Production AAB for store release.
- Optional EAS Submit documented or configured.

## Local Data/Versioning Impact

V3 may require explicit schema versioning and migration. Destructive resets are not allowed.

## Privacy/Security Notes

Export files contain sensitive financial data and must be clearly marked as user-controlled local files.

## Known Risks/Deferred Decisions

- Import format scope.
- Chart API limits and caching.
- Whether Play Store submission automation is worth maintaining.

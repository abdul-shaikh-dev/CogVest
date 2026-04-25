# V3 Testing Plan

## Automated Tests

- V1 and V2 tests continue to pass.
- Unit tests for FIFO lot matching, import/export round trip, quote cache freshness, and chart transforms.
- Component tests for chart loading/error/stale states.

## Manual QA

- Export local data and import into clean app state.
- Validate historical chart fallback on API failure.
- Review advanced asset search results.
- Verify multi-lot LTCG examples.
- Run Android performance pass on real device.

## E2E Scope

Add limited Maestro flows for import/export and advanced asset search if stable enough.

## Release Gate

- V1/V2 gates still pass.
- Data migration risk is documented.
- Import/export works with sample files.

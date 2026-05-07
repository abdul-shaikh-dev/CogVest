# V2 Testing Plan

## Automated Tests

- V1 tests continue to pass.
- Unit tests for conviction analytics, patience, trade frequency, basic LTCG, and insight generation.
- Component tests for Minimal Mode and insight cards.

## Manual QA

- Toggle Minimal Mode from Settings.
- Confirm day-change noise is hidden.
- Confirm Add Holding and Cash remain available.
- Add intended hold, sell later, verify patience insight.
- Generate enough rated trades for conviction insight.
- Verify LTCG appears for Indian stock/ETF and never for crypto.

## Data Compatibility

Open existing V1 persisted data without destructive reset. Missing V2 fields must default safely.

## Release Gate

- V1 gate still passes.
- Minimal Mode works on supported screens.
- Behaviour insight tone remains non-scolding.

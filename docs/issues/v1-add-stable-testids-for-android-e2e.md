# [V1] Add stable testIDs for Android E2E testing

GitHub issue: https://github.com/abdul-shaikh-dev/CogVest/issues/50

## Context

The Android PC test harness includes optional Maestro flow drafts. Some
screen-level testIDs already exist, but robust form entry and settings flows
need stable control-level testIDs before black-box E2E can avoid brittle text
matching.

## Scope

Add stable testIDs where needed for Android E2E:

- `dashboard-screen`
- `holdings-screen`
- `add-trade-screen`
- `add-trade-button`
- `asset-input`
- `quantity-input`
- `price-input`
- `conviction-1`
- `conviction-2`
- `conviction-3`
- `conviction-4`
- `conviction-5`
- `save-trade-button`
- `value-mask-toggle`

## Acceptance Criteria

- Maestro Add Trade flow can target controls by stable IDs.
- Value masking flow can target the toggle by stable ID.
- Existing component tests remain green.
- No behavior or visual design changes are introduced.

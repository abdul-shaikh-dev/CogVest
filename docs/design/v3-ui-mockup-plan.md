# V3 UI Mockup Plan

Figma: https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d

## Design Direction

V3 adds advanced surfaces while preserving the CogVest dark, local-first design language.

## Screens

### Historical Charts

Asset Detail chart card with range selector: `1W`, `1M`, `3M`, `1Y`, `ALL`. Include loading, error, stale-data, and empty states.

### Advanced Asset Search

Search input, recent assets, result rows with logo/name/symbol/exchange, source labels, and manual asset fallback.

### Import/Export

Local backup warning, export button, import picker, validation result state, and destructive-risk warnings.

### Advanced Dashboard Widgets

Configurable cards such as allocation trend, behaviour summary, quote freshness, and tax reminders.

### Advanced LTCG

Lot-level rows with buy date, quantity, eligibility date, days remaining, and FIFO sell impact.

## Interactions

- Advanced actions require explicit confirmation.
- Import validation errors must be readable and actionable.
- Chart failures should not block the rest of Asset Detail.

## Manual Figma Recreation Notes

Build from V1/V2 components. Use progressive disclosure for advanced data and avoid turning the app into a dense trading terminal.

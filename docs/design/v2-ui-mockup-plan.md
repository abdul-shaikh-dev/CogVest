# V2 UI Mockup Plan

Figma: https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d

## Design Direction

V2 introduces Minimal Mode and behaviour insights. Standard Mode remains information-dense. Minimal Mode reduces day-change prominence, top movers, aggressive red/green cues, and dashboard noise.

## Screens

### Minimal Dashboard

Show portfolio value, updated timestamp, allocation, Add Holding CTA, and optional LTCG banner. Hide daily P&L, top movers, and insight card by default.

### Minimal Holdings

Show asset name, quantity, current value, and basic LTCG state where relevant. Hide day change and reduce P&L colour emphasis.

### Behaviour Insights

Cards for conviction, patience, frequency. Tone must be observational. Avoid “you should” and “you must”.

### Insight Detail

Show metric summary, contributing trade count, explanation, and related trade rows.

### Basic LTCG States

Use green pill for eligible and amber pill for `LTCG in X days`. Only Indian stocks/ETFs show this.

### Onboarding Nudges

Small cards prompting conviction/intended hold input. Must not block trade entry.

## Interactions

- Mode switch applies immediately.
- Insight cards can be dismissed or opened.
- Minimal Mode never removes Add Holding, Holdings, Progress, or Cash access.

## Manual Figma Recreation Notes

Use V1 components and adjust density/colour. Increase card gap by 4px in Minimal Mode and reduce semantic colour opacity by 30%.

# CogVest Issue 86 Premium V1 Figma Screens

This folder contains a deterministic Figma development plugin that creates
editable V1 screen frames for issue #86 and the refined Issue #102 baseline.

## Why This Exists

Generated PNG mockups are useful for exploration, but they are unstable design
sources. This plugin recreates the approved premium private-ledger direction
as editable Figma layers: frames, borderless cards, text, vector icons, simple
shapes, and SVG chart groups.

## Refined Baseline

Issue #102 aligns the generated frames with the May 21, 2026 V1 mockup review:

- Dashboard keeps a quieter portfolio-first hierarchy and explicit P&L context.
- Holdings uses compact durable-position rows with quote-state notes and a
  header Add Holding entry point.
- Add Holding remains lookup-first and split into focused V1 phases.
- Monthly Progress keeps a monthly snapshot scope instead of implying shipped
  historical charting.
- Cash Ledger, Settings, and V1 States carry the local-first trust and empty
  state treatment needed for later implementation work.

## How To Run

1. Open the CogVest Figma file:
   `https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d`
2. In Figma desktop, go to `Plugins -> Development -> Import plugin from manifest...`.
3. Select `docs/design/figma/issue-69-v1-screens/manifest.json`.
4. Run `Plugins -> Development -> CogVest Issue 86 Premium V1 Screens`.
5. The plugin creates a fresh page named `Issue 86 - Premium V1 Screens`.

## Output

The plugin creates nine editable Android frames:

- Dashboard
- Holdings
- Add Holding - Asset Lookup
- Add Holding - Position
- Add Holding - Review
- Monthly Progress
- Cash Ledger
- Settings
- V1 States

## Notes

- The plugin creates a fresh versioned page on every run instead of removing
  existing nodes. This avoids Figma rerun failures and keeps revision history
  available for comparison.
- It does not modify the existing roadmap pages.
- Add Holding is split into focused states so the full lookup-first behavior is
  captured without making one crowded long-form screen.
- V1 States covers lookup loading, provider/manual fallback, empty portfolio,
  empty cash ledger, and no monthly snapshot references.
- Use these frames as the stable source for later Figma refinements.
- Keep `DESIGN.md` as the product design contract.

# CogVest Issue 86 Premium V1 Figma Screens

This folder contains a deterministic Figma development plugin that creates
editable V1 screen frames for issue #86.

## Why This Exists

Generated PNG mockups are useful for exploration, but they are unstable design
sources. This plugin recreates the approved premium private-ledger direction
as editable Figma layers: frames, borderless cards, text, vector icons, simple
shapes, and SVG chart groups.

## How To Run

1. Open the CogVest Figma file:
   `https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d`
2. In Figma desktop, go to `Plugins -> Development -> Import plugin from manifest...`.
3. Select `docs/design/figma/issue-69-v1-screens/manifest.json`.
4. Run `Plugins -> Development -> CogVest Issue 86 Premium V1 Screens`.
5. The plugin creates a fresh page named `Issue 86 - Premium V1 Screens`.

## Output

The plugin creates seven editable Android frames:

- Dashboard
- Holdings
- Add Holding
- Monthly Progress
- Cash
- Settings
- V1 States

## Notes

- The plugin creates a fresh versioned page on every run instead of removing
  existing nodes. This avoids Figma rerun failures and keeps revision history
  available for comparison.
- It does not modify the existing roadmap pages.
- Use these frames as the stable source for later Figma refinements.
- Keep `DESIGN.md` as the product design contract.

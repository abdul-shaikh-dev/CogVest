# CogVest Issue 69 V1 Figma Screens

This folder contains a deterministic Figma development plugin that creates
editable V1 screen frames for issue #69.

## Why This Exists

Generated PNG mockups are useful for exploration, but they are unstable design
sources. This plugin recreates the approved true-dark private ledger direction
as editable Figma layers: frames, borderless cards, text, vector icons, and
simple shapes.

## How To Run

1. Open the CogVest Figma file:
   `https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d`
2. In Figma desktop, go to `Plugins -> Development -> Import plugin from manifest...`.
3. Select `docs/design/figma/issue-69-v1-screens/manifest.json`.
4. Run `Plugins -> Development -> CogVest Issue 69 V1 Screens`.
5. The plugin creates or refreshes the page `Issue 69 - V1 UI Concepts`.

## Output

The plugin creates six editable Android frames:

- Dashboard
- Holdings
- Add Holding
- Cash
- Monthly Progression
- Settings

## Notes

- The plugin clears and recreates only the child layers inside the page named
  `Issue 69 - V1 UI Concepts`.
- It does not modify the existing roadmap pages.
- Use these frames as the stable source for later Figma refinements.
- Keep `DESIGN.md` as the product design contract.

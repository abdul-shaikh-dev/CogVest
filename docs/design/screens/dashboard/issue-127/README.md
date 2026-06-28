# Dashboard Preview - Issue #127

This is the accepted screen-specific Dashboard preview for issue #127.

Use this file as the implementation reference when reworking Dashboard
hierarchy, allocation, quote freshness, and dead actions:

- `index.html`

This preview supersedes the Dashboard section inside
`docs/design/v1-research-preview/index.html` for #127 implementation. The
all-screen research preview remains useful for app-wide visual context, but
screen-specific previews are fresher when a single screen has been refined in a
live design session.

Implementation rules captured by this preview:

- Portfolio value remains the first answer.
- Invested value, P&L, P&L %, and this-month movement stay near the top.
- Allocation is visual and compact.
- `Open Holdings` must be wired to Holdings.
- `Open Progress` must be wired to Progress.
- Quote freshness uses calm copy: `Quotes updated`.
- No vague `Open` or dead buttons.
- Use app design tokens where possible: 20px cards, restrained green, and
  Android/system typography.

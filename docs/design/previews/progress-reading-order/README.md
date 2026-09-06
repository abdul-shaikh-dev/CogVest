# Progress Reading Order Proposal

Issue: [#275](https://github.com/abdul-shaikh-dev/CogVest/issues/275).
Baseline: merged PR #274, commit `54a312a`.
Status: **user-approved design**, including dedicated month details and
newest-first history. Native implementation is tracked in
[#277](https://github.com/abdul-shaikh-dev/CogVest/issues/277); this HTML remains a
synthetic design reference, not a financial implementation.

## Run

From the repository root (Node only; no new packages or cloud service):

```powershell
node docs/design/previews/progress-reading-order/serve.mjs
```

Open <http://127.0.0.1:4178/>. Keep the terminal process running; Ctrl+C stops it.
The server binds only to loopback and serves an explicit allowlist of preview
files. It cannot expose app records or other repository files.

For a background preview on Windows, use `Start-Process -WindowStyle Hidden`
with stdout/stderr redirected to `.expo/`, then verify the URL with
`Invoke-WebRequest` before sharing it. Record the returned process ID and stop
only that owned process when the preview is no longer needed. Do not kill an
unknown process occupying the port.

## Approved Reading Order

1. A dated month-end portfolio value, market change and monthly investment.
2. One compact automatic/estimated snapshot status, with details on demand.
3. Portfolio Growth and Asset Momentum, each retaining its own stored-month
   range, inspected month, previous/next buttons and selected figures.
4. One Monthly History entry opening a year-based history overview rather than
   permanently expanding one comparison below both charts. Compact newest-first
   rows show month, month-end portfolio value and change from the prior calendar
   month. Tap a chevron row to open a dedicated month-detail view within the
   same panel. No inline expansion and no second stacked modal.

The latest navigation refinement replaces inline accordion expansion: month
details always open at the top with the selected month as the title and a Back
button. Back restores the same year, list scroll position and originating row
focus. Escape goes back from details before dismissing the overview; production
must give Android Back the same behavior. Close dismisses the entire panel.
The header stays reachable while scrolling long month details. No changes to
chart chronology, range controls or comparison calculations.

The 2026-09-06 refinement replaces the month-picker-first panel. The year selector
is derived from stored history, newest year first; partial years show only stored
months in descending order (December to January for a complete year). The section
and panel are titled Monthly History; the entry button is View history. Display
order does not change comparisons: December still compares with November. The
two charts retain oldest-to-newest progression. Partial years contain no future
or zero-filled rows. January compares with December of the
previous year when available. A missing immediately preceding month has no
month-over-month comparison, not a fabricated zero or comparison over a gap.
Percentages describe portfolio value change, including deposits and withdrawals,
not investment return. Existing flow-adjusted market change stays in expanded
details and requires a valid recorded performance basis in production.

Remove the duplicate latest-asset highlight and standalone asset-class breakdown
from the main scroll. Keep their underlying information in Monthly History.
Charts remain noninteractive plots so normal vertical scrolling cannot change
the inspected month. Custom ranges expose only valid ordered stored months.
Range chips wrap as whole controls; no mid-word Custom label.

## Retained Information

Monthly History supports every stored month, current/previous asset-class values,
class percentages and allocation, total portfolio change, invested capital,
monthly investment, net contribution, market change, salary and expenses, and
investment/expense rates. The preview's Investment rate corresponds to the
current snapshot selector's `savingsRate` (monthly investment divided by salary),
not a new calculation of unspent income. First-month comparisons have no prior
baseline. Value masking also covers the detail panel.

Each chart retains independent time range and selected-month state. The top
summary month and detail month are explicitly labeled, not silently synchronized
with either chart. Tabs are contextual artwork, not simulated app navigation.

## Implementation Boundary

The seven chart months and ten additional history-only months are deterministic
synthetic fixtures, not user data. The 2025 history demonstrates all twelve months
without changing the charts' existing dataset or layout. This is a
layout prototype, not a financial calculation implementation. Real integration
must use existing domain selectors, including recorded external-flow provenance
for market movement; never substitute monthly investment for net external flow.
Missing salary, expenses or performance basis must remain unavailable rather
than receiving these illustrative values. No production calculations change.

The HTML canvas demonstrates composition only. Production keeps
`react-native-gifted-charts`, native axis labels and existing range semantics.
Monthly History should use the app's accessible modal/route patterns with Android
Back, focus restoration and safe-area handling. Existing snapshot correction
remains separate; this proposal does not create a mandatory monthly save step.
Estimated, incomplete and failed automation states must keep actionable recovery
paths in production; the preview status dialog is explanatory only.

The automatic snapshot status and top summary remain visible when details are
closed. The approved native implementation in #277 updates the canonical screen
baseline without changing storage, migrations, providers, or dependencies.
Native custom ranges retain the existing inline form rather than copying the
HTML dialog; fields stack to remain usable with enlarged text.

## Verification

```powershell
node --check docs/design/previews/progress-reading-order/app.js
node --check docs/design/previews/progress-reading-order/serve.mjs
node docs/design/previews/progress-reading-order/verify.cjs
```

DOM tests use the existing transitive `jsdom` package without adding a dependency.
They cover independent chart state, filtered custom ranges, boundary focus,
older-month details, masking, empty/estimated states and finite canvas geometry.
They are not visual browser or Android tests.

2026-09-06 verification: preview DOM checks passed; HTTP 200 confirmed for HTML,
CSS, JavaScript and the local font. `npm run test:verify` passed: typecheck,
96 Jest suites / 964 tests, and Expo Doctor 17/17 checks.

Browser control was unavailable; the user approved the preview and explicitly
chose visual verification on the freshly installed Android APK instead. Inspect
the implementation at normal and 360dp widths with
normal/130% text, both charts, Monthly History, keyboard/dialog dismissal and each
preview state. The workbench reports the proposed scroll height but no measured
before/after improvement is claimed by this HTML. Native evidence belongs in
`docs/testing/progress-reading-order-evidence.md`.

Ionicons font is copied from the existing Expo vector-icons dependency; license
is retained in `ICON-LICENSE`. No external font requests are made.

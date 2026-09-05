# Progress Reading Order Proposal

Issue: [#275](https://github.com/abdul-shaikh-dev/CogVest/issues/275).
Baseline: merged PR #274, commit `54a312a`.
Status: **proposal awaiting user design approval**, not the production screen.

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

## Proposed Reading Order

1. A dated month-end portfolio value, market change and monthly investment.
2. One compact automatic/estimated snapshot status, with details on demand.
3. Portfolio Growth and Asset Momentum, each retaining its own stored-month
   range, inspected month, previous/next buttons and selected figures.
4. One Month details entry opening a year-based history overview rather than
   permanently expanding one comparison below both charts. Compact chronological
   rows show month, month-end portfolio value and change from the prior calendar
   month. Tap a row for its inline breakdown; only one month expands at a time.

The 2026-09-06 refinement replaces the month-picker-first panel. The year selector
is derived from stored history, newest year first; partial years show only stored
months, with no future/zero-filled rows. January compares with December of the
previous year when available. A missing immediately preceding month has no
month-over-month comparison, not a fabricated zero or comparison over a gap.
Percentages describe portfolio value change, including deposits and withdrawals,
not investment return. Existing flow-adjusted market change stays in expanded
details and requires a valid recorded performance basis in production.

Remove the duplicate latest-asset highlight and standalone asset-class breakdown
from the main scroll. Keep their underlying information in Month details.
Charts remain noninteractive plots so normal vertical scrolling cannot change
the inspected month. Custom ranges expose only valid ordered stored months.
Range chips wrap as whole controls; no mid-word Custom label.

## Retained Information

Month details supports every stored month, current/previous asset-class values,
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
Month details should use the app's accessible modal/route patterns with Android
Back, focus restoration and safe-area handling. Existing snapshot correction
remains separate; this proposal does not create a mandatory monthly save step.
Estimated, incomplete and failed automation states must keep actionable recovery
paths in production; the preview status dialog is explanatory only.

The automatic snapshot status and top summary remain visible even when details
are collapsed. No data storage, migrations, dependency or app-code edits belong
to this design-only change. Approval precedes implementation and canonical
screen-baseline replacement.

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

Browser visual QA is pending: this session exposed no available browser through
the computer-use tools. Before design approval, inspect at 360px and 412px with
normal/130% text, both charts, month details, keyboard/dialog dismissal and each
preview state. The workbench reports the proposed scroll height but no measured
before/after improvement is claimed yet. No APK was built or tested for this
HTML-only proposal.

Ionicons font is copied from the existing Expo vector-icons dependency; license
is retained in `ICON-LICENSE`. No external font requests are made.

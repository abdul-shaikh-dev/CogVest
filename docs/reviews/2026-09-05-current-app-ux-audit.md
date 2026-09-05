# Current Android UX Audit

Date: 2026-09-05. Source baseline: `d103abc` (merged PR #265).
Scope: Dashboard, Holdings, Add Holding, Progress/charts/history, Cash, Settings.
Status: audit and proposed remediation order, not an approved redesign or a claim
that the findings below have been fixed.

## Verdict

The app has a coherent dark foundation and useful financial information, but it
does not yet feel like one deliberately edited mobile experience. Features have
accumulated vertically. Administrative information competes with portfolio
answers, and several chart interactions undermine trust in the displayed month.

The next improvement should not be another palette, another chart library, or
more widgets. Fix interaction correctness first, establish a smaller hierarchy
of information, then refine the existing components against actual Android
screens. Preserve financial detail through clear disclosure, not deletion of
records or calculations.

## Evidence And Limits

- Captured the running Android app in this audit, not historical screenshots or
  HTML previews. Evidence below uses synthetic developer portfolio/lookup data.
- Pixel 10 Pro emulator, `emulator-5554`, 1280 x 2856 pixels, density 480
  (approximately 427dp wide), system font scale 1.0 and cold-start 1.3.
- Used the local development APK built/installed during the immediately prior
  audit, with current merged JavaScript served by Metro. No native/runtime
  source changes were made between that verified build and this audit.
- This is not a newly built standalone release APK or physical-phone performance
  certification. No EAS build was requested or triggered.
- Standard mode was captured. Current quotes can refresh while navigating;
  changing seeded current values across captures are not evidence of a financial
  calculation bug. Stored chart months remain the comparison fixture.
- Lookup uses the existing development-only deterministic provider adapter;
  the selection flow is real, but these screenshots do not validate Yahoo's
  live response quality. No private statement, CSV, or account data was used.
- The explicitly approved empty-state reset captured Dashboard, Holdings,
  Progress, and Cash, then restored the synthetic developer portfolio.
  Full import flows, populated PPF accounts,
  Minimal Mode, TalkBack, large portfolios, and multiple screen widths need
  separate coverage. Do not infer their quality from this audit.
- The emulator showed a floating handwriting/IME toolbar rather than a normal
  phone keyboard, even after temporarily enabling software-keyboard display.
  Ordinary docked-keyboard avoidance remains unverified. Original keyboard and
  font settings were restored.
- Hot-changing font scale initially produced clipped text. Cold restarting at
  1.3 corrected the severe clipping; it is not promoted to a confirmed
  cold-start defect. Cold-start examples below show extra wrapping/scrolling.
- A capture containing Metro's development refresh banner was rejected. The
  accepted review-actions screenshot below is unobstructed. The initial chart
  animation frame was also excluded from conclusions about missing line data.

## Journey Summary

| Step | Task and evidence | Health |
| --- | --- | --- |
| 1 | Understand portfolio value and freshness: 01 | Clear hero; ambiguous time basis and competing supporting cards. |
| 2 | Find and inspect a holding: 02, 03, 04 | Compact rows work; the holdings list starts too far down. |
| 3 | Inspect chart timeframes and months: 06, 09, 10, 11 | Range controls work; scroll/selection conflict and mixed month context are confirmed. |
| 4 | Compare stored snapshots: 12 | Useful date-specific comparison; repeats data already shown above. |
| 5 | Enter cash: 14, 15 | Deposit/withdraw affordances are clear; entry is buried below summary sections. No entry was saved. |
| 6 | Find preferences and privacy controls: 17, 18 | Readable and honest; over-explained and padded with unavailable functionality. |
| 7 | Choose an onboarding path and search: 19, 20, 21 | Multiple-entry path is prominent; search remains selection-first with manual fallback. |
| 8 | Confirm details, enter position, review, go back: 23, 24, 27, 28 | Too much secondary information; duplicate Equity choices and inconsistent Android Back behavior. |
| 9 | Read at 130% font size after restart: 29, 30, 31 | Main metrics reflow; charts and Holdings become longer. No cold-start amount truncation established. |
| 10 | Start without portfolio data: 32-35 | Setup actions exist; Holdings prioritizes PPF promotion, Cash repeats missing-data messages, and Progress repeats its empty explanation beside Review. |

## Confirmed Findings

Priority means user impact, not implementation order. P1 affects trust, task
completion, or accessibility of essential interaction. P2 causes material
friction or weakens comprehension. P3 is secondary polish.

### UX-01 / P1: Android Back Can Abandon An Unfinished Single Holding

From a filled single-holding review, Android Back returned to Dashboard rather
than the previous form phase, with no draft warning. The visible Back button
instead moves between phases. Route origin determines the destination; the
observed lookup fixture was entered from Dashboard.

The handler in `src/features/openingPositions/AddOpeningPositionForm.tsx:289`
is conditional on `quickSetup`. The ordinary route's `onCancel` calls
`router.back()` in `app/add-holding.tsx:26`. Phase buttons use `moveToPhase` in
`AddOpeningPositionForm.tsx:1163`. Screenshot 28 records the Dashboard destination
after system Back; screenshot 27 records the preceding filled review.

Remedy: agree one back contract for toolbar, system gesture/button, and footer.
Go to the previous phase while retaining inputs; exiting the workflow with a
dirty draft should preserve it or require explicit discard confirmation.

Acceptance: from every editable phase, test all Back entry points, unsaved
quantity/cost/notes, cancel-discard, and re-entry. No silent loss of a draft.

### UX-02 / P1: Page Scrolling Also Changes The Chart's Selected Month

A vertical swipe from 50%/75% to 50%/45% moved the Asset Momentum selection from
May to March. The user was trying to read further down the page, not inspect a
different month. Compare evidence 10 and 11.

`TrendChart` writes pointer indices into selected state at
`src/features/progress/ProgressScreen.tsx:515`. Its long-press/persistent pointer
configuration is at lines 582 and 628. The installed Gifted Charts 1.4.77
responder in `node_modules/react-native-gifted-charts/dist/LineChart/index.js`
claims move events when pointer configuration is present and declines responder
termination. A longer press delay alone does not establish directional handoff.

Remedy: distinguish deliberate inspection from vertical navigation. A visible
selected-month control with Previous/Next is the simplest reliable baseline.
Keep drag inspection only if a bounded library update/patch can prove
that vertical movement yields to the parent ScrollView. Do not switch libraries
before testing that boundary.

Acceptance: repeated vertical swipes starting inside either plot scroll normally
without changing selection. Deliberate inspection selects the intended stored
month; release/cancel behavior is predictable.

### UX-03 / P1: Adjacent Chart Summaries Describe Different Months

Evidence 11 shows March selected (Equity +4.02%, Crypto +2.61%) while the badge
and lower breakdown still describe May (Equity +4.89%, Crypto -0.83%). Their
values are not necessarily calculated incorrectly; their date context is
missing where the user needs it.

`SelectedMonthPanel` reads `selectedIndex` in `ProgressScreen.tsx:415`, while
`ProgressTrendCards` passes latest-in-range insight data at lines 1058-1098.
`src/domain/calculations/monthlyProgressCharts.ts:211` derives those insights
from the final filtered snapshot.

Remedy: use one selected-month context per chart, or clearly date an intentionally
separate latest-month summary. Prefer removing the duplicate badge/breakdown if
the selected-month panel already answers the same question.

Acceptance: inspect the first, middle, and last stored month and change range;
every visible amount/change states its month and comparison period. Selected
history must not appear to contradict an undated latest-month result.

### UX-04 / P1: Historical Chart Selection Lacks An Accessible Equivalent

There is no visible or semantic previous/next-month action for the chart.
`SelectedMonthPanel` is readable text, not an adjustable control. Custom range
pickers choose the range, not the inspected month. Snapshot History has its own
independent selection and does not change either chart.

Remedy: provide explicit month navigation, with selected date and amounts
announced together. The range buttons at `ProgressScreen.tsx:675` should also
expose their selected state and identify which chart they control.

Acceptance: a user can inspect every visible stored month without dragging the
plot. Verify the complete task with TalkBack, not only React Native testIDs.
This is a source-supported accessibility gap; TalkBack itself was not run.

### UX-05 / P2: Y-Axis Labels And Grid Lines Use Different Intervals

Evidence 06/11 labels zero, 10L, and 20L, but the plot grid divides the range into
thirds. The label positions are not proof of incorrect plotted values; the
incompatible guides make the chart harder to estimate accurately.

`getYAxisLabels` at `ProgressScreen.tsx:169` yields max/half/zero, while both
LineCharts use `noOfSections={3}` at lines 581 and 627.

Remedy: one shared tick model. Use two sections for those three labels, or four
labels matching three sections. Avoid independently hand-positioned guides.

Acceptance: each labelled tick shares a horizontal rule at the same value for
small, large, zero, and masked datasets, including 130% text and narrow screens.

### UX-06 / P2: Selection Markers Break Series Identity

The white Invested line ends in a green selection marker. All three asset lines
use grey selection markers. Evidence 06 and 11. This discards the series-color
mapping exactly where the user is inspecting a value.

The generic pointer colors are set at `ProgressScreen.tsx:586` and 632. Bind
per-series pointer colors to the existing palette and retain line styles/labels
as non-color identification. Keep selected markers smaller and subordinate to
the figures. This does not require a new chart library or new theme.

Acceptance: line, selected point, legend, and corresponding amount agree for
every series. Muting/emphasizing a series must preserve its identification.

### UX-07 / P2: Selected Green Controls Have Insufficient Text Contrast

The white text on bright green range/history chips and primary buttons uses
`#FFFFFF` on `#34C759`: calculated contrast is approximately 2.22:1. This is below
both 4.5:1 for normal text and 3:1 for large text. Evidence 06, 12, 19, 27.

`src/theme/index.ts` makes inverse text white and primary green bright.
Secondary text `#8E8E93` on elevated `#2C2C2E` is about 4.27:1, also below the
normal-text target. `DESIGN.md` specifies a different secondary token,
`#98989D`, which would yield about 4.85:1 on that surface.

Remedy: select a tested foreground/background pair for action states, and
reconcile the actual theme with DESIGN.md. Do not darken financial gain text
indiscriminately or confuse action styling with profit meaning.

Acceptance: calculate and verify rendered normal/pressed/selected text contrast;
do not count disabled-control exemptions as evidence that active controls pass.

### UX-08 / P2: Holdings Delays Its Main Job

On the 427dp-wide default screen, only one actual holding reaches the initial
viewport. Before it are freshness counts, Manage assets, an empty PPF promotion,
Dominant position, Asset mix, and filters. At 130% text, the first holding is
below the viewport. Evidence 02 and 31.

The compact holding row itself is useful: name, value, invested amount, signed
return, and allocation are scannable. Retain it. `HoldingsScreen.tsx:240-456`
shows the ordering; the zero-account PPF section is unconditional at line 311.

Remedy: put search/filter/list first with one compact, optional portfolio insight.
Move absent-account promotion into the Add flow; place management actions in a
secondary menu. Preserve access to real PPF accounts and all financial fields.

Acceptance: users with ordinary market holdings can see several holdings without
first scrolling past setup prompts. Test 4 and 30 holdings, with/without PPF and
pending prices, at default and enlarged text sizes.

### UX-09 / P2: Progress Repeats Analysis Instead Of Building A Reading Order

The screen stacks top metrics, automation status, two large chart containers,
their selected-month panels, an asset highlight, an asset breakdown, and Snapshot
History. Snapshot History repeats portfolio/invested/class amounts and changes
already present above. Evidence 06, 11, 12. Multiple independent month contexts
add cognitive work as well as height.

Remedy: retain two charts and their own timeframe controls, but give the screen
a clear sequence: current monthly answer, trends, historical detail. Fold
secondary historical detail behind a deliberately selected month; remove only
redundant presentation, not snapshot data or comparison metrics.

Acceptance: the user can identify the latest month, inspect an older month, and
explain its portfolio/class changes without reconciling undated duplicate panels.
Measure the number of viewport scrolls before/after rather than shrinking text.

### UX-10 / P2: Add Holding Exposes An Internal Taxonomy Ambiguously

Confirm details presents two buttons both labelled Equity. They are actually
`stock` and `etf` in `useAddOpeningPosition.ts:68`, rendered through the grouped
`assetClassLabel` in `AddOpeningPositionForm.tsx:675`. Evidence 23.

Remedy: distinguish Stocks and ETFs where the selection changes behavior, or use
one Equity category with a clearly separate instrument selector. Do not reuse a
portfolio-summary label for two distinct mutually exclusive choices.

Acceptance: visible and spoken option names are unique, and selecting each
produces the expected instrument options without misleading users.

### UX-11 / P2: Financial Entry And Review Overweight Optional/Technical Detail

The position screen gives optional conviction, holding days, and notes substantial
space before the continuation action. Review puts a full asset/identifier and
classification inventory before the investment result and Save. Symbol/ticker
and price-lookup symbol repeat. Unknown/None/Not set rows occupy full rows.
Evidence 23, 24, 27; rendering starts at `AddOpeningPositionForm.tsx:750` and 918.

Remedy: lead with asset identity, quantity, cost, valuation, and cash impact.
Disclose optional planning and technical provenance on demand; keep edits and
honest source status accessible. Review should confirm the transaction's meaning,
not require the user to audit an API record. Preserve selection-first search and
all validation/review-before-save safeguards.

Acceptance: ordinary entry needs only applicable required input; optional fields
remain reachable. At review, the financial result and primary action should be
easy to locate without traversing empty metadata. Verify docked-keyboard behavior.

### UX-12 / P2: Cash Entry Competes With A Dashboard Above It

Deposit opens inline below the balance, four monthly metrics, and another monthly
summary. Income and Investment rate each show multi-line Not enough data, making
missing information occupy more space than the available amounts. Evidence 14/15;
the form begins at `CashScreen.tsx:248`.

Remedy: retain the balance and meaningful ledger as the resting screen. Open a
focused deposit/withdraw sheet or dedicated entry view, or bring the inline form
into view deliberately. Keep amount, purpose, date, and save together. Explain
one missing-income dependency once instead of repeating it in metric slots.

Acceptance: tapping Deposit or Withdraw immediately reveals the appropriate
entry controls. User can enter/review/save/cancel with the normal phone keyboard
without searching below summary content. No silent change to linked cash semantics.

### UX-13 / P2: Dashboard Does Not Clearly Name Its Time Basis

The Dashboard subtitle says latest snapshot while its main values are derived
from current records and available quotes. Progress explicitly displays a stored
May snapshot. These can legitimately differ, but the copy makes them seem like
the same basis. `DashboardScreen.tsx:207`; evidence 01 versus 06.

The high-emphasis daily quote-change pill also competes with long-term invested
value and P&L, while detailed quote counters appear again in a large status card.

Remedy: explicitly distinguish current valuation from a dated month-end snapshot.
Place freshness near the value it qualifies and keep operational detail behind a
small disclosure. Do not conceal missing/stale values to make the screen prettier.

Acceptance: a user can explain why Dashboard and May Progress differ, identify
the quote basis, and find any blocking valuation problem without technical jargon.

### UX-14 / P2: Settings Looks Like A Status Report More Than Preferences

Several large cards are explanations rather than settings. Quotes mentions
cached assets, opening positions, and API failure. Clear local data occupies a
whole section while explicitly unavailable. Evidence 17/18.

Remedy: grouped actionable rows first; concise details behind disclosure. Hide
unimplemented actions from everyday settings or place clearly labelled scope
notes in About. Keep the privacy limitations honest and discoverable; do not
claim encryption, export, backup, or clearing features that do not exist.

Acceptance: preference controls look interactive, informational rows do not, and
unsupported actions do not compete with controls the user can actually use.

### UX-15 / P3: Repeated Surface And Type Treatments Flatten Hierarchy

Large rounded containers, bold section titles, multi-line helper copy, and nested
cards repeat across unrelated tasks. Every subsection asks for similar attention.
This is visible in Holdings, Settings, Add review, and Progress (02/17/27/06).

Remedy: preserve the OLED palette and existing icon family. Define a small number
of roles: one hero, quiet section labels, compact rows, and focused form fields.
Use alignment and disclosure before adding gradients, blur, borders, shadows, or
more card styles. This is a design recommendation, not a functional defect.

## What The Jank Probe Establishes

The bounded chart range/picker/scroll probe showed frequent missed frame budgets
in `adb shell dumpsys gfxinfo com.abdulshaikh.cogvest`. This was a dev build on an
emulator with Maestro capture overhead, not an isolated renderer benchmark.
The raw frame output was not retained, so no quantitative performance result is
claimed in this report. It does not attribute cost to Gifted Charts or predict
performance on the user's phone.

React Native explicitly recommends performance testing in release builds.
The confirmed gesture conflict and mixed date state can be fixed independently
of that benchmark. Before optimization, collect a release/profileable build trace
with the same dataset and comparable dashboard/list/chart interactions. Inspect
JS/UI thread work, list size, and chart update frequency; do not start by adding
memoization everywhere or rewriting the chart stack.

## Recommended Order

1. Interaction/trust: UX-01 through UX-06. Protect drafts, isolate scrolling from
   selection, unify date context, expose accessible selection, fix chart guides.
2. Shared readability: UX-07. Agree accessible tokens and verify actual Android
   text/controls before tuning screen aesthetics.
3. Chart-focused preview: UX-09 and chart polish from UX-06/15. Keep two charts,
   independent ranges, real stored data, and cash excluded from asset trends.
   Approve one focused preview before production redesign.
4. Holdings and onboarding: UX-08, UX-10, UX-11. Preserve compact rows and rapid
   entry; remove front-loaded administration and ambiguous choices.
5. Cash, Dashboard, Settings: UX-12 through UX-15. Align resting versus editing
   states and reduce repetition without losing financial concepts.
6. Release-mode performance, TalkBack, docked keyboard, multiple widths, long
   histories, and Minimal Mode regression evidence; retain the captured basic
   empty-state checks when changing hierarchy.

No existing open issue specifically tracks this complete UX remediation as of
this audit. #19 is the next insight-detail feature, not a substitute for these
fixes. #26 is broader V3 polish; important draft/gesture/clarity problems should
not be silently deferred to it. Split approved remediation into bounded,
verifiable issues rather than bundling the entire redesign into one implementation.

## Evidence Gallery

Original captures are unedited. Number gaps correspond to redundant, transient,
or environment-obstructed captures not used as accepted evidence.

### 1. Dashboard
![Dashboard](artifacts/2026-09-05-ux/01-dashboard.png)

### 2. Holdings: Entry, List, Detail
![Holdings entry](artifacts/2026-09-05-ux/02-holdings-top.png)
![Compact holdings](artifacts/2026-09-05-ux/03-holdings-list.png)
![Expanded holding](artifacts/2026-09-05-ux/04-holding-expanded.png)

### 3. Charts: Default, Picker, Before/After Vertical Swipe
![Portfolio chart](artifacts/2026-09-05-ux/06-portfolio-chart.png)
![Month picker](artifacts/2026-09-05-ux/09-chart-month-picker.png)
![Asset chart before swipe](artifacts/2026-09-05-ux/10-assets-top.png)
![Asset chart after vertical swipe](artifacts/2026-09-05-ux/11-assets-chart.png)

### 4. Snapshot History
![Snapshot comparison](artifacts/2026-09-05-ux/12-snapshot-history.png)

### 5. Cash
![Cash ledger](artifacts/2026-09-05-ux/14-cash.png)
![Inline deposit](artifacts/2026-09-05-ux/15-deposit-form.png)

### 6. Settings
![Settings](artifacts/2026-09-05-ux/17-settings.png)
![Settings below fold](artifacts/2026-09-05-ux/18-settings-lower.png)

### 7. Add Holding: Entry And Search
![Add chooser](artifacts/2026-09-05-ux/19-add-chooser.png)
![Initial asset step](artifacts/2026-09-05-ux/20-add-initial.png)
![Selection-first results](artifacts/2026-09-05-ux/21-add-search-results.png)

### 8. Add Holding: Details, Position, Review, System Back
![Confirm details](artifacts/2026-09-05-ux/23-add-details.png)
![Position fields](artifacts/2026-09-05-ux/24-add-position.png)
![Review and actions](artifacts/2026-09-05-ux/27-add-review-actions.png)
![System Back destination](artifacts/2026-09-05-ux/28-hardware-back.png)

### 9. Cold Start At 130% Text
![Progress with enlarged text](artifacts/2026-09-05-ux/29-progress-scaled.png)
![Asset summary with enlarged text](artifacts/2026-09-05-ux/30-assets-scaled.png)
![Holdings with enlarged text](artifacts/2026-09-05-ux/31-holdings-scaled.png)

### 10. Empty Portfolio
![Empty Dashboard](artifacts/2026-09-05-ux/32-empty-dashboard.png)
![Empty Holdings](artifacts/2026-09-05-ux/33-empty-holdings.png)
![Empty Progress](artifacts/2026-09-05-ux/34-empty-progress.png)
![Empty Cash](artifacts/2026-09-05-ux/35-empty-cash.png)

These extend UX-08/09/12/13 rather than adding four separate redesign tasks.
Prioritize portfolio setup over the zero-account PPF promotion; condense repeated
missing-data copy and explain the next meaningful action. Dashboard's empty
"latest snapshot" subtitle also implies a snapshot before one exists.

## Delivery Verification

- `npm run test:verify`: typecheck passed, 96 suites / 945 tests passed,
  Expo doctor 17/17 passed. These checks do not invalidate the observed UX gaps.
- Targeted Maestro capture journeys covered the steps listed above. The
  single-holding system-Back probe did not meet its previous-phase expectation;
  UX-01 records the observed result rather than treating that probe as passing.
- `npm run maestro:test -- .expo/ux-audit-empty.yaml`: all commands completed,
  including the explicit seeded-data restoration assertion. Temporary capture
  flows remain local under ignored `.expo`; accepted screenshots are versioned.
- Emulator settings restored: font scale `1.0`, software keyboard preference `0`.
- All 27 gallery image paths resolve; `git diff --check` passed.
- Independent read-only review corrected source references, narrowed the gesture
  remedy, and removed unretained quantitative performance claims.
- Documentation and unedited evidence only. No app behavior, financial logic,
  dependencies, or production E2E assertions changed.

## External Guidance Used

- Android recommends at least 48dp interactive targets and readable contrast:
  [Make apps more accessible](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views?hl=en)
  and [Testing for accessibility](https://developer.android.com/codelabs/basic-android-kotlin-compose-test-accessibility?hl=en).
  Chart range controls apply the shared minimum-touch-target style; their smaller
  base style alone is not evidence that the actual touch target is undersized.
- Chart information needs a meaningful non-visual equivalent:
  [W3C complex images guidance](https://www.w3.org/WAI/tutorials/images/complex/).
  Applied here as an accessibility principle, not a claim of web WCAG certification.
- Development-mode results cannot stand in for release performance:
  [React Native performance guidance](https://reactnative.dev/docs/performance.html).

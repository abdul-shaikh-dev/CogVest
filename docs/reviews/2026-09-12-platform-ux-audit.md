# CogVest: Android UX audit against platform design guidance

Date: 12 September 2026. Audited application commit: `8490134` (merged PR #347).
Status: findings and recommendations, not implemented fixes or release certification.

## Verdict

CogVest has a coherent visual foundation and useful, increasingly complete workflows,
but still makes the user do too much interpretation and navigation. The largest gap
is not the dark theme or choice of chart library. It is the distance between a user's
question and a clear answer or next action.

Keep the readable holdings rows, labelled bottom navigation, signed financial changes,
explicit save/review boundaries, and honest limits on historical data. Improve setup,
error recovery, information hierarchy, and chart interpretation before adding visual
effects or another design system.

This is a heuristic inspection by one reviewer, not a usability study with participants.
Severity expresses likely task impact, not measured abandonment or financial loss.

## Evidence and method

- Built and installed a fresh local **debug x86_64 APK**, using the documented local
  Android build tooling. Gradle: `BUILD SUCCESSFUL in 17s`, 557 actionable tasks.
- Emulator: `emulator-5554`, AVD `Pixel_10_Pro`, Android API 36, 1280x2856 physical
  pixels at 480 dpi, approximately 427dp wide, font scale 1.0.
- Additional configuration: 1080x2400 at 480 dpi (**360dp wide**), font scale **1.3**.
  Restored physical size and font scale 1.0 after inspection.
- Clean empty state first; then the developer's synthetic 60-month fixture, four
  market holdings and synthetic cash; then one synthetic PPF account created in UI.
- Used actual Android taps, scrolling, Back, field entry and UI hierarchy inspection.
  Some entry routes used application deep links. These are manual exploratory checks,
  **not a newly passing Maestro suite**.
- Initial reinstall ran out of emulator storage. Reinstalled after removing only the
  disposable synthetic CogVest installation. No phone data or private statements used.
- Accepted screenshots are copied unchanged into [the evidence directory](artifacts/2026-09-12-platform-ux/).
  Old installed-build, intermediate transition and uninspected captures are excluded.
- Synthetic current prices, historic snapshot values and live provider history are not
  a reconciled financial dataset. Their numerical differences are **not evidence of a
  calculation defect**. Adding PPF also changed the displayed history coverage mode.
- Metro/debug rendering and emulator behaviour cannot establish release smoothness,
  phone keyboard behaviour, or frame-time performance. Early blank transition captures
  were allowed to settle and recaptured, not reported as broken charts.

### Coverage and flow health

| Step | Examined state / action | Assessment |
| --- | --- | --- |
| 1. First launch | Empty Dashboard; Set up your portfolio | Needs clearer next action and priorities |
| 2. Setup/import | Add menu; source/history choices; CAS password keyboard | High-friction setup; keyboard passed in tested CAS configuration |
| 3. Add Holding | Live HDFC search; explicit result selection; selected summary; large text | Identity choice works; excess chrome and a small Change target |
| 4. Holdings | Populated list, detail, history, Sell/redeem and Back | Good scanning; correction discovery and return context need work |
| 5. Progress | Empty, populated 60-month charts, Custom picker, older history and detail | Rich information; interpretation and navigation costs are high |
| 6. Cash | Empty and populated ledger; deposit draft and return | Clear save boundary; terminology and optional form content need refinement |
| 7. PPF | Missing-provider validation, valid account review/save, resulting details | Save destination works; correction guidance and hierarchy need work |
| 8. Settings | Standard/Minimal, masking, storage/backup explanations | Honest controls; priorities and mask presentation need refinement |

Not exercised end-to-end: actual CSV/PDF importing, corporate-action resolution,
backup export/restore, destructive transaction correction, completed sale, PPF CSV
import or ledger transaction, all metadata/position validation branches, all filter
combinations, TalkBack, switch access, 200% text, landscape, foldables, offline/provider
failure injection, or release performance. Existing tests are not substituted for
fresh visual evidence of these paths.

## Reference lens

Android is the implementation standard; Apple HIG informs transferable principles,
not an instruction to imitate iOS navigation, Liquid Glass, or system controls.

- [Android mobile design](https://developer.android.com/design/ui/mobile) and
  [common layouts](https://developer.android.com/design/ui/mobile/guides/layout-and-content/common-layouts):
  use familiar structure and keep supporting content from crowding primary work.
- [Android accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility)
  and [touch target guidance](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views):
  accommodate larger text and at least 48x48dp interactive targets.
- [Android navigation principles](https://developer.android.com/guide/navigation/principles):
  Back should preserve an understandable reverse journey.
- [Apple HIG onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding):
  teach in context and help people reach useful work quickly.
- [Apple HIG entering data](https://developer.apple.com/design/human-interface-guidelines/entering-data?changes=_8)
  and [text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields?changes=_7):
  reduce avoidable input and help people correct mistakes at the appropriate point.
- [Apple HIG writing](https://developer.apple.com/design/human-interface-guidelines/writing?changes=l_1)
  and [feedback](https://developer.apple.com/design/human-interface-guidelines/feedback):
  familiar, consistent terms and actionable status matter as much as layout.
- [Apple HIG branding](https://developer.apple.com/design/human-interface-guidelines/branding):
  identity should support legibility and content, not compete with them.

Official sources were consulted during this audit. Some Apple pages expose limited
content through the browser reader; only retrieved guidance is relied upon. The chart
recommendations below are applied design judgement, not claims that HIG mandates a
particular scale, library, or chart style.

## Prioritized findings

P1 = high-priority task/trust friction. P2 = meaningful usability defect or repeated
effort. P3 = polish or discoverability improvement. No P0 or financial corruption was
established by this audit.

### UX-01 / P1: Setup starts with implementation choices, not the user's source

**Observed:** Set up your portfolio opens a menu with five competing methods. Add
multiple holdings is the green primary choice. Import then introduces CogVest CSV,
Zerodha, CAS, Add later activity and Rebuild from history before helping obtain a file.
The blank-portfolio flow still asks how existing history should be applied.

**Evidence:** [Setup menu](artifacts/2026-09-12-platform-ux/02-setup-options.png),
[import setup](artifacts/2026-09-12-platform-ux/03-import-source.png).
Implementation: `src/features/transactionImport/TransactionImportScreen.tsx`.

**Impact:** A new user must understand the app's storage model before reaching value.
This compounds the statement-download problem the owner reported.

**Recommendation:** Start with source/outcome: Zerodha, mutual fund statement, existing
spreadsheet, or enter holdings. Provide contextual download instructions and required
coverage before the picker. Ask history replacement questions only when relevant,
without silently relaxing reconciliation safeguards.

**Completion criteria:** From an empty portfolio, a novice can identify the right
source, obtain the right file and understand what will be imported without knowing
"opening position" or "broker-neutral." Preserve cancellation and explicit replacement
confirmation. Validate with first-time task walkthroughs, not only navigation tests.

**Tracking:** Already covered substantially by [#348](https://github.com/abdul-shaikh-dev/CogVest/issues/348).
Extend its acceptance criteria rather than create a duplicate.

### UX-02 / P1: Snapshot status does not explain the recoverable problem

**Observed:** Populated Progress displays stored month values and charts alongside
"Not enough portfolio data to generate a completed month snapshot yet." It does not
name the outstanding month or the missing input in the main status. Empty Progress
repeats the lack of snapshots without an Add/Import action.

**Evidence:** [Populated status](artifacts/2026-09-12-platform-ux/19-progress-top.png),
[empty Progress](artifacts/2026-09-12-platform-ux/09-empty-progress.png).
Copy fallback: `src/features/progress/useProgress.ts:276`.

**Impact:** Users cannot distinguish working historical charts, incomplete recent
coverage, and a failed automatic process. This is a status-design finding, not proof
that snapshot generation failed incorrectly on this fixture.

**Recommendation:** State last completed month, pending coverage and a specific next
action where one exists. Keep a compact scope warning for reconstructed history; put
the explanation behind Details. Do not hide a genuine uncertainty or demand review
when no user action can help.

**Completion criteria:** Empty, complete, incomplete-PPF, missing-price, and generating
states each answer "what is available, what is missing, and what can I do?" No generic
"yet" message should imply there is no history while stored history is visible.

### UX-03 / P2: PPF validation is detached from the field it refers to

**Observed:** Leave Bank or Post Office empty, enter a balance, tap Review account.
"Provider is required" appears at the bottom. The bank field is above the viewport;
there is no automatic return to it. The terminology changes from Bank to Provider.

**Evidence:** [Validation](artifacts/2026-09-12-platform-ux/31-ppf-validation.png).
`src/features/ppf/PpfAccountScreen.tsx:438` and `:544` show first-error/global rendering.

**Recommendation:** Attach the error to Bank or Post Office, focus/scroll to the first
invalid field, preserve all input, and use the same user-facing label. Make required
versus optional input evident before submission.

**Completion criteria:** On normal and 360dp/130% configurations, an invalid review
attempt reveals the invalid field and recovery instruction without manual searching.

### UX-04 / P2: Returning from a sale loses the holding detail context

**Observed:** Holdings > HDFC details > scroll to Sell/redeem > Android Back returns
to the holdings list, not the detail view just left. Records navigation also closes
the detail in source, although that return path was not executed in this run.

**Evidence:** [Detail actions](artifacts/2026-09-12-platform-ux/17-holding-actions.png),
[sale form](artifacts/2026-09-12-platform-ux/18-sell-form.png).
`src/features/holdings/HoldingsScreen.tsx:683` closes detail before routing to sale.

**Recommendation:** Preserve the selected holding and relevant scroll position across
child journeys. Keep deliberate close-to-list distinct from Back-to-detail.

**Completion criteria:** Cancel/Back from sale returns to the same holding detail;
Back again returns to the same list context. Separately verify records and corrections.

### UX-05 / P2: Quote freshness is far from the decision it qualifies

**Observed:** Holding detail has a prominent current value and current price, then a
history chart, then the current-price timestamp/source much farther down. Sale price
is prefilled from the holding price without a nearby as-of qualification in the form.
The synthetic old quote exposed this presentation risk; its mismatch with live history
is not itself a bug finding.

**Evidence:** [Detail hero](artifacts/2026-09-12-platform-ux/15-holding-detail.png),
[source below chart](artifacts/2026-09-12-platform-ux/17-holding-actions.png),
[sale form](artifacts/2026-09-12-platform-ux/18-sell-form.png).
Prefill: `src/features/sellRedeem/useSellRedeemHolding.ts:219`.

**Recommendation:** Put compact quote age/manual provenance beside the value and
explain that a sale needs the actual execution price. Do not label cached quotes as
execution prices or remove honest price limitations to make the screen look cleaner.

**Completion criteria:** Fresh, stale and manual quote states remain understandable
before entering/saving a disposal, without scrolling to provider metadata.

### UX-06 / P2: Secondary content delays the main work, especially with larger text

**Observed:** Holdings at 360dp/130% has title, subtitle, a separate actions row, tabs,
search, wrapped filters and insights before the list: only one complete holding is
initially visible. Holding detail places record/sale actions after chart and metadata.
PPF places ledger/import actions after several explanation cards. Dashboard prioritizes
allocation and snapshot explanation before lower monthly context.

**Evidence:** [Small Holdings](artifacts/2026-09-12-platform-ux/34-holdings-large-text.png),
[PPF](artifacts/2026-09-12-platform-ux/32-ppf-detail.png),
[Dashboard](artifacts/2026-09-12-platform-ux/13-populated-dashboard.png).

**Recommendation:** Reduce redundant headings/helper rows, progressively disclose
infrequent filters, and place primary account actions near their summary. Do not solve
this by shrinking touch targets, capping user text scale or hiding critical context.

**Completion criteria:** Record first meaningful content/action position at both tested
sizes; improve it without overlap or extra hidden gestures. Preserve searchable holdings,
clear active filters and access to insights. Agree screen-specific priorities in preview.

### UX-07 / P2: Chart controls compete with the chart's question

**Observed:** Progress has a summary month, independent per-chart selected months and
independent ranges. Custom expands a large inline form. The distinction between a
range and the selected observation is not immediately explained. Monthly History sits
below both long chart cards.

**Evidence:** [Progress](artifacts/2026-09-12-platform-ux/19-progress-top.png),
[Custom](artifacts/2026-09-12-platform-ux/25-custom-range.png),
[history entry](artifacts/2026-09-12-platform-ux/21-asset-chart-history-entry.png).

**Recommendation:** Keep the explicitly approved per-chart ranges; do not replace them
with a single distant control. Clarify range versus inspected month, compact Custom into
a focused panel, and make history directly reachable near the summary. Avoid accidental
synchronization that changes figures outside the user's intended chart.

**Completion criteria:** Users can identify the visible range, selected month, comparison
month and scope for each chart. Changing one chart's range does not unexpectedly change
another chart or the headline. History is reachable without scrolling through both plots.

### UX-08 / P2: Long-history charts have low visual signal

**Observed:** All-range monthly charts draw a dot at every one of 60 observations,
creating thick bead-like lines. Debt and crypto occupy a narrow band in the absolute
asset chart. Per-holding price history varies near the top of a zero-based plot, leaving
most plot area empty. Previous/Next uses an observation index such as 67/67.

**Evidence:** [Portfolio chart](artifacts/2026-09-12-platform-ux/20-value-chart.png),
[asset chart](artifacts/2026-09-12-platform-ux/21-asset-chart-history-entry.png),
[price chart](artifacts/2026-09-12-platform-ux/16-asset-chart.png).
Monthly point radius: `src/features/progress/ProgressScreen.tsx:607` and `:643`.

**Recommendation:** Use restrained lines, selected-point emphasis and density-aware
markers. For price history, evaluate a clearly labelled visible-range scale instead of
an uninformative zero baseline. Preserve truthful axes. Label the selected date rather
than expecting users to understand an index. Retain numeric alternatives to plots.

**Completion criteria:** Compare 3, 12, 60 and longer stored-month histories visually;
selection, axes and legend remain readable at both text sizes. Small asset series must
be inspectable without interpreting a flat-looking line as no change. No library migration
is required by this finding. Verify performance separately in release mode.

### UX-09 / P2: Month-range selection does not scale to years of history

**Observed:** The Custom From month picker is a long ascending list of individual
months starting June 2021. Getting to recent years requires traversing many rows. The
separate Monthly History view already has a year selector, so month selection differs
between related tasks.

**Evidence:** [Month picker](artifacts/2026-09-12-platform-ux/26-month-picker.png),
[history years](artifacts/2026-09-12-platform-ux/24-older-history.png).

**Recommendation:** Use a compact year/month choice with the selected date in view.
Keep only valid stored months and the existing start/end constraints; do not reintroduce
invalid-range errors by offering impossible choices.

**Completion criteria:** Select recent and old ranges across at least ten years without
scrolling a flat list of 120 months. Verify missing months, one-month ranges, cancellation
and start/end constraints with the approved chart behaviour.

### UX-10 / P2: Some interactive targets are smaller than the Android minimum

**Observed and source-confirmed:** Add Holding's selected-asset Change is a text-only
TouchableOpacity without padding/minimum size/hitSlop; measured native bounds were
125x48px, approximately 42x16dp. Chart previous-month buttons measured approximately
37x48dp; AppButton enforces minimum height but not width.

**Evidence:** [Selected asset](artifacts/2026-09-12-platform-ux/08-confirm-asset.png).
`src/features/openingPositions/AddOpeningPositionForm.tsx:513`,
`src/features/progress/ProgressScreen.tsx:550`,
`src/components/common/AppButton.tsx` base style.

**Recommendation:** Enforce at least 48x48dp effective targets, with appropriate
semantics and without overlapping neighbouring targets. This need not enlarge the icon.

**Completion criteria:** Check measured target bounds and edge taps for Change, chart
arrows and compact controls on both configurations. This is not a TalkBack certification.

### UX-11 / P2: Financial scope and comparison labels require too much inference

**Observed:** Dashboard allocation includes cash, while holdings allocation excludes
cash and PPF, qualified in a footer after the list. Asset Momentum is an absolute-value
chart; its percentage labels say "vs prior" without naming the prior month. Values use
compact K/L in some contexts and full INR elsewhere; the price chart also uses ISO dates.

**Evidence:** [Dashboard](artifacts/2026-09-12-platform-ux/13-populated-dashboard.png),
[Holdings](artifacts/2026-09-12-platform-ux/14-populated-holdings.png),
[asset chart](artifacts/2026-09-12-platform-ux/21-asset-chart-history-entry.png).

**Recommendation:** State scope near the group header, e.g. share of market holdings;
name the comparison month and distinguish value growth from investment return. Use a
documented context-based number/date format, with exact values available when needed.
Do not change denominators or financial formulas just to make labels consistent.

**Completion criteria:** Cash/PPF inclusion and prior stored month are understandable
without searching the screen. A user does not mistake contribution-driven growth for
return. Formatting differences are intentional, not arbitrary truncation.

### UX-12 / P2: Search results need stronger instrument disambiguation

**Observed:** HDFC returned actual NSE/BSE bank listings, an asset manager, ETFs and an
HDFC Bank rStock crypto result in one list. Exchange/class/provider text exists and the
user explicitly selects a result; there was no automatic asset selection.

**Evidence:** [Live results](artifacts/2026-09-12-platform-ux/07-search-result.png).

**Recommendation:** Make instrument type and exchange prominent, group clearly different
types, and make the active filter obvious near search. Avoid silently equating tokenized
exposure with company shares. Preserve explicit choice and manual fallback.

**Completion criteria:** A stock-search task reliably distinguishes NSE/BSE shares from
similarly named funds or crypto instruments; test this with users unfamiliar with tickers.

### UX-13 / P3: Form chrome and default explanations are visually louder than necessary

**Observed:** Add Holding repeats Asset in the stepper, section and search label; manual
fallback and recent-search controls occupy substantial space before results. PPF and
Cash give optional notes/disclaimers considerable space. Settings repeats the Minimal
description in a separate nudge before the backup area.

**Evidence:** [Add at large text](artifacts/2026-09-12-platform-ux/39-add-form-large-text.png),
[Cash form](artifacts/2026-09-12-platform-ux/27-deposit.png),
[Settings](artifacts/2026-09-12-platform-ux/11-settings.png).

**Recommendation:** Remove duplicated labels, make optional notes expandable, and show
help where a choice needs explanation. Preserve safety-critical disclosure. Consider a
smaller step indicator rather than four heavy disabled pills, without making progress
or navigation unclear. Do not assume the whole four-phase contract can be deleted.

**Completion criteria:** Preview with real-length names and larger text; the task and
primary action dominate instead of descriptions of the app's internal process.

### UX-14 / P3: Masking is visually noisy; Minimal does not address spatial density

**Observed:** At 360dp/130%, the masked Dashboard hero renders a large formatted string
of asterisks, separators and decimals. Minimal reduces emphasis but the main layout
remains tall. Percentages remain visible, as explicitly disclosed by Settings; that is
not treated as a privacy defect here.

**Evidence:** [Minimal + masked](artifacts/2026-09-12-platform-ux/38-minimal-masked.png).

**Recommendation:** Use a compact fixed mask token without punctuation that imitates a
value, and ensure the accessibility value is masked too. Clarify whether Minimal is a
visual-emphasis mode or a genuinely shorter reading experience before changing scope.

**Completion criteria:** Mask on/off remains understandable without layout overflow;
accessible labels do not expose masked amounts. Confirm the existing intentional
quantity/percentage/per-unit-price visibility contract separately.

## What is working and should survive refinement

- The holdings list gives name, value, invested amount and signed gain in a consistent
  row. Asset-class icons and the five labelled tabs are recognisable.
- The CAS password field stayed visible with the docked keyboard in the tested normal
  configuration. [Evidence](artifacts/2026-09-12-platform-ux/05-cas-keyboard.png).
  The numeric Cash input used an emulator floating/handwriting IME, so it does not prove
  docked numeric-keyboard avoidance on a phone.
- Valid PPF creation opened PPF details rather than restarting Add Holding.
- PPF does not invent lifetime gains from a starting balance; it explains the limitation.
- Monthly History supports old years and dedicated month details without accordion
  position jumps. Its change-versus-return disclaimer is valuable.
  [Evidence](artifacts/2026-09-12-platform-ux/23-month-detail.png).
- Larger text reflowed in the sampled screens without the obvious overlapping content
  of earlier prototypes. The remaining problem is excessive depth, not a blanket failure
  to support font scaling.
- Settings explains masking limitations, local storage, and backup/restore consequences;
  passive About rows do not pretend to offer unsupported controls.

## Suggested delivery order

1. **Task success and recovery:** UX-01 via #348, UX-02, UX-03. Keep import correctness
   safeguards; improve the explanation and route to resolution, not the tolerance.
2. **Navigation and interaction foundation:** UX-04 and UX-10, with Android Back and
   target-size regression tests. Include UX-05 wherever sale entry changes.
3. **Progress-focused design iteration:** UX-07 through UX-09 and chart-related UX-11.
   Agree a focused preview; validate on an installed APK with long histories.
4. **Compact hierarchy and language:** UX-06, UX-12 through UX-14, and remaining UX-11.
   One screen at a time; preserve the existing design rather than redesign everything.

The report does not create GitHub issues or authorize implementations automatically.
It can be split into the above bounded work packages after priority agreement.

## Verification of this audit deliverable

- Fresh Android build and install: completed; manual journeys above: completed within
  their stated boundaries. Full financial test suite and Maestro suite: not rerun for
  this report-only change. No release-mode performance claim.
- No production UX or financial behaviour changed. Removed the incidental iOS npm
  script that Expo prebuild added during the audit.
- Original display/font settings restored. Synthetic portfolio remains on the emulator.
- Evidence contains only synthetic application data and public asset-search results.
  Private attachments and user statements are not part of this deliverable.

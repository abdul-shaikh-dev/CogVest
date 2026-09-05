# First-Principles Codebase Audit

Date: 2026-09-05. Baseline: `6977f63` on `main`.
Task branch: `refactor/first-principles-audit`.

## Verdict

CogVest's core architecture fits its purpose: retain local records, derive
financial views, and make unavailable data explicit. A rewrite, a new state
framework, or more automation would add risk without solving a demonstrated
problem. The useful changes are localized correctness fixes and removal of
unused parallel implementations.

This is a risk-based codebase audit, not a claim that every line, provider
response, device configuration, or user journey has been exhaustively tested.
Two independent read-only reviews covered services/tooling and routes/UI;
the primary review covered financial calculations and store boundaries.

## Findings Addressed

| Priority | Finding | Resolution |
| --- | --- | --- |
| P1 | Quick Setup's safe aggregate update reset optional fields, silently losing notes, conviction, planned holding days, and the measured-date cutover. | Restore editable metadata when loading the existing opening and preserve its measured date in the update command. A component test changes quantity and verifies those fields survive saving. |
| P1 | Patience FIFO used binary floating-point subtraction; selling 0.1 then 0.2 from a 0.3-unit lot could falsely touch a second lot and report mixed outcomes. | Reuse financial decimal arithmetic and quantity precision; retain sale-event counts rather than unnecessary outcome-quantity totals. |
| P1 | Patience analysis loaded all openings before any transactions, allowing a later opening to consume an earlier sale. | Introduce openings on their effective history dates while preserving transaction order and opening cutovers. |
| P2 | Legacy zero, negative, or fractional holding periods could produce a behavioral conclusion. | Treat them as uncovered evidence without rewriting or rejecting legacy portfolios. |
| P2 | Value masking hid pending/unavailable messages, per-unit prices, and percentages, contrary to the Settings contract. | Correct Holdings, Cash, Quick Setup, Dashboard allocation, no-snapshot Progress, CSV review, and PPF estimate states; continue masking actual wealth amounts. |
| P1 | Dashboard's daily-change pill exposed an absolute wealth amount while masking was enabled. | Display only its percentage while masked, with standard/Minimal-mode regression tests and emulator assertions. |
| P2 | Dashboard called cached quote changes "today" even when their prices were stale. | Label them as changes at saved quotes rather than asserting a current-day observation. No price-history calculation was invented. |
| P2 | The advertised full Maestro suite omitted five checked-in flows. | Register them and test that every top-level flow occurs exactly once. Make the privacy flow start from a deterministic app state. |
| P2 | Several E2E assertions had drifted from the app: privacy disclosure, Add chooser, measured-date evidence, seeded chart end month, and September abbreviation. | Follow the actual UI, retain exact record checks, and assert that unstored months are unavailable rather than inventing fixture data. |
| P2 | PC verification documentation conflated package presence with current-build verification. | Explicitly require a fresh build/install and relevant journeys; the existing command remains an environment/code check, not proof of APK freshness. |
| P3 | An unused quote hook maintained a second, transient cache model. | Delete the hook, barrel export, isolated test, and stale matrix reference. Keep the actual persisted refresh service and screen tests. |
| P3 | Unused HoldingCard and PlaceholderScreen components duplicated or predated live UI. | Delete the components and exports. Preserve the live Holdings row and compatibility routes. |
| P3 | Skia, React Hook Form, and its resolver package had no production/configuration consumer. | Remove the direct dependencies and corresponding unused lockfile entries. Keep Gifted Charts and its actual native peers. |
| P3 | Cash showed a redundant mask-preview card despite already masking the balance and ledger. | Delete the extra card; retain the Settings preview and Cash masking test. |
| P3 | Current-source prose lagged approved V2 work and named import adapters. | Clarify version boundaries and constrained Zerodha/CAS support; preserve historical evidence rather than rewriting history. |

The first five patience regression cases failed against the original code and
passed after correction. Independent review added a reversed-history-date FIFO
case: effective openings must still be consumed by acquisition order.
No cost-basis algorithm, persistence schema, migration,
import acceptance policy, or security contract was changed.

## Complexity Deliberately Retained

- The store is large, but its atomic writes, recovery journal, validation,
  correction handling, and snapshot invalidation protect real financial data.
  Splitting it merely to reduce line count is not a correctness improvement.
- Import reconciliation, opening cutovers, stable transaction ordering, and
  duplicate detection prevent double counting. They are not redundant validation.
- Current/historical quote provenance, cancellation, timeouts, and manual
  fallback keep unavailable values from becoming invented prices.
- PPF has a dedicated confirmed-balance model; collapsing it into a generic
  quantity/price holding would lose useful semantics.
- The hidden add-trade route and buy/sell/correction screens still have live
  callers. They are not safe deletion candidates.
- The behavior engine and basic LTCG calculations are approved V2 foundations.
  Their missing UI is roadmap work (including #19), not evidence that the domain
  modules should be deleted or that the audit should implement those features.
- The existing test/build tools are retained. Clarifying their evidence boundary
  is cheaper and safer than adding another release automation layer.

## Remaining Constraints And Follow-Up

Before exposing behavior results under #19, keep the following limitations
explicit in its evidence contract:

- `plannedMatchedQuantity` and `uncoveredSaleQuantity` are diagnostic sums across
  potentially different asset units. They must not become portfolio-level unit
  totals or weighted behavior scores. Use sale counts or asset-scoped evidence.
- Frequency measures recorded activity since the earliest known history date;
  it cannot prove a user's complete trading history. An opening position does
  not establish that no unrecorded trades occurred.
- Current aggregate insight strings are not a substitute for the contributing
  record IDs and observation periods required by the detail-screen issue.

These are presentation/evidence constraints, not permission to invent missing
history or expand this audit into the next feature. No new UI consumer was added.

## Verification

- Focused regression run: 5 suites, 87 tests passed.
- `npm run test:v1:pc`: 96 suites, 943 tests; typecheck, Expo Doctor 17/17,
  Android tooling checks, and strict package-presence smoke passed.
- Final `npm run test:verify` after the screenshot-driven privacy fix:
  96 suites, 945 tests; typecheck and Expo Doctor 17/17 passed.
- Android doctor detected `emulator-5554` and Maestro.
- Initial sandbox APK build failed on Gradle network access, not app code; the
  authorized retry uses the documented local emulator build, not EAS.
- Local emulator APK build succeeded; the new debug APK installed successfully
  on `emulator-5554` (Pixel 10 Pro). This is development-build verification with
  current JavaScript served by Metro, not standalone release evidence.
  APK SHA-256: `AC6D159045E3AEBDF9EEC43F303D445009109EFBAFCEFD7B8F4AB3C2FF2A2F7A`.
- Smoke launch passed after fixing its missing bounded startup wait. The first
  attempt's screenshot showed Metro still bundling, not a production crash.
- Quick Setup initially exposed a stale detailed-record assertion missing the
  `measured` field. The corrected flow passed through persisted totals, exact
  quantity/cost/date/metadata evidence, PPF balance, pending manual valuation,
  and restart/resume without duplicate records.
- One subsequent run was interrupted by Metro observing an in-progress source
  edit. Final emulator runs used stable source, not an in-progress edit.
- Ten targeted checked-in Maestro flows passed after correcting stale tests:
  smoke-launch, holdings, cash, value-masking, add-holding-unknown-date,
  privacy-settings, progress-snapshot-history, quick-portfolio-setup,
  progress-chart-range, and workflow-exit-navigation.
- An additional synthetic-data visual run captured Dashboard (normal/masked),
  expanded masked Holdings, and masked Cash. Inspection confirmed visible
  allocation percentages and unit prices, masked wealth totals, readable
  unavailable states, and removal of the redundant Cash preview. It caught the
  daily-change leak; the corrected run asserts that no currency amount appears
  in the masked quote-change pill. Local screenshots are in `.expo/audit-*.png`.
- The full 28-flow E2E suite, standalone release APK, physical device, and live
  external-provider contract matrix were not verified in this audit. Passing
  targeted checks is not proof that those broader surfaces are defect-free.

Environment notes: npm removed eight unused packages but reported a locked
leftover Skia native build file in its temporary cleanup directory. That is not
a source dependency. Expo prebuild also emits the existing optional
`expo-system-ui` warning; no new dependency was added merely to silence it.

No EAS cloud build, Play submission, schema migration, or private portfolio
fixture publication is part of this audit.

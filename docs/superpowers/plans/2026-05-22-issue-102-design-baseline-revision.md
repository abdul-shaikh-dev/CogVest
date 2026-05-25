# Issue #102 Design Baseline Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revise CogVest's V1 design assets so the repo baseline reflects the refined May 21 HTML mockup direction while preserving the approved V1 Add Holding and state coverage.

**Architecture:** Keep the browser preview and Figma development plugin as the two stable design outputs. Use the preview to express richer mobile layouts and state examples, then align the Figma generator and its README with the same screen set and scope guardrails so later UI implementation has one design contract.

**Tech Stack:** Static HTML/CSS preview, Figma Plugin API JavaScript, Markdown design docs.

---

## File Map

- Modify `docs/design/issue-86-premium-preview/index.html` to adopt the refined
  dashboard, holdings, cash, settings, and state treatment while preserving the
  current Add Holding and V1 Progress scope.
- Modify `docs/design/issue-86-premium-preview/README.md` to describe the
  refined revision coverage and local preview verification.
- Modify `docs/design/figma/issue-69-v1-screens/code.js` to generate screens
  matching the refined repo preview instead of the older Issue #86 baseline.
- Modify `docs/design/figma/issue-69-v1-screens/README.md` to explain the new
  design baseline and exact Figma output coverage.
- Add/modify `docs/design/v1-screen-baseline.md` as the canonical accepted
  screen contract.
- Modify `DESIGN.md`, `AGENTS.md`, and `docs/design/v1-ui-mockup-plan.md` so
  future agents and UI issues point to the same baseline.

### Task 1: Reconcile Browser Preview Direction

**Files:**
- Modify: `docs/design/issue-86-premium-preview/index.html`
- Modify: `docs/design/issue-86-premium-preview/README.md`

- [ ] **Step 1: Read the approved Issue #102 spec and the current preview**

Run:

```powershell
Get-Content -Raw docs\superpowers\specs\2026-05-21-issue-102-design-baseline-revision.md
Get-Content -Raw docs\design\issue-86-premium-preview\README.md
rg -n "Dashboard|Holdings|Add Holding|Monthly Progress|Cash Ledger|Settings|state" docs\design\issue-86-premium-preview\index.html
```

Expected: the spec requires refined Holdings/Cash/Settings treatment while the
preview still exposes the older Issue #86 layouts.

- [ ] **Step 2: Update preview tokens and shared mobile shell treatment**

Edit the preview CSS so the design remains true-dark and CogVest-specific while
borrowing the refined mockup's hierarchy:

```css
:root {
  --bg: #000000;
  --surface: #141416;
  --surface-strong: #1c1c1e;
  --surface-soft: #202024;
  --separator: rgba(255, 255, 255, 0.1);
  --text: #f5f5f7;
  --secondary: #98989d;
  --muted: #636366;
  --positive: #34c759;
}
```

Keep comments and names aligned with the existing file patterns rather than
introducing a second token system.

- [ ] **Step 3: Update the refined screen layouts**

Use the approved spec to make these preview changes:

- Dashboard: portfolio-first hero, explicit P&L context, calm allocation and
  monthly summary, no over-promoted daily trading cue.
- Holdings: compact durable-position cards, filter counts, visible quantity,
  average cost, current price, P&L, allocation, quote freshness, stale/manual
  state, and header Add Holding action.
- Cash Ledger: focused entry controls and an empty-state treatment.
- Settings: local-first trust treatment plus grouped value masking, quotes,
  currency, and data controls.

Do not remove:

- Add Holding lookup, position, and review screens.
- quote lookup/manual fallback design states.
- no-snapshot state.

- [ ] **Step 4: Keep Progress inside V1 scope**

If the preview uses a graph-like treatment, pair it with copy that makes the
V1 constraint explicit:

```html
<p class="helper">
  Monthly snapshots populate this view over time. No saved history yet.
</p>
```

Expected: the preview may show long-term structure, but it must not present fake
historical charting as a shipped V1 feature.

- [ ] **Step 5: Update the preview README**

Document the refined revision and verification command:

```markdown
## Refined Baseline

This preview carries the Issue #102 visual revision:

- refined Dashboard, Holdings, Cash Ledger, and Settings hierarchy
- Add Holding remains lookup-first and multi-phase
- V1 states cover loading, stale/manual quote fallback, and no snapshots
```

- [ ] **Step 6: Verify the static preview files**

Run:

```powershell
git diff --check
rg -n "Add Holding|stale|manual|Monthly Progress|Cash Ledger|Local-first" docs\design\issue-86-premium-preview
```

Expected: no whitespace errors and required V1 coverage remains present.

### Task 2: Align The Figma Generator

**Files:**
- Modify: `docs/design/figma/issue-69-v1-screens/code.js`
- Modify: `docs/design/figma/issue-69-v1-screens/README.md`

- [ ] **Step 1: Map preview coverage to Figma output**

Run:

```powershell
rg -n "Dashboard|Holdings|Add Holding|Monthly Progress|Cash Ledger|Settings|V1 States" docs\design\figma\issue-69-v1-screens\code.js
rg -n "Dashboard|Holdings|Add Holding|Monthly Progress|Cash Ledger|Settings|state" docs\design\issue-86-premium-preview\index.html
```

Expected: both assets cover the same V1 screen family, but the Figma generator
still needs the refined layouts and state notes.

- [ ] **Step 2: Update shared Figma generator primitives and tokens**

Keep the deterministic page-generation model and update token/layout helpers to
match the refined repo preview. Preserve:

```js
const PAGE_NAME = "Issue 86 - Premium V1 Screens";
```

and keep generation append-only so reruns do not remove prior Figma revisions.

- [ ] **Step 3: Refine generated screens**

Update generated frames to reflect the approved revision:

- Dashboard uses stronger hero hierarchy and calmer support cards.
- Holdings rows expose durable-position context and quote-state notes.
- Holdings includes an Add Holding header action.
- Cash Ledger and Settings match the refined grouping language.
- Add Holding lookup, position, and review frames remain represented.
- V1 States includes loading, provider/manual fallback, empty portfolio or
  holdings, and no-snapshot coverage.

- [ ] **Step 4: Keep Progress guarded**

Update Figma copy/helpers so Monthly Progress remains a monthly snapshot view,
not a fake historical-chart implementation requirement.

- [ ] **Step 5: Update Figma README**

Describe the Issue #102 revision and exact screen coverage:

```markdown
- Dashboard
- Holdings
- Add Holding - Asset Lookup
- Add Holding - Position
- Add Holding - Review
- Monthly Progress
- Cash Ledger
- Settings
- V1 States
```

- [ ] **Step 6: Verify generator integrity**

Run:

```powershell
node --check docs\design\figma\issue-69-v1-screens\code.js
git diff --check
```

Expected: Figma generator JavaScript parses and docs diff has no whitespace
errors.

### Task 3: Document The Accepted Baseline

**Files:**
- Add: `docs/design/v1-screen-baseline.md`
- Modify: `DESIGN.md`
- Modify: `AGENTS.md`
- Modify: `docs/design/v1-ui-mockup-plan.md`
- Modify: `docs/superpowers/specs/2026-05-21-issue-102-design-baseline-revision.md`

- [ ] **Step 1: Record the accepted screen contract**

Capture:

- Dashboard portfolio-first hierarchy.
- Holdings durable-position cards and per-holding allocation.
- Add Holding explicit search selection before autofill.
- Monthly Progress two-graph direction: portfolio vs invested, and assets vs
  months excluding cash.
- Cash Ledger and Settings local-first treatment.
- Production data rule: stored local records or empty states, never fake chart
  history.

- [ ] **Step 2: Point future work at the baseline**

Update docs so future UI work reads:

- `docs/design/v1-screen-baseline.md`
- `docs/design/issue-86-premium-preview/index.html`
- `docs/design/figma/issue-69-v1-screens/code.js`
- `DESIGN.md`

Expected: older `v1-ui-mockup-plan.md` remains historical and no longer reads as
the active design contract.

- [ ] **Step 3: Update GitHub issue #102**

Use the accepted spec body as the issue body so GitHub points to the same
baseline as the repo.

### Task 4: Spec Review And Publish

**Files:**
- Review: `docs/superpowers/specs/2026-05-21-issue-102-design-baseline-revision.md`
- Review: `docs/design/issue-86-premium-preview/index.html`
- Review: `docs/design/figma/issue-69-v1-screens/code.js`
- Review: `docs/design/v1-screen-baseline.md`

- [ ] **Step 1: Review the diff against the spec**

Run:

```powershell
git diff --stat
git diff -- docs\design\issue-86-premium-preview docs\design\figma\issue-69-v1-screens
```

Check explicitly:

- Add Holding remains lookup-first and multi-phase.
- Progress stays within monthly-snapshot scope.
- Holdings has loading and stale/manual quote references.
- Dashboard, Cash, and Settings reflect the refined hierarchy.

- [ ] **Step 2: Run final verification**

Run:

```powershell
node --check docs\design\figma\issue-69-v1-screens\code.js
git diff --check
```

Expected: both commands exit `0`.

- [ ] **Step 3: Commit the design asset revision**

Run:

```powershell
git add docs\design\issue-86-premium-preview docs\design\figma\issue-69-v1-screens docs\design\v1-ui-mockup-plan.md docs\superpowers\plans\2026-05-22-issue-102-design-baseline-revision.md
git commit -m "docs(design): refine v1 baseline assets" -m "Closes #102"
```

- [ ] **Step 4: Push and update the PR**

Run:

```powershell
git push
```

Expected: PR for the Issue #102 branch includes the spec, plan, and revised
design assets with a closing reference for #102.

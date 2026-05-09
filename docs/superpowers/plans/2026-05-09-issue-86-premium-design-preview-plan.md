# Issue 86 Premium Design Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static browser preview for the premium CogVest V1 screens.

**Architecture:** A single static HTML document with embedded CSS and lightweight JavaScript tab switching. This keeps the preview independent from Expo app code while making the design easy to inspect in a browser.

**Tech Stack:** HTML, CSS, JavaScript, local static server.

---

### Task 1: Static Preview Artifact

**Files:**
- Create: `docs/design/issue-86-premium-preview/index.html`
- Create: `docs/design/issue-86-premium-preview/README.md`

- [x] Create a focused static mockup folder.
- [x] Implement Dashboard, Holdings, and Add Holding as phone frames.
- [x] Align the bottom Add button consistently across screens.
- [x] Add README instructions for local preview.

### Task 2: Local Preview Verification

**Files:**
- Read: `docs/design/issue-86-premium-preview/index.html`

- [x] Start a local static server from the preview folder.
- [x] Verify the server responds with the HTML page.
- [x] Share the local URL for browser review.

### Task 3: Taste Review Fixes

**Files:**
- Modify: `docs/design/issue-86-premium-preview/index.html`
- Modify: `docs/superpowers/specs/2026-05-09-issue-86-premium-design-preview.md`

- [x] Add explicit empty, loading/error, and manual fallback state coverage.
- [x] Replace static action-like spans/divs with semantic buttons.
- [x] Replace inconsistent text glyph icons with inline SVG primitives.
- [x] Add keyboard focus and tactile press states.
- [x] Change Add Holding CTA from absolute positioning to a sticky footer pattern.

### Task 4: Remaining V1 Screens

**Files:**
- Modify: `docs/design/issue-86-premium-preview/index.html`
- Modify: `docs/design/issue-86-premium-preview/README.md`
- Modify: `docs/superpowers/specs/2026-05-09-issue-86-premium-design-preview.md`

- [x] Add Monthly Progress screen with monthly metrics, change summary, trend placeholder, and asset snapshot.
- [x] Add Cash Ledger screen with cash balance, cash entry, and recent ledger rows.
- [x] Add Settings screen with privacy, value masking, quotes, currency, display, and destructive data sections.
- [x] Expand preview tabs from three screens to the full V1 preview set.

### Task 5: Design Review Fixes

**Files:**
- Modify: `docs/design/issue-86-premium-preview/index.html`
- Modify: `docs/design/issue-86-premium-preview/README.md`
- Modify: `docs/superpowers/specs/2026-05-09-issue-86-premium-design-preview.md`

- [x] Replace bottom Add tab with Progress across all phone nav bars.
- [x] Keep Add Holding as a secondary Holdings flow.
- [x] Expand Add Holding with position details, derived preview, and review handoff.
- [x] Convert Cash entry from static rows to form-like field blocks.
- [x] Replace Monthly Progress placeholder line with a simple mini-trend treatment.
- [x] Replace Settings finance/category icons with trust-oriented icons.
- [x] Add a phone-frame V1 States screen for empty, loading, error, and no-snapshot states.
- [x] Change Monthly Progress from a bar-style trend to two line graphs: total portfolio value vs invested value, and asset values vs months.
- [x] Remove duplicate external state cards now that V1 States exists as a phone frame.
- [x] Move Monthly Progress graphs above the "What changed" breakdown.
- [x] Add Settings group labels for privacy, quotes, currency, display, and data.

# CogVest Versioned Roadmap Design

## Approved Decisions

- V1 includes live quote fetching, manual fallback prices, and lightweight conviction capture.
- V1 excludes LTCG UI, Minimal Mode, historical charts, patience, frequency, and full behaviour insights.
- V2 adds Minimal Mode, basic LTCG, improved behaviour insights, patience, and frequency.
- V3 adds historical charts, advanced asset search, import/export, advanced FIFO LTCG, quote-cache hardening, and release polish.
- Figma generation should be attempted first; fallback design docs are still created for implementation reference.
- GitHub labels, milestones, and V1 issues should be created for real after docs are coherent.
- Work starts from current `main` on branch `roadmap/versioned-planning`.
- V1 release gates are split into dev-complete and release-candidate gates.

## Approach

The roadmap decomposes the existing all-in product plan into three shippable versions. V1 is intentionally narrow enough for a 2-3 week Android MVP while preserving CogVest's identity through live quotes, conviction input, value masking, and local-first portfolio tracking. V2 introduces the behaviour layer and Minimal Mode once core data flows are stable. V3 keeps advanced financial/product polish flexible until V1 and V2 usage validates the direction.

## External Outputs

Figma file: https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d

Figma Starter plan limits the file to three pages, so the real mockup file uses:
- CogVest Design System
- CogVest V1 MVP
- CogVest V2 and V3

## GitHub Structure

Labels:
- version: `v1`, `v2`, `v3`
- area: `frontend`, `domain`, `store`, `infra`, `testing`, `design`, `docs`, `release`
- type: `feature`, `bug`, `chore`, `refactor`
- priority: `priority-high`, `priority-medium`, `priority-low`

Milestones:
- CogVest V1 MVP
- CogVest V2 Behaviour
- CogVest V3 Advanced

V1 gets detailed execution issues. V2 and V3 get placeholder issues only.

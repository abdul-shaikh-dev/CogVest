# October design acceptance review

Reviewed 3 October 2026 against `1685a5a`, merged PR #524. Tracker #512 remains open.

## Result

The eight named implementation findings and the import-entry refinement are merged. That does not mean every verification requirement is satisfied. This document separates implementation evidence from native coverage gaps; it is not a release sign-off or a new all-screen visual test.

Historical reports remain unchanged. Their statements that later batches were pending were accurate when written. Use this index for the combined status.

## Findings and evidence

| Finding | Merged PRs | Acceptance evidence | Remaining qualification |
| --- | --- | --- | --- |
| F1: honest chart geometry | #514 | [Chart geometry](monthly-straight-lines-evidence.md): straight portfolio/asset segments, unchanged values, native Standard/Minimal captures; rising/falling/flat/sparse and gap behavior covered by tests. | Single-point and missing-month edge cases have component tests, not separate native fixtures in that batch. |
| F2: visible disclosures and secondary actions | #515, #521, #523 | [Disclosures](minimal-disclosures-evidence.md), [Add Holding](add-holding-search-hierarchy-evidence.md), [Futures](futures-wallet-hierarchy-evidence.md): chevrons, expanded state, labelled actions and retained asset identity. | No TalkBack claim. |
| F3: daily-screen control density | #516, #517 | [Daily screens](daily-screen-spacing-evidence.md), [Cash](cash-spacing-evidence.md): matched captures, full font scaling, 48dp header targets, filters/search/masking and unchanged data assertions. | Four-position fixture, not every long-name or extreme-value state. |
| F4: Progress hierarchy | #518 | [Progress](progress-hierarchy-review-evidence.md): grouped period/value/status, controls above plots, estimates, range/month/year and exact History values checked. | Empty/building/error variants have component coverage, not fresh native screenshots in that batch. |
| F5: Settings groups | #519 | [Settings](settings-tool-groups-evidence.md): Futures separated from backup, information consolidated, entry routes and safety copy preserved. | The original combined gate stopped at networking; the report records the successful separate retry checks. |
| F6: form/detail consistency | #520, #521, #522, #523 | [Holding detail](holding-detail-hierarchy-evidence.md), [Add Holding](add-holding-search-hierarchy-evidence.md), [PPF](ppf-setup-hierarchy-evidence.md), [Futures](futures-wallet-hierarchy-evidence.md): task-specific grouping, labels, identification, timezone/FX controls, keyboard and saved-data checks. | See each report for partial or adjusted native flows. Long-name Add Holding evidence does not establish extreme-value holding-detail coverage. |
| F7: Minimal context | #515 | [Disclosures](minimal-disclosures-evidence.md): optional metrics hidden initially, related copy removed only while absent, scope and warnings retained. | Both modes tested; not a separate navigation system. |
| F8: History bar meaning | #518 | [Progress](progress-hierarchy-review-evidence.md): scale label, unchanged bar ratios and Vs invested values, negative comparison and year switching. | Zero-only/hidden-bar cases have component coverage. |
| Import-entry constraints | #524 | [Import entry](import-entry-constraints-evidence.md): visible source-specific limits, safety/privacy notes, normal/large captures and synthetic saved-data assertions. | The passing data flow needed file-picker scrolling; the report does not claim an unmodified run. |

## Additional observations

| Observation | Disposition |
| --- | --- |
| Cash zero activity | Resolved by #517. Both metric names remain, rather than falsely implying no movement. |
| Cash debit color | Recommend retaining the existing signed amount, direction arrow and purpose label. The [published Cash example](../reviews/artifacts/2026-10-02-cash-spacing/after/normal/standard.png) labels the negative amount as Investment purchase and Linked investment, rather than investment loss. `CashEntryRow` also distinguishes withdrawals, deposits, sale proceeds and Futures transfers. Neutral debits may reduce the association with losses, but remove an existing direction cue. This review finds insufficient evidence to justify recoloring; it is not a comprehension study. This recommendation remains subject to tracker review. |
| Backup entry | Preserve its contained task and explicit unencrypted/provider-sync warnings. [Original screenshot](../reviews/artifacts/2026-10-02-design-review/08-backup.png) and the Settings route checks support this disposition. Blank space is not a defect here. No encryption or recovery guarantee is added. |
| PPF/Futures setup | Resolved through F6. Optional identification follows starting balance; exact timestamps remain available and historical FX evidence remains explicit. |
| Typography and character | Keep the existing theme, financial typography and meaningful weight/History graphics. The merged work adjusts hierarchy, spacing and control treatment, not fonts or branding. No further decorative redesign is proposed. |

The Cash and Backup images above were inspected again for this review. They are historical captures, not newly installed-build evidence.

## Closure checks

| Requirement | Status |
| --- | --- |
| Financial calculations, persistence, identity and currency preserved | Supported by scoped implementation diffs and the linked tests/data assertions. No schema or dependency change in these UX batches. |
| Relevant tests and PC checks | Recorded per batch. The latest implementation gate, #524, passed 2,011 tests, typecheck, Expo Doctor and Android checks. This review's own checks are listed below. |
| Fresh installed build before native claims | Each implementation report records a fresh local debug build/install with changed JavaScript served through Metro. None establishes a signed-preview result. |
| Matched modes/text-size evidence | Published for the changed layouts, with scroll-position and overlay limitations stated per report. |
| All relevant native edge states, long names and long numeric values | Incomplete. Component tests and selected native examples do not fulfill the full wording of this requirement. |
| Keyboard, validation and important data outcomes | Recorded for changed Add Holding, PPF, Futures and CAS password flows. Tests with local debug/file-picker adjustments are explicitly identified. |
| Interactions, masking and signed cues | Recorded per batch. Existing colors were reused; no new contrast-compliance claim. |
| Live font-scale transition | Unresolved separately from settled large-text layouts. Original debug clipping cleared after restart. No release-equivalent reproduction is established. |
| Published evidence and truthful limits | Reports linked above. No phone, TalkBack or performance sign-off. |
| Every observation resolved or agreed deferred | Awaiting remaining native coverage and review of the explicit dispositions above. Do not close the tracker yet. |

## Remaining execution

1. Review the bounded native edge-state passes against the earlier screen reports. [Holdings edge-state evidence](holdings-edge-states-evidence.md) covers long names, large exact values, missing prices, refresh failure, empty and masked Holdings/detail states. [Progress edge-state evidence](progress-edge-states-evidence.md) covers single-point/missing-month charts, zero-only History, empty/building/error states and retry, plus the reproduced status and clipped-amount fixes. Each report distinguishes full flows, focused recaptures and remaining limits. These passes are not a claim that every state in the app has been inspected.
2. Reproduce the live font-scale change on a fresh release-equivalent build, or obtain explicit agreement to defer it with its limitation recorded. Use the private-signing workflow in [Android release process](../release/android-release-process.md). Do not enable destructive QA routes in release or substitute the public debug key. No cloud build is authorized by this review.
3. Review the dispositions and remaining evidence against #512, then update its individual acceptance checkboxes. A merged implementation checklist alone is not closure evidence.

## Tracker closure correction

The issue event log records closure at 10:11:01 UTC on 3 October, immediately after #523 merged. That PR's negated closing sentence still populated GitHub's `closingIssuesReferences` with #512. This review reopened the issue, removed the phrase and confirmed an empty closing-reference list. The earlier statement that the issue remained open was incorrect.

Partial PRs must use neutral related-issue references. Check GitHub's parsed closing references before merge and the actual issue state afterward. The accompanying AGENTS.md change records this rule.

## Verification for this review

Documentation and delivery guidance only. No runtime source changed, and no new APK or native run is claimed. Historical screenshots and implementation reports were inspected, and current Cash row semantics were checked against source. The original review HTML and all historical captures remain unchanged.

`npm run test:verify` passed on this branch: typecheck, 189 suites and 2,011 tests, Expo Doctor 17/17. One suite and three tests remain skipped. All local evidence links resolve and `git diff --check` passes. Android checks were not rerun for this documentation-only change.

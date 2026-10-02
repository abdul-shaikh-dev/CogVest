# Progress hierarchy and History bar evidence

Tracker #512, F4 and F8. Baseline `a3b2e92`, after merged #517. Captured 3 October 2026.

## Changes and review

- Compact Progress heading and plain mask control match the daily screens. One stored month-end label replaces repeated introductory copy.
- Selected month, portfolio value, estimate label, supporting metrics and actionable status form one group. No warning state was removed.
- Chart month navigation now precedes the plot. Chart headings use the existing section heading role. Scope and range labels remain visible.
- History explains bar length once, including its selected-year scale. The label follows year switching and is absent whenever bars are absent. Portfolio values, bar ratios and Vs invested calculations are unchanged.

Normal-text screenshots show the month controls above the plot without cutting off the chart. At 130% text, controls are reached before the chart rather than below it; the chart still needs scrolling. Existing large-text header stacking remains intentional. No text scaling was disabled. History's scale label wraps without colliding with the year controls or numeric columns. Negative comparisons keep positive-length portfolio bars because these encode balances, not returns.

## Verification

- `npm run test:v1:pc`: passed. 189 suites and 1,996 tests passed, with one suite and three tests skipped by existing configuration. Typecheck, Expo Doctor 17/17, Android Doctor and strict smoke passed.
- Focused Progress and History tests: 94 passed. Regression assertions cover navigation before the plot, scope copy, scale labels on year changes, and absent labels for masked/signed/zero-only histories. Existing tests cover gaps, empty/building states, warnings, estimates, masking and financial comparisons.
- An initial test assertion compared renderer parent objects and exhausted the test process heap. Replaced it with a scalar assertion on rendered order; focused and full checks then passed without raising memory limits.
- Fresh local debug APK built with `npm run android:apk:emulator` and installed with `adb install -r`, using Metro. Not a signed cloud preview.
- Four matched before runs and four after runs passed using `e2e/visual/progress-hierarchy-review.yaml`. After runs exercise 3M/6M, previous/next month, History opening/closing and masking. The displayed September total remains INR 82.03L after returning from these interactions.
- `e2e/visual/progress-hierarchy-controls.yaml` passed: selected August shows INR 76.55L, September restores INR 82.03L, estimate details open, History switches scale labels between 2025 and 2026, and May detail shows INR 19,87,450.00 with -1.98% Vs invested. The first run used an incorrectly rounded expected amount; correcting the assertion to the fixture's exact stored value resolved it without app changes. [Status](../reviews/artifacts/2026-10-03-progress-hierarchy/controls/status.png) and [History detail](../reviews/artifacts/2026-10-03-progress-hierarchy/controls/history-detail.png) captures are included.

Environment: CogVest_UX_Proof, API 36, density 480, reduced motion enabled. Normal display 1280 x 2856 with font scale 1.0; large display 1080 x 2400 with font scale 1.3. Both Standard and Minimal tested. Existing synthetic audit data includes estimated months and negative Vs invested months. No real portfolio documents or user data were used.

## Matched captures

All paths below are relative to [the evidence directory](../reviews/artifacts/2026-10-03-progress-hierarchy).

| Configuration | Progress before / after | History before / after |
| --- | --- | --- |
| Normal Standard | [Before](../reviews/artifacts/2026-10-03-progress-hierarchy/before/normal/standard.png), [After](../reviews/artifacts/2026-10-03-progress-hierarchy/after/normal/standard.png) | [Before](../reviews/artifacts/2026-10-03-progress-hierarchy/before/normal/standard-history.png), [After](../reviews/artifacts/2026-10-03-progress-hierarchy/after/normal/standard-history.png) |
| Normal Minimal | [Before](../reviews/artifacts/2026-10-03-progress-hierarchy/before/normal/minimal.png), [After](../reviews/artifacts/2026-10-03-progress-hierarchy/after/normal/minimal.png) | [Before](../reviews/artifacts/2026-10-03-progress-hierarchy/before/normal/minimal-history.png), [After](../reviews/artifacts/2026-10-03-progress-hierarchy/after/normal/minimal-history.png) |
| Large Standard | [Before](../reviews/artifacts/2026-10-03-progress-hierarchy/before/large/standard.png), [After](../reviews/artifacts/2026-10-03-progress-hierarchy/after/large/standard.png) | [Before](../reviews/artifacts/2026-10-03-progress-hierarchy/before/large/standard-history.png), [After](../reviews/artifacts/2026-10-03-progress-hierarchy/after/large/standard-history.png) |
| Large Minimal | [Before](../reviews/artifacts/2026-10-03-progress-hierarchy/before/large/minimal.png), [After](../reviews/artifacts/2026-10-03-progress-hierarchy/after/large/minimal.png) | [Before](../reviews/artifacts/2026-10-03-progress-hierarchy/before/large/minimal-history.png), [After](../reviews/artifacts/2026-10-03-progress-hierarchy/after/large/minimal-history.png) |

## Limits

Some unedited captures include a development reduced-motion warning toast over navigation. Transient selection captures with incomplete rendering were rejected and are not published. Settled overview/history screenshots are the visual evidence, not proof of animation smoothness. No phone, release-preview, TalkBack, keyboard or performance claim is made. Error/empty variants are covered by component tests, not new native screenshots in this batch. No new color tokens were introduced.

The original `e2e/visual/progress-hierarchy.yaml` remains unchanged. These new review flows use the existing synthetic portfolio without resetting storage or submitting financial edits. F5/F6 Settings/forms and other tracker observations remain separate work.

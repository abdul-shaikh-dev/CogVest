# Import entry constraints verification

3 October 2026. Additional import-entry observation under #512, based on `020348c`, merged PR #523.

## Change

Shorten the source footer and group its always-visible limits with a small gap. CSV limits remain 500 rows and 1 MB per file. Tradebook guidance retains the 10-file maximum, Console's 365-day range and overlap check. CAS retains detailed-PDF selection, 250 pages and 10 MB. Unsupported events remain visible and are never guessed. On-device reading and the unsaved-password statement remain visible beside the password field.

No parser, importer, financial model, stored data, matching, file selection, source help or validation behavior changed. No new disclosure, dependency or schema. Existing text sizes and semantic colors are unchanged.

## Automated checks

- The two new Standard/Minimal tests failed before implementation and passed afterward. They check visible source-specific limits, retained safety notes, secure password entry and no transaction writes while switching sources.
- Focused import screen suite: 22 tests passed.
- `npm run test:v1:pc`: 189 suites and 2,011 tests passed; one suite and three tests skipped. Typecheck, Expo Doctor 17/17, Android Doctor and strict smoke passed.
- Fresh local x86_64 debug APK built and installed before after-captures, with this branch's JavaScript served by offline Metro. Not a signed preview APK.
- Native synthetic CSV import passed with a file-picker scrolling adjustment described below. Stored results matched three trades, three imported transactions, four unchanged Cash entries, three opening positions, and NIFTYBEES quantity 198, invested INR 48,351.60 and current INR 50,553.36.

## Visual evidence

CogVest_UX_Proof, API 36, density 480, reduced motion enabled. Normal display is 1280 x 2856, font scale 1.0. Large display is 1080 x 2400, font scale 1.3, cold-restarted after configuration changes. Both Standard and Minimal use the same import requirements.

`e2e/visual/import-entry-constraints.yaml` selects all three sources and captures the source/footer area and CAS password above the keyboard. It does not select documents. Password input is synthetic.

All four before and four after flows passed. Source switching, template-action visibility and password keyboard visibility were retained in both display modes and at both text sizes.

The two supplemental footer checks passed at normal and large text. The published directory contains 34 layout images and the synthetic import review screenshot. Inspection confirms that constraints wrap without clipping, remain available without expansion and preserve their meaning. CAS password input remains above the keyboard. Large text requires scrolling; the change does not try to force every source and constraint into one viewport.

| Configuration | Before | After |
| --- | --- | --- |
| Normal, both modes | [Images](../reviews/artifacts/2026-10-03-import-constraints/before/normal) | [Images](../reviews/artifacts/2026-10-03-import-constraints/after/normal) |
| Large, both modes | [Images](../reviews/artifacts/2026-10-03-import-constraints/before/large) | [Images](../reviews/artifacts/2026-10-03-import-constraints/after/large) |

Some source captures include the debug reduced-motion warning toast. In the large Tradebook capture, the footer extends below the viewport. `e2e/visual/import-constraints-detail.yaml` scrolls to the full safety note and dismisses that development toast if present to capture the actual constraints. The earlier upper-page capture alone does not prove footer readability.

The first large supplemental capture opened the deep link before cold-start navigation settled and remained on Dashboard. The flow now waits for Dashboard readiness and asserts the import screen before inspecting its footer. That failed attempt is not counted as a pass.

The unchanged CSV import flow initially stopped in Android's populated file picker before reading the fixture. A local copy replaces its immediate filename wait with `scrollUntilVisible`, direction DOWN, timeout 30000, for `transactions-import-v1.csv`. All import, review and saved-data assertions remained unchanged and passed. The original flow's existing debug-toast dismissal also ran. This is adjusted debug-flow evidence, not a claim that the original flow passed unmodified. No real financial files were read.

## Limits

The synthetic review portfolio was restored in Standard mode at normal resolution/font scale. The task's Metro session and adb port reverse were stopped.

No phone, signed-preview, TalkBack, performance or new contrast-compliance claim. This batch addresses the import-entry observation only. #512 remains open for final acceptance/evidence reconciliation and disposition of the other observations.

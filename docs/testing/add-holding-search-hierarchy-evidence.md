# Add Holding search hierarchy verification

Tracker #512, partial F6. Baseline `b6c362a`, merged #520. Captured 3 October 2026.

## Scope

The asset-search/manual-entry step now uses the same open section as the classification and position steps. The selected-asset summary remains contained; Change uses the shared button. Return to search uses the same secondary-action treatment as entry to manual details.

Symbol and Ticker stack below 360dp or at the existing large-font threshold. No identity field is hidden. Matching, validation, currency, quote resolution, saved values and draft handling are unchanged. Review/confirmation cards and the dedicated PPF notice remain contained. F6 still includes separate PPF and Futures work.

## Checks

- Focused form/discovery tests: 63 passed, including adaptive identifiers, persistent labels and values, selected-asset changes, asset matching, validation and review behavior.
- Full `npm run test:v1:pc`: passed. 189 suites and 2,003 tests passed; one suite and three tests remain skipped. Expo Doctor passed 17/17, followed by Android Doctor and strict smoke.
- Built a fresh local debug APK with `npm run android:apk:emulator`, installed with `adb install -r`, and served current branch JavaScript through offline Metro. This is not a signed preview APK.
- The capture flow passed in all four configurations: Standard and Minimal at normal and large text. Published 35 images: 16 before, 16 after, and three additional validation/keyboard checks.
- Large-text keyboard/validation flow passed. Required-field errors remain visible; Ticker and Quote source ID can be focused, typed into and seen above the keyboard. Android Back presents the unsaved-draft dialog, and explicit discard exits without saving.
- Back/draft/save assertions passed using a local copy of `e2e/add-holding-back.yaml` with only a debug-toast dismissal added. Quantity 2 and average cost INR 1,500 survived back navigation; saving produced one position, INR 3,000 invested and INR 3,356.50 current value. Explicit discard did not create a second record.
- Unmodified `e2e/add-holding-manual-semantics.yaml` passed. It verified one asset, no duplicate identity, INR/NSE identity, missing provider quote provenance, quantity 2, INR 2,400 invested, INR 2,600 current, unknown date, saved note and INR 1,300 manual price.

## Native environment

CogVest_UX_Proof, API 36, density 480, reduced motion enabled. Normal: 1280 x 2856, font scale 1.0. Large: 1080 x 2400, font scale 1.3. Captures use Standard and Minimal modes with the existing synthetic visual-QA portfolio and deterministic lookup entry point. Entry forms intentionally keep the same fields in both modes.

## Visual evidence

`e2e/visual/add-holding-search-hierarchy.yaml` captures search, manual entry, an active keyboard with a long synthetic name, and the selected-asset summary. Each configuration has four before and four after images in the linked directories. Filenames use `standard-` or `minimal-`, followed by `search`, `manual`, `keyboard` or `selected`.

| Size | Before images | After images |
| --- | --- | --- |
| Normal, both modes | [Before](../reviews/artifacts/2026-10-03-add-holding-search-hierarchy/before/normal) | [After](../reviews/artifacts/2026-10-03-add-holding-search-hierarchy/after/normal) |
| Large, both modes | [Before](../reviews/artifacts/2026-10-03-add-holding-search-hierarchy/before/large) | [After](../reviews/artifacts/2026-10-03-add-holding-search-hierarchy/after/large) |

Additional large-text evidence from `e2e/visual/add-holding-identifier-keyboard.yaml`: [validation](../reviews/artifacts/2026-10-03-add-holding-search-hierarchy/after/large/validation.png), [Ticker keyboard](../reviews/artifacts/2026-10-03-add-holding-search-hierarchy/after/large/ticker-keyboard.png), [Quote source ID keyboard](../reviews/artifacts/2026-10-03-add-holding-search-hierarchy/after/large/source-keyboard.png).

Visual review: the enclosing search surface is gone, labels remain persistent, and the large-text identifiers have enough width for the example ticker. The focused field and caret stay above the keyboard. Large text uses more vertical space intentionally rather than compressing identifiers or reducing font scaling. Long single-line text scrolls horizontally while editing, as before.

Recent searches can accumulate during the repeated captures, so their count is not a before/after layout measurement. Some unedited images contain the debug reduced-motion warning toast.

Native save tests reset only the emulator's synthetic portfolio. They do not use the user's financial records. After testing, the visual-QA portfolio was reseeded, Standard mode restored, and the emulator left at 1280 x 2856 with font scale 1.0 and animator duration scale 0. Functional save runs used animator duration scale 1; visual captures used reduced motion.

## Corrections and limits

The first baseline script expected a provider HDFC listing despite an existing saved match. It was corrected to select the saved asset. The first lower-field keyboard run passed its input assertions but could not tap the scrolled-off page header; the complete rerun uses Android Back and passed. New unit-test dimension setup and a TypeScript literal type were corrected before the passing full gate. These failed attempts are not counted as passing runs.

The unmodified back/save flow stopped at Keep editing because a React Native debug warning overlay intercepted the tap. Changing animator duration scale to 1 did not remove that overlay. The passing local copy added this conditional block immediately after its first Keep editing tap, leaving all data assertions unchanged. Coordinates apply only to this recorded 1280 x 2856 emulator. The overlay has no accessible close label.

```yaml
- runFlow:
    when:
      visible: "Open debugger to view warnings."
    commands:
      - tapOn:
          point: "93%,92%"
      - tapOn:
          id: holding-keep-editing
```

One Maestro launch failed before execution due to log-directory access, and the first local dismissal used unsupported fractional coordinates. Both were corrected for the passing run; neither is an app failure or a passing test.

No physical-phone, TalkBack, performance or signed-preview verification is claimed. Provider outages and PPF handoff retain component coverage, not new native captures in this batch. No real documents, identifiers or portfolio data are used in these artifacts.

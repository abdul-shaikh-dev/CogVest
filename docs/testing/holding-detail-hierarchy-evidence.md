# Holding detail hierarchy verification

Tracker #512, partial F6. Baseline `f32fe7d`, merged #519. Captured 3 October 2026.

## Change

Holding detail uses an open value group instead of a large containing card. Position labels and fields are grouped more tightly. Your position and History use the shared section heading, and History no longer adds a second top gap below the actions. Text sizes, touch targets, financial calculations, identity, quote provenance, masking and action order are unchanged.

This is not completion of F6. Add Holding, PPF and Futures forms remain separate work. Backup warnings and confirmation panels are untouched.

## Verification

- Focused HoldingsScreen and AssetHistoryPanel suites: 65 tests passed. Coverage includes labelled P&L metrics, position/history headings in both modes, record preservation, pending valuation, masking, action routes, empty/loading/offline history and chart data.
- `npm run test:v1:pc` passed, including typecheck, full Jest suite, Expo Doctor, Android Doctor and strict smoke.
- Built with `npm run android:apk:emulator` and installed the new debug APK with `adb install -r`. Current branch JavaScript was served by offline Metro. This is not a signed cloud preview.
- Maestro checks the synthetic HDFC holding's 25 units, INR 1,450 average cost and INR 36,250 invested value. It checks both separate P&L fields, masks/unmasks invested value, expands/collapses the existing opening record, scrolls to History and returns to Holdings. No financial records are submitted or edited.
- All four after-change configurations passed. Visual inspection found no overlapping labels or controls in the reviewed captures. Normal text now shows History's mode and range controls in the initial viewport; large text shows the records action sooner. Quote status and separate P&L labels remain readable. Twenty before/after/masked images are published below.
- The emulator was restored to normal display size, font scale 1.0, unmasked values and Standard mode.

## Environment and evidence

CogVest_UX_Proof, API 36, density 480, reduced motion enabled. Normal: 1280 x 2856, font scale 1.0. Large: 1080 x 2400, font scale 1.3. Standard and Minimal modes use the same holding-detail hierarchy intentionally; details retain the metrics omitted from Minimal's list.

The flow is `e2e/visual/holding-detail-hierarchy.yaml`, parameterized by PHASE, SIZE and MODE. Position captures start at the top; History captures use the same target but may have different scroll offsets after controls verification. Do not interpret those offsets as a measured height reduction.

| Configuration | Position before / after | History before / after | Masked after |
| --- | --- | --- | --- |
| Normal Standard | [Before](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/before/normal/standard-position.png), [After](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/normal/standard-position.png) | [Before](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/before/normal/standard-history.png), [After](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/normal/standard-history.png) | [Masked](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/normal/standard-masked.png) |
| Normal Minimal | [Before](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/before/normal/minimal-position.png), [After](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/normal/minimal-position.png) | [Before](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/before/normal/minimal-history.png), [After](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/normal/minimal-history.png) | [Masked](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/normal/minimal-masked.png) |
| Large Standard | [Before](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/before/large/standard-position.png), [After](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/large/standard-position.png) | [Before](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/before/large/standard-history.png), [After](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/large/standard-history.png) | [Masked](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/large/standard-masked.png) |
| Large Minimal | [Before](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/before/large/minimal-position.png), [After](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/large/minimal-position.png) | [Before](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/before/large/minimal-history.png), [After](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/large/minimal-history.png) | [Masked](../reviews/artifacts/2026-10-03-holding-detail-hierarchy/after/large/minimal-masked.png) |

## Limits

An initial navigation attempt and a cold-start deep link after changing font scale failed before any app edits; the latter settled on Dashboard instead of Settings. Relaunching or waiting for the debug bundle, then repeating the flow recovered the baselines. These attempts are not passing evidence or a diagnosed production defect. Some unedited baseline images include a developer warning toast.

Pending/empty/offline variants have component coverage, not fresh native screenshots in this batch. Long asset names and extreme financial values were not separately captured. No physical-phone, TalkBack, performance or release-preview verification is claimed. No form changed, so keyboard and draft-protection testing belongs to the remaining F6 form batches.

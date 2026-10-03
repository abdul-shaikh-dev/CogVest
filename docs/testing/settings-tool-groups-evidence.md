# Settings groups verification

Tracker #512, F5. Baseline `d6b658a`, merged #518. Captured 3 October 2026.

## Scope

Futures now sits under Investment tools, before Portfolio backup. App information remains the single heading for privacy/storage, price information, currency and version; the redundant About heading is removed. Routes, backup warnings, disclosure content, preferences and financial records are unchanged. No shared component or styling changes.

## Checks

- Focused Settings tests: 13 passed, including Standard/Minimal grouping, unchanged backup privacy copy, action routing, disclosures, masking and persisted display preference.
- Typecheck and full Jest suite passed: 189 suites, 1,998 tests. Existing skips: one suite, three tests.
- `test:v1:pc` stopped at Expo Doctor because sandbox networking blocked Expo metadata checks. Retried `npm run doctor` with network access: 17/17 passed. Android Doctor and strict smoke then passed separately. The original combined command did not finish successfully.
- Built a fresh local debug APK with `npm run android:apk:emulator` and installed it with `adb install -r`. Metro served the current branch, not a signed cloud-preview bundle.
- All four before/after capture configurations passed. The separate controls flow passed Futures, backup and restore entry checks plus privacy and price disclosure expansion/collapse, without submitting financial changes.
- Visual inspection found readable section boundaries and wrapping at both text sizes: Investment tools precedes Portfolio backup, and currency/version remain under App information without the extra About heading. No task-caused overlap was found. The emulator was returned to normal size, font scale 1.0 and Standard mode.

## Native environment

CogVest_UX_Proof, API 36, density 480, reduced motion enabled. Normal: 1280 x 2856, font scale 1.0. Large: 1080 x 2400, font scale 1.3. Existing synthetic audit portfolio; no backup was created, no restore confirmed and no Futures wallet submitted.

The initial large-text baseline attempts hit a stalled debug reload, then a cold bundle compilation timeout. Restarting Metro with `EXPO_OFFLINE=1`, waiting for bundling and repeating the captures recovered the session. These failed attempts are not passing evidence or a claimed production-app defect.

## Evidence

Matched captures use `e2e/visual/settings-tool-groups.yaml` for both modes and sizes. The tools section and lower information section are captured separately, not stitched. Before/after scroll positions follow the same target elements; moving Futures necessarily changes their absolute offset.

| Configuration | Tools before / after | Information before / after |
| --- | --- | --- |
| Normal Standard | [Before](../reviews/artifacts/2026-10-03-settings-tool-groups/before/normal/standard-tools.png), [After](../reviews/artifacts/2026-10-03-settings-tool-groups/after/normal/standard-tools.png) | [Before](../reviews/artifacts/2026-10-03-settings-tool-groups/before/normal/standard-information.png), [After](../reviews/artifacts/2026-10-03-settings-tool-groups/after/normal/standard-information.png) |
| Normal Minimal | [Before](../reviews/artifacts/2026-10-03-settings-tool-groups/before/normal/minimal-tools.png), [After](../reviews/artifacts/2026-10-03-settings-tool-groups/after/normal/minimal-tools.png) | [Before](../reviews/artifacts/2026-10-03-settings-tool-groups/before/normal/minimal-information.png), [After](../reviews/artifacts/2026-10-03-settings-tool-groups/after/normal/minimal-information.png) |
| Large Standard | [Before](../reviews/artifacts/2026-10-03-settings-tool-groups/before/large/standard-tools.png), [After](../reviews/artifacts/2026-10-03-settings-tool-groups/after/large/standard-tools.png) | [Before](../reviews/artifacts/2026-10-03-settings-tool-groups/before/large/standard-information.png), [After](../reviews/artifacts/2026-10-03-settings-tool-groups/after/large/standard-information.png) |
| Large Minimal | [Before](../reviews/artifacts/2026-10-03-settings-tool-groups/before/large/minimal-tools.png), [After](../reviews/artifacts/2026-10-03-settings-tool-groups/after/large/minimal-tools.png) | [Before](../reviews/artifacts/2026-10-03-settings-tool-groups/before/large/minimal-information.png), [After](../reviews/artifacts/2026-10-03-settings-tool-groups/after/large/minimal-information.png) |

## Limits

Some unedited screenshots contain the development reduced-motion warning toast. No release-preview, physical-phone, TalkBack, keyboard, performance, backup-write or restore-write verification is claimed. This batch changes grouping only; form design remains F6. Backup entry design and its safety warnings are intentionally preserved.

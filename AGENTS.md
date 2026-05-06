# CogVest — Agent Instructions

## Project
CogVest is an Android-first, local-first React Native portfolio tracker. The
near-term MVP is replacing the user's Excel investment tracker before expanding
into behaviour insights and Minimal Mode.

## Current Roadmap
- Build in phases from docs/roadmap/cogvest-version-roadmap.md.
- Current execution focus: V1 MVP plus Excel tracker parity from issue #60.
- V1 goal: local-first Android tracker with live current quotes, Add Holding,
  derived holdings, dashboard, cash tracking, value masking, and lightweight
  conviction capture/state.
- V2 adds Minimal Mode, basic LTCG, patience/frequency analysis, behaviour
  insight cards, and insight detail.
- V3 adds historical charts, advanced asset search, import/export, advanced
  FIFO LTCG, quote-cache hardening, and polish.

## V1 Scope Boundaries
- Include live quote fetching for current prices on app open and pull-to-refresh.
- Include manual current-price fallback when quote APIs fail.
- Include optional conviction input and basic "not enough data" conviction state.
- Do not add Minimal Mode in V1.
- Do not add LTCG UI or tax badges in V1.
- Do not add historical charts in V1.
- Do not add patience analysis, trade-frequency analysis, or full behaviour
  engine in V1.
- Do not add import/export, backend, auth, cloud sync, analytics, or push
  notifications in V1.
- Before V2/V3 work, finish Excel tracker parity issues #60-#66 unless the user
  explicitly changes priority.

## Stack
- React Native + Expo SDK 54
- TypeScript only. No JavaScript.
- Expo Router (file-based navigation)
- MMKV for persistence
- Zustand for state management
- React Native Reanimated for animations
- Victory Native for charts
- React Hook Form + Zod for forms

## Rules
- Functional components with hooks only. No class components.
- Persist raw data, derive everything else.
- All amounts in INR (Indian Rupees ₹).
- Behaviour fields (conviction, intended hold) are always optional.
- Minimal Mode is a display preference — never removes core functionality.
- No backend. No auth. No cloud. Local device storage only.
- All domain calculations must be pure functions in src/domain/.
- No business logic in components.
- For V1 implementation, work from GitHub issues #1-#16 in order unless the
  user explicitly changes priority.
- V2/V3 GitHub issues are placeholders and should not be expanded until V1 is
  validated.
- User-facing V1 language should prefer Dashboard, Holdings, Add Holding,
  Progress, Cash, and Settings. Keep "trade" wording internal unless an
  existing domain API requires it.

## Design
- Follow root `DESIGN.md` for every UI task unless an issue explicitly
  overrides it.
- CogVest should feel calm, premium, disciplined, local-first, Android-native,
  low-noise, fintech, and long-term investing focused.
- Use Material 3 as the usability foundation, but avoid generic Material
  templates and trading-app/crypto-exchange energy.
- Green is an accent, not decoration. Financial values must be readable,
  maskable, and INR-first.
- Current V1 Figma source is
  `docs/design/figma/issue-69-v1-screens/code.js`: main tabs are Dashboard,
  Holdings, Progress, Cash, Settings; Add Holding is a secondary screen.
- Use docs/design/v1-ui-mockup-plan.md and the Figma file for V1 UI context.

## Release Gates
- V1 dev-complete requires `npm run test:v1:pc`, Android Emulator app launch,
  local APK build/install on emulator, and passing or logged defects for the
  PC-based V1 core-flow matrix.
- V1 release-candidate additionally requires production AAB build success, EAS
  build URL recorded, and Play Console internal testing upload ready/manual.
- Do not auto-submit to Google Play in V1.

## Android PC Test Harness
- Prefer PC-only Android verification with Android Emulator and `adb`; do not
  assume a physical phone is required.
- Use `npm run test:verify` for static checks, Jest, and Expo doctor.
- Use `npm run test:v1:pc` for the V1 PC verification gate. It extends
  `test:verify` with Android doctor and strict installed-app smoke checks.
- Use `npm run android:doctor` to check Node, npm, adb, emulator visibility,
  Expo CLI, package scripts, and optional Maestro.
- Use `npm run android:smoke` for emulator/package smoke checks; use
  `npm run android:smoke -- --strict` only when CogVest should already be
  installed.
- Use `npm run start:clear`, then press `a`, for the normal Expo emulator loop.
- Use `npm run android` for local native dev build/install on the emulator.
- Do not trigger EAS cloud builds unless the user explicitly asks.
- Do not put emulator, APK, or Maestro checks in default GitHub PR CI unless
  explicitly requested.
- Use `npm run maestro:check` and `npm run maestro:test` for optional local
  Maestro E2E verification when Maestro is installed.
- For installed APK checks, remember APK is locally installable with `adb`;
  AAB is for Play Store distribution and is not directly installable locally.
- If Codex adb access fails in the sandbox, retry adb/harness commands with
  elevated sandbox permission before concluding the emulator is unavailable.
- PC harness docs live in `docs/testing/android-pc-test-harness.md`,
  `docs/testing/android-emulator-checklist.md`, and
  `docs/testing/apk-smoke-test-checklist.md`.
- V1 core-flow coverage lives in `docs/testing/v1-core-flow-test-matrix.md`
  and `docs/testing/v1-pc-verification-checklist.md`.

## References
- Design system: DESIGN.md
- Full spec: docs/cogvest-master-spec.md
- Version roadmap: docs/roadmap/cogvest-version-roadmap.md
- V1 spec: docs/roadmap/v1-mvp-spec.md
- V1 prompts: docs/roadmap/v1-codex-prompts.md
- V1 issue drafts: docs/issues/v1-issue-drafts.md
- V1 testing plan: docs/testing/v1-testing-plan.md
- V1 PC verification matrix: docs/testing/v1-core-flow-test-matrix.md
- Android release process: docs/release/android-release-process.md
- Mockups: docs/cogvest_standard_mode.png, docs/cogvest_minimal_mode.png
- Figma roadmap mockups: https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d

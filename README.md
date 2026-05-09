# CogVest

CogVest is an Android-first React Native portfolio tracker for Indian retail
investors. V1 is local-first and focused on portfolio tracking, live current
quotes, Add Holding entry, derived holdings, cash tracking, value masking, and
lightweight conviction capture.

The app is built with Expo Router, TypeScript, Zustand, MMKV, React Hook Form,
Zod, Reanimated, and Victory Native. There is no backend, auth, cloud sync,
analytics, or push notification dependency in V1.

## Current Phase

Current execution focus: V1 MVP.

V1 includes:

- Android-first app shell with Expo Router tabs.
- Local data persistence.
- Add Holding flow.
- Derived holdings and dashboard.
- Cash tracking.
- Value masking.
- Live current quote fetching with manual fallback.
- Lightweight optional conviction state.

Out of V1 scope:

- Minimal Mode.
- LTCG UI or tax badges.
- Historical charts.
- Full behaviour engine.
- Import/export.
- Backend, auth, cloud sync, analytics, or push notifications.

See `AGENTS.md` and `docs/roadmap/v1-mvp-spec.md` before changing scope.

## Required Tools

- Node.js and npm.
- Git.
- Android Studio.
- Android SDK and Platform Tools.
- Android Emulator, preferably Pixel 8.
- `adb` on `PATH`.
- Java 17 or newer. Android Studio JBR Java 21 is the recommended default.
- Optional: Maestro CLI for local Android E2E tests.
- Optional: Expo account and EAS CLI only for release-candidate build work.

Recommended Windows environment values:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
```

Add these folders to `PATH`:

```text
%JAVA_HOME%\bin
%ANDROID_HOME%\platform-tools
%USERPROFILE%\.maestro\bin
```

## Setup

Install dependencies:

```powershell
npm install
```

Check the project:

```powershell
npm run test:verify
```

This runs TypeScript, Jest, and Expo doctor.

## Common Commands

```powershell
npm run typecheck       # TypeScript only
npm test                # Jest / React Native Testing Library
npm run doctor          # Expo doctor
npm run test:verify     # typecheck + tests + doctor
npm run start:clear     # start Metro with a clean cache
npm run android         # local native Android build/install
npm run android:doctor  # PC Android tooling readiness check
npm run android:smoke   # emulator/package smoke check
npm run test:v1:pc      # V1 PC verification gate
npm run maestro:check   # optional Maestro readiness check
npm run maestro:test    # optional full Maestro E2E suite
```

Default GitHub PR CI runs the lightweight checks only. Emulator, APK, and
Maestro checks are local PC verification steps unless explicitly requested.

## Local Android Development

Start an emulator in Android Studio, then verify:

```powershell
adb devices
```

Expected output includes:

```text
emulator-5554    device
```

For normal development, start Metro:

```powershell
npm run start:clear
```

Then press:

```text
a
```

Expo opens CogVest on the Android Emulator.

Use a local native build when native project output or a fresh installed dev
build is needed:

```powershell
npm run android
```

Do not use EAS cloud builds for quick local developer testing unless explicitly
asked. The local Android build is the default PC-only path.

## Local APK Testing

APK files are installable on the emulator:

```powershell
adb install -r path/to/app.apk
```

Uninstall CogVest:

```powershell
adb uninstall com.abdulshaikh.cogvest
```

APK versus AAB:

- APK is for local install and emulator smoke testing.
- AAB is for Play Store distribution and is not directly installable locally.

V1 dev-complete requires local APK build/install verification. Production AAB
success is a release-candidate gate, not a normal development gate.

## Maestro E2E

Maestro is optional local Android E2E tooling. It drives the emulator like a
user and validates black-box flows.

Check readiness:

```powershell
npm run maestro:check
```

Run the full suite:

```powershell
npm run maestro:test
```

Run one flow:

```powershell
npm run maestro:test -- e2e/smoke-launch.yaml
```

The full local suite covers:

- App cold launch.
- Add Holding.
- Holdings from trade entry.
- Cash entry.
- Value masking through Settings.
- Persistence across close/reopen.

Maestro flows can clear app state and create test data. Keep them out of
default PR CI unless requested.

See `docs/testing/maestro-e2e.md` for install and troubleshooting details.

## V1 Verification Gates

Development-complete gate:

```powershell
npm run test:v1:pc
```

Also verify:

- Android Emulator app launch.
- Local APK build/install on emulator.
- Core manual flows pass or defects are logged.
- PC-based V1 core-flow matrix is complete.

Release-candidate gate:

- Production AAB builds successfully.
- EAS build URL is recorded.
- Play Console internal testing upload is ready/manual.

Do not auto-submit to Google Play in V1.

## Repository Map

```text
app/                 Expo Router routes and navigation
src/components/      Shared UI components
src/domain/          Pure domain calculations, validators, formatters
src/features/        Feature screens, hooks, and feature tests
src/services/        Storage and quote services
src/store/           Zustand store and selectors
src/theme/           Colors, spacing, typography, theme tests
scripts/             Local verification helpers
e2e/                 Optional Maestro Android E2E flows
docs/                Specs, roadmap, release, testing, and design docs
```

Domain rules:

- Persist raw data.
- Derive portfolio state from raw data.
- Keep business logic out of components.
- Put pure calculations in `src/domain/`.
- Use INR for all amounts.
- Behaviour fields are optional.

## Documentation Index

- Agent instructions: `AGENTS.md`
- Full product spec: `docs/cogvest-master-spec.md`
- Version roadmap: `docs/roadmap/cogvest-version-roadmap.md`
- V1 MVP spec: `docs/roadmap/v1-mvp-spec.md`
- V1 testing plan: `docs/testing/v1-testing-plan.md`
- V1 PC verification matrix: `docs/testing/v1-core-flow-test-matrix.md`
- Android PC harness: `docs/testing/android-pc-test-harness.md`
- Maestro E2E: `docs/testing/maestro-e2e.md`
- Android release process: `docs/release/android-release-process.md`
- V1 release checklist: `docs/release/v1-release-checklist.md`
- V1 UI mockup plan: `docs/design/v1-ui-mockup-plan.md`

## Codex Workflow

For repo changes:

- Sync `main` after merged PRs.
- Create a feature branch before edits.
- Keep PRs focused.
- Include `Closes #<issue>` in PR bodies when an issue should auto-close.
- Do not commit directly on `main`.
- Do not trigger EAS cloud builds unless explicitly asked.
- Prefer PC-only Android verification with emulator, `adb`, Expo CLI, Jest,
  React Native Testing Library, and optional Maestro.

Before claiming a change is ready, run the relevant verification commands and
report exact results.

# Seeded Android Visual QA

## Purpose

This development-only harness replaces local emulator data with a deterministic
V1 portfolio and captures screenshots for comparison with `DESIGN.md` and
`docs/design/v1-screen-baseline.md`. It does not require EAS or a physical phone.

## Safety Contract

- The seed and E2E fixture routes work only when `__DEV__` is true and the local
  token is present.
- Release builds cannot enable the routes through an environment variable or a
  known token.
- Opening the seed deep link never changes data by itself.
- The developer must explicitly choose `Replace with visual QA data` before the
  store is reset.
- The route is not linked from production UI and must not run in default PR CI.

## Prerequisites

1. Start an Android emulator and confirm it with `adb devices`.
2. Build and install the current development APK with
   `npm run android:apk:emulator` and `adb install -r`.
3. Start Metro with `npm run start:clear`.
4. Configure `adb reverse tcp:8081 tcp:8081` when needed.

## Capture The Standard Screen Set

```powershell
npm run visual-qa:android
```

The script opens the token-gated route, waits for the destructive confirmation,
accepts it explicitly, and captures screenshots under:

```text
docs/testing/artifacts/visual-qa/latest
```

Expected files:

- `dashboard.png`
- `holdings.png`
- `add-holding-initial.png`
- `add-holding-lookup.png`
- `add-holding-review.png`
- `cash.png`
- `progress.png`
- `progress-assets-chart.png`
- `settings.png`

## Focused Maestro Evidence

```powershell
npm run maestro:test -- e2e/progress-chart-range.yaml
npm run maestro:test -- e2e/progress-snapshot-history.yaml
npm run maestro:test -- e2e/workflow-exit-navigation.yaml
```

Each seed-dependent flow must assert the native `Replace local developer data?`
dialog and tap `Replace with visual QA data` before expecting seeded data.

## Manual Development Flow

Open the gated route:

```powershell
adb -s emulator-5554 shell am start -W `
  -a android.intent.action.VIEW `
  -d "cogvest:///visual-qa-seed?token=cogvest-local-visual-qa"
```

Review the warning in the emulator. Choose `Cancel` to preserve data or
`Replace with visual QA data` to continue. A missing/wrong token or any release
build shows `Visual QA seeding is unavailable.`

## Seeded Dataset

The fixture includes equity, ETF, debt, crypto, cash entries, mixed quote
provenance, an optional conviction score, and seven monthly snapshots. It is
test data only and must never be interpreted as a production portfolio.

For opt-in long-history regression, append `&history=long` to the development
seed link. This prepends 53 synthetic months, producing 60 consecutive snapshots
from June 2021 through May 2026 without changing the standard seven-month tail.
The same development/token/confirmation restrictions apply. The default fixture
and default Maestro suite remain unchanged.

Standalone release verification must prepare data in a development APK first,
then upgrade with a release signed by the same private QA key. Never enable seed
routes in release or clear state in a seed-dependent standalone flow. Real
month-end automation can add later months when the release opens; inspect those
months rather than assuming May 2026 remains latest.

See [standalone chart verification](standalone-chart-verification.md) for the
local signing boundary, opt-in flows, observed defects, and performance limits.

## Troubleshooting

- `Unable to load script`: start Metro and configure `adb reverse`.
- Package missing: install the freshly built development APK.
- Confirmation not found: verify the installed APK is current.
- Seed unavailable: verify this is a development build and the exact token is
  present in the deep link.
- Signature mismatch: do not uninstall if upgrade/data-retention evidence is
  required; rebuild with the same signing key instead.

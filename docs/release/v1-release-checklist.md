# V1 Release Checklist

## Dev-Complete Gate

- [ ] `npm install` succeeds.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npx expo doctor` passes.
- [ ] App starts with `npx expo start`.
- [ ] Add Trade works manually.
- [ ] Holdings update after trade.
- [ ] Dashboard total updates after holdings/cash changes.
- [ ] Cash entry updates cash total.
- [ ] Value masking works.
- [ ] App data persists after restart.
- [ ] Preview APK builds successfully.
- [ ] Preview APK installs on real Android device.
- [ ] No backend/auth/cloud was added.
- [ ] Secrets are not committed.

## Release-Candidate Gate

- [ ] Production AAB builds successfully.
- [ ] EAS production build URL recorded.
- [ ] Play Console internal testing upload ready/manual.
- [ ] Store listing draft reviewed.
- [ ] Privacy notes reviewed.
- [ ] Screenshots planned or generated.

## Build URL Log

Preview APK:

```text
2026-05-01 preview EAS build:
https://expo.dev/accounts/abdul_shaikh_dev/projects/cogvest/builds/82740e7b-97b0-48b1-a970-9457311dcc0b
```

Production AAB:

```text
Record production EAS build URL during release-candidate verification.
```

## Manual QA Notes

Record device model, Android version, and any issues found during preview APK testing.

## Verification Runs

### 2026-05-01 - Local Gate Check

- `npm run typecheck`: passed.
- `npm test -- --runInBand`: passed, 24 suites and 77 tests.
- `npm run doctor`: passed, 17/17 Expo doctor checks.
- `npm audit --audit-level=high`: passed; remaining findings are moderate Expo transitive dependencies where the force fix would downgrade Expo.
- `npx expo start --offline --port 8086`: passed; Metro started and waited on `http://localhost:8086`.
- `npx eas-cli build --platform android --profile preview --non-interactive`: blocked before build start because no Expo account login or `EXPO_TOKEN` is available.
- `adb devices`: blocked because `adb` is not installed or not on `PATH` in this environment.

### 2026-05-01 - Preview APK Build

- GitHub Actions workflow: `Android Preview APK`.
- GitHub Actions run: `https://github.com/abdul-shaikh-dev/CogVest/actions/runs/25209354761`.
- EAS preview APK build: `https://expo.dev/accounts/abdul_shaikh_dev/projects/cogvest/builds/82740e7b-97b0-48b1-a970-9457311dcc0b`.
- Status: preview APK build passed.

Pending before issue #16 can be closed:

- Install the generated APK on a real Android device.
- Record device model, Android version, pass/fail status for core flows, and any defects.

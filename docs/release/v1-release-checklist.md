# V1 Release Checklist

## Dev-Complete Gate

- [ ] `npm install` succeeds.
- [ ] `npm run test:v1:pc` passes.
- [ ] App starts on Android Emulator.
- [ ] Local APK builds successfully on the developer PC.
- [ ] Local APK installs on Android Emulator.
- [ ] Core V1 flows pass through `docs/testing/v1-core-flow-test-matrix.md`.
- [ ] Excel parity passes through `docs/testing/excel-parity-checklist.md`, or failed rows have linked `[V1 QA]` defects.
- [ ] Defects are logged with `docs/testing/v1-defect-report-template.md`.
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

Local APK:

```text
Record local APK path or EAS preview build URL if one is explicitly requested.
```

Production AAB:

```text
Record production EAS build URL during release-candidate verification.
```

## Manual QA Notes

Record emulator model, Android version, APK source, and any issues found during
PC-based APK testing. Include whether `docs/testing/excel-parity-checklist.md`
passed.

## Verification Runs

### 2026-05-01 - Local Gate Check

- `npm run typecheck`: passed.
- `npm test -- --runInBand`: passed, 24 suites and 77 tests.
- `npm run doctor`: passed, 17/17 Expo doctor checks.
- `npm audit --audit-level=high`: passed; remaining findings are moderate Expo transitive dependencies where the force fix would downgrade Expo.
- `npx expo start --offline --port 8086`: passed; Metro started and waited on `http://localhost:8086`.
- `npx eas-cli build --platform android --profile preview --non-interactive`: blocked before build start because no Expo account login or `EXPO_TOKEN` is available.
- `adb devices`: blocked because `adb` is not installed or not on `PATH` in this environment.

Superseded physical-device notes:

- The old physical-phone preview APK gate was superseded by issue #54.
- V1 dev-complete verification should use the PC/emulator matrix in `docs/testing/`.
- EAS preview builds remain optional unless explicitly requested.

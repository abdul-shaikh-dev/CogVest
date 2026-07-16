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

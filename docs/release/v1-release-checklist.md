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
Record preview EAS build URL during release verification.
```

Production AAB:

```text
Record production EAS build URL during release-candidate verification.
```

## Manual QA Notes

Record device model, Android version, and any issues found during preview APK testing.

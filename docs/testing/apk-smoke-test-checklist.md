# APK Smoke Test Checklist

- [ ] Build or download an APK. Prefer local PC builds for developer smoke tests:
  `npm run android:apk:emulator`.
- [ ] Confirm a local debug APK is treated as development-only and Metro is
  running.
- [ ] For a standalone release APK, use `npm run android:apk:release` only
  with owner-controlled private signing credentials.
- [ ] Start Android Emulator.
- [ ] Confirm emulator is ready with `adb devices`.
- [ ] Install APK with `adb install -r path/to/app.apk`.
- [ ] Open CogVest from launcher.
- [ ] Verify no Unmatched Route screen appears.
- [ ] Verify Dashboard loads.
- [ ] Verify bottom tabs render.
- [ ] Verify Settings opens.
- [ ] Verify app survives close/reopen.
- [ ] Run `npm run android:smoke -- --strict`.
- [ ] Record APK source. Use a local path for local builds or a build URL for EAS.
- [ ] Record emulator/device name.
- [ ] Record Android version.
- [ ] Record result.

## Evidence

```text
APK source:
Emulator/device name:
Android version:
Install command:
Result:
Defects:
```

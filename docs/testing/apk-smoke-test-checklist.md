# APK Smoke Test Checklist

- [ ] Download APK from EAS/Expo.
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
- [ ] Record APK build URL.
- [ ] Record emulator/device name.
- [ ] Record Android version.
- [ ] Record result.

## Evidence

```text
APK build URL:
Emulator/device name:
Android version:
Install command:
Result:
Defects:
```

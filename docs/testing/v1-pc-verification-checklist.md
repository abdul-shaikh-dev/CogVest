# V1 PC Verification Checklist

Use this checklist before marking V1 core flows verified. It requires an
Android Emulator, not a physical Android phone.

## Static And Unit Gate

- [ ] `npm install` has completed successfully.
- [ ] `npm run test:v1:pc` passes.
- [ ] `npm run doctor` reports 17/17 checks passing.
- [ ] `npm run android:doctor` reports adb and emulator readiness.
- [ ] `npm run android:smoke -- --strict` finds `com.abdulshaikh.cogvest`.

## Local APK Gate

- [ ] Local APK is built on this PC, not through EAS cloud build.
- [ ] APK is installed on the emulator with `adb install -r path/to/app.apk`.
- [ ] App cold-launches from launcher or `.MainActivity`.
- [ ] Dashboard opens, not Unmatched Route.
- [ ] App closes and reopens without losing local data.

## Core Flow Gate

- [ ] Dashboard shows portfolio value and bottom tabs.
- [ ] Add Trade can save a buy trade.
- [ ] Holdings reflect the saved trade.
- [ ] Invalid trade data shows validation errors.
- [ ] Cash can be added.
- [ ] Cash balance appears on Dashboard.
- [ ] Value masking can be toggled from Settings.
- [ ] Masked state hides wealth values but not quantities or percentages.
- [ ] Quote refresh or fallback state is visible where holdings exist.
- [ ] No backend, auth, analytics, cloud sync, or push notifications are added.

## Optional Maestro Gate

- [ ] `npm run maestro:check` works, or unavailable status is recorded.
- [ ] `npm run maestro:test` passes.

## Evidence

```text
Date:
Branch/commit:
Emulator:
Android version:
APK source:
Installed package:
Commands run:
Maestro status:
Result:
Defects logged:
```

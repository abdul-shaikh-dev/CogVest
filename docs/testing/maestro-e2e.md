# Maestro E2E On Android Emulator

## Purpose

Maestro runs black-box mobile E2E flows against the installed CogVest Android
app. It drives the Android Emulator like a user by launching the app, tapping
tabs, entering form values, saving records, and asserting stable `testID`s or
visible text.

Maestro is optional local tooling. It is not an app runtime dependency and is
not part of default GitHub PR CI.

## Prerequisites

- Java 17 or newer.
- `JAVA_HOME` points to the Java installation.
- Android Studio and a running Android Emulator.
- `adb devices` shows an emulator in `device` state.
- CogVest package `com.abdulshaikh.cogvest` (debug, with Metro) or
  `com.abdulshaikh.cogvest.e2e` (E2E build) is installed on the emulator.
- Maestro CLI is installed and available on `PATH`.

Official install docs:

- https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli
- https://docs.maestro.dev/getting-started/installing-maestro/

## Windows Install Notes

The official Maestro CLI docs support Windows. Use either:

- The official installer script from a shell with `curl`.
- The GitHub release `maestro.zip`, extracted to a stable location such as
  `C:\maestro`, with `C:\maestro\bin` added to `PATH`.

After installing, restart PowerShell and run:

```powershell
maestro --help
```

If Java is missing, install Java 17+ first and set `JAVA_HOME`.

## CogVest Commands

Check readiness:

```powershell
npm run maestro:check
```

Run the smoke tier (at most 15 minutes):

```powershell
npm run maestro:smoke
```

Run the full local flow suite:

```powershell
npm run maestro:test
```

Run one flow:

```powershell
npm run maestro:test -- e2e/smoke-launch.yaml
```

Every run ends with a summary listing each flow's result, its duration and,
for a failure, the failing step. A failing flow does not stop the run; the
command still exits non-zero when any flow fails.

Flows declare `appId: ${APP_ID}` and open links as `${SCHEME}://`. Run them
through `scripts/maestro-run.mjs` (the commands above, or
`node scripts/maestro-run.mjs <flow>` for flows outside `e2e/`), which passes
both values. `npm run maestro:lint` rejects a hardcoded app ID or scheme.

### Against the E2E build, without Metro

The E2E build (`com.abdulshaikh.cogvest.e2e`, launcher name "CogVest E2E")
bundles release-mode JavaScript with the QA harness enabled. It installs
alongside the debug app and uses its own `cogvest-e2e://` scheme. See
[`e2e-build-variant.md`](e2e-build-variant.md).

```powershell
npm run android:e2e
adb install -r android/app/build/outputs/apk/e2e/app-e2e.apk
$env:COGVEST_APP_ID = "com.abdulshaikh.cogvest.e2e"; npm run maestro:test
```

`android:e2e` builds for the x86_64 emulator. Rebuild the APK after any change
to `app/` or `src/`, since it does not load JavaScript from Metro.

## Run Cadence

- **Smoke tier** (`smokeFlows` in `scripts/maestro-run.mjs`): one flow per
  primary journey, each asserting stored results. Run it for every change to
  UI or `e2e/`. Its budget is 15 minutes on the reference AVD. The runner warns
  when the tier goes over; swap a slow flow out rather than raising the budget.
- **Full tier** (`defaultFlows`, every top-level `e2e/*.yaml`): run it weekly
  and before any release gate. Record the result in [`e2e-runs.md`](e2e-runs.md).
- **Standalone flows** (`e2e/standalone/`): run them by path when a change
  touches their journey.

If a tier can't be run, say which one and why rather than reporting the change
as verified.

## Selector Policy

Copy and layout should be free to change without breaking end-to-end coverage.
Flows in `e2e/` and `e2e/helpers/` follow these rules:

1. **Navigate and act by `testID`.** Use text only where the text itself is
   under test, such as an exact financial value or an error message, or where
   no `testID` can exist (native alerts, the Android document picker).
2. **Assert results through `e2e-evidence`** (stored records and values), not
   through visible summary text.
3. **Scroll to the element you will act on**, never to a nearby heading. Don't
   use `centerElement: true` unless the element is known to have content below
   it.
4. **Don't use `hideKeyboard` before tapping a field that is already visible.**
   It acts as Back when no keyboard is shown. Tap the next field directly.
5. **Avoid typed values containing "rr"** while flows run on debug builds.

Maestro text matching is case-insensitive and regex-based, so a text selector
can also match a longer string: "Monthly History" matched "Checking monthly
history" and hid a missed tap.

`npm run maestro:lint` (part of `npm run test:verify`) reports text taps, text
scroll targets, `centerElement: true` and typed "rr" values. Rule 4 needs the
screen state, so review it by hand. Native UI text (the visual QA seed alert,
the default alert "OK", the Android pickers and fixture file names) is allowed
in `scripts/maestro-lint.mjs`. Exempt any other intentional case with a comment
directly above the command that gives the reason:

```yaml
# selector: the exported file's name in the Android document picker
- tapOn: ${output.backupName}
```

`e2e/selector-baseline.json` counts the selectors that predate the policy, per
flow and rule. A count may only go down: the lint fails when a flow gains a
violation, and asks you to run `npm run maestro:lint -- --update-baseline` when
a conversion lowers one. Convert flows in small batches by area, and verify
each batch on the emulator without weakening any assertion. `src/__tests__/maestroFlowInventory.test.ts` fails when a
top-level flow is missing from the full tier, or a smoke flow is not in it.

## Flow Set

- `e2e/smoke-launch.yaml`: cold-launch and Dashboard smoke.
- `e2e/navigation.yaml`: verify primary tab navigation.
- `e2e/add-trade.yaml`: add a holding through the manual-entry path.
- `e2e/add-holding-lookup.yaml`: save a deterministic provider result twice,
  then prove provider provenance, derived values, and canonical asset reuse.
- `e2e/add-holding-manual-semantics.yaml`: save a manual fallback and prove its
  persisted identity, classification, values, note, and manual provenance.
- `e2e/add-holding-edited-quote.yaml`: edit an autofilled provider price and
  prove the persisted quote is intentionally marked manual.
- `e2e/add-holding-asset-switch.yaml`: change assets mid-flow and prove stale
  quantity, cost, price, note, and conviction data do not leak.
- `e2e/holdings.yaml`: create a position and verify Holdings.
- `e2e/ppf-account.yaml`: recover from inline Bank or Post Office validation,
  create a confirmed PPF baseline, and verify the
  account in the dedicated Holdings section. Ledger date ordering and balance
  effects use deterministic Jest coverage so the baseline cannot be counted
  twice.
- `e2e/cash.yaml`: add cash and verify Cash.
- `e2e/value-masking.yaml`: open Settings by deep link and toggle masking.
- `e2e/persistence.yaml`: create local data, close/reopen, and verify it remains.

## Expected Missing-Tool Behavior

If Maestro is not installed:

```text
FAIL maestro not found
Install guidance:
...
```

This is expected on machines that have not opted into Maestro. Default static
checks and Android smoke checks should still work.

## Troubleshooting

- `maestro not found`: add Maestro `bin` folder to `PATH`, restart PowerShell,
  and rerun `npm run maestro:check`.
- `java not found`: install Java 17+ and set `JAVA_HOME`.
- `no Android emulator/device`: start your Android emulator from Android Studio and confirm
  `adb devices`.
- `app package not installed`: install a local APK with
  `adb install -r path/to/app.apk`.
- Flow cannot find a control: verify the installed build is current, confirm
  the stable testID still exists in source, and rerun from a clean app state.
- "Open debugger to view warnings." covers bottom actions on a debug build:
  Android 15+ blocks network for an app behind another activity, such as the
  system file picker, which drops the Metro Fast Refresh socket. The runner
  exempts `com.abdulshaikh.cogvest` with
  `adb shell dumpsys deviceidle whitelist +com.abdulshaikh.cogvest`; rerun that
  after reinstalling the app if you run flows with `maestro test` directly.
  The E2E build has no Metro socket, so it needs no exemption.
- Typed labels change (for example "contribution" becomes "contributions"):
  turn off Gboard auto-correction, spell check and the suggestion strip under
  Gboard settings > Corrections & suggestions. Also turn off stylus
  handwriting (`adb shell settings put secure stylus_handwriting_enabled 0`).
- Keep animation scales at 1. With them at 0, Reanimated logs a reduced-motion
  warning on debug builds and raises the same warning banner.

## Add Holding And Quick Setup Evidence

`e2e/holdings-csv-import.yaml` uses Android's real system document picker. The
Maestro runner first copies `e2e/fixtures/holdings-import-v1.csv` to Android's
Downloads folder with `adb push`, then verifies preview correction, one atomic
confirmation, Quick Setup review, and exact persisted Dashboard totals.

The Add Holding semantic flows use deterministic lookup and quote fixtures so
they do not depend on provider availability or changing market prices. After a
save, they open the gated, read-only route:

```text
cogvest:///e2e-evidence?token=cogvest-local-visual-qa
```

That route projects the actual persisted store into stable evidence for asset
identity, classification, market/currency, quote source and price, opening
positions, PPF balances, aggregate invested/current values, valuation
completeness, allocation, and canonical-identity conflicts. It does not seed or
mutate data. The harness needs the matching local token, and is available only
in development builds and the E2E build (`com.abdulshaikh.cogvest.e2e` with the
build-time harness flag). The Play and private release builds cannot enable it;
see [`e2e-build-variant.md`](e2e-build-variant.md). On the E2E build the route
opens as `cogvest-e2e:///e2e-evidence?...`.

Run these flows only against a freshly built and installed local APK when using
their output as PR evidence. A passing flow against an older installed build is
not valid verification.

`e2e/quick-portfolio-setup.yaml` proves multiple explicit provider selections,
immediate persistence, restart recovery, known and unknown dates, provider
failure with manual fallback, dedicated PPF capture, final review, and derived
Dashboard totals. Set `MAESTRO_TEST_OUTPUT_DIR` to retain its named screenshots.
The latest complete run is recorded in
[`quick-portfolio-setup-evidence.md`](quick-portfolio-setup-evidence.md).

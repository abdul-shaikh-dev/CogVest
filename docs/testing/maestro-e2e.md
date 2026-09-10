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
- CogVest package `com.abdulshaikh.cogvest` is installed on the emulator.
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

Run the full local flow suite:

```powershell
npm run maestro:test
```

Run one flow:

```powershell
npm run maestro:test -- e2e/smoke-launch.yaml
```

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
- `e2e/ppf-account.yaml`: create a confirmed PPF baseline and verify the
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
mutate data. The harness is available only in development builds with the
matching local token. Release builds cannot opt into test routes through public
environment variables.

Run these flows only against a freshly built and installed local APK when using
their output as PR evidence. A passing flow against an older installed build is
not valid verification.

`e2e/quick-portfolio-setup.yaml` proves multiple explicit provider selections,
immediate persistence, restart recovery, known and unknown dates, provider
failure with manual fallback, dedicated PPF capture, final review, and derived
Dashboard totals. Set `MAESTRO_TEST_OUTPUT_DIR` to retain its named screenshots.
The latest complete run is recorded in
[`quick-portfolio-setup-evidence.md`](quick-portfolio-setup-evidence.md).

# Privacy Policy Notes

## Local-First Data

CogVest V1 stores portfolio data locally on the user's Android device.

The records use CogVest's app-private Android storage. Android cloud backup,
device-to-device transfer, and cross-platform transfer are disabled for CogVest
app data.

Stored locally:
- assets
- trades
- quantities
- prices
- cash entries
- notes
- conviction ratings
- preferences

## No Account System

V1 has:
- no login
- no backend
- no cloud sync
- no social features
- no brokerage integration
- no analytics SDK

## Quote API Data

Quote APIs may receive only:
- stock/ETF ticker
- crypto coin ID

Quote APIs must not receive:
- quantity held
- trade history
- portfolio value
- user notes
- conviction score
- behaviour metadata

## Data Loss Risk

Because V1 is local-only:
- uninstalling the app may delete data
- clearing app storage may delete data
- device loss may lose data
- export/import is planned for a later version

## Storage Protection

- CogVest relies on Android app isolation and the user's device security.
- CogVest V1 does not add separate application-layer encryption to MMKV.
- Product and store copy must not claim encrypted MMKV, hardware-backed
  encryption, or recoverable backup.
- Backup exclusion is enforced with `android:allowBackup="false"` and explicit
  rules for Android 12+ cloud backup, device transfers, and legacy Android backup.

## Secrets

Do not commit tokens, keystores, service-account JSON, passwords, or local secret files.

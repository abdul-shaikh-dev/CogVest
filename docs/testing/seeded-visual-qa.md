# Seeded Android Visual QA

## Purpose

This harness seeds a deterministic V1 portfolio on the Android Emulator and
captures screenshots for screen-to-mock comparison against:

- `docs/design/v1-screen-baseline.md`
- `docs/design/issue-86-premium-preview/index.html`
- Figma V1 UI concepts

It is local-only. It does not require a physical phone, EAS cloud builds, or
default GitHub Actions.

## Prerequisites

- Android Emulator running and visible in `adb devices`.
- CogVest local Android build installed with either:

```powershell
npm run android
```

or a local release APK installed with `adb install -r`.

The seed route is hidden and only writes data in development builds. For a
local release APK visual QA run, build with `EXPO_PUBLIC_COGVEST_VISUAL_QA=1`
and use the local visual QA token supplied by `npm run visual-qa:android`.

## Run

```powershell
npm run visual-qa:android
```

Output is written to:

```text
docs/testing/artifacts/visual-qa/latest
```

Expected screenshots:

- `dashboard.png`
- `holdings.png`
- `add-holding-initial.png`
- `add-holding-lookup.png`
- `add-holding-review.png`
- `cash.png`
- `progress.png`
- `settings.png`

## Seeded Dataset

The visual QA seed includes:

- Equity: HDFC Bank
- ETF: Nifty 50 ETF
- Debt: Sovereign Gold Bond
- Crypto: Bitcoin
- Cash ledger additions and withdrawals
- Yahoo, CoinGecko, and manual quote metadata
- Optional conviction on one opening position
- Three monthly snapshots so Progress charts render

## Compare

Open the latest screenshots beside the HTML preview and Figma screen contract.
Check:

- Dashboard hierarchy and density
- Holdings populated row layout
- Add Holding initial, lookup selection, and review states
- Cash Ledger hero, metrics, entry form, and ledger rows
- Monthly Progress portfolio/invested and asset trend charts
- Settings local-first trust sections

Log any mismatch as a focused GitHub issue with screenshot evidence.

## Safety

The route `cogvest:///visual-qa-seed` only seeds data when `__DEV__` is true or
when `EXPO_PUBLIC_COGVEST_VISUAL_QA=1` was set at build time and the local
visual QA token is provided by the harness script. Do not link this route from
the UI. Do not add this command to default PR CI. Do not ship Play Store builds
with `EXPO_PUBLIC_COGVEST_VISUAL_QA=1`.

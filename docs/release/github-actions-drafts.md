# GitHub Actions Release Drafts

The preview APK workflow is implemented at
`.github/workflows/android-preview.yml`. This document contains only release
automation that has not been enabled yet.

Do not create or enable cloud EAS workflows unless the release process is
explicitly approved. Local APK builds remain the normal developer path.

## Android Production AAB

Purpose: build a production Android App Bundle for the release-candidate gate.
This is not part of default PR CI or the V1 development-complete gate.

Required GitHub secret:

- `EXPO_TOKEN`

Proposed workflow file: `.github/workflows/android-production.yml`

```yaml
name: Android Production AAB

on:
  workflow_dispatch:
  push:
    tags:
      - "v*.*.*"

jobs:
  production-aab:
    name: Build Android production AAB
    runs-on: ubuntu-latest
    timeout-minutes: 60

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Verify
        run: npm run test:verify

      - name: Build production AAB
        run: eas build --platform android --profile production --non-interactive
```

## Activation Gate

Before creating the workflow:

- confirm `eas.json` production output is AAB
- confirm Expo-managed signing ownership and recovery
- confirm version name and monotonically increasing version code
- confirm the repository secret is named `EXPO_TOKEN`
- decide whether tag-triggered builds are wanted or manual dispatch is enough

V1 does not auto-submit to Google Play. Upload to Play Console internal testing
remains manual until a later issue explicitly changes the release process.

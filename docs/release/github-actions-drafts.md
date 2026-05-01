# GitHub Actions Drafts

These workflows are release drafts only. Do not enable cloud EAS builds on pull
requests or pushes until the release process is approved.

## Android Preview APK

Purpose: manually trigger a V1 preview APK build for installation testing on a
real Android device.

Required GitHub secret:
- `EXPO_TOKEN`

Draft workflow file: `.github/workflows/android-preview.yml`

```yaml
name: Android Preview APK

on:
  workflow_dispatch:

concurrency:
  group: android-preview-${{ github.ref }}
  cancel-in-progress: true

jobs:
  preview-apk:
    name: Build Android preview APK
    runs-on: ubuntu-latest
    timeout-minutes: 45

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

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test -- --runInBand

      - name: Expo doctor
        run: npm run doctor

      - name: Build preview APK
        run: eas build --platform android --profile preview --non-interactive
```

Notes:
- This workflow is manual only through `workflow_dispatch`.
- It does not use an emulator.
- It depends on the root `eas.json` preview profile, which outputs APK.
- Record the EAS build URL in `docs/release/v1-release-checklist.md` during
  release verification.

## Android Production Build

Path: `.github/workflows/android-production.yml`

```yaml
name: Android Production Build

on:
  workflow_dispatch:
  push:
    tags:
      - "v*.*.*"

jobs:
  production:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npx expo doctor
      - run: npx eas-cli build --platform android --profile production --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

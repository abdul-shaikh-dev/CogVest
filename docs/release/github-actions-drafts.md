# GitHub Actions Drafts

These workflows are drafts. Do not trigger EAS cloud builds unless explicitly approved.

## Android Preview Build

Path: `.github/workflows/android-preview.yml`

```yaml
name: Android Preview Build

on:
  workflow_dispatch:
  pull_request:
    branches: [main]

jobs:
  preview:
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
      - run: npx eas-cli build --platform android --profile preview --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

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

## Boundary

Default PR checks should not require an Android emulator. Device testing is release-gate/manual.

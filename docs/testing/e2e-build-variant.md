# E2E Build Variant: Design Note (#560)

Status: approved by the owner on 2026-10-29. All four decisions at the end of
this note were approved: the `e2e` build type, adding `expo-application`, the
`${APP_ID}` flow header, and the `cogvest-e2e://` fallback scheme if needed.

## Goal

Run the Maestro suite against an installed APK that has release-mode
JavaScript bundled in, with no Metro dependency. The QA harness is enabled in
that APK, and it must never be enabled in the Play or private release builds.

## 1. How the variant is built

A new config plugin, `plugins/withE2eBuildType.js`, adds a third Gradle build
type, `e2e`, to the same prebuilt Android project:

- `initWith release`: JavaScript is bundled and compiled to Hermes like
  release. `matchingFallbacks = ["release"]` for library modules.
- `applicationIdSuffix ".e2e"`: the package is `com.abdulshaikh.cogvest.e2e`,
  so it installs alongside the normal app and Play would reject it.
- The app name resource is `CogVest E2E`, so the two apps are distinguishable
  in the launcher and on screenshots.
- It is signed with the local debug keystore and never with the private
  release key. The existing release-signing guard only covers the `release`
  tasks, so it stays as it is.

`npm run android:e2e` (a new mode of `scripts/android-build-apk.mjs`) runs:
1. `expo prebuild`, as today;
2. `gradlew assembleE2e`, with `EXPO_PUBLIC_COGVEST_QA_HARNESS=cogvest-qa-harness-on`
   set only in that process's environment.

The output is `android/app/build/outputs/apk/e2e/app-e2e.apk`. There is no EAS
build, no AAB and no change to `eas.json`.

**Rejected alternative:** making `app.config` switch the package on an
environment variable. That rewrites the whole generated `android/` project to
the E2E package and needs `prebuild --clean` in both directions. A later
release build could then pick up the E2E state by accident.

## 2. How the harness is enabled

There is one gate, `isQaHarnessEnabled()` in `src/testing/qaHarness.ts`:

```ts
__DEV__ ||
  (Boolean(process.env.EXPO_PUBLIC_COGVEST_QA_HARNESS) &&
    Application.applicationId === "com.abdulshaikh.cogvest.e2e")
```

- `canUseVisualQaHarness({ token })` calls it in place of the `isDevelopment`
  argument. The token check stays.
- The 20 route callers drop `isDevelopment: __DEV__`.
- `Application.applicationId` is read from the installed package at runtime.
  This needs **`expo-application`** (Expo SDK 54's own module, `~7.0`). That
  is a new dependency and needs your approval.
- Without it, the gate would rest on the build flag alone. The guards in
  section 3 would still apply, but there would be no runtime proof of which
  package is running.

## 3. How production builds exclude the harness

There are four independent layers. Any one of them is enough to keep the
harness off the Play build.

1. **Package identity:** the Play and private release package
   `com.abdulshaikh.cogvest` can never pass the runtime package check, even if
   the flag leaked into its bundle.
2. **Gradle guard:** the plugin fails `assembleRelease`, `bundleRelease` and
   `packageRelease` if `EXPO_PUBLIC_COGVEST_QA_HARNESS` is set in the build
   environment. This also covers EAS builds, which run the same plugin.
3. **Jest guard tests:**
   - `isQaHarnessEnabled()` is false with `__DEV__` off and no flag;
   - it is false with the flag set and the Play package;
   - it is true only with both the flag and the E2E package;
   - and a repository test fails if any committed `.env*` file or any
     `eas.json` profile defines the flag.
4. **Release bundle check:**
   - a new `npm run release:check-harness` bundles the production JavaScript
     (`expo export:embed`, dev off, plain JS) and fails if the literal
     `cogvest-qa-harness-on` appears in it;
   - the code never contains that literal; it only appears when the flag is
     inlined;
   - this becomes a step in `docs/release/android-release-process.md` and
     `v1-release-checklist.md`, run before every release build.

**Metro cache:** the review found that Metro's transform cache ignores
`EXPO_PUBLIC_` values, although `babel-preset-expo` inlines them into the
cached output. Without a cache reset, a bundle reused whichever transforms the
cache already held, flagged or not. That would have let a release build reuse
the E2E build's flagged transforms, which neither the Gradle guard nor the
bundle check (which resets the cache) would see. `metro.config.js` now adds
the flag's value to Metro's `cacheVersion`, so flagged and unflagged builds
never share cache entries. I checked this with alternating flagged and
unflagged bundles, flag in the environment and in `.env.local`, all without
a cache reset.

## 4. Maestro

- **App ID:** every flow and helper hardcoded
  `appId: com.abdulshaikh.cogvest` (206 files under `e2e/`).
  - Each flow's header line becomes `appId: ${APP_ID}`.
  - `scripts/maestro-run.mjs` always passes
    `--env APP_ID=${COGVEST_APP_ID:-com.abdulshaikh.cogvest}`.
  - `maestro:lint` rejects a hardcoded `appId`.
  - No flow steps change. This is the one deliberate edit to flow files,
    because Maestro has no command-line override for `appId`.
- **deviceidle:** the runner skips the deviceidle allowlist for the E2E
  package, because there is no Metro socket to keep alive.
- **Deep links (risk to check first):**
  - both apps register the `cogvest://` scheme, and about half the flows
    start with `openLink`;
  - if Maestro's `openLink` does not target the flow's app ID, Android may
    show an app chooser while both apps are installed;
  - I'll check this with one flow before the full change;
  - fallback: the `e2e` build type registers its own scheme,
    `cogvest-e2e://`, and the runner passes `SCHEME` the same way it passes
    `APP_ID`.

**Outcome of the deep-link check:** with both apps installed, `openLink` opened
Android's app chooser (`ResolverActivity`), so the fallback is in place:
- the plugin replaces the activity's `cogvest` scheme with a
  `${cogvestScheme}` manifest placeholder;
- `defaultConfig` sets it to `cogvest`, so debug and release are unchanged
  (I verified this in the merged manifests);
- the `e2e` build type sets it to `cogvest-e2e`;
- flows open `${SCHEME}://` links, and the runner passes `SCHEME` with `APP_ID`.

## 5. Verification

- Build the E2E APK locally, then install it alongside the debug app.
- Run the full Maestro tier against it with Metro stopped and without the
  deviceidle allowlist.
- Record cold launch to `dashboard-screen` against the debug build's ~29s.
- Log the run in `e2e-runs.md`.
- Adversarial review of the owned diff, focused on the four layers above.
- No EAS build and no Play submission.

**Results, 2026-10-29** (AVD CogVest_UX_Proof, API 36, 1280x2856 at 480 dpi,
font scale 1.0):
- Full tier against the E2E APK, with Metro stopped, the debug app also
  installed and no deviceidle allowlist: 60 passed, 0 failed, 70m 27s.
- Cold launch to `dashboard-screen` (`stopApp`, `launchApp` with
  `clearState`, then wait for `dashboard-screen`), three runs each:
  - E2E build: 2.30s, 2.35s, 2.48s;
  - debug build with Metro already warm: 10.95s, 11.63s, 11.63s;
  - the issue's ~29s was the debug build including bundle loading.
- The Gradle guard stopped `assembleRelease` and `bundleRelease` (dry run)
  with the flag set, and allowed them without it.
- `npm run release:check-harness` passed on a clean environment, and failed
  with the flag in the environment or in a temporary `.env.local`.
- Merged manifests: debug and release keep `com.abdulshaikh.cogvest` and
  `cogvest`; e2e has `com.abdulshaikh.cogvest.e2e` and `cogvest-e2e`.

## Decisions needed

1. Approve the Gradle `e2e` build type approach (section 1).
2. Approve adding `expo-application` for the runtime package check
   (section 2), or accept the gate without it.
3. Approve changing each flow's `appId:` line to `${APP_ID}` (section 4).
4. Approve the `cogvest-e2e://` scheme fallback, if the deep-link check shows
   a chooser.

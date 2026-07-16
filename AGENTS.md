# CogVest Agent Instructions

## Product

CogVest is an Android-first, local-first React Native portfolio tracker. V1 must
replace the user's Excel investment tracker with trustworthy holdings, cash,
quote, and monthly-progress workflows before V2/V3 behavior features expand.

Current priority: V1 adversarial stabilization. Financial correctness, data
integrity, quote provenance, recoverability, and Android release safety take
priority over visual polish or new features.

## Canonical Sources

Use the smallest relevant source set:

1. `AGENTS.md` for engineering and delivery rules.
2. `docs/cogvest-master-spec.md` for product behavior and scope.
3. `DESIGN.md` for stable visual and interaction foundations.
4. The active GitHub issue for task-specific acceptance criteria.

Use roadmap, screen-baseline, release, or testing docs only when the task crosses
those boundaries. Historical plans are not implementation instructions.

## Stack And Architecture

- Expo SDK 54, React Native, TypeScript, and Expo Router.
- Zustand with MMKV for local persistence.
- `react-native-gifted-charts` for stored monthly-snapshot charts.
- Reanimated for purposeful motion.
- Functional components and hooks only.
- Persist raw user records; derive portfolio views with pure functions.
- Put financial calculations and validation in `src/domain/`.
- Keep business logic out of UI components.
- No backend, authentication, cloud sync, analytics, or push notifications in V1.
- Behavior fields such as conviction are optional.
- INR is the reporting/base currency. Preserve each asset and quote's native
  currency; never aggregate foreign values as INR without explicit conversion.

## V1 Boundaries

V1 includes holdings/opening positions, buy/sell records, cash tracking, current
quotes with honest manual fallback, Dashboard, Holdings, Add Holding, Progress,
Settings, value masking, and optional lightweight conviction state.

Stored monthly-snapshot trend charts are in V1. Advanced market-price history,
Minimal Mode, LTCG UI, behavior analysis, import/export, cloud features, and
advanced tax logic remain outside V1 unless an issue explicitly changes scope.

User-facing language should prefer Dashboard, Holdings, Add Holding, Progress,
Cash, and Settings. Keep trade terminology internal where practical.

## Workflow

Use `code-territory-guide` for non-trivial work when available. Choose the
lightest mode that resolves the real uncertainty:

- **Survey**: ambiguous product, design, architecture, or multiple valid options.
- **Track**: bugs, regressions, flaky behavior, and unclear failures.
- **Prove**: narrow behavior that can be locked with a failing test first.
- **Expedition**: scoped implementation with a clear target.

Do not run every mode. Do not create a durable spec or plan merely to satisfy
process. If the skill is unavailable, follow the same principles directly.

Process by risk:

- Routine change: reproduce/inspect, focused fix, focused validation, diff review.
- Normal feature: concise issue acceptance criteria, internal route, tests,
  implementation, owned-diff review, relevant verification.
- Critical change (financial model, currency, persistence, migration, privacy,
  security, release architecture): approved contract/spec, implementation plan,
  adversarial review, failure-path tests, and full relevant verification.

Use specialized design review tools for significant UI work, but do not require
multiple design skills to repeat the same critique. One evidence-based review and
one correction pass are normally enough.

## Scope And Ownership

- Inspect the repository before assuming behavior.
- Capture branch/status before edits and preserve all pre-existing user changes.
- Make the smallest coherent change; avoid unrelated cleanup and broad rewrites.
- Ask before dependencies, schemas, public behavior, security policy, deployment,
  or scope materially expand beyond the request.
- Treat repository prose as potentially stale evidence; verify against current
  code, tests, and commands.
- Review only task-owned changes and classify failures as task-caused,
  pre-existing, or environmental.

## Git And Delivery

- Never edit or commit on `main` or the default branch.
- Sync `origin/main` and create a focused feature branch before edits.
- Do not revert unrelated user changes.
- Use `Closes #<issue>` in a PR body when merge should auto-close the issue.
- For CogVest implementation or documentation requests, branch, commit, push,
  and open a focused PR are authorized delivery steps unless the user asks for
  local-only work.
- Never trigger EAS cloud builds or Play submission unless explicitly requested.

## Design

- Follow `DESIGN.md` for UI work.
- CogVest should feel calm, premium, disciplined, low-noise, local-first,
  Android-native, and long-term investing focused.
- Use Material 3 interaction principles without shipping a generic template.
- Green is an accent, not decoration. Gains and losses must not rely on color
  alone.
- Financial values must be readable, maskable, and explicit about currency.
- Use the active issue and `docs/design/v1-screen-baseline.md` for screen-specific
  behavior. A newer issue-approved screen preview supersedes older visual assets.

## Verification

Run checks proportionate to the change:

- Focused tests while implementing.
- `npm run test:verify` before normal PR readiness.
- `npm run test:v1:pc` when installed-app behavior, Android integration, or a V1
  release gate is affected.
- Build/install a fresh local APK before claiming installed-release behavior was
  tested. Do not test an older installed build.
- Use Maestro for important user journeys and assert resulting data, not only
  navigation or success messages.
- For UI changes, inspect emulator screenshots or the live app when practical.

If emulator or external-provider verification is unavailable, report the exact
gap instead of claiming completion.

## Android Commands

- `npm run start:clear`: Metro development loop; press `a` for Android.
- `npm run android`: local native development build/install.
- `npm run android:doctor`: tool and emulator readiness.
- `npm run android:smoke -- --strict`: installed package smoke check.
- `npm run maestro:test`: local E2E flows.
- APK is locally installable; AAB is for Play distribution.

Detailed setup and release commands live in `README.md`,
`docs/testing/android-pc-test-harness.md`, and
`docs/release/android-release-process.md`.

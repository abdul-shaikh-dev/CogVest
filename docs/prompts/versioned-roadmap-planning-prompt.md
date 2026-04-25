You are working on CogVest.

This repo uses the Superpowers plugin in Codex CLI.

Read these files first:
- AGENTS.md
- docs/cogvest-master-spec.md
- docs/cogvest-codex-prompts.md
- docs/cogvest_standard_mode.png
- docs/cogvest_minimal_mode.png

---

🧠 SUPERPOWERS / CODEX CLI WORKFLOW

Before making changes:

- Use the appropriate Superpowers planning/design workflow if available.
- Do not immediately edit files.
- First inspect the repo, read the referenced docs, and produce a short implementation plan.
- Ask only if there is a true blocker.
- Otherwise make reasonable assumptions and document them.
- Use Superpowers planning before execution.
- Make changes in small, reviewable commits.

Expected workflow:

1. Read AGENTS.md and all docs listed above.
2. Use Superpowers planning/brainstorming workflow to split the spec into versions.
3. Produce a concise plan.
4. Create/update roadmap, design, testing, release, issue-draft, and prompt files.
5. Create GitHub labels/milestones/issues only after roadmap files are coherent.
6. Commit changes on a new branch.
7. Open a PR.

If a Superpowers workflow/tool is unavailable:

- Continue manually.
- Document what was unavailable.
- Do not block the task unless there is no safe fallback.

---

🚧 PLANNING TASK BOUNDARY

This task is for planning and setup only.

Do not implement app features during this task.

Allowed:
- Roadmap docs
- Version-specific spec docs
- Version-specific Codex prompt docs
- Design docs
- Testing docs
- Release docs
- GitHub issue drafts
- Labels/milestones/issues
- Figma mockups or fallback design docs
- GitHub Actions workflow drafts

Not allowed:
- Implementing Add Trade
- Implementing Dashboard
- Implementing Holdings
- Implementing Cash
- Implementing Settings
- Implementing source-code feature work for V1/V2/V3
- Installing runtime dependencies unless needed only for planning/release documentation
- Triggering real cloud builds

---

🎯 TASK

Split the current large product spec and Codex prompt plan into:

1. Multiple SHIPPABLE product versions: V1, V2, V3
2. Version-specific specs
3. Version-specific Codex prompts
4. GitHub Issues for execution
5. Figma UI mockups, or fallback design docs
6. Testing strategy and setup for each version
7. Android release process and GitHub/EAS build automation plan

The goal is to transform a large “build everything” spec into a phased, realistic, execution-ready roadmap.

---

🌿 BRANCH / PR WORKFLOW

Do not commit directly to main.

Use the Superpowers git/branch workflow if available.

Create a branch:

roadmap/versioned-planning

All generated roadmap, design, testing, release, issue-draft, and prompt files must be committed on this branch.

Open a pull request with:

- Summary of files created
- V1 / V2 / V3 version split summary
- GitHub labels, milestones, and issues created
- Figma links or fallback design docs
- Testing plan summary
- Release process summary
- Any unresolved decisions or conflicts

Do not merge automatically.

If PR creation is unavailable:

- Commit the branch locally.
- Document the exact PR title and body to create manually.

---

📁 CREATE / UPDATE FILES

Create these files:

docs/roadmap/
- cogvest-version-roadmap.md
- v1-mvp-spec.md
- v2-behaviour-spec.md
- v3-polish-and-advanced-spec.md
- v1-codex-prompts.md
- v2-codex-prompts.md
- v3-codex-prompts.md

docs/design/
- v1-ui-mockup-plan.md
- v2-ui-mockup-plan.md
- v3-ui-mockup-plan.md

docs/testing/
- v1-testing-plan.md
- v2-testing-plan.md
- v3-testing-plan.md

docs/release/
- android-release-process.md
- v1-release-checklist.md
- github-actions-drafts.md
- play-store-listing-draft.md
- privacy-policy-notes.md

docs/issues/
- v1-issue-drafts.md
- v2-placeholder-issues.md
- v3-placeholder-issues.md

docs/prompts/
- versioned-roadmap-planning-prompt.md

Do not delete or overwrite:
- docs/cogvest-master-spec.md
- docs/cogvest-codex-prompts.md

Treat the original master spec and original Codex prompts as long-term source-of-truth references.

---

📦 VERSION DEFINITIONS

V1 — Shippable MVP
Target: 2–3 weeks

Include ONLY:

- App foundation
- Add Trade
- Holdings derived from trades
- Basic Dashboard with total value and allocation
- Cash tracking
- Simple Settings
- Value masking
- Conviction input from 1–5
- Basic conviction insight OR “not enough data” state
- Empty states with clear CTAs
- Android preview build process
- Android production build process draft
- V1 release checklist

Exclude from V1:

- Advanced charts
- Historical charts
- Complex asset search
- Patience analysis
- Trade frequency analysis
- Full behaviour engine
- Advanced LTCG multi-lot FIFO logic
- Import/export
- Backend
- Cloud sync
- Authentication
- Push notifications
- Advanced onboarding
- Automatic Play Store submission

---

V2 — Behaviour Layer

Include:

- Improved conviction analytics
- Patience analysis
- Trade frequency analysis
- Behaviour insight cards
- Insight detail screen
- Basic LTCG tracker for Indian stocks/ETFs
- Minimal Mode fully implemented across core screens
- Better onboarding nudges
- More complete settings

---

V3 — Advanced / Polish

Include:

- Historical charts
- Advanced asset search
- Import/export
- Advanced LTCG FIFO multi-lot logic
- Quote caching improvements
- Advanced dashboard widgets
- UI polish and animations
- Optional backup/export flows
- Optional app hardening for release
- Optional Play Store submission automation

---

📄 FOR EACH VERSION SPEC

Each version spec must include:

- Goal
- Target user value
- Included features
- Explicitly excluded features
- Screens included
- Data model changes
- Domain calculations required
- Acceptance criteria
- Test plan
- Manual QA checklist
- Definition of done
- Release gate
- Release/build requirements
- Local data/versioning impact
- Privacy/security notes
- Known risks/deferred decisions

---

⚙️ FOR EACH VERSION CODEX PROMPT FILE

Break work into SMALL issues.

Each issue must:

- Take approximately 1–3 hours
- Be independently testable
- Have clear prerequisites
- List exact files to create/update
- Include acceptance criteria
- Include manual test steps
- Include commands to run:
  - npx tsc --noEmit
  - npx jest
  - npx expo start

Keep prompts concise and implementation-focused.

Do not create vague prompts like:

- “Build dashboard”
- “Implement behaviour engine”
- “Polish UI”

Split UI, domain, store, testing, release, and docs work separately.

---

📌 ISSUE CREATION ORDER

First:

1. Create/update all roadmap/spec/testing/design/release files.
2. Review consistency between those files.
3. Ensure V1 is small enough to ship in 2–3 weeks.
4. Create issue draft markdown files under docs/issues/.

Only after that:

5. Create GitHub labels.
6. Create GitHub milestones.
7. Create GitHub issues.

Issues must map directly to the version-specific Codex prompt files.

Use the Superpowers GitHub/issue workflow if available.

If GitHub issue creation is unavailable:

- Do not fail the task.
- Keep issue drafts in docs/issues/.
- Include exact issue titles, bodies, labels, and milestones so they can be created manually.

---

📌 GITHUB LABELS

Create these labels if they do not already exist:

Version labels:
- v1
- v2
- v3

Area labels:
- frontend
- domain
- store
- infra
- testing
- design
- docs
- release

Type labels:
- feature
- bug
- chore
- refactor

Priority labels:
- priority-high
- priority-medium
- priority-low

---

📌 GITHUB MILESTONES

Create these milestones if they do not already exist:

- CogVest V1 MVP
- CogVest V2 Behaviour
- CogVest V3 Advanced

Milestone descriptions should include:

- version goal
- included scope
- excluded scope
- release gate summary
- release/build expectations
- Figma/mockup link if available

---

📌 GITHUB ISSUES

Create detailed GitHub issues for V1 only.

For V2 and V3:

- Create roadmap/spec/prompt files.
- Create milestone placeholders.
- Create only high-level placeholder issues unless explicitly asked later to create detailed V2/V3 issues.

Reason:

V1 should be executed now. V2/V3 should stay flexible until V1 is validated.

---

### V1 Issue Structure

Title format:

[V1] Short clear task name

Example:

[V1] Implement Add Trade form validation

Issue body format:

## Context
What this issue is solving.

## Scope
Exact things to build.

## Out of Scope
What must NOT be built.

## Technical Notes
- Files to create/update
- Domain functions involved
- Store changes involved
- APIs involved, if any
- Release/build impact, if any

## Design Reference
- Figma link if available
- Fallback design doc if Figma is unavailable
- Relevant screen/state reference

## Acceptance Criteria
- Clear checklist
- Must be testable

## Test Steps
- Manual verification steps

## Commands
- npx tsc --noEmit
- npx jest
- npx expo start

---

### Required V1 Release/Infra Issues

Add V1 GitHub issues for:

- [V1] Configure Android app identity and icons
- [V1] Configure EAS build profiles
- [V1] Add Android preview build workflow
- [V1] Add Android production build workflow draft
- [V1] Create V1 release checklist
- [V1] Verify preview APK on device

Label these:
- v1
- infra
- release
- testing

---

### Issue Rules

- Each issue should take ~1–3 hours.
- Each issue must be independently testable.
- No vague issues.
- No issue should block the entire app.
- Split UI, domain, store, testing, release, and docs work.
- Avoid large multi-feature issues.
- UI issues must link to Figma or fallback design docs.
- Release issues must link to docs/release/android-release-process.md or docs/release/v1-release-checklist.md.
- Do not implement UI without a design reference.

---

📌 OPTIONAL: SUB-ISSUES

Use sub-issues only for large features.

Rules:

- Parent issue = feature-level task
- Sub-issues = implementation-level tasks
- Max depth = 1
- Sub-issues must still be independently testable
- Do not create sub-issues for small tasks
- If a task can be completed in under 3 hours, do not create sub-issues
- Prefer flat issues unless complexity demands grouping

Example:

Parent issue:
[V1] Add Trade Screen

Sub-issues:
- [V1] Add Trade — Form schema and validation
- [V1] Add Trade — Conviction selector
- [V1] Add Trade — Submit and store integration
- [V1] Add Trade — Review state and success feedback

---

🎨 FIGMA UI MOCKUPS

Before implementation starts, generate UI mockups using the official Codex/Figma integration if available.

Create separate Figma pages/files for:

1. CogVest V1 MVP
2. CogVest V2 Behaviour Layer
3. CogVest V3 Advanced / Polish

---

### Figma Design System Requirement

Before screen mockups, create a small design system page with:

- Colours
- Typography
- Spacing
- Card styles
- Buttons
- Badges
- Input fields
- Bottom navigation
- Value masking component
- Conviction selector component
- Empty state component

Use these components consistently across V1/V2/V3 mockups.

---

### V1 Mockups

Include:

- Empty Dashboard
- Filled Dashboard
- Add Trade
- Holdings empty state
- Holdings filled state
- Cash empty state
- Cash filled state
- Settings
- Conviction insight state
- “Not enough data” conviction state
- Value masking state
- V1 release/testing checklist screen or internal QA reference, if useful

---

### V2 Mockups

Include:

- Minimal Mode Dashboard
- Minimal Mode Holdings
- Behaviour Insights
- Insight Detail
- Basic LTCG states
- Patience insight state
- Frequency insight state
- Better onboarding/nudge states

---

### V3 Mockups

Include:

- Historical Charts
- Advanced Asset Search
- Import / Export
- Advanced Dashboard widgets
- Polished Asset Detail
- Advanced LTCG states

---

### Mockup Rules

- Use docs/cogvest_standard_mode.png and docs/cogvest_minimal_mode.png as visual references.
- Android-first mobile frame.
- Dark theme by default.
- Primary accent: #2E7D52.
- Card radius: 12px.
- No coloured shadows.
- Use subtle borders.
- Use realistic INR values.
- Include empty and filled states where relevant.
- Preserve CogVest design language.
- Standard Mode can show richer information density.
- Minimal Mode must reduce noise and emotional triggers.

---

### Figma Output

After creating Figma mockups:

- Add Figma links to docs/roadmap/cogvest-version-roadmap.md.
- Add relevant Figma links to GitHub milestone descriptions.
- Add relevant Figma links to UI-related GitHub issues.

---

### Figma Fallback

If Figma generation fails or the tool is unavailable:

Do not block roadmap work.

Create detailed fallback design docs:

docs/design/v1-ui-mockup-plan.md
docs/design/v2-ui-mockup-plan.md
docs/design/v3-ui-mockup-plan.md

Each fallback design doc must describe:

- Screen layout
- Components
- Spacing
- Interactions
- Empty states
- Filled states
- Error states
- Design tokens
- Manual Figma recreation notes

The fallback docs must be detailed enough to recreate the screens manually in Figma.

---

🧪 TESTING STRATEGY

Define testing approach per version.

---

### Unit Testing

Use:

- Jest
- React Native Testing Library

Test:

- Domain functions
- Store logic
- Formatters
- Validators
- Selectors

Examples:

- calculateHolding()
- calculateAllocation()
- portfolioTotal()
- analyseConviction()
- formatINR()
- trade validation
- Zustand store actions
- value masking logic

Every domain function must have unit tests.

---

### Type Safety

Always run:

- npx tsc --noEmit

It must pass with zero errors.

TypeScript strict mode must remain enabled.

No `any` types unless there is a very clear reason documented in the relevant issue.

---

### Component Testing

Use:

- @testing-library/react-native

Test:

- Screen rendering
- Empty states
- Basic interactions
- Form validation messages
- Value masking display
- Conviction selector behaviour

---

### Expo Router / Navigation Testing

Where useful, add tests for:

- Tab screen rendering
- Route-level smoke tests
- Navigation from Dashboard/Add Trade/Holdings

Use Expo Router testing utilities if the project is configured for them.

---

### Android Runtime Testing

Codex should run:

- npx expo doctor
- npx expo start

Optional if the local environment supports Android SDK/emulator:

- npx expo run:android

Do not block non-Android CI work if the emulator is unavailable.

Document what could not be tested automatically.

---

### E2E Testing

Use Maestro for limited Android E2E coverage.

Create:

e2e/
- add-trade.yaml
- holdings.yaml
- dashboard.yaml
- cash.yaml
- value-masking.yaml

Test only core flows:

- Add a trade
- View holdings
- See dashboard total update
- Add cash
- Toggle value masking

Rules:

- E2E tests are not required for every issue.
- Run E2E before version release.
- Do not over-test visual polish.
- Do not block V1 development on E2E if local emulator setup is unavailable.

---

### Manual Testing

Each version testing plan must include manual checks.

V1 manual checks must include:

- Add Trade flow
- Holdings accuracy after adding trade
- Dashboard total update
- Cash addition/withdrawal
- Value masking toggle
- App restart persistence through MMKV
- Navigation between tabs
- Empty states
- Basic Android device UI check
- Android preview APK install on real device
- No backend/auth/cloud added

---

### Test Scripts

Ensure package.json includes these scripts:

"scripts": {
  "typecheck": "tsc --noEmit",
  "test": "jest",
  "start": "expo start",
  "android": "expo run:android",
  "doctor": "expo doctor"
}

If scripts already exist, preserve them and add missing scripts only.

---

### Testing Rules

- Every issue must run:
  - npm run typecheck
  - npm test
- UI/navigation issues must include component tests where practical.
- Domain issues must include unit tests.
- Release/build issues must include manual verification instructions.
- E2E runs only before release or milestone verification.
- Manual test gaps must be documented.

---

⏱️ LONG-RUNNING COMMAND RULES

Do not leave long-running commands running indefinitely.

For commands like:

- npx expo start
- npm run start
- npx expo run:android

Use them only as smoke checks.

If a command starts a dev server successfully:

- Capture the success output.
- Stop the process.
- Document the result.

Do not wait forever for manual interaction.

---

🤖 CI TESTING BOUNDARY

GitHub Actions should not require an Android emulator for normal PR checks.

Required PR checks:
- Install dependencies
- Typecheck
- Unit tests
- Component tests where applicable
- Expo doctor

Emulator/device testing is manual or release-gate only.

If Android emulator testing is added later, it must be separate from default PR checks.

---

📦 DEPENDENCY RULES

Do not add new runtime dependencies unless required by the approved stack.

Approved stack:

- Expo / React Native
- Expo Router
- TypeScript
- Zustand
- MMKV
- React Native Reanimated
- Victory Native or chosen chart library
- React Hook Form
- Zod
- Jest
- React Native Testing Library
- Maestro for E2E
- EAS CLI / Expo tooling for builds

If a new dependency is needed:

- Document why.
- Prefer existing project dependencies first.
- Do not add analytics, cloud, auth, or backend SDKs.
- Do not add packages that conflict with Expo-managed workflow unless explicitly justified.

---

🚀 ANDROID RELEASE PROCESS

Define a release process for CogVest Android.

The app is Android-first, Expo-based, and local-first.

Create:

docs/release/
- android-release-process.md
- v1-release-checklist.md

Update:

- docs/roadmap/cogvest-version-roadmap.md
- docs/testing/v1-testing-plan.md
- docs/issues/v1-issue-drafts.md

---

### Release Goals

Support three Android build types:

1. Development build

Purpose:
- Local testing during development.

Commands:
- npx expo run:android

Or, if using EAS development build:
- eas build --platform android --profile development

2. Preview / Internal build

Purpose:
- Installable APK for manual testing on real Android devices.

Output:
- APK

Command:
- eas build --platform android --profile preview

3. Production build

Purpose:
- Google Play Store release.

Output:
- AAB

Command:
- eas build --platform android --profile production

---

### EAS Setup

Add or verify:

- eas.json
- app.json or app.config.ts Android config
- Android package name
- app version
- versionCode
- app icon
- adaptive icon
- splash screen
- runtime version / update policy if expo-updates is used

Recommended Android package:

com.abdulshaikh.cogvest

If this package name is already taken or unsuitable, document alternatives.

---

### eas.json Profiles

Create or document these profiles:

development:
- developmentClient: true
- distribution: internal
- Android build type: apk

preview:
- distribution: internal
- Android build type: apk

production:
- distribution: store
- Android build type: app-bundle / AAB

Example structure:

{
  "cli": {
    "version": ">= 13.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "distribution": "store",
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}

---

### GitHub Build Automation

Add GitHub/EAS automation planning.

Preferred approach:

- Use EAS Build for Android builds.
- Use GitHub Actions or EAS Workflows to trigger builds.

Create workflow files if appropriate:

.github/workflows/android-preview.yml
.github/workflows/android-production.yml

If GitHub Actions should not be created yet, create documented workflow drafts under:

docs/release/github-actions-drafts.md

---

### Android Preview Build Workflow

Trigger:

- pull request to main
- manual workflow_dispatch

Steps:

- checkout repo
- setup Node
- install dependencies
- run typecheck
- run tests
- run expo doctor
- trigger EAS preview build for Android

Required secrets:

- EXPO_TOKEN

Command:

- eas build --platform android --profile preview --non-interactive

Output:

- EAS build URL
- APK install URL if available

---

### Android Production Build Workflow

Trigger:

- GitHub release tag like v1.0.0
- manual workflow_dispatch

Steps:

- checkout repo
- setup Node
- install dependencies
- run typecheck
- run tests
- run expo doctor
- trigger EAS production build for Android

Required secrets:

- EXPO_TOKEN

Command:

- eas build --platform android --profile production --non-interactive

Output:

- AAB artifact through EAS Build
- production build URL

Do not auto-submit to Google Play in V1 unless explicitly configured.

---

### Google Play Submission

For V1:

- Do NOT auto-submit by default.
- Build production AAB.
- Manually upload to Google Play Console internal testing track.

For later versions:

- Document optional EAS Submit setup.
- If auto-submit is added later, use EAS Submit and a Google service account.
- Document required secrets separately.

---

### Release Checklist

V1 release checklist must include:

Code quality:
- npm install succeeds
- npm run typecheck passes
- npm test passes
- npx expo doctor passes

Runtime:
- app starts with npx expo start
- Android preview APK installs on real device
- Add Trade works
- Holdings update
- Dashboard total updates
- Cash tracking works
- Value masking works
- MMKV persistence works after app restart

Release config:
- app name is CogVest
- Android package name is set
- versionCode is incremented
- versionName is set
- icon exists
- adaptive icon exists
- splash screen exists
- privacy note exists in docs
- no backend/auth/cloud added

Build:
- preview APK build succeeds
- production AAB build succeeds
- EAS build URLs are recorded

Store readiness:
- Play Console internal testing notes drafted
- basic app description drafted
- screenshots planned or generated
- privacy/data safety notes drafted

---

🔐 SECRETS / ENVIRONMENT RULES

Do not commit secrets.

Never commit:
- EXPO_TOKEN
- Google Play service account JSON
- API keys
- keystores
- passwords
- signing credentials
- local .env files containing secrets

Document required secrets in:

docs/release/android-release-process.md

Use GitHub Actions secrets for CI/CD secrets.

If a secret is required but unavailable:

- Do not block planning work.
- Document the secret name.
- Document where it must be configured.
- Provide manual setup steps.

---

💸 BUILD / CI COST CONTROL

Do not trigger real EAS builds unless explicitly asked.

For this planning task:

- Create EAS config guidance.
- Create workflow drafts.
- Document commands.
- Do not run paid/cloud builds automatically.
- Do not trigger preview or production builds.

For implementation/release issues:

- Run local checks first.
- Trigger preview/production builds only when release gate requires it and the user explicitly approves.

---

🔏 ANDROID SIGNING / CREDENTIALS

Document Android signing strategy.

For V1:

- Prefer Expo-managed credentials through EAS unless explicitly changed.
- Do not generate or commit keystores into the repo.
- Document how credentials are managed.
- Document recovery risk if signing credentials are lost.
- Document where signing credentials are controlled in Expo/EAS.

---

🏪 STORE READINESS DOCS

Create or draft:

docs/release/play-store-listing-draft.md
docs/release/privacy-policy-notes.md

Include:

- App short description
- App long description
- Internal testing release notes
- Data safety notes
- Privacy policy notes
- Statement that financial data is stored locally
- Statement that no login/cloud sync exists in V1
- Statement that quote APIs receive only asset/ticker identifiers
- Draft screenshots requirement
- Draft support/contact note if applicable

---

🏷️ VERSIONING RULES

Document versioning in:

docs/release/android-release-process.md

Use:

- versionName for user-facing app version, e.g. 0.1.0
- versionCode as monotonically increasing Android integer

Before every production build:

- increment versionCode
- update versionName if needed
- document release notes
- tag release consistently, e.g. v0.1.0

---

🧳 LOCAL-FIRST BACKUP RISK

Because CogVest is local-first, document backup/export risk.

V1 may ship without export/import, but docs must clearly mark:

- data is stored on device only
- uninstalling the app may delete data
- clearing app storage may delete data
- export/import is planned for a later version
- users should treat V1 as local-device-only until backup/export exists

---

🚫 NO FAKE IMPLEMENTATIONS

Do not mark work complete with placeholder logic unless the issue explicitly asks for a placeholder.

Avoid:

- Hardcoded portfolio values.
- Fake passing tests that do not verify behavior.
- TODO-only components.
- Mock data in production paths.
- Silently skipped tests.
- Empty files created only to satisfy structure.
- Stubbed services pretending to be complete.

If mock data is used, keep it inside tests, demo fixtures, or clearly named mock files.

If a placeholder is necessary, document:

- Why it exists.
- Where it lives.
- What issue will replace it.

---

♿ ACCESSIBILITY BASICS

All interactive controls must have:

- Accessible labels where appropriate.
- Clear pressed/disabled/loading states.
- Adequate touch target size.
- Readable contrast in dark theme.

Important controls:

- Add Trade button
- Buy/Sell toggle
- Conviction selector
- Value masking eye toggle
- Cash add/withdraw buttons
- Bottom tab items

---

✅ ISSUE DEFINITION OF DONE

An issue is not complete unless:

- Code is implemented.
- Relevant tests are added or updated.
- npm run typecheck passes.
- npm test passes.
- Manual test steps are documented.
- No unrelated files were changed.
- No out-of-scope features were added.
- No fake implementation was used unless explicitly allowed.
- Any skipped/untested areas are documented.

---

🚦 VERSION RELEASE GATES

Each version spec must include a release gate.

---

### V1 Release Gate

V1 has two release gates.

V1 dev-complete cannot be considered done unless:

- npm install succeeds
- npm run typecheck passes
- npm test passes
- npx expo doctor passes
- app launches with npx expo start
- Add Trade works manually
- Holdings update after trade
- Dashboard total updates after holdings/cash changes
- Cash entry updates cash total
- Value masking works
- App data persists after restart
- Android preview APK builds successfully
- Android preview APK installs on real device
- No backend/auth/cloud was added
- Secrets are not committed
- V1 GitHub milestone issues are complete or intentionally deferred with notes

V1 release-candidate cannot be considered done unless:

- V1 dev-complete gate passes
- Android production AAB builds successfully
- EAS production build URL is recorded
- Play Console internal testing upload is ready/manual
- Store listing draft and privacy notes are reviewed

---

### V2 Release Gate

V2 cannot be considered done unless:

- V1 release gate still passes
- Minimal Mode works across all V2-supported screens
- Behaviour insight cards render correctly
- Patience/frequency analysis has unit tests
- Basic LTCG tracker has unit tests
- Insight detail screen is manually tested
- Existing V1 data remains compatible

---

### V3 Release Gate

V3 cannot be considered done unless:

- V1 and V2 gates still pass
- Historical charts load or gracefully fallback
- Import/export works with test files
- Advanced LTCG FIFO logic has comprehensive tests
- Quote caching has tests
- Performance is acceptable on Android
- Data migration risks are documented
- Optional Play Store submission process is documented or configured

---

💾 LOCAL DATA VERSIONING

For each version, document whether the persisted local data shape changes.

If the data model changes:

- Document migration requirements.
- Avoid destructive storage resets.
- Keep persisted raw data backward-compatible where possible.
- Do not persist derived state.
- Document how older local data should behave after app update.

---

🔒 PRIVACY / SECURITY RULES

CogVest stores sensitive financial data locally.

Do not:

- Log portfolio values unnecessarily.
- Log raw trades in console.
- Send user portfolio/trade data to any external service.
- Add analytics SDKs without explicit approval.
- Add crash/reporting SDKs without explicit approval.
- Add backend/cloud/auth functionality.

Quote APIs may receive only ticker/asset identifiers.

Quote APIs must never receive:

- User quantity held
- User trade history
- User portfolio value
- User notes
- Conviction score
- Behaviour metadata

---

🧠 CORE PRODUCT CONSTRAINTS

Preserve:

- Android-first
- Local-first
- No backend
- No auth
- No cloud sync
- INR-first
- TypeScript strict mode
- Functional components with hooks only
- Pure domain functions in src/domain/
- No business logic inside UI components
- Persist raw data only
- Derive everything else
- Behaviour fields are optional
- Minimal Mode never removes core functionality

Do not move advanced features into V1 just because they exist in the master spec.

V1 must remain small enough to ship in 2–3 weeks.

---

📊 OUTPUT

After completing the work, provide:

1. Version summary:
   - What is included in V1
   - What moved to V2
   - What moved to V3

2. Files summary:
   - Roadmap files created
   - Design files created
   - Testing files created
   - Release files created
   - Prompt files created
   - Issue draft files created

3. GitHub structure summary:
   - Labels created
   - Milestones created
   - V1 issues created
   - V2/V3 placeholder issues created, if any
   - Any GitHub operations that could not be completed

4. Figma output:
   - Figma links, OR
   - fallback design docs created

5. Testing summary:
   - Testing strategy per version
   - V1 release gate
   - Automated vs manual testing boundaries

6. Release process summary:
   - EAS profiles created or drafted
   - GitHub workflows created or drafted
   - Android build types defined
   - V1 release checklist created
   - Required secrets documented
   - Signing/credentials approach documented
   - Manual Play Console upload process documented
   - Store readiness docs created

7. Superpowers usage summary:
   - Which Superpowers workflows/tools were used
   - Which were unavailable, if any
   - Fallback actions taken

8. Conflicts / ambiguities:
   - Any contradictions in original spec
   - Any scope risks
   - Any assumptions made

9. PR summary:
   - Branch name
   - Commit summary
   - PR link if created
   - PR title/body if manual creation is required

---

🎯 FINAL GOAL

Enable CogVest to:

- Ship V1 in 2–3 weeks
- Avoid overengineering
- Keep V2/V3 flexible
- Preserve the behavioural investing identity
- Build incrementally without breaking architecture
- Build Android APK/AAB releases safely through EAS/GitHub

Focus on execution, not perfection.

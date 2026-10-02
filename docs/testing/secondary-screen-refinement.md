# Secondary screen refinement

Issue #489, parent #484. Verification date: 2026-10-02.

## Changes

Insight details use the observation title as the screen heading. Supporting values have separate aligned rows and stack below their labels at larger text sizes. Source records remain opt-in; methodology, limitations, missing evidence and Minimal Mode remain visible in their existing states.

Holding duration gives recorded days a prominent line and uses open sections. Unknown ETF classification is still unavailable rather than inferred. Recorded acquisition dates, calendar-month reference, tax limitations and official guidance remain unchanged.

Recovery keeps its warning container and all retained-data wording. Keep data is the first, primary confirmation action; reset has destructive styling. Long affected-area labels wrap and the screen scrolls, so larger text cannot strand its actions. No recovery policy, storage, financial model or calculation changed.

## Environment and APKs

- AVD CogVest_UX_Proof, emulator-5554, API 36, x86_64, density 480.
- Normal: 1280x2856, font scale 1.0. Large: 1080x2400, font scale 1.3.
- Fresh release APK from `npm run android:apk:release -- --architecture=x86_64`.
- Original release SHA-256: `AA44C662A9FC261C9901F02FC92E4BF9B5C712A1B92BA5489EAF798090457A1B`.
- Installed emulator copy SHA-256: `719FAB635FE154040283E5CD04E2934946E405A8DC2005029AD58D0E387D5801`.
- Only the emulator copy was re-signed with its existing Android debug identity for an in-place install. Production signing configuration was unchanged. No data clearing or cloud build.
- Recovery used a fresh debug APK, SHA-256 `7451A4362F25AE76AE44432CCA8C991E17C71D97D85A74DA5A146FB0886D963F`, with Metro serving the changed source. It was not a release-mode recovery test.

The development-only `recovery-qa` route takes a fixed local QA token and passes synthetic props to the real RecoveryScreen. Its reset callback changes only a local counter. It has no store access and never corrupts, quarantines or resets the installed portfolio. Release-mode access is blocked.

## Coverage

`npm run test:v1:pc` covers type checking, Expo checks, 188 passing suites and 1,964 passing tests, Android doctor and strict package smoke. One suite and three tests remain skipped.

Focused tests cover stacked evidence, one observation heading, days recomputed after date correction, unavailable duration without a fabricated day count, recovery scrolling, safe-action ordering, cancellation, explicit confirmation and no-copy gating. Existing tests cover empty holdings, optional-analysis suppression, masking, source corrections/deletions, available observations and external-guidance failure.

Native flows are in `e2e/visual/secondary-screens.yaml` and `secondary-recovery.yaml`. Use `-e SIZE=normal` or `-e SIZE=large` with the display settings above. The screen flow uses the existing synthetic five-asset portfolio, Standard Mode and unmasked values. Its 900-day assertion is fixed to 2026-10-02.

Recovery checks cancellation leaves callback count 0, confirmation makes it 1, and missing recovery copies expose no reset action. Insight/duration checks cover known and unavailable duration, source record HDFC Bank with conviction 4/5, masking, Minimal Mode, invalid insight link and Back/Done. Retained data assertions check quantity 25, average cost INR 1,450, acquisition date 15 April 2024 and Cash INR 50,000.

Both flows passed at normal and large text. The release APK also rejected the recovery fixture route. A transient incomplete normal header frame was recaptured after waiting for animation completion; screenshot steps now include that wait.

## Evidence and limits

Screenshots are in [artifacts/secondary-screen-refinement](artifacts/secondary-screen-refinement). `before-*` captures precede these layout edits; normal/large captures show the new layouts, unavailable/masked/Minimal states, source records and recovery confirmation/no-copy states. Historical evidence elsewhere is unchanged.

Initial debug deep links arrived before Metro finished loading and landed on Dashboard. Repeating after startup passed. A large-text retained-date assertion initially ran without scrolling to the date; the final flow explicitly scrolls before checking it. These were test orchestration corrections, not financial changes.

Empty holding lists and fully populated behavior observations have component coverage, not fresh native captures for every combination. External browser failure has mocked coverage. Recovery screenshots include a synthetic counter and may show a development warning overlay; neither is part of the shipped recovery UI. This pass does not claim native storage-failure injection, physical-phone or TalkBack verification.

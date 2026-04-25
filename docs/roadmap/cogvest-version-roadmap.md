# CogVest Version Roadmap

## Source References

- Master spec: `docs/cogvest-master-spec.md`
- Original full prompt set: `docs/cogvest-codex-prompts.md`
- Planning prompt: `docs/prompts/versioned-roadmap-planning-prompt.md`
- Figma mockups: https://www.figma.com/design/elYeXztRAlYZBSRvlgL23d
- Visual references: `docs/cogvest_standard_mode.png`, `docs/cogvest_minimal_mode.png`

## Version Strategy

CogVest will ship in three product versions instead of one large build. V1 proves the local-first tracker and Android release path. V2 adds the behaviour-aware differentiation. V3 adds advanced market, tax, backup, and polish features after core usage is validated.

## V1: Shippable MVP

Target: 2-3 weeks.

Goal: replace a spreadsheet for day-to-day local portfolio tracking on Android.

Included:
- Expo/React Native foundation with TypeScript strict mode.
- Local MMKV persistence through Zustand.
- Add Trade with buy/sell, quantity, price, date, fees, notes, and optional conviction.
- Live quote fetching for current prices on app open and pull-to-refresh.
- Manual price fallback when quotes fail.
- Holdings derived from trades.
- Basic dashboard with total value, allocation, and quote freshness.
- Cash add/withdraw tracking.
- Simple settings for value masking and app metadata.
- Value masking across INR wealth values.
- Basic conviction insight state: rated-trade count and not-enough-data guidance.
- Android preview APK process and release-candidate production AAB plan.

Excluded:
- Minimal Mode.
- LTCG UI or tax badges.
- Historical charts.
- Advanced asset search.
- Patience and trade-frequency analysis.
- Full behaviour insight engine.
- Import/export.
- Backend, auth, cloud sync, analytics, push notifications.
- Automatic Play Store submission.

Release gates:
- V1 dev-complete: typecheck, tests, Expo doctor, app launch, manual core flows, preview APK build, preview APK install on real Android device.
- V1 release-candidate: production AAB build succeeds, EAS URL recorded, Play Console internal testing upload ready/manual.

## V2: Behaviour Layer

Goal: make CogVest meaningfully behaviour-aware without destabilising the MVP.

Included:
- Improved conviction analytics.
- Patience analysis.
- Trade frequency analysis.
- Behaviour insight cards.
- Insight detail screen.
- Basic LTCG tracker for Indian stocks/ETFs.
- Minimal Mode across core screens.
- Better onboarding nudges.
- More complete settings.

Excluded:
- Historical price charts.
- Advanced search.
- Advanced FIFO lot-level LTCG.
- Import/export.
- Play Store auto-submit.

## V3: Advanced and Polish

Goal: mature CogVest into a robust personal investing system.

Included:
- Historical charts.
- Advanced asset search.
- Import/export and local backup flows.
- Advanced FIFO multi-lot LTCG.
- Quote caching improvements.
- Advanced dashboard widgets.
- UI polish, animation, and performance hardening.
- Optional Play Store submission automation.

## Issue Creation Policy

V1 issues are detailed and execution-ready. V2 and V3 remain flexible through specs, prompt files, milestones, and placeholder issues until V1 is validated.

## GitHub Artifacts

Labels created:
- `v1`, `v2`, `v3`
- `frontend`, `domain`, `store`, `infra`, `testing`, `design`, `docs`, `release`
- `feature`, `bug`, `chore`, `refactor`
- `priority-high`, `priority-medium`, `priority-low`

Milestones created:
- CogVest V1 MVP
- CogVest V2 Behaviour
- CogVest V3 Advanced

Issues created:
- V1 detailed issues: #1-#16
- V2 placeholder issues: #17-#21
- V3 placeholder issues: #22-#26

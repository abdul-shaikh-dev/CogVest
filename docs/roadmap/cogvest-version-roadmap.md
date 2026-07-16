# CogVest Version Roadmap

## Source References

- Master spec: `docs/cogvest-master-spec.md`
- V1 screen baseline: `docs/design/v1-screen-baseline.md`
- V2 behavior contract: `docs/roadmap/v2-behaviour-spec.md`
- V3 advanced contract: `docs/roadmap/v3-polish-and-advanced-spec.md`

## Version Strategy

CogVest will ship in three product versions instead of one large build. V1 proves the local-first tracker and Android release path. V2 adds the behaviour-aware differentiation. V3 adds advanced market, tax, backup, and polish features after core usage is validated.

## V1: Shippable MVP

Goal: replace a spreadsheet for day-to-day local portfolio tracking on Android.

Included:
- Expo/React Native foundation with TypeScript strict mode.
- Local MMKV persistence through Zustand.
- Add Holding with opening position entry, asset metadata, current/manual price, notes, and optional conviction.
- Lightweight asset lookup/autofill for common supported assets, with manual fallback.
- Add Holding search requires explicit user selection before autofill; it must not auto-pick the first result.
- Live quote fetching for current prices on app open and pull-to-refresh.
- Manual price fallback when quotes fail.
- Holdings derived from trades.
- Basic dashboard with total value, invested value, P&L, allocation, and quote freshness.
- Monthly Progress with stored-snapshot views for portfolio value vs invested value and assets vs months, excluding cash from the asset trend.
- Cash add/withdraw tracking.
- Simple settings for value masking and app metadata.
- Value masking across INR wealth values.
- Basic conviction insight state: rated-trade count and not-enough-data guidance.
- Android preview APK process and release-candidate production AAB plan.

Excluded:
- Minimal Mode.
- LTCG UI or tax badges.
- Advanced per-asset market-price history.
- Advanced asset search.
- Patience and trade-frequency analysis.
- Full behaviour insight engine.
- Import/export.
- Backend, auth, cloud sync, analytics, push notifications.
- Automatic Play Store submission.

Release gates:
- V1 dev-complete: typecheck, tests, Expo doctor, Android Emulator app launch, local APK build/install on the emulator, and passing or logged defects for core flows.
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
- Advanced per-asset market-price history.
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

## Execution Tracking

This roadmap defines version boundaries only. GitHub milestones and active
issues own sequencing, status, and task acceptance criteria; do not copy issue
inventories into this document.

# UX-06 Content Hierarchy Evidence

Issue: #355, `Secondary content delays the main work, especially with larger text`

## Environment

- Build: local Android debug APK from `npm run android:apk:emulator`
- Device: Android Emulator `sdk_gphone64_x86_64`, API 36, x86_64
- Standard configuration: 1280 x 2856 at 480 dpi (about 427 dp wide), font scale 1.0
- Large-text configuration: 1080 x 2410 at 480 dpi (360 dp wide), font scale 1.3
- Data: CogVest's local visual-QA fixture plus a locally created PPF account

## Results

- Dashboard: the current-month context now follows the portfolio summary, before allocation and snapshot-support content. At 360 dp and 130% text, the summary and the start of `This Month` remain visible without clipping.
- Holdings: search remains first. Filters use an explicit disclosure beside the list heading, while Portfolio insights remains adjacent and discoverable. At 427 dp and 100% text, four complete fixture holdings are visible. At 360 dp and 130% text, two complete holdings and most of a third are visible; the previous audit baseline showed only one complete holding.
- Holding detail: `View records` and `Sell / redeem` are visible immediately after the value summary, before position metadata and price history, at 360 dp and 130% text.
- PPF detail: `Add entry` and `Import CSV` are visible immediately after the confirmed balance and contribution-capacity summary, before interest and timeline evidence, at 360 dp and 130% text.
- Existing destinations and safety language remain available. No financial calculations, persistence schema, text scaling behavior, or touch-target sizes changed.

## Screenshots

- [Dashboard, 427 dp / 100%](artifacts/ux-06-content-hierarchy/dashboard-427dp-100.png)
- [Dashboard, 360 dp / 130%](artifacts/ux-06-content-hierarchy/dashboard-360dp-130.png)
- [Holdings, 427 dp / 100%](artifacts/ux-06-content-hierarchy/holdings-427dp-100.png)
- [Holdings, 360 dp / 130%](artifacts/ux-06-content-hierarchy/holdings-360dp-130.png)
- [Holding detail, 360 dp / 130%](artifacts/ux-06-content-hierarchy/holding-detail-360dp-130.png)
- [PPF detail, 360 dp / 130%](artifacts/ux-06-content-hierarchy/ppf-detail-360dp-130.png)

## Automated Checks

- Component tests assert Dashboard section order, collapsed filter disclosure and unchanged filter semantics, holding-detail action order, and PPF ledger-action order/callbacks.
- The installed-app Holdings journey asserts the primary detail actions without scrolling.
- The installed-app PPF journey creates and saves an account, asserts the resulting balance, and verifies both ledger actions without scrolling.
- `npm run test:v1:pc`: passed (1,695 tests, Expo doctor, Android doctor, and strict installed-package smoke).
- `npm run maestro:check`: passed with Maestro 2.5.1.
- `e2e/holdings-list-first-layout.yaml`: passed on the freshly installed APK at 360 dp / 130% text.
- `e2e/ppf-account.yaml`: passed on the freshly installed APK at 360 dp / 130% text.

# Audit Hierarchy Evidence

Issue #452. Verified 2026-10-01 using synthetic records only.

## Environment

- Fresh local x86_64 debug APK built with `npm run android:apk:emulator`
  and installed with `adb install -r`; current task JavaScript served by Metro.
- Pixel_10_Pro, emulator-5554, Android API 36, density 480.
- Default: 1280 x 2856, font scale 1.0.
- Narrow: 1080 x 1920 (360 dp), font scale 1.3.
- This is fresh development-native evidence, not standalone preview APK or
  physical-phone certification. Spoken TalkBack output was not tested.

## Checks

`maestro test -e SHOT=default e2e/visual/audit-hierarchy.yaml` and the
`SHOT=narrow` variant passed. They check first-run setup and its actual Add
holdings destination, populated Dashboard, manual/linked Cash rows, month
comparison headings and wealth masking.

Visual inspection identified overly narrow Cash descriptions at enlarged text
sizes. The correction stacks the amount below the description only at adaptive
font scales. Focused narrow flows subsequently passed and recaptured final Cash,
masked Cash, manual correction navigation and unavailable linked-transaction
recovery. Original signed amounts and linked-owner hints remain intact.

`e2e/futures-cash-funding.yaml` passed against the final Cash layout: INR 10,000
contribution, INR 9,000 linked debit, INR 1,000 remaining Cash and 100 USDT
wallet survive restart. A focused linked-review flow opened the owning Futures
wallet and asserted its 100 USDT balance. Default linked-row/review screenshots
were inspected. Original emulator MMKV data was then restored byte-for-byte;
display/font settings were reset and Metro stopped.

Unit coverage checks truly empty versus zero-net portfolios, pending/verified
zero-wallet Futures accounts, retained unsupported-currency warnings, manual
Cash review affordances, signed/masked month values and missing calendar-month
comparisons. No financial calculation, persistence schema or migration changed.

`npm run test:v1:pc` passed: 1,890 tests / 180 suites, TypeScript, Expo 17/17,
Android readiness and strict installed-package smoke.

## Screenshots

Synthetic historical fixtures retain their original labels; they are not a new
salary collection feature. Screenshots are in `artifacts/audit-hierarchy/`.

- `default/first-run.png`: setup before zero-value summaries.
- `default/populated-dashboard.png`: populated information and quote warnings.
- `default/month-detail.png`: shared dates, previous/current INR, signed changes.
- `default/linked-cash.png`: final signed manual/linked rows and review chevrons.
- `default/linked-review.png`: valid owner review destination.
- `narrow/first-run.png`: primary and secondary setup actions at enlarged text.
- `narrow/cash.png`: final full-width descriptions and trailing amounts.
- `narrow/masked-cash.png`: final masked amounts and linked correction guidance.
- `narrow/month-detail.png`: enlarged comparison columns.
- `narrow/masked-month-detail.png`: both wealth columns masked, dates retained.
- `narrow/manual-review.png`: manual correction destination.
- `narrow/linked-unavailable.png`: read-only recovery for a missing owner.

No private portfolio, statement, emulator archive or credentials are published.

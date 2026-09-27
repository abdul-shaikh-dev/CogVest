# UX tracker integration evidence - 27 September 2026

## Decision

Tracker #401 must remain open. Its 14 original children are merged/closed, but
fresh integration inspection found [#429](https://github.com/abdul-shaikh-dev/CogVest/issues/429):
Progress's mask action clips at 360dp / 130% text. Passing element-presence
assertions did not prove that the whole control was inside the screen.

This evidence PR changes test flows and documentation only. It does not fix #429
or change financial calculations, persistence, historical snapshots or releases.

## Installed build and environment

- Source: merged main `1d5c4f54f5c905aa11b4f17f17cd6f9658769144` (#428).
- Fresh local build: `EXPO_OFFLINE=1 npm run android:apk:emulator`; Gradle succeeded,
  followed by `adb install -r` success on the disposable emulator.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`.
- SHA256: `D383C9506E2FEC2CAB6A6A60EBA5D9098DADF61DED478932DE63544E13CE3F2A`.
- Build mode: native debug APK with current JavaScript from restarted offline Metro.
  This is not standalone release-bundle or EAS-preview verification.
- AVD: Pixel_10_Pro, emulator-5554, Android 16 / API 36, x86_64, portrait.
- Normal: 1280x2856 / 480dpi, approximately 427dp, font scale 1.0.
- Enlarged: 1080x2400 / 480dpi, 360dp, font scale 1.3.
- Synthetic data only; primary flow clears emulator app state and requests explicit
  visual-QA seed replacement. No user's phone or private statement was modified.

## Capture matrix

`e2e/visual/final-primary-tabs.yaml` passed in both configurations: all five tabs
empty, populated and masked (30 screenshots). Masking assertions retain visible
signed percentages while hiding portfolio amounts; Settings switch state is checked.

`e2e/visual/final-secondary-screens.yaml` passed in both configurations (36
screenshots): holding detail, records, duration, correction, Manage Assets,
backup disclosure, insight, Add Holding discovery/review, quick setup, holdings
CSV import, Tradebook source/expanded guide, CAS source/password, transaction CSV
source, PPF missing-account guard and Monthly History.

These are screen-entry captures, not proof of every control, off-screen section
or complete financial journey. Selected screenshots were visually inspected;
capture success alone is not labelled a visual pass.

| Inspected evidence | Observation |
| --- | --- |
| [Normal holding detail](artifacts/2026-09-27-ux-closeout/default/holding-detail.png) | Quote age, signed P&L, correction/sale actions and 25 units at INR 1,450 are readable. |
| [Enlarged holdings](artifacts/2026-09-27-ux-closeout/narrow/populated-holdings.png) | Invested, P&L and weight form a distinct numeric hierarchy; signed returns remain visible. |
| [Normal history](artifacts/2026-09-27-ux-closeout/default/monthly-history.png), [enlarged history](artifacts/2026-09-27-ux-closeout/narrow/monthly-history.png) | Compact month/value/monthly-change table; no repeated comparison sentences. |
| [Enlarged Progress](artifacts/2026-09-27-ux-closeout/narrow/populated-progress.png) | Mask action clips on the right: #429. |
| [Enlarged masked Dashboard](artifacts/2026-09-27-ux-closeout/narrow/masked-dashboard.png) | Amounts masked, signed percentage visible; actions fit. |
| [Enlarged Settings](artifacts/2026-09-27-ux-closeout/narrow/empty-settings.png) | Native switch, radio choices and disclosure controls are distinguishable. |
| [Enlarged backup](artifacts/2026-09-27-ux-closeout/narrow/backup.png) | Unencrypted-file and document-provider warnings remain readable. |
| [Enlarged discovery](artifacts/2026-09-27-ux-closeout/narrow/add-holding.png), [review](artifacts/2026-09-27-ux-closeout/narrow/holding-review.png) | Compact discovery and explicit position/cash-impact review remain readable. |
| [Normal CAS password](artifacts/2026-09-27-ux-closeout/default/cas-password.png) | Detailed-statement/password privacy guidance remains present. Keyboard is not open in this matrix capture. |
| [Enlarged CAS keyboard](artifacts/2026-09-27-ux-closeout/narrow/cas-password-keyboard.png) | Password input and label are fully above the keyboard; synthetic text is obscured. |

The seeded Progress banner says "Waiting for the first month-end" beside stored
history. `ProgressScreen` deliberately bypasses automation while
`isVisualQaSessionActive()` is true, leaving initial automation status unchanged.
This fixture inconsistency is not evidence of a production import failure.
The synthetic sample fund's old classification is also fixture data, not a fresh
CAS-classification result.

## Automated checks

- `npm run test:v1:pc`: typecheck, 167 suites / 1,767 tests, Expo Doctor 17/17,
  Android Doctor and strict installed-package smoke passed. Existing skips:
  one suite and three tests.
- First run concurrent with native build had two five-second test timeouts.
  The subsequent full run passed without changing tests, assertions or timeouts.
- Both matrix flows passed after fixing a test-only review deep link: leave the
  already-mounted Add Holding form before re-entering its synthetic review state.
- Final artifact review caught a primary-flow race: the first masked Cash image
  still showed Progress because the amount-mask assertion matched both screens.
  Destination-specific screen assertions were added before masked captures and
  both primary matrices were rerun; replacement images are the committed evidence.
- `e2e/standalone/cas-password-focus.yaml` passed at 360dp / 130%, including typing,
  reopening the keyboard and returning to Dashboard.

The first enlarged-text journey batch stopped at off-screen controls in manual
entry, bulk-delete review, cash ledger amounts and the full-exit gain assertion.
The sale flow had already asserted 0 units, 0 basis and INR 2,990 cash. Those
stops are incomplete journey tests, not financial assertion failures. Relevant
flows now scroll to their original controls/amount assertions; no numeric
expectations were relaxed. PPF's old Back expectation stopped at the correctly
displayed unsaved-changes guard. Its flow now explicitly checks Keep editing,
retained notes and Discard changes rather than silently discarding edits.

Successful normal-size reruns on the same fresh installed build:

| Flow | Result asserted |
| --- | --- |
| `add-holding-manual-semantics.yaml` | One saved position: 2 units, INR 1,200 average, INR 2,400 invested, INR 2,600 current, INR 1,300 manual price; unknown date and retained note. |
| `discovery/core-accounting.yaml` | In-memory QA: partial sale leaves 16 units / INR 1,208 basis / INR 595 cash / INR 293 gain; full exit leaves 0 units / 0 basis / INR 2,990 cash / INR 1,187 gain after fees. |
| `bulk-transaction-delete.yaml` | In-memory QA: preview Back/cancel retains selection; explicit deletion leaves 10 units / INR 500 basis / zero cash. [Preview](artifacts/2026-09-27-ux-closeout/default/bulk-delete-preview.png). |
| `cash-entry-focus.yaml` | Persisted INR 1,000 deposit and INR 250 withdrawal, INR 750 cash, exactly two entries; cancelled draft does not save. |
| `ppf-account.yaml` | Saved INR 100,000 account; review/Edit retains note, Back opens discard guard, Keep editing retains draft, explicit discard preserves the balance; account reopens from Holdings. |

These repaired flows were not all rerun at enlarged text. Do not convert their
normal-size successes into a blanket 360dp/130% journey signoff.

## Coverage boundaries

This integration capture supplements, rather than rewrites, child-issue evidence.
The [26 September Progress report](2026-09-26-progress-hierarchy.md) covers chart
gaps, 120 months, masked/Minimal modes and service-level TalkBack focus. The
[backup report](2026-09-26-backup-navigation.md) covers real picker roundtrip,
invalid/cancel states and Android/header/gesture Back. The
[discovery report](2026-09-26-add-holding-discovery.md) covers provider/fallback and
saved manual-position assertions. Those are dated prior checks, not repeated
release tests today.

Not completed by this screen matrix: all expanded CAS/CSV/PPF source guidance,
actual six-Tradebook or multi-folio private CAS reimport, full backup roundtrip,
all destructive correction states, every secondary masked state, 200% text,
switch access, foldables, actual spoken TalkBack output, provider failure
injection, or release-mode performance. Touch-target/accessibility source and
earlier child evidence do not replace those manual checks. Performance budgets
are unchanged. No cloud build, tag, release or Play submission was triggered.

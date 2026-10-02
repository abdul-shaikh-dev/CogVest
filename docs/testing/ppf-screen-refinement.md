# PPF screen refinement

Issue #487, parent #484. Verification date: 2026-10-02.

## Scope

The existing confirmed balance, ledger date, interest uncertainty and capacity caveats remain visible. Contribution metrics and account/entry forms now use open sections. Large-text ledger, interest and review rows stack their labels and amounts. Optional entry notes keep their existing disclosure and draft retention.

The import form starts with file selection rather than repeated account identity. The opening-balance warning stays beside its inputs. Review shows parsed entries, repeated rows, blocking issues and the imported closing balance. Counts are not presented as additive imports: the existing checkpoint/history replacement contract is unchanged. Unsupported rows still block the whole import; repeated rows still require confirmation.

No financial calculation, persistence, schema, import format, account limit or masking rule changed.

## Environment

- AVD CogVest_UX_Proof, emulator-5554, Android API 36, x86_64.
- Normal: 1280x2856, density 480, font scale 1.0.
- Large text: 1080x2400, density 480, font scale 1.3.
- Fresh bundled release APK from `npm run android:apk:release -- --architecture=x86_64`.
- Built APK SHA-256: `76813C3B15F8A535A9B72A81DFC1C5A5E81365261993278DB8D1379E3ED4421D`.
- Installed local QA copy SHA-256: `350302E6D03E64D414710A06433BD42FA7D314150F3287792C9178F69C9C4528`.
- The QA copy uses the local Android QA signature for an in-place install. No app data clearing, cloud build or production signing change.

## Automated coverage

`npm run test:v1:pc` passed: 187 suites, 1,958 tests; one suite and three tests skipped. Type checking, Expo doctor and strict Android smoke passed.

New regression tests verify repeated-row counts and their non-deduplicated closing balance, unsupported-row blocking with no fabricated closing value, preview cancellation without mutation, exact imported entry fields and an unrelated PPF account preserved. Existing tests cover invalid fields, masking/reveal, notes retained through review/disclosure, draft protection, stale import rejection and picker failures.

## Fresh APK journeys

The following Maestro flows passed on the installed APK above:

- `e2e/visual/ppf-entry-corrections.yaml`: empty account, invalid zero amount, keyboard-visible note, save INR 500, edit to INR 1,000, restart persistence, cancel deletion and confirm deletion. The balance moves from INR 100,000 to 100,500 to 101,000 and back to 100,000. Cash stays INR 50,000.
- `e2e/visual/ppf-import-review.yaml`: unsupported loan row and mismatched closing balance block saving. The valid three-row import produces INR 100,450, with contribution, official interest and withdrawal visible after restart. Cash stays unchanged.
- `e2e/visual/ppf-large-review.yaml`: large-text entry review, same-file reimport, replacement warning, cancellation, masking and explicit form reveal. Cancelling a changed opening checkpoint leaves the recorded INR 100,450 balance intact.
- `e2e/visual/ppf-cleanup.yaml`: long nickname draft survives Keep editing, Discard changes restores the original nickname, and Keep account cancels deletion. Final deletion removes only the task-created account. The original five assets, INR 50,000 cash and HDFC opening quantity 25 remain unchanged.

After testing, the temporary account and two staged CSVs were removed. Display/font settings returned to 1280x2856/1.0, handwriting settings returned to unset, and masking returned to off. A final strict Android smoke check passed.

The large-text flow initially stopped at an off-screen balance assertion. Adding an explicit upward scroll fixed the test; no app change was needed.

### Reproduction setup

Use a disposable synthetic emulator portfolio, not a personal portfolio. Create `UX PPF Review`, provider `India Post`, opening FY 2026, with an INR 100,000 balance dated 2026-10-01. The recorded run used 2026-10-02 as today. Dates are fixed; reproducing on a later date requires checking the completeness date and estimated-interest differences.

Stage `e2e/fixtures/ppf-valid.csv` and `ppf-invalid.csv` in `/sdcard/Download/` using `adb push`. Run the entry flow first. Open the account's Import CSV picker before the import flow, which deliberately begins in that native picker. Run the large-text flow after the successful import. The cleanup flow expects this task-created account and the synthetic baseline of five assets, INR 50,000 cash and HDFC opening quantity 25 with ID `visual-qa-opening-hdfc`. It is not a general-purpose cleanup script.

### Visual evidence

Screenshots are under [artifacts/ppf-screen-refinement](artifacts/ppf-screen-refinement).

- Before: `before-account.png`, `before-entry.png`, `before-import.png`, `before-form.png`.
- Normal: `normal/account.png`, `normal/account-form.png`, `normal/entry.png`, `normal/entry-keyboard.png`, `normal/import-form.png`, `normal/import-result.png`, `normal/import-rows.png`.
- Failure and destructive states: `normal/invalid-entry.png`, `normal/import-unsupported.png`, `normal/import-conflict.png`, `normal/delete-account.png`.
- Large text: `large/account.png`, `large/entry-review.png`, `large/import-result.png`, `large/replacement.png`, `large/masked-account.png`, `large/account-form.png`.

## Verification limits

Physical-phone and TalkBack verification are not claimed. Failure paths that require injected storage/provider errors are covered by automated tests rather than native fault injection. Synthetic test dates and balances are fixed fixtures, not financial recommendations or live provider data.

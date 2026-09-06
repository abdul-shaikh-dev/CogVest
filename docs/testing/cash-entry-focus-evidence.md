# Focused Cash Entry: UX-12 / #284

Base: `d888b14`. Branch: `fix/cash-entry-focus`.

## Contract

Cash Ledger keeps balance, Deposit/Withdraw actions, monthly evidence and the
ledger. Entry uses a full-screen native modal with amount, full-width date,
label, optional notes and an explicitly named save action. Deposit retains
Contribution/Income; withdrawals retain their existing cash-pool meaning.

Cancel and Android Back close without recording anything. Reopening the same
type retains the local in-memory draft. Opposite-type entry requires explicit
discard when a draft exists. This is not durable recovery after process death.
Saving blocks duplicate save/close; a persistence failure retains inputs for
retry. No domain calculations, store schema or linked cash semantics changed.
With the keyboard visible, Android Back dismisses it first and retains the panel.
Only a subsequent Back with the keyboard hidden closes entry.

Missing income and investment rate use compact unavailable markers plus one
dependency explanation. A positive-income legacy-classification gap is not
misrepresented as zero income. Linked entries remain corrected through their
source investment transaction, not this manual-entry panel.

## Repeatable Verification

- Run `npm run test:v1:pc` for component/domain, typecheck, Expo and Android checks.
- Build/install locally following `docs/release/android-release-process.md`.
  Debug APK verification requires Metro serving this branch; do not claim a
  standalone release or test an older installed package.
- Run `npm run maestro:test -- e2e/cash-entry-focus.yaml e2e/cash.yaml` on
  synthetic emulator data. Both reset app data. The focus journey checks cancel,
  resume, switching confirmation, Android Back, deposit/withdraw and the resulting
  INR 750 balance with exactly two saved cash entries. The existing cash journey
  covers double-save and correction/deletion.
- Repeat focus at 360dp width and 130% font scale. Enable an actual docked keyboard
  and inspect screenshots, not just a floating IME toolbar. The setup/restoration
  commands are documented in `add-holding-review-evidence.md`.
- Preserve original screen size, font scale and keyboard preferences afterward.

## Verification Record

- Final `npm run test:v1:pc`: passed, 97 suites / 999 tests, Expo doctor 17/17,
  typecheck, Android doctor and strict installed-package smoke. Cash component
  suite: 19 tests, including the native-discovered keyboard-first Back regression.
- Fresh local debug APK built, then installed on `emulator-5554` at 17:26 on
  2026-09-06. SHA256:
  `AC6D159045E3AEBDF9EEC43F303D445009109EFBAFCEFD7B8F4AB3C2FF2A2F7A`.
  This native-shell hash is unchanged for JS-only edits; current branch Metro
  served the implemented and corrected UI.
- Default-width focus journey passed, with docked-keyboard Save, draft retention,
  discard protection, withdrawal Back/resume, INR 750 balance and two saved entries.
- Independent Terra static review found no remaining task-caused production
  findings. Impeccable simplification guidance informed the resting/entry split,
  flattened form and single unavailable-data explanation.
- Existing correction journey passed after emulator reboot: calendar date,
  double-save protection, review and confirmed deletion to an empty ledger.
- 360dp / 130% text focus journey passed with the same two-entry INR 750 result.
  Docked-keyboard Save, full-width date, draft resume and readable controls were
  visually inspected. Final Maestro flow-inventory test passed after YAML edits.
- Original 1280x2856 size, 480 density, 1.0 text scale and keyboard settings restored.

## Screenshots

- [Resting ledger](artifacts/cash-entry-focus/ux12-cash-resting.png)
- [Docked keyboard and Save](artifacts/cash-entry-focus/ux12-cash-keyboard.png)
- [Withdrawal entry](artifacts/cash-entry-focus/ux12-cash-withdraw.png)
- [Resulting ledger](artifacts/cash-entry-focus/ux12-cash-ledger.png)
- [Enlarged resting screen](artifacts/cash-entry-focus/enlarged-resting.png)
- [Enlarged keyboard and Save](artifacts/cash-entry-focus/enlarged-keyboard.png)
- [Enlarged withdrawal](artifacts/cash-entry-focus/enlarged-withdraw.png)

## Investigation And Limits

Expo prebuild spent several minutes enumerating its template files. The offline
retry eventually completed; a direct Gradle fallback overlapped that late retry
and caused a task-induced CMake directory conflict. Both exited; a single serial
Gradle rerun succeeded in 58 seconds. No native config or dependencies changed.
Prebuild's unrelated generated iOS script was removed.

The first native launch timed out during Metro's 28-second cold bundle. Subsequent
runs used the completed bundle. Native testing then caught Back dismissing the
panel with the keyboard open; the app was corrected rather than weakening the test.
One gate hit the pre-existing MonthlyHistoryPanel Jest teardown timeout despite
all assertions passing; the subsequent complete gate exited successfully.

Later emulator runs intermittently ignored navigation and captured a black app
surface even outside Cash entry. App restart alone did not recover it; an emulator
reboot did, and the unchanged correction path then passed. The correction test
now targets the actionable row label rather than helper text, waits for scrolling
to settle, and uses bounded no-change retries without removing data assertions.

No EAS build, standalone release, physical-phone or full TalkBack certification
is claimed. Synthetic app data only; no user financial files were loaded.

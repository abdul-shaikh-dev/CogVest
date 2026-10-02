# Deeper UX tracker closeout

Tracker #484, checked 2026-10-02. Final pass starts from merged main `484b564` and includes the narrow search-prompt follow-up #497. No new financial feature, schema, persistence rule, dependency or release configuration is introduced.

## Child evidence

| Issue | Merged PR | Verification record |
| --- | --- | --- |
| #485 Transaction history and bulk deletion | #492 | [Transaction history](transaction-history-layout.md) |
| #486 Snapshot correction and asset management | #493 | [Correction screens](correction-screens.md) |
| #487 PPF account, entry and import | #494 | [PPF screens](ppf-screen-refinement.md) |
| #488 USDT Futures wallet and activity | #495 | [Futures screens](futures-screen-refinement.md) |
| #489 Insights, duration and recovery | #496 | [Secondary screens](secondary-screen-refinement.md) |
| #490 Monthly History vs invested | #491 | [Historical invested comparison](history-invested-comparison.md) |

Each record identifies its fresh APK and emulator configuration, before/after evidence, data assertions and exact limits. These files are historical records of their individual runs and have not been rewritten for this closeout.

## Final APK

- AVD CogVest_UX_Proof, emulator-5554, Android API 36, x86_64, density 480.
- Normal: 1280x2856, font scale 1.0. Large: 1080x2400, font scale 1.3.
- Fresh local bundled release APK from `npm run android:apk:release -- --architecture=x86_64`.
- Original SHA-256: `3091A73B9447B8D5324859A9F7A2A50C16D8A99AA869E896FDC57F24269B5E07`.
- Installed local emulator copy SHA-256: `5FDEDA8BF28F874EF434A61FA6AD2469022DA154A003B61B45DADF3D576A1801`.
- The emulator-only copy uses its existing debug signing identity for `adb install -r`. No uninstall, app-data clearing, cloud build, tag or public release.

## Consistency checks

The final journey is `e2e/visual/ux-tracker-consistency.yaml`, using `-e SIZE=normal` or `-e SIZE=large`. It uses the existing synthetic five-asset dataset, not personal imported records. It does not save or delete financial records.

The pass covers Dashboard, Holdings, Manage Assets and asset review, transaction history, Cash and draft confirmation, Settings, the empty Futures wallet and Progress. It checks cross-screen masking, search/filter/clear, Back/cancel navigation, keyboard-visible notes, draft retention, Keep draft, discard, and restart. Retained values are five assets, HDFC quantity 25 and Cash INR 50,000. Historical comparison is checked separately with `e2e/visual/history-invested-comparison.yaml` on the same installed APK.

The only new correction from the review is #497. Manage Assets now uses `Search assets` instead of listing every searchable identifier inside a single-line placeholder. The accessible label and no-results guidance remain. Tests still match name, symbol, ticker, ISIN and exchange, clear the query, and assert the asset array was not changed. The earlier clipped prompt is visible in [the #486 large-text evidence](artifacts/correction-screens/large/assets.png).

Final screenshots are in [artifacts/ux-tracker-closeout](artifacts/ux-tracker-closeout).

The final consistency flow passed at both display configurations. `npm run test:v1:pc` passed with 188 suites and 1,964 tests, one suite and three tests skipped, all 17 Expo checks, Android doctor and strict smoke. The only flow correction was an explicit scroll to the asset editor's Cancel action; no app behavior was changed to accommodate the test.

Visual inspection confirmed that normal financial rows align, large-text identities and labels wrap, the shorter search prompt fits, masking carries between tabs, and active search/note fields stay above the keyboard. Confirmation panels retain their consequences and distinct Keep/Discard actions. Warnings for stale/manual prices and estimated snapshots remain visible. No further blocking layout or navigation defect was found in this pass.

Monthly History passed at both sizes on the final APK. For April 2026 it retains INR 1,929,450 portfolio value, INR 1,618,000 excluding cash, INR 1,676,000 invested basis, INR -58,000 difference and -3.46% vs invested. The separate month-to-month portfolio change remains +7.79%. Masking hides these amounts and the historical comparison; Back returns to the same month row.

After testing, display/font returned to 1280x2856/1.0, handwriting settings returned to their original unset state, masking returned to off and the original Minimal Mode preference was restored and checked after restart. Metro stopped and its adb reverse mapping was removed. Five original assets and Cash INR 50,000 remained; no task-created PPF or Futures account remains from the child verification runs.

## Scope limits

This is a targeted final consistency pass, not a new exhaustive product audit or benchmark. Financial save/delete and failure-path assertions are recorded in the child evidence; they are not all repeated in this read-only final pass. Sampled native retained-value assertions do not prove byte-for-byte preservation of every stored record. Component/store tests cover exact objects and unrelated-record preservation.

Recovery uses the isolated debug fixture documented under #489, not native corruption of an installed portfolio. Empty holding-duration and fully populated insight combinations have component coverage rather than a screenshot of every permutation. No physical-phone, TalkBack, encryption, provider-reliability or chart-performance claim is made. #299, #218, #247 and the broader #138 roadmap remain separate from this UX tracker.

# Remaining appearance checks

Related to #537 and PR #538. Source under test: `50b2fb6`. Production code was
unchanged during this verification pass. This extends the October 4 reports;
it does not turn blocked checks into passes.

## Build and environment

A fresh x86_64 debug APK was built and installed without clearing the existing
synthetic portfolio. SHA256:
`AF207016F3D25D2CE8E19E7DCA0374405EF981E7F12A4CBA00EA7972CBBD9E95`.
The artifact is byte-identical to the preceding build because native source is
unchanged. Local Metro served the branch's JavaScript.

AVD CogVest_UX_Proof, emulator-5554, API 36, 1280x2856, 480 dpi. Font scales
1.0 and 1.3. Initial checks used reduced motion. Later editor checks used Android
animation scales 1.0 to avoid the debug-only reduced-motion warning banner
covering controls. This is not a performance comparison or physical-phone test.

`npm run test:v1:pc` passed: 195 suites, 2,058 tests, one suite and three tests
skipped. Expo doctor passed 17/17 and strict installed-package smoke passed.

## Results

Evidence is in [the screenshot directory](artifacts/2026-10-05-appearance-checks/).
Directory names identify theme, display mode and font scale.

| Check | Result |
| --- | --- |
| Dark/Light, Standard/Minimal, normal text | Dashboard, Holdings, Progress and Cash inspected |
| Dark/Light, Standard/Minimal, cold-started 130% text | Same screen families inspected; no live-transition clipping in settled layouts |
| Wealth masking | Amounts hidden and percentages retained on Dashboard/Holdings in each matrix combination |
| Manual Light with Android Dark | Process restart retained Light and the selected preference |
| Manual Dark with Android Light | Process restart retained Dark and the selected preference |
| Follow system restart | Settled Light and Dark dashboards inspected; preference retained. Dark rerun passed after emulator recovery |
| Recovery, preserved copy and no preserved copy | Isolated fixture exercised in both themes; confirmation callbacks tested without resetting storage |
| Asset/opening/cash editors | Both themes inspected, including cash removal confirmation; no changes saved |
| Snapshot validation | Invalid total rejected in both themes; form cancelled without saving |
| Unavailable insight | Both themes inspected |
| Populated trade editor | Quantity 2, price 100, fee 5, total INR 205 asserted; context and removal confirmation inspected in both themes |
| Populated futures | Wallet 999 USDT, BTCUSDT long, execution correction, funding form, valuation form and wallet removal confirmation inspected in both themes |

The temporary purchase was removed through its paired cleanup flow. Cash
returned from INR 49,795 to INR 50,000; the original opening quantity remained
25 and the transaction list returned to empty. Futures checks used a separate
temporary wallet without a linked Cash movement.
Final data assertions passed after emulator reboot: five assets, four opening
positions, zero trades, four Cash entries, zero PPF accounts, no Futures wallet,
INR 12,37,551.60 invested and INR 50,000 cash. The reboot did not clear app data.

The main matrix screenshots are matched Light/Dark views of the same synthetic
records. They are not matched pre-change pitch-black screenshots. Historical
pre-change captures remain unchanged and have different quote values.

## Contrast samples

Solid foreground/background colors were counted in the actual PNGs, sampled at
every second pixel, then measured with the WCAG sRGB luminance formula. These
measurements cover the observed Dashboard/Cash text and snapshot error pairings,
not every antialiased edge or disabled/transient state.

| Observed pairing on screen background | Dark | Light |
| --- | ---: | ---: |
| Primary text | 15.69:1 | 14.78:1 |
| Secondary text | 8.50:1 | 5.96:1 |
| Positive values | 9.84:1 | 6.04:1 |
| Negative values / validation error | 7.25:1 | 6.06:1 |

For example, Cash captures contain 1,326 sampled exact loss-color pixels in each
theme. Snapshot-error captures contain 3,268. Missing warning-color samples were
not reported as rendered contrast passes. Automated palette tests separately
cover warning colors, selected/card/input surfaces, action labels and boundaries.

## Failures and remaining limits

1. Live 100%-to-130% font changes still reproduce #529. Accessibility text
   assertions pass while visible labels clip. The failed visual state is retained
   as [live-font-transition-529.png](artifacts/2026-10-05-appearance-checks/live-font-transition-529.png).
   Cold-started large-text checks are separate. No dependency workaround or
   fix for #529 is included here.
2. Local release startup remains blocked. The release build correctly rejected
   missing `COGVEST_RELEASE_STORE_FILE`, `COGVEST_RELEASE_STORE_PASSWORD`,
   `COGVEST_RELEASE_KEY_ALIAS` and `COGVEST_RELEASE_KEY_PASSWORD`. The repository
   forbids substituting debug signing. No cloud build, signing-policy change or
   release was performed. Debug restart evidence cannot establish a flash-free
   release splash.
3. Original matched pitch-black-versus-approved preview publication remains
   outstanding. The user's option 2/3 approval is recorded in the prior report;
   the historical screenshots are not misrepresented as a matched comparison.
4. Populated PPF review is not verified. Repeated provider-text injection did
   not survive keyboard dismissal/validation, so account creation stopped before
   saving. The diagnostic `appearance-ppf.yaml` retains the failing assertion.
   This does not establish whether the cause is input automation or the app.
   No PPF account was created during these attempts.

Some initial Settings screenshots captured the previous radio paint immediately
after selection; the following screens used the requested mode. The reusable
configuration flow now asserts the checked state and waits before capture.
Use restart and later editor Settings captures for selected-control evidence.
Debug warning overlays caused early tap failures. An older trade-context flow
also failed to establish its typed note; it is not counted as a draft-retention
pass. The dedicated appearance flow reviews the editor without modifying notes.
The first Light futures masking capture also preceded the visible mask paint.
Its accessibility assertion alone is not accepted as visual masking evidence.
The Dark capture is masked; the Light recapture remains outstanding. A repeated
fixture setup stalled before saving and was cancelled rather than left running.
The emulator later rendered a blank app surface. A process restart did not
recover it; an emulator reboot did. No JavaScript exception appeared in the
captured log. This observation is not assigned a production root cause.

Keep #537 open and PR #538 in draft while the remaining acceptance above is
unresolved. There is no TalkBack, outdoor-readability or all-error-permutation
claim. Earlier native-calendar and unsaved Cash draft evidence remains in the
October 4 reports.

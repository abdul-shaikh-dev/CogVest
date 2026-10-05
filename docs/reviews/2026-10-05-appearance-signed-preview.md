# Signed appearance preview verification

Related to #537 and draft PR #538. This supplements, rather than rewrites, the
earlier October 4/5 debug-build evidence.

[Screenshots and startup recordings](artifacts/2026-10-05-appearance-signed-preview/)
contain only the synthetic test session.

## Artifact and environment

- [GitHub workflow](https://github.com/abdul-shaikh-dev/CogVest/actions/runs/37287032535)
  succeeded for `70e4518d225c7516d8ccada671c921df3f3eaee7`.
- [EAS build](https://expo.dev/accounts/abdul_shaikh_dev/projects/cogvest/builds/3d12a882-44a1-4a7f-897e-82134428d08b)
  is the Android internal-distribution `preview` build.
- APK version 1.0.21, versionCode 22, package `com.abdulshaikh.cogvest`.
- APK SHA256: `38CEC1920124ECDA078FD00D068B514D809F63332468EE821B47F274641F24EB`.
- `apksigner verify` passed. Installed package flags do not contain `DEBUGGABLE`.
  The app ran without Metro or an ADB reverse connection.
- CI passed typecheck, 195 test suites / 2,058 tests and Expo doctor 17/17.
  One suite and three tests were skipped, as in the preceding local gate.

The existing emulator installations were not removed or cleared. Their debug
signatures are incompatible with this signed APK. The test session used
Pixel_10_Pro, emulator-5556, with a new task-local userdata image, read-only AVD
mode and snapshots disabled. The original emulator-5554 remained separate.
Installed Android image: API 36.1 Google Play x86_64; display 1280x2856 at 480 dpi;
font scale 1.0; normal Android animations. Headless software graphics used
SwiftShader because the first headless graphics startup stalled. This is not
performance or physical-phone evidence.

## Completed checks

### PPF

Normal release UI created a temporary PPF account with INR 1,000 confirmed on
October 4 and synthetic provider `a`. Both Light and Dark captures cover account
review, populated account, a draft INR 100 contribution, entry review, discard
confirmation and account-deletion confirmation. The contribution was not saved.
The original provider-input block did not reproduce in this release session.

The first Light entry run reached the discard guard when `hideKeyboard` sent
Android Back. Returning through Keep editing retained the exact amount `100`;
the resume flow completed entry review and removed the temporary account. The
Dark run omitted that unnecessary Back action and completed those same screens.
These observations do not establish the cause of the earlier debug input loss.

The initial flows' final Cash checks failed because they expected the populated
debug fixture's INR 50,000, not this empty release fixture. A later command-line
rupee argument also failed to match. The separate release-empty flow uses the
literal assertion in YAML and verified INR 0.00, no cash movement, no holdings,
no PPF account and no Futures wallet after the PPF checks. Do not label the
entire initial PPF invocation green.
After correcting the keyboard step and using an ASCII `EMPTY_PORTFOLIO=true`
selector instead of a command-line rupee string, the complete Light PPF flow
passed from account creation through entry review/discard, account deletion and
the exact zero-Cash assertion. Its separate rerun log is included with evidence.

### Futures masking

Created a task-only wallet with 1,000 USDT and a BTCUSDT long execution of quantity
1, price 100 and fee 1. The resulting wallet was exactly 999 USDT. The Light
masking flow passed: 999 USDT disappeared, a settled screenshot visibly masked
the wallet/position values, and unmasking restored 999 USDT. This replaces the
previously missing Light visual proof; it is not just an accessibility assertion.
The temporary wallet and execution were deleted through the normal UI.
The release-empty flow passed again after all checks, confirming no holdings,
no PPF account, no Futures wallet, INR 0.00 cash and no cash movements.

### Restart persistence

All four Maestro restart flows passed, including the selected Settings control:

| Saved preference | Android mode | Settled Dashboard |
| --- | --- | --- |
| Light | Dark | Light |
| Follow system | Dark | Dark |
| Follow system | Light | Light |
| Dark | Light | Dark |

This covers process restart, not just switching within the existing process.
The startup recordings are separate evidence for the intermediate frames.

## Startup finding

Dark override with Android Light reproduced a bright blank startup surface on
two cold launches. The sequence was brand splash, bright blank surface, then
the correct Dark Dashboard. Recordings also show a brief `index` route label
before the Dashboard header settles. Theme persistence after settling does not
make these intermediate frames a pass.

Follow system Dark did not show the bright surface in its sampled recording.
Follow system Light showed a bright blank surface before the Light Dashboard.
Light overriding Android Dark showed a dark intermediate surface before Light.
See the named recordings and contact sheets rather than treating these as
identical launch paths. Fixing the intermediate window/header presentation
remains pending; no production fix was attempted in this verification pass.

The static Private Ink brand splash is an already documented intentional
exception. The additional bright surface is recorded separately and must not
be described as a flash-free launch. Contact sheets sample recordings at 8 fps;
they establish the observed transition, not the absence of every shorter flash.

## Remaining acceptance

Keep #537 open and #538 draft. The startup finding needs correction or explicit
acceptance. The matched original pitch-black comparison publication remains
outstanding. Known live-font transition bug #529 remains separate and was not
fixed by this verification work. Larger text and broader screen permutations
remain covered by the prior debug report, not claimed as repeated release tests.
No phone, TalkBack or outdoor-readability verification is claimed.

No production code, financial calculations or persisted schemas changed during
this pass. Only verification flows and evidence were added or corrected.

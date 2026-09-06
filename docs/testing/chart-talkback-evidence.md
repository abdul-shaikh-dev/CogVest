# Chart Accessibility Verification

Issue: [#292](https://github.com/abdul-shaikh-dev/CogVest/issues/292)

## Scope And Environment

Verification on 6 September 2026 used Pixel_10_Pro (`emulator-5554`),
TalkBack 16.0.0.777931756, and synthetic visual-QA data only.
`npm run android:apk:emulator` built a fresh debug APK, installed with
`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
Current JavaScript was served by `npm run start:clear` over reversed port 8081.
This is not standalone-release or physical-device evidence. No EAS build ran.

Debug APK SHA-256:
`AC6D159045E3AEBDF9EEC43F303D445009109EFBAFCEFD7B8F4AB3C2FF2A2F7A`.
The debug APK hash identifies the native shell, not Metro-served JavaScript;
the source changes are those in this document's PR branch.

## Implemented Contract

- Portfolio summaries include month, portfolio/invested amounts, signed amount
  difference, and signed percentage versus invested capital.
- Asset summaries include each non-cash class's value and percentage change
  versus the previous visible stored month, not necessarily the previous
  calendar month.
- First-visible-month and zero-baseline percentage unavailability have distinct
  explanations. A zero invested baseline never announces a computed percentage.
- Masked summaries expose only month and the hidden-values message.

Component coverage includes Standard/Minimal modes, gains, losses, first month,
zero baselines, and masked summaries. Component assertions are not proof of
actual screen-reader traversal or speech privacy.

## Direct TalkBack Evidence

Temporarily enabled the installed TalkBack service and its Developer settings >
Display speech output overlay. This diagnostic displays generated utterances;
see [Android accessibility testing](https://developer.android.com/guide/topics/ui/accessibility/testing).

Observed keyboard focus outlines on the chart's 6M and Custom controls.
Enter activated Custom and opened the date-range fields. The overlay then read:

> May 2026. Portfolio rupee 19.87L. Invested rupee 17.21L.
> +rupee 2.66L ahead of invested. +15.48% versus invested.

The screenshot uses the rupee symbol, transcribed here as `rupee`.
Local, ignored evidence: `.expo/ux292-chart-focus.png` and
`.expo/ux292-chart-activate.png`. These paths are session evidence, not a
portable committed image archive. A development warning banner was also visible;
these captures are accessibility diagnostics, not clean visual-baseline approval.

## Remaining Runtime Checks

Keep #292 open until all of these are directly verified:

- TalkBack reaches and activates both charts' previous/next controls, announces
  selected/disabled boundaries, and maintains usable focus after updates.
- Asset summary speech includes class values and signed percentages.
- Masked mode speaks no hidden amounts or performance data through descendants.
- Normal screen-reader traversal skips decorative plot labels and points.
- First-month and zero-baseline explanations are usable in actual speech.

ADB touch/shortcut attempts did not reliably establish those results. Do not
interpret the successful portfolio live-region announcement or ordinary Maestro
navigation as completion of this broader screen-reader journey.

## Automated Checks And Restoration

`npm run test:v1:pc` passed: typecheck, 97 Jest suites / 1013 tests,
Expo doctor 17/17, and strict emulator/package readiness.

The first Maestro launch failed because Metro was absent (`Unable to load
script`). Restarting Metro and requesting the Android bundle resolved it; the
chart month-navigation journey then passed. A final rerun of the strengthened
`e2e/progress-chart-month-navigation.yaml` passed after restoration, including
percentage-bearing portfolio and asset summary assertions, independent month
selection, scroll stability, and range-reset behavior. Its local log is
`.expo/ux292-maestro-final.log`. This also verifies ordinary input after restoring
TalkBack settings; it does not verify TalkBack traversal.

After testing, verified restoration to the original values:

| Setting | Restored value |
| --- | --- |
| `enabled_accessibility_services` | unset (`null`) |
| `accessibility_enabled` | `0` |
| `touch_exploration_enabled` | `0` |
| TalkBack Display speech output | Off |

Do not blindly apply these values on another machine. Capture that emulator's
original settings first, preserve other accessibility services, and restore its
own prior values. No notification permission was granted during this check.

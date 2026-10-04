# Appearance implementation and visual evidence

Related to #537. User approved option 2, neutral graphite, and option 3,
soft light. This is an implementation checkpoint, not final visual sign-off.

## Implementation

- Shared semantic palettes, with reactive styles across screens and controls.
- Settings: Follow system, Light and Dark. New installations follow Android;
  legacy records and legacy restored backups retain Dark.
- Appearance is independent of Standard/Minimal and value masking.
- Switching themes does not key/remount navigation or the application tree.
- Android native dialogs follow the preference. A config plugin updates open
  React Native modal system-bar icons without dismissing the modal.
- Foreground ripples avoid an Android background-drawable bug that retained
  the previous theme's button fill after a system appearance change.
- Financial calculations, record schemas other than the optional appearance
  preference, and screen layouts are unchanged.

## Build and automated verification

Base commit: `5649333575f064afa503c6d40abcb7113d2cc2df`.
Branch: `design/537-appearance-preview`. Screenshots were taken from the working
implementation before its delivery commit.

Fresh local x86_64 debug APK, installed with `adb install -r`, without clearing
the existing synthetic portfolio. Metro served the current working source.
Final native APK SHA-256:
`2BA6EC913BF140DBFFA3BAD58B3589B06C4F4907C3DB655C3E8C27F392C93150`.
Earlier standard/minimal captures preceded the final modal compatibility changes;
larger-text and accepted draft captures use this final native build.

AVD: CogVest_UX_Proof, Android API 36, emulator-5554, 1280 x 2856, 480 dpi.
Font scales: 1.0 and 1.3. Reduced motion enabled. This is not a release APK,
physical-phone, TalkBack, outdoor-readability or performance measurement.

- `npm run test:v1:pc`: passed. 195 suites passed, 1 skipped; 2,057 tests
  passed, 3 skipped. Expo doctor 17/17 and strict installed-package smoke passed.
- Final focused appearance/native-plugin regression tests: 6 passed.
- Palette contrast tests cover primary/secondary text, gains/losses, warnings,
  category colors and inverse action labels at >=4.5:1; strong boundaries >=3:1.
  These are calculated semantic-color ratios, not a claim that every pixel or
  every transient native state meets contrast requirements.
- Persistence tests cover new/legacy records, valid choices, invalid records,
  backups and restoration without weakening recovery checks.

## Installed-app evidence

Artifacts: [screenshot directory](artifacts/2026-10-04-appearance/).
All amounts and names in these captures are synthetic.

| Flow | Result |
| --- | --- |
| Dark/Light x Standard/Minimal, normal text | Maestro navigation and data assertions passed |
| Dark Standard and Light Minimal, 1.3 text | Same screen-family and data assertions passed |
| Dashboard, Holdings, Progress/chart, Monthly History | Captured in each matrix run |
| Cash, Settings, Add Holding, import, backup, empty futures account | Captured in each matrix run |
| PPF setup, snapshot review, asset management, masking | Extra flow passed in both themes |
| Unsaved cash draft, foreground system switch | Amount 1234.56 and label preserved |
| Unsaved cash draft, background/system switch/resume | Amount and label preserved; no cash transaction saved |
| Native calendar | Light and Dark captures reviewed |

Each matrix run asserted 5 assets, 4 opening positions, 0 trades, 4 cash entries
and total invested INR 12,37,551.60. Cash remained INR 50,000.00.
The stored September snapshot and current quote values differ in this existing
fixture; no claim is made that those are matching valuation dates.

## Findings still open

1. Immediate normal-text Holdings captures after switching appearance/display
   mode sometimes show compressed row spacing. A later direct ADB capture is
   correctly spaced. Compare
   [Light Standard](artifacts/2026-10-04-appearance/light-standard/holdings.png)
   with [settled Dark](artifacts/2026-10-04-appearance/dark-holdings-settled.png).
   Cause is not isolated. Do not dismiss it as screenshot timing or attribute it
   to #529 without a controlled reproduction. It needs investigation before
   final visual approval.
2. A light bottom strip remains when an already-open cash modal changes to Dark.
   Its draft and button colors are correct, and the status-bar icon correction
   works. See [resume capture](artifacts/2026-10-04-appearance/draft-accepted-resume-dark.png).
   Updating the native navigation color/background did not remove this strip
   on API 36. Do not claim complete native-window theme coverage.
3. Recovery/error permutations, populated futures workflows, every nested
   transaction editor, and the full masking/display/text-size cross-product
   were not visually inspected. Shared-component tests are not a substitute
   for those missing installed-app checks.
4. Restart persistence is unit-tested and the app was restarted during checks,
   but the attempted cold-launch capture caught Metro loading rather than a
   settled screen. A clean installed-app restart/override capture remains due.

## Intentional exceptions and remaining acceptance

The brand splash remains Private Ink `#11181C`; launcher artwork is unchanged.
The OS splash cannot read an MMKV override before JavaScript starts. No
flash-free release-startup claim is made. The native calendar uses Android's
own palette. Disabled states retain their existing opacity treatment.

Historical pre-change evidence is preserved under the October 2 review artifacts.
Its quote values differ, so it is not represented as a matched before/after
data comparison. Final acceptance still needs matched comparison publication,
the visual findings above resolved or explicitly accepted, and release-startup
inspection. Keep #537 open and the implementation PR in draft meanwhile.

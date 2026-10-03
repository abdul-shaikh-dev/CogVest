# Futures wallet hierarchy verification

3 October 2026. F6 batch under #512, based on `8db2084`, merged #522.

## Scope

Wallet setup and correction now lead with the observed USDT balance, followed by its time. INR conversion groups the rate, observation time and source. The shared date/time field uses CogVest's existing chevron disclosure for exact timestamp entry across wallet, activity, Cash movement and valuation forms.

The raw timestamp remains collapsed initially. Device timezone, date/time pickers, exact timezone input and explicit observation-time shortcuts remain available. No timestamp normalization, financial calculations, evidence requirements, persistence, schema or dependency changes were made. Verification and destructive confirmation panels remain contained.

## Checks

- Focused Futures and date/time suites: 18 tests passed. Covers both display modes, field order, conversion grouping, disclosure state, raw offset/fractional-second preservation and existing Futures save/error behavior.
- Final `npm run test:v1:pc`: 189 suites and 2,009 tests passed; one suite and three tests skipped. Typecheck, Expo Doctor 17/17, Android Doctor and strict smoke passed.
- Fresh local x86_64 debug APK built and installed before after-captures. Current branch JavaScript served by offline Metro. Not a signed preview build.
- All four before and four after visual flows passed. The evidence directory contains 24 screenshots across Standard/Minimal and normal/large-text configurations.
- After emulator recovery, unchanged `e2e/futures-timestamp-evidence.yaml` passed. It checks required execution/valuation errors, a saved 999 USDT wallet, INR 90,810 valuation and INR 90,000 invested, then retains the wallet and valuation after relaunch.
- The debug-overlay-adjusted draft flow passed wallet, execution, Cash funding and valuation keep/discard checks. Relaunch confirmed the zero wallet remained, with no discarded execution or draft value persisted.

## Visual environment

CogVest_UX_Proof, API 36, density 480, reduced motion enabled. Normal: 1280 x 2856 at font scale 1.0. Large: 1080 x 2400 at 1.3, cold-restarted after configuration changes. Standard and Minimal retain the same required forms.

`e2e/visual/futures-wallet-hierarchy.yaml` captures entry, exact-time keyboard and conversion evidence. All data are synthetic and drafts are discarded. The keyboard shots demonstrate field visibility, not validated timestamp data: cursor-based erasure can leave a suffix while typing the long sample. No wallet is saved by this capture flow. Some images include the development warning toast.

| Configuration | Before | After |
| --- | --- | --- |
| Normal, both modes | [Images](../reviews/artifacts/2026-10-03-futures-wallet-hierarchy/before/normal) | [Images](../reviews/artifacts/2026-10-03-futures-wallet-hierarchy/after/normal) |
| Large, both modes | [Images](../reviews/artifacts/2026-10-03-futures-wallet-hierarchy/before/large) | [Images](../reviews/artifacts/2026-10-03-futures-wallet-hierarchy/after/large) |

Visual review confirms the balance precedes technical time controls, the collapsed/expanded control has a visible state indicator, and rate evidence is grouped without hiding required inputs. Large-text exact input stays above the keyboard; long single-line timestamps scroll while editing.

## Corrections and limits

New ordering tests first failed against the original layout. A task-owned text assertion then used an exact match against the full conversion group; it was corrected before the passing focused and full checks.

The first native timestamp/data attempt stopped with Maestro's 120-second input-service deadline while erasing the starting balance. The second attempt captured a blank screen after dismissing the calendar. The recent log excerpt contained no fatal app exception. The emulator was rebooted before retrying the unchanged flows; these interrupted attempts are not counted as passes.

The initial draft-protection run retained and discarded the wallet draft correctly, then failed to open activity entry while a development warning toast covered the bottom controls. A local copy adds only conditional dismissal of that toast after the zero wallet is created, using `94%,93%` at the recorded normal display size. All original draft and data assertions remain unchanged. This debug-only workaround does not establish a signed-build result.

After verification, the synthetic visual-QA portfolio was restored in Standard mode at normal resolution and font scale. The task's Metro session and adb port reverse were stopped. No personal portfolio data were used.

No phone, signed-preview, TalkBack, performance or new contrast-audit claim. Existing semantic color tokens and touch-target sizes are reused. Main tracker #512 remains open pending its remaining observations and final acceptance/evidence review.

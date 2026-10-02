# Monthly chart geometry verification

Verified on 2026-10-02 for issue #512, finding F1. Based on
`6d8aad54f7845c7f2ae25f42927add41ce64200b` with the chart change in this PR.

## Change and review

Both portfolio and asset-class charts explicitly disable curved interpolation.
Straight segments connect the existing monthly points. The source diff changes
only those two renderer props; calculations, point data, missing-month segment
masking, selected values, currency, persistence and animation policy are unchanged.
No other findings from #512 are claimed complete.

The audit's increasing April/May sequence no longer dips between points.
The invested comparison remains dashed, estimates remain labelled, and asset
series still use their existing colors. The owned diff was reviewed for changes
to chart data, masking and gap behavior; none were introduced.

## Automated checks

- ProgressScreen suite: 66 tests passed, including eight new cases covering
  rising, falling, flat and two-point data in Standard and Minimal modes.
- The new tests assert straight renderer configuration, unchanged portfolio,
  invested and asset values, masking and unchanged stored snapshots.
- Existing single-snapshot fallback coverage passed. Missing-month tests now
  also assert straight geometry and matching gap masks on the invested series.
- `npm run test:v1:pc` passed, including `test:verify`, Expo Doctor 17/17,
  Android doctor and strict installed-package smoke.
- `git diff --check` passed.

## Installed Android checks

Built with `npm run android:apk:emulator` and installed with `adb install -r`.
This is a fresh local debug x86_64 APK, version 1.0.18/code 19, with Metro serving
the changed source. Its SHA256 is
`4EED0BD682ED7AD7D548B3BF78A4B42FB2752A505084F29BD40B7F8F93AA8B06`.
The native debug shell hash matches the earlier build because this change is
JavaScript served by Metro; the screenshots verify the changed renderer.

AVD: CogVest_UX_Proof. API 36. Density 480. Reduced motion enabled.

- Normal: 1280x2856, font scale 1.0.
- Large text: 1080x2400, 360dp width, font scale 1.3, cold-started after changing
  the display settings.

Both runs of `e2e/visual/monthly-straight-lines.yaml` passed. The flow uses the
existing synthetic audit portfolio and does not clear, reseed or save records.
It checks September portfolio value INR 82.03L, previous-month value INR 76.55L,
return to September, Standard/Minimal charts, masking, and unchanged cash
INR 50,000.00. Run with Maestro directly to pass the screenshot folder parameter:

```powershell
maestro test -e SIZE=normal e2e/visual/monthly-straight-lines.yaml
maestro test -e SIZE=large e2e/visual/monthly-straight-lines.yaml
```

The repository npm wrapper accepts flow paths, not `-e`; an initial invocation
was rejected before executing the flow. The first native attempt reached the
Minimal chart with a retained scroll offset and failed its value assertion.
Returning to the top after switching modes fixed the test; both final runs
passed. A large Standard chart screenshot was recaptured with the whole plot
visible and without the debug warning overlay.

Standard Mode, unmasked values, physical display size and font scale 1.0 were
restored. Metro and the test's ADB reverse connection were stopped.

## Inspected screenshots

| Chart | Normal | Large text |
| --- | --- | --- |
| Standard portfolio | [Image](../reviews/artifacts/2026-10-02-monthly-straight-lines/normal/standard-portfolio.png) | [Image](../reviews/artifacts/2026-10-02-monthly-straight-lines/large/standard-portfolio.png) |
| Asset classes | [Image](../reviews/artifacts/2026-10-02-monthly-straight-lines/normal/standard-assets.png) | [Image](../reviews/artifacts/2026-10-02-monthly-straight-lines/large/standard-assets.png) |
| Minimal portfolio | [Image](../reviews/artifacts/2026-10-02-monthly-straight-lines/normal/minimal-portfolio.png) | [Image](../reviews/artifacts/2026-10-02-monthly-straight-lines/large/minimal-portfolio.png) |

The [original review](../reviews/artifacts/2026-10-02-design-review/review.html)
and its screenshots remain unchanged. In particular,
[the original Minimal chart](../reviews/artifacts/2026-10-02-design-review/15-minimal-progress.png)
shows the artificial dip removed here. Before/after normal screenshots use the
same stored period and fixture, but different scroll positions.

This is not signed cloud-preview, physical-phone, TalkBack or performance
certification. Missing-month and single-point cases were checked by automated
component tests, not additional native fixtures. The broader spacing and
disclosure findings stay in #512; chart frame attribution remains in #299.

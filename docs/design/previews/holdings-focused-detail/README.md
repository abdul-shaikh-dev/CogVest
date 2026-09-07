# Holdings: Focused Detail Study

Status: **proposal awaiting user review**. This is not a replacement for the
approved #278 list-first baseline, nor a production implementation contract.

## Direction

- Preserve the list-first model, existing value ordering, and All / Winners /
  Losers / High allocation meanings. Winners includes zero gain; high allocation
  means at least 10% of market holdings. Search covers identity and classification.
- Reduce the area before the first row: one search field, existing filters, and
  a clearly actionable Portfolio insights link. No redundant portfolio-value hero.
- Group rows in one quiet surface. Retain invested value, current value, signed
  return and market share. Use asset-class icons and avoid repeated classification.
- Tap a row to open a separate full-height detail panel; never expand the list
  into a record-management screen. Back preserves search, filters and scroll.
- Detail leads with current value and total return, then units, cost, price,
  market share, classification, first-purchase date and source timestamp.
  Record management and Sell / redeem are secondary, separate destinations.
- Explain the allocation denominator: market holdings exclude cash and PPF.
- Keep manual provenance; missing prices have an explicit incomplete state.
  Do not substitute zero prices, gains or allocation when a valuation is absent.
  Explain incomplete shares once above the list; omit unavailable shares from
  rows while retaining invested amounts and the affected holding's pending state.
- Filters wrap when space is limited. On phones up to 380px wide, the list
  count and Portfolio insights action occupy separate lines, including at 130%
  text size. This trades some vertical space for readable, reachable controls.
- Preserve PPF access without presenting it as a traded instrument.
- Mask portfolio amounts, not units, percentages or per-unit prices, matching
  the app's existing masking contract. Minimal Mode suppresses optional insights
  and subdues return color without removing core holdings information.

## Try It

```powershell
node docs/design/previews/holdings-focused-detail/serve.mjs
```

Open `http://127.0.0.1:4181/`. Server binds only to loopback. It serves an explicit
file allowlist and the existing Ionicons font from `node_modules`; no CDN,
additional dependencies, API calls, persistence, or real financial actions.

Use the preview controls for six holdings, a long list, pending valuation,
empty and PPF-only portfolios, an additional PPF account, Minimal Mode, 130% text,
and a 360px phone. Search, filtering, masking, details and insights work locally.
Other routes show an explicit navigation-boundary explanation rather than
pretending to save or import data. Bottom navigation is illustrative.

For a persistent Windows process, use `Start-Process` with `-WindowStyle Hidden`,
the repository as `-WorkingDirectory`, separate stdout/stderr log paths, and
`-PassThru`; record its PID. Check HTTP 200 for `/` and `/icons.ttf` after the
launch command exits. Stop only the recorded process via `Stop-Process -Id PID`.

## Verification

```powershell
node --check docs/design/previews/holdings-focused-detail/app.js
node docs/design/previews/holdings-focused-detail/verify.cjs
```

JSDOM verifies interactions and content, not real rendering, focus trapping,
dialog geometry or responsive layout. The initial browser connection blocker was
resolved on 8 September 2026. Codex in-app browser screenshots verified the
standard list, detail panel/back interaction, 360px layout with 130% text, and
missing-price presentation. After refinement, filters no longer clip, the insights
link does not wrap awkwardly, and rows do not repeat unavailable-share messages.
This is HTML preview evidence, not Android verification or final design approval.
No Android app code changed.

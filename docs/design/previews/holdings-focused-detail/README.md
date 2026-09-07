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
dialog geometry or responsive layout. Browser automation exposed no connected
browser in the creation session (in-app and Chrome unavailable). HTTP and DOM
checks must not be described as screenshot-based visual approval. Review the
live preview before adopting the design. No Android app code changed.

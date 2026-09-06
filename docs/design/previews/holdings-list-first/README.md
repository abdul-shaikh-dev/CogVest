# Holdings: List First

Issue: [#278](https://github.com/abdul-shaikh-dev/CogVest/issues/278).
Baseline: `5a2e232`, after merged Progress PR #276.
Status: **proposal awaiting user approval**. No React Native behavior changes.
This preview does not supersede the canonical Holdings baseline yet.

## Open

```powershell
node docs/design/previews/holdings-list-first/serve.mjs
```

Visit <http://127.0.0.1:4179/>. This server binds only to loopback and serves
index.html, style.css and app.js; it cannot expose portfolio files.
For a background Windows session, use `Start-Process -WindowStyle Hidden`, log
to `.expo/`, retain its PID, and verify HTTP 200 before sharing the URL.

## Design Contract Under Review

The main question is "Find and inspect what I own", not "Read another dashboard".
Keep the existing OLED palette, asset-class icons and compact/expanded rows.

1. Title with Add and a labelled More menu; search is directly available.
2. Market / PPF destinations appear only when both types exist. PPF-only portfolios
   start at their accounts, not an empty market section. Market counts do not
   pretend to include PPF accounts.
3. A compact valuation context; material missing valuations are still explicit.
4. Existing All / Winners / Losers / High allocation filters.
5. One quiet Portfolio insights action, then the holdings list. Insights retain
   dominant position, distinct best return, asset mix and top-three concentration.
6. Existing real PPF accounts stay one tap away; absent-account promotion leaves
   the main list. Add PPF remains discoverable under Add (also More when absent).

More contains masking, valuation detail, Manage assets and Transactions.
Add retains single entry, Quick Setup, holdings CSV, transaction import and PPF.
Interrupted setup shows a compact Resume action. Nothing is automatically priced,
saved, imported or converted by the preview.

## Try The States

- 4 and 30 synthetic holdings, search, Winners/Losers/High allocation and no results.
- Expand/collapse any row; records and sell/redeem destinations are labelled
  placeholders for existing app routes, not implemented transactions.
- PPF alongside market holdings, PPF-only, and empty portfolio.
- Pending valuation: invested amounts survive; incomplete totals/allocation are
  not presented as complete. Live/Manual source remains in expanded details.
- Resume setup, 360px width, 130% text, Minimal Mode and value masking.
- Open/close menus and insights; native HTML dialog supports Escape dismissal.

The fixture has no cash and uses market-only allocation. Preview arithmetic is
illustrative only; native implementation must keep current domain selectors,
allocation denominator/provenance, quote failure state, all expanded financial
fields, legacy PPF conversion, and record correction behavior. Preview PPF uses
a synthetic confirmed balance rather than a market-price calculation. Values
and percentages are masked here; this is not approval to change production
masking semantics without reconciling the existing privacy contract.

## Verification And Next Step

```powershell
node --check docs/design/previews/holdings-list-first/app.js
node --check docs/design/previews/holdings-list-first/serve.mjs
node docs/design/previews/holdings-list-first/verify.cjs
```

DOM tests use the existing jsdom dependency, not a new package. HTTP availability
and source/DOM checks do not establish rendered layout, scroll count, or Android
quality. Browser control was unavailable in this session. User visual inspection
is pending; no screenshot or pixel-parity claim is made for this proposal.

2026-09-06 checks: eight focused DOM scenarios passed; `npm run test:verify`
passed (97 suites / 973 tests, typecheck, Expo Doctor 17/17). Impeccable's source
detector has no remaining hits after removing an unnecessary notice accent
border. This is source-level feedback, not a rendered design critique.

After approval, implement only UX-08 plus relevant hierarchy treatment from UX-15,
then verify the native acceptance in #278 on a newly installed local APK. Measure
visible-row counts at normal and enlarged text; do not meet those targets by
shrinking type. Keep #278 open until native verification completes.

# Issue 86 Premium Preview

Static browser mockup for the CogVest V1 premium design pass.

## Refined Baseline

Issue #102 refines this preview after the May 21, 2026 CogVest mockup review.
The preview keeps the approved V1 flow coverage while adopting:

- quieter portfolio-first Dashboard hierarchy
- compact Holdings cards with quantity, average cost, current price, P&L,
  allocation context, and quote state
- Holdings filter counts, stale-price reference, and Add Holding header action
- focused Cash Ledger and empty cash state treatment
- local-first trust treatment in Settings
- explicit Progress copy that keeps historical charting out of V1 scope

## Scope

- Dashboard
- Holdings
- Add Holding
- Monthly Progress
- Cash Ledger
- Settings
- V1 States
- Empty portfolio, empty cash ledger, quote lookup, provider error, manual price
  fallback, and no-snapshot state frame

This is a design preview only. It does not modify the Expo app.

## Run

From this folder:

```powershell
python -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173
```

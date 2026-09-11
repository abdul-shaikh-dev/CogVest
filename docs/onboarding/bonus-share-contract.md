# Bonus-share credits (#334)

## Verified source diagnosis

Read-only inspection of the six authorized annual execution CSVs found buy/sell
rows only and no zero-price rows. The supplied files do not contain an explicit
Berger bonus credit. Do not describe this as a parser dropping a zero-price buy.
The source files were not changed; private rows and totals are not published.

## Bounded implementation

The first supported bonus is Berger Paints' one additional share per five held,
ex-date 2023-09-22, same ISIN INE463A01038. Evidence:

- [Issuer record-date notice](https://nsearchives.nseindia.com/corporate/BERGEPAINT_12092023124915_RecordDateintimation.pdf):
  ratio and record date 2023-09-23.
- [NSE Clearing circular dated 2023-09-14](https://nsearchives.nseindia.com/content/circulars/CMPT58398.pdf):
  confirms underlying bonus ratio and ex-date. Derivatives-specific contract
  adjustments are not used as equity accounting rules.
- [Issuer annual report 2023-24](https://nsearchives.nseindia.com/annual_reports/AR_24606_BERGEPAINT_2023_2024_20072024175535.pdf):
  confirms completed allotment on September 25 and credit on October 5, 2023.

Import proposes the verified event separately from execution rows, displays its
bonus ratio, and saves it only with the final batch confirmation. This is an
explicit evidence-backed catalog path for an omitted event, not CSV inference.
It does not classify arbitrary zero-priced purchases as bonuses. Unknown events
still require a future explicit supported entry/import path, not fabricated buys.

## Accounting and safety

For a bonus ratio N additional shares per D held, quantity becomes Q + Q*N/D.
Remaining tracking cost stays constant; cash and monthly investment are unchanged.
Later sales use adjusted moving-average cost, not FIFO tax lots. Raw purchases
are preserved. Eligibility precedes ex-date trading; measured openings after
the ex-date already include the entitlement and are not credited again.

Economic entitlement and credited/tradable shares are not equivalent. The
catalog records both dates. The first slice conservatively blocks histories
with disposals from ex-date until credit date for reconciliation, rather than
assuming all bonus shares were tradable immediately. No fractional entitlement
rounding, cash-in-lieu or same-day multi-event ordering is invented.

The internal `stockSplits` field/type name is retained for compatibility, but
`kind: bonus` remains distinct from `kind: split`, with different ratio semantics.
Schema 11 recognizes this distinction; legacy 9/10 backups remain readable.
Strict event/evidence validation and catalog matching apply at commit, restore
and hydration. Reimport/restart must never compound the same event twice.

All existing effective-date quantity consumers share the event replay. Generated
history is revisited when an event is attached; manual snapshots are preserved.
Cross-action historical prices remain unavailable unless their unit basis is
safe. This slice does not reconstruct adjusted prices or complete event feeds.

## Acceptance and remaining scope

Synthetic 100 shares at INR 100 plus a 1:5 bonus becomes 120 shares with INR
10,000 tracking cost. A later sale of 12 at INR 100 leaves 108 shares, INR 9,000
cost and INR 200 realized tracking gain. Tests cover ex-date buys, measured
openings, delayed credit, fractions, duplicate events, zero-price rejection,
import/reimport, restart and backup/restore. Native evidence is recorded with
the delivering PR after a fresh standalone build.

#334 remains partial until the general explicit event input path and remaining
coverage are resolved. Easy Trip's combined split/bonus identity chain is not
enabled by this Berger-only slice. HDFC/Reliance bonus coverage, demergers #335,
bulk correction #336 and full broker reconciliation #337 remain separately
tracked by #338. The local Berger quantity arithmetic matches the supplied
baseline, but this is not a full all-holdings application reconciliation claim.

## Verification evidence (2026-09-11)

- `npm run test:v1:pc`: passed; 147 suites / 1,494 tests passed, one suite /
  two tests skipped. Typecheck passed; Expo Doctor 17/17.
- Independent review found a commit-path gap in delayed-credit validation;
  corrected with a store rejection/unchanged-state test. Final narrow recheck
  reported no remaining finding.
- Fresh standalone x86_64 release build/install and
  `e2e/standalone/zerodha-bonus-shares.yaml` passed: preview 120 units / INR 83.33
  average cost, then saved holding after restart 120 units / INR 10,000 invested.
  Both screenshots inspected. Live current-price availability was not proven.
- Pixel_10_Pro, API 36, 1280x2856, density 480, font scale 1.0, no Metro.
  APK SHA-256: `508BFACBA0C74351793B3CB8C3C667325A84BF91CF6F4744E8AE0AC28730A3A4`.
- Local evidence (not committed): `.expo/issue334-final-pc.log`,
  `.expo/issue334-build.log`, `.expo/issue334-maestro.log`,
  `.expo/issue334-bonus-summary.png`, `.expo/issue334-bonus-restart.png`.

Backup validation also corrects checksum verification to use the original
signed payload before schema upgrade; signed schema-9/10 regressions cover
compatibility rather than merely validating already-parsed objects.

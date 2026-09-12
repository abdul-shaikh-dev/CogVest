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
catalog records an ex-date and either a credit date or a confirmed-availability
bound. It conservatively blocks histories with disposals between these dates,
rather than
assuming all bonus shares were tradable immediately. No fractional entitlement
rounding or cash-in-lieu is invented. Same-day events require explicit verified
ordering; Easy Trip's subdivision precedes its bonus.

The internal `stockSplits` field/type name is retained for compatibility, but
`kind: bonus` remains distinct from `kind: split`, with different ratio semantics.
Schema 12 recognizes availability bounds and explicit same-day ordering;
legacy 9/10/11 backups remain readable with original checksum verification.
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

#334 is closed after its initial slice; remaining explicit event input and
coverage gaps remain tracked under #338/#337. HDFC/Reliance bonuses and Easy Trip's verified November
2022/2024 chain are now covered (details below). Demergers #335,
bulk correction #336 and full broker reconciliation #337 remain separately
tracked by #338. The local Berger quantity arithmetic matches the supplied
baseline, but this is not a full all-holdings application reconciliation claim.

## Expanded evidence and coverage (2026-09-12)

| Event | Ex-date | Quantity rule | Confirmed availability | Primary source |
| --- | --- | --- | --- | --- |
| HDFC Bank bonus | 2025-08-26 | Q + Q | 2025-08-29 | [NSE CML69791, 2025-08-22](https://nsearchives.nseindia.com/content/circulars/CML69791.pdf) |
| Reliance bonus | 2024-10-28 | Q + Q | 2024-11-01 | [NSE CML64862, 2024-10-31](https://nsearchives.nseindia.com/content/circulars/CML64862.pdf) |
| Easy Trip split | 2022-11-21 | Q * 2, first | Ex-date units | [NSE CML54479, 2022-11-17](https://archives.nseindia.com/content/circulars/CML54479.pdf) |
| Easy Trip bonus | 2022-11-21 | Q + Q * 3, after split | By 2022-12-31, conservative bound | [Issuer capital audit, 2023-01-10](https://www.easemytrip.com/investor-pdf/2022/Reconciliation-of-Share-Capital-Audit-December-Quarter.pdf) |
| Easy Trip bonus | 2024-11-29 | Q + Q | 2024-12-03 | [NSE CML65294, 2024-11-28](https://nsearchives.nseindia.com/content/circulars/CML65294.pdf) |

Easy Trip's November 2022 [issuer allotment filing](https://www.easemytrip.com/investor-pdf/2022/Outcome-of-Board-Meeting-23-11-2022.pdf)
confirms three additional Re 1 shares per existing Re 1 share after subdivision.
Its promised credit deadline is not proof of actual credit. The December audit
confirms listed capital with no pending credits by December 31, not first-day
tradability. Disposals before that conservative bound require reconciliation.
The split uses original ISIN INE07O001018 and successor INE07O001026 (letter O).
Original transaction identities are checked against their respective dates.

The earlier February 2022 bonus has issuer-confirmed record date March 2 and
allotment March 3, but primary exchange ex-date evidence is not yet verified.
Histories on or before March 2 are blocked, not silently undercounted. Measured
balances after that period can be used without reconstructing unverified history.

All events for a covered chain must be present; a partial cross-date or same-day
chain is rejected at persistence/restore boundaries. Event order is independent
of input array order. Raw trades, cash and total tracking cost are not rewritten.
Duplicate-only reimports can explicitly apply newly supported adjustments to
existing verified holdings without inserting purchases. The preview says
"Apply share adjustments"; current identity, inventory and persistence are
validated again at confirmation. Repeating the correction is a no-op.
Reliance's Jio Financial cost allocation and Tata Motors' demerger remain #335;
bonus quantity correctness must not be presented as full broker cost parity.

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

## Expanded verification (2026-09-12)

- `npm run test:v1:pc`: typecheck passed; 149 suites / 1,543 tests passed,
  one suite / two tests skipped; Expo Doctor 17/17 and Android readiness passed.
- Independent review corrected incomplete event subsets and duplicate-only /
  mixed import stale-state gaps. Final independent recheck: 25 focused tests passed,
  no remaining findings in those corrections.
- Read-only local replay through the actual adapter, planner and store confirmed
  reported HDFC/Easy Trip/Reliance quantities; HDFC/Easy Trip tracking cost also
  reconciled. Reliance's remaining cost allocation belongs to #335. Private
  fixtures and portfolio totals are not committed or uploaded.
- Fresh standalone x86_64 APK built and installed; new
  `e2e/standalone/zerodha-bonus-chain.yaml` passed. Two historical ISIN groups
  resolve to one holding: synthetic 10 pre-split units plus seven later purchases
  become 174 units, INR 1,700 invested and INR 9.77 average cost after restart.
- Inspected preview/restart screenshots. Live current valuation remained pending;
  this run does not prove live-quote availability. The actual historical lookup
  rendered independently in the holding detail.
- Pixel_10_Pro, API 36, 1280x2856, density 480, font scale 1.0, standalone release
  without Metro. APK SHA-256:
  `41A434324F9F471432EB0C58572B3B7EBD1404E3AEF29C09662855F894C9ACBE`.
- Local-only evidence: `.expo/bonus-chain-final-pc.log`,
  `.expo/bonus-chain-build.log`, `.expo/bonus-chain-maestro.log`,
  `.expo/bonus-chain-summary.png`, `.expo/bonus-chain-restart.png`.

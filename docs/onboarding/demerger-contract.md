# Demerger accounting contract (#335)

Status: bounded implementation and local verification completed on
`codex/demerger-accounting` for #335; awaiting PR merge. This is support for the
two cataloged events below, not arbitrary corporate actions.

Parent tracker: #338. Historical identity guard: #332. Splits: #333. Bonus
credits: #334. Private broker reconciliation: #337.

## Bounded scope

The first supported demergers are the verified Tata Motors commercial-vehicle
demerger and the Reliance Industries financial-services demerger. Coverage is a
reviewed, versioned catalog, not a general corporate-action feed. An event that
lacks authoritative identity, date, entitlement, allocation, or fraction
evidence is blocked. CogVest must not guess a zero basis, use current market
prices to allocate basis, or infer a demerger from a price movement.

Only ordinary fully paid equity shares with an exact 1:1 entitlement are in
scope. Partly paid shares, GDRs, physical/suspense claims, fractional
entitlements, cash in lieu, withholding, and tax-lot or tax-liability accounting
are out of scope. A history requiring any of those treatments remains visibly
unresolved and cannot be committed as a supported demerger.

## Verified Tata Motors terms

| Term | Verified value |
| --- | --- |
| Predecessor | Tata Motors Limited; NSE `TATAMOTORS`; ISIN `INE155A01022` |
| Appointed date | 2025-07-01 |
| Effective date | 2025-10-01 |
| Ex-date | 2025-10-14 |
| Record date | 2025-10-14 |
| Entitlement | 1 fully paid TMLCV share of face value INR 2 for each 1 fully paid predecessor share of the same class |
| Retained successor | Same listed security and ISIN `INE155A01022`; renamed Tata Motors Passenger Vehicles Limited; NSE symbol `TMPV` from 2025-10-24 |
| Child successor | TML Commercial Vehicles Limited, renamed Tata Motors Limited; NSE `TMCV`; ISIN `INE1TAE01010` |
| Allotment date | 2025-10-15 |
| Child listing availability | Trading began 2025-11-12; the child was not tradeable between allotment and listing |
| Cost allocation | Retained `TMPV`: 68.85%; child `TMCV`: 31.15% |
| Ordinary-share fractions | None for an integer quantity under the verified 1:1 fully paid entitlement |

The issuer's earlier expected 60:40 PV/CV asset ratio is not the shareholder
cost-allocation rule and must not be cataloged as one. The final issuer
communication dated 2025-11-12 supplies the 68.85/31.15 allocation.

Primary sources:

- [Issuer shareholder communication, 2025-10-09](https://nsearchives.nseindia.com/corporate/TATAMOTORSSJS_09102025200440_NSEBSESHAREHOLDERINTIMATION.pdf): appointed and effective dates, record date, 1:1 entitlement, retained legal identity, and child pre-listing unavailability.
- [NSE corporate action record](https://www.nseindia.com/companies-listing/corporate-filings-actions?symbol=TMPV): ex-date and record date of 2025-10-14.
- [Issuer allotment filing, 2025-10-15](https://nsearchives.nseindia.com/corporate/TATAMOTORSSJS_15102025215827_NSEBSEALLOTMENT.pdf): completed 1:1 child allotment.
- [NSE symbol-change circular, 2025-10-17](https://nsearchives.nseindia.com/content/circulars/FAOP70882.pdf): `TATAMOTORS` to `TMPV` effective 2025-10-24.
- [Issuer listing filing, 2025-11-10](https://nsearchives.nseindia.com/corporate/TATAMOTORSSJS_10112025220440_NSEBSELISTING.pdf): child listing process.
- [Issuer CV results release, 2025-11-13](https://cv.tatamotors.com/news/tata-motors-limited-formerly-TML-commercial-vehicles-ltd-Q2-FY26-results-commercial-vehicles-segment-financials): `TMCV` listing on 2025-11-12.
- [Issuer cost-allocation filing, 2025-11-12](https://nsearchives.nseindia.com/corporate/TATAMOTORSSJS_12112025224654_NSEBSECOAFINAL.pdf): retained 68.85% and child 31.15%.
- [NSE current retained identity filing, 2025-11-04](https://nsearchives.nseindia.com/corporate/ixbrl/PRIOR_INTIMATION_70633_04112025171823_iXBRL_WEB.html): `TMPV` and ISIN `INE155A01022`.
- [NSE current child identity filing, 2026-01-12](https://nsearchives.nseindia.com/corporate/ixbrl/PRIOR_INTIMATION_75278_12012026182918_iXBRL_WEB.html): `TMCV` and ISIN `INE1TAE01010`.

## Verified Reliance/Jio Financial terms

| Term | Verified value |
| --- | --- |
| Predecessor and retained successor | Reliance Industries Limited; NSE `RELIANCE`; ISIN `INE002A01018` |
| Appointed date | Closing business hours on 2023-03-31 |
| Effective date | 2023-07-01 |
| Ex-date | 2023-07-20 |
| Record date | 2023-07-20 |
| Entitlement | 1 fully paid RSIL share of face value INR 10 for each 1 fully paid RIL share of face value INR 10 |
| Child successor | Reliance Strategic Investments Limited, renamed Jio Financial Services Limited; NSE `JIOFIN`; ISIN `INE758E01017` |
| Allotment date | 2023-08-09 |
| Child listing availability | Trading began 2023-08-21; allotment did not imply an earlier usable market quote |
| Cost allocation | Retained `RELIANCE`: 95.32%; child `JIOFIN`: 4.68% |
| Ordinary-share fractions | None for an integer quantity under the verified 1:1 fully paid entitlement |

Primary sources:

- [RIL cost-allocation filing, 2023-07-19](https://rilstaticasset.akamaized.net/sites/default/files/2023-08/SEIntimation_ApportionmentofCost_0.pdf): 1:1 fully paid entitlement, 2023-07-20 record date, retained 95.32%, and child 4.68%.
- [RIL Scheme of Arrangement hub](https://www.ril.com/investors/shareholders-information/scheme-of-arrangement): issuer catalog containing the allocation, entitlement, scheme, rename, and listing documents.
- [NSE-hosted JFSL information memorandum, 2023-08-18](https://nsearchives.nseindia.com/corporates/offerdocument/scheme/IM_JIOFIN.pdf): appointed and effective dates, 2023-08-09 allotment, cancellation of pre-scheme resulting-company capital, and successor identity.
- [NSE corporate-adjustment publication, 2023-07-17](https://nsearchives.nseindia.com/web/sites/default/files/2023-08/PR_cc_17072023.pdf): ex-date and record date of 2023-07-20 and 1:1 entitlement.
- [NSE listing notice, 2023-08-18](https://nsearchives.nseindia.com/web/sites/default/files/2023-08/PR_list_18082023.pdf): `JIOFIN`, ISIN `INE758E01017`, and trading from 2023-08-21.
- [NSE current RIL quote identity](https://www.nseindia.com/get-quote/equity/RELIANCE/Reliance-Industries-Limited): retained `RELIANCE` and ISIN `INE002A01018`.

## Persistence and derived accounting

Persist raw imported executions and a distinct, evidence-revisioned demerger
event. Do not rewrite the predecessor purchase, create a zero-price purchase,
or represent either successor as new invested cash. The parent asset persists its
link as `demerger: { eventId, childAssetId }`; the event ID is stable and
the child asset ID resolves the cataloged successor identity.

The shared domain replay calculates two separate consequences on the ex-date:

- A retained-basis event keeps the predecessor quantity and identity lineage,
  applies the verified retained percentage to remaining basis, and follows any
  verified rename/symbol change without creating a purchase.
- An entitlement event creates the verified child quantity and applies the
  verified child percentage to remaining basis, without investment or cash
  flow.

For predecessor quantity `Q` and remaining tracking basis `C`, both supported
events produce successor quantities of `Q`. Tata allocates `0.6885 * C` to
`TMPV` and `0.3115 * C` to `TMCV`; Reliance allocates `0.9532 * C` to
`RELIANCE` and `0.0468 * C` to `JIOFIN`. Allocation must conserve `C` exactly
under the domain's decimal/rounding policy. Acquisition/source lineage remains
attached to both consequences. Later purchases and disposals replay after the
event through the same shared derived-domain implementation used by holdings,
gain metrics, monthly history, import preview, restart, and restore.

The ex-date controls market-unit replay; record, effective, appointed,
allotment, rename, and listing dates remain distinct evidence fields and must
not be substituted for it. A measured opening already expressed in successor
units must not receive the event again. Imports containing both predecessor and
successor positions remain blocked unless the preview can prove a single,
non-duplicating lineage.

## Preview, commit, and valuation safety

Import preview is strict and write-free. It must show both successor quantities,
basis allocations, identity transitions, evidence, and any period where the
child was allotted but not listed. Missing or conflicting evidence, unsupported
fractions, ambiguous measurement dates, duplicate application, and incomplete
predecessor/successor history block the whole affected event rather than
partially applying it.

Schema 13 adds the strict event/child link; existing schema 9-12 backup signatures
are checked against their original payload before migration. Unknown catalog
IDs, missing children, conflicting successor quote listings, unsupported
same-day event ordering, and incompatible measured openings are rejected.
Deleting only one linked holding is blocked; source-record corrections must
continue to reconcile the complete linked portfolio.

Final confirmation atomically commits the source executions, catalog-backed link,
and both asset identities. Allocated amounts and entitlements are derived from
the source records, never persisted as fabricated purchases or cached basis.
Any validation or persistence failure commits none of them. Hydration,
restart, backup, and restore must enforce the same catalog and invariants.

Current and historical valuation require a quote for the correct security and
date. Missing historical quotes leave that successor or period unvalued; CogVest
must not backfill with the other successor's price, a current price, the
price-discovery difference, or an implied allocation value. Unvalued periods
remain explicit in portfolio totals and monthly history.

## Verification

- Synthetic INR 10,000 40/60 accounting conserves cost across two holdings.
- Catalog import tests cover both demergers, Reliance's subsequent bonus,
  derived children without raw trades, later child purchases/disposals,
  reimport/idempotence, measured-opening replacement, restart and backup restore.
- Failure paths cover incomplete identities, unsupported pre-listing activity,
  incompatible measured balances, unresolved transfer costs, and write failure.
- Month-end tests require a correctly priced child; a missing child quote cannot
  silently contribute zero. Current valuation rejects stale pre-event and
  pre-listing manual/legacy prices.
- The authorized local tradebook replay matches the supplied retained/child
  quantities and invested totals for both events. Private rows, account IDs and
  screenshots are not fixtures or public evidence.
- `npm run test:v1:pc`: 151 suites / 1,579 tests passed; one pre-existing skipped
  suite and two skipped tests (opt-in live price history and external before/after
  backup-file comparison). Typecheck, all 17 Expo Doctor checks, Android
  readiness and installed-package smoke check passed. The smoke gate alone is
  not APK freshness evidence.
- Fresh local signed release APK built and installed on `emulator-5554`,
  AVD `Pixel_10_Pro`, API 36, x86_64, 1280x2856, density 480, font scale 1.0.
  No Metro server or EAS build was used. APK SHA-256:
  `A7B165972706326ED2938708994C0F5D5E99EA8D3F1DC70F75B3E510C7593973`.
- The synthetic journey `e2e/standalone/zerodha-demergers.yaml` imports two
  ordinary parent executions, accepts the Reliance match and explicitly selects
  the verified TMPV BSE successor returned by Yahoo. It checks both allocations,
  all four resulting holdings, restart, and child quote refresh. Provider
  candidate availability is an external dependency; do not bypass selection or
  weaken quantity/cost assertions when a listing response changes.
- Installed synthetic totals: retained Tata 10 / INR 688.50; TMCV 10 / INR 311.50;
  Reliance after bonus 20 / INR 953.20; JIOFIN 10 / INR 46.80. No fabricated child
  purchases or cash entries. Missing current quotes were visibly pending;
  refreshing quotes then populated TMCV's current value without changing cost.
- Local screenshots inspected: `.expo/demerger-import-summary.png`,
  `.expo/demerger-derived-children.png`, `.expo/demerger-restart.png`,
  `.expo/demerger-child-refreshed.png`. Text and financial values remain readable
  without clipping on the recorded configuration. The summary intentionally
  contains both allocation terms; this is not a broad import-screen redesign.
- Build warnings: existing Expo `expo-system-ui` advisory, Gradle deprecations,
  and Maestro wrapper Node shell deprecation. Build and flows succeeded.

To reproduce: build/install the current standalone APK using the local release
process, push `e2e/fixtures/zerodha-demergers.csv` to Android Downloads, then run
`npm run maestro:test -- e2e/standalone/zerodha-demergers.yaml`. The flow clears
synthetic emulator app data; never run it on the owner's phone/real portfolio.
Physical-phone verification of this change remains separate.

# Transaction History CSV Import

CogVest V1 can import a constrained, broker-neutral transaction history from
[`docs/templates/cogvest-transactions-v1.csv`](../templates/cogvest-transactions-v1.csv).
It can also read the supported Zerodha Equity Tradebook CSV and detailed
CAMS/KFintech mutual-fund CAS PDF formats. These are
onboarding aids for existing portfolios, not arbitrary spreadsheet, tax-lot,
or cash-reconstruction tools.

## Zerodha Equity Tradebook

1. In Zerodha Console, open **Reports → Tradebook**.
2. Select the **Equity** segment and a date range of up to 365 days.
3. Generate the report and download **CSV**, without editing its columns.
4. In CogVest, choose **Zerodha Tradebook** and add each annual CSV. Expo's
   Android picker selects one file at a time, but CogVest reviews up to ten
   files as one ordered batch.
5. Remove or reorder files before confirming. Repeated trades from overlapping
   exports are detected by Zerodha's execution-level `trade_id`.
6. Review holding matches, not individual transactions. Exact symbol/exchange/
   currency suggestions can be accepted together; ambiguous matches still need
   an explicit selection. Accepted matches stay selected as annual files change.

V1 supports delivery-equity `buy` and `sell` rows from the proven current
Tradebook layout. Each execution remains separate even when partial fills share
an `order_id`. NSE/BSE equity identity, ISIN, symbol, execution timestamp, trade
and order IDs, and local source-file provenance are retained.
Supported classifications are NSE `EQ`/`BE` and BSE `EQ`/`B`. The non-EQ
classification is retained in transaction description metadata, not rewritten
into an EQ row. Unknown classifications, auctions and rights-entitlement symbols
remain unsupported. See [NSE's series definitions](https://www.nseindia.com/static/market-data/legend-of-series)
and [Zerodha's exchange-group explanation](https://support.zerodha.com/category/trading-and-markets/trading-faqs/trading-categories-and-groups/articles/what-do-the-different-groups-on-nse-and-bse-mean).

Zerodha stores IPO/OFS allotments, buybacks, transfers, and corporate actions
in a separate **Equity (external trades)** report. Supplemental imports keep the
opening balance and do not require a statement about those events. Full-history
replacement requires an explicit confirmation that the selected account and
date ranges had no external activity. If uncertain, use Supplemental. CogVest
does not infer or silently ignore missing external history.

Changed headers, non-equity segments or series, auction rows, unsupported trade
types, malformed values, and unknown exchanges fail closed or remain visible
for review. Zerodha login, API access, XLSX, intraday, MTF, F&O, commodities,
and corporate-action reconstruction are not supported.

## Prepare The File

For the generic CogVest CSV:

1. Download or save the versioned template without changing its header.
2. Keep one transaction event per row and save the file as UTF-8 CSV.
3. Use ISO dates only: `YYYY-MM-DD`.
4. Identify each asset with an `isin`, or with both `exchange` and `symbol`.
5. Use the asset's native `currency` and a positive `quantity`.
6. For `buy` and `sell`, enter the positive per-unit `unit_price`.
7. For `transferIn`, leave `unit_price` blank. If known, enter
   `acquisition_cost` as the non-negative **per-unit** cost, not the total value.
8. For `transferOut`, leave both `unit_price` and `acquisition_cost` blank.

Optional `settlement_date`, `external_id`, `account`, `fees`, `taxes`,
`description`, and `notes` are retained as provenance and review metadata.
Fees and taxes do not implement tax calculations or create Cash Ledger entries.

Supported event types are `buy`, `sell`, `transferIn`, and `transferOut`.
Recognized but unsupported events, including dividends, splits, bonuses,
interest, cash deposits/withdrawals, and corporate actions, are shown by row
and skipped only after you review the dry run. CogVest does not guess or
silently discard them.

## Import And Review

1. Open the transaction-history import action from the Holdings/onboarding flow.
2. Choose **CogVest CSV**, **Zerodha Tradebook**, or **CAMS + KFintech CAS**
   before selecting files. CAS uses the separate PDF review flow below.
3. Choose **Add later activity** (supplemental mode) to keep existing opening balances and add only
   transactions after their measured-as-of date.
4. Choose **Rebuild from history** (full-history mode) only when the file contains the complete history for
   an affected holding and you want to reconcile it against the opening balance.
5. Save the CogVest template from the app if needed, then choose the completed CSV
   through Android's document picker.
6. Confirm exact Tradebook suggestions together or select an ambiguous match.
   The selection applies to every transaction for that ISIN. ISIN lookup falls
   back to each distinct source symbol, so an old ticker does not suppress a
   newer one. Generic CSV and CAS matching still require explicit selection.
   Provider results are never saved silently.
7. Confirm **Holdings measured as of** for each existing opening position. One
   shared date can be used, with a per-holding correction when required.
8. Read the dry-run totals, duplicate/conflict messages, unsupported rows, and
   per-holding reconciliation before confirming the import.
9. Confirm only when the review is correct. The batch is atomic; a validation,
   reconciliation, or persistence failure imports nothing.

Different historical ISINs sharing a provider ID, quote listing or saved canonical
asset are not interchangeable units. Import preflight flags these groups before
batch acceptance and does not describe them as matched. All parsed rows remain
accounted for as proposed additions, duplicates, conflicting transactions or rows
needing resolution; proposed additions are not a partially committed batch.
Keep original rows unchanged. The verified stock-split catalog currently permits
IRCTC's 2021 old/new ISIN transition and applies its five-for-one subdivision on
2021-10-28, before that day's executions. The preview explains the adjustment;
the final batch confirmation persists it with the source transactions. Other
unproven chains remain blocked. Easy Trip's verified November 2022 split/bonus
chain and November 2024 bonus are supported, with bounded historical coverage
described below. Same-ISIN continuity remains supported. See the
[stock-split contract](stock-split-contract.md) for bounded coverage and evidence.

The reviewed bonus catalog additionally supports Berger Paints' 2023 one-for-five,
HDFC Bank's 2025 one-for-one and Reliance's 2024 one-for-one bonuses, plus Easy
Trip's ordered chain, as separate non-purchase events. The original CSV is unchanged;
the adjustment appears before final confirmation. This does not accept arbitrary
zero-priced buys or unknown corporate-action rows. See the
[bonus-share contract](bonus-share-contract.md) for eligibility, credit dates,
fractional-entitlement limits and remaining coverage.

Matched holdings and resulting balances are expandable, not repeated expanded
lists. Only five exact suggestions are initially shown, with access to the full
list before accepting the batch. A missing match is explained once per holding,
not once per transaction. File date coverage helps distinguish annual files even
when Android returns an opaque document name. Genuine missing purchases, unknown
corporate actions and incompatible opening balances still block import; this
flow does not invent history to make totals reconcile.

Supplemental imports reject rows on or before the cutover so the opening
baseline is not counted twice. Full-history imports replace an opening position
only after quantity and moving weighted-average cost match it exactly and the
user confirms. Oversells, multiple baselines, and transfer-ins without known
acquisition cost remain review errors and cannot be committed in V1.
If an existing transaction and a new import contain opposite directions for the
same asset on the same date, CogVest blocks the import because separate files do
not provide trustworthy intraday ordering. Correct the date or import the ordered
events together rather than letting CogVest guess.

## Safety And Repeatability

### Detailed Mutual-Fund CAS

Choose **CAMS + KFintech CAS**, select a detailed PDF containing transaction
history, and enter its password if required. Extraction runs on the device;
the password is not saved. Review normalized transactions, identity matches,
unsupported events, and reconciliation before committing. A summary-only PDF,
unrecognized layout, or incomplete history must not be treated as a verified
transaction history. This adapter is not arbitrary PDF import or Kuvera login
integration. The source-specific review remains separate from the generic CSV
template; no real account statement belongs in repository test fixtures.

Layout and reconciliation failures appear in one expandable problem summary,
with extracted row references. They are not reported as skipped transactions.
Recognized administrative address updates are counted separately from investment
activity. A cancellation without amounts or units remains an explicit unsupported
event: CogVest must not infer a reversal or silently discard it. Printed opening,
running and closing unit balances must still reconcile.

The Android password field uses keyboard avoidance and content-position scrolling.
The synthetic `e2e/standalone/cas-password-focus.yaml` journey checks the label and
field during initial and repeated keyboard openings. Run it against a fresh
standalone APK, including a narrow display with enlarged text; it does not prove
successful PDF parsing or transaction import.

### Common Import Rules

- Current quote values are ignored by the CSV import. Quotes are refreshed or
  entered manually through the normal quote workflow after import.
- Imported transactions retain source/version, batch, row, fingerprint, and
  supplied external/account/description/fees/taxes metadata. Zerodha imports
  additionally retain local file, execution, order, exchange, segment, and
  symbol provenance.
- Repeating the same file is idempotent. A changed row with an existing external
  ID or fingerprint is a conflict and blocks the batch.
- Historical imports never create, modify, or reconstruct Cash Ledger entries.
- The transaction template is limited to 500 rows and 1 MB. It is not a backup;
  full export and restore remain separate product work.

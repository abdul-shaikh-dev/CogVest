# Transaction History CSV Import

CogVest V1 can import a constrained, broker-neutral transaction history from
[`docs/templates/cogvest-transactions-v1.csv`](../templates/cogvest-transactions-v1.csv).
It is an onboarding aid for existing portfolios, not a broker statement
adapter, spreadsheet importer, tax-lot importer, or cash reconstruction tool.

## Prepare The File

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
2. Choose **Supplemental** to keep existing opening balances and add only
   transactions after their measured-as-of date.
3. Choose **Full history** only when the file contains the complete history for
   an affected holding and you want to reconcile it against the opening balance.
4. Save the template from the app if needed, then choose the completed CSV
   through Android's document picker.
5. Select the intended asset whenever lookup returns multiple results. Provider
   results are never selected silently.
6. Confirm **Holdings measured as of** for each existing opening position. One
   shared date can be used, with a per-holding correction when required.
7. Read the dry-run totals, duplicate/conflict messages, unsupported rows, and
   per-holding reconciliation before confirming the import.
8. Confirm only when the review is correct. The batch is atomic; a validation,
   reconciliation, or persistence failure imports nothing.

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

- Current quote values are ignored by the CSV import. Quotes are refreshed or
  entered manually through the normal quote workflow after import.
- Imported transactions retain source/version, batch, row, fingerprint, and
  supplied external/account/description/fees/taxes metadata.
- Repeating the same file is idempotent. A changed row with an existing external
  ID or fingerprint is a conflict and blocks the batch.
- Historical imports never create, modify, or reconstruct Cash Ledger entries.
- The transaction template is limited to 500 rows and 1 MB. It is not a backup;
  full export and restore remain separate product work.

# Holdings CSV Import

CogVest V1 accepts one deliberately constrained CSV format for onboarding
aggregate opening positions. It does not import arbitrary spreadsheets,
transaction history, tax lots, formulas, or broker exports.

For historical buys, sells, and transfers, use the separate
[Transaction History CSV Import](transaction-csv-import.md) guide and its
versioned template.

Use the versioned template at
[`docs/templates/cogvest-holdings-v1.csv`](../templates/cogvest-holdings-v1.csv).
Keep the header unchanged and save the file as UTF-8 CSV.

## Android Flow

1. Open **Holdings**, tap **Add holdings**, then **Import holdings CSV**.
2. Tap **Save CSV template**, choose a writable local folder such as
   `Documents/CogVest`, replace the two example rows with your holdings, and
   keep the header unchanged. Android may not allow apps to select the root
   Downloads folder; choose or create a subfolder when needed.
3. Tap **Choose CSV** and select the completed file through Android's system
   document picker.
4. Review every row. Exact identities resolve automatically; ambiguous matches
   require an explicit provider selection.
5. If lookup has no result, choose **Use CSV details as manual asset**. Manual
   stocks and ETFs require `asset_class` and `exchange` in the file.
6. Explicitly approve any replacement of an existing aggregate opening
   position. Holdings with transaction history cannot be replaced.
7. Review additions, updates, currencies, pending valuations, skipped-row count,
   and portfolio totals, then choose **Import all holdings**.
8. CogVest commits the complete batch atomically and opens Quick Portfolio Setup
   review. If any required row is invalid or persistence fails, nothing imports.

## Columns

| Column | Required | Contract |
| --- | --- | --- |
| `cogvest_version` | Yes | Must be `1` for every row. |
| `name` | Conditional | Required when neither ticker nor symbol identifies the asset. |
| `ticker` | Conditional | Provider ticker, such as `HDFCBANK.NS`. |
| `symbol` | Optional | Display symbol, such as `HDFCBANK`. |
| `asset_class` | Manual fallback | `stock`, `etf`, `debt`, or `crypto`. Cash and PPF are rejected. |
| `instrument_type` | Optional | CogVest instrument key such as `stock`, `etf`, `debt`, or `crypto`. |
| `sector` | Optional | CogVest sector key such as `financialServices`, `diversified`, or `fixedIncome`. |
| `currency` | Optional | Blank defaults to `INR`. V1 imports only INR rows; the value must match the resolved asset and quote. |
| `exchange` | Manual stock/ETF | `NSE`, `BSE`, or `CRYPTO` where applicable. |
| `quantity` | Yes | Positive finite number, up to 8 decimal places after normalization. |
| `average_cost` | Yes | Positive finite unit cost. |
| `current_price` | Optional | Positive manual valuation. Omit it to use a provider quote or import as valuation pending. |
| `valuation_as_of` | With current price | Non-future `YYYY-MM-DD` date. |
| `first_purchase_date` | Optional | Non-future `YYYY-MM-DD`, blank, or `unknown`. |

The parser supports quoted cells, commas and newlines inside quoted cells, UTF-8
BOM, CRLF or LF endings, surrounding whitespace, and blank rows. The limits are
500 holdings and 1 MB per file.

## Safety Rules

- Spreadsheet formulas are never evaluated. Formula text in a numeric field is
  invalid data; text fields remain text.
- Invalid, duplicate, unresolved, or unsupported required rows block the entire
  import. CogVest never silently drops a row.
- Exact canonical matches reuse the stored asset identity.
- One existing aggregate opening position may be replaced only after explicit
  confirmation. Transaction history and multiple opening records require manual
  correction instead.
- A supplied current price is stored with manual provenance and its as-of date.
  Provider quotes retain provider identity, currency, source, and timestamp.
- PPF belongs in the dedicated PPF account flow. Cash belongs in Cash Ledger.
- Full backup/export and atomic restore remain tracked separately in issue #24.

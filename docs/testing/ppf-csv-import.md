# PPF CSV Import (#323, #748)

## Contract

Open a saved PPF account, then choose Import transaction CSV. Create new accounts
through existing PPF setup first; the import does not create duplicate accounts.
Download the template and replace its synthetic example rows. Files stay on the
device; there is no server upload or bank-statement parser.

The CSV needs `date`, `type` and `amount` columns and may add `balance` and
`note`, in any order and case (#748). Common passbook headers are read too:
Txn Date, Transaction Date or Value Date; Amount or Amt; Closing or Running
Balance; Narration, Description, Remarks or Particulars. Any other column is an
error. Dates are YYYY-MM-DD or day first: DD/MM/YYYY, DD-MM-YYYY or DD-MMM-YYYY.
Types are contribution, deposit or subscription; interest, int or interest
credit; withdrawal or partial withdrawal. Amounts are positive INR with up to
two decimal places, optionally with ₹, Rs or INR and Indian (1,50,000) or
Western (150,000) grouping. Contributions are multiples of ₹50. Existing PPF
validation still applies. Limits: 1,000 rows, 256 KiB, 500 characters per note.

When a `balance` column is present, each printed balance must follow from the
previous one and the row between them; the first mismatch names its row. Every
problem in the file is listed at once with its row and column, and nothing is
saved. When the header can't be matched, the first rows are shown as CogVest
read them, so the user can see which column is wrong.

## Adding to existing entries (#748)

Adding is the default. The file is matched against the account's existing
entries without changing anything until the user saves:

- **Before your opening balance:** dated on or before the account's balance
  date, which already includes it; skipped.
- **Already recorded:** an entry of the same type and amount on the same date,
  or within 3 days (a typed entry dated a little off); skipped. Exact matches
  are claimed first, and each existing entry matches at most one row.
- **Differs from your records:** an entry of the same type on the same date, or
  failing that within 3 days, with another amount. Both amounts are shown side by side. The user's amount is kept
  unless they choose "Use the file's amount". An entry linked to Cash is never
  changed from an import.
- **New:** nothing matches; saving adds it.

The review shows per-financial-year deposits, interest, withdrawals and closing
balance once saved, and warns (without blocking) when a year's deposits exceed
₹1.5 lakh, when a completed year after the opening balance has no interest
credit, or when a printed balance would not be reached by the records once
saved. Repeated identical new rows need confirmation that they are separate
deposits. Rows that would take the balance below zero block the save.

Saving adds the new entries and the chosen corrections in one portfolio
transition and rebuilds saved months from the earliest changed month. A
preview made before the account changed is refused. Importing the same file
again adds nothing.

## Replacing the whole history

"Replace the whole history instead" keeps the original checkpoint import below.
If the first row has a balance, the opening balance it implies must equal the
one entered.

Use the effective/value date of an officially credited transaction. For example,
interest posted on 1 April but value-dated 31 March is entered on 31 March. Do
not enter an estimated credit or silently shift a date to obtain a desired FY.
This simple format does not infer dates or retain separate posting-date fields;
an optional note may explain a posting difference. Interest is never a contribution.

Supply an opening checkpoint (balance and date) and contributions already
included at that checkpoint within its financial year. All CSV rows must be
strictly later. Enter zero prior contributions only when none occurred in that
FY through the checkpoint; do not guess from the balance. Optionally supply a
closing balance, which must reconcile before saving.

The opening checkpoint is not a CSV transaction. For complete history, a zero
checkpoint can precede the first deposit only when that date is valid for the
account's opening date/year. Otherwise include the initial deposit in the
checkpoint and omit it from the CSV. Rows on/before the checkpoint are rejected,
not silently counted a second time. The format has no opening-balance row type.

The user must confirm complete transaction coverage from the checkpoint through
today, including replacing example rows. There is no claim of full history before
the checkpoint. An incomplete older statement alone does not satisfy this
confirmation. Historical month-end snapshots are rebuilt with the normal
portfolio calculations; unavailable market valuations can still block full totals.

Preview occurs before mutation. The account identity remains unchanged. The
import prepares one checkpoint plus one complete ledger for that account, not
an additive merge. Existing balances/entry counts and the new closing balance
must be visible before an explicit replacement confirmation when data differs.
Other accounts and manual monthly snapshots are not replaced. A stale preview
is rejected if that account or ledger changed before saving.

Identical rows are retained, never silently deduplicated, and require confirmation
that they represent separate transactions. Re-importing an identical financial
timeline is a no-op preserving existing IDs and record times. Overlapping partial
files are not merged automatically. A save persists the checkpoint, ledger and
rebuilt generated snapshots in one existing portfolio transition; errors must
not partially update in-memory state or stored data.

No persistence schema or app dependency change is required. Existing backup and
restore include these ordinary PPF records. Do not commit personal statements or
log CSV contents, account identifiers, notes or amounts.

Android SDK 54 needs `withBoundedDocumentRead` during prebuild: the upstream
legacy reader excludes Downloads document URIs and assumes a single stream read.
The compatibility patch accepts granted content-provider input streams and reads
up to the requested byte limit. It does not change write/delete paths or Android
permissions. It fails if the upstream source changes; review/remove it when
upgrading Expo. PPF decoding does not require browser `atob`/`TextEncoder` globals.
`package.json` opts only `expo-file-system` into Android `buildFromSource`;
otherwise Expo's precompiled binary ignores the source patch.

## Verification

Automated coverage belongs in `ppfCsv.test.ts`, `ppfCsvImport.test.ts`,
`ppfCsvMerge.test.ts` (domain and store), `ppfCsvFile.test.ts`,
`PpfImportScreen.test.tsx` and `PpfMergePreview.test.tsx`. Native verification must use
a fresh locally built APK, the Android document picker and synthetic data.
Record template save, CSV selection, preview, confirmed balance, duplicate
re-import and cancellation. This is not satisfied by opening the import route
without checking resulting ledger data.

`e2e/ppf-csv-merge.yaml` (in the full tier; the runner copies
`fixtures/ppf-merge.csv`) adds a passbook-style file to a new account, checks
the saved balance after a restart, and checks that importing it again adds
nothing.

Repeat the replace flows on a disposable emulator (the first flow resets
synthetic app data):

```powershell
adb push e2e/fixtures/ppf-import.csv /sdcard/Download/ppf-import.csv
adb shell mkdir -p /sdcard/Download/CogVestPpfTemplate
npm run maestro:test -- e2e/standalone/ppf-csv-import.yaml
npm run maestro:test -- e2e/standalone/ppf-csv-template.yaml
```

Build and install a fresh local release APK using the documented Android release
process first. The fixture uses 2025-26 transactions and an opening checkpoint in
2024; run with a device date after April 2026. For repeating template export,
use an empty synthetic export folder so the existing filename does not conflict.

## Verified 11 September 2026

- `npm run test:v1:pc`: passed; 139 suites / 1,337 tests passed, one suite /
  two tests intentionally skipped. TypeScript and Expo Doctor (17/17) passed.
- Local signed standalone x86_64 release APK, version 1.0.2 (3), installed on
  `emulator-5554`, Android 16/API 36. No Metro or EAS cloud build.
- APK SHA-256: `DE7ACA5447260085282DB923B2DF30982BFAA4A14396095591E5F9968B65766D`.
- `ppf-csv-import.yaml`: passed. INR 10,000 checkpoint + 5,000 contribution +
  350 official interest - 1,000 withdrawal = 14,350. Verified after restart;
  same-file re-import preserved the balance without requesting replacement.
- Progress displayed generated history, INR 14.35K portfolio versus INR 14K
  invested, and a rendered stored-snapshot chart. Unit tests separately assert
  month-end values, FY attribution and absence of invented earlier snapshots.
- `ppf-csv-template.yaml`: passed. Canceled file selection left the account
  unchanged; Android folder selection saved the template. The exported file
  was read back with adb and matched the four-column synthetic sample.
- Visual review: [preview](artifacts/ppf-csv/preview.png),
  [saved account](artifacts/ppf-csv/account.png),
  [generated Progress](artifacts/ppf-csv/progress.png),
  [template export](artifacts/ppf-csv/template.png). All data is synthetic.

Native verification caught and corrected unsupported Downloads-provider reads,
an ignored native patch when Expo used its prebuilt module, duplicate recognition
after persistence reordered fields, and retained scroll position on preview.
Failure-path tests also cover malformed data, over-limit files, stale previews,
same-day duplicates, mismatched closing balances and failed persistence.

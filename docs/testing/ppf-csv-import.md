# PPF CSV Import (#323)

## Contract

Open a saved PPF account, then choose Import transaction CSV. Create new accounts
through existing PPF setup first; the import does not create duplicate accounts.
Download the template and replace its synthetic example rows. Files stay on the
device; there is no server upload or bank-statement parser.

The CSV has exactly four columns: `date,type,amount,note`. Dates are YYYY-MM-DD,
types are contribution/interest/withdrawal, amounts are positive INR with up to
two decimal places and no grouping commas, and notes are optional. Existing PPF
validation still applies. Limits: 1,000 rows, 256 KiB, 500 characters per note.

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
`ppfCsvFile.test.ts` and `PpfImportScreen.test.tsx`. Native verification must use
a fresh locally built APK, the Android document picker and synthetic data.
Record template save, CSV selection, preview, confirmed balance, duplicate
re-import and cancellation. This is not satisfied by opening the import route
without checking resulting ledger data.

Repeat on a disposable emulator (the first flow resets synthetic app data):

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

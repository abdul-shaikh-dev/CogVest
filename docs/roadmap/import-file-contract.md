# Import a file and share to CogVest (#771)

## Behaviour

- **Entry points**:
  - Settings → Investment tools → **Import a file**
  - Holdings → add menu → Import → **Any statement file**
  - The Android share sheet: CogVest accepts `ACTION_SEND` for CSV, plain text, PDF, XLS and XLSX.
- **Detection** (`src/domain/importFileDetection.ts`) reads only the first 4 KiB. For a PDF it also reads the last 4 KiB.

  | File | Detected by | Opens |
  | --- | --- | --- |
  | CogVest holdings CSV | `cogvest_version`, `quantity`, `average_cost` | Holdings CSV review |
  | CogVest transactions CSV | `cogvest_version`, `transaction_type`, `trade_date` | Transactions review, CogVest CSV source |
  | Zerodha tradebook | the tradebook's seven key columns | Transactions review, Zerodha source |
  | PPF statement CSV | the PPF import's own column rule, including passbook names | PPF review for the only account; asks among several; explains when there is none |
  | Encrypted PDF | `%PDF-` with `/Encrypt` in the trailer | Transactions review, CAS source (asks for the password as always) |
  | Readable PDF | `%PDF-` without `/Encrypt` | Asks: CAS or EPF passbook |
  | Spreadsheet | ZIP/OLE bytes, spreadsheet type or extension | Message: save it as CSV |
  | Anything else, empty or binary | — | Message listing the supported files; nothing changes |

- The chosen review reads the file once, through its existing bounded reader and size limit. It starts the review without a second picker. Nothing is saved until the user confirms that review.
- The file is held in memory only as a URI (`pendingImportFile.ts`) and is taken by one reader. A later "Choose file" tap uses the system picker. The import routes read a pending file only when "Import a file" opened them (`file=1`).

## Native pieces

- `modules/cogvest-share-intent`: returns the shared stream's URI, display name, size and type, and marks the intent handled so it is taken once. It emits `onShare` when a file is shared while CogVest is running. It never reads the file.
- `plugins/withShareTarget.js`: adds the SEND intent filter to MainActivity. VIEW is not registered for files, because a `content://` VIEW intent would reach the router as a link.
- `SharedFileReceiver` in the root layout waits for the launch redirect, like startup links, then opens Import a file.

## Boundaries

No new permission, network call or storage. Password-protected PDFs still ask for the password every time, and it is never stored.

## Tests

- Unit:
  - detection for every format, plus lookalike, damaged, empty and binary files
  - the probe's bounded reads
  - routing, the pending file and the screen
  - the share receiver and the plugin
  - the routes' pending-file pickers
- Maestro:
  - `e2e/import-file-picker.yaml`: Settings entry → transactions CSV → saved trades in evidence
  - `e2e/import-file-share.yaml`: share a PPF statement from Files → saved entries survive a restart

# EPF statement import feasibility

Research for issue #548, parent #542. This is a feasibility report, not an
implementation plan or approval. No parser, fixture file or import option is
added by it.

Status: implemented by #740. The behaviour that shipped is in the "Passbook
import" section of `docs/epf-accounting-contract.md`.

## Evidence and privacy

The owner supplied their EPFO member passbooks and asked to pursue import. They
were inspected read-only on the development PC; nothing was copied into the
repository, an issue, a pull request or any external service. Every example
below is invented. It keeps the layout and arithmetic of the real statements,
not their names, IDs, establishments, wages, amounts or personal dates.

Inspected:

- Ten EPFO **Member Passbook** PDFs, one per member ID and financial year,
  across two member IDs (one per employer). Together they cover each account
  from its first contribution to the current, still-open financial year,
  including one final claim that moved the balance to the second account.
- One "Online Transfer Claim Form (Form 13)" printout. It is a request form,
  not a statement, carries no balances, and holds more personal data (bank,
  mobile, e-mail, parent's name). It is out of scope for import.

Not available, so not assessed: employer-managed (exempted) trust statements,
the UAN-wide combined passbook, scanned or image-only statements, statements
with voluntary PF, partial withdrawals (advances), provider reversals or
revised interest.

## Format

All ten passbooks share one container:

| Property | Observed |
| --- | --- |
| File | Text PDF, creator `MemberPassbook`, producer iText 5.1.0, not encrypted |
| Scope | One member ID, one financial year per file; one page each |
| Header | Establishment ID/name, member ID/name, date of birth, UAN, financial year |
| Language | Hindi and English labels. Hindi uses a legacy non-Unicode font and extracts as unreadable Latin text, so only the English labels are usable anchors |
| Numbers | Whole rupees with Indian grouping (`1,23,456`); dates `DD-MM-YYYY` |
| Footer | End-of-statement marker, print timestamp, member ID, `Page 1 of 1` |

The PDF has a real text layer, so no OCR is needed. Plain stream-order
extraction (`pdftotext -layout`) **misaligns amounts with their row labels**.
Reading words by their vertical position puts every amount back on its row.
The app's existing on-device extractor (`expo-pdf-text-extract`, PDFBox with
`sortByPosition = true`, used by CAS import) sorts by position too, but it has
not yet been run against these files on Android.

### Layout versions

Two row layouts appear. Both were printed on the same day, so the layout
follows the financial year's data, not the download date. A parser must accept
both regardless of print date.

| Layout | Seen in | Contribution particulars |
| --- | --- | --- |
| A | Every inspected year up to FY 2024-25 | One line: `Cont. for Due-Month MMYYYY` |
| B | FY 2025-26 onward | Wrapped over three lines: `Cont. for the Due-Month`, then the amounts line, then `YYYYMM` |

The due-month code changed order (`MMYYYY` to `YYYYMM`) between layouts.
Transfer-in rows wrap in both layouts and embed the old member ID across lines.
Any statement that matches neither layout must be rejected, not guessed.

### Synthetic layout A sample

Columns: wage month, posting date, CR/DR, particulars, EPF wages, EPS wages,
then employee EPF, employer EPF and pension (EPS) amounts.

```text
EPF Passbook [ Financial Year - 2021-2022 ]
OB Int. Updated upto 31/03/2021                                  50,000   20,000   30,000
Mar-2021 01-04-2021 CR Cont. for Due-Month 042021  12,000 12,000  1,440      440    1,000
Apr-2021 01-05-2021 CR Cont. for Due-Month 052021  12,000 12,000  1,440      440    1,000
... ten more identical monthly rows ...
Total Contributions for the year [ 2021 ]                        17,280    5,280   12,000
Total Transfer-Ins/VDRs for the year [ 2021 ]                         0        0        0
Total Withdrawals for the year [ 2021 ]                               0        0        0
Int. Updated upto 31/03/2022                                      4,100    1,650        0
Closing Balance as on 31/03/2022                                 71,380   26,930   42,000
```

### Synthetic layout B row

```text
                         Cont. for the Due-Month
Mar-2025 01-04-2025 CR                             12,000 12,000  1,440      440    1,000
                         202504
```

### Synthetic transfer between member IDs

Source account, final year:

```text
Aug-2020 18-09-2020 DR Claim                            0      0  60,000   25,000        0
Total Withdrawals for the year [ 2020 ]                           60,000   25,000        0
Int. Updated upto 31/03/2021                                       1,500      600        0
Closing Balance as on 31/03/2021                                       0        0   35,000
```

Destination account, same financial year, two separate credits:

```text
                         TRANSFER IN - SAME OFFICE
                         (Old Member Id-
Jun-2020 04-08-2020 CR                                  0      0  58,500   24,400        0
                         :XXXXX00000000000000001
                         )
                         TRANSFER IN - INTEREST
                         AMOUNT ONLY (Old Member
Feb-2021 04-03-2021 CR   Id-                            0      0   1,500      600        0
                         :XXXXX00000000000000001
                         )
Total Transfer-Ins/VDRs for the year [ 2020 ]                     60,000   25,000        0
```

## Fields found

| Concept | Present? | Notes |
| --- | --- | --- |
| Employee EPF | Yes | Per row and yearly total |
| Employer EPF | Yes | Employer EPF share only; the pension share is a separate column. It changed mid-year with the EPS wage column, so it can't be derived from a fixed percentage. Take printed values only |
| EPS (pension) | Yes | Separate column and balance. Not portable: the source account keeps its EPS balance after the claim and the destination starts at ₹0. CogVest does not value EPS |
| VPF | Not seen | There is no separate column. The employee column presumably includes it, so a voluntary split is unknowable from this format |
| Official interest | Yes | One line per year, `Int. Updated upto 31/03/YYYY`, split by employee and employer |
| Provisional interest | No | The current, still-open year prints interest `0` and a closing balance "as on" the coming 31 Mar. That figure is a running balance, not a year-end closing |
| Withdrawals | Yes | `DR Claim` rows, and a yearly total |
| Transfers | Yes | Destination: `TRANSFER IN - SAME OFFICE` and `TRANSFER IN - INTEREST AMOUNT ONLY`, each citing the old member ID. Source: a plain `DR Claim`, which looks the same as a cash settlement |
| Opening / closing | Yes | `OB Int. Updated upto 31/03/YYYY` and `Closing Balance as on 31/03/YYYY`, three columns |
| Posting date | Yes | The row date. Older rows use the 1st of the following month. Recent rows carry real credit dates |
| Effective date | No separate field | Only one date per row, plus wage month and due month |
| Wage month | Yes | `Mon-YYYY`. Not unique: one month had two rows with different wages |
| Revisions / reversals | Not seen | |

## Reconciliation

Checked locally with a throwaway script, outside the repository:

- **Rows equal totals exactly.** In every statement, contribution rows sum to
  `Total Contributions`, transfer rows to `Total Transfer-Ins/VDRs` and DR rows
  to `Total Withdrawals`, for all three columns, to the rupee.
- **Year arithmetic is exact.** For every column of every statement,
  opening + contributions + transfer-ins − withdrawals + interest = closing.
- **Years chain exactly.** Each closing balance equals the next year's opening
  balance for the same member ID.
- **Cross-account transfer matches exactly.** The source's claim equals the
  sum of the destination's two transfer-in credits, by component. The
  interest-only credit equals the source's final-year interest line.
- **The settlement interest pattern from #566 holds.** In the source's final
  year, the claim includes interest up to the settlement date, yet the
  passbook prints that interest on the year-end line and closes at ₹0 EPF.

Employee and employer balances therefore reconcile exactly for this format, so
an import can be verified, not trusted.

## Ambiguous or unsupported cases

1. **Transfer timing and shape.** The destination's principal credit is
   posted **before** the source's claim date. The interest follows months later
   as a second credit. The current tracked `transfer` event has one credit date
   that must follow the debit. It cannot carry settlement interest, and the
   source settlement must be the account's last entry. The real case therefore
   can't be represented as a tracked transfer today.
2. **Settlement or transfer?** A source `DR Claim` looks identical either way.
   Only a destination statement citing the old member ID with matching amounts
   proves a transfer. A lone source statement must default to destination
   `unknown`.
3. **Lossy fallback.** Recording the source as a settlement (destination
   unknown) and the destination as two `externalTransferIn` events passes
   today's validation. It counts the moved money in both accounts between the
   two dates, and it loses known capital, because external transfer-ins carry
   capital `null`. Current wealth is right, but month-end history is
   overstated. That breaks the financial-correctness priority, so an import
   must not do this silently.
4. **Open financial year.** The running balance is not a 31 Mar closing. Late
   interest is likely too: interest for a closed year may be credited after
   the owner downloads it, so a later download of the same year can differ.
   This is inferred, not observed.
5. **VPF.** It can't be separated from employee EPF. The `voluntary` flag must
   stay unset.
6. **"VDRs"** are grouped with transfer-ins. Their meaning is not established
   by these samples, so a non-transfer row in that total must be rejected.
7. **Duplicate wage-month rows.** Wage month plus date is not a row identity.
8. **Unsupported:** trust statements, scanned PDFs, the UAN-wide combined
   passbook, multi-page statements, layouts other than A and B, partial
   withdrawals, reversals, EPS-only withdrawals and statements in other
   languages. Each should be rejected with a specific message.

## Mapping onto the existing model

The natural target is the #568 financial-year summary. Row-level import would
recreate the roughly 24 entries per year that #568 replaced, and gain nothing
for valuation.

| Passbook | CogVest (`src/domain/epf/model.ts`) |
| --- | --- |
| Member ID | One EPF account, `provider: "epfo"`. Don't store the raw member ID (see open decision) |
| First statement's opening line | Account checkpoint on that 31 Mar, `source: "epfoStatement"`. Capital is ₹0 only when the balance is ₹0 (#567), otherwise unknown |
| Closed year with contributions and interest only | One `yearSummary`: `periodStart` 1 Apr, effective 31 Mar, contributions and interest by component, `closing` required. Replay already checks the closing balance, by component |
| Pension column | Dropped. The preview shows it as excluded (EPS is not valued) |
| Final claim year | `yearSummary` up to the claim date (closing `null`), then a withdrawal with `settlement.interest` from the year-end interest line, as #566 already supports |
| Transfer between two imported member IDs | No exact target today (cases 1 and 3). Needs a model change first |
| Transfer-in from an account that was not imported | `externalTransferIn` per credit, capital `null`, with the untracked-origin limitation |
| Partial withdrawal | Split the year around it, as the contract requires. Unsupported until a sample exists |
| Open current year | `yearSummary` ending on the last posted row date, closing `null`. Never a 31 Mar closing and never a balance checkpoint |
| Coverage | `historyCompleteThrough` set only by explicit user confirmation, not by the import |

Overlap with manual records follows the existing replay rules. A summary owns
its period, so a manual contribution, interest or summary inside an imported
year is a conflict. The preview must show the conflict for the user to resolve.
Neither side is overwritten.

## Proposed implementation acceptance criteria

To be reviewed and approved as their own issue before any adapter is built.

**Prerequisite (#735):** a transfer-by-settlement model. A source
final settlement with interest paid inside the claim. One or more credits
whose sum equals the payout, by component. A credit may be posted before the
source claim date, with an explicit rule for the in-between period, so money
is never counted twice. Capital moves only when both sides know it. Manual
entry needs this too, not only import.

**Input and privacy**

- [ ] Accepts only an unencrypted EPFO Member Passbook PDF in layout A or B,
      read on-device through the existing local PDF extraction path. Nothing is
      uploaded and no credentials, scraping or sync are involved.
- [ ] Reads member ID and financial year from the content, not the filename.
      Name, date of birth, UAN and establishment are never stored, logged or
      shown beyond the preview.
- [ ] Rejects other layouts, trust statements, scans, multi-page statements and
      unknown row types with a specific message. Nothing is partly imported.

**Parsing and reconciliation**

- [ ] Rows sum to every printed total, and opening + flows = closing for each
      column. Any mismatch blocks the file.
- [ ] Several files for one member ID must chain: each closing equals the next
      opening. A gap or mismatch is shown and blocks the affected years.
- [ ] A transfer pair is matched only by old member ID plus exact component
      amounts. An unmatched `DR Claim` is a settlement with destination
      unknown, and the preview says so.

**Preview and warnings**

- [ ] The preview lists, per member ID and year: the entries to be created,
      their totals, and the excluded pension amounts. Every warning is listed
      as well: open year, untracked origin, unknown capital, transfer timing,
      unmatched claim.
- [ ] Nothing is written until the user confirms. All entries apply atomically
      through the existing EPF command and audit path, with full ledger replay.

**Re-import and revisions**

- [ ] Each imported entry carries a stable source identity, for example a
      format, member-ID-derived key, financial year and role. Re-importing an
      identical file changes nothing and says so.
- [ ] A changed file for an already-imported year (late interest, or a refreshed
      open year) shows a component-level difference. It replaces that year's
      entries only after confirmation, and the audit trail keeps the previous
      ones.
- [ ] A conflict with manual entries or a checkpoint is shown and must be
      resolved by the user. Neither side is silently overwritten.

**Verification**

- [ ] Sanitized synthetic fixtures for layouts A and B, the open year, a
      transfer pair, an unmatched claim, a mismatched total and an unknown
      layout. Domain tests on each fixture.
- [ ] The on-device extractor's output for both layouts is checked on Android
      against the PC result. The owner runs a private check against their real
      statements, and none of its output is committed.
- [ ] `npm run test:verify`, the Maestro smoke tier, and a fresh-APK check of
      the import journey that asserts the resulting balances, not only
      navigation.

## Recommendation

Import is **feasible and verifiable** for EPFO member passbooks. The format is
a stable, text-based single-year statement whose totals reconcile exactly. The
app already extracts PDF text on-device, and #568 gives a one-entry-per-year
target that replay checks against the printed closing balance.

The value over manual entry is real but modest. The #568 form already turns a
year into one checked entry, so the owner's history is about one summary per
year plus the settlement. Import would save that typing and the risk of
transcription errors. More usefully, it gives a repeatable yearly refresh.

Recommended order:

1. **First, fix the model gap** (#735, the transfer-by-settlement prerequisite above).
   It is a correctness problem that manual entry already meets, independent
   of import.
2. **Then build a narrow importer**: EPFO layouts A and B, year-summary
   granularity, exact reconciliation, and the acceptance criteria above. Keep
   transfer pairing behind the prerequisite. Years with only contributions and
   interest can go first.
3. **Do not pursue** trust-statement, scanned-PDF or UAN-wide passbook support
   until a real sample exists and someone asks for it.

## Open decisions for the owner

- Should CogVest store anything derived from the member ID for re-import
  matching? A one-way local key is enough. A raw ID would end up in backups.
- In the transfer-by-settlement model, which balance owns the money between the
  destination credit and the source claim date?
- Should an open-year import be allowed at all, or wait for the 31 Mar closing?

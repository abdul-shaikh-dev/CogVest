# Guided source import

Issue #348 makes statement acquisition part of portfolio setup without changing
the import accounting model. Quick Setup and Holdings both open the same source
guide and importer.

## User flow

1. Choose Zerodha Tradebook, CAMS + KFintech CAS, CogVest CSV, or the dedicated
   PPF account path.
2. Read the source-specific steps, open official instructions when useful, or
   choose an already-downloaded file.
3. CogVest validates the selected format and shows detected source, date
   coverage, transaction count, and holding count. Invalid or unreadable files
   show an actionable error beside selection instead of a misleading preview.
4. A portfolio with no opening positions or transactions, including a cash-only
   portfolio, rebuilds from verified history without asking for an accounting
   mode first. An existing portfolio receives the conservative `Add later
   activity` recommendation after inspection and may explicitly choose a full
   rebuild subject to existing reconciliation and replacement confirmation.
5. Matching, exception review, dry-run totals, and atomic confirmation retain
   their existing safety contracts.

## Maintained acquisition guidance

Verified 2026-09-14:

- Zerodha's official Tradebook instructions place the export under Console,
  Reports, Tradebook; require a segment and date range; offer CSV/XLSX; and limit
  one download range to 365 days. CogVest supports the Equity Tradebook CSV and
  up to ten annual files per batch. A holdings snapshot or contract note is not
  a supported substitute. Source:
  https://support.zerodha.com/category/console/reports/other-queries/articles/where-can-i-see-all-the-trades-i-ve-taken-for-a-particular-period
- CAMS identifies CAS - CAMS+KFintech as the consolidated all-RTA statement
  path. The supported CogVest input is the Detailed PDF containing transaction
  history, not a summary-only statement. Full rebuild coverage should begin
  before the first investment. Source:
  https://www.camsonline.com/InvestorServices/COL_ISMailBackServices.aspx
- KFintech's official statement form independently confirms Detailed versus
  Summary, specific-period selection, and a user-created secure PDF password.
  CogVest uses that password only for the current on-device read and never saves
  it. Source:
  https://mfs.kfintech.com/investor/General/CANBasedAccountStatement

The instructions remain readable without network access. External website
failure returns an explicit browser fallback and never blocks selecting a file.

## PPF boundary

PPF continues through its dedicated account ledger. Its downloaded CSV contains
activity after a separately entered opening balance. For example, an official
INR 100,000 balance dated 2025-03-31 belongs in the opening checkpoint fields;
the CSV begins with later contributions, interest, or withdrawals. Repeating INR
100,000 as a contribution would double count the baseline and is explicitly
warned against in the form.

## Privacy and safety

- Website access is explicit and opens outside CogVest.
- CogVest does not collect provider credentials, automate downloads, read email,
  upload files, or retain CAS passwords.
- File-picker cancellation and external-site return keep the local draft.
- Existing source parsing, identity confidence, corporate-action handling,
  opening-history checks, reconciliation, atomic save, and Cash isolation remain
  authoritative.

# Full-Portfolio Backup and Restore

Issue: [#24](https://github.com/abdul-shaikh-dev/CogVest/issues/24).
Ordering: [#138](https://github.com/abdul-shaikh-dev/CogVest/issues/138).
Decision date: 10 September 2026.
Status: behavior direction approved; implementation and verification pending.

## Product Contract

CogVest must let a user save their complete portfolio to a user-selected file
and restore it without depending on an account, cloud service, or source broker.
The owner approved complete replacement restore, not portfolio merging.

- Settings offers **Back up portfolio** and **Restore backup**.
- Export leaves the live portfolio unchanged. Show success only after the file
  is written and read back successfully. A canceled picker is not an error.
  Do not overwrite an existing backup silently. On a failed write, remove only
  the new partial file if permitted and report any cleanup failure honestly.
- Restore validates the entire selected file without mutation, then shows its
  creation date, app version, record counts, and which current records and
  preferences will be replaced. Compare counts, not misleading net additions.
- Copy explicitly says: **This replaces the portfolio on this device. It does
  not merge portfolios.** Offer backing up current data before proceeding.
- Require an explicit replacement confirmation; never restore on file selection.
- Cancellation, rejected input, and failed commits retain the original data.
- Identical-file restore never duplicates records. Duplicate IDs or conflicting
  identities within an incoming portfolio are invalid, not merge candidates.
- After success, route to Dashboard, clear obsolete form/session state, and
  apply restored preferences. Do not strand the user in the restore review.

No cloud sync, scheduled backups, arbitrary Excel imports, broker adapters,
encryption implementation, or new dependencies are authorized by this contract.
Use the existing Expo FileSystem picker/directory APIs and Expo Crypto where
appropriate. Preserve Android's existing backup and storage-permission policy.

## Inventory Verified Against Current Code

The current portfolio schema is version 9. A portable backup must be an explicit
versioned format, not a dump of all MMKV keys or a copy of the database file.

| Source | Backup treatment |
| --- | --- |
| `cogvest:v1:portfolio` | Include all assets, opening positions, trades, cash entries, monthly snapshots, PPF accounts, PPF ledger entries, and preferences. |
| Nested record fields | Preserve identities, native currencies, manual valuations, notes, conviction, planned duration, acquisition dates, cash links, quote provenance, and transaction import provenance. |
| Preferences | Include display mode, masking, default chart range, onboarding state, and dismissed nudge versions. |
| `cogvest:v1:quote-cache` | Include current quotes with unchanged source, currency, and timestamp. Manual quotes are user data, not disposable cache. Provider quotes preserve last-known offline valuation, not a promise of freshness. |
| `cogvest:v1:historical-quote-cache` | Include historical prices and provenance, including manual fallback. Preserve basis and timestamps; never relabel fallback as a historical close. |
| `cogvest.cas-folio-salt.v1` | Include the CAS fingerprint identity salt when present. Restoring source records without this salt can break later statement identity/deduplication. |
| `cogvest:v1:quick-portfolio-setup` | Exclude transient setup workflow. Already-saved holdings are in the portfolio. Clear destination setup state atomically on successful restore. |
| Asset-change journals, recovery/quarantine records | Never export operational recovery state as a healthy backup. Block normal backup/restore during unresolved recovery rather than export an apparently empty or partially recovered portfolio. Preserve recovery evidence. |
| React state, UI drafts, lookup results, request state | Exclude. Cancel/reset destination in-flight work when committing restore. |

CAS source PDFs, CSV files, passwords, extracted text, raw folio numbers, API
credentials, and signing secrets are not backup contents. The identity salt is
sensitive contextual data: do not log it or copy real values into test fixtures.
Missing salt with existing salt-dependent CAS provenance must be detected;
silently generating a different salt is not a valid full-fidelity backup.

## File and Validation Boundary

Proposed initial format: a versioned JSON envelope with CogVest format identity,
backup version, creation timestamp, app version, payload, and SHA-256 checksum.
Choose deterministic serialization and define exactly which bytes are checked.
The checksum detects corruption; it is not authentication or encryption.

The file is not encrypted. Before saving, explain that it contains sensitive
financial information and must be stored somewhere the user trusts. The chosen
Android document provider may itself sync files; do not claim all chosen
destinations are device-local. No CogVest-owned upload or cloud account is added.

- Bound input bytes, record counts, and nesting before expensive processing.
  Lock concrete limits with representative large-portfolio fixtures.
- Reject wrong format, checksum mismatch, missing required sections, unknown
  format versions, unsupported fields, malformed dates, non-finite or invalid
  amounts, mismatched currencies, duplicate IDs, and dangling references.
- Verify portfolio-level semantics: canonical asset identities, linked cash,
  inventory timelines/overselling, opening-position cutovers, PPF lifecycle and
  balance, snapshot uniqueness/provenance, and import fingerprints.
- Portfolio hydration is deliberately tolerant of some old data. Its existing
  optional arrays and unknown-field stripping are not sufficient file-import
  validation. Do not silently discard unsupported records or preferences.
- Reuse pure domain validators and supported migrations, then revalidate the
  complete migrated graph. Never migrate live storage while previewing a file.
- First-format older/current/newer compatibility must be explicit: accept only
  supported envelope/payload combinations; reject unsupported ones without
  changes. No speculative historical backup format needs to be invented.
- Export validates its own selected snapshot too; do not emit an unrestorable
  file and call the backup successful.

## Atomic Replacement and Recovery

`src/store/index.ts` already journals portfolio/current-quote/historical-quote
changes and publishes state only after persistence succeeds. Reuse that pattern,
but do not assume its three-key journal covers a full restore: CAS identity salt
and setup state are additional affected keys.

1. Parse, validate, and prepare a detached immutable replacement candidate.
2. Record a revision/fingerprint of destination data for the preview. If it has
   changed before confirmation, rebuild the preview and obtain confirmation again.
3. Prevent concurrent mutations during the commit and invalidate in-flight quote,
   snapshot, import, and setup work so old responses cannot modify restored data.
4. Durably journal all affected original keys before writing any replacements.
5. Persist the complete candidate, quote context, CAS salt, and setup reset.
6. Verify writes, finalize the journal, then publish all relevant in-memory state.
   Update or recreate the quick-setup store too, not just its persisted key.
7. If any step fails, retain/restore the original state. If rollback also fails,
   keep the durable journal and block mutations until recovery completes.

At cold launch, recovery must happen before portfolio hydration, CAS fingerprint
provider creation, or setup-session loading. Crash injection between every
persistent operation must prove the result is the entire old portfolio or the
entire committed replacement, never a mixture. Journal format changes must retain
recovery of existing asset-change journals.

Keep the restore path write-locked only for the synchronous commit boundary;
file picking and review must not freeze the app. Success must not depend on
online quote refresh or historical-provider availability.

## Delivery Plan

1. **Portable format and domain proof.** Implement explicit export selection,
   strict envelope/graph validation, deterministic integrity checking, limits,
   version compatibility, and immutable preview summaries. Prove round trips
   on synthetic mixed portfolios before exposing any restore button.
2. **Transactional store integration.** Add one replacement command, extend
   recovery to every affected key, handle stale previews/in-flight work, and
   inject write, verification, journal cleanup, rollback, and restart failures.
   Preserve all current store and migration behavior.
3. **Settings and Android file flow.** Add a focused backup/restore route using
   existing UI patterns, labeled actions, privacy warning, validation errors,
   replacement confirmation, safe Back/cancel, and post-success navigation.
   Keep backup/restore accessible in Minimal Mode.
4. **Adversarial and installed verification.** Review owned changes against
   this contract, run checks, build/install a fresh local APK, and verify actual
   Android document-provider export/selection and cold-restart persistence.
   Update #24 with evidence; close only when its full acceptance passes.

Implementation PRs reference #24; only the final complete delivery uses
`Closes #24`. The planning PR does not close the feature issue.

## Verification Matrix

| Boundary | Required evidence |
| --- | --- |
| Round trip | Stock, ETF, debt/fund, crypto with native currency, manual prices, sells with linked cash, monthly snapshots, PPF ledger, and V2 preferences retain equivalent derived results using the same valuation clock and quote context. |
| Import continuity | After restore into fresh storage, importing the same synthetic CAS/transaction source retains identity and recognizes duplicates. Test CAS salt present, absent without CAS, and invalid/missing with dependent records. |
| Validation | Corrupt JSON/checksum, wrong type, truncated file, unknown fields/versions, too-large input, invalid dates/currency/amounts, duplicate/dangling links, oversell, and unsupported records all leave destination untouched. |
| Replacement | Empty destination, populated destination, identical backup, stale preview, no-CAS source over CAS destination, and canceled restore do not blend portfolios. |
| Recovery | Inject low-storage/write failures and process restart at each operation; include rollback failure and legacy pending journals. No partial success or misleading reset. |
| Concurrency | Late quote refresh, snapshot automation, CAS import completion, and stale setup state cannot overwrite or append to the restored portfolio. |
| Android files | Picker cancellation, revoked access, read/write failure, successful save/readback, and import from a supported document provider work without broad storage permissions. |
| User journey | Settings entry, warning, preview, explicit confirmation, Back/cancel, Dashboard return, cold reopen, masking, Minimal Mode, and accessible controls. |
| Suite | Focused domain/store/component tests, `npm run test:verify`, `npm run test:v1:pc`, fresh local APK and Maestro with resulting financial-data assertions. |

Use synthetic data only. Never reset a real portfolio or reinstall destructively
for a test without explicit authorization. A fresh emulator or isolated test
fixture can establish restore-after-data-loss behavior without touching user data.
Do not trigger an EAS build or Play submission for this work.

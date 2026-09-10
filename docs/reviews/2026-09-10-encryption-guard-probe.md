# Encryption Guard Investigation (#218)

Date: 10 September 2026. Follow-up authorized by the owner after the original
[native failure reproduction](2026-09-10-encryption-feasibility.md).
Scope: isolated test APK only, extending open PR #313. Production integration
remains blocked; no CogVest data reset, app code, or app dependency changes.

## Result

A small version-pinned format check handles the original corruption cases, but
is **not a complete production native guard**. The larger matrix exposes metadata
it does not validate. No new file mutation, lost record, or process crash was
observed with this candidate, including those accepted metadata cases.

Do not confuse that narrower result with either "all corruption is handled" or
"the new guard caused data loss". Neither claim is supported.

## Candidates Tested

### Native API Check: Rejected

File-pair checks plus `MMKV.isFileValid(id, root)` reject healthy fixtures. The
normal fixture has a data-header size of 0, metadata size of 371, and metadata
version 4. Its records remain readable through MMKV.

The pinned static validator reads the old data-header length, while normal load
uses metadata length for newer versions. Exposing this API to React Native alone
would therefore lock out valid portfolios. It also cannot replace explicit file
existence checks. [Pinned MMKV_IO.cpp source](https://github.com/Tencent/MMKV/blob/v2.4.0/Core/MMKV_IO.cpp).

The recorded 25-case run exits 1: all three healthy controls are rejected. All
fixture files are preserved, but that is not a successful usability result.
[Generated API-check evidence](evidence/issue-218-api-guard-results.json).

### Version-Pinned Format Check: Partial

`scripts/encryption-probe/.../FormatGuard.java` checks the test format before
opening MMKV: both artifacts, page shape, version 4 only, flags zero, bounded
payload size from metadata, and ciphertext CRC32. Read-only record validation
and byte comparisons follow. Another comparison precedes writable opening.

This is a format parser, not an authentication mechanism. The offsets are tied
to the pinned native metadata layout; upgrading MMKV requires re-evaluation.
[Pinned metadata layout](https://github.com/Tencent/MMKV/blob/v2.4.0/Core/MMKVMetaInfo.hpp).

| Final 25-case matrix | Result |
| --- | --- |
| Normal, large (~152 KB payload), and compacted healthy stores | All three accepted; records and files preserved before the intentional write phase; write/reopen round trips passed. |
| Wrong/missing key; flipped/truncated/empty/missing data or CRC; malformed padding; version/flags/IV/size changes; primary CRC plus last-confirmed changes | All 19 rejected without modifying or recreating files; no process crash. |
| Sequence, last-confirmed size, or last-confirmed CRC changed alone | All three accepted. Both records and files preserved, and subsequent intentional write/reopen checks passed. |

The runner deliberately exits 1 for the three accepted mutated fixtures. The
rejection expectation was not weakened to turn the screen green. This is a
detection boundary, **not observed destructive recovery**. Combined primary CRC
and last-confirmed faults were rejected; the test does not establish that an
isolated sequence change will eventually lose data.
[Generated format-check evidence](evidence/issue-218-format-guard-results.json).

## Remaining Boundary

- The parser does not establish integrity/authenticity of every metadata field.
  Do not guess "valid" sequence or last-confirmed values by copying the fixture,
  reproducing MMKV's fallback machinery, or silently adding a new integrity format.
- File reads allocate before the test's 1 MiB check. A production boundary needs
  stat-first bounded/streaming reads and an approved capacity policy, not this
  probe ceiling that could reject a legitimate growing portfolio.
- Byte comparisons are not atomic open/locking. A single owner, stable file
  identity, concurrent mutation behavior, and RN instance lifetime need proof.
- Java `catch` does not contain the demonstrated uncaught C++ failure path.
  Correct native exception translation must be proved through the actual bridge.
- The Android/ABI evidence remains API 36 x86_64. SecureStore, upgrades, journals,
  recovery UX, backup integration, and release performance are still untested.

Recommendation: retain the existing app baseline and prefer a library-supported
fail-closed open/recovery policy over maintaining a private format parser. The next implementation
boundary would be a deliberately scoped native open/validation module with the
requirements above, not installing SecureStore and declaring encryption safe.
Evaluate library-supported fail-closed opening against the maintenance cost of
a custom parser before committing to that module. This investigation does not
authorize an MMKV fork, dependency patch, or storage-format/database replacement.

## Verification

- Fresh isolated probe APK installed on `emulator-5554`, API 36 x86_64.
  Final APK SHA-256:
  `4D76521DEFEDB717A2480049AA7F9B12FC38EB37685DFAAC3C33ACDD8C4EE407`.
- Guard prototype build passed offline. Initial 18-case format matrix passed
  twice with fresh fixtures, before the reviewer-requested expansion exposed the
  three accepted metadata cases. The final 25-case result supersedes that narrower
  success; its nonzero exit is intentional and must remain visible.
- Original 16-case unguarded controls re-ran and retained their failures before
  the final page/metadata expansion. Historical evidence was not overwritten.
- `npm run test:verify` passed: typecheck, 111 suites / 1,159 tests, Expo doctor 17/17.
- Independent security review confirmed the limited claim and hold decision.
  Page-alignment validation was corrected; accepted recovery metadata and the
  other native-boundary gaps remain explicitly unresolved, not marked fixed.
- No production APK, EAS build, phone test, or encrypted CogVest E2E is claimed.

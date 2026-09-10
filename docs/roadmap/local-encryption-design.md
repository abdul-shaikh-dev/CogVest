# Local Storage Encryption Design (#218)

Date: 10 September 2026. Status: approved through PR #312; native feasibility
found a preservation blocker. Follow-up guard screening is partial; production
integration is stopped, not implemented.
Issue: [#218](https://github.com/abdul-shaikh-dev/CogVest/issues/218).

See [native feasibility evidence](../reviews/2026-09-10-encryption-feasibility.md):
read-only validation accepted CRC-damaged records that default writable opening
subsequently discarded. The stop condition below applies; the existing
Android-isolated storage baseline remains unchanged.

The owner authorized a follow-up [native guard experiment](../reviews/2026-09-10-encryption-guard-probe.md).
A version-pinned check handles the initial faults but leaves metadata detection,
bounded native I/O, exception containment, and atomic ownership unresolved. It is
not a completed guard or approval to bypass the implementation gates below.

## Decision and Scope

Recommend a bounded native feasibility test of encrypted MMKV with a
Keystore-protected data key. Proceed to app integration only if the test proves
the failure behavior below. Encryption is defense in depth against offline file
disclosure, not a replacement for Android isolation or device security.

The owner confirmed all existing phone/emulator portfolios are disposable test
data. Do not build plaintext migration. Coordinate a deliberate test-data reset
before the encrypted rollout; no device reset is authorized by this document
alone. Optional manual backup before reset can preserve test data.

Proposed UX: keep opening CogVest frictionless. No app PIN, biometric prompt,
passphrase, encryption toggle, account, or cloud recovery. No scheduled/in-place
key rotation in this first delivery. Approval of this design includes one new
SDK-compatible dependency, `expo-secure-store`; it is not installed by this PR.

## Threat Model

| Asset or attacker | Protection and limit |
| --- | --- |
| Copied app-private data files, without access to the original app's Keystore operations | Intended benefit: portfolio contents cannot be read from the copied MMKV files and wrapped key alone. |
| Another ordinary Android app | Existing sandbox isolation already provides the primary protection; encryption adds little to this case. |
| Lost locked device | Android device security remains primary. Do not claim additional biometric/app-lock protection. |
| Malicious code inside CogVest, debugger, root, or compromised OS/runtime | Not protected. The running app can read records and obtain its MMKV data key. |
| Person using an already unlocked CogVest session | Not protected. Value masking is presentation, not encryption or access control. |
| Hostile file editing, rollback, deletion, or device failure | No authenticity, anti-rollback, or availability guarantee. Detect supported failures and block writes; encryption is not backup. |
| Exported JSON, source CSV/PDF, screenshots, clipboard, logs | Outside database encryption. Never log keys/records. Existing export warnings and handling of source files still apply. |

Protect every value in the app's MMKV store: portfolio, current/historical quotes,
preferences, CAS identity salt, quick-setup session, restore/asset-change journals,
and recovery/quarantine records. Do not encrypt only the main portfolio key.
Operational filenames/version markers can remain nonsensitive metadata. Source
document temporary-file behavior is not changed or claimed protected here.

## Verified Implementation Boundary

Current code calls unconfigured `createMMKV()` in
`src/services/storage/index.ts`. Portfolio, CAS identity, and setup state each
reach this factory. Root layout currently obtains the portfolio synchronously
before mounting recovery UI. All those entry points must use one initialized
storage runtime; importing a module must not open a default plaintext store.

Installed `react-native-mmkv` 4.3.1 exposes `encryptionKey: string`, explicit
`AES-256`, `readOnly`, `isEncrypted`, and re-encryption methods. Its Android build
declares native MMKV 2.4.0. The C++ constructor passes actual key bytes into MMKV;
it does not accept an Android Keystore alias. No recovery-strategy option is
exposed in its TypeScript configuration.

Upstream MMKV documents AES-CFB and default discard on CRC/length errors.
Therefore neither `isEncrypted` nor a successful constructor proves that the
original records survived. CRC is not an authentication tag. A version/sentinel
record can detect wrong-store/wrong-key outcomes but cannot authenticate the
whole database. [MMKV Android guidance](https://github.com/Tencent/MMKV/wiki/android_advance).

## Proposed Key Design

- Use SDK-54-compatible Expo SecureStore, installed through `expo install`, to
  hold a small versioned record: store generation, initialization state, and
  random MMKV data-encryption key. SecureStore protects values with Android
  Keystore; do not put the unwrapped key in MMKV, app config, environment, logs,
  exported backups, or a second file. [Expo SDK 54 SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/).
- Set `requireAuthentication: false`. Do not introduce an app authentication
  requirement through a library default or claim lock-screen-bound access.
- Keep the Keystore wrapping key distinct from the MMKV data key. The wrapping
  key is non-exportable; the MMKV data key is decrypted into process memory.
  Hardware backing is device-dependent and must not be claimed unconditionally.
  [Android Keystore](https://developer.android.com/privacy-and-security/keystore).
- Generate key material with existing Expo Crypto CSPRNG. Proposed string-safe
  encoding: 24 random bytes encoded as 32 base64 ASCII bytes, passed with explicit
  AES-256. This provides 192 bits of randomness, not 256; verify the exact UTF-8
  byte length in the native test. Do not truncate 64-character hex or 44-character
  base64 from a 32-byte secret, use UUIDs, or rely on MMKV's AES-128 default.
- Keep a single process-lifetime storage instance/key owner. Do not repeatedly
  unwrap keys per record operation. Do not promise secure erasure of JavaScript
  strings; minimizing references is not guaranteed memory zeroization.
- Keep the same key through normal restarts and signed app upgrades. No periodic
  rotation or `recrypt()` on startup. A new install/deliberate complete data reset
  creates a new key. Future in-place rotation needs its own recoverable design;
  loss of the current key is never treated as permission to rotate it.

SecureStore key values do not survive Android uninstall. Device credential or
biometric changes must be tested under the chosen non-auth-bound policy; never
promise keys cannot become inaccessible. Android backup exclusions stay enabled;
configure SecureStore without overriding CogVest's existing exclusion rules.

## Startup and Failure Contract

Introduce an asynchronous storage bootstrap before `getPortfolioStore()`, CAS
fingerprinting, setup hydration, backup service creation, or snapshot automation.
Show a bounded loading state; failure shows recovery UI instead of a black screen
or empty financial state. After bootstrap, the existing synchronous JsonStorage
interface and financial transactions can remain unchanged.

Use explicit initialization state and a store-generation sentinel. Persist and
read back the protected key record before creating the encrypted store. Write
and verify the initial empty schema and sentinel before marking initialization
ready; expose no financial writes until ready. A failed initial attempt may be
resumed only when it is provably an unfinished fresh initialization, not merely
because a key/value happens to be absent.

| Observed state | Required behavior |
| --- | --- |
| No key record and no current/legacy storage artifacts | Fresh initialization allowed. |
| Legacy plaintext artifacts exist | Block with test-rollout instructions; do not silently create a parallel empty store or retain overlooked plaintext copies. |
| Initialization record exists, no user writes have ever been exposed | Retry the same generation under the initialization protocol; unknown/contradictory artifacts fail closed. |
| Ready key, matching sentinel, safe native open | Run existing journal recovery, then validate/hydrate records before exposing the portfolio. |
| Ready record but missing store/sentinel, or ciphertext but no key | Recovery state. Do not generate a replacement key or interpret absence as first launch. |
| SecureStore error, wrong key, invalidated key, malformed metadata, damaged MMKV | Recovery state, no portfolio mutation, no automatic delete/re-key/repair. |

Preserve existing encrypted artifacts while diagnosing an error. Do not convert
decryption failure to `undefined`/`null`, pass it to tolerant legacy hydration,
or let existing quarantine logic call a corrupted encrypted store healthy.
Read-only preflight is only a candidate technique: the native test must prove
it does not modify either data or metadata files on failure and that writable
opening does not subsequently discard them. Do not open a second writable
instance to work around a failed preflight.

Check storage/key integrity before journal recovery, but do not reject a
recoverable half-written financial graph before replaying its existing journal.
Only after successful recovery may the complete portfolio be validated and
published. A recovery failure remains blocked, not an invitation to reset.

Recovery UI initially offers Retry and a clear explanation that local data could
not be unlocked. If retry fails, explain that restoration requires an independently
saved backup after a deliberate data reset. Do not add an automatic in-app wipe
or a recovery button that secretly replaces unreadable data. No backup means
recovery may be impossible; do not promise otherwise.

## Backup, Reset, and Upgrade

Portable backup format 1 remains unchanged and unencrypted. Never export a device
key, Keystore alias, or bootstrap secrets. Restoring a valid backup writes raw
records through the destination's encrypted JsonStorage; the existing five-key
restore journal must live in that same encrypted store. Keep CAS salt continuity.

For testing rollout, optionally export with the old working build, deliberately
clear that installation's data, install the encrypted build, then restore. Do not
pretend this verifies automatic plaintext migration. Do not retain an internal
plaintext rollback copy. File deletion is not a forensic secure-erasure promise.

After encrypted data exists, test a same-signature app upgrade without reset and
verify identical raw/derived records, keys, pending-journal recovery, and backup
round trip. Exported backups retained outside app storage survive a reset and
remain sensitive; never delete them as part of database cleanup.

## Implementation Order and Stop Conditions

1. **Approve this threat model and dependency proposal.** No production encryption,
   dependency installation, or device reset occurs in this design PR.
2. **Native feasibility test on isolated synthetic data.** Prove key encoding,
   SecureStore read/write persistence, wrong/missing key, altered/truncated data
   and CRC files, and byte-for-byte preservation on failed open. Test read-only
   then writable lifecycle, never assuming the facade's behavior. Inspect actual
   files/logs for plaintext test markers and secrets. Use both valid and damaged
   stores, not only mocked MMKV.
3. **Integrate only after that evidence passes.** Centralize bootstrap, fresh
   initialization, shared storage access, recovery UI, and truthful Settings
   state. Preserve journal and backup semantics. No financial model changes.
4. **Verify and deliver.** Failure-injected unit/integration tests, fresh local
   APK, encrypted-to-encrypted upgrade, native faults, Maestro backup/persistence,
   full `test:v1:pc`, and adversarial review. No EAS build.

If the installed facade cannot prevent destructive MMKV recovery, stop at the
feasibility result. Do not patch dependencies, add custom crypto/native storage,
or switch databases silently. Propose a separately approved small native guard
or retain the current Android-isolated baseline. This is a shipping blocker for
this design, not a known limitation to bury in release notes.

Performance evidence: compare the same synthetic portfolio on the same emulator
and release build configuration, at least ten cold launches per variant. Record
median/p95 time to usable Dashboard, bootstrap time, device/API and dataset size.
Report measured memory/backup latency where reliable; emulators cannot establish
hardware-backed key performance on all physical devices. A material regression
needs investigation rather than an invented success threshold.

## Approval Summary

Approved through PR #312: transparent at-rest protection using one SDK-compatible SecureStore
dependency, fresh test setup instead of migration, no app-lock/rotation features,
and a native safety test before integration. The approved no-migration scope is
already recorded in #218. Native preservation testing blocked integration. Current
privacy documentation continues to say application-layer encryption is absent
until implementation and installed verification actually establish it.

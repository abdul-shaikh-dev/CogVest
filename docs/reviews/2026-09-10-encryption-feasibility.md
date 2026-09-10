# MMKV Encryption Native Feasibility (#218)

Date: 10 September 2026. Design approved through merged PR #312.
Result: **integration stopped at the native safety gate**. No application-layer
encryption is implemented or claimed. No CogVest data was reset or changed.

## Finding

The candidate read-only preflight plus sentinel validation is not sufficient to
protect files during subsequent writable opening with default MMKV recovery.

On the same synthetic encrypted store, after flipping CRC metadata byte 0:

1. Read-only opening returned the complete sentinel and portfolio test records.
   Both files remained byte-for-byte unchanged.
2. After close, writable opening/read/close returned neither record, without
   throwing a Java exception or performing an application write.
3. The CRC file changed. The data file bytes remained unchanged, but MMKV no
   longer returned either record. This is loss of logical access, not proof that
   every original ciphertext byte was erased or that recovery is impossible.

The undamaged lifecycle control preserved both records and both files. This
demonstrates a false-safe preflight path, not just rejection of an obviously
broken sentinel. A sentinel does not validate the native CRC metadata.

Read-only access to an 8-byte truncated data file additionally terminated the
isolated JNI probe with `SIGABRT`: uncaught C++ `std::out_of_range: OutOfSpace`.
Post-crash file preservation was not established. This is not a claim that the
React Native exception boundary behaves identically; that path was not run.

## Recorded Matrix

Device: `emulator-5554`, `sdk_gphone64_x86_64`, Android API 36, x86_64.
Native library reports `v2.4.0`; dependency is `io.github.zhongwuzw:mmkv:2.4.0`,
the same native version used by installed `react-native-mmkv` 4.3.1.
APK: isolated debug `com.cogvest.encryptionprobe`; not a CogVest build.

| Fault | Read-only result | Writable result |
| --- | --- | --- |
| None | Both records returned; both files unchanged | Same |
| Wrong key | Neither record; both files unchanged | Same |
| Missing key | Neither record; both files unchanged | Same |
| Data byte flipped | Sentinel missing, portfolio returned; files unchanged | Neither record; CRC changed |
| Data truncated to 8 bytes | Native probe crashed; post-crash hashes unavailable | Neither record; data and CRC changed |
| CRC byte flipped | Both records returned; files unchanged | Neither record; CRC changed |
| CRC truncated to 4 bytes | Neither record; files unchanged | Neither record; CRC changed |

The separate valid and CRC-flipped read-only -> writable lifecycle cases confirm
the finding above. Sixteen cases ran; the runner correctly exited 1, not success.
The initial fourteen-case run independently reproduced the same fault outcomes.
Complete generated hashes and outcomes are in
[the synthetic evidence](evidence/issue-218-native-results.json).

## Verification

- Isolated `:app:assembleDebug`: passed; fresh probe APK installed before the
  recorded run. APK SHA-256:
  `82178EB2060FEAEA437E5CFD5B323284713FA60291F80B0B85DF7DF15A3C2E1A`.
- `node scripts/encryption-probe/run.mjs emulator-5554`: exited 1 as required;
  16 cases, five file-mutation outcomes and one native probe crash.
- `npm run test:verify`: passed; typecheck, 111 Jest suites / 1,159 tests, and
  all 17 Expo doctor checks.
- `node --check scripts/encryption-probe/run.mjs` and diff whitespace checks:
  passed.
- Independent security review: confirmed the same-file causal reproduction and
  integration stop; no material harness findings remained.

The first offline build attempts required correcting plugin resolution and
fetching an uncached transitive Kotlin annotation dependency. The final probe
build succeeded offline. Native library namespace/strip and Gradle deprecation
warnings do not change the measured result. No app E2E or `test:v1:pc` result is
claimed for an encrypted CogVest build: there is no such build in this change.

## Test Quality and Limits

The committed [probe](../../scripts/encryption-probe/README.md) uses no production
data. Each invocation starts a separate instrumentation process and unique store;
the seed is synced and closed before fault injection. Complete file contents are
compared after the read/open/close operation. Random keys are never included in
the report. Tests use the proposed 32 ASCII-byte base64 encoding with 192 bits of
randomness and explicit AES-256. A known plaintext marker was absent from every
seeded data file; this alone is not a full encryption or leakage audit.

These results establish a native default-recovery hazard and reject the proposed
unguarded lifecycle. They do not prove that every possible integration is unsafe.
Java JNI is not the Nitro facade; React Native instance caching/lifecycle and
exception handling remain unverified. No custom recovery handler was installed.

SecureStore, Expo key generation, credentials/key invalidation, encrypted upgrades,
backup integration, startup/recovery UX, broad leak inspection, and release
performance remain untested because the preceding preservation gate failed.
No SecureStore dependency was installed. No app startup, schema, financial logic,
privacy claims, or app dependency lockfile changed.

## Decision and Next Boundary

Follow the approved stop condition: do not integrate encryption on top of this
preflight, quietly patch MMKV, add bespoke crypto, or switch databases.

Retain the existing Android-isolated baseline for now. Issue #218 remains open
with implementation blocked, not completed. A separately approved investigation
may evaluate a small native guard that rejects invalid files before destructive
recovery and exposes safe failure to React Native. It must prove the same file
preservation contract, include native exceptions and the writable transition,
and then pass the remaining key/upgrade/recovery tests. Its feasibility and
maintenance cost are not established by this report.

# Isolated MMKV Encryption Probe

Issue #218's native screening test, not a production storage implementation.
Installs as `com.cogvest.encryptionprobe`. It never opens or resets CogVest.
All fixtures are randomly named synthetic stores inside the probe's own sandbox.
Do not add this harness to default PR CI or distribute its APK to users.

## Run on an Emulator

Requires the local Android SDK, JDK, Node, adb, and the existing generated
`android/gradlew.bat` from CogVest's documented local Android setup. No EAS build.
From the repository root in PowerShell:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA/Android/Sdk"
./android/gradlew.bat -p scripts/encryption-probe :app:assembleDebug --console=plain
adb -s emulator-5554 install -r scripts/encryption-probe/app/build/outputs/apk/debug/app-debug.apk
node scripts/encryption-probe/run.mjs emulator-5554
```

The runner writes `.expo/encryption-probe/results.json`. Exit 1 means a safety
failure or inconclusive/crashed probe, not a green acceptance run. Gradle may
need network access for uncached transitive dependencies. Subsequent builds can
use `--offline`. Never substitute CogVest's package in these commands.

For one case:

```powershell
adb -s emulator-5554 shell am instrument -w -e fault crc-flip -e mode lifecycle com.cogvest.encryptionprobe/.Probe
```

Each invocation runs in a new instrumentation process and uses a new store ID.
The lifecycle case uses the same store across read-only close and writable open.
Fixtures remain for inspection. No automatic cleanup or app-data clearing runs.

## Evidence Boundary

The APK pins `io.github.zhongwuzw:mmkv:2.4.0`, matching the installed
`react-native-mmkv` 4.3.1 Android dependency. It uses Java JNI to the same core,
explicit AES-256, single-process mode, and default recovery. It does **not** test
the Nitro/React Native facade, SecureStore, Expo Crypto, production bootstrap,
upgrade, recovery UI, or performance. Android SecureRandom supplies the proposed
24-byte -> 32-byte base64 test encoding; no device key is logged or exported.

For each case: seed two known records, sync/close, inject a fault, hash both
data and CRC files, open/read/close, compare complete file bytes and hashes.
Faults cover a wrong/missing key, data byte 16 flipped, data truncated to 8 bytes,
CRC byte 0 flipped, and CRC truncated to 4 bytes. No writes follow faulty opens.
The lifecycle test permits writable opening only after both records match in
read-only mode. Valid controls accompany each mode.

This is a falsification screen, not a complete fault catalogue or an integrity
validator. A passing result is insufficient for shipping. The plaintext check
only searches the seeded data file for a known marker; it is not a comprehensive
files/logs/keys leakage audit. Crashes prevent post-open in-process hashing and
are reported as inconclusive preservation, never as unchanged files.

See [the recorded findings](../../docs/reviews/2026-09-10-encryption-feasibility.md)
for the integration stop decision and remaining verification.

## Native Guard Investigation

The owner's follow-up authorized a bounded guard experiment, not a production
module. Rebuild/install as above, then run either candidate:

```powershell
node scripts/encryption-probe/run.mjs emulator-5554 --guarded
node scripts/encryption-probe/run.mjs emulator-5554 --format-guarded
```

`--guarded` adds file presence/size checks, native `isFileValid`, read-only record
validation, unchanged-file comparisons, then writable open. It rejects healthy
controls with this library version and is not usable.

`--format-guarded` replaces `isFileValid` with `FormatGuard`: a test-only,
version-4 metadata parser, zero flags, page-aligned bounded data, metadata payload
size and CRC32. It performs no crypto implementation or library patch. The 1 MiB
bound is not a proposed app capacity policy. The fixture collector reads files
before checking that bound; it is not a bounded-I/O production implementation.

The expanded matrix includes three healthy controls, missing/empty files, page
padding, and metadata version/flags/IV/size/sequence/last-confirmed fields. For
any accepted case, a separate write/readback phase runs **after** the preservation
hashes are captured. Rejected fixtures are never written after fault injection.
Missing artifacts use `MISSING` instead of a byte hash, allowing detection if an
open improperly recreates them.

Reports use separate `guarded-results.json` and `format-guarded-results.json`
files. The strict screening gate exits 1 if a mutated fixture is accepted, even
if its records survive. This identifies detection gaps; it does not prove every
accepted metadata mutation causes data loss. The exact recorded matrices and
remaining native boundaries are documented in
[the follow-up](../../docs/reviews/2026-09-10-encryption-guard-probe.md).

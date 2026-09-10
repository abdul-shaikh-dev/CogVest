# MMKV Library-Supported Encryption Route (#218)

Decision date: 10 September 2026. The owner chose library-supported fail-closed
opening rather than promoting CogVest's experimental format parser.
Status: no supported route established. The owner declined publishing an
upstream issue. No external report was submitted or follow-up scheduled.

## Support Check

Latest upstream release checked: [MMKV v2.4.2](https://github.com/Tencent/MMKV/releases/tag/v2.4.2).
This is a source/API inspection, not runtime verification of that release.
CogVest's installed native dependency remains 2.4.0; no upgrade was attempted.

The v2.4.2 recovery enum still offers discard and recover, not reject-and-preserve.
Its config exposes that policy, but a callback selecting either option does not
meet CogVest's no-repair/no-discard contract. The static file validator retains
the old header-length check. No supported solution was established by this
inspection. [Recovery enum](https://github.com/Tencent/MMKV/blob/v2.4.2/Core/MMKVPredef.h),
[configuration](https://github.com/Tencent/MMKV/blob/v2.4.2/Core/MMKV.h),
[validator/load implementation](https://github.com/Tencent/MMKV/blob/v2.4.2/Core/MMKV_IO.cpp).

Related discussions checked, not treated as fixes for this contract:

- [RN wrapper #442](https://github.com/margelo/react-native-mmkv/issues/442):
  corruption recovery was discussed; this request is to preserve files and fail,
  not return partially repaired records.
- [RN wrapper #903](https://github.com/margelo/react-native-mmkv/issues/903):
  encrypted storage returning empty after restart; not our deterministic repro.
- [Native #608](https://github.com/Tencent/MMKV/issues/608): missing-file validation
  semantics; existence must remain distinct from validity.
- [Native #1597](https://github.com/Tencent/MMKV/issues/1597): read-only empty-file
  crash on another platform/version; do not claim it proves our Android outcome.

## Required Library Contract

A suitable route must reject an unsafe store without automatic salvage or
discard. The existing reproduction remains in the
[native findings](../reviews/2026-09-10-encryption-feasibility.md) and
[guard investigation](../reviews/2026-09-10-encryption-guard-probe.md).

- Invalid existing stores produce a distinguishable error, not empty success.
- Rejected opening/loading preserves data and CRC bytes and file existence.
- Validation cannot pass read-only and then silently repair/discard on writable
  transition; corrupted/missing files are not automatically recreated.
- Native parsing failures surface safely through supported bindings.
- Healthy stores remain writable and survive close/reopen.

CRC/encryption is not authentication. This contract does not require detection
of every malicious file edit or anti-rollback; it requires library-owned handling
of supported failures instead of a private external format parser.

## CogVest Resume Gate

Keep #218 open and production encryption unimplemented while no suitable API is
established. Do not adopt a speculative fork, parser, or version bump as a fix.
After a concrete library-supported route is available:

1. Identify the release and compatible RN wrapper integration; inspect its
   actual non-destructive contract, not only a changelog or maintainer comment.
2. Re-run isolated valid and damaged native fixtures, including the writable
   transition; translate native errors safely through the actual RN boundary.
3. Verify bounded I/O, ownership/concurrency, and file preservation. Decide and
   document any supported-detection limits explicitly; no silent gate weakening.
4. Only then resume the approved key/bootstrap work and all remaining SecureStore,
   journal, backup, restart, upgrade, recovery-UI, and performance checks.

The experimental parser stays test-only evidence. Android sandbox isolation and
current backup protections remain the production baseline; no encryption claim
changes and no phone/emulator CogVest data reset is authorized here.

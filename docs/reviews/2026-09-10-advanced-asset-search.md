# Advanced Asset Search Verification

Issue: #23. Branch: `codex/issue-23-advanced-asset-search`.

## Verdict

Functional implementation and isolated installed-app journey pass. **Not ready
to close #23:** its strict no-stall performance gate is not demonstrated. Keep
the PR draft; do not convert passing functional tests into a performance claim.

## Delivered

- Global relevance ranking, canonical deduplication, saved-asset precedence,
  exchange/type filters, explicit provider pages of 20 up to 100 candidates.
- Clearable device-local recent selected queries and unchanged separate manual
  entry, now reachable before long result lists. Asset-class icons retained.
- Query-tagged results, abort signals and obsolete-response suppression. Saved
  portfolio changes immediately remove duplicate provider candidates.
- Rejected quote requests return to manual pricing instead of remaining pending.
- Indexed identity matching avoids repeated scans. Filtering no longer generates
  IDs for every candidate. Memoized rows and small append batches reduce repeated
  mounting work, but do not establish the performance gate.

## Verification

- Full `npm run test:v1:pc`: 113 suites / 1,175 tests passed; Expo Doctor 17/17;
  emulator detected and strict installed-package smoke passed. A subsequent
  focused test adds UI coverage for cross-provider order.
- Fresh `npm run android:apk:emulator` built successfully. The default debug
  certificate could not update the private-QA-signed installation. Re-signed a
  copy with the existing QA key and installed with `adb install -r`, preserving
  data. No EAS build, new key, uninstall or portfolio reset.
- Installed APK SHA-256:
  `3D9560D1C34664FA83DB7FA5E0AC038B2AB9234623EDD8C83C528963F3C8CDB2`.
  JavaScript verification uses current Metro code, not a standalone release.
- `e2e/discovery/advanced-search.yaml` passed: exact saved/provider matches,
  no auto-selection, pagination, Crypto filter, explicit saved-asset selection,
  opening-position save, **500 assets / 1 opening** (no duplicate asset), and
  recent-search clearing. The fixture and its history are memory-only.
- Visual inspection corrected buried manual entry and repetitive instructions;
  provider labels now accompany the globally ranked rows.
- Yahoo HTTP checks on the PC returned the same seven candidates for requested
  limits 8 and 100, including supported NSE listings. A larger requested limit
  is not a promise of more upstream results. Live-provider availability and
  completeness on Android are not comprehensively certified by fixture tests.

## Open Gate

The available AVD is **Pixel_10_Pro**, Android 16 / API 36, x86_64,
1280x2856, density 480, font scale 1.0; not the issue's named Pixel 8 reference.
Provider-callback-to-render samples were 85.8-192.1 ms. Sampled event-loop lag
exceeded 100 ms fourteen times, peaking at 277.5 ms across the warmed journey.
These measurements do not isolate JS execution from native/debug scheduling.
No crash or ANR was observed in the successful journey.

[Raw aggregate evidence](evidence/2026-09-10-asset-search.json) records the sample
values and scope. Next: attribute search/filter/page-specific stalls on the
reference configuration, correct demonstrated task-owned bottlenecks, and
repeat the gate without weakening its thresholds. General frame attribution
#299 remains parked; this report does not silently reactivate it.

# Crypto and PPF allocation verification

Related to #539 and #540. Implementation: `d686a33`, based on merged
`a519810`. No release, schema, import or ledger changes.

## Behavior

Dashboard now has Equity, Debt, Crypto and Cash reporting classes. Crypto is
spot market value plus independently reconciled Futures net equity in INR.
The collapsed Spot / Futures disclosure exposes both monetary components;
idle USDT remains included when positions are closed. Contract notional is
never passed into this allocation calculation.

Debt includes confirmed PPF account balances. The Dashboard previously
explicitly excluded recorded PPF in its allocation caption, although its total
portfolio value already included PPF. The new caption and denominator cover
the same scope. Linked legacy PPF holdings remain excluded upstream, preventing
double counting. Unlinked legacy holdings retain their existing treatment.

Negative Futures equity still produces the explicit unavailable allocation
state and Review Futures route. It is not clamped or hidden by positive spot
value. Negative Cash retains signed exposure and no allocation bars. Incomplete
Futures valuations remain blocked by the existing reconciliation/FX policy.

Monetary amounts and accessibility labels are masked. Existing relative
percentages and proportional bars remain visible, consistent with the prior
Dashboard masking contract; this change does not silently expand that policy.

Holdings/insights still measure market positions, not account-wallet wealth.
Progress already discloses that Futures is absent from monthly history; stored
snapshots were not rewritten. The XIRR contract records that reporting class
does not change external-flow boundaries. XIRR #532 remains separate.

## Automated checks

- `npm run test:v1:pc`: 197 suites / 2,070 tests passed; one suite and three
  tests skipped. Typecheck, Expo doctor 17/17 and Android strict smoke passed.
- Focused allocation/Dashboard checks passed. The final expanded closed-trade
  fixture passed 30 Dashboard tests and a final typecheck.
- Domain cases cover exact combined values, separate monetary breakdowns,
  PPF plus existing Debt, empty spot, negative Cash, missing holding values,
  null/negative/nonfinite Futures values and input immutability.
- Integrated fixture opens one ETHUSDT at 3,000 and closes at 4,000 with zero
  fees, leaving 4,000 USDT. At an evidenced 85 INR/USDT this contributes 340,000
  INR; 100,000 INR spot gives 440,000 INR Crypto. A linked 50,000 INR PPF account
  appears once. Masking leaves raw account/Cash/asset records unchanged.
- Owned-diff review checked decimal-string precision, allocation scope,
  negative/missing equity, account duplication and masked accessibility values.

## Fresh installed app

Fresh x86_64 debug APK built and installed with `adb install -r`, no clear-data
or uninstall. Metro served the implementation above. APK SHA256:
`A5B40F37D631A97F97F3F0AF31DC0B5A10619EDBC847CD41B4E331AEB7BDE957`.
Version 1.0.23 (24), local debug only, not a distributed preview.

AVD CogVest_UX_Proof, emulator-5554, API 36, 1280x2856, 480 dpi. Normal text and
cold-started font scale 1.3; font scale restored to 1.0 after testing. No claim
to fix live font transition #529, or to test TalkBack/physical phones.

Maestro created a temporary 4,000-USDT wallet and supplied dated rate and wallet
reconciliation evidence. Dashboard asserted exact accessible Crypto 1,730,400
INR and Spot 1,390,400 INR, with Futures 340,000 INR. No separate top-level
Futures allocation remained. Dark Standard, Light Standard, Dark Minimal and
Light Minimal at 130% text were captured and visually inspected. Matrix runs
also assert masked Futures amount absence and restore unmasked state.

A temporary confirmed PPF account of 1,000 INR raised Debt from 57,110 to
58,110 INR on-device. Its draft contribution was discarded; the account was
removed afterwards. Cash stayed 50,000 INR. The temporary Futures wallet was
also removed through the UI. Final assertions confirmed five assets, four
opening positions, zero trades, four Cash entries, no PPF account, no Futures
wallet and invested value 1,237,551.60 INR. No pre-existing records were removed.

Initial automation attempts stopped on the newer timestamp disclosure and an
off-screen wallet assertion. The selectors/scroll steps were corrected, and
the temporary wallet was cleaned before the successful retry. These were not
treated as passing device checks.

[Screenshots and successful flow logs](artifacts/2026-10-05-crypto-ppf-allocation/).
Installed evidence covers the populated positive-wallet case and PPF addition;
negative and unavailable variants are covered by automated domain/component
tests, not claimed as freshly re-recorded device journeys in this batch.

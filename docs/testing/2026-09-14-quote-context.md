# Quote Context Verification

Issue: #354

## Behavior verified

- Holding detail places Fresh, Stale, Manual price, or Unavailable provenance
  directly below the current value, including provider and as-of context when
  known. The detached source block below price history was removed.
- Sell / redeem labels its editable field `Actual execution price`. The nearby
  saved quote is explicitly a suggestion and never described as an execution
  price.
- A saved quote seeds the execution price once. A later quote update does not
  overwrite a value the user entered or a field the user deliberately cleared.
- The installed flow entered a sale at Rs 1,600.00, verified the holding changed
  from 25 to 24 units, and verified transaction history retained the entered
  Rs 1,600.00 per-unit price.

## Environment and checks

- Pixel_10_Pro AVD, Android API 36, emulator-5554, density 480, fresh debug APK
  built and installed from this branch.
- Normal configuration: 1280 x 2856, font scale 1.0.
- Narrow/large-text configuration: 1080 x 2409 (360 dp), font scale 1.3. The
  quote context, execution-price guidance, keyboard entry, save, 24-unit result,
  and Android Back behavior passed. The emulator was restored afterward.
- `e2e/sell-quote-context.yaml`: passed at normal size, including the stored
  Rs 1,600.00 transaction-history assertion; the core journey through the saved
  24-unit result passed at 360 dp and 130% text.
- Focused quote, holding, and sale tests: 66 passed.
- `npm run test:v1:pc`: 1,687 passed, 2 skipped; Expo Doctor 17/17,
  Android doctor, and strict installed-package smoke checks passed.

## Limitations

- This verifies visible Android semantics, keyboard handling, Back behavior, and
  saved sale data; it is not full TalkBack certification.
- Quote retrieval, freshness thresholds, valuation formulas, accounting formulas,
  and persisted schemas are unchanged.

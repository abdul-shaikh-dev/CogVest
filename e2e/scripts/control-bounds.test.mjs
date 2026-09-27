import assert from "node:assert/strict";
import test from "node:test";
import { inspectControlBounds } from "./control-bounds.mjs";

const screen = { width: 1080, height: 2400, density: 480 };
const options = { testId: "progress-mask-toggle", expectedLabel: "Mask values", screen };
const node = (bounds, label = "Mask values") =>
  `<node resource-id="progress-mask-toggle" content-desc="${label}" clickable="true" enabled="true" bounds="${bounds}"/>`;

test("accepts a complete 48dp control at the 16dp content inset", () => {
  const result = inspectControlBounds(node("[888,447][1032,591]"), options);
  assert.deepEqual(result.errors, []);
  assert.equal(result.widthDp, 48);
  assert.equal(result.heightDp, 48);
});
test("rejects a visible control touching the screen edge even at 48dp", () => {
  const result = inspectControlBounds(node("[936,447][1080,591]"), options);
  assert.match(result.errors.join(";"), /outside/);
});
test("rejects clipped bounds smaller than the minimum target", () => {
  const result = inspectControlBounds(node("[990,447][1080,591]"), options);
  assert.match(result.errors.join(";"), /smaller than 48dp/);
});
test("checks action semantics and rejects ambiguous or absent nodes", () => {
  assert.match(inspectControlBounds(node("[888,447][1032,591]", "Show values"), options).errors[0], /Expected label/);
  assert.throws(() => inspectControlBounds("<hierarchy/>", options), /found 0/);
  assert.throws(() => inspectControlBounds(node("[888,447][1032,591]").repeat(2), options), /found 2/);
});

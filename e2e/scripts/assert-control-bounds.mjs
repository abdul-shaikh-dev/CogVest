import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { inspectControlBounds } from "./control-bounds.mjs";

const [serial, testId, expectedLabel, output] = process.argv.slice(2);
if (!serial || !testId || !expectedLabel) {
  throw new Error("Usage: node assert-control-bounds.mjs <serial> <test-id> <label> [report.json]");
}
const adb = (...args) => execFileSync("adb", ["-s", serial, ...args], {
  encoding: "utf8", timeout: 20000, maxBuffer: 8 * 1024 * 1024,
});
const lastNumber = (text, expression) => [...text.matchAll(expression)].at(-1);
const size = lastNumber(adb("shell", "wm", "size"), /(?:Physical|Override) size: (\d+)x(\d+)/g);
const density = lastNumber(adb("shell", "wm", "density"), /(?:Physical|Override) density: (\d+)/g);
if (!size || !density) throw new Error("Cannot determine effective display geometry");
const xml = adb("exec-out", "uiautomator", "dump", "/dev/tty");
const report = {
  serial,
  fontScale: Number(adb("shell", "settings", "get", "system", "font_scale").trim()),
  ...inspectControlBounds(xml, {
    testId, expectedLabel,
    screen: { width: Number(size[1]), height: Number(size[2]), density: Number(density[1]) },
  }),
};
if (output) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report));
if (report.errors.length) throw new Error(report.errors.join("; "));

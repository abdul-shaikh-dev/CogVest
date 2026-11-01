// Attributes performance-probe windows (adb logcat -v monotonic) to the action
// marks written by scripts/measure-android-stalls.sh. Usage:
//   node scripts/attribute-probe-windows.mjs <marks.txt> <logcat.txt>
import fs from "node:fs";

const [marksFile, logFile] = process.argv.slice(2);
const marks = fs.readFileSync(marksFile, "utf8").trim().split(/\r?\n/).map((l) => {
  const i = l.indexOf(" ");
  return { t: Number(l.slice(0, i)), name: l.slice(i + 1) };
});
const windows = [];
for (const line of fs.readFileSync(logFile, "utf8").split(/\r?\n/)) {
  if (!line.includes("cogvest-performance")) continue;
  const t = Number(line.trim().split(/\s+/)[0]);
  const delay = Number(/"maximumDelayMs":([0-9.]+)/.exec(line)?.[1]);
  const span = Number(/"windowMs":([0-9.]+)/.exec(line)?.[1]) / 1000;
  windows.push({ start: t - span, end: t, delay });
}
const byAction = {};
for (let i = 0; i < marks.length - 1; i++) {
  const a = marks[i], b = marks[i + 1];
  const hits = windows.filter((w) => w.end > a.t && w.start < Math.min(b.t, a.t + 3));
  const max = Math.max(0, ...hits.map((w) => w.delay));
  const key = a.name.replace(/^p\d /, "");
  (byAction[key] ??= []).push(Math.round(max));
}
const over = windows.filter((w) => w.delay > 500).length;
console.log("windows", windows.length, "over 500 ms", over, "max", Math.round(Math.max(...windows.map((w) => w.delay))));
for (const [k, v] of Object.entries(byAction)) console.log(k.padEnd(24), v.join(" / "));

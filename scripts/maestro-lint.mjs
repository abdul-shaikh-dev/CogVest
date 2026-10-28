import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Enforces the selector policy in docs/testing/maestro-e2e.md for the flows
// that `npm run maestro:test` runs: act by testID, not by display copy.

// Text that only native UI shows: the Android document picker, permission
// prompts and React Native alerts. None of it can carry a testID.
// Matching is case-insensitive, as Maestro's is.
const nativeText = new Map([
  ["replace with visual qa data", "visual QA seed confirmation alert"],
  ["stage legacy data", "investing-Cash QA confirmation alert"],
  ["ok", "default React Native alert button"],
  ["select", "Android document picker"],
  ["use this folder", "Android folder picker"],
  ["documents", "Android folder picker"],
  ["allow", "Android permission prompt"],
]);
const pickerFilePattern = /\.(csv|pdf)$/u;
const annotationPattern = /^\s*#\s*selector:\s*\S/u;

export const rules = {
  "text-tap": "tapOn matches display text; tap a testID instead",
  "text-scroll": "scrollUntilVisible targets display text; scroll to the testID you act on",
  "center-element": "centerElement: true depends on content below the element",
  "typed-rr": "typed value contains \"rr\", which debug builds can mangle",
  "fixed-app-id": "appId is hardcoded; use `appId: ${APP_ID}` so the runner can target the debug or E2E build",
  "fixed-scheme": "openLink uses a fixed scheme; use `${SCHEME}://` so the debug and E2E builds can be installed together",
};

function unquote(value) {
  return value.trim().replace(/^"(.*)"$/u, "$1").replace(/^'(.*)'$/u, "$1");
}

function isAllowedText(text) {
  return nativeText.has(text.toLowerCase()) || pickerFilePattern.test(text);
}

/** Lists policy findings in one flow; a `# selector: <reason>` comment above a command exempts it. */
export function lintFlow(source) {
  const lines = source.split(/\r?\n/u);
  const findings = [];
  const indentOf = (line) => line.length - line.trimStart().length;
  // A command's own keys sit on the lines below it, indented further.
  const blockOf = (index) => {
    const indent = indentOf(lines[index]);
    const block = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (lines[next].trim() !== "" && indentOf(lines[next]) <= indent) break;
      block.push(lines[next]);
    }
    return block;
  };
  const annotated = (index) => {
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      const line = lines[previous];
      if (!line.trimStart().startsWith("#")) return false;
      if (annotationPattern.test(line)) return true;
    }
    return false;
  };
  const report = (index, rule, detail) => {
    if (!annotated(index)) findings.push({ line: index + 1, rule, detail });
  };

  lines.forEach((line, index) => {
    const tap = /^\s*(?:-\s*)?tapOn:\s*(.*)$/u.exec(line);
    if (tap) {
      const inline = tap[1].trim();
      const text = inline
        ? unquote(inline)
        : blockOf(index).map((entry) => /^\s*text:\s*(.+)$/u.exec(entry)?.[1]).find(Boolean);
      const usesId = !inline && blockOf(index).some((entry) => /^\s*id:/u.test(entry));
      if (text !== undefined && !usesId && !isAllowedText(unquote(text))) {
        report(index, "text-tap", unquote(text));
      }
    }
    if (/^\s*(?:-\s*)?scrollUntilVisible:\s*$/u.test(line)) {
      const block = blockOf(index);
      // The target is either `element: "<text>"` or an element block with `text:`.
      const text = block.map((entry) => /^\s*(?:element|text):\s*(\S.*)$/u.exec(entry)?.[1]).find(Boolean);
      if (text !== undefined && !block.some((entry) => /^\s*id:/u.test(entry)) && !isAllowedText(unquote(text))) {
        report(index, "text-scroll", unquote(text));
      }
    }
    if (/^\s*centerElement:\s*true\s*$/u.test(line)) report(index, "center-element", "");
    const typed = /^\s*(?:-\s*)?inputText:\s*(.+)$/u.exec(line);
    if (typed && /rr/iu.test(unquote(typed[1]))) report(index, "typed-rr", unquote(typed[1]));
    const appId = /^appId:\s*(.+)$/u.exec(line);
    if (appId && appId[1].trim() !== "${APP_ID}") report(index, "fixed-app-id", appId[1].trim());
    const link = /^\s*(?:-\s*)?(?:openLink|link):\s*"?([a-z][a-z0-9+.-]*):\/\//u.exec(line);
    if (link) report(index, "fixed-scheme", link[1]);
  });
  return findings;
}

/** The flows the full Maestro tier runs, plus the top-level helpers they call. */
export function policyFlows(root = ".") {
  const flows = (directory) =>
    existsSync(join(root, directory))
      ? readdirSync(join(root, directory)).filter((file) => file.endsWith(".yaml")).map((file) => `${directory}/${file}`)
      : [];
  return [...flows("e2e"), ...flows("e2e/helpers")].sort();
}

function countByRule(findings) {
  return findings.reduce((counts, finding) => ({ ...counts, [finding.rule]: (counts[finding.rule] ?? 0) + 1 }), {});
}

/** Compares findings against the baseline of flows not yet converted; it may only shrink. */
export function compareWithBaseline(findingsByFlow, baseline) {
  const problems = [];
  const flows = new Set([...Object.keys(findingsByFlow), ...Object.keys(baseline)]);
  for (const flow of [...flows].sort()) {
    const counts = countByRule(findingsByFlow[flow] ?? []);
    const allowed = baseline[flow] ?? {};
    for (const rule of new Set([...Object.keys(counts), ...Object.keys(allowed)])) {
      const found = counts[rule] ?? 0;
      const limit = allowed[rule] ?? 0;
      if (found > limit) {
        const details = (findingsByFlow[flow] ?? []).filter((finding) => finding.rule === rule)
          .map((finding) => `    line ${finding.line}${finding.detail ? `: ${finding.detail}` : ""}`);
        problems.push(`${flow}: ${found} ${rule} (baseline ${limit}). ${rules[rule]}\n${details.join("\n")}`);
      } else if (found < limit) {
        problems.push(`${flow}: ${rule} dropped to ${found} from baseline ${limit}. Run \`npm run maestro:lint -- --update-baseline\` to lock in the improvement.`);
      }
    }
  }
  return problems;
}

const baselinePath = "e2e/selector-baseline.json";

function main() {
  const findingsByFlow = Object.fromEntries(
    policyFlows().map((flow) => [flow, lintFlow(readFileSync(flow, "utf8"))]).filter(([, findings]) => findings.length > 0),
  );
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};

  if (process.argv.includes("--update-baseline")) {
    const next = {};
    for (const [flow, findings] of Object.entries(findingsByFlow)) {
      const counts = countByRule(findings);
      const allowed = baseline[flow] ?? {};
      // The baseline only records flows that predate the policy; it never grows.
      const kept = Object.fromEntries(Object.entries(counts).map(([rule, count]) => [rule, Math.min(count, allowed[rule] ?? 0)]).filter(([, count]) => count > 0));
      if (Object.keys(kept).length > 0) next[flow] = kept;
    }
    writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`UPDATED ${baselinePath}`);
  }

  const current = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
  const problems = compareWithBaseline(findingsByFlow, current);
  if (problems.length > 0) {
    console.log(`FAIL Maestro selector policy (docs/testing/maestro-e2e.md):\n${problems.join("\n")}`);
    process.exit(1);
  }
  const remaining = Object.values(current).reduce((sum, counts) => sum + Object.values(counts).reduce((a, b) => a + b, 0), 0);
  console.log(`PASS Maestro selector policy${remaining ? ` (${remaining} pre-policy selectors left in ${baselinePath})` : ""}`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("scripts/maestro-lint.mjs")) main();

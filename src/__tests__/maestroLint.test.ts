export {};

declare const require: (id: string) => unknown;
const { spawnSync } = require("node:child_process") as {
  spawnSync: (
    command: string,
    args: string[],
    options: { encoding: "utf8"; input?: string },
  ) => { status: number | null; stdout: string; stderr: string };
};

type Finding = { line: number; rule: string; detail: string };

// The lint is an ES module script; run it in Node rather than through Jest's transform.
function lint(flow: string): Finding[] {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      'import { lintFlow } from "./scripts/maestro-lint.mjs"; let source = ""; for await (const chunk of process.stdin) source += chunk; console.log(JSON.stringify(lintFlow(source)));',
    ],
    { encoding: "utf8", input: flow },
  );
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout) as Finding[];
}

function compare(findingsByFlow: Record<string, Finding[]>, baseline: Record<string, Record<string, number>>): string[] {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { compareWithBaseline } from "./scripts/maestro-lint.mjs"; console.log(JSON.stringify(compareWithBaseline(${JSON.stringify(findingsByFlow)}, ${JSON.stringify(baseline)})));`,
    ],
    { encoding: "utf8" },
  );
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout) as string[];
}

describe("Maestro selector policy lint", () => {
  it("reports display-text taps and scrolls but not testID selectors", () => {
    const findings = lint([
      "appId: com.abdulshaikh.cogvest",
      "---",
      '- tapOn: "Back to Holdings"',
      "- tapOn:",
      '    text: "Withdrawal"',
      "- tapOn:",
      "    id: cash-save",
      "- scrollUntilVisible:",
      "    element:",
      '      text: "Monthly History"',
      "- scrollUntilVisible:",
      "    element:",
      "      id: progress-history",
      "    centerElement: true",
    ].join("\n"));
    expect(findings).toEqual([
      { line: 3, rule: "text-tap", detail: "Back to Holdings" },
      { line: 4, rule: "text-tap", detail: "Withdrawal" },
      { line: 8, rule: "text-scroll", detail: "Monthly History" },
      { line: 14, rule: "center-element", detail: "" },
    ]);
  });

  it("allows native UI text and annotated exceptions", () => {
    expect(lint([
      '- tapOn: "Replace with visual QA data"',
      '- tapOn: "USE THIS FOLDER"',
      '- tapOn: "holdings-import-v1.csv"',
      "# selector: the exported file's name in the Android document picker",
      "- tapOn: ${output.backupName}",
      "- runFlow:",
      "    commands:",
      "      # A slow emulator can turn the tap into a long press.",
      "      # selector: native alert button",
      '      - tapOn: "Cancel"',
    ].join("\n"))).toEqual([]);
  });

  it("requires a reason in the exemption comment", () => {
    expect(lint(["# selector:", '- tapOn: "Cancel"'].join("\n"))).toHaveLength(1);
  });

  it("reports typed values that debug builds can mangle", () => {
    expect(lint('- inputText: "Current account"')).toEqual([
      { line: 1, rule: "typed-rr", detail: "Current account" },
    ]);
  });

  it("fails new violations and asks for the baseline to shrink, never grow", () => {
    const finding = { line: 3, rule: "text-tap", detail: "Back" };
    expect(compare({ "e2e/a.yaml": [finding] }, {})[0]).toContain("e2e/a.yaml: 1 text-tap (baseline 0)");
    expect(compare({ "e2e/a.yaml": [finding] }, { "e2e/a.yaml": { "text-tap": 1 } })).toEqual([]);
    expect(compare({}, { "e2e/a.yaml": { "text-tap": 1 } })[0]).toContain("dropped to 0 from baseline 1");
  });

  it("passes on the repository's flows", () => {
    const result = spawnSync(process.execPath, ["scripts/maestro-lint.mjs"], { encoding: "utf8" });
    expect(result.stdout).toContain("PASS Maestro selector policy");
    expect(result.status).toBe(0);
  });
});

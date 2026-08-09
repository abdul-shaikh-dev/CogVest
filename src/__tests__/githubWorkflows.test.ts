declare const process: { cwd: () => string };
declare const require: (id: string) => unknown;

const fs = require("fs") as {
  readFileSync: (path: string, encoding: "utf8") => string;
};
const path = require("path") as {
  join: (...parts: string[]) => string;
};

function readWorkflow(name: string) {
  return fs
    .readFileSync(
      path.join(process.cwd(), ".github", "workflows", name),
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

describe("GitHub workflows", () => {
  it("builds preview tags with current action runtimes and direct EAS auth", () => {
    const workflow = readWorkflow("android-preview.yml");

    expect(workflow).toContain("  push:");
    expect(workflow).toContain('      - "v*-preview.*"');
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("uses: actions/setup-node@v6");
    expect(workflow).toContain("npm install --global eas-cli@latest");
    expect(workflow).toContain("EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}");
    expect(workflow).not.toContain("expo/expo-github-action");
  });

  it("uses current action runtimes for default CI", () => {
    const workflow = readWorkflow("ci.yml");

    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("uses: actions/checkout@v6");
    expect(workflow).toContain("uses: actions/setup-node@v6");
  });
});

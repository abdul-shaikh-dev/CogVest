export {};

declare const require: (id: string) => unknown;
const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string) => string[];
};

const runner = readFileSync("scripts/maestro-run.mjs", "utf8");

function declaredFlows(name: string) {
  const declaration = runner.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  expect(declaration).not.toBeNull();
  return [...declaration![1].matchAll(/"(e2e\/[^"\n]+\.yaml)"/g)].map((match) => match[1]);
}

it("includes every top-level E2E flow exactly once in the default Maestro suite", () => {
  const registered = declaredFlows("defaultFlows");
  const files = readdirSync("e2e")
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => `e2e/${file}`);
  // Flows outside the default suite belong in e2e/standalone/.
  expect(registered.sort()).toEqual(files.sort());
});

it("keeps the smoke tier a duplicate-free subset of the default suite", () => {
  const smoke = declaredFlows("smokeFlows");
  const registered = new Set(declaredFlows("defaultFlows"));
  expect(smoke.length).toBeGreaterThan(0);
  expect(new Set(smoke).size).toBe(smoke.length);
  expect(smoke.filter((flow) => !registered.has(flow))).toEqual([]);
});

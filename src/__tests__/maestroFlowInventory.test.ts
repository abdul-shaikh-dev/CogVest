export {};

declare const require: (id: string) => unknown;
const { readFileSync, readdirSync } = require("node:fs") as {
  readFileSync: (path: string, encoding: "utf8") => string;
  readdirSync: (path: string) => string[];
};

it("includes every top-level E2E flow exactly once in the default Maestro suite", () => {
  const runner = readFileSync("scripts/maestro-run.mjs", "utf8");
  const declaration = runner.match(/const defaultFlows = \[([\s\S]*?)\];/);
  expect(declaration).not.toBeNull();
  const registered = [...declaration![1].matchAll(/"(e2e\/[^"\n]+\.yaml)"/g)]
    .map((match) => match[1]);
  const files = readdirSync("e2e")
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => `e2e/${file}`);
  expect(registered.sort()).toEqual(files.sort());
});

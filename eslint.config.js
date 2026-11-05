// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["android/*", "ios/*", "dist/*", ".expo/*", "coverage/*", "docs/**"],
  },
  {
    rules: {
      // Style only: the codebase mixes T[] and Array<T>, and #616 is not a formatting rewrite.
      "@typescript-eslint/array-type": "off",
      // Apostrophes in JSX copy are intended; still catch stray > and }.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
      // React Compiler rules new in eslint-config-expo 56. They flag existing ref
      // and effect patterns, not the SDK upgrade; re-enable them in their own change.
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // jest.mock factories run before imports and must use require().
    files: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "jest.setup.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/first": "off",
      "react/display-name": "off",
    },
  },
  {
    // Maestro runScript globals.
    files: ["e2e/scripts/**/*.js"],
    languageOptions: { globals: { output: "writable", maestro: "readonly" } },
  },
]);

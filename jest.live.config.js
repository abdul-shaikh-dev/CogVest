// Live data-provider check (#825): `npm run check:live-providers`.
// It uses the network, so the default Jest run never matches it.
module.exports = {
  globalSetup: "<rootDir>/jest.global-setup.js",
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/scripts/live-providers/restoreFetch.js"],
  testEnvironment: "<rootDir>/scripts/live-providers/liveEnvironment.js",
  testMatch: ["<rootDir>/scripts/live-providers/**/*.live.ts"],
  testTimeout: 180000,
};

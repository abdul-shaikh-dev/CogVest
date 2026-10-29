const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// babel-preset-expo inlines EXPO_PUBLIC_ values into Metro's cached transforms,
// but the cache key ignores them. Key the cache on the QA harness flag so a
// release bundle never reuses transforms from the E2E build, and the E2E build
// never reuses unflagged ones. See docs/testing/e2e-build-variant.md.
config.cacheVersion = [
  config.cacheVersion ?? "",
  `qa-harness:${process.env.EXPO_PUBLIC_COGVEST_QA_HARNESS ?? ""}`,
].join("|");

module.exports = config;

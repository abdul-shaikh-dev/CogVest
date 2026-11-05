const { withAndroidStyles } = require("expo/config-plugins");

function patchStartupWindow(styles, background) {
  const theme = styles.resources.style?.find((style) => style.$.name === "AppTheme");
  if (!theme) throw new Error("AppTheme missing; review Android startup integration.");
  if (!/^#[0-9a-f]{6}$/i.test(background)) {
    throw new Error("Startup background must be an opaque RGB color.");
  }
  // Keep the post-splash native window neutral until React paints its saved theme.
  theme.item = (theme.item ?? []).filter((item) => item.$.name !== "android:windowBackground");
  theme.item.push({ $: { name: "android:windowBackground" }, _: background });
  return styles;
}

// SDK 56 configures the splash only through the expo-splash-screen plugin entry.
function splashBackground(config) {
  const entry = (config.plugins ?? []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  );
  return entry?.[1]?.backgroundColor;
}

module.exports = (config) => withAndroidStyles(config, (mod) => {
  mod.modResults = patchStartupWindow(mod.modResults, splashBackground(config));
  return mod;
});
module.exports.patchStartupWindow = patchStartupWindow;
module.exports.splashBackground = splashBackground;

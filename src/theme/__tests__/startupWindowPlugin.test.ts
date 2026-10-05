import appConfig from "../../../app.json";

const { patchStartupWindow } = require("../../../plugins/withStartupWindow");

describe("Android post-splash window", () => {
  const createStyles = () => ({ resources: { style: [
    { $: { name: "AppTheme", parent: "Theme.AppCompat.DayNight.NoActionBar" }, item: [
      { $: { name: "colorPrimary" }, _: "@color/colorPrimary" },
      { $: { name: "android:windowBackground" }, _: "?android:colorBackground" },
    ] },
    { $: { name: "Theme.App.SplashScreen" }, item: [
      { $: { name: "android:windowBackground" }, _: "@drawable/splash" },
    ] },
  ] } });

  it("uses the existing splash color instead of the system light window", () => {
    const styles = createStyles();
    const splash = JSON.stringify(styles.resources.style[1]);
    const result = patchStartupWindow(styles, appConfig.expo.splash.backgroundColor);
    expect(result.resources.style[0].item).toEqual([
      { $: { name: "colorPrimary" }, _: "@color/colorPrimary" },
      { $: { name: "android:windowBackground" }, _: "#11181C" },
    ]);
    expect(JSON.stringify(result.resources.style[1])).toBe(splash);
    const once = JSON.stringify(result);
    expect(JSON.stringify(patchStartupWindow(result, "#11181C"))).toBe(once);
    expect(appConfig.expo.plugins).toContain("./plugins/withStartupWindow");
  });

  it("fails closed if the generated theme or configured color changes", () => {
    expect(() => patchStartupWindow({ resources: {} }, "#11181C")).toThrow("AppTheme missing");
    for (const color of [undefined, "transparent", "#11181C00"]) {
      expect(() => patchStartupWindow(createStyles(), color)).toThrow("opaque RGB");
    }
  });
});

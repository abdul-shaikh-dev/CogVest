import appConfig from "../../app.json";
import versionHistory from "../../docs/release/android-version-history.json";
import packageJson from "../../package.json";

describe("Android app identity", () => {
  const expo = appConfig.expo;

  it("configures the public app identity", () => {
    expect(packageJson.main).toBe("./index.ts");
    expect(expo.name).toBe("CogVest");
    expect(expo.slug).toBe("cogvest");
    expect(expo.scheme).toBe("cogvest");
    expect(expo.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("configures Android build identity", () => {
    expect(expo.android.package).toBe("com.abdulshaikh.cogvest");
    expect(expo.android.versionCode).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(expo.android.versionCode)).toBe(true);
    expect(expo.android.allowBackup).toBe(false);
    expect(expo.android.predictiveBackGestureEnabled).toBe(true);
  });

  it("records a strictly increasing distributable build identity", () => {
    const releases = versionHistory.releases;
    const current = releases.at(-1);

    expect(releases.length).toBeGreaterThanOrEqual(2);
    releases.slice(1).forEach((release, index) => {
      expect(release.versionCode).toBeGreaterThan(
        releases[index].versionCode,
      );
    });
    expect(new Set(releases.map((release) => release.versionCode)).size).toBe(
      releases.length,
    );
    expect(current).toMatchObject({
      status: "current",
      versionCode: expo.android.versionCode,
      versionName: expo.version,
    });
    expect(packageJson.version).toBe(expo.version);
  });

  it("links the Expo project for EAS builds", () => {
    expect(expo.owner).toBe("abdul_shaikh_dev");
    expect(expo.extra.eas.projectId).toBe(
      "e831d362-739b-4075-95b7-f5f85a48e610",
    );
  });

  it("configures Android icon and splash assets", () => {
    expect(expo.icon).toBe("./assets/icon.png");
    expect(expo.splash.image).toBe("./assets/splash-icon.png");
    expect(expo.splash.backgroundColor).toBe("#1C1B1F");
    expect(expo.android.adaptiveIcon.foregroundImage).toBe(
      "./assets/adaptive-icon.png",
    );
    expect(expo.android.adaptiveIcon.backgroundColor).toBe("#1C1B1F");
  });
});

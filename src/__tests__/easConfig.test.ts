declare const require: (id: string) => {
  cli: {
    appVersionSource: string;
    version: string;
  };
  build: Record<string, unknown>;
};

const easConfig = require("../../eas.json");

describe("EAS build profiles", () => {
  it("defines Android development, preview, and production profiles", () => {
    expect(easConfig.cli.appVersionSource).toBe("local");
    expect(easConfig.cli.version).toBe(">= 13.0.0");
    expect(easConfig.build.development).toMatchObject({
      developmentClient: true,
      distribution: "internal",
      android: {
        buildType: "apk",
      },
    });
    expect(easConfig.build.preview).toMatchObject({
      distribution: "internal",
      android: {
        buildType: "apk",
      },
    });
    // Four ABIs passed the 45-minute EAS limit; previews target phones only.
    expect(easConfig.build.preview).toMatchObject({
      env: { ORG_GRADLE_PROJECT_reactNativeArchitectures: "arm64-v8a" },
    });
    expect(easConfig.build.production).not.toHaveProperty("env");
    expect(easConfig.build.production).toMatchObject({
      distribution: "store",
      android: {
        buildType: "app-bundle",
      },
    });
  });
});

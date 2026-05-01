declare const require: (id: string) => {
  cli: {
    version: string;
  };
  build: Record<string, unknown>;
};

const easConfig = require("../../eas.json");

describe("EAS build profiles", () => {
  it("defines Android development, preview, and production profiles", () => {
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
    expect(easConfig.build.production).toMatchObject({
      distribution: "store",
      android: {
        buildType: "app-bundle",
      },
    });
  });
});

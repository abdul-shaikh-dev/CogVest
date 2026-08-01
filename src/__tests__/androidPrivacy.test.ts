declare const require: (id: string) => unknown;

type AppConfig = {
  expo?: {
    android?: { allowBackup?: boolean };
    plugins?: unknown[];
  };
};

type AndroidManifest = {
  manifest: {
    application: Array<{
      $: Record<string, string>;
    }>;
  };
};

type BackupPolicyPlugin = {
  BACKUP_DOMAINS: string[];
  applyPrivateDataBackupPolicy: (
    androidManifest: AndroidManifest,
  ) => AndroidManifest;
  dataExtractionRules: string;
  legacyBackupRules: string;
};

const appConfig = require("../../app.json") as AppConfig;
const {
  BACKUP_DOMAINS,
  applyPrivateDataBackupPolicy,
  dataExtractionRules,
  legacyBackupRules,
} = require("../../plugins/withPrivateDataBackupPolicy") as BackupPolicyPlugin;

describe("Android private data backup policy", () => {
  it("registers the durable policy and disables Expo Android backup", () => {
    expect(appConfig.expo?.android?.allowBackup).toBe(false);
    expect(appConfig.expo?.plugins).toContain(
      "./plugins/withPrivateDataBackupPolicy",
    );
  });

  it("sets defense-in-depth manifest attributes", () => {
    const manifest: AndroidManifest = {
      manifest: {
        application: [{ $: { "android:name": ".MainApplication" } }],
      },
    };

    const result = applyPrivateDataBackupPolicy(manifest);
    const attributes = result.manifest.application[0].$;

    expect(attributes["android:allowBackup"]).toBe("false");
    expect(attributes["android:fullBackupContent"]).toBe(
      "@xml/cogvest_backup_rules",
    );
    expect(attributes["android:dataExtractionRules"]).toBe(
      "@xml/cogvest_data_extraction_rules",
    );
  });

  it("excludes every Android backup domain from legacy backup", () => {
    expect(legacyBackupRules).toContain("<full-backup-content>");
    for (const domain of BACKUP_DOMAINS) {
      expect(legacyBackupRules).toContain(
        `<exclude domain="${domain}" path="." />`,
      );
    }
  });

  it("excludes every domain from every Android transfer mode", () => {
    expect(dataExtractionRules).toContain("<cloud-backup>");
    expect(dataExtractionRules).toContain("<device-transfer>");
    expect(dataExtractionRules).toContain(
      '<cross-platform-transfer platform="ios">',
    );
    for (const domain of BACKUP_DOMAINS) {
      const exclusion = `<exclude domain="${domain}" path="." />`;
      expect(dataExtractionRules.split(exclusion)).toHaveLength(4);
    }
  });
});

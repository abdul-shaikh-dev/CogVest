const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const { mkdir, writeFile } = require("fs/promises");
const path = require("path");

const BACKUP_DOMAINS = [
  "root",
  "file",
  "database",
  "sharedpref",
  "external",
  "device_root",
  "device_file",
  "device_database",
  "device_sharedpref",
];

function exclusions(indent) {
  return BACKUP_DOMAINS.map(
    (domain) => `${indent}<exclude domain="${domain}" path="." />`,
  ).join("\n");
}

const legacyBackupRules = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${exclusions("  ")}
</full-backup-content>
`;

const dataExtractionRules = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${exclusions("    ")}
  </cloud-backup>
  <device-transfer>
${exclusions("    ")}
  </device-transfer>
  <cross-platform-transfer platform="ios">
${exclusions("    ")}
  </cross-platform-transfer>
</data-extraction-rules>
`;

function applyPrivateDataBackupPolicy(androidManifest) {
  const application =
    AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

  application.$["android:allowBackup"] = "false";
  application.$["android:fullBackupContent"] =
    "@xml/cogvest_backup_rules";
  application.$["android:dataExtractionRules"] =
    "@xml/cogvest_data_extraction_rules";

  return androidManifest;
}

function withPrivateDataBackupPolicy(config) {
  config = withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = applyPrivateDataBackupPolicy(
      manifestConfig.modResults,
    );
    return manifestConfig;
  });

  return withDangerousMod(config, [
    "android",
    async (dangerousConfig) => {
      const xmlDirectory = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      await mkdir(xmlDirectory, { recursive: true });
      await Promise.all([
        writeFile(
          path.join(xmlDirectory, "cogvest_backup_rules.xml"),
          legacyBackupRules,
          "utf8",
        ),
        writeFile(
          path.join(xmlDirectory, "cogvest_data_extraction_rules.xml"),
          dataExtractionRules,
          "utf8",
        ),
      ]);
      return dangerousConfig;
    },
  ]);
}

module.exports = withPrivateDataBackupPolicy;
module.exports.BACKUP_DOMAINS = BACKUP_DOMAINS;
module.exports.applyPrivateDataBackupPolicy = applyPrivateDataBackupPolicy;
module.exports.dataExtractionRules = dataExtractionRules;
module.exports.legacyBackupRules = legacyBackupRules;

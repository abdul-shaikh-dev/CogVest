const {
  AndroidConfig,
  withAndroidManifest,
} = require("expo/config-plugins");

const RELEASE_BLOCKED_PERMISSIONS = [
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.SYSTEM_ALERT_WINDOW",
];

function applyLeastPrivilegeAndroidPermissions(androidManifest) {
  AndroidConfig.Manifest.ensureToolsAvailable(androidManifest);
  AndroidConfig.Permissions.addBlockedPermissions(
    androidManifest,
    RELEASE_BLOCKED_PERMISSIONS,
  );

  return androidManifest;
}

function withLeastPrivilegeAndroidPermissions(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    manifestConfig.modResults = applyLeastPrivilegeAndroidPermissions(
      manifestConfig.modResults,
    );
    return manifestConfig;
  });
}

module.exports = withLeastPrivilegeAndroidPermissions;
module.exports.RELEASE_BLOCKED_PERMISSIONS = RELEASE_BLOCKED_PERMISSIONS;
module.exports.applyLeastPrivilegeAndroidPermissions =
  applyLeastPrivilegeAndroidPermissions;

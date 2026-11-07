const {
  AndroidConfig,
  withAndroidManifest,
} = require("expo/config-plugins");

const RELEASE_BLOCKED_PERMISSIONS = [
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.SYSTEM_ALERT_WINDOW",
  // Merged in by expo-application's Play Install Referrer library. CogVest only
  // reads the application id from that module and never asks for the referrer.
  "com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE",
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

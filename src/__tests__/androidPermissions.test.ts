declare const require: (id: string) => unknown;

type AppConfig = {
  expo?: { plugins?: unknown[] };
};

type AndroidManifest = {
  manifest: {
    $?: Record<string, string>;
    "uses-permission"?: Array<{
      $: Record<string, string>;
    }>;
  };
};

type PermissionPlugin = {
  RELEASE_BLOCKED_PERMISSIONS: string[];
  applyLeastPrivilegeAndroidPermissions: (
    manifest: AndroidManifest,
  ) => AndroidManifest;
};

const appConfig = require("../../app.json") as AppConfig;
const {
  RELEASE_BLOCKED_PERMISSIONS,
  applyLeastPrivilegeAndroidPermissions,
} = require("../../plugins/withLeastPrivilegeAndroidPermissions") as PermissionPlugin;

describe("Android least-privilege permissions", () => {
  it("registers the durable Expo permission plugin", () => {
    expect(appConfig.expo?.plugins).toContain(
      "./plugins/withLeastPrivilegeAndroidPermissions",
    );
  });

  it("blocks storage and overlay permissions from merged release manifests", () => {
    const manifest: AndroidManifest = {
      manifest: {
        $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
        "uses-permission": [
          { $: { "android:name": "android.permission.INTERNET" } },
          ...RELEASE_BLOCKED_PERMISSIONS.map((permission) => ({
            $: { "android:name": permission },
          })),
          { $: { "android:name": "android.permission.VIBRATE" } },
        ],
      },
    };

    const result = applyLeastPrivilegeAndroidPermissions(manifest);
    const permissionNames = result.manifest["uses-permission"]?.map(
      (permission) => permission.$["android:name"],
    );

    expect(result.manifest).toMatchObject({
      $: { "xmlns:tools": "http://schemas.android.com/tools" },
    });
    expect(permissionNames).toEqual([
      "android.permission.INTERNET",
      "android.permission.VIBRATE",
      ...RELEASE_BLOCKED_PERMISSIONS,
    ]);
    for (const permission of result.manifest["uses-permission"] ?? []) {
      if (RELEASE_BLOCKED_PERMISSIONS.includes(permission.$["android:name"])) {
        expect(permission.$["tools:node"]).toBe("remove");
      }
    }
  });
});

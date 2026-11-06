const { patchStartupLinks } = require("../../plugins/withStartupLinks");
const { patchModalAppearance } = require("../../plugins/withModalAppearance");

const generatedMainActivity = `package com.abdulshaikh.cogvest

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;

describe("startup links plugin", () => {
  it("is registered with the app config", () => {
    expect(require("../../app.json").expo.plugins).toContain("./plugins/withStartupLinks");
  });

  it("holds a link only while the React context is missing and hands it over once", () => {
    const patched = patchStartupLinks(generatedMainActivity);

    expect(patched).toContain("override fun onNewIntent(intent: android.content.Intent)");
    expect(patched).toContain("host.currentReactContext == null && intent.data != null");
    expect(patched).toContain("host.removeReactInstanceEventListener(this)");
    expect(patched).toContain("pendingStartupLink = null\n            host.onNewIntent(pending)");
    // Every other link takes React Native's normal path.
    expect(patched).toContain("super.onNewIntent(intent)");
  });

  it("is idempotent and coexists with the modal appearance patch", () => {
    const once = patchStartupLinks(patchModalAppearance(generatedMainActivity));

    expect(patchStartupLinks(once)).toBe(once);
    expect(once.match(/override fun onNewIntent\(/g)).toHaveLength(1);
    expect(once).toContain("override fun onResume()");
  });

  it("refuses an unexpected MainActivity instead of patching it blindly", () => {
    expect(() => patchStartupLinks("class MainActivity : AppCompatActivity() {\n}\n"))
      .toThrow("MainActivity lifecycle changed");
    expect(() => patchStartupLinks(generatedMainActivity.replace(
      "override fun getMainComponentName",
      "override fun onNewIntent(intent: android.content.Intent) {}\n  override fun getMainComponentName",
    ))).toThrow("MainActivity lifecycle changed");
  });
});

const { withMainActivity } = require("expo/config-plugins");

// React Native drops a link that reaches a running app before its React
// instance is ready: with no context it raises a soft exception, and while the
// instance is still being created the event module is missing. Hold the latest
// such intent and hand it to React once the instance listeners run; the JS
// entry captures it until the router can open it. Nothing is kept after
// delivery, so a recreated Activity does not replay an old link.
//
// Readiness is process-wide: the listener is registered in onPostCreate, which
// runs on the UI thread before React can run its instance listeners there.
const marker = "// CogVest: hand early links to React once its instance is ready.";
const endMarker = "// End CogVest startup links.";
const implementation = `
  ${marker}
  override fun onPostCreate(savedInstanceState: android.os.Bundle?) {
    super.onPostCreate(savedInstanceState)
    if (reactInstanceReady || listeningForReactInstance) return
    val host = (application as com.facebook.react.ReactApplication).reactHost ?: return
    listeningForReactInstance = true
    host.addReactInstanceEventListener(object : com.facebook.react.ReactInstanceEventListener {
      override fun onReactContextInitialized(context: com.facebook.react.bridge.ReactContext) {
        host.removeReactInstanceEventListener(this)
        reactInstanceReady = true
        val pending = pendingStartupLink ?: return
        pendingStartupLink = null
        host.onNewIntent(pending)
      }
    })
  }

  override fun onNewIntent(intent: android.content.Intent) {
    if (!reactInstanceReady && listeningForReactInstance && intent.data != null) {
      pendingStartupLink = intent
      return
    }
    super.onNewIntent(intent)
  }

  private companion object {
    @Volatile private var reactInstanceReady = false
    @Volatile private var listeningForReactInstance = false
    @Volatile private var pendingStartupLink: android.content.Intent? = null
  }
  ${endMarker}
`;

function patchStartupLinks(source) {
  if (source.includes(marker)) {
    const end = source.indexOf(endMarker);
    if (end < 0) throw new Error("Startup links end marker missing; review native integration.");
    return source.slice(0, source.indexOf(marker)) + implementation.trim() +
      source.slice(end + endMarker.length);
  }
  const anchor = "class MainActivity : ReactActivity() {";
  if (!source.includes(anchor) || /override fun onNewIntent\(/.test(source)) {
    throw new Error("MainActivity lifecycle changed; review startup link integration.");
  }
  return source.replace(anchor, `${anchor}\n${implementation}`);
}

module.exports = (config) => withMainActivity(config, (mod) => {
  if (mod.modResults.language !== "kt") throw new Error("Startup links require Kotlin MainActivity.");
  mod.modResults.contents = patchStartupLinks(mod.modResults.contents);
  return mod;
});
module.exports.patchStartupLinks = patchStartupLinks;

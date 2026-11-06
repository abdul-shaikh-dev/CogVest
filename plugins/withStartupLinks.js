const { withMainActivity } = require("expo/config-plugins");

// React Native drops a link that reaches a running app before its React
// context exists ("Tried to access onNewIntent while context is not ready").
// Hold that one intent and hand it to React once the context is ready; the
// JS entry captures it until the router can open it. Nothing is stored after
// delivery, so a recreated Activity does not replay an old link.
const marker = "// CogVest: hand early links to React once its context is ready.";
const endMarker = "// End CogVest startup links.";
const implementation = `
  ${marker}
  private var pendingStartupLink: android.content.Intent? = null

  override fun onNewIntent(intent: android.content.Intent) {
    val host = (application as com.facebook.react.ReactApplication).reactHost
    if (host != null && host.currentReactContext == null && intent.data != null) {
      val waiting = pendingStartupLink != null
      pendingStartupLink = intent
      if (!waiting) {
        host.addReactInstanceEventListener(object : com.facebook.react.ReactInstanceEventListener {
          override fun onReactContextInitialized(context: com.facebook.react.bridge.ReactContext) {
            host.removeReactInstanceEventListener(this)
            val pending = pendingStartupLink ?: return
            pendingStartupLink = null
            host.onNewIntent(pending)
          }
        })
      }
      return
    }
    super.onNewIntent(intent)
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

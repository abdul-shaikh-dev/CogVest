const { withMainActivity } = require("expo/config-plugins");

const marker = "// CogVest: keep open modal system bars readable across uiMode changes.";
const endMarker = "// End CogVest modal appearance.";
const implementation = `
  ${marker}
  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    window.decorView.post { updateModalAppearance() }
  }

  override fun onResume() {
    super.onResume()
    window.decorView.post { updateModalAppearance() }
  }

  private fun updateModalAppearance() {
    val light = resources.configuration.uiMode and
      android.content.res.Configuration.UI_MODE_NIGHT_MASK !=
      android.content.res.Configuration.UI_MODE_NIGHT_YES
    fun visit(view: android.view.View) {
      if (view is com.facebook.react.views.modal.ReactModalHostView) {
        view.dialog?.window?.let { modalWindow ->
          androidx.core.view.WindowInsetsControllerCompat(modalWindow, modalWindow.decorView).apply {
            isAppearanceLightStatusBars = light
            isAppearanceLightNavigationBars = light
          }
          visit(modalWindow.decorView)
        }
        return
      }
      if (view is android.view.ViewGroup) {
        for (index in 0 until view.childCount) visit(view.getChildAt(index))
      }
    }
    visit(window.decorView)
  }
  ${endMarker}
`;

function patchModalAppearance(source) {
  if (source.includes(marker)) {
    const end = source.indexOf(endMarker);
    if (end < 0) throw new Error("Modal appearance end marker missing; review native integration.");
    return source.slice(0, source.indexOf(marker)) + implementation.trim() +
      source.slice(end + endMarker.length);
  }
  const anchor = "class MainActivity : ReactActivity() {";
  if (!source.includes(anchor) || /override fun (onConfigurationChanged|onResume)\(/.test(source)) {
    throw new Error("MainActivity lifecycle changed; review modal appearance integration.");
  }
  return source.replace(anchor, `${anchor}\n${implementation}`);
}

module.exports = (config) => withMainActivity(config, (mod) => {
  if (mod.modResults.language !== "kt") throw new Error("Modal appearance requires Kotlin MainActivity.");
  mod.modResults.contents = patchModalAppearance(mod.modResults.contents);
  return mod;
});
module.exports.patchModalAppearance = patchModalAppearance;

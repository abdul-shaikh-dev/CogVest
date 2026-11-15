package com.abdulshaikh.cogvest.screensecurity

import android.util.Log
import android.view.WindowManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sets or clears FLAG_SECURE for the "Block screenshots" setting (#660).
 *
 * It needs no permission: it never detects or reads screenshots. The wanted
 * state is remembered and re-applied whenever the activity returns to the
 * foreground, so a recreated window, or a setting applied before the activity
 * existed, is still protected.
 *
 * Expo can call the lifecycle hooks on the JS thread (for example while the
 * module is created at import), so the window is only touched on the UI
 * thread, and a failure is logged rather than thrown into app start-up.
 */
class ScreenSecurityModule : Module() {
  @Volatile private var secure = false

  private fun apply() {
    val activity = appContext.currentActivity ?: return
    val wanted = secure
    activity.runOnUiThread {
      try {
        if (wanted) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        }
      } catch (error: Throwable) {
        Log.w("CogVestScreenSecurity", "Could not update FLAG_SECURE: ${error.message}")
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("CogVestScreenSecurity")

    AsyncFunction("setSecure") { enabled: Boolean ->
      secure = enabled
      apply()
    }

    OnActivityEntersForeground {
      apply()
    }
  }
}

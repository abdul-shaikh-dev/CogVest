package com.abdulshaikh.cogvest.screensecurity

import android.view.WindowManager
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Sets or clears FLAG_SECURE for the "Block screenshots" setting (#660).
 *
 * It needs no permission: it never detects or reads screenshots. The wanted
 * state is remembered and re-applied whenever the activity returns to the
 * foreground, so a recreated window, or a setting applied before the activity
 * existed, is still protected.
 */
class ScreenSecurityModule : Module() {
  private var secure = false

  private fun apply() {
    val window = appContext.currentActivity?.window ?: return
    if (secure) {
      window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    } else {
      window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("CogVestScreenSecurity")

    AsyncFunction("setSecure") { enabled: Boolean ->
      secure = enabled
      apply()
    }.runOnQueue(Queues.MAIN)

    OnActivityEntersForeground {
      apply()
    }
  }
}

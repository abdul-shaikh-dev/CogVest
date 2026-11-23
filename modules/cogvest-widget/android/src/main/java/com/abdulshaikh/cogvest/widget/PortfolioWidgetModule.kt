package com.abdulshaikh.cogvest.widget

import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Stores the portfolio widget snapshot and redraws placed widgets (#786).
 * A failure is logged, never thrown: the widget must not break the app.
 */
class PortfolioWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CogVestWidget")

    AsyncFunction("setSnapshot") { kind: String, value: String?, change: String?, updated: String? ->
      val context = appContext.reactContext ?: return@AsyncFunction
      try {
        PortfolioWidgetStore.write(context, PortfolioWidgetSnapshot(kind, value, change, updated))
        PortfolioWidgetProvider.refreshAll(context)
      } catch (error: Throwable) {
        Log.w("CogVestWidget", "Could not update the widget: ${error.message}")
      }
    }
  }
}

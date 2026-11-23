package com.abdulshaikh.cogvest.widget

import android.content.Context

/**
 * What the portfolio widget shows (#786). The app writes it; the widget only
 * reads it. It holds display text the app already formatted, never records.
 *
 * Only the "value" kind stores amounts. Writing any other kind removes them,
 * so a hidden widget keeps no value on disk.
 */
data class PortfolioWidgetSnapshot(
  val kind: String,
  val value: String? = null,
  val change: String? = null,
  val updated: String? = null,
)

object PortfolioWidgetStore {
  private const val FILE = "cogvest_portfolio_widget"
  private const val KIND = "kind"
  private const val VALUE = "value"
  private const val CHANGE = "change"
  private const val UPDATED = "updated"

  /** Kinds the app may write. Anything else is treated as hidden. */
  val kinds = setOf("hidden", "empty", "pending", "value")

  fun read(context: Context): PortfolioWidgetSnapshot {
    val prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
    // Before the app has written anything, the widget shows nothing private.
    val kind = prefs.getString(KIND, null) ?: return PortfolioWidgetSnapshot("setup")
    if (kind !in kinds) return PortfolioWidgetSnapshot("hidden")
    return PortfolioWidgetSnapshot(
      kind = kind,
      value = prefs.getString(VALUE, null),
      change = prefs.getString(CHANGE, null),
      updated = prefs.getString(UPDATED, null),
    )
  }

  fun write(context: Context, snapshot: PortfolioWidgetSnapshot) {
    val kind = if (snapshot.kind in kinds) snapshot.kind else "hidden"
    val editor = context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().clear()
    editor.putString(KIND, kind)
    if (kind == "value") {
      editor.putString(VALUE, snapshot.value)
      editor.putString(CHANGE, snapshot.change)
    }
    if (kind == "value" || kind == "pending") {
      editor.putString(UPDATED, snapshot.updated)
    }
    // commit, not apply: a hide must be on disk before the widget redraws.
    editor.commit()
  }
}

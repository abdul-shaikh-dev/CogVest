package com.abdulshaikh.cogvest.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews

/**
 * The home-screen portfolio widget (#786). It draws the snapshot the app last
 * stored and opens the app when tapped, through App lock when it is on. It
 * has no update period and no network access of its own.
 *
 * One row high it shows only the value or state; from about two rows it adds
 * the title, the day change and when prices were fetched.
 */
class PortfolioWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    render(context, manager, appWidgetIds)
  }

  /** Before Android 12 the launcher reports a resize here; the layout follows the new height. */
  override fun onAppWidgetOptionsChanged(
    context: Context,
    manager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle,
  ) {
    render(context, manager, intArrayOf(appWidgetId))
  }

  companion object {
    /**
     * The full layout needs about this much height (dp): padding, title, value,
     * change and price lines. Below it, as at one row (about 100 dp), the widget
     * uses the small layout rather than cut lines off.
     */
    private const val FULL_MIN_HEIGHT_DP = 130

    /** Redraws every placed widget from the stored snapshot. */
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, PortfolioWidgetProvider::class.java))
      if (ids.isNotEmpty()) render(context, manager, ids)
    }

    private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val snapshot = PortfolioWidgetStore.read(context)
      ids.forEach { id ->
        val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          // The launcher picks the largest layout that fits each size.
          RemoteViews(mapOf(
            SizeF(0f, 0f) to buildViews(context, snapshot, R.layout.cogvest_widget_small),
            SizeF(0f, FULL_MIN_HEIGHT_DP.toFloat()) to buildViews(context, snapshot, R.layout.cogvest_widget),
          ))
        } else {
          val height = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
          val small = height in 1 until FULL_MIN_HEIGHT_DP
          buildViews(context, snapshot, if (small) R.layout.cogvest_widget_small else R.layout.cogvest_widget)
        }
        manager.updateAppWidget(id, views)
      }
    }

    private fun buildViews(context: Context, snapshot: PortfolioWidgetSnapshot, layout: Int): RemoteViews {
      val views = RemoteViews(context.packageName, layout)
      val (headline, detail) = when (snapshot.kind) {
        "value" -> (snapshot.value ?: "") to snapshot.updated
        "pending" -> context.getString(R.string.cogvest_widget_pending) to
          (snapshot.updated ?: context.getString(R.string.cogvest_widget_pending_detail))
        "empty" -> context.getString(R.string.cogvest_widget_empty) to
          context.getString(R.string.cogvest_widget_empty_detail)
        "setup" -> context.getString(R.string.cogvest_widget_setup) to
          context.getString(R.string.cogvest_widget_setup_detail)
        else -> context.getString(R.string.cogvest_widget_hidden) to
          context.getString(R.string.cogvest_widget_hidden_detail)
      }
      views.setTextViewText(R.id.cogvest_widget_value, headline)
      if (layout == R.layout.cogvest_widget) {
        val change = if (snapshot.kind == "value") snapshot.change else null
        views.setTextViewText(R.id.cogvest_widget_change, change ?: "")
        views.setViewVisibility(R.id.cogvest_widget_change, if (change.isNullOrEmpty()) View.GONE else View.VISIBLE)
        views.setTextViewText(R.id.cogvest_widget_updated, detail ?: "")
        views.setViewVisibility(R.id.cogvest_widget_updated, if (detail.isNullOrEmpty()) View.GONE else View.VISIBLE)
      }

      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
        val open = PendingIntent.getActivity(
          context,
          0,
          launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(android.R.id.background, open)
      }
      return views
    }
  }
}

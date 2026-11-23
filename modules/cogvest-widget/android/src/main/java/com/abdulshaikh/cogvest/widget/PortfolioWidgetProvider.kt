package com.abdulshaikh.cogvest.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews

/**
 * The home-screen portfolio widget (#786). It draws the snapshot the app last
 * stored and opens the app when tapped, through App lock when it is on. It
 * has no update period and no network access of its own.
 */
class PortfolioWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    render(context, manager, appWidgetIds)
  }

  companion object {
    /** Redraws every placed widget from the stored snapshot. */
    fun refreshAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, PortfolioWidgetProvider::class.java))
      if (ids.isNotEmpty()) render(context, manager, ids)
    }

    private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val views = buildViews(context, PortfolioWidgetStore.read(context))
      ids.forEach { manager.updateAppWidget(it, views) }
    }

    private fun buildViews(context: Context, snapshot: PortfolioWidgetSnapshot): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.cogvest_widget)
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
      val change = if (snapshot.kind == "value") snapshot.change else null
      views.setTextViewText(R.id.cogvest_widget_change, change ?: "")
      views.setViewVisibility(R.id.cogvest_widget_change, if (change.isNullOrEmpty()) View.GONE else View.VISIBLE)
      views.setTextViewText(R.id.cogvest_widget_updated, detail ?: "")
      views.setViewVisibility(R.id.cogvest_widget_updated, if (detail.isNullOrEmpty()) View.GONE else View.VISIBLE)

      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
        val open = PendingIntent.getActivity(
          context,
          0,
          launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(R.id.cogvest_widget_root, open)
      }
      return views
    }
  }
}

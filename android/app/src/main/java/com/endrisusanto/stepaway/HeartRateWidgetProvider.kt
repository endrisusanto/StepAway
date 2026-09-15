package com.endrisusanto.stepaway

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class HeartRateWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val views = buildRemoteViews(context)
        val component = ComponentName(context, HeartRateWidgetProvider::class.java)
        appWidgetManager.updateAppWidget(component, views)
        for (appWidgetId in appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    companion object {
        fun buildRemoteViews(context: Context): RemoteViews {
            val prefs = context.getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
            val bpm = prefs.getInt("widget_bpm", 0)

            val views = RemoteViews(context.packageName, R.layout.widget_heart_rate)

            val zone = when {
                bpm >= 170 -> "PEAK"
                bpm >= 140 -> "ANAEROBIC"
                bpm >= 100 -> "AEROBIC"
                bpm > 0 -> "REST"
                else -> "IDLE"
            }

            val zoneColor = when {
                bpm >= 170 -> 0xFFF43F5E.toInt()
                bpm >= 140 -> 0xFFF97316.toInt()
                bpm >= 100 -> 0xFFF59E0B.toInt()
                bpm > 0 -> 0xFF06B6D4.toInt()
                else -> 0xFF9E9EA7.toInt()
            }

            views.setTextViewText(R.id.widgetHrBpmValue, if (bpm > 0) bpm.toString() else "--")
            views.setTextViewText(R.id.widgetHrZoneBadge, zone)
            views.setTextColor(R.id.widgetHrZoneBadge, zoneColor)

            // Open app on click
            val intent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widgetHrRoot, pendingIntent)

            return views
        }

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = buildRemoteViews(context)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

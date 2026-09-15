package com.endrisusanto.stepaway

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class StepCompactWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
            val currentSteps = prefs.getInt("widget_steps", 0)
            val targetSteps = prefs.getInt("target_steps", 5000).coerceAtLeast(1)
            val activityStatus = prefs.getString("activity_status", "IDLE") ?: "IDLE"

            val percentage = ((currentSteps.toDouble() / targetSteps.toDouble()) * 100).toInt().coerceIn(0, 100)

            val views = RemoteViews(context.packageName, R.layout.widget_step_compact)

            when (activityStatus.uppercase()) {
                "RUNNING" -> {
                    views.setTextViewText(R.id.widgetCompactPace, "RUNNING")
                    views.setTextColor(R.id.widgetCompactPace, 0xFFF43F5E.toInt())
                }
                "WALKING" -> {
                    views.setTextViewText(R.id.widgetCompactPace, "WALKING")
                    views.setTextColor(R.id.widgetCompactPace, 0xFF10B981.toInt())
                }
                else -> {
                    views.setTextViewText(R.id.widgetCompactPace, "IDLE")
                    views.setTextColor(R.id.widgetCompactPace, 0xFF9E9EA7.toInt())
                }
            }

            views.setTextViewText(R.id.widgetCompactSteps, "%,d".format(currentSteps))
            views.setTextViewText(R.id.widgetCompactPercent, "$percentage%")

            // Open app on click
            val intent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widgetCompactRoot, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

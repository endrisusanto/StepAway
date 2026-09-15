package com.endrisusanto.stepaway

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class StepAwayWidgetProvider : AppWidgetProvider() {

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
            val userId = prefs.getString("user_id", "Streamer") ?: "Streamer"
            val activityStatus = prefs.getString("activity_status", "IDLE") ?: "IDLE"

            val percentage = ((currentSteps.toDouble() / targetSteps.toDouble()) * 100).toInt().coerceIn(0, 100)

            val views = RemoteViews(context.packageName, R.layout.widget_step_away)

            views.setTextViewText(R.id.widgetUserName, userId)

            // Dynamic Pace Status
            when (activityStatus.uppercase()) {
                "RUNNING" -> {
                    views.setTextViewText(R.id.widgetTierBadge, "🏃 RUNNING")
                    views.setTextColor(R.id.widgetTierBadge, 0xFFFF5252.toInt()) // Coral Red
                }
                "WALKING" -> {
                    views.setTextViewText(R.id.widgetTierBadge, "🚶 WALKING")
                    views.setTextColor(R.id.widgetTierBadge, 0xFF10B981.toInt()) // Emerald Green
                }
                else -> {
                    views.setTextViewText(R.id.widgetTierBadge, "🧘 IDLE")
                    views.setTextColor(R.id.widgetTierBadge, 0xFF94A3B8.toInt()) // Slate
                }
            }

            views.setTextViewText(R.id.widgetStepCount, "%,d".format(currentSteps))
            views.setTextViewText(R.id.widgetTargetInfo, "Goal: %,d".format(targetSteps))
            views.setProgressBar(R.id.widgetProgressBar, 100, percentage, false)
            views.setTextViewText(R.id.widgetPercentDisplay, "$percentage%")

            // Open app on click
            val intent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(
                context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widgetRoot, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun sendUpdateBroadcast(context: Context, steps: Int, isTracking: Boolean, activityStatus: String = "IDLE") {
            val prefs = context.getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putInt("widget_steps", steps)
                .putBoolean("is_tracking", isTracking)
                .putString("activity_status", activityStatus)
                .apply()

            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, StepAwayWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)

            for (widgetId in allWidgetIds) {
                updateAppWidget(context, appWidgetManager, widgetId)
            }
        }
    }
}

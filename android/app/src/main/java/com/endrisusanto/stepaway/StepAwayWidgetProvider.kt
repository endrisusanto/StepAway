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
        fun getTierName(steps: Int): String {
            return when {
                steps >= 10000 -> "MASTER"
                steps >= 5000 -> "GOLD"
                steps >= 2000 -> "SILVER"
                steps >= 1000 -> "BRONZE"
                else -> "STARTER"
            }
        }

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
            val currentSteps = prefs.getInt("widget_steps", 0)
            val targetSteps = prefs.getInt("target_steps", 5000).coerceAtLeast(1)
            val userId = prefs.getString("user_id", "Streamer") ?: "Streamer"

            val percentage = ((currentSteps.toDouble() / targetSteps.toDouble()) * 100).toInt().coerceIn(0, 100)
            val tier = getTierName(currentSteps)

            val views = RemoteViews(context.packageName, R.layout.widget_step_away)

            views.setTextViewText(R.id.widgetUserName, userId)
            views.setTextViewText(R.id.widgetTierBadge, tier)
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

        fun sendUpdateBroadcast(context: Context, steps: Int, isTracking: Boolean) {
            val prefs = context.getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
            prefs.edit()
                .putInt("widget_steps", steps)
                .putBoolean("is_tracking", isTracking)
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

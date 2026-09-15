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
        const val ACTION_WIDGET_REFRESH = "com.endrisusanto.stepaway.ACTION_WIDGET_REFRESH"

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
            val currentSteps = prefs.getInt("widget_steps", 0)
            val isTracking = prefs.getBoolean("is_tracking", false)
            val targetSteps = prefs.getInt("target_steps", 5000)

            val views = RemoteViews(context.packageName, R.layout.widget_step_away)

            views.setTextViewText(R.id.widgetStepCount, "%,d".format(currentSteps))
            views.setTextViewText(R.id.widgetTargetInfo, "Goal: %,d".format(targetSteps))

            if (isTracking) {
                views.setTextViewText(R.id.widgetStatusBadge, "● LIVE SYNC")
                views.setTextColor(R.id.widgetStatusBadge, 0xFF10B981.toInt()) // Emerald Green
            } else {
                views.setTextViewText(R.id.widgetStatusBadge, "● STANDBY")
                views.setTextColor(R.id.widgetStatusBadge, 0xFF64748B.toInt()) // Slate Grey
            }

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

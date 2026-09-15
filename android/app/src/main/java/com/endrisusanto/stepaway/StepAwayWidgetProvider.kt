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
        val views = buildRemoteViews(context)
        val component = ComponentName(context, StepAwayWidgetProvider::class.java)
        appWidgetManager.updateAppWidget(component, views)
        for (appWidgetId in appWidgetIds) {
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }

    companion object {
        fun buildRemoteViews(context: Context): RemoteViews {
            val prefs = context.getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
            val currentSteps = prefs.getInt("widget_steps", 0)
            val targetSteps = prefs.getInt("target_steps", 5000).coerceAtLeast(1)
            val userId = prefs.getString("display_name", "Streamer") ?: "Streamer"
            val activityStatus = prefs.getString("activity_status", "IDLE") ?: "IDLE"
            val liveBpm = prefs.getInt("widget_bpm", 0)

            val percentage = ((currentSteps.toDouble() / targetSteps.toDouble()) * 100).toInt().coerceIn(0, 100)

            val views = RemoteViews(context.packageName, R.layout.widget_step_away)

            views.setTextViewText(R.id.widgetUserName, userId)

            // Dynamic Pace Status
            when (activityStatus.uppercase()) {
                "RUNNING" -> {
                    views.setTextViewText(R.id.widgetTierBadge, "RUNNING")
                    views.setTextColor(R.id.widgetTierBadge, 0xFFF43F5E.toInt())
                }
                "WALKING" -> {
                    views.setTextViewText(R.id.widgetTierBadge, "WALKING")
                    views.setTextColor(R.id.widgetTierBadge, 0xFF10B981.toInt())
                }
                else -> {
                    views.setTextViewText(R.id.widgetTierBadge, "IDLE")
                    views.setTextColor(R.id.widgetTierBadge, 0xFF9E9EA7.toInt())
                }
            }

            // Live HR Chip
            val hrText = if (liveBpm > 0) "$liveBpm BPM" else "-- BPM"
            views.setTextViewText(R.id.widgetHrChip, hrText)
            views.setTextColor(R.id.widgetHrChip, if (liveBpm > 0) 0xFFF43F5E.toInt() else 0xFF9E9EA7.toInt())

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

            return views
        }

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = buildRemoteViews(context)
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun sendUpdateBroadcast(context: Context, steps: Int, isTracking: Boolean, activityStatus: String = "IDLE", bpm: Int = -1) {
            val prefs = context.getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
            val editor = prefs.edit()
                .putInt("widget_steps", steps)
                .putBoolean("is_tracking", isTracking)
                .putString("activity_status", activityStatus)

            if (bpm >= 0) {
                editor.putInt("widget_bpm", bpm)
            }
            editor.apply()

            val appWidgetManager = AppWidgetManager.getInstance(context)

            // 1. Combo 4x2 Widget
            val comboWidget = ComponentName(context, StepAwayWidgetProvider::class.java)
            val comboViews = buildRemoteViews(context)
            appWidgetManager.updateAppWidget(comboWidget, comboViews)
            val comboIds = appWidgetManager.getAppWidgetIds(comboWidget)
            for (id in comboIds) {
                appWidgetManager.updateAppWidget(id, comboViews)
            }

            // 2. Compact Step 2x2 Widget
            val compactWidget = ComponentName(context, StepCompactWidgetProvider::class.java)
            val compactViews = StepCompactWidgetProvider.buildRemoteViews(context)
            appWidgetManager.updateAppWidget(compactWidget, compactViews)
            val compactIds = appWidgetManager.getAppWidgetIds(compactWidget)
            for (id in compactIds) {
                appWidgetManager.updateAppWidget(id, compactViews)
            }

            // 3. Heart Rate 2x2 Widget
            val hrWidget = ComponentName(context, HeartRateWidgetProvider::class.java)
            val hrViews = HeartRateWidgetProvider.buildRemoteViews(context)
            appWidgetManager.updateAppWidget(hrWidget, hrViews)
            val hrIds = appWidgetManager.getAppWidgetIds(hrWidget)
            for (id in hrIds) {
                appWidgetManager.updateAppWidget(id, hrViews)
            }
        }
    }
}

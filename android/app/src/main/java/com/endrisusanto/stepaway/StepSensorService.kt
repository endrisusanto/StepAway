package com.endrisusanto.stepaway

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.sqrt

class StepSensorService : Service(), SensorEventListener {

    private lateinit var sensorManager: SensorManager
    private var stepCounterSensor: Sensor? = null
    private var stepDetectorSensor: Sensor? = null
    private var accelSensor: Sensor? = null
    private var wakeLock: PowerManager.WakeLock? = null

    private var serverUrl = "https://stepaway.endrisusanto.my.id"
    private var userId = "streamer"
    
    private var baselineSensorSteps: Int = -1
    private var sessionSteps: Int = 0
    private var lastSentSteps: Int = 0
    private var lastAccelStepTime: Long = 0

    // Cadence / Pace Tracking
    private val recentStepTimes = mutableListOf<Long>()
    private var currentActivityStatus: String = "IDLE"

    private val serviceJob = Job()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)

    companion object {
        const val CHANNEL_ID = "StepAwayTrackingChannel"
        const val NOTIFICATION_ID = 1001
        const val ACTION_START = "ACTION_START"
        const val ACTION_STOP = "ACTION_STOP"
        const val EXTRA_SERVER_URL = "EXTRA_SERVER_URL"
        const val EXTRA_USER_ID = "EXTRA_USER_ID"

        @Volatile
        var liveBpm: Int = 0

        @Volatile
        var onLiveStepUpdated: ((steps: Int, pace: String) -> Unit)? = null
    }

    override fun onCreate() {
        super.onCreate()
        val prefs = getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
        sessionSteps = prefs.getInt("widget_steps", 0)

        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
        accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "StepAway::SensorWakeLock")
        wakeLock?.acquire(24 * 60 * 60 * 1000L)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        serverUrl = intent?.getStringExtra(EXTRA_SERVER_URL) ?: serverUrl
        userId = intent?.getStringExtra(EXTRA_USER_ID) ?: userId

        val prefs = getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
        sessionSteps = prefs.getInt("widget_steps", sessionSteps)

        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("Sensor langkah aktif...", sessionSteps, "IDLE"))

        StepAwayWidgetProvider.sendUpdateBroadcast(this, sessionSteps, true, "IDLE", liveBpm)
        onLiveStepUpdated?.invoke(sessionSteps, "IDLE")

        registerSensors()
        startSyncLoop()
        startIdleDetectorLoop()

        return START_STICKY
    }

    private fun registerSensors() {
        var registered = false
        if (stepCounterSensor != null) {
            registered = sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI)
        }
        if (!registered && stepDetectorSensor != null) {
            registered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_UI)
        }
        // Accelerometer fallback for devices with sleeping or missing dedicated step sensors
        if (accelSensor != null) {
            sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return

        val now = System.currentTimeMillis()

        if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
            val totalBootSteps = event.values[0].toInt()
            if (baselineSensorSteps < 0) {
                baselineSensorSteps = totalBootSteps - sessionSteps
            }
            val calculated = (totalBootSteps - baselineSensorSteps).coerceAtLeast(sessionSteps)
            if (calculated > sessionSteps) {
                recordStepTimestamp(now)
                sessionSteps = calculated
                updateNotificationLive()
            }
        } else if (event.sensor.type == Sensor.TYPE_STEP_DETECTOR) {
            recordStepTimestamp(now)
            sessionSteps += 1
            updateNotificationLive()
        } else if (event.sensor.type == Sensor.TYPE_ACCELEROMETER && stepCounterSensor == null && stepDetectorSensor == null) {
            // Accelerometer dynamic step detector fallback
            val x = event.values[0]
            val y = event.values[1]
            val z = event.values[2]
            val magnitude = sqrt((x * x + y * y + z * z).toDouble())

            if (magnitude > 11.8 && now - lastAccelStepTime > 300) {
                lastAccelStepTime = now
                recordStepTimestamp(now)
                sessionSteps += 1
                updateNotificationLive()
            }
        }
    }

    private fun recordStepTimestamp(now: Long) {
        recentStepTimes.add(now)
        recentStepTimes.removeAll { now - it > 4000 }

        val stepsIn4Sec = recentStepTimes.size
        val spm = (stepsIn4Sec / 4.0) * 60.0

        currentActivityStatus = when {
            spm >= 130 -> "RUNNING"
            spm >= 25 -> "WALKING"
            else -> "IDLE"
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun updateNotificationLive() {
        val prefs = getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
        prefs.edit()
            .putInt("widget_steps", sessionSteps)
            .putString("activity_status", currentActivityStatus)
            .apply()

        onLiveStepUpdated?.invoke(sessionSteps, currentActivityStatus)

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val label = if (currentActivityStatus == "RUNNING") "Berlari" else "Berjalan"
        manager.notify(NOTIFICATION_ID, buildNotification("$label: $sessionSteps langkah", sessionSteps, currentActivityStatus))
        StepAwayWidgetProvider.sendUpdateBroadcast(this, sessionSteps, true, currentActivityStatus, liveBpm)
    }

    private fun startIdleDetectorLoop() {
        serviceScope.launch {
            while (true) {
                delay(2500)
                val now = System.currentTimeMillis()
                if (recentStepTimes.isNotEmpty() && now - recentStepTimes.last() > 4500) {
                    recentStepTimes.clear()
                    currentActivityStatus = "IDLE"
                    updateNotificationLive()
                }
            }
        }
    }

    private fun startSyncLoop() {
        serviceScope.launch {
            while (true) {
                delay(600)
                if (sessionSteps != lastSentSteps) {
                    val delta = sessionSteps - lastSentSteps
                    val success = sendStepData(sessionSteps, delta)
                    if (success) {
                        lastSentSteps = sessionSteps
                    }
                }
            }
        }
    }

    private fun sendStepData(steps: Int, delta: Int): Boolean {
        return try {
            val endpoint = if (serverUrl.endsWith("/")) "${serverUrl}api/steps/sync" else "$serverUrl/api/steps/sync"
            val url = URL(endpoint)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.connectTimeout = 4000
            conn.readTimeout = 4000
            conn.doOutput = true

            val payload = JSONObject().apply {
                put("userId", userId)
                put("steps", steps)
                put("delta", delta)
                if (liveBpm > 0) {
                    put("bpm", liveBpm)
                }
            }

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(payload.toString())
                writer.flush()
            }

            val code = conn.responseCode
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "StepAway Sensor Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifikasi pelacakan sensor langkah StepAway"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(contentText: String, currentSteps: Int, status: String): Notification {
        val mainIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, mainIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val statusTag = if (status == "RUNNING") " [LARI]" else if (status == "WALKING") " [JALAN]" else ""

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("StepAway Active Tracking$statusTag")
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        sensorManager.unregisterListener(this)
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        serviceJob.cancel()
        StepAwayWidgetProvider.sendUpdateBroadcast(this, sessionSteps, false, "IDLE", liveBpm)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

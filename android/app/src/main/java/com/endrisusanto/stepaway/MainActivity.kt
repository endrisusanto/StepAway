package com.endrisusanto.stepaway

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences

    // Header & Monitor Views
    private lateinit var tvLiveStatusBadge: TextView
    private lateinit var tvCardUserName: TextView
    private lateinit var tvCardTier: TextView
    private lateinit var tvLiveSteps: TextView
    private lateinit var tvGoalInfo: TextView
    private lateinit var pbStepProgress: ProgressBar
    private lateinit var tvLivePercent: TextView
    private lateinit var btnToggleTracking: Button

    // Target Setting Views
    private lateinit var etTargetGoal: EditText
    private lateinit var btnSaveTarget: Button
    private lateinit var btnPreset3k: Button
    private lateinit var btnPreset5k: Button
    private lateinit var btnPreset10k: Button
    private lateinit var btnPreset20k: Button

    // Simulation Views
    private lateinit var btnSim1: Button
    private lateinit var btnSim10: Button
    private lateinit var btnSim100: Button
    private lateinit var btnSim1000: Button
    private lateinit var btnResetSteps: Button

    // Connection & OBS Views
    private lateinit var etServerUrl: EditText
    private lateinit var etUserId: EditText
    private lateinit var btnCopySingle: Button
    private lateinit var btnCopyMulti: Button

    private var isTracking = false
    private val scope = CoroutineScope(Dispatchers.IO)

    companion object {
        private const val REQ_PERMISSIONS = 101
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)

        initViews()
        loadSavedPreferences()
        checkPermissions()
        setupListeners()
        fetchRemoteStats()
    }

    override fun onResume() {
        super.onResume()
        updateLiveUIFromPrefs()
    }

    private fun initViews() {
        tvLiveStatusBadge = findViewById(R.id.tvLiveStatusBadge)
        tvCardUserName = findViewById(R.id.tvCardUserName)
        tvCardTier = findViewById(R.id.tvCardTier)
        tvLiveSteps = findViewById(R.id.tvLiveSteps)
        tvGoalInfo = findViewById(R.id.tvGoalInfo)
        pbStepProgress = findViewById(R.id.pbStepProgress)
        tvLivePercent = findViewById(R.id.tvLivePercent)
        btnToggleTracking = findViewById(R.id.btnToggleTracking)

        etTargetGoal = findViewById(R.id.etTargetGoal)
        btnSaveTarget = findViewById(R.id.btnSaveTarget)
        btnPreset3k = findViewById(R.id.btnPreset3k)
        btnPreset5k = findViewById(R.id.btnPreset5k)
        btnPreset10k = findViewById(R.id.btnPreset10k)
        btnPreset20k = findViewById(R.id.btnPreset20k)

        btnSim1 = findViewById(R.id.btnSim1)
        btnSim10 = findViewById(R.id.btnSim10)
        btnSim100 = findViewById(R.id.btnSim100)
        btnSim1000 = findViewById(R.id.btnSim1000)
        btnResetSteps = findViewById(R.id.btnResetSteps)

        etServerUrl = findViewById(R.id.etServerUrl)
        etUserId = findViewById(R.id.etUserId)
        btnCopySingle = findViewById(R.id.btnCopySingle)
        btnCopyMulti = findViewById(R.id.btnCopyMulti)
    }

    private fun loadSavedPreferences() {
        val serverUrl = prefs.getString("server_url", "https://stepaway.endrisusanto.my.id")
        val userId = prefs.getString("user_id", "streamer")
        val target = prefs.getInt("target_steps", 5000)
        isTracking = prefs.getBoolean("is_tracking", false)

        etServerUrl.setText(serverUrl)
        etUserId.setText(userId)
        etTargetGoal.setText(target.toString())

        updateLiveUIFromPrefs()
        updateTrackingButtonState()
    }

    private fun updateLiveUIFromPrefs() {
        val steps = prefs.getInt("widget_steps", 0)
        val target = prefs.getInt("target_steps", 5000).coerceAtLeast(1)
        val userId = prefs.getString("user_id", "streamer") ?: "streamer"

        val pct = ((steps.toDouble() / target.toDouble()) * 100).toInt().coerceIn(0, 100)
        val tier = StepAwayWidgetProvider.getTierName(steps)

        tvCardUserName.text = userId
        tvCardTier.text = tier
        tvLiveSteps.text = "%,d".format(steps)
        tvGoalInfo.text = "Goal: %,d".format(target)
        pbStepProgress.progress = pct
        tvLivePercent.text = "$pct%"
    }

    private fun updateTrackingButtonState() {
        if (isTracking) {
            btnToggleTracking.text = "Stop Tracking"
            btnToggleTracking.setBackgroundColor(0xFFFF5252.toInt()) // Coral Red
            tvLiveStatusBadge.text = "● ACTIVE SYNC"
            tvLiveStatusBadge.setTextColor(0xFF10B981.toInt()) // Emerald
        } else {
            btnToggleTracking.text = "Start Tracking"
            btnToggleTracking.setBackgroundColor(0xFF10B981.toInt()) // Emerald
            tvLiveStatusBadge.text = "● STANDBY"
            tvLiveStatusBadge.setTextColor(0xFF94A3B8.toInt()) // Slate
        }
    }

    private fun setupListeners() {
        btnToggleTracking.setOnClickListener {
            if (isTracking) {
                stopTrackingService()
            } else {
                startTrackingService()
            }
        }

        btnSaveTarget.setOnClickListener {
            val target = etTargetGoal.text.toString().toIntOrNull() ?: 5000
            saveTargetGoal(target)
        }

        btnPreset3k.setOnClickListener { setAndSavePreset(3000) }
        btnPreset5k.setOnClickListener { setAndSavePreset(5000) }
        btnPreset10k.setOnClickListener { setAndSavePreset(10000) }
        btnPreset20k.setOnClickListener { setAndSavePreset(20000) }

        btnSim1.setOnClickListener { sendSimulationStep(1) }
        btnSim10.setOnClickListener { sendSimulationStep(10) }
        btnSim100.setOnClickListener { sendSimulationStep(100) }
        btnSim1000.setOnClickListener { sendSimulationStep(1000) }

        btnResetSteps.setOnClickListener { resetTodaySteps() }

        btnCopySingle.setOnClickListener { copyObsLink(false) }
        btnCopyMulti.setOnClickListener { copyObsLink(true) }
    }

    private fun setAndSavePreset(target: Int) {
        etTargetGoal.setText(target.toString())
        saveTargetGoal(target)
    }

    private fun saveTargetGoal(target: Int) {
        prefs.edit().putInt("target_steps", target).apply()
        updateLiveUIFromPrefs()
        StepAwayWidgetProvider.sendUpdateBroadcast(this, prefs.getInt("widget_steps", 0), isTracking)

        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()

        scope.launch {
            try {
                val endpoint = "$serverUrl/api/users/$userId/target"
                val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    doOutput = true
                }
                val payload = JSONObject().apply { put("targetSteps", target) }
                OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()); it.flush() }
                conn.responseCode
                conn.disconnect()
            } catch (e: Exception) {}
        }
        Toast.makeText(this, "Target diubah ke %,d langkah".format(target), Toast.LENGTH_SHORT).show()
    }

    private fun sendSimulationStep(delta: Int) {
        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()

        scope.launch {
            try {
                val endpoint = "$serverUrl/api/steps/sync"
                val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    doOutput = true
                }
                val payload = JSONObject().apply {
                    put("userId", userId)
                    put("delta", delta)
                }
                OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()); it.flush() }
                val code = conn.responseCode
                conn.disconnect()

                if (code in 200..299) {
                    val newSteps = prefs.getInt("widget_steps", 0) + delta
                    prefs.edit().putInt("widget_steps", newSteps).apply()
                    withContext(Dispatchers.Main) {
                        updateLiveUIFromPrefs()
                        StepAwayWidgetProvider.sendUpdateBroadcast(this@MainActivity, newSteps, isTracking)
                        Toast.makeText(this@MainActivity, "+$delta langkah terkirim ke OBS!", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Gagal koneksi ke server: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun resetTodaySteps() {
        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()

        scope.launch {
            try {
                val endpoint = "$serverUrl/api/users/$userId/reset"
                val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                }
                conn.responseCode
                conn.disconnect()

                prefs.edit().putInt("widget_steps", 0).apply()
                withContext(Dispatchers.Main) {
                    updateLiveUIFromPrefs()
                    StepAwayWidgetProvider.sendUpdateBroadcast(this@MainActivity, 0, isTracking)
                    Toast.makeText(this@MainActivity, "Langkah berhasil direset ke 0", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Gagal reset: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun fetchRemoteStats() {
        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()

        scope.launch {
            try {
                val endpoint = "$serverUrl/api/users/$userId"
                val conn = (URL(endpoint).openConnection() as HttpURLConnection)
                if (conn.responseCode in 200..299) {
                    val raw = conn.inputStream.bufferedReader().readText()
                    val json = JSONObject(raw)
                    if (json.optBoolean("success")) {
                        val userObj = json.getJSONObject("user")
                        val steps = userObj.optInt("currentSteps", 0)
                        val target = userObj.optInt("targetSteps", 5000)

                        prefs.edit()
                            .putInt("widget_steps", steps)
                            .putInt("target_steps", target)
                            .apply()

                        withContext(Dispatchers.Main) {
                            updateLiveUIFromPrefs()
                            StepAwayWidgetProvider.sendUpdateBroadcast(this@MainActivity, steps, isTracking)
                        }
                    }
                }
                conn.disconnect()
            } catch (e: Exception) {}
        }
    }

    private fun copyObsLink(isMulti: Boolean) {
        val serverUrl = etServerUrl.text.toString().trim().removeSuffix("/")
        val userId = etUserId.text.toString().trim()
        val url = if (isMulti) {
            "$serverUrl/overlay/multi?users=$userId,guest"
        } else {
            "$serverUrl/overlay?user=$userId"
        }

        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("StepAway OBS URL", url)
        clipboard.setPrimaryClip(clip)

        val label = if (isMulti) "Link Multi-User OBS" else "Link Single OBS"
        Toast.makeText(this, "$label disalin ke clipboard!", Toast.LENGTH_SHORT).show()
    }

    private fun checkPermissions() {
        val permissionsNeeded = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.ACTIVITY_RECOGNITION)
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissionsNeeded.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissionsNeeded.toTypedArray(), REQ_PERMISSIONS)
        }
    }

    private fun startTrackingService() {
        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()

        if (serverUrl.isEmpty() || userId.isEmpty()) {
            Toast.makeText(this, "Isi Server URL dan User ID terlebih dahulu", Toast.LENGTH_SHORT).show()
            return
        }

        prefs.edit()
            .putString("server_url", serverUrl)
            .putString("user_id", userId)
            .putBoolean("is_tracking", true)
            .apply()

        val serviceIntent = Intent(this, StepSensorService::class.java).apply {
            action = StepSensorService.ACTION_START
            putExtra(StepSensorService.EXTRA_SERVER_URL, serverUrl)
            putExtra(StepSensorService.EXTRA_USER_ID, userId)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        isTracking = true
        updateTrackingButtonState()
        StepAwayWidgetProvider.sendUpdateBroadcast(this, prefs.getInt("widget_steps", 0), true)
        Toast.makeText(this, "Sensor tracking background aktif!", Toast.LENGTH_SHORT).show()
    }

    private fun stopTrackingService() {
        val serviceIntent = Intent(this, StepSensorService::class.java).apply {
            action = StepSensorService.ACTION_STOP
        }
        startService(serviceIntent)

        isTracking = false
        prefs.edit().putBoolean("is_tracking", false).apply()
        updateTrackingButtonState()
        StepAwayWidgetProvider.sendUpdateBroadcast(this, prefs.getInt("widget_steps", 0), false)
        Toast.makeText(this, "Tracking dihentikan", Toast.LENGTH_SHORT).show()
    }
}

package com.endrisusanto.stepaway

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
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
    private lateinit var bleManager: BleHeartRateManager

    // Header & Monitor Views
    private lateinit var tvLiveStatusBadge: TextView
    private lateinit var tvCardUserName: TextView
    private lateinit var tvCardPaceStatus: TextView
    private lateinit var tvLiveSteps: TextView
    private lateinit var tvGoalInfo: TextView
    private lateinit var pbStepProgress: ProgressBar
    private lateinit var tvLivePercent: TextView
    private lateinit var btnToggleTracking: Button

    // Profile & Target Setting Views
    private lateinit var etDisplayName: EditText
    private lateinit var etTargetGoal: EditText
    private lateinit var btnSaveSettings: Button
    private lateinit var btnPreset3k: Button
    private lateinit var btnPreset5k: Button
    private lateinit var btnPreset10k: Button
    private lateinit var btnPreset20k: Button

    // BLE Heart Rate Views
    private lateinit var tvBleStatusBadge: TextView
    private lateinit var tvLiveBpm: TextView
    private lateinit var tvBleZoneBadge: TextView
    private lateinit var tvConnectedBleDevice: TextView
    private lateinit var btnScanBle: Button
    private lateinit var btnDisconnectBle: Button

    // Room System Views
    private lateinit var etRoomId: EditText
    private lateinit var etRoomPasscode: EditText
    private lateinit var btnJoinRoom: Button
    private lateinit var btnCreateRoom: Button

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
    private lateinit var btnCopyHeartrate: Button
    private lateinit var btnCopyCombo: Button
    private lateinit var btnCopyRoom: Button

    private var isTracking = false
    private val scope = CoroutineScope(Dispatchers.IO)

    // BLE Discovery list for picker dialog
    private val discoveredDevices = mutableListOf<BluetoothDevice>()
    private val deviceDisplayList = mutableListOf<String>()
    private var scanDialog: AlertDialog? = null
    private var scanListAdapter: ArrayAdapter<String>? = null

    companion object {
        private const val REQ_PERMISSIONS = 101
        private const val REQ_BLE_PERMISSIONS = 102
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)
        bleManager = BleHeartRateManager(this)

        initViews()
        loadSavedPreferences()
        setupBleCallbacks()
        checkPermissions()
        setupListeners()
        fetchRemoteStats()
    }

    override fun onResume() {
        super.onResume()
        updateLiveUIFromPrefs()
    }

    override fun onDestroy() {
        super.onDestroy()
        bleManager.disconnect()
    }

    private fun initViews() {
        tvLiveStatusBadge = findViewById(R.id.tvLiveStatusBadge)
        tvCardUserName = findViewById(R.id.tvCardUserName)
        tvCardPaceStatus = findViewById(R.id.tvCardPaceStatus)
        tvLiveSteps = findViewById(R.id.tvLiveSteps)
        tvGoalInfo = findViewById(R.id.tvGoalInfo)
        pbStepProgress = findViewById(R.id.pbStepProgress)
        tvLivePercent = findViewById(R.id.tvLivePercent)
        btnToggleTracking = findViewById(R.id.btnToggleTracking)

        etDisplayName = findViewById(R.id.etDisplayName)
        etTargetGoal = findViewById(R.id.etTargetGoal)
        btnSaveSettings = findViewById(R.id.btnSaveSettings)
        btnPreset3k = findViewById(R.id.btnPreset3k)
        btnPreset5k = findViewById(R.id.btnPreset5k)
        btnPreset10k = findViewById(R.id.btnPreset10k)
        btnPreset20k = findViewById(R.id.btnPreset20k)

        tvBleStatusBadge = findViewById(R.id.tvBleStatusBadge)
        tvLiveBpm = findViewById(R.id.tvLiveBpm)
        tvBleZoneBadge = findViewById(R.id.tvBleZoneBadge)
        tvConnectedBleDevice = findViewById(R.id.tvConnectedBleDevice)
        btnScanBle = findViewById(R.id.btnScanBle)
        btnDisconnectBle = findViewById(R.id.btnDisconnectBle)

        etRoomId = findViewById(R.id.etRoomId)
        etRoomPasscode = findViewById(R.id.etRoomPasscode)
        btnJoinRoom = findViewById(R.id.btnJoinRoom)
        btnCreateRoom = findViewById(R.id.btnCreateRoom)

        btnSim1 = findViewById(R.id.btnSim1)
        btnSim10 = findViewById(R.id.btnSim10)
        btnSim100 = findViewById(R.id.btnSim100)
        btnSim1000 = findViewById(R.id.btnSim1000)
        btnResetSteps = findViewById(R.id.btnResetSteps)

        etServerUrl = findViewById(R.id.etServerUrl)
        etUserId = findViewById(R.id.etUserId)
        btnCopySingle = findViewById(R.id.btnCopySingle)
        btnCopyHeartrate = findViewById(R.id.btnCopyHeartrate)
        btnCopyCombo = findViewById(R.id.btnCopyCombo)
        btnCopyRoom = findViewById(R.id.btnCopyRoom)
    }

    private fun loadSavedPreferences() {
        val serverUrl = prefs.getString("server_url", "https://stepaway.endrisusanto.my.id")
        val userId = prefs.getString("user_id", "streamer")
        val displayName = prefs.getString("display_name", "Streamer")
        val target = prefs.getInt("target_steps", 5000)
        val roomId = prefs.getString("room_id", "global")
        isTracking = prefs.getBoolean("is_tracking", false)

        etServerUrl.setText(serverUrl)
        etUserId.setText(userId)
        etDisplayName.setText(displayName)
        etTargetGoal.setText(target.toString())
        etRoomId.setText(roomId)

        updateLiveUIFromPrefs()
        updateTrackingButtonState()
    }

    private fun updateLiveUIFromPrefs() {
        val steps = prefs.getInt("widget_steps", 0)
        val target = prefs.getInt("target_steps", 5000).coerceAtLeast(1)
        val displayName = prefs.getString("display_name", "Streamer") ?: "Streamer"
        val status = prefs.getString("activity_status", "IDLE") ?: "IDLE"

        val pct = ((steps.toDouble() / target.toDouble()) * 100).toInt().coerceIn(0, 100)

        tvCardUserName.text = displayName
        tvLiveSteps.text = "%,d".format(steps)
        tvGoalInfo.text = "Goal: %,d".format(target)
        pbStepProgress.progress = pct
        tvLivePercent.text = "$pct%"

        when (status.uppercase()) {
            "RUNNING" -> {
                tvCardPaceStatus.text = "🏃 RUNNING"
                tvCardPaceStatus.setTextColor(0xFFFF5252.toInt())
            }
            "WALKING" -> {
                tvCardPaceStatus.text = "🚶 WALKING"
                tvCardPaceStatus.setTextColor(0xFF10B981.toInt())
            }
            else -> {
                tvCardPaceStatus.text = "🧘 IDLE"
                tvCardPaceStatus.setTextColor(0xFF94A3B8.toInt())
            }
        }
    }

    private fun updateTrackingButtonState() {
        if (isTracking) {
            btnToggleTracking.text = "Stop Tracking"
            btnToggleTracking.setBackgroundColor(0xFFFF5252.toInt())
            tvLiveStatusBadge.text = "● ACTIVE SYNC"
            tvLiveStatusBadge.setTextColor(0xFF10B981.toInt())
        } else {
            btnToggleTracking.text = "Start Tracking"
            btnToggleTracking.setBackgroundColor(0xFF10B981.toInt())
            tvLiveStatusBadge.text = "● STANDBY"
            tvLiveStatusBadge.setTextColor(0xFF94A3B8.toInt())
        }
    }

    private fun setupBleCallbacks() {
        bleManager.onBpmUpdated = { bpm ->
            StepSensorService.liveBpm = bpm
            tvLiveBpm.text = if (bpm > 0) bpm.toString() else "--"

            val zone = when {
                bpm >= 170 -> "🔥 PEAK"
                bpm >= 140 -> "⚡ ANAEROBIC"
                bpm >= 100 -> "🏃 AEROBIC"
                bpm > 0 -> "💙 REST"
                else -> "IDLE"
            }
            tvBleZoneBadge.text = zone

            if (bpm > 0) {
                syncHeartRateToServer(bpm)
            }
        }

        bleManager.onConnectionStateChanged = { isConnected, deviceName ->
            if (isConnected) {
                tvBleStatusBadge.text = "● CONNECTED"
                tvBleStatusBadge.setTextColor(0xFF10B981.toInt())
                tvConnectedBleDevice.text = "Terhubung: ${deviceName ?: "Smartband BLE"}"
                btnDisconnectBle.visibility = View.VISIBLE
                btnScanBle.text = "Ganti Device"
                Toast.makeText(this, "Smartband terhubung!", Toast.LENGTH_SHORT).show()
            } else {
                tvBleStatusBadge.text = "● DISCONNECTED"
                tvBleStatusBadge.setTextColor(0xFF94A3B8.toInt())
                tvConnectedBleDevice.text = "Tidak ada smartband terhubung"
                btnDisconnectBle.visibility = View.GONE
                btnScanBle.text = "🔍 Scan Smartband"
                tvLiveBpm.text = "--"
                tvBleZoneBadge.text = "Idle"
            }
        }

        bleManager.onDeviceDiscovered = { device, _ ->
            @SuppressLint("MissingPermission")
            val name = device.name ?: "Unknown BLE Device"
            val entry = "$name\n${device.address}"
            if (!discoveredDevices.any { it.address == device.address }) {
                discoveredDevices.add(device)
                deviceDisplayList.add(entry)
                scanListAdapter?.notifyDataSetChanged()
            }
        }

        bleManager.onScanFinished = {
            if (scanDialog?.isShowing == true && discoveredDevices.isEmpty()) {
                deviceDisplayList.add("Tidak ada device ditemukan.")
                scanListAdapter?.notifyDataSetChanged()
            }
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

        btnSaveSettings.setOnClickListener { saveAllSettingsToDB() }

        btnPreset3k.setOnClickListener { setPresetGoal(3000) }
        btnPreset5k.setOnClickListener { setPresetGoal(5000) }
        btnPreset10k.setOnClickListener { setPresetGoal(10000) }
        btnPreset20k.setOnClickListener { setPresetGoal(20000) }

        btnScanBle.setOnClickListener { startBleScanFlow() }
        btnDisconnectBle.setOnClickListener {
            bleManager.disconnect()
            Toast.makeText(this, "Smartband diputus", Toast.LENGTH_SHORT).show()
        }

        btnJoinRoom.setOnClickListener { joinRoomAction() }
        btnCreateRoom.setOnClickListener { createRoomAction() }

        btnSim1.setOnClickListener { sendSimulationStep(1) }
        btnSim10.setOnClickListener { sendSimulationStep(10) }
        btnSim100.setOnClickListener { sendSimulationStep(100) }
        btnSim1000.setOnClickListener { sendSimulationStep(1000) }

        btnResetSteps.setOnClickListener { resetTodaySteps() }

        btnCopySingle.setOnClickListener { copyObsLink(OverlayType.SINGLE) }
        btnCopyHeartrate.setOnClickListener { copyObsLink(OverlayType.HEARTRATE) }
        btnCopyCombo.setOnClickListener { copyObsLink(OverlayType.COMBO) }
        btnCopyRoom.setOnClickListener { copyObsLink(OverlayType.ROOM) }
    }

    private enum class OverlayType { SINGLE, HEARTRATE, COMBO, ROOM }

    private fun copyObsLink(type: OverlayType) {
        val serverUrl = etServerUrl.text.toString().trim().removeSuffix("/")
        val userId = etUserId.text.toString().trim()
        val roomId = etRoomId.text.toString().trim().ifEmpty { "global" }

        val (url, label) = when (type) {
            OverlayType.SINGLE -> Pair("$serverUrl/overlay?user=$userId", "Link Step Overlay")
            OverlayType.HEARTRATE -> Pair("$serverUrl/overlay/heartrate?user=$userId", "Link Heart Rate Overlay")
            OverlayType.COMBO -> Pair("$serverUrl/overlay?user=$userId&show_hr=true", "Link Step + HR Combo")
            OverlayType.ROOM -> Pair("$serverUrl/overlay/multi?room=$roomId", "Link Room Overlay ($roomId)")
        }

        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("StepAway OBS Link", url)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(this, "$label disalin!", Toast.LENGTH_SHORT).show()
    }

    private fun startBleScanFlow() {
        if (!hasBlePermissions()) {
            requestBlePermissions()
            return
        }

        discoveredDevices.clear()
        deviceDisplayList.clear()

        scanListAdapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, deviceDisplayList)
        scanDialog = AlertDialog.Builder(this)
            .setTitle("Pilih Smartband / Sensor Detak Jantung")
            .setAdapter(scanListAdapter) { _, which ->
                if (which < discoveredDevices.size) {
                    val selectedDevice = discoveredDevices[which]
                    bleManager.connectToDevice(selectedDevice)
                    Toast.makeText(this, "Menghubungkan ke ${selectedDevice.name ?: selectedDevice.address}...", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Batal") { dialog, _ ->
                bleManager.stopScan()
                dialog.dismiss()
            }
            .show()

        bleManager.startScan()
    }

    private fun hasBlePermissions(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun requestBlePermissions() {
        val perms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        ActivityCompat.requestPermissions(this, perms, REQ_BLE_PERMISSIONS)
    }

    private fun syncHeartRateToServer(bpm: Int) {
        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()
        if (serverUrl.isEmpty() || userId.isEmpty()) return

        scope.launch {
            try {
                val endpoint = "$serverUrl/api/heartrate/sync"
                val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 3000
                    readTimeout = 3000
                    doOutput = true
                }
                val payload = JSONObject().apply {
                    put("userId", userId)
                    put("bpm", bpm)
                }
                OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()); it.flush() }
                conn.responseCode
                conn.disconnect()
            } catch (e: Exception) {}
        }
    }

    private fun setPresetGoal(target: Int) {
        etTargetGoal.setText(target.toString())
    }

    private fun saveAllSettingsToDB() {
        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()
        val displayName = etDisplayName.text.toString().trim().ifEmpty { userId }
        val target = etTargetGoal.text.toString().toIntOrNull() ?: 5000

        if (serverUrl.isEmpty() || userId.isEmpty()) {
            Toast.makeText(this, "Isi Server URL dan User ID", Toast.LENGTH_SHORT).show()
            return
        }

        prefs.edit()
            .putString("server_url", serverUrl)
            .putString("user_id", userId)
            .putString("display_name", displayName)
            .putInt("target_steps", target)
            .apply()

        updateLiveUIFromPrefs()
        StepAwayWidgetProvider.sendUpdateBroadcast(this, prefs.getInt("widget_steps", 0), isTracking, prefs.getString("activity_status", "IDLE") ?: "IDLE")

        scope.launch {
            try {
                val endpoint = "$serverUrl/api/users/$userId/settings"
                val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    doOutput = true
                }
                val payload = JSONObject().apply {
                    put("name", displayName)
                    put("targetSteps", target)
                }
                OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()); it.flush() }
                val code = conn.responseCode
                conn.disconnect()

                withContext(Dispatchers.Main) {
                    if (code in 200..299) {
                        Toast.makeText(this@MainActivity, "✅ Pengaturan disimpan ke database server!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@MainActivity, "Tersimpan lokal (Server code $code)", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Tersimpan lokal (${e.message})", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun createRoomAction() {
        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()
        val roomId = etRoomId.text.toString().trim()
        val passcode = etRoomPasscode.text.toString().trim()

        if (roomId.isEmpty()) {
            Toast.makeText(this, "Isi ID Room terlebih dahulu", Toast.LENGTH_SHORT).show()
            return
        }

        prefs.edit().putString("room_id", roomId).apply()

        scope.launch {
            try {
                val endpoint = "$serverUrl/api/rooms"
                val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    doOutput = true
                }
                val payload = JSONObject().apply {
                    put("roomId", roomId)
                    put("name", roomId)
                    put("isPrivate", passcode.isNotEmpty())
                    put("passcode", passcode)
                    put("creatorId", userId)
                }
                OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()); it.flush() }
                val code = conn.responseCode
                conn.disconnect()

                withContext(Dispatchers.Main) {
                    if (code in 200..299) {
                        Toast.makeText(this@MainActivity, "✅ Room '$roomId' berhasil dibuat!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@MainActivity, "Gagal membuat room (Error $code)", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Koneksi gagal: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun joinRoomAction() {
        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()
        val roomId = etRoomId.text.toString().trim()
        val passcode = etRoomPasscode.text.toString().trim()

        if (roomId.isEmpty()) {
            Toast.makeText(this, "Isi ID Room yang dituju", Toast.LENGTH_SHORT).show()
            return
        }

        scope.launch {
            try {
                val endpoint = "$serverUrl/api/rooms/$roomId/join"
                val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    setRequestProperty("Content-Type", "application/json")
                    doOutput = true
                }
                val payload = JSONObject().apply {
                    put("userId", userId)
                    put("passcode", passcode)
                }
                OutputStreamWriter(conn.outputStream).use { it.write(payload.toString()); it.flush() }
                val code = conn.responseCode
                conn.disconnect()

                withContext(Dispatchers.Main) {
                    if (code in 200..299) {
                        prefs.edit().putString("room_id", roomId).apply()
                        Toast.makeText(this@MainActivity, "✅ Berhasil bergabung ke Room '$roomId'!", Toast.LENGTH_SHORT).show()
                    } else if (code == 403) {
                        Toast.makeText(this@MainActivity, "Passcode room salah!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@MainActivity, "Room tidak ditemukan", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Koneksi gagal: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
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
                    val pace = if (delta >= 100) "RUNNING" else "WALKING"
                    prefs.edit()
                        .putInt("widget_steps", newSteps)
                        .putString("activity_status", pace)
                        .apply()

                    withContext(Dispatchers.Main) {
                        updateLiveUIFromPrefs()
                        StepAwayWidgetProvider.sendUpdateBroadcast(this@MainActivity, newSteps, isTracking, pace)
                        Toast.makeText(this@MainActivity, "+$delta langkah terkirim ke OBS!", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Gagal koneksi: ${e.message}", Toast.LENGTH_SHORT).show()
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

                prefs.edit()
                    .putInt("widget_steps", 0)
                    .putString("activity_status", "IDLE")
                    .apply()

                withContext(Dispatchers.Main) {
                    updateLiveUIFromPrefs()
                    StepAwayWidgetProvider.sendUpdateBroadcast(this@MainActivity, 0, isTracking, "IDLE")
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
                        val name = userObj.optString("name", userId)
                        val pace = userObj.optString("activityStatus", "IDLE")
                        val bpm = userObj.optInt("bpm", 0)

                        prefs.edit()
                            .putInt("widget_steps", steps)
                            .putInt("target_steps", target)
                            .putString("display_name", name)
                            .putString("activity_status", pace)
                            .apply()

                        withContext(Dispatchers.Main) {
                            etDisplayName.setText(name)
                            etTargetGoal.setText(target.toString())
                            if (bpm > 0) tvLiveBpm.text = bpm.toString()
                            updateLiveUIFromPrefs()
                            StepAwayWidgetProvider.sendUpdateBroadcast(this@MainActivity, steps, isTracking, pace)
                        }
                    }
                }
                conn.disconnect()
            } catch (e: Exception) {}
        }
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
        StepAwayWidgetProvider.sendUpdateBroadcast(this, prefs.getInt("widget_steps", 0), true, prefs.getString("activity_status", "IDLE") ?: "IDLE")
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
        StepAwayWidgetProvider.sendUpdateBroadcast(this, prefs.getInt("widget_steps", 0), false, "IDLE")
        Toast.makeText(this, "Tracking dihentikan", Toast.LENGTH_SHORT).show()
    }
}

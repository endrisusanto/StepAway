package com.endrisusanto.stepaway

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var etServerUrl: EditText
    private lateinit var etUserId: EditText
    private lateinit var btnToggleTracking: Button
    private lateinit var tvStatus: TextView
    private lateinit var prefs: SharedPreferences

    private var isTracking = false

    companion object {
        private const val REQ_PERMISSIONS = 101
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("StepAwayPrefs", Context.MODE_PRIVATE)

        etServerUrl = findViewById(R.id.etServerUrl)
        etUserId = findViewById(R.id.etUserId)
        btnToggleTracking = findViewById(R.id.btnToggleTracking)
        tvStatus = findViewById(R.id.tvStatus)

        etServerUrl.setText(prefs.getString("server_url", "https://stepaway.endrisusanto.my.id"))
        etUserId.setText(prefs.getString("user_id", "streamer"))

        checkPermissions()

        btnToggleTracking.setOnClickListener {
            if (isTracking) {
                stopTracking()
            } else {
                startTracking()
            }
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

    private fun startTracking() {
        val serverUrl = etServerUrl.text.toString().trim()
        val userId = etUserId.text.toString().trim()

        if (serverUrl.isEmpty() || userId.isEmpty()) {
            Toast.makeText(this, "Isi Server URL dan User ID terlebih dahulu", Toast.LENGTH_SHORT).show()
            return
        }

        prefs.edit()
            .putString("server_url", serverUrl)
            .putString("user_id", userId)
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
        btnToggleTracking.text = "Stop Tracking"
        btnToggleTracking.setBackgroundColor(0xFFE11D48.toInt())
        tvStatus.text = "Status: Tracking Aktif (Background Running)"
        tvStatus.setTextColor(0xFF10B981.toInt())
    }

    private fun stopTracking() {
        val serviceIntent = Intent(this, StepSensorService::class.java).apply {
            action = StepSensorService.ACTION_STOP
        }
        startService(serviceIntent)

        isTracking = false
        btnToggleTracking.text = "Start Tracking"
        btnToggleTracking.setBackgroundColor(0xFF10B981.toInt())
        tvStatus.text = "Status: Tidak Aktif"
        tvStatus.setTextColor(0xFF94A3B8.toInt())
    }
}

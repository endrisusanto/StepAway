package com.endrisusanto.stepaway

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import java.util.UUID

/**
 * BleHeartRateManager connects to any standard BLE Heart Rate device (0x180D).
 * Supported: Mi Band (with HR broadcast enabled), Apple Watch HR apps, Garmin, Polar, Wahoo,
 * CooSpo, and all standard BLE chest straps / smartbands.
 */
class BleHeartRateManager(private val context: Context) {

    companion object {
        private const val TAG = "BleHeartRateManager"

        val HEART_RATE_SERVICE_UUID: UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        val HEART_RATE_MEASUREMENT_CHAR_UUID: UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        val CCCD_DESCRIPTOR_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    }

    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager?.adapter
    private var bluetoothLeScanner: BluetoothLeScanner? = null

    private var bluetoothGatt: BluetoothGatt? = null
    private var isScanning = false
    private val mainHandler = Handler(Looper.getMainLooper())

    var onBpmUpdated: ((bpm: Int) -> Unit)? = null
    var onConnectionStateChanged: ((isConnected: Boolean, deviceName: String?) -> Unit)? = null
    var onDeviceDiscovered: ((device: BluetoothDevice, rssi: Int) -> Unit)? = null
    var onScanFinished: (() -> Unit)? = null

    private var connectedDeviceName: String? = null
    var currentBpm: Int = 0
        private set

    fun isBluetoothEnabled(): Boolean {
        return bluetoothAdapter != null && bluetoothAdapter.isEnabled
    }

    @SuppressLint("MissingPermission")
    fun startScan(timeoutMs: Long = 12000L) {
        if (!isBluetoothEnabled()) {
            Log.w(TAG, "Bluetooth not enabled or available")
            return
        }

        if (isScanning) return

        bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner
        if (bluetoothLeScanner == null) {
            Log.e(TAG, "BluetoothLeScanner is null")
            return
        }

        val filter = ScanFilter.Builder()
            .setServiceUuid(ParcelUuid(HEART_RATE_SERVICE_UUID))
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        isScanning = true
        // Also scan without filter if devices don't advertise 0x180D in primary advertising packet
        try {
            bluetoothLeScanner?.startScan(listOf(filter), settings, scanCallback)
        } catch (e: Exception) {
            Log.w(TAG, "Filtered scan failed, falling back to generic scan: ${e.message}")
            try {
                bluetoothLeScanner?.startScan(scanCallback)
            } catch (ex: Exception) {
                Log.e(TAG, "Start scan failed: ${ex.message}")
                isScanning = false
                return
            }
        }

        mainHandler.postDelayed({
            stopScan()
        }, timeoutMs)
    }

    @SuppressLint("MissingPermission")
    fun stopScan() {
        if (!isScanning) return
        isScanning = false
        try {
            bluetoothLeScanner?.stopScan(scanCallback)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping scan: ${e.message}")
        }
        mainHandler.post {
            onScanFinished?.invoke()
        }
    }

    private val scanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission")
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            result?.device?.let { device ->
                mainHandler.post {
                    onDeviceDiscovered?.invoke(device, result.rssi)
                }
            }
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE Scan Failed with error code: $errorCode")
            isScanning = false
            mainHandler.post {
                onScanFinished?.invoke()
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun connectToDevice(device: BluetoothDevice) {
        stopScan()
        disconnect()

        connectedDeviceName = device.name ?: device.address
        Log.i(TAG, "Connecting to BLE Heart Rate Device: $connectedDeviceName (${device.address})")

        bluetoothGatt = device.connectGatt(context, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
    }

    @SuppressLint("MissingPermission")
    fun disconnect() {
        currentBpm = 0
        try {
            bluetoothGatt?.disconnect()
            bluetoothGatt?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing GATT: ${e.message}")
        }
        bluetoothGatt = null
        val prevName = connectedDeviceName
        connectedDeviceName = null
        mainHandler.post {
            onConnectionStateChanged?.invoke(false, prevName)
            onBpmUpdated?.invoke(0)
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                Log.i(TAG, "GATT Connected. Discovering services...")
                mainHandler.post {
                    onConnectionStateChanged?.invoke(true, connectedDeviceName)
                }
                gatt?.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                Log.i(TAG, "GATT Disconnected.")
                currentBpm = 0
                mainHandler.post {
                    onConnectionStateChanged?.invoke(false, connectedDeviceName)
                    onBpmUpdated?.invoke(0)
                }
            }
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS || gatt == null) {
                Log.e(TAG, "Service discovery failed with status: $status")
                return
            }

            val hrService = gatt.getService(HEART_RATE_SERVICE_UUID)
            if (hrService == null) {
                Log.w(TAG, "Heart Rate Service 0x180D not found on device!")
                return
            }

            val hrChar = hrService.getCharacteristic(HEART_RATE_MEASUREMENT_CHAR_UUID)
            if (hrChar == null) {
                Log.w(TAG, "Heart Rate Measurement characteristic 0x2A37 not found!")
                return
            }

            // Enable local notifications
            gatt.setCharacteristicNotification(hrChar, true)

            // Enable remote notifications via CCCD descriptor
            val descriptor = hrChar.getDescriptor(CCCD_DESCRIPTOR_UUID)
            if (descriptor != null) {
                descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                gatt.writeDescriptor(descriptor)
                Log.i(TAG, "Subscribed to Heart Rate notifications successfully!")
            } else {
                Log.w(TAG, "CCCD descriptor 0x2902 not found on HR characteristic")
            }
        }

        override fun onCharacteristicChanged(
            gatt: BluetoothGatt?,
            characteristic: BluetoothGattCharacteristic?
        ) {
            if (characteristic == null || characteristic.uuid != HEART_RATE_MEASUREMENT_CHAR_UUID) return

            val flags = characteristic.getIntValue(BluetoothGattCharacteristic.FORMAT_UINT8, 0) ?: return
            val format = if (flags and 0x01 != 0) {
                BluetoothGattCharacteristic.FORMAT_UINT16
            } else {
                BluetoothGattCharacteristic.FORMAT_UINT8
            }

            val bpm = characteristic.getIntValue(format, 1) ?: 0
            if (bpm > 0) {
                currentBpm = bpm
                mainHandler.post {
                    onBpmUpdated?.invoke(bpm)
                }
            }
        }
    }
}

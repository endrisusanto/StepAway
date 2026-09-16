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
import java.util.concurrent.ConcurrentHashMap

/**
 * Data class representing a paired/connected smartband slot for multi-heartrate tracking.
 */
data class BleSlot(
    val slotId: String,
    var slotName: String,
    var deviceAddress: String? = null,
    var deviceName: String? = null,
    var isConnected: Boolean = false,
    var bpm: Int = 0
)

/**
 * BleHeartRateManager connects to one or multiple standard BLE Heart Rate devices (0x180D).
 * Supported: Mi Band, Apple Watch HR apps, Garmin, Polar, Wahoo, CooSpo, and all standard BLE chest straps / smartbands.
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

    // Multi-device connections: slotId -> BluetoothGatt
    private val connectedGatts = ConcurrentHashMap<String, BluetoothGatt>()
    // Address to slotId map
    private val addressToSlotMap = ConcurrentHashMap<String, String>()
    // Slot metadata list
    private val slots = ConcurrentHashMap<String, BleSlot>()

    private var isScanning = false
    private val mainHandler = Handler(Looper.getMainLooper())

    // Backward-compatible single-device callbacks
    var onBpmUpdated: ((bpm: Int) -> Unit)? = null
    var onConnectionStateChanged: ((isConnected: Boolean, deviceName: String?) -> Unit)? = null

    // Multi-slot callbacks
    var onSlotBpmUpdated: ((slotId: String, bpm: Int) -> Unit)? = null
    var onSlotConnectionStateChanged: ((slotId: String, isConnected: Boolean, deviceName: String?) -> Unit)? = null

    var onDeviceDiscovered: ((device: BluetoothDevice, rssi: Int) -> Unit)? = null
    var onScanFinished: (() -> Unit)? = null

    var currentBpm: Int = 0
        private set

    init {
        // Initialize default slots (Primary Streamer + 3 Co-host/Guest slots)
        slots["slot_1"] = BleSlot("slot_1", "Streamer (Host)")
        slots["slot_2"] = BleSlot("slot_2", "Player 2")
        slots["slot_3"] = BleSlot("slot_3", "Player 3")
        slots["slot_4"] = BleSlot("slot_4", "Player 4")
    }

    fun isBluetoothEnabled(): Boolean {
        return bluetoothAdapter != null && bluetoothAdapter.isEnabled
    }

    fun getSlots(): List<BleSlot> = slots.values.sortedBy { it.slotId }

    fun getSlot(slotId: String): BleSlot? = slots[slotId]

    fun updateSlotName(slotId: String, name: String) {
        slots[slotId]?.let { it.slotName = name }
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

    /**
     * Connects a BLE device to a specific slot (e.g. "slot_1", "slot_2", etc.)
     */
    @SuppressLint("MissingPermission")
    fun connectSlot(slotId: String, device: BluetoothDevice, customSlotName: String? = null) {
        disconnectSlot(slotId)

        val slot = slots.getOrPut(slotId) { BleSlot(slotId, customSlotName ?: "Player $slotId") }
        if (!customSlotName.isNullOrBlank()) {
            slot.slotName = customSlotName
        }
        slot.deviceAddress = device.address
        slot.deviceName = device.name ?: device.address

        addressToSlotMap[device.address] = slotId
        Log.i(TAG, "Connecting slot '$slotId' (${slot.slotName}) to ${slot.deviceName} (${device.address})")

        val gatt = device.connectGatt(context, false, createGattCallback(slotId), BluetoothDevice.TRANSPORT_LE)
        connectedGatts[slotId] = gatt
    }

    /**
     * Backward-compatible connect for single device (Slot 1)
     */
    @SuppressLint("MissingPermission")
    fun connectToDevice(device: BluetoothDevice) {
        stopScan()
        connectSlot("slot_1", device)
    }

    @SuppressLint("MissingPermission")
    fun disconnectSlot(slotId: String) {
        val gatt = connectedGatts.remove(slotId)
        val slot = slots[slotId]
        if (slot != null) {
            slot.deviceAddress?.let { addressToSlotMap.remove(it) }
            slot.isConnected = false
            slot.bpm = 0
        }

        try {
            gatt?.disconnect()
            gatt?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing GATT for slot $slotId: ${e.message}")
        }

        if (slotId == "slot_1") {
            currentBpm = 0
            mainHandler.post {
                onConnectionStateChanged?.invoke(false, slot?.deviceName)
                onBpmUpdated?.invoke(0)
            }
        }

        mainHandler.post {
            onSlotConnectionStateChanged?.invoke(slotId, false, slot?.deviceName)
            onSlotBpmUpdated?.invoke(slotId, 0)
        }
    }

    /**
     * Disconnects all slots (or single device)
     */
    @SuppressLint("MissingPermission")
    fun disconnect() {
        disconnectAll()
    }

    @SuppressLint("MissingPermission")
    fun disconnectAll() {
        slots.keys.forEach { slotId ->
            disconnectSlot(slotId)
        }
    }

    private fun createGattCallback(slotId: String) = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            val slot = slots[slotId]
            val devName = slot?.deviceName ?: gatt?.device?.address

            if (newState == BluetoothProfile.STATE_CONNECTED) {
                Log.i(TAG, "[$slotId] GATT Connected ($devName). Discovering services...")
                slot?.isConnected = true
                mainHandler.post {
                    if (slotId == "slot_1") {
                        onConnectionStateChanged?.invoke(true, devName)
                    }
                    onSlotConnectionStateChanged?.invoke(slotId, true, devName)
                }
                gatt?.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                Log.i(TAG, "[$slotId] GATT Disconnected ($devName).")
                slot?.isConnected = false
                slot?.bpm = 0
                if (slotId == "slot_1") {
                    currentBpm = 0
                }
                mainHandler.post {
                    if (slotId == "slot_1") {
                        onConnectionStateChanged?.invoke(false, devName)
                        onBpmUpdated?.invoke(0)
                    }
                    onSlotConnectionStateChanged?.invoke(slotId, false, devName)
                    onSlotBpmUpdated?.invoke(slotId, 0)
                }
            }
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            if (status != BluetoothGatt.GATT_SUCCESS || gatt == null) {
                Log.e(TAG, "[$slotId] Service discovery failed with status: $status")
                return
            }

            val hrService = gatt.getService(HEART_RATE_SERVICE_UUID)
            if (hrService == null) {
                Log.w(TAG, "[$slotId] Heart Rate Service 0x180D not found!")
                return
            }

            val hrChar = hrService.getCharacteristic(HEART_RATE_MEASUREMENT_CHAR_UUID)
            if (hrChar == null) {
                Log.w(TAG, "[$slotId] Heart Rate Measurement characteristic 0x2A37 not found!")
                return
            }

            gatt.setCharacteristicNotification(hrChar, true)

            val descriptor = hrChar.getDescriptor(CCCD_DESCRIPTOR_UUID)
            if (descriptor != null) {
                descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                gatt.writeDescriptor(descriptor)
                Log.i(TAG, "[$slotId] Subscribed to Heart Rate notifications successfully!")
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
                val slot = slots[slotId]
                slot?.bpm = bpm
                if (slotId == "slot_1") {
                    currentBpm = bpm
                }
                mainHandler.post {
                    if (slotId == "slot_1") {
                        onBpmUpdated?.invoke(bpm)
                    }
                    onSlotBpmUpdated?.invoke(slotId, bpm)
                }
            }
        }
    }
}

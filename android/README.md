# StepAway Android App (Step Tracker Client)

Aplikasi Android untuk membaca sensor langkah kaki bawaan smartphone (`Sensor.TYPE_STEP_COUNTER`) dan mengirimkan data langkah secara real-time ke server **StepAway** (`https://stepaway.endrisusanto.my.id`) untuk ditampilkan di OBS overlay.

---

## Fitur
1. **Background Step Sensor Tracking**: Menggunakan Android `ForegroundService` dengan persistent notification dan partial wake-lock agar tracking tidak dihentikan oleh sistem saat layar mati atau terkunci.
2. **Debounced Real-time Sync**: Mengirimkan perubahan langkah ke backend server dengan throttle ~600ms untuk menghemat baterai sekaligus menjaga animasi OBS tetap responsif.
3. **Konfigurasi Mudah**: Cukup masukkan domain server dan User ID streamer, lalu tekan **Start Tracking**.

---

## Cara Build & Install APK

1. Buka folder `android/` di **Android Studio**.
2. Hubungkan smartphone Android dengan kabel USB (aktifkan *USB Debugging*).
3. Klik tombol **Run 'app'** di Android Studio, atau build APK melalui:
   ```bash
   ./gradlew assembleDebug
   ```
4. File APK debug akan berada di: `app/build/outputs/apk/debug/app-debug.apk`.
5. Buka aplikasi di HP, izinkan izin **Activity Recognition** dan **Notification**, lalu masukkan `https://stepaway.endrisusanto.my.id` dan User ID Anda.

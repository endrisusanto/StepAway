# StepAway - Real-time OBS Step Counter & Heart Rate Overlay System

Sistem overlay OBS berbasis web dan aplikasi Android untuk menampilkan sensor langkah kaki dan detak jantung (Heart Rate BLE 0x180D) streamer secara real-time. Dilengkapi animasi floating step, progress target bar dinamis, klasifikasi zona kardio, room multi-user co-op/battle, serta 3 varian widget home screen Android.

Dibuat oleh **@endrisusanto** dengan arsitektur lean berbasis standar Anti-Slop (desain responsif, tema Dark Gray netral, kontras tinggi WCAG AA, dan zero bloatware).

---

## Fitur Utama

1. **Real-time Step Counter & Cadence**:
   - Memanfaatkan sensor bawaan smartphone Android untuk menghitung langkah kaki saat live streaming.
   - Deteksi ritme otomatis: `IDLE`, `WALKING`, dan `RUNNING`.
   - Efek visual floating pop-up per langkah dan perayaan milestone setiap kelipatan target.

2. **Smartband Heart Rate Broadcast (BLE GATT 0x180D)**:
   - Integrasi protokol standar BLE (seperti Pulsoid dan HypeRate) untuk membaca detak jantung langsung dari smartband/chest strap.
   - Kalkulasi zona latihan real-time: `Rest`, `Aerobic`, `Anaerobic`, dan `Peak`.
   - Auto-timeout dan handshake pemutusan koneksi otomatis (menampilkan `-` saat terputus).

3. **Draggable Overlay Cards**:
   - Widget card pada seluruh overlay OBS dapat digeser posisinya secara bebas (*drag and drop*) menggunakan mouse atau touch.

4. **Multi-User Room System**:
   - Fitur co-op atau battle antar streamer dengan sistem Room ID (dukungan mode publik atau private ber-passcode).

5. **Web Dashboard Responsif & Fullwidth**:
   - Desain fluid fullwidth yang menyesuaikan sempurna di Desktop, Tablet, dan Mobile.
   - Live Overlay Preview interaktif dengan iframe tab switcher, kontrol ukuran cepat (220px, 340px, 500px), drag vertical resize, dan mode Fullscreen.

6. **3 Varian Widget Android Home Screen**:
   - **Combo Pro Widget (4x2)**: Langkah, Goal progress bar, chip Heart Rate (BPM), dan status aktivitas.
   - **Compact Step Widget (2x2 / 2x1)**: Tampilan langkah minimalis dengan angka besar dan status ritme.
   - **Heart Rate Widget (2x2 / 2x1)**: Tampilan monitor live BPM dan badge zona latihan mandiri.

---

## Struktur Folder

```text
StepAway/
├── Dockerfile                  # Multi-stage Docker build untuk Node.js server
├── docker-compose.yml          # Konfigurasi container service & port mapping (3344:3000)
├── package.json                # Dependensi server Express & WebSocket
├── server.js                   # REST API, WebSocket Hub, persistence, & HR timeout watcher
├── release.sh                  # Script rilis otomatis & pemicu GitHub Actions
├── data/                       # Penyimpanan database disk persistence (storage.json)
├── public/
│   ├── index.html              # Redirect otomatis ke /dashboard
│   ├── dashboard.html          # Streamer control panel & live preview
│   ├── overlay.html            # OBS Browser Source Step Counter (+ HR Combo)
│   ├── overlay-heartrate.html  # OBS Browser Source Standalone Heart Rate (BPM)
│   ├── overlay-multi.html      # OBS Browser Source Multi-User Room
│   ├── favicon.svg             # Favicon vektor solid
│   ├── css/
│   │   ├── dashboard.css       # Styling control panel (Dark Gray & fullwidth responsif)
│   │   └── overlay.css         # Styling widget OBS transparan, glow, & font atletik
│   └── js/
│       ├── dashboard.js        # Logika simulator, WebSocket client, & resize controller
│       ├── draggable.js        # Modul interaktif drag and drop repositioning
│       ├── overlay.js          # Client step overlay & particle animator
│       ├── overlay-heartrate.js# Client heart rate overlay & beat synchronizer
│       └── overlay-multi.js    # Client room grid multi-user
└── android/                    # Source code Kotlin Android StepAway Tracker App
    ├── app/src/main/
    │   ├── AndroidManifest.xml # Izin activity recognition, BLE, & 3 widget receivers
    │   ├── java/com/endrisusanto/stepaway/
    │   │   ├── MainActivity.kt            # Control panel Android, scanner BLE, & simulator
    │   │   ├── BleHeartRateManager.kt     # Scanner & GATT client 0x180D BLE Smartband
    │   │   ├── StepSensorService.kt       # Background sensor foreground service & sync
    │   │   ├── StepAwayWidgetProvider.kt  # Provider Combo Pro Widget (4x2)
    │   │   ├── StepCompactWidgetProvider.kt # Provider Compact Step Widget (2x2)
    │   │   └── HeartRateWidgetProvider.kt # Provider Standalone HR Widget (2x2)
    │   └── res/
    │       ├── layout/                    # Layout UI activity_main dan 3 varian widget
    │       ├── xml/                       # Metadata konfigurasi appwidget-provider
    │       └── drawable/                  # Background card dark gray dan track progress
    └── README.md
```

---

## Panduan Menjalankan Server (Docker)

1. **Jalankan Container**:
   ```bash
   docker compose up -d --build
   ```

2. **Periksa Status Container**:
   ```bash
   docker compose ps
   ```
   Web server akan aktif di port `3344` (`http://localhost:3344/dashboard`).

3. **Konfigurasi Reverse Proxy (Nginx)**:
   Hubungkan domain Anda (misal `stepaway.endrisusanto.my.id`) ke port `3344` dengan header WebSocket:

   ```nginx
   server {
       server_name stepaway.endrisusanto.my.id;

       location / {
           proxy_pass http://127.0.0.1:3344;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

---

## URL Browser Source OBS Studio

Tambahkan Browser Source baru di OBS Studio dengan URL berikut:

| Tipe Widget | URL Browser Source | Rekomendasi Resolusi |
| :--- | :--- | :--- |
| **Step Counter** | `https://stepaway.endrisusanto.my.id/overlay?user=streamer` | 420 x 140 px |
| **Heart Rate Standalone** | `https://stepaway.endrisusanto.my.id/overlay/heartrate?user=streamer` | 240 x 90 px |
| **Step + Heart Rate Combo**| `https://stepaway.endrisusanto.my.id/overlay?user=streamer&show_hr=true` | 420 x 140 px |
| **Multi-User Room Overlay** | `https://stepaway.endrisusanto.my.id/overlay/multi?room=walk-squad` | 420 x 360 px |
| **Test Preview Demo** | `https://stepaway.endrisusanto.my.id/overlay?user=streamer&test=true` | 420 x 140 px |

*Catatan: Seluruh overlay memiliki background transparan otomatis dan card dapat digeser langsung di viewport preview.*

---

## Panduan Penggunaan Aplikasi Android

1. Download dan pasang file APK StepAway pada smartphone Android.
2. Buka aplikasi dan atur **Server URL** (contoh: `https://stepaway.endrisusanto.my.id`) dan **User ID** unik Anda.
3. Hubungkan Smartband/Sensor Detak Jantung via tombol **Scan Smartband** (standar GATT BLE 0x180D).
4. Tekan tombol **Start Tracking**. Sensor langkah dan detak jantung akan berjalan di background service dan menyiarkan data secara real-time ke OBS.
5. Tambahkan widget di Home Screen smartphone untuk memantau capaian target dan denyut jantung tanpa membuka aplikasi.

---

## Kontributor

Dikembangkan dan dikelola oleh **@endrisusanto**.
Lisensi: MIT.

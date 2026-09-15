# StepAway: Real-time OBS Step Counter & Heart Rate Overlay System

Sistem overlay OBS berbasis web dan aplikasi Android untuk menampilkan sensor langkah kaki dan detak jantung (Heart Rate BLE 0x180D) streamer secara real-time. Dilengkapi animasi floating step, progress bar target dinamis, klasifikasi zona kardio, sistem room multi-user co-op/battle, serta 3 varian widget home screen Android.

Dibuat dan dikelola oleh **@endrisusanto**.

---

## Tangkapan Layar (Screenshots)

### 1. Widget Home Screen Android & Aplikasi Mobile
| 3 Varian Widget Homescreen | Aplikasi Android StepAway |
| :---: | :---: |
| ![Android Widgets](docs/screenshots/Screenshot_20260915_132654_One%20UI%20Home.jpg) | ![Android App Interface](docs/screenshots/screenshots/Screenshot_20260915_133145.jpg) |
| *Widget Combo 4x2, Step 2x2, dan Heart Rate 2x2* | *Kontrol tracking, scanner smartband BLE, dan simulator* |

### 2. Web Dashboard & Live Preview
| Dashboard Streamer & Live Overlay Preview | Multi-User Room Overlay |
| :---: | :---: |
| ![Web Dashboard Preview](docs/screenshots/stepaway.endrisusanto.my.id-dashboard(iPad%20Pro%2013).png) | ![Multi-User Room](docs/screenshots/stepaway.endrisusanto.my.id-overlay(iPhone%20SE).png) |
| *Preview interaktif, tab switcher, dan simulator* | *Mode co-op / battle multi streamer* |

---

## Fitur Utama

1. **Real-time Step Counter & Cadence**:
   - Membaca sensor langkah kaki bawaan smartphone Android secara akurat.
   - Deteksi ritme aktivitas otomatis: `IDLE`, `WALKING`, dan `RUNNING`.
   - Efek visual floating pop-up angka per langkah dan animasi milestone target tercapai.

2. **Smartband Heart Rate Broadcast (BLE GATT 0x180D)**:
   - Integrasi protokol standar BLE (kompatibel dengan smartband & chest strap seperti Mi Band, Garmin, Polar, HypeRate/Pulsoid broadcast).
   - Klasifikasi zona latihan otomatis: `REST`, `AEROBIC`, `ANAEROBIC`, dan `PEAK`.
   - Proteksi auto-disconnect: Menampilkan `-` saat smartband terputus.

3. **Draggable Overlay Cards**:
   - Posisi widget card pada seluruh overlay OBS dapat digeser secara bebas (*drag and drop*) menggunakan kursor atau touch.

4. **3 Varian Widget Android Home Screen**:
   - **StepAway Combo (4x2)**: Menampilkan langkah, goal progress bar, chip Heart Rate (BPM), dan status ritme aktivitas.
   - **Step Tracker (2x2)**: Monitor langkah kaki ringkas dengan angka hero besar, progress bar bawah, dan persentase target.
   - **Heart Rate (2x2)**: Monitor detak jantung real-time (BPM) dengan indikator zona intensitas kardio.

5. **Multi-User Room System**:
   - Kolaborasi tracking atau battle langkah antar streamer via Room ID (mendukung mode publik atau private dengan passcode).

6. **Web Dashboard Responsif**:
   - Desain fullwidth yang menyesuaikan di Desktop, Tablet, dan Mobile.
   - Live Preview responsif dengan switch tab instan, preset ukuran (220px, 340px, 500px), drag vertical resize, dan mode Fullscreen.

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
├── docs/screenshots/           # Direktori aset tangkapan layar dokumentasi
├── public/
│   ├── index.html              # Redirect otomatis ke /dashboard
│   ├── dashboard.html          # Streamer control panel & live preview
│   ├── overlay.html            # OBS Browser Source Step Counter (+ HR Combo)
│   ├── overlay-heartrate.html  # OBS Browser Source Standalone Heart Rate (BPM)
│   ├── overlay-multi.html      # OBS Browser Source Multi-User Room
│   ├── favicon.svg             # Favicon vektor solid
│   ├── css/
│   │   ├── dashboard.css       # Styling control panel fullwidth responsif
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
    │   │   ├── StepAwayWidgetProvider.kt  # Provider Combo Widget (4x2)
    │   │   ├── StepCompactWidgetProvider.kt # Provider Step Tracker (2x2)
    │   │   └── HeartRateWidgetProvider.kt # Provider Heart Rate Widget (2x2)
    │   └── res/
    │       ├── layout/                    # Layout UI activity_main dan 3 varian widget
    │       ├── xml/                       # Metadata konfigurasi appwidget-provider
    │       └── drawable/                  # Background card dark gray dan preview picker
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
   Hubungkan domain Anda (misal `stepaway.endrisusanto.my.id`) ke port `3344` dengan konfigurasi WebSocket:

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

Tambahkan Browser Source baru di OBS Studio dengan tautan berikut:

| Tipe Widget | URL Browser Source | Rekomendasi Resolusi |
| :--- | :--- | :--- |
| **Step Counter** | `https://stepaway.endrisusanto.my.id/overlay?user=streamer` | 420 x 140 px |
| **Heart Rate Standalone** | `https://stepaway.endrisusanto.my.id/overlay/heartrate?user=streamer` | 240 x 90 px |
| **Step + Heart Rate Combo** | `https://stepaway.endrisusanto.my.id/overlay?user=streamer&show_hr=true` | 420 x 140 px |
| **Multi-User Room Overlay** | `https://stepaway.endrisusanto.my.id/overlay/multi?room=walk-squad` | 420 x 360 px |
| **Test Preview Demo** | `https://stepaway.endrisusanto.my.id/overlay?user=streamer&test=true` | 420 x 140 px |

*Catatan: Seluruh overlay memiliki background transparan dan kartu widget dapat digeser langsung di viewport preview OBS.*

---

## Panduan Penggunaan Aplikasi Android

1. Download dan instal file APK StepAway (`StepAway-vX.X.X.apk`) dari halaman Releases GitHub.
2. Buka aplikasi dan atur **User ID (Key Unik)**, **Display Name**, dan **Target Langkah**.
3. Hubungkan Smartband/Sensor Detak Jantung via tombol **Scan Smartband** (standar GATT BLE 0x180D).
4. Tekan tombol **Start Tracking**. Sensor langkah dan detak jantung akan berjalan di background service serta menyiarkan data secara real-time ke server OBS.
5. Tambahkan widget di Home Screen Android untuk memantau capaian langkah dan detak jantung live tanpa harus membuka aplikasi.

---

## Kontributor & Lisensi

Dikembangkan dan dikelola oleh **@endrisusanto**.  
Lisensi: MIT.

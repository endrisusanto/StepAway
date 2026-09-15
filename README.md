# StepAway - Real-time OBS Step Counter System

Sistem overlay OBS berbasis web untuk menampilkan langkah kaki streamer secara real-time dari sensor smartphone Android, lengkap dengan efek animasi floating `+1`, pulsing progress bar dengan target langkah & persentase, serta perayaan milestone ribuan langkah.

---

## Struktur Folder

```text
StepAway/
├── Dockerfile                  # Multi-stage Docker build untuk server & web app
├── docker-compose.yml          # Konfigurasi container service & volume persistence
├── package.json                # Dependensi server Node.js & WebSocket
├── server.js                   # REST API & WebSocket Hub server
├── data/                       # Penyimpanan disk persistence (storage.json)
├── public/
│   ├── index.html              # Redirect ke dashboard
│   ├── dashboard.html          # Control panel streamer & simulator pengujian
│   ├── overlay.html            # OBS Browser Source Single-User
│   ├── overlay-multi.html      # OBS Browser Source Multi-User (Co-op/Battle)
│   ├── css/
│   │   ├── overlay.css         # Styling OBS widget, tier theme, pulse bar & milestone banner
│   │   └── dashboard.css       # Styling control panel
│   └── js/
│       ├── overlay.js          # WebSocket client single user & particle animator
│       ├── overlay-multi.js    # WebSocket client multi-user
│       └── dashboard.js        # Logika simulator & interaksi dashboard
└── android/                    # Source code Kotlin Android Step Tracker App
    ├── app/src/main/
    │   ├── AndroidManifest.xml # Izin activity recognition & foreground service
    │   ├── java/com/endrisusanto/stepaway/
    │   │   ├── MainActivity.kt       # UI konfigurasi input server & user ID
    │   │   └── StepSensorService.kt  # Background sensor listener & network sync
    │   └── res/layout/activity_main.xml
    └── README.md
```

---

## Cara Menjalankan dengan Docker

1. **Jalankan Container**:
   ```bash
   docker compose up -d --build
   ```
2. **Periksa Status**:
   ```bash
   docker compose ps
   ```
   Web server akan berjalan di port `3344` (`http://localhost:3344`).

3. **Domain & Reverse Proxy (`stepaway.endrisusanto.my.id`)**:
   Hubungkan reverse proxy (Nginx, Caddy, atau Cloudflare Tunnel) ke `localhost:3344` dengan dukungan WebSocket headers (`Upgrade` & `Connection`).

   Contoh Nginx config:
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

## Cara Penggunaan di OBS Studio

1. Buka OBS Studio -> Tambahkan Source -> Pilih **Browser**.
2. Masukkan URL:
   - **Single User**: `https://stepaway.endrisusanto.my.id/overlay?user=streamer`
   - **Multi User**: `https://stepaway.endrisusanto.my.id/overlay/multi?users=streamer,guest`
   - **Test Preview Mode**: `https://stepaway.endrisusanto.my.id/overlay?user=streamer&test=true`
3. Atur resolusi: **Width: 420**, **Height: 140**.
4. Selesai! Overlay akan menampilkan langkah secara transparan dan dinamis.

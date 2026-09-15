document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const liveSteps = document.getElementById('liveSteps');
  const liveTarget = document.getElementById('liveTarget');
  const livePercent = document.getElementById('livePercent');
  const livePaceBadge = document.getElementById('livePaceBadge');
  const liveBpm = document.getElementById('liveBpm');
  const liveBpmZone = document.getElementById('liveBpmZone');
  const metricProgressBar = document.getElementById('metricProgressBar');
  const metricCardSteps = document.getElementById('metricCardSteps');
  const metricMilestoneBanner = document.getElementById('metricMilestoneBanner');
  const metricMilestoneVal = document.getElementById('metricMilestoneVal');
  const metricParticlesLayer = document.getElementById('metricParticlesLayer');
  let milestoneDashboardTimer = null;
  const brandLogoIcon = document.getElementById('brandLogoIcon');
  const guideUserId = document.getElementById('guideUserId');

  const urlSingle = document.getElementById('urlSingle');
  const urlHeartrate = document.getElementById('urlHeartrate');
  const urlCombo = document.getElementById('urlCombo');
  const urlRoom = document.getElementById('urlRoom');
  const urlTest = document.getElementById('urlTest');
  const urlWebhookTipTap = document.getElementById('urlWebhookTipTap');

  const inputUserId = document.getElementById('inputUserId');
  const inputDisplayName = document.getElementById('inputDisplayName');
  const inputTarget = document.getElementById('inputTarget');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const presetBtns = document.querySelectorAll('.preset-btn');

  // TipTap Donation Elements
  const chkDonationEnabled = document.getElementById('chkDonationEnabled');
  const donationStatusBadge = document.getElementById('donationStatusBadge');
  const selectDonationMode = document.getElementById('selectDonationMode');
  const inputDonationRate = document.getElementById('inputDonationRate');
  const inputDonationMin = document.getElementById('inputDonationMin');
  const inputDonationSecret = document.getElementById('inputDonationSecret');
  const btnSaveDonationSettings = document.getElementById('btnSaveDonationSettings');
  const btnTestDonation10k = document.getElementById('btnTestDonation10k');
  const btnTestDonation50k = document.getElementById('btnTestDonation50k');
  const btnTestDonation100k = document.getElementById('btnTestDonation100k');
  const btnRefreshDonations = document.getElementById('btnRefreshDonations');
  const donationHistoryTbody = document.getElementById('donationHistoryTbody');

  const btnSim1 = document.getElementById('btnSim1');
  const btnSim10 = document.getElementById('btnSim10');
  const btnSim100 = document.getElementById('btnSim100');
  const btnSim1000 = document.getElementById('btnSim1000');
  const btnReset = document.getElementById('btnReset');

  // Heart Rate Sim Buttons
  const btnHrRest = document.getElementById('btnHrRest');
  const btnHrAerobic = document.getElementById('btnHrAerobic');
  const btnHrAnaerobic = document.getElementById('btnHrAnaerobic');
  const btnHrPeak = document.getElementById('btnHrPeak');

  // Preview Switcher & Fullscreen
  const previewContainer = document.getElementById('previewContainer');
  const previewIframe = document.getElementById('previewIframe');
  const tabPreviewStep = document.getElementById('tabPreviewStep');
  const tabPreviewHr = document.getElementById('tabPreviewHr');
  const tabPreviewCombo = document.getElementById('tabPreviewCombo');
  const btnFullscreenPreview = document.getElementById('btnFullscreenPreview');
  const previewSizeBtns = document.querySelectorAll('.preview-size-btn');
  const previewHeightLabel = document.getElementById('previewHeightLabel');

  // Room Management
  const inputRoomId = document.getElementById('inputRoomId');
  const inputRoomName = document.getElementById('inputRoomName');
  const chkPrivateRoom = document.getElementById('chkPrivateRoom');
  const inputRoomPasscode = document.getElementById('inputRoomPasscode');
  const btnCreateRoom = document.getElementById('btnCreateRoom');

  const inputJoinRoomId = document.getElementById('inputJoinRoomId');
  const inputJoinPasscode = document.getElementById('inputJoinPasscode');
  const btnJoinRoom = document.getElementById('btnJoinRoom');

  // SaaS Auth & Profile Elements
  const authGuestBox = document.getElementById('authGuestBox');
  const authUserBox = document.getElementById('authUserBox');
  const headerUserName = document.getElementById('headerUserName');
  const headerPlanBadge = document.getElementById('headerPlanBadge');
  const btnOpenLoginModal = document.getElementById('btnOpenLoginModal');
  const btnLogout = document.getElementById('btnLogout');
  const btnOpenQrModal = document.getElementById('btnOpenQrModal');
  const btnOpenQrModalTab = document.getElementById('btnOpenQrModalTab');

  // Theme Toggle Elements
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeIconSun = document.getElementById('themeIconSun');
  const themeIconMoon = document.getElementById('themeIconMoon');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('stepaway_theme', theme);
    if (theme === 'light') {
      if (themeIconSun) themeIconSun.style.display = 'none';
      if (themeIconMoon) themeIconMoon.style.display = 'block';
    } else {
      if (themeIconSun) themeIconSun.style.display = 'block';
      if (themeIconMoon) themeIconMoon.style.display = 'none';
    }
  }

  const savedTheme = localStorage.getItem('stepaway_theme') || 
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(savedTheme);

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  // Tab Access Switching
  const tabBtns = document.querySelectorAll('.dash-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetTab);
      if (targetPane) targetPane.classList.add('active');

      localStorage.setItem('stepaway_active_tab', targetTab);
    });
  });

  // Restore Last Active Tab
  const savedActiveTab = localStorage.getItem('stepaway_active_tab');
  if (savedActiveTab) {
    const savedBtn = document.querySelector(`.dash-tab-btn[data-tab="${savedActiveTab}"]`);
    if (savedBtn) savedBtn.click();
  }

  const displayStreamKey = document.getElementById('displayStreamKey');
  const btnRegenStreamKey = document.getElementById('btnRegenStreamKey');

  const authModal = document.getElementById('authModal');
  const authModalTitle = document.getElementById('authModalTitle');
  const tabAuthLogin = document.getElementById('tabAuthLogin');
  const tabAuthRegister = document.getElementById('tabAuthRegister');
  const formLogin = document.getElementById('formLogin');
  const formRegister = document.getElementById('formRegister');
  const inputLoginEmail = document.getElementById('inputLoginEmail');
  const inputLoginPassword = document.getElementById('inputLoginPassword');
  const inputRegName = document.getElementById('inputRegName');
  const inputRegEmail = document.getElementById('inputRegEmail');
  const inputRegPassword = document.getElementById('inputRegPassword');
  const btnCloseAuthModal = document.getElementById('btnCloseAuthModal');

  const qrPairingModal = document.getElementById('qrPairingModal');
  const btnCloseQrModal = document.getElementById('btnCloseQrModal');
  const btnCloseQrFooter = document.getElementById('btnCloseQrFooter');
  const qrServerUrl = document.getElementById('qrServerUrl');
  const qrStreamKeyVal = document.getElementById('qrStreamKeyVal');
  const qrSvgCode = document.getElementById('qrSvgCode');

  let currentUserId = localStorage.getItem('stepaway_userid') || 'streamer';
  let currentStreamKey = localStorage.getItem('stepaway_streamkey') || 'sk_live_demo_streamer';
  let currentUserAccount = null;
  inputUserId.value = currentUserId;

  let activeRoomId = localStorage.getItem('stepaway_roomid') || 'global';
  let activePreviewMode = 'step';

  let ws = null;

  function updateUrls() {
    const origin = window.location.origin;
    const keyParam = currentStreamKey ? `key=${encodeURIComponent(currentStreamKey)}` : `user=${encodeURIComponent(currentUserId)}`;
    const single = `${origin}/overlay?${keyParam}`;
    const heartrate = `${origin}/overlay/heartrate?${keyParam}`;
    const combo = `${origin}/overlay?${keyParam}&show_hr=true`;
    const room = `${origin}/overlay/multi?room=${encodeURIComponent(activeRoomId)}`;
    const test = `${origin}/overlay?${keyParam}&test=true`;
    const webhook = `${origin}/api/webhooks/tiptap?key=${encodeURIComponent(currentStreamKey || currentUserId)}`;

    urlSingle.textContent = single;
    urlHeartrate.textContent = heartrate;
    urlCombo.textContent = combo;
    urlRoom.textContent = room;
    urlTest.textContent = test;
    if (urlWebhookTipTap) urlWebhookTipTap.textContent = webhook;
    if (displayStreamKey) displayStreamKey.textContent = currentStreamKey || 'sk_live_demo_streamer';
    if (qrStreamKeyVal) qrStreamKeyVal.textContent = currentStreamKey || 'sk_live_demo_streamer';
    if (qrServerUrl) qrServerUrl.textContent = origin;
    guideUserId.textContent = currentUserId;

    updatePreviewIframe();
    generateQrSvg();
  }

  function generateQrSvg() {
    const qrHolder = document.getElementById('qrCanvasContainer');
    if (!qrHolder) return;
    const pairingPayload = JSON.stringify({
      server: window.location.origin,
      userId: currentUserId,
      apiKey: currentStreamKey
    });

    if (typeof window.generateQrCodeSvg === 'function') {
      qrHolder.innerHTML = window.generateQrCodeSvg(pairingPayload, 200);
    }
  }

  function updatePreviewIframe() {
    if (!previewIframe) return;
    const keyParam = currentStreamKey ? `key=${encodeURIComponent(currentStreamKey)}` : `user=${encodeURIComponent(currentUserId)}`;
    if (activePreviewMode === 'hr') {
      previewIframe.src = `/overlay/heartrate?${keyParam}`;
    } else if (activePreviewMode === 'combo') {
      previewIframe.src = `/overlay?${keyParam}&show_hr=true`;
    } else {
      previewIframe.src = `/overlay?${keyParam}`;
    }
  }

  // ponytail: dynamic milestone palette rotation
  function getMilestoneScheme(milestone) {
    const schemes = [
      { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', text: '#09090b', glow: 'rgba(16, 185, 129, 0.6)', accent: '#10b981' }, // Emerald
      { bg: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)', text: '#09090b', glow: 'rgba(6, 182, 212, 0.6)', accent: '#06b6d4' }, // Cyan Blue
      { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', text: '#ffffff', glow: 'rgba(139, 92, 246, 0.6)', accent: '#8b5cf6' }, // Violet Purple
      { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', text: '#09090b', glow: 'rgba(245, 158, 11, 0.6)', accent: '#f59e0b' }, // Amber Gold
      { bg: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', text: '#ffffff', glow: 'rgba(244, 63, 94, 0.6)', accent: '#f43f5e' }, // Rose Crimson
      { bg: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)', text: '#ffffff', glow: 'rgba(236, 72, 153, 0.6)', accent: '#ec4899' }  // Pink Purple
    ];
    const idx = Math.max(0, Math.floor(Number(milestone || 1000) / 1000) - 1) % schemes.length;
    return schemes[idx];
  }

  function applyPaceBadge(status) {
    livePaceBadge.className = 'activity-badge';
    if (status === 'RUNNING') {
      livePaceBadge.classList.add('activity-running');
      livePaceBadge.textContent = 'RUNNING';
    } else if (status === 'WALKING') {
      livePaceBadge.classList.add('activity-walking');
      livePaceBadge.textContent = 'WALKING';
    } else {
      livePaceBadge.classList.add('activity-idle');
      livePaceBadge.textContent = 'REST';
    }
  }

  let lastSuccessfulHttpSync = 0;

  async function fetchUserStats() {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}`);
      const json = await res.json();
      if (json.success && json.user) {
        lastSuccessfulHttpSync = Date.now();
        const prev = parseInt(liveSteps.textContent.replace(/,/g, ''), 10) || 0;
        const next = json.user.currentSteps || 0;
        const delta = (next > prev && prev > 0) ? next - prev : 0;

        liveSteps.textContent = next.toLocaleString();
        liveTarget.textContent = (json.user.targetSteps || 5000).toLocaleString();
        inputTarget.value = json.user.targetSteps || 5000;
        inputDisplayName.value = json.user.name || currentUserId;
        const pct = Math.round((next / Math.max(1, json.user.targetSteps)) * 100);
        livePercent.textContent = `${pct}%`;
        if (metricProgressBar) metricProgressBar.style.width = `${Math.min(100, pct)}%`;
        applyPaceBadge(json.user.activityStatus);

        if (delta > 0) {
          spawnDashboardStepPop(delta);
        }

        const isRecent = json.user.lastStepTimestamp && (Date.now() - json.user.lastStepTimestamp < 35000);
        if (json.user.activityStatus !== 'IDLE' || isRecent) {
          setWsStatus(true, 'ACTIVE SYNC');
        } else if (ws && ws.readyState === WebSocket.OPEN) {
          setWsStatus(true, 'LIVE SYNC');
        } else {
          setWsStatus(true, 'LIVE SYNC');
        }

        if (json.user.bpm !== undefined && liveBpm) {
          liveBpm.textContent = json.user.bpm > 0 ? json.user.bpm : '--';
          if (liveBpmZone) {
            const bpm = json.user.bpm;
            liveBpmZone.textContent = bpm >= 170 ? 'Peak' : (bpm >= 140 ? 'Anaerobic' : (bpm >= 100 ? 'Aerobic' : (bpm > 0 ? 'Rest' : 'Idle')));
          }
        }
      }
    } catch (e) {
      console.error('[Fetch Stats Error]', e);
    }
  }

  async function saveSettings() {
    const name = inputDisplayName.value.trim() || currentUserId;
    const targetSteps = parseInt(inputTarget.value, 10) || 5000;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, targetSteps })
      });
      const data = await res.json();
      if (data.success) {
        liveTarget.textContent = targetSteps.toLocaleString();
        const cur = parseInt(liveSteps.textContent.replace(/,/g, ''), 10) || 0;
        const pct = Math.round((cur / Math.max(1, targetSteps)) * 100);
        livePercent.textContent = `${pct}%`;
        if (metricProgressBar) metricProgressBar.style.width = `${Math.min(100, pct)}%`;

        const originalText = btnSaveSettings.textContent;
        btnSaveSettings.textContent = 'Tersimpan!';
        setTimeout(() => btnSaveSettings.textContent = originalText, 1500);
      }
    } catch (e) {
      alert('Gagal menyimpan pengaturan: ' + e.message);
    }
  }

  // ponytail: lightweight particle and milestone animation helpers
  function spawnDashboardStepPop(delta) {
    if (delta <= 0 || !metricParticlesLayer) return;
    const pop = document.createElement('div');
    pop.className = 'step-float-pop';
    pop.textContent = `+${delta}`;
    
    // Position directly above the "steps" label to avoid covering label/titles
    const numWidth = liveSteps ? liveSteps.offsetWidth : 30;
    const labelX = Math.max(50, 18 + numWidth + 6);
    const randomOffset = Math.floor(Math.random() * 12) - 6;
    pop.style.left = `${labelX + randomOffset}px`;
    pop.style.top = '36px';
    metricParticlesLayer.appendChild(pop);
    setTimeout(() => pop.remove(), 1100);

    if (liveSteps) {
      liveSteps.classList.remove('step-bump');
      void liveSteps.offsetWidth;
      liveSteps.classList.add('step-bump');
    }
  }

  function triggerDashboardMilestone(milestone) {
    if (!metricMilestoneBanner || !metricCardSteps) return;
    const scheme = getMilestoneScheme(milestone);
    metricCardSteps.style.setProperty('--milestone-bg', scheme.bg);
    metricCardSteps.style.setProperty('--milestone-text', scheme.text);
    metricCardSteps.style.setProperty('--milestone-glow', scheme.glow);
    metricCardSteps.style.setProperty('--milestone-accent', scheme.accent);

    if (metricMilestoneVal) metricMilestoneVal.textContent = `${Number(milestone).toLocaleString()} STEPS!`;
    metricMilestoneBanner.classList.add('show');
    metricCardSteps.classList.add('milestone-active');

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}

    if (milestoneDashboardTimer) clearTimeout(milestoneDashboardTimer);
    milestoneDashboardTimer = setTimeout(() => {
      metricMilestoneBanner.classList.remove('show');
      metricCardSteps.classList.remove('milestone-active');
    }, 3200);
  }

  async function syncSimulation(delta) {
    if (delta > 0) {
      const prev = parseInt(liveSteps.textContent.replace(/,/g, ''), 10) || 0;
      const next = prev + delta;
      liveSteps.textContent = next.toLocaleString();
      const target = parseInt(liveTarget.textContent.replace(/,/g, ''), 10) || 5000;
      const pct = Math.round((next / Math.max(1, target)) * 100);
      livePercent.textContent = `${pct}%`;
      if (metricProgressBar) metricProgressBar.style.width = `${Math.min(100, pct)}%`;
      spawnDashboardStepPop(delta);
    }
    try {
      const res = await fetch('/api/steps/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, delta })
      });
      const data = await res.json();
      if (data && data.milestone) {
        triggerDashboardMilestone(data.milestone);
      }
    } catch (e) {
      console.error('[Sim Step Error]', e);
    }
  }

  async function syncHeartRate(bpm) {
    try {
      await fetch('/api/heartrate/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, bpm })
      });
    } catch (e) {
      console.error('[Sim HR Error]', e);
    }
  }

  async function resetSteps() {
    if (!confirm('Yakin ingin mereset langkah hari ini ke 0?')) return;
    try {
      await fetch(`/api/users/${encodeURIComponent(currentUserId)}/reset`, { method: 'POST' });
      liveSteps.textContent = '0';
      livePercent.textContent = '0%';
      if (metricProgressBar) metricProgressBar.style.width = '0%';
      applyPaceBadge('IDLE');
    } catch (e) {
      alert('Gagal reset langkah: ' + e.message);
    }
  }

  // Room Handlers
  chkPrivateRoom.addEventListener('change', (e) => {
    inputRoomPasscode.style.display = e.target.checked ? 'block' : 'none';
  });

  async function createRoom() {
    const roomId = inputRoomId.value.trim();
    const name = inputRoomName.value.trim() || roomId;
    const isPrivate = chkPrivateRoom.checked;
    const passcode = isPrivate ? inputRoomPasscode.value.trim() : '';

    if (!roomId) {
      alert('Masukkan ID Room terlebih dahulu');
      return;
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, name, isPrivate, passcode, creatorId: currentUserId })
      });
      const data = await res.json();
      if (data.success) {
        activeRoomId = roomId;
        localStorage.setItem('stepaway_roomid', activeRoomId);
        updateUrls();
        alert(`Room "${name}" berhasil dibuat. Link overlay otomatis diperbarui.`);
      } else {
        alert(data.error || 'Gagal membuat room.');
      }
    } catch (e) {
      alert('Terjadi kesalahan membuat room: ' + e.message);
    }
  }

  async function joinRoom() {
    const roomId = inputJoinRoomId.value.trim();
    const passcode = inputJoinPasscode.value.trim();

    if (!roomId) {
      alert('Masukkan ID Room yang dituju');
      return;
    }

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, passcode })
      });
      const data = await res.json();
      if (data.success) {
        activeRoomId = roomId;
        localStorage.setItem('stepaway_roomid', activeRoomId);
        updateUrls();
        alert(`Berhasil bergabung ke Room "${data.room.name}".`);
      } else {
        alert(data.error || 'Gagal bergabung room.');
      }
    } catch (e) {
      alert('Terjadi kesalahan join room: ' + e.message);
    }
  }

  function setWsStatus(online, customText = null) {
    const brandLogoIcon = document.getElementById('brandLogoIcon');
    const wsStatusBadge = document.getElementById('wsStatusBadge');
    const wsStatusText = document.getElementById('wsStatusText');

    if (brandLogoIcon) {
      if (online) {
        brandLogoIcon.className = 'brand-icon online';
        brandLogoIcon.setAttribute('title', customText ? `Koneksi: ${customText}` : 'Koneksi: Live Sync Terhubung');
      } else {
        brandLogoIcon.className = 'brand-icon offline';
        brandLogoIcon.setAttribute('title', 'Koneksi: Terputus (Mencoba menghubungkan kembali...)');
      }
    }

    if (wsStatusBadge && wsStatusText) {
      if (online) {
        wsStatusBadge.className = 'status-indicator online';
        wsStatusText.textContent = customText || 'LIVE SYNC';
      } else {
        wsStatusBadge.className = 'status-indicator offline';
        wsStatusText.textContent = customText || 'TERPUTUS';
      }
    }
  }

  function connectLiveWebSocket() {
    if (ws) {
      try { ws.close(); } catch (e) {}
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setWsStatus(true, 'LIVE SYNC');
      ws.send(JSON.stringify({ type: 'subscribe', userId: currentUserId, key: currentStreamKey }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init' && msg.data) {
          setWsStatus(true, msg.data.activityStatus !== 'IDLE' ? 'ACTIVE SYNC' : 'LIVE SYNC');
          liveSteps.textContent = (msg.data.currentSteps || 0).toLocaleString();
          liveTarget.textContent = (msg.data.targetSteps || 5000).toLocaleString();
          const pct = Math.round(((msg.data.currentSteps || 0) / Math.max(1, msg.data.targetSteps || 5000)) * 100);
          livePercent.textContent = `${pct}%`;
          if (metricProgressBar) metricProgressBar.style.width = `${Math.min(100, pct)}%`;
          applyPaceBadge(msg.data.activityStatus);

          if (msg.data.bpm !== undefined && liveBpm) {
            liveBpm.textContent = msg.data.bpm > 0 ? msg.data.bpm : '--';
            if (liveBpmZone) {
              const bpm = msg.data.bpm;
              liveBpmZone.textContent = bpm >= 170 ? 'Peak' : (bpm >= 140 ? 'Anaerobic' : (bpm >= 100 ? 'Aerobic' : (bpm > 0 ? 'Rest' : 'Idle')));
            }
          }
        } else if (msg.type === 'step_update') {
          const isTargetUser = msg.userId === currentUserId ||
            msg.userId === currentStreamKey ||
            (currentUserAccount && (msg.userId === currentUserAccount.id || msg.userId === currentUserAccount.streamKey));

          if (isTargetUser && msg.data) {
            setWsStatus(true, 'ACTIVE SYNC');
            const prev = parseInt(liveSteps.textContent.replace(/,/g, ''), 10) || 0;
            const next = msg.data.currentSteps || 0;
            const delta = msg.data.delta || (next > prev ? next - prev : 0);

            liveSteps.textContent = next.toLocaleString();
            liveTarget.textContent = (msg.data.targetSteps || 5000).toLocaleString();
            const pct = Math.round((msg.data.currentSteps / Math.max(1, msg.data.targetSteps)) * 100);
            livePercent.textContent = `${pct}%`;
            if (metricProgressBar) metricProgressBar.style.width = `${Math.min(100, pct)}%`;
            applyPaceBadge(msg.data.activityStatus);

            if (delta > 0) {
              spawnDashboardStepPop(delta);
            }
            if (msg.data.milestone) {
              triggerDashboardMilestone(msg.data.milestone);
            }

            if (msg.data.bpm !== undefined && liveBpm) {
              liveBpm.textContent = msg.data.bpm > 0 ? msg.data.bpm : '--';
              if (liveBpmZone) {
                const bpm = msg.data.bpm;
                liveBpmZone.textContent = bpm >= 170 ? 'Peak' : (bpm >= 140 ? 'Anaerobic' : (bpm >= 100 ? 'Aerobic' : (bpm > 0 ? 'Rest' : 'Idle')));
              }
            }
          }
        } else if (msg.type === 'donation_alert') {
          const isTargetUser = msg.userId === currentUserId ||
            msg.userId === currentStreamKey ||
            (currentUserAccount && (msg.userId === currentUserAccount.id || msg.userId === currentUserAccount.streamKey));

          if (isTargetUser && msg.data) {
            setWsStatus(true, 'ACTIVE SYNC');
            if (msg.data.targetSteps !== undefined) {
              liveTarget.textContent = msg.data.targetSteps.toLocaleString();
            }
            if (msg.data.currentSteps !== undefined) {
              liveSteps.textContent = msg.data.currentSteps.toLocaleString();
            }
            const pct = Math.round(((msg.data.currentSteps || 0) / Math.max(1, msg.data.targetSteps || 5000)) * 100);
            livePercent.textContent = `${pct}%`;
            if (metricProgressBar) metricProgressBar.style.width = `${Math.min(100, pct)}%`;
            fetchDonations();
          }
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      if (Date.now() - lastSuccessfulHttpSync < 15000) {
        setWsStatus(true, 'LIVE SYNC');
      } else {
        setWsStatus(false, 'RECONNECTING');
      }
      setTimeout(connectLiveWebSocket, 5000);
    };

    ws.onerror = () => {
      if (Date.now() - lastSuccessfulHttpSync < 15000) {
        setWsStatus(true, 'LIVE SYNC');
      } else {
        setWsStatus(false, 'OFFLINE');
      }
    };
  }

  // Periodic Keep-Alive Ping
  if (window._wsHeartbeat) clearInterval(window._wsHeartbeat);
  window._wsHeartbeat = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 25000);

  // Donation Modal & Batch Action Elements
  const donationBatchBar = document.getElementById('donationBatchBar');
  const selectedDonationsCount = document.getElementById('selectedDonationsCount');
  const btnBatchRetrigger = document.getElementById('btnBatchRetrigger');
  const btnBatchDelete = document.getElementById('btnBatchDelete');
  const chkSelectAllDonations = document.getElementById('chkSelectAllDonations');

  const donationDetailModal = document.getElementById('donationDetailModal');
  const modalDonatorName = document.getElementById('modalDonatorName');
  const modalDonationAmount = document.getElementById('modalDonationAmount');
  const modalStepsBadge = document.getElementById('modalStepsBadge');
  const modalTimestamp = document.getElementById('modalTimestamp');
  const modalMessage = document.getElementById('modalMessage');
  const modalDonationId = document.getElementById('modalDonationId');
  const btnCloseDonationModal = document.getElementById('btnCloseDonationModal');
  const btnModalClose = document.getElementById('btnModalClose');
  const btnModalRetrigger = document.getElementById('btnModalRetrigger');
  const btnModalDelete = document.getElementById('btnModalDelete');

  let currentDonationsList = [];
  let selectedDonationIds = new Set();
  let activeModalDonation = null;

  // TipTap Donation Integration Logic
  function renderDonations(donations = []) {
    currentDonationsList = Array.isArray(donations) ? donations : [];
    if (!donationHistoryTbody) return;

    // Prune selections that no longer exist
    const currentIdSet = new Set(currentDonationsList.map(d => String(d.id)));
    for (const id of selectedDonationIds) {
      if (!currentIdSet.has(id)) {
        selectedDonationIds.delete(id);
      }
    }
    updateBatchBar();

    if (currentDonationsList.length === 0) {
      donationHistoryTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 14px;">Belum ada donasi masuk</td>
        </tr>
      `;
      if (chkSelectAllDonations) {
        chkSelectAllDonations.checked = false;
        chkSelectAllDonations.disabled = true;
      }
      return;
    }

    if (chkSelectAllDonations) chkSelectAllDonations.disabled = false;

    donationHistoryTbody.innerHTML = currentDonationsList.map(d => {
      const modeBadge = d.mode === 'direct_step' 
        ? `<span class="badge-direct">+${Number(d.stepsAdded || 0).toLocaleString()} Steps</span>`
        : `<span class="badge-subathon">+${Number(d.stepsAdded || 0).toLocaleString()} Goal</span>`;

      const isChecked = selectedDonationIds.has(String(d.id)) ? 'checked' : '';

      return `
        <tr class="clickable-row" data-id="${escapeHtml(d.id)}">
          <td style="text-align: center;" onclick="event.stopPropagation();">
            <input type="checkbox" class="chk-donation-row" data-id="${escapeHtml(d.id)}" ${isChecked} style="cursor: pointer;">
          </td>
          <td><strong>${escapeHtml(d.donatorName || 'Anonim')}</strong></td>
          <td style="font-family: var(--font-mono); color: #fbbf24;">${d.formattedAmount || ('Rp ' + Number(d.amount || 0).toLocaleString('id-ID'))}</td>
          <td>${modeBadge}</td>
          <td style="color: var(--text-muted); max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(d.message || '')}">
            ${escapeHtml(d.message || '-')}
          </td>
          <td style="text-align: right;" onclick="event.stopPropagation();">
            <div class="row-actions">
              <button class="row-btn row-btn-retrigger" data-action="retrigger" data-id="${escapeHtml(d.id)}" title="Retrigger alert ke OBS">Show</button>
              <button class="row-btn row-btn-delete" data-action="delete" data-id="${escapeHtml(d.id)}" title="Hapus donasi">&times;</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row events
    donationHistoryTbody.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const donation = currentDonationsList.find(d => String(d.id) === String(id));
        if (donation) openDonationModal(donation);
      });
    });

    donationHistoryTbody.querySelectorAll('.chk-donation-row').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = String(e.target.dataset.id);
        if (e.target.checked) {
          selectedDonationIds.add(id);
        } else {
          selectedDonationIds.delete(id);
        }
        updateBatchBar();
      });
    });

    donationHistoryTbody.querySelectorAll('.row-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === 'retrigger') {
          retriggerSingleDonation(id);
        } else if (action === 'delete') {
          deleteSingleDonation(id);
        }
      });
    });
  }

  function updateBatchBar() {
    const count = selectedDonationIds.size;
    if (selectedDonationsCount) selectedDonationsCount.textContent = `${count} donasi terpilih`;

    if (donationBatchBar) {
      donationBatchBar.style.display = count > 0 ? 'flex' : 'none';
    }

    if (chkSelectAllDonations) {
      const total = currentDonationsList.length;
      chkSelectAllDonations.checked = total > 0 && count === total;
      chkSelectAllDonations.indeterminate = count > 0 && count < total;
    }
  }

  if (chkSelectAllDonations) {
    chkSelectAllDonations.addEventListener('change', (e) => {
      if (e.target.checked) {
        currentDonationsList.forEach(d => selectedDonationIds.add(String(d.id)));
      } else {
        selectedDonationIds.clear();
      }
      renderDonations(currentDonationsList);
    });
  }

  function openDonationModal(donation) {
    activeModalDonation = donation;
    if (!donationDetailModal) return;

    if (modalDonatorName) modalDonatorName.textContent = donation.donatorName || 'Anonim';
    if (modalDonationAmount) modalDonationAmount.textContent = donation.formattedAmount || `Rp ${Number(donation.amount || 0).toLocaleString('id-ID')}`;
    
    if (modalStepsBadge) {
      if (donation.mode === 'direct_step') {
        modalStepsBadge.textContent = `+${Number(donation.stepsAdded || 0).toLocaleString()} Steps (Community)`;
        modalStepsBadge.className = 'badge-direct';
      } else {
        modalStepsBadge.textContent = `+${Number(donation.stepsAdded || 0).toLocaleString()} Goal (Subathon)`;
        modalStepsBadge.className = 'badge-subathon';
      }
    }

    if (modalTimestamp) {
      try {
        const date = new Date(donation.timestamp);
        modalTimestamp.textContent = date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' });
      } catch (e) {
        modalTimestamp.textContent = donation.timestamp || '-';
      }
    }

    if (modalMessage) {
      modalMessage.textContent = donation.message && donation.message.trim() ? donation.message.trim() : '(Tanpa pesan donasi)';
    }

    if (modalDonationId) {
      modalDonationId.textContent = donation.id || '-';
    }

    donationDetailModal.style.display = 'flex';
  }

  function closeDonationModal() {
    if (donationDetailModal) donationDetailModal.style.display = 'none';
    activeModalDonation = null;
  }

  if (btnCloseDonationModal) btnCloseDonationModal.addEventListener('click', closeDonationModal);
  if (btnModalClose) btnModalClose.addEventListener('click', closeDonationModal);
  if (donationDetailModal) {
    donationDetailModal.addEventListener('click', (e) => {
      if (e.target === donationDetailModal) closeDonationModal();
    });
  }

  async function retriggerSingleDonation(donationId) {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/donations/${encodeURIComponent(donationId)}/retrigger`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        // Feedback
        const toast = document.createElement('div');
        toast.className = 'badge-subathon';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '99999';
        toast.style.padding = '8px 14px';
        toast.textContent = 'Alert donasi disiarkan ulang ke OBS!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
      } else {
        alert(data.message || 'Gagal retrigger alert');
      }
    } catch (e) {
      alert('Terjadi kesalahan: ' + e.message);
    }
  }

  async function deleteSingleDonation(donationId) {
    if (!confirm('Hapus riwayat donasi ini?')) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/donations/${encodeURIComponent(donationId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        selectedDonationIds.delete(String(donationId));
        renderDonations(data.donations);
        if (activeModalDonation && String(activeModalDonation.id) === String(donationId)) {
          closeDonationModal();
        }
      } else {
        alert(data.message || 'Gagal menghapus donasi');
      }
    } catch (e) {
      alert('Terjadi kesalahan: ' + e.message);
    }
  }

  if (btnModalRetrigger) {
    btnModalRetrigger.addEventListener('click', () => {
      if (activeModalDonation) {
        retriggerSingleDonation(activeModalDonation.id);
        closeDonationModal();
      }
    });
  }

  if (btnModalDelete) {
    btnModalDelete.addEventListener('click', () => {
      if (activeModalDonation) {
        deleteSingleDonation(activeModalDonation.id);
      }
    });
  }

  // Batch Handlers
  if (btnBatchRetrigger) {
    btnBatchRetrigger.addEventListener('click', async () => {
      const ids = Array.from(selectedDonationIds);
      if (ids.length === 0) return;

      try {
        const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/donations/batch-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'retrigger', donationIds: ids })
        });
        const data = await res.json();
        if (data.success) {
          alert(`${ids.length} alert donasi berhasil disiarkan ulang ke OBS.`);
        } else {
          alert(data.message || 'Gagal menyiarkan ulang batch donasi');
        }
      } catch (e) {
        alert('Terjadi kesalahan: ' + e.message);
      }
    });
  }

  if (btnBatchDelete) {
    btnBatchDelete.addEventListener('click', async () => {
      const ids = Array.from(selectedDonationIds);
      if (ids.length === 0) return;
      if (!confirm(`Yakin ingin menghapus ${ids.length} donasi yang dipilih?`)) return;

      try {
        const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/donations/batch-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', donationIds: ids })
        });
        const data = await res.json();
        if (data.success) {
          selectedDonationIds.clear();
          renderDonations(data.donations);
        } else {
          alert(data.message || 'Gagal menghapus batch donasi');
        }
      } catch (e) {
        alert('Terjadi kesalahan: ' + e.message);
      }
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function fetchDonations() {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/donations`);
      const data = await res.json();
      if (data.success) {
        if (data.settings) {
          if (chkDonationEnabled) chkDonationEnabled.checked = data.settings.enabled !== false;
          if (selectDonationMode) selectDonationMode.value = data.settings.mode || 'subathon_target';
          if (inputDonationRate) inputDonationRate.value = data.settings.conversionRate || 10;
          if (inputDonationMin) inputDonationMin.value = data.settings.minAmount || 1000;
          if (inputDonationSecret) inputDonationSecret.value = data.settings.secretToken || '';
          updateDonationBadge(data.settings.mode);
        }
        renderDonations(data.donations || []);
      }
    } catch (e) {
      console.error('[Fetch Donations Error]', e);
    }
  }

  function updateDonationBadge(mode) {
    if (!donationStatusBadge) return;
    if (mode === 'direct_step') {
      donationStatusBadge.textContent = 'Community Boost';
      donationStatusBadge.className = 'badge-direct';
    } else {
      donationStatusBadge.textContent = 'Subathon Mode';
      donationStatusBadge.className = 'badge-subathon';
    }
  }

  async function saveDonationSettings() {
    const enabled = chkDonationEnabled ? chkDonationEnabled.checked : true;
    const mode = selectDonationMode ? selectDonationMode.value : 'subathon_target';
    const conversionRate = parseInt(inputDonationRate.value, 10) || 10;
    const minAmount = parseInt(inputDonationMin.value, 10) || 1000;
    const secretToken = inputDonationSecret ? inputDonationSecret.value.trim() : '';

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/donation-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, mode, conversionRate, minAmount, secretToken })
      });
      const data = await res.json();
      if (data.success) {
        updateDonationBadge(mode);
        const originalText = btnSaveDonationSettings.textContent;
        btnSaveDonationSettings.textContent = 'Tersimpan!';
        setTimeout(() => btnSaveDonationSettings.textContent = originalText, 1500);
      } else {
        alert(data.message || 'Gagal menyimpan setting donasi');
      }
    } catch (e) {
      alert('Terjadi kesalahan: ' + e.message);
    }
  }

  async function triggerTestDonation(amount, donatorName, message) {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/test-donation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, donatorName, message })
      });
      const data = await res.json();
      if (data.success) {
        fetchUserStats();
        fetchDonations();
      } else {
        alert(data.message || 'Gagal mengirim simulasi donasi');
      }
    } catch (e) {
      alert('Gagal mengirim simulasi donasi: ' + e.message);
    }
  }

  // Preview tab switcher
  function switchPreviewTab(mode, activeBtn) {
    activePreviewMode = mode;
    document.querySelectorAll('.preview-tab').forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
    updatePreviewIframe();
  }

  if (tabPreviewStep) tabPreviewStep.addEventListener('click', () => switchPreviewTab('step', tabPreviewStep));
  if (tabPreviewHr) tabPreviewHr.addEventListener('click', () => switchPreviewTab('hr', tabPreviewHr));
  if (tabPreviewCombo) tabPreviewCombo.addEventListener('click', () => switchPreviewTab('combo', tabPreviewCombo));

  // Quick Preview Height Buttons
  previewSizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      previewSizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const h = btn.dataset.height;
      previewContainer.style.height = `${h}px`;
      if (previewHeightLabel) previewHeightLabel.textContent = `Tinggi: ${h}px`;
    });
  });

  // Track manual resize with ResizeObserver
  if (window.ResizeObserver && previewContainer) {
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const height = Math.round(entry.contentRect.height);
        if (previewHeightLabel && !document.fullscreenElement) {
          previewHeightLabel.textContent = `Tinggi: ${height}px`;
        }
      }
    });
    observer.observe(previewContainer);
  }

  // Fullscreen Preview
  if (btnFullscreenPreview && previewContainer) {
    btnFullscreenPreview.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        if (previewContainer.requestFullscreen) {
          previewContainer.requestFullscreen();
        } else if (previewContainer.webkitRequestFullscreen) {
          previewContainer.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  }

  // Event Listeners
  inputUserId.addEventListener('change', () => {
    currentUserId = inputUserId.value.trim() || 'streamer';
    localStorage.setItem('stepaway_userid', currentUserId);
    updateUrls();
    fetchUserStats();
    connectLiveWebSocket();
  });

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      inputTarget.value = btn.dataset.target;
      saveSettings();
    });
  });

  btnSaveSettings.addEventListener('click', saveSettings);
  btnReset.addEventListener('click', resetSteps);

  btnSim1.addEventListener('click', () => syncSimulation(1));
  btnSim10.addEventListener('click', () => syncSimulation(10));
  btnSim100.addEventListener('click', () => syncSimulation(100));
  btnSim1000.addEventListener('click', () => syncSimulation(1000));

  btnHrRest.addEventListener('click', () => syncHeartRate(75));
  btnHrAerobic.addEventListener('click', () => syncHeartRate(125));
  btnHrAnaerobic.addEventListener('click', () => syncHeartRate(155));
  btnHrPeak.addEventListener('click', () => syncHeartRate(180));

  btnCreateRoom.addEventListener('click', createRoom);
  btnJoinRoom.addEventListener('click', joinRoom);

  // Donation Event Listeners
  if (btnSaveDonationSettings) btnSaveDonationSettings.addEventListener('click', saveDonationSettings);
  if (selectDonationMode) selectDonationMode.addEventListener('change', (e) => updateDonationBadge(e.target.value));
  if (btnTestDonation10k) btnTestDonation10k.addEventListener('click', () => triggerTestDonation(10000, 'Budi TipTap', 'Semangat bang! +1.000 Target'));
  if (btnTestDonation50k) btnTestDonation50k.addEventListener('click', () => triggerTestDonation(50000, 'Sultan Santai', 'Gaspol maraton jalannya!'));
  if (btnTestDonation100k) btnTestDonation100k.addEventListener('click', () => triggerTestDonation(100000, 'Top Donatur', 'Bonus 10.000 steps subathon!'));
  if (btnRefreshDonations) btnRefreshDonations.addEventListener('click', fetchDonations);

  // Copy Buttons
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;
      const textToCopy = targetEl.textContent;
      navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = btn.textContent;
        btn.textContent = 'Tersalin!';
        setTimeout(() => btn.textContent = originalText, 1500);
      });
    });
  });

  document.getElementById('btnOpenTest').addEventListener('click', () => {
    window.open(urlTest.textContent, '_blank');
  });

  // SaaS Authentication & Account Management
  async function checkAuthSession() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'google_success') {
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('auth_error')) {
      alert('Google Login Gagal: ' + decodeURIComponent(urlParams.get('auth_error')));
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.success && data.authenticated && data.account) {
        currentUserAccount = data.account;
        currentUserId = data.account.id;
        currentStreamKey = data.account.streamKey || currentStreamKey;
        localStorage.setItem('stepaway_userid', currentUserId);
        localStorage.setItem('stepaway_streamkey', currentStreamKey);

        if (inputUserId) inputUserId.value = currentUserId;
        if (inputDisplayName && data.account.name) inputDisplayName.value = data.account.name;

        if (authGuestBox) authGuestBox.style.display = 'none';
        if (authUserBox) authUserBox.style.display = 'flex';
        if (headerUserName) headerUserName.textContent = data.account.name || data.account.email;
        if (headerPlanBadge) {
          headerPlanBadge.textContent = data.account.plan === 'creator_pro' ? 'PRO CREATOR' : 'CREATOR FREE';
        }
      } else {
        currentUserAccount = null;
        window.location.href = '/?require_auth=true';
        return;
      }
    } catch (err) {
      console.error('[Auth Me Error]', err);
    } finally {
      updateUrls();
      fetchUserStats();
      fetchDonations();
      connectLiveWebSocket();
    }
  }

  function openAuthModal(mode = 'login') {
    if (!authModal) return;
    authModal.style.display = 'flex';
    switchAuthTab(mode);
  }

  function closeAuthModal() {
    if (authModal) authModal.style.display = 'none';
  }

  function switchAuthTab(tab) {
    if (tab === 'login') {
      if (tabAuthLogin) tabAuthLogin.classList.add('active');
      if (tabAuthRegister) tabAuthRegister.classList.remove('active');
      if (formLogin) formLogin.style.display = 'flex';
      if (formRegister) formRegister.style.display = 'none';
      if (authModalTitle) authModalTitle.textContent = 'Masuk ke StepAway';
    } else {
      if (tabAuthRegister) tabAuthRegister.classList.add('active');
      if (tabAuthLogin) tabAuthLogin.classList.remove('active');
      if (formRegister) formRegister.style.display = 'flex';
      if (formLogin) formLogin.style.display = 'none';
      if (authModalTitle) authModalTitle.textContent = 'Daftar Akun Baru';
    }
  }

  if (btnOpenLoginModal) btnOpenLoginModal.addEventListener('click', () => openAuthModal('login'));
  if (btnCloseAuthModal) btnCloseAuthModal.addEventListener('click', closeAuthModal);
  if (tabAuthLogin) tabAuthLogin.addEventListener('click', () => switchAuthTab('login'));
  if (tabAuthRegister) tabAuthRegister.addEventListener('click', () => switchAuthTab('register'));

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = inputLoginEmail.value.trim();
      const password = inputLoginPassword.value;
      if (!email || !password) return alert('Email dan password wajib diisi');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
          closeAuthModal();
          inputLoginEmail.value = '';
          inputLoginPassword.value = '';
          await checkAuthSession();
        } else {
          alert(data.message || 'Login gagal');
        }
      } catch (err) {
        alert('Terjadi kesalahan login: ' + err.message);
      }
    });
  }

  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = inputRegName.value.trim();
      const email = inputRegEmail.value.trim();
      const password = inputRegPassword.value;
      if (!email || !password) return alert('Email dan password wajib diisi');
      if (password.length < 6) return alert('Password minimal 6 karakter');

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (data.success) {
          closeAuthModal();
          inputRegName.value = '';
          inputRegEmail.value = '';
          inputRegPassword.value = '';
          await checkAuthSession();
        } else {
          alert(data.message || 'Pendaftaran gagal');
        }
      } catch (err) {
        alert('Terjadi kesalahan registrasi: ' + err.message);
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (!confirm('Yakin ingin keluar dari akun?')) return;
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUserAccount = null;
        currentUserId = 'streamer';
        currentStreamKey = 'sk_live_demo_streamer';
        localStorage.removeItem('stepaway_userid');
        localStorage.removeItem('stepaway_streamkey');
        await checkAuthSession();
      } catch (err) {
        console.error('[Logout Error]', err);
      }
    });
  }

  if (btnRegenStreamKey) {
    btnRegenStreamKey.addEventListener('click', async () => {
      if (!confirm('Peringatan: Membuat Stream Key baru akan memutuskan overlay OBS yang sedang aktif sampai Anda memperbarui URL OBS. Lanjutkan?')) return;
      try {
        const res = await fetch('/api/auth/regenerate-stream-key', { method: 'POST' });
        const data = await res.json();
        if (data.success && data.streamKey) {
          currentStreamKey = data.streamKey;
          localStorage.setItem('stepaway_streamkey', currentStreamKey);
          updateUrls();
          alert('Stream Key baru berhasil dibuat. Silakan perbarui link OBS Browser Source Anda.');
        } else {
          alert(data.message || 'Gagal membuat Stream Key baru');
        }
      } catch (err) {
        alert('Terjadi kesalahan: ' + err.message);
      }
    });
  }

  // QR Pairing Modal Handlers
  function openQrModal() {
    if (qrPairingModal) {
      updateUrls();
      qrPairingModal.style.display = 'flex';
    }
  }

  function closeQrModal() {
    if (qrPairingModal) qrPairingModal.style.display = 'none';
  }

  if (btnOpenQrModal) btnOpenQrModal.addEventListener('click', openQrModal);
  if (btnOpenQrModalTab) btnOpenQrModalTab.addEventListener('click', openQrModal);
  if (btnCloseQrModal) btnCloseQrModal.addEventListener('click', closeQrModal);
  if (btnCloseQrFooter) btnCloseQrFooter.addEventListener('click', closeQrModal);
  if (qrPairingModal) {
    qrPairingModal.addEventListener('click', (e) => {
      if (e.target === qrPairingModal) closeQrModal();
    });
  }

  // Init
  checkAuthSession();

  // ponytail: periodic sync fallback (every 4s) to ensure resilience
  setInterval(fetchUserStats, 4000);
});

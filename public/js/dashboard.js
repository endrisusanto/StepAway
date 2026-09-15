document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const liveSteps = document.getElementById('liveSteps');
  const liveTarget = document.getElementById('liveTarget');
  const livePercent = document.getElementById('livePercent');
  const livePaceBadge = document.getElementById('livePaceBadge');
  const liveBpm = document.getElementById('liveBpm');
  const liveBpmZone = document.getElementById('liveBpmZone');
  const metricProgressBar = document.getElementById('metricProgressBar');
  const wsStatusDot = document.getElementById('wsStatusDot');
  const wsStatusText = document.getElementById('wsStatusText');
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

  let currentUserId = localStorage.getItem('stepaway_userid') || 'streamer';
  inputUserId.value = currentUserId;

  let activeRoomId = localStorage.getItem('stepaway_roomid') || 'global';
  let activePreviewMode = 'step';

  let ws = null;

  function updateUrls() {
    const origin = window.location.origin;
    const single = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}`;
    const heartrate = `${origin}/overlay/heartrate?user=${encodeURIComponent(currentUserId)}`;
    const combo = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}&show_hr=true`;
    const room = `${origin}/overlay/multi?room=${encodeURIComponent(activeRoomId)}`;
    const test = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}&test=true`;
    const webhook = `${origin}/api/webhooks/tiptap?userId=${encodeURIComponent(currentUserId)}`;

    urlSingle.textContent = single;
    urlHeartrate.textContent = heartrate;
    urlCombo.textContent = combo;
    urlRoom.textContent = room;
    urlTest.textContent = test;
    if (urlWebhookTipTap) urlWebhookTipTap.textContent = webhook;
    guideUserId.textContent = currentUserId;

    updatePreviewIframe();
  }

  function updatePreviewIframe() {
    if (!previewIframe) return;
    if (activePreviewMode === 'hr') {
      previewIframe.src = `/overlay/heartrate?user=${encodeURIComponent(currentUserId)}`;
    } else if (activePreviewMode === 'combo') {
      previewIframe.src = `/overlay?user=${encodeURIComponent(currentUserId)}&show_hr=true`;
    } else {
      previewIframe.src = `/overlay?user=${encodeURIComponent(currentUserId)}`;
    }
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
      livePaceBadge.textContent = 'IDLE';
    }
  }

  async function fetchUserStats() {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}`);
      const json = await res.json();
      if (json.success && json.user) {
        liveSteps.textContent = (json.user.currentSteps || 0).toLocaleString();
        liveTarget.textContent = (json.user.targetSteps || 5000).toLocaleString();
        inputTarget.value = json.user.targetSteps || 5000;
        inputDisplayName.value = json.user.name || currentUserId;
        const pct = Math.min(100, Math.round((json.user.currentSteps / Math.max(1, json.user.targetSteps)) * 100));
        livePercent.textContent = `${pct}%`;
        if (metricProgressBar) metricProgressBar.style.width = `${pct}%`;
        applyPaceBadge(json.user.activityStatus);

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
        const pct = Math.min(100, Math.round((cur / Math.max(1, targetSteps)) * 100));
        livePercent.textContent = `${pct}%`;
        if (metricProgressBar) metricProgressBar.style.width = `${pct}%`;

        const originalText = btnSaveSettings.textContent;
        btnSaveSettings.textContent = 'Tersimpan!';
        setTimeout(() => btnSaveSettings.textContent = originalText, 1500);
      }
    } catch (e) {
      alert('Gagal menyimpan pengaturan: ' + e.message);
    }
  }

  async function syncSimulation(delta) {
    try {
      await fetch('/api/steps/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, delta })
      });
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

  function setWsStatus(online) {
    if (wsStatusDot) {
      if (online) {
        wsStatusDot.classList.add('online');
        if (wsStatusText) wsStatusText.textContent = 'Live Sync';
      } else {
        wsStatusDot.classList.remove('online');
        if (wsStatusText) wsStatusText.textContent = 'Terputus';
      }
    }
  }

  function connectLiveWebSocket() {
    if (ws) ws.close();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      setWsStatus(true);
      ws.send(JSON.stringify({ type: 'subscribe', userId: currentUserId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'step_update' && msg.userId === currentUserId) {
          if (msg.data) {
            liveSteps.textContent = (msg.data.currentSteps || 0).toLocaleString();
            liveTarget.textContent = (msg.data.targetSteps || 5000).toLocaleString();
            const pct = Math.min(100, Math.round((msg.data.currentSteps / Math.max(1, msg.data.targetSteps)) * 100));
            livePercent.textContent = `${pct}%`;
            if (metricProgressBar) metricProgressBar.style.width = `${pct}%`;
            applyPaceBadge(msg.data.activityStatus);

            if (msg.data.bpm !== undefined && liveBpm) {
              liveBpm.textContent = msg.data.bpm > 0 ? msg.data.bpm : '--';
              if (liveBpmZone) {
                const bpm = msg.data.bpm;
                liveBpmZone.textContent = bpm >= 170 ? 'Peak' : (bpm >= 140 ? 'Anaerobic' : (bpm >= 100 ? 'Aerobic' : (bpm > 0 ? 'Rest' : 'Idle')));
              }
            }
          }
        } else if (msg.type === 'donation_alert' && msg.userId === currentUserId) {
          if (msg.data) {
            if (msg.data.targetSteps !== undefined) {
              liveTarget.textContent = msg.data.targetSteps.toLocaleString();
            }
            if (msg.data.currentSteps !== undefined) {
              liveSteps.textContent = msg.data.currentSteps.toLocaleString();
            }
            const pct = Math.min(100, Math.round(((msg.data.currentSteps || 0) / Math.max(1, msg.data.targetSteps || 5000)) * 100));
            livePercent.textContent = `${pct}%`;
            if (metricProgressBar) metricProgressBar.style.width = `${pct}%`;
            fetchDonations();
          }
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setWsStatus(false);
      setTimeout(connectLiveWebSocket, 3000);
    };
  }

  // TipTap Donation Integration Logic
  function renderDonations(donations = []) {
    if (!donationHistoryTbody) return;
    if (!donations || donations.length === 0) {
      donationHistoryTbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 14px;">Belum ada donasi masuk</td>
        </tr>
      `;
      return;
    }

    donationHistoryTbody.innerHTML = donations.map(d => {
      const modeBadge = d.mode === 'direct_step' 
        ? `<span class="badge-direct">+${Number(d.stepsAdded || 0).toLocaleString()} Steps</span>`
        : `<span class="badge-subathon">+${Number(d.stepsAdded || 0).toLocaleString()} Goal</span>`;

      return `
        <tr>
          <td><strong>${escapeHtml(d.donatorName || 'Anonim')}</strong></td>
          <td style="font-family: var(--font-mono); color: #fbbf24;">${d.formattedAmount || ('Rp ' + Number(d.amount || 0).toLocaleString('id-ID'))}</td>
          <td>${modeBadge}</td>
          <td style="color: var(--text-muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(d.message || '')}">
            ${escapeHtml(d.message || '-')}
          </td>
        </tr>
      `;
    }).join('');
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

  // Init
  updateUrls();
  fetchUserStats();
  fetchDonations();
  connectLiveWebSocket();
});

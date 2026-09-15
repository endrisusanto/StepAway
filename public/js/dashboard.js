// StepAway Dashboard Script
(() => {
  const inputUserId = document.getElementById('inputUserId');
  const inputDisplayName = document.getElementById('inputDisplayName');
  const inputTarget = document.getElementById('inputTarget');
  const liveSteps = document.getElementById('liveSteps');
  const liveTarget = document.getElementById('liveTarget');
  const livePercent = document.getElementById('livePercent');
  const livePaceBadge = document.getElementById('livePaceBadge');
  const metricProgressBar = document.getElementById('metricProgressBar');
  const wsStatusDot = document.getElementById('wsStatusDot');
  const wsStatusText = document.getElementById('wsStatusText');
  const guideUserId = document.getElementById('guideUserId');

  const urlSingle = document.getElementById('urlSingle');
  const urlHeartrate = document.getElementById('urlHeartrate');
  const urlCombo = document.getElementById('urlCombo');
  const urlRoom = document.getElementById('urlRoom');
  const urlTest = document.getElementById('urlTest');

  const liveBpm = document.getElementById('liveBpm');
  const liveBpmZone = document.getElementById('liveBpmZone');

  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnSim1 = document.getElementById('btnSim1');
  const btnSim10 = document.getElementById('btnSim10');
  const btnSim100 = document.getElementById('btnSim100');
  const btnSim1000 = document.getElementById('btnSim1000');
  const btnReset = document.getElementById('btnReset');
  const btnOpenTest = document.getElementById('btnOpenTest');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const copyBtns = document.querySelectorAll('.copy-btn');

  const btnHrRest = document.getElementById('btnHrRest');
  const btnHrAerobic = document.getElementById('btnHrAerobic');
  const btnHrAnaerobic = document.getElementById('btnHrAnaerobic');
  const btnHrPeak = document.getElementById('btnHrPeak');

  // Preview Switcher
  const previewIframe = document.getElementById('previewIframe');
  const tabPreviewStep = document.getElementById('tabPreviewStep');
  const tabPreviewHr = document.getElementById('tabPreviewHr');
  const tabPreviewCombo = document.getElementById('tabPreviewCombo');

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

  chkPrivateRoom.addEventListener('change', () => {
    inputRoomPasscode.style.display = chkPrivateRoom.checked ? 'block' : 'none';
  });

  function updateUrls() {
    const origin = window.location.origin;
    const single = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}`;
    const hr = `${origin}/overlay/heartrate?user=${encodeURIComponent(currentUserId)}`;
    const combo = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}&show_hr=true`;
    const room = `${origin}/overlay/multi?room=${encodeURIComponent(activeRoomId)}`;
    const test = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}&test=true`;

    urlSingle.textContent = single;
    if (urlHeartrate) urlHeartrate.textContent = hr;
    if (urlCombo) urlCombo.textContent = combo;
    urlRoom.textContent = room;
    urlTest.textContent = test;
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
    const s = (status || 'IDLE').toUpperCase();
    livePaceBadge.className = 'activity-badge';
    if (s === 'RUNNING') {
      livePaceBadge.textContent = 'RUNNING';
      livePaceBadge.classList.add('activity-running');
    } else if (s === 'WALKING') {
      livePaceBadge.textContent = 'WALKING';
      livePaceBadge.classList.add('activity-walking');
    } else {
      livePaceBadge.textContent = 'IDLE';
      livePaceBadge.classList.add('activity-idle');
    }
  }

  async function fetchUserStats() {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}`);
      const json = await res.json();
      if (json.success && json.user) {
        liveSteps.textContent = json.user.currentSteps.toLocaleString();
        liveTarget.textContent = json.user.targetSteps.toLocaleString();
        inputTarget.value = json.user.targetSteps;
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

  async function saveSettingsToDB() {
    const name = inputDisplayName.value.trim() || currentUserId;
    const target = Number(inputTarget.value) || 5000;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, targetSteps: target })
      });
      const json = await res.json();
      if (json.success) {
        localStorage.setItem('stepaway_userid', currentUserId);
        alert('Pengaturan berhasil disimpan di database server.');
        fetchUserStats();
      }
    } catch (e) {
      alert('Gagal menyimpan ke server: ' + e.message);
    }
  }

  async function createRoom() {
    const roomId = inputRoomId.value.trim();
    const name = inputRoomName.value.trim() || roomId;
    const isPrivate = chkPrivateRoom.checked;
    const passcode = inputRoomPasscode.value.trim();

    if (!roomId) {
      alert('Isi ID Room terlebih dahulu');
      return;
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          name,
          isPrivate,
          passcode,
          creatorId: currentUserId
        })
      });
      const json = await res.json();
      if (json.success) {
        activeRoomId = json.room.roomId;
        localStorage.setItem('stepaway_roomid', activeRoomId);
        updateUrls();
        alert(`Room '${json.room.name}' berhasil dibuat.`);
      }
    } catch (e) {
      alert('Gagal membuat room: ' + e.message);
    }
  }

  async function joinRoom() {
    const roomId = inputJoinRoomId.value.trim();
    const passcode = inputJoinPasscode.value.trim();
    if (!roomId) {
      alert('Isi ID Room yang ingin digabung');
      return;
    }

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, passcode })
      });
      const json = await res.json();
      if (json.success) {
        activeRoomId = roomId;
        localStorage.setItem('stepaway_roomid', activeRoomId);
        updateUrls();
        alert(`Berhasil bergabung ke Room '${roomId}'.`);
      } else {
        alert('Gagal join: ' + json.message);
      }
    } catch (e) {
      alert('Gagal join room: ' + e.message);
    }
  }

  async function sendSimulatedSteps(delta) {
    try {
      const res = await fetch('/api/steps/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          delta: delta
        })
      });
      const json = await res.json();
      if (json.success) {
        fetchUserStats();
      }
    } catch (e) {
      alert('Gagal mengirim simulasi: ' + e.message);
    }
  }

  async function resetSteps() {
    if (!confirm(`Yakin ingin mereset langkah untuk ${currentUserId} menjadi 0?`)) return;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (json.success) {
        fetchUserStats();
      }
    } catch (e) {
      alert('Gagal mereset: ' + e.message);
    }
  }

  async function sendSimulatedBpm(bpm) {
    try {
      const res = await fetch('/api/heartrate/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          bpm: Number(bpm)
        })
      });
      const json = await res.json();
      if (json.success) {
        if (liveBpm) liveBpm.textContent = bpm;
        if (liveBpmZone) {
          liveBpmZone.textContent = bpm >= 170 ? 'Peak' : (bpm >= 140 ? 'Anaerobic' : (bpm >= 100 ? 'Aerobic' : 'Rest'));
        }
      }
    } catch (e) {
      alert('Gagal mengirim simulasi BPM: ' + e.message);
    }
  }

  function setWsStatus(online) {
    if (wsStatusDot) {
      if (online) {
        wsStatusDot.classList.add('online');
        if (wsStatusText) wsStatusText.textContent = 'Live Sync';
      } else {
        wsStatusDot.classList.remove('online');
        if (wsStatusText) wsStatusText.textContent = 'Disconnected';
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
        if ((msg.type === 'step_update' || msg.type === 'init') && msg.data) {
          if (msg.data.userId === currentUserId) {
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
        } else if (msg.type === 'heartrate_update' && msg.data && msg.data.userId === currentUserId) {
          if (liveBpm) liveBpm.textContent = msg.data.bpm;
          if (liveBpmZone) {
            const bpm = msg.data.bpm;
            liveBpmZone.textContent = bpm >= 170 ? 'Peak' : (bpm >= 140 ? 'Anaerobic' : (bpm >= 100 ? 'Aerobic' : (bpm > 0 ? 'Rest' : 'Idle')));
          }
        }
      } catch (err) {}
    };

    ws.onclose = () => {
      setWsStatus(false);
      setTimeout(connectLiveWebSocket, 3000);
    };
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

  // Event Listeners
  inputUserId.addEventListener('change', () => {
    currentUserId = inputUserId.value.trim() || 'streamer';
    localStorage.setItem('stepaway_userid', currentUserId);
    updateUrls();
    fetchUserStats();
    connectLiveWebSocket();
  });

  btnSaveSettings.addEventListener('click', saveSettingsToDB);
  btnCreateRoom.addEventListener('click', createRoom);
  btnJoinRoom.addEventListener('click', joinRoom);

  btnSim1.addEventListener('click', () => sendSimulatedSteps(1));
  btnSim10.addEventListener('click', () => sendSimulatedSteps(10));
  btnSim100.addEventListener('click', () => sendSimulatedSteps(100));
  btnSim1000.addEventListener('click', () => sendSimulatedSteps(1000));
  btnReset.addEventListener('click', resetSteps);

  if (btnHrRest) btnHrRest.addEventListener('click', () => sendSimulatedBpm(75));
  if (btnHrAerobic) btnHrAerobic.addEventListener('click', () => sendSimulatedBpm(125));
  if (btnHrAnaerobic) btnHrAnaerobic.addEventListener('click', () => sendSimulatedBpm(155));
  if (btnHrPeak) btnHrPeak.addEventListener('click', () => sendSimulatedBpm(180));

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-target');
      inputTarget.value = val;
    });
  });

  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const textToCopy = document.getElementById(targetId).textContent;
      navigator.clipboard.writeText(textToCopy).then(() => {
        const originalText = btn.textContent;
        btn.textContent = 'Tersalin!';
        setTimeout(() => btn.textContent = originalText, 1500);
      });
    });
  });

  btnOpenTest.addEventListener('click', () => {
    window.open(urlTest.textContent, '_blank');
  });

  // Init
  updateUrls();
  fetchUserStats();
  connectLiveWebSocket();
})();

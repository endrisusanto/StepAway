// StepAway Dashboard Script
(() => {
  const inputUserId = document.getElementById('inputUserId');
  const inputDisplayName = document.getElementById('inputDisplayName');
  const inputTarget = document.getElementById('inputTarget');
  const liveSteps = document.getElementById('liveSteps');
  const liveTarget = document.getElementById('liveTarget');
  const livePercent = document.getElementById('livePercent');
  const livePaceBadge = document.getElementById('livePaceBadge');
  const guideUserId = document.getElementById('guideUserId');
  const urlSingle = document.getElementById('urlSingle');
  const urlRoom = document.getElementById('urlRoom');
  const urlTest = document.getElementById('urlTest');

  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnSim1 = document.getElementById('btnSim1');
  const btnSim10 = document.getElementById('btnSim10');
  const btnSim100 = document.getElementById('btnSim100');
  const btnSim1000 = document.getElementById('btnSim1000');
  const btnReset = document.getElementById('btnReset');
  const btnOpenTest = document.getElementById('btnOpenTest');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const copyBtns = document.querySelectorAll('.copy-btn');

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

  let ws = null;

  chkPrivateRoom.addEventListener('change', () => {
    inputRoomPasscode.style.display = chkPrivateRoom.checked ? 'block' : 'none';
  });

  function updateUrls() {
    const origin = window.location.origin;
    const single = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}`;
    const room = `${origin}/overlay/multi?room=${encodeURIComponent(activeRoomId)}`;
    const test = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}&test=true`;

    urlSingle.textContent = single;
    urlRoom.textContent = room;
    urlTest.textContent = test;
    guideUserId.textContent = currentUserId;
  }

  function applyPaceBadge(status) {
    const s = (status || 'IDLE').toUpperCase();
    livePaceBadge.className = 'activity-badge';
    if (s === 'RUNNING') {
      livePaceBadge.textContent = '🏃 RUNNING';
      livePaceBadge.classList.add('activity-running');
    } else if (s === 'WALKING') {
      livePaceBadge.textContent = '🚶 WALKING';
      livePaceBadge.classList.add('activity-walking');
    } else {
      livePaceBadge.textContent = '🧘 IDLE';
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
        applyPaceBadge(json.user.activityStatus);
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
        alert('✅ Pengaturan berhasil disimpan di database server!');
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
        alert(`✅ Room '${json.room.name}' berhasil dibuat! Link OBS Room telah diperbarui.`);
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
        alert(`✅ Berhasil bergabung ke Room '${roomId}'!`);
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

  function connectLiveWebSocket() {
    if (ws) ws.close();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
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
            applyPaceBadge(msg.data.activityStatus);
          }
        }
      } catch (err) {}
    };

    ws.onclose = () => {
      setTimeout(connectLiveWebSocket, 3000);
    };
  }

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
        btn.textContent = 'Copied!';
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

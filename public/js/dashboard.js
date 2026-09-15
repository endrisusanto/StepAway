// StepAway Dashboard Script
(() => {
  const inputUserId = document.getElementById('inputUserId');
  const inputTarget = document.getElementById('inputTarget');
  const liveSteps = document.getElementById('liveSteps');
  const liveTarget = document.getElementById('liveTarget');
  const livePercent = document.getElementById('livePercent');
  const guideUserId = document.getElementById('guideUserId');
  const urlSingle = document.getElementById('urlSingle');
  const urlMulti = document.getElementById('urlMulti');
  const urlTest = document.getElementById('urlTest');

  const btnSim1 = document.getElementById('btnSim1');
  const btnSim10 = document.getElementById('btnSim10');
  const btnSim100 = document.getElementById('btnSim100');
  const btnSim1000 = document.getElementById('btnSim1000');
  const btnReset = document.getElementById('btnReset');
  const btnSaveTarget = document.getElementById('btnSaveTarget');
  const btnOpenTest = document.getElementById('btnOpenTest');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const copyBtns = document.querySelectorAll('.copy-btn');

  let currentUserId = inputUserId.value.trim() || 'streamer';
  let ws = null;

  function updateUrls() {
    const origin = window.location.origin;
    const single = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}`;
    const multi = `${origin}/overlay/multi?users=${encodeURIComponent(currentUserId)},guest`;
    const test = `${origin}/overlay?user=${encodeURIComponent(currentUserId)}&test=true`;

    urlSingle.textContent = single;
    urlMulti.textContent = multi;
    urlTest.textContent = test;
    guideUserId.textContent = currentUserId;
  }

  async function fetchUserStats() {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}`);
      const json = await res.json();
      if (json.success && json.user) {
        liveSteps.textContent = json.user.currentSteps.toLocaleString();
        liveTarget.textContent = json.user.targetSteps.toLocaleString();
        inputTarget.value = json.user.targetSteps;
        const pct = Math.min(100, Math.round((json.user.currentSteps / Math.max(1, json.user.targetSteps)) * 100));
        livePercent.textContent = `${pct}%`;
      }
    } catch (e) {
      console.error('[Fetch Stats Error]', e);
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
      alert('Gagal mengirim simulasi langkah: ' + e.message);
    }
  }

  async function saveTarget(val) {
    const target = Number(val);
    if (!target || target < 100) {
      alert('Target minimal 100 langkah');
      return;
    }

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(currentUserId)}/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSteps: target })
      });
      const json = await res.json();
      if (json.success) {
        fetchUserStats();
      }
    } catch (e) {
      alert('Gagal menyimpan target: ' + e.message);
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
      alert('Gagal mereset langkah: ' + e.message);
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
    updateUrls();
    fetchUserStats();
    connectLiveWebSocket();
  });

  btnSim1.addEventListener('click', () => sendSimulatedSteps(1));
  btnSim10.addEventListener('click', () => sendSimulatedSteps(10));
  btnSim100.addEventListener('click', () => sendSimulatedSteps(100));
  btnSim1000.addEventListener('click', () => sendSimulatedSteps(1000));
  btnReset.addEventListener('click', resetSteps);
  btnSaveTarget.addEventListener('click', () => saveTarget(inputTarget.value));

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-target');
      inputTarget.value = val;
      saveTarget(val);
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

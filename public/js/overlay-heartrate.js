// StepAway Standalone Live Heart Rate Overlay Logic
(() => {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('user') || 'streamer';
  const isTest = params.get('test') === 'true';

  const widgetEl = document.getElementById('hrWidget');
  const bpmValEl = document.getElementById('bpmVal');
  const bpmZoneLabelEl = document.getElementById('bpmZoneLabel');

  let ws = null;

  // Make widget draggable on canvas / OBS preview
  if (typeof makeDraggable === 'function' && widgetEl) {
    makeDraggable(widgetEl);
  }

  const ZONES = {
    REST: { label: 'Rest', class: 'zone-rest' },
    AEROBIC: { label: 'Aerobic', class: 'zone-aerobic' },
    ANAEROBIC: { label: 'Anaerobic', class: 'zone-anaerobic' },
    PEAK: { label: 'Peak', class: 'zone-peak' }
  };

  function getZone(bpm) {
    if (bpm < 100) return 'REST';
    if (bpm < 140) return 'AEROBIC';
    if (bpm < 170) return 'ANAEROBIC';
    return 'PEAK';
  }

  function updateHeartRate(bpm, customZone) {
    if (!bpm || bpm <= 0) {
      bpmValEl.textContent = '-';
      bpmZoneLabelEl.textContent = 'Disconnected';
      widgetEl.className = 'hr-widget';
      document.documentElement.style.setProperty('--beat-duration', '0s');
      return;
    }

    bpmValEl.textContent = bpm;
    const zoneKey = (customZone && ZONES[customZone.toUpperCase()]) ? customZone.toUpperCase() : getZone(bpm);
    const zoneInfo = ZONES[zoneKey] || ZONES.REST;

    bpmZoneLabelEl.textContent = zoneInfo.label;
    widgetEl.className = `hr-widget ${zoneInfo.class}`;

    // Set dynamic beat duration in seconds: 60 / BPM
    const beatDurationSec = Math.max(0.28, Math.min(1.5, 60 / bpm)).toFixed(2);
    document.documentElement.style.setProperty('--beat-duration', `${beatDurationSec}s`);
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', userId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init' && msg.data) {
          updateHeartRate(msg.data.bpm || 0, msg.data.bpmZone);
        } else if (msg.type === 'step_update' && msg.userId === userId) {
          if (msg.data.bpm !== undefined) {
            updateHeartRate(msg.data.bpm, msg.data.bpmZone);
          }
        }
      } catch (err) {
        console.error('[WS Parse Error]', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000);
    };
  }

  // Initial Fetch & Connect
  fetch(`/api/users/${encodeURIComponent(userId)}`)
    .then(res => res.json())
    .then(json => {
      if (json.success && json.user) {
        updateHeartRate(json.user.bpm || 0, json.user.bpmZone);
      }
    })
    .catch(() => {})
    .finally(() => {
      connectWebSocket();
    });

  // Simulated test loop for Demo
  if (isTest) {
    let mockBpm = 78;
    setInterval(() => {
      mockBpm = Math.floor(Math.random() * 80) + 90;
      updateHeartRate(mockBpm);
    }, 2000);
  }
})();

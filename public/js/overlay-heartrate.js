// StepAway Standalone Heart Rate Overlay Logic
(() => {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('user') || 'streamer';
  const isTest = params.get('test') === 'true';

  const hrWidgetEl = document.getElementById('hrWidget');
  const bpmValEl = document.getElementById('bpmVal');
  const bpmZoneLabelEl = document.getElementById('bpmZoneLabel');

  const HR_ZONES = {
    REST: { label: 'Rest / Warmup', color: '#00d2d3', glow: 'rgba(0, 210, 211, 0.45)' },
    AEROBIC: { label: 'Aerobic / Cardio', color: '#feca57', glow: 'rgba(254, 202, 87, 0.45)' },
    ANAEROBIC: { label: 'Anaerobic / Hardcore', color: '#ff9f43', glow: 'rgba(255, 159, 67, 0.45)' },
    PEAK: { label: 'Peak / Maximum Effort', color: '#ff5252', glow: 'rgba(255, 82, 82, 0.6)' }
  };

  function getZone(bpm) {
    if (bpm < 100) return 'REST';
    if (bpm < 140) return 'AEROBIC';
    if (bpm < 170) return 'ANAEROBIC';
    return 'PEAK';
  }

  function updateHeartRate(bpm, customZone) {
    if (!bpm || bpm <= 0) {
      bpmValEl.textContent = '--';
      bpmZoneLabelEl.textContent = 'Disconnected';
      hrWidgetEl.style.setProperty('--beat-duration', '1.2s');
      hrWidgetEl.style.setProperty('--hr-color', '#94a3b8');
      hrWidgetEl.style.setProperty('--hr-glow', 'rgba(148, 163, 184, 0.2)');
      return;
    }

    bpmValEl.textContent = bpm;
    const zoneKey = customZone || getZone(bpm);
    const zoneInfo = HR_ZONES[zoneKey] || HR_ZONES.REST;

    bpmZoneLabelEl.textContent = zoneInfo.label;
    
    // Set dynamic beat duration in seconds: 60 / BPM
    const beatDurationSec = Math.max(0.28, Math.min(1.5, 60 / bpm)).toFixed(2);
    hrWidgetEl.style.setProperty('--beat-duration', `${beatDurationSec}s`);
    hrWidgetEl.style.setProperty('--hr-color', zoneInfo.color);
    hrWidgetEl.style.setProperty('--hr-glow', zoneInfo.glow);
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      bpmZoneLabelEl.textContent = 'Ready';
      ws.send(JSON.stringify({ type: 'subscribe', userId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init' && msg.data) {
          if (msg.data.bpm) updateHeartRate(msg.data.bpm, msg.data.bpmZone);
        } else if (msg.type === 'heartrate_update' && msg.data && msg.data.userId === userId) {
          updateHeartRate(msg.data.bpm, msg.data.bpmZone);
        } else if (msg.type === 'step_update' && msg.data && msg.data.userId === userId) {
          if (msg.data.bpm !== undefined) {
            updateHeartRate(msg.data.bpm, msg.data.bpmZone);
          }
        }
      } catch (err) {
        console.error('[WS HR Error]', err);
      }
    };

    ws.onclose = () => {
      bpmZoneLabelEl.textContent = 'Reconnecting...';
      setTimeout(connectWebSocket, 2500);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  if (isTest) {
    let mockBpm = 78;
    updateHeartRate(mockBpm);
    setInterval(() => {
      mockBpm = Math.floor(75 + Math.random() * 85); // 75 to 160 BPM
      updateHeartRate(mockBpm);
    }, 2000);
  } else {
    connectWebSocket();
  }
})();

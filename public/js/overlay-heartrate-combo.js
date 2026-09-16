(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const streamKey = params.get('key') || params.get('streamKey');
  const userParam = params.get('user');
  const initialUserKey = streamKey || userParam || 'streamer';
  let resolvedUserId = initialUserKey;
  const paramOpacity = params.get('opacity');

  // DOM Elements
  const widgetEl = document.getElementById('hrComboWidget');
  const bpmValEl = document.getElementById('comboBpmVal');
  const bpmZoneEl = document.getElementById('comboBpmZone');
  const minBpmEl = document.getElementById('comboMinBpm');
  const maxBpmEl = document.getElementById('comboMaxBpm');
  const chartStrokePath = document.getElementById('comboStrokePath');
  const chartAreaPath = document.getElementById('comboAreaPath');
  const beaconDot = document.getElementById('comboBeaconDot');
  const beaconPulse = document.getElementById('comboBeaconPulse');
  const placeholderEl = document.getElementById('comboPlaceholder');

  // Apply Background Alpha
  if (widgetEl) {
    if (typeof makeDraggable === 'function') makeDraggable(widgetEl);
    if (paramOpacity !== null) {
      const alpha = (Math.max(0, Math.min(100, parseFloat(paramOpacity) || 100)) / 100).toFixed(2);
      widgetEl.style.setProperty('--bg-alpha', alpha);
    }
  }

  let bpmHistory = [];
  let ws = null;

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

  function generateSplinePath(points, closeArea = false, width = 220, height = 54) {
    if (points.length < 2) return '';

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    if (closeArea) {
      const lastX = points[points.length - 1].x.toFixed(1);
      const firstX = points[0].x.toFixed(1);
      d += ` L ${lastX} ${height} L ${firstX} ${height} Z`;
    }

    return d;
  }

  function renderChart() {
    const validPoints = bpmHistory.filter(v => typeof v === 'number' && v > 0);

    if (validPoints.length === 0) {
      if (placeholderEl) placeholderEl.style.display = 'block';
      if (chartStrokePath) chartStrokePath.setAttribute('d', '');
      if (chartAreaPath) chartAreaPath.setAttribute('d', '');
      if (beaconDot) { beaconDot.setAttribute('cx', '-10'); beaconDot.setAttribute('cy', '-10'); }
      if (beaconPulse) { beaconPulse.setAttribute('cx', '-10'); beaconPulse.setAttribute('cy', '-10'); }
      if (minBpmEl) minBpmEl.textContent = '--';
      if (maxBpmEl) maxBpmEl.textContent = '--';
      return;
    }

    if (placeholderEl) placeholderEl.style.display = 'none';

    const minBpm = Math.min(...validPoints);
    const maxBpm = Math.max(...validPoints);
    if (minBpmEl) minBpmEl.textContent = minBpm;
    if (maxBpmEl) maxBpmEl.textContent = maxBpm;

    const width = 220;
    const height = 54;
    const paddingY = 6;

    const yMin = Math.max(40, minBpm - 6);
    const yMax = Math.max(yMin + 15, maxBpm + 6);
    const yRange = yMax - yMin;

    const n = validPoints.length;
    const points = validPoints.map((bpm, idx) => {
      const x = n === 1 ? width / 2 : (idx / (n - 1)) * (width - 12) + 6;
      const normalized = (bpm - yMin) / yRange;
      const y = height - paddingY - normalized * (height - 2 * paddingY);
      return { x, y };
    });

    const strokeD = generateSplinePath(points, false, width, height);
    const areaD = generateSplinePath(points, true, width, height);

    if (chartStrokePath) chartStrokePath.setAttribute('d', strokeD);
    if (chartAreaPath) chartAreaPath.setAttribute('d', areaD);

    const latest = points[points.length - 1];
    if (beaconDot && beaconPulse && latest) {
      beaconDot.setAttribute('cx', latest.x.toFixed(1));
      beaconDot.setAttribute('cy', latest.y.toFixed(1));
      beaconPulse.setAttribute('cx', latest.x.toFixed(1));
      beaconPulse.setAttribute('cy', latest.y.toFixed(1));
    }
  }

  function updateHeartRate(bpm, customZone, historyArray = null) {
    if (Array.isArray(historyArray) && historyArray.length > 0) {
      bpmHistory = historyArray.map(item => typeof item === 'object' ? item.bpm : item).filter(v => v > 0);
    } else if (bpm > 0) {
      bpmHistory.push(bpm);
      if (bpmHistory.length > 35) bpmHistory.shift();
    }

    if (!bpm || bpm <= 0) {
      if (bpmValEl) bpmValEl.textContent = '--';
      if (bpmZoneEl) bpmZoneEl.textContent = 'REST';
      if (widgetEl) {
        widgetEl.className = 'hr-combo-widget zone-rest';
        widgetEl.style.setProperty('--beat-speed', '0s');
      }
      renderChart();
      return;
    }

    if (bpmValEl) bpmValEl.textContent = bpm;
    const zoneKey = (customZone && ZONES[customZone.toUpperCase()]) ? customZone.toUpperCase() : getZone(bpm);
    const zoneInfo = ZONES[zoneKey] || ZONES.REST;

    if (bpmZoneEl) bpmZoneEl.textContent = zoneInfo.label;
    if (widgetEl) {
      widgetEl.className = `hr-combo-widget ${zoneInfo.class}`;
      const beatDurationSec = Math.max(0.28, Math.min(1.5, 60 / bpm)).toFixed(2);
      widgetEl.style.setProperty('--beat-speed', `${beatDurationSec}s`);
    }

    renderChart();
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', userId: initialUserKey, key: streamKey }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init' && msg.data) {
          if (msg.data.userId) resolvedUserId = msg.data.userId;
          updateHeartRate(msg.data.bpm || 0, msg.data.bpmZone, msg.data.bpmHistory);
        } else if (msg.type === 'step_update' && (msg.userId === resolvedUserId || msg.userId === initialUserKey)) {
          if (msg.data.bpm !== undefined) {
            updateHeartRate(msg.data.bpm, msg.data.bpmZone, msg.data.bpmHistory);
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

  function fetchStats() {
    fetch(`/api/users/${encodeURIComponent(initialUserKey)}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.user) {
          if (json.user.userId) resolvedUserId = json.user.userId;
          updateHeartRate(json.user.bpm || 0, json.user.bpmZone, json.user.bpmHistory);
        }
      })
      .catch(() => {});
  }

  fetchStats();
  connectWebSocket();
})();

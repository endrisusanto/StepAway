(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const streamKey = params.get('key') || params.get('streamKey');
  const userParam = params.get('user');
  const initialUserKey = streamKey || userParam || 'streamer';
  let resolvedUserId = initialUserKey;
  const paramOpacity = params.get('opacity');

  // DOM Elements
  const widgetEl = document.getElementById('trioWidget');
  const userNameEl = document.getElementById('userName');
  const activityTagEl = document.getElementById('activityTag');
  const currentStepValEl = document.getElementById('currentStepVal');
  const targetValEl = document.getElementById('targetVal');
  const progressFillEl = document.getElementById('progressFill');
  const percentDisplayEl = document.getElementById('percentDisplay');
  const bpmValEl = document.getElementById('bpmVal');
  const bpmZoneLabelEl = document.getElementById('bpmZoneLabel');
  const trioStrokePath = document.getElementById('trioStrokePath');
  const trioAreaPath = document.getElementById('trioAreaPath');
  const trioBeaconDot = document.getElementById('trioBeaconDot');
  const trioBeaconPulse = document.getElementById('trioBeaconPulse');
  const milestoneBanner = document.getElementById('milestoneBanner');
  const milestoneValue = document.getElementById('milestoneValue');

  // Apply Background Alpha & Draggable
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

  function generateSplinePath(points, closeArea = false, width = 240, height = 46) {
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
      if (trioStrokePath) trioStrokePath.setAttribute('d', '');
      if (trioAreaPath) trioAreaPath.setAttribute('d', '');
      if (trioBeaconDot) { trioBeaconDot.setAttribute('cx', '-10'); trioBeaconDot.setAttribute('cy', '-10'); }
      if (trioBeaconPulse) { trioBeaconPulse.setAttribute('cx', '-10'); trioBeaconPulse.setAttribute('cy', '-10'); }
      return;
    }

    const minBpm = Math.min(...validPoints);
    const maxBpm = Math.max(...validPoints);

    const width = 240;
    const height = 46;
    const paddingY = 5;

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

    if (trioStrokePath) trioStrokePath.setAttribute('d', strokeD);
    if (trioAreaPath) trioAreaPath.setAttribute('d', areaD);

    const latest = points[points.length - 1];
    if (trioBeaconDot && trioBeaconPulse && latest) {
      trioBeaconDot.setAttribute('cx', latest.x.toFixed(1));
      trioBeaconDot.setAttribute('cy', latest.y.toFixed(1));
      trioBeaconPulse.setAttribute('cx', latest.x.toFixed(1));
      trioBeaconPulse.setAttribute('cy', latest.y.toFixed(1));
    }
  }

  function updateSteps(data) {
    if (!data) return;
    if (userNameEl && data.name) userNameEl.textContent = data.name;
    if (currentStepValEl && data.currentSteps !== undefined) {
      currentStepValEl.textContent = Number(data.currentSteps).toLocaleString();
    }
    if (targetValEl && data.targetSteps !== undefined) {
      targetValEl.textContent = Number(data.targetSteps).toLocaleString();
    }

    const cur = Number(data.currentSteps || 0);
    const tgt = Math.max(1, Number(data.targetSteps || 5000));
    const pct = Math.round((cur / tgt) * 100);

    if (progressFillEl) progressFillEl.style.width = `${Math.min(100, pct)}%`;
    if (percentDisplayEl) percentDisplayEl.textContent = `${pct}%`;

    if (activityTagEl && data.activityStatus) {
      activityTagEl.className = 'activity-tag';
      if (data.activityStatus === 'RUNNING') {
        activityTagEl.classList.add('activity-running');
        activityTagEl.textContent = 'RUNNING';
      } else if (data.activityStatus === 'WALKING') {
        activityTagEl.classList.add('activity-walking');
        activityTagEl.textContent = 'WALKING';
      } else {
        activityTagEl.textContent = 'REST';
      }
    }

    if (data.milestone && milestoneBanner) {
      if (milestoneValue) milestoneValue.textContent = `${Number(data.milestone).toLocaleString()} STEPS`;
      milestoneBanner.style.display = 'flex';
      setTimeout(() => { milestoneBanner.style.display = 'none'; }, 4000);
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
      if (bpmZoneLabelEl) bpmZoneLabelEl.textContent = 'REST';
      if (widgetEl) {
        widgetEl.className = 'trio-widget zone-rest';
        widgetEl.style.setProperty('--beat-speed', '0s');
      }
      renderChart();
      return;
    }

    if (bpmValEl) bpmValEl.textContent = bpm;
    const zoneKey = (customZone && ZONES[customZone.toUpperCase()]) ? customZone.toUpperCase() : getZone(bpm);
    const zoneInfo = ZONES[zoneKey] || ZONES.REST;

    if (bpmZoneLabelEl) bpmZoneLabelEl.textContent = zoneInfo.label;
    if (widgetEl) {
      widgetEl.className = `trio-widget ${zoneInfo.class}`;
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
          updateSteps(msg.data);
          updateHeartRate(msg.data.bpm || 0, msg.data.bpmZone, msg.data.bpmHistory);
        } else if (msg.type === 'step_update' && (msg.userId === resolvedUserId || msg.userId === initialUserKey)) {
          if (msg.data) {
            updateSteps(msg.data);
            if (msg.data.bpm !== undefined) {
              updateHeartRate(msg.data.bpm, msg.data.bpmZone, msg.data.bpmHistory);
            }
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
          updateSteps(json.user);
          updateHeartRate(json.user.bpm || 0, json.user.bpmZone, json.user.bpmHistory);
        }
      })
      .catch(() => {});
  }

  fetchStats();
  connectWebSocket();
})();

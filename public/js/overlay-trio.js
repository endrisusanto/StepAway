(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const streamKey = params.get('key') || params.get('streamKey');
  const userParam = params.get('user');
  const initialUserKey = streamKey || userParam || 'streamer';
  let resolvedUserId = initialUserKey;
  const paramOpacity = params.get('opacity');
  const isTest = params.get('test') === 'true';

  // DOM Elements
  const widgetEl = document.getElementById('trioWidget');
  const particlesLayer = document.getElementById('particlesLayer');
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

  let prevSteps = 0;
  let bpmHistory = [];
  let ws = null;

  const ZONES = {
    REST: { label: 'REST', class: 'zone-rest' },
    AEROBIC: { label: 'AEROBIC', class: 'zone-aerobic' },
    ANAEROBIC: { label: 'ANAEROBIC', class: 'zone-anaerobic' },
    PEAK: { label: 'PEAK', class: 'zone-peak' }
  };

  function getMilestoneScheme(milestone) {
    const schemes = [
      { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', text: '#09090b', glow: 'rgba(16, 185, 129, 0.6)' },
      { bg: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)', text: '#09090b', glow: 'rgba(6, 182, 212, 0.6)' },
      { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', text: '#ffffff', glow: 'rgba(139, 92, 246, 0.6)' },
      { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', text: '#09090b', glow: 'rgba(245, 158, 11, 0.6)' },
      { bg: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', text: '#ffffff', glow: 'rgba(244, 63, 94, 0.6)' },
      { bg: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)', text: '#ffffff', glow: 'rgba(236, 72, 153, 0.6)' }
    ];
    const idx = Math.max(0, Math.floor(Number(milestone || 1000) / 1000) - 1) % schemes.length;
    return schemes[idx];
  }

  function spawnStepParticle(delta) {
    if (delta <= 0 || !particlesLayer) return;
    const pop = document.createElement('div');
    pop.className = 'step-float-pop';
    pop.textContent = `+${delta}`;

    const numWidth = currentStepValEl ? currentStepValEl.offsetWidth : 40;
    const labelX = Math.max(70, 18 + numWidth + 12);
    const randomOffset = Math.floor(Math.random() * 14) - 7;
    pop.style.left = `${labelX + randomOffset}px`;
    pop.style.top = '46px';
    particlesLayer.appendChild(pop);
    setTimeout(() => pop.remove(), 1100);
  }

  function getZone(bpm) {
    if (bpm < 100) return 'REST';
    if (bpm < 140) return 'AEROBIC';
    if (bpm < 170) return 'ANAEROBIC';
    return 'PEAK';
  }

  function generateSplinePath(points, closeArea = false, width = 240, height = 40) {
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
    const height = 40;
    const paddingY = 4;

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

  function updateSteps(data, delta = 0) {
    if (!data) return;
    if (userNameEl && data.name) userNameEl.textContent = data.name;

    const cur = Number(data.currentSteps || 0);
    const tgt = Math.max(1, Number(data.targetSteps || 5000));
    const pct = Math.round((cur / tgt) * 100);

    const effectiveDelta = delta > 0 ? delta : (data.delta > 0 ? data.delta : (cur > prevSteps && prevSteps > 0 ? cur - prevSteps : 0));
    prevSteps = cur;

    if (currentStepValEl) {
      currentStepValEl.textContent = cur.toLocaleString();
    }
    if (targetValEl) {
      targetValEl.textContent = tgt.toLocaleString();
    }

    if (progressFillEl) progressFillEl.style.width = `${Math.min(100, pct)}%`;
    if (percentDisplayEl) percentDisplayEl.textContent = `${pct}%`;

    // Trigger Floating +Delta Particle Pop & Pulse
    if (effectiveDelta > 0) {
      spawnStepParticle(effectiveDelta);
      if (currentStepValEl) {
        currentStepValEl.classList.remove('step-bump');
        void currentStepValEl.offsetWidth;
        currentStepValEl.classList.add('step-bump');
      }
      if (progressFillEl) {
        progressFillEl.classList.remove('pulse-active');
        void progressFillEl.offsetWidth;
        progressFillEl.classList.add('pulse-active');
      }
    }

    if (activityTagEl) {
      const status = (data.activityStatus || (effectiveDelta > 3 ? 'RUNNING' : (effectiveDelta > 0 ? 'WALKING' : 'IDLE'))).toUpperCase();
      activityTagEl.className = 'activity-tag';
      if (status === 'RUNNING') {
        activityTagEl.classList.add('activity-running');
        activityTagEl.textContent = 'RUNNING';
      } else if (status === 'WALKING') {
        activityTagEl.classList.add('activity-walking');
        activityTagEl.textContent = 'WALKING';
      } else {
        activityTagEl.classList.add('activity-idle');
        activityTagEl.textContent = 'REST';
      }
    }

    if (data.milestone && milestoneBanner) {
      const scheme = getMilestoneScheme(data.milestone);
      widgetEl.style.setProperty('--milestone-bg', scheme.bg);
      widgetEl.style.setProperty('--milestone-text', scheme.text);
      widgetEl.style.setProperty('--milestone-glow', scheme.glow);

      if (milestoneValue) milestoneValue.textContent = `${Number(data.milestone).toLocaleString()} STEPS`;
      milestoneBanner.classList.add('active');
      setTimeout(() => { milestoneBanner.classList.remove('active'); }, 4000);
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
            updateSteps(msg.data, msg.data.delta);
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

  if (isTest) {
    let testSteps = 3450;
    let testBpm = 128;
    const testData = {
      name: 'Streamer (Test)',
      currentSteps: testSteps,
      targetSteps: 5000,
      activityStatus: 'WALKING',
      bpm: testBpm,
      bpmZone: 'AEROBIC',
      bpmHistory: [118, 120, 122, 125, 128, 126, 128, 130, 128]
    };
    updateSteps(testData);
    updateHeartRate(testData.bpm, testData.bpmZone, testData.bpmHistory);

    // Live +1 Step and HR Wave simulator
    setInterval(() => {
      testSteps += 1;
      const hrDelta = Math.floor(Math.random() * 3) - 1;
      testBpm = Math.max(90, Math.min(165, testBpm + hrDelta));
      updateSteps({
        name: 'Streamer (Test)',
        currentSteps: testSteps,
        targetSteps: 5000,
        activityStatus: testSteps % 10 === 0 ? 'RUNNING' : 'WALKING',
        delta: 1
      }, 1);
      updateHeartRate(testBpm, getZone(testBpm));
    }, 1500);
  } else {
    fetchStats();
    connectWebSocket();
  }
})();

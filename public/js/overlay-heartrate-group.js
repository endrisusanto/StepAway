// StepAway Group HR Combo Overlay (Multi-Row Stacked with Real-time Charts)
(() => {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room') || 'global';
  const paramOpacity = params.get('opacity') || params.get('bg_alpha');
  const isTest = params.get('test') === 'true';

  const stackEl = document.getElementById('groupStack');
  if (stackEl) {
    if (typeof makeDraggable === 'function') makeDraggable(stackEl);
    if (paramOpacity !== null) {
      const alpha = (Math.max(0, Math.min(100, parseFloat(paramOpacity) <= 1 ? parseFloat(paramOpacity) * 100 : parseFloat(paramOpacity) || 100)) / 100).toFixed(2);
      document.documentElement.style.setProperty('--bg-alpha', alpha);
    }
  }

  const memberRows = new Map();
  let ws = null;
  let emptyStateEl = null;

  const ZONES = {
    REST: { label: 'REST', class: 'zone-rest' },
    AEROBIC: { label: 'AEROBIC', class: 'zone-aerobic' },
    ANAEROBIC: { label: 'ANAEROBIC', class: 'zone-anaerobic' },
    PEAK: { label: 'PEAK', class: 'zone-peak' },
    DISCONNECTED: { label: 'NO SIGNAL', class: 'zone-disconnected' }
  };

  function getZone(bpm) {
    if (!bpm || bpm <= 0) return 'DISCONNECTED';
    if (bpm < 100) return 'REST';
    if (bpm < 140) return 'AEROBIC';
    if (bpm < 170) return 'ANAEROBIC';
    return 'PEAK';
  }

  function updateEmptyState() {
    let hasVisibleCard = false;
    memberRows.forEach(row => {
      if (row.card.style.display !== 'none') {
        hasVisibleCard = true;
      }
    });

    if (!hasVisibleCard) {
      if (!emptyStateEl) {
        emptyStateEl = document.createElement('div');
        emptyStateEl.id = 'groupEmptyState';
        emptyStateEl.className = 'group-empty-state';
        emptyStateEl.textContent = 'Menunggu Smartband Terhubung...';
        stackEl.appendChild(emptyStateEl);
      }
      emptyStateEl.style.display = 'flex';
    } else if (emptyStateEl) {
      emptyStateEl.style.display = 'none';
    }
  }

  function generateSplinePath(points, closeArea = false, width = 210, height = 44) {
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

  function createMemberRow(slotId, name) {
    if (memberRows.has(slotId)) {
      return memberRows.get(slotId);
    }

    const card = document.createElement('div');
    card.className = 'hr-combo-widget zone-disconnected';
    card.id = `hrCombo-${slotId}`;

    card.innerHTML = `
      <!-- Left Column: Member Name & Big BPM -->
      <div class="hr-left-col">
        <div class="member-header-row">
          <div id="dot-${slotId}" class="status-dot offline"></div>
          <span id="name-${slotId}" class="member-name">${name || slotId}</span>
        </div>
        <div class="hr-main-row">
          <div class="heart-pulse-box">
            <svg viewBox="0 0 24 24" id="heart-${slotId}" class="heart-icon-svg">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <div class="bpm-text-group">
            <div class="bpm-num-row">
              <span id="bpm-${slotId}" class="combo-bpm-number">--</span>
              <span class="combo-bpm-sub">BPM</span>
            </div>
            <span id="zone-${slotId}" class="combo-zone-pill">NO SIGNAL</span>
          </div>
        </div>
      </div>

      <!-- Divider -->
      <div class="hr-combo-divider"></div>

      <!-- Right Column: Real-time SVG Trend Chart -->
      <div class="hr-right-col">
        <div class="chart-meta-row">
          <span class="chart-title-tag">HR TREND</span>
          <div class="chart-minmax-tags">
            <span>MIN: <strong id="min-${slotId}">--</strong></span>
            <span>MAX: <strong id="max-${slotId}">--</strong></span>
          </div>
        </div>

        <div class="combo-chart-viewport">
          <svg id="svg-${slotId}" class="combo-svg" preserveAspectRatio="none" viewBox="0 0 210 44">
            <defs>
              <linearGradient id="grad-${slotId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--theme-color)" stop-opacity="0.45" />
                <stop offset="100%" stop-color="var(--theme-color)" stop-opacity="0.0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="14" x2="210" y2="14" class="combo-grid-line" />
            <line x1="0" y1="28" x2="210" y2="28" class="combo-grid-line" />
            <path id="area-${slotId}" fill="url(#grad-${slotId})" d="" />
            <path id="stroke-${slotId}" class="combo-stroke" d="" />
          </svg>
          <div id="beacon-${slotId}" class="chart-beacon" style="display: none;"></div>
          <div id="ph-${slotId}" class="combo-placeholder">Listening...</div>
        </div>
      </div>
    `;

    stackEl.appendChild(card);

    const elements = {
      card,
      nameEl: card.querySelector(`#name-${slotId}`),
      dotEl: card.querySelector(`#dot-${slotId}`),
      heartEl: card.querySelector(`#heart-${slotId}`),
      bpmEl: card.querySelector(`#bpm-${slotId}`),
      zoneEl: card.querySelector(`#zone-${slotId}`),
      minEl: card.querySelector(`#min-${slotId}`),
      maxEl: card.querySelector(`#max-${slotId}`),
      areaPath: card.querySelector(`#area-${slotId}`),
      strokePath: card.querySelector(`#stroke-${slotId}`),
      beaconEl: card.querySelector(`#beacon-${slotId}`),
      placeholderEl: card.querySelector(`#ph-${slotId}`),
      bpmHistory: []
    };

    memberRows.set(slotId, elements);
    return elements;
  }

  function renderMemberChart(rowObj) {
    const { bpmHistory, placeholderEl, areaPath, strokePath, beaconEl, minEl, maxEl } = rowObj;
    const validPoints = bpmHistory.filter(v => typeof v === 'number' && v > 0);

    if (validPoints.length === 0) {
      if (placeholderEl) placeholderEl.style.display = 'block';
      if (strokePath) strokePath.setAttribute('d', '');
      if (areaPath) areaPath.setAttribute('d', '');
      if (beaconEl) beaconEl.style.display = 'none';
      if (minEl) minEl.textContent = '--';
      if (maxEl) maxEl.textContent = '--';
      return;
    }

    if (placeholderEl) placeholderEl.style.display = 'none';

    const minBpm = Math.min(...validPoints);
    const maxBpm = Math.max(...validPoints);
    if (minEl) minEl.textContent = minBpm;
    if (maxEl) maxEl.textContent = maxBpm;

    const width = 210;
    const height = 44;
    const paddingY = 5;

    let range = maxBpm - minBpm;
    if (range < 10) range = 10;
    const baseMin = Math.max(0, minBpm - 5);
    const baseRange = range + 10;

    const count = validPoints.length;
    const stepX = count > 1 ? width / (count - 1) : width;

    const coords = validPoints.map((val, idx) => {
      const x = idx * stepX;
      const normalized = (val - baseMin) / baseRange;
      const y = height - paddingY - normalized * (height - paddingY * 2);
      return { x, y };
    });

    const strokeD = generateSplinePath(coords, false, width, height);
    const areaD = generateSplinePath(coords, true, width, height);

    if (strokePath) strokePath.setAttribute('d', strokeD);
    if (areaPath) areaPath.setAttribute('d', areaD);

    const last = coords[coords.length - 1];
    if (beaconEl && last) {
      beaconEl.style.display = 'block';
      beaconEl.style.left = `${(last.x / width) * 100}%`;
      beaconEl.style.top = `${(last.y / height) * 100}%`;
    }
  }

  function updateMember(member) {
    if (!member) return;
    const slotId = member.slotId || member.userId || 'slot_1';
    const bpm = Math.max(0, Number(member.bpm) || 0);

    // If no band connected / 0 bpm and not in test mode, hide this card
    if (bpm <= 0 && !isTest) {
      const existing = memberRows.get(slotId);
      if (existing) {
        existing.card.style.display = 'none';
      }
      updateEmptyState();
      return;
    }

    let rowObj = memberRows.get(slotId);
    if (!rowObj) {
      rowObj = createMemberRow(slotId, member.name || member.displayName);
    }

    const { card, nameEl, dotEl, heartEl, bpmEl, zoneEl } = rowObj;
    card.style.display = 'flex';

    if ((member.name || member.displayName) && nameEl) {
      nameEl.textContent = member.name || member.displayName;
    }

    const prevBpm = parseInt(bpmEl.textContent, 10) || 0;
    const zoneKey = getZone(bpm);
    const zoneInfo = ZONES[zoneKey] || ZONES.DISCONNECTED;

    // Reset zone classes
    card.className = `hr-combo-widget ${zoneInfo.class}`;

    if (bpm > 0) {
      dotEl.className = 'status-dot';
      bpmEl.textContent = bpm;
      zoneEl.textContent = member.zone || member.bpmZone || zoneInfo.label;

      const beatSpeed = (60 / bpm).toFixed(3);
      card.style.setProperty('--beat-speed', `${beatSpeed}s`);
      heartEl.classList.add('beating');

      if (bpm !== prevBpm) {
        bpmEl.classList.remove('bpm-bump');
        void bpmEl.offsetWidth;
        bpmEl.classList.add('bpm-bump');
      }

      // Update history buffer
      if (Array.isArray(member.bpmHistory) && member.bpmHistory.length > 0) {
        rowObj.bpmHistory = member.bpmHistory.map(v => (typeof v === 'object' ? v.bpm : Number(v)) || bpm);
      } else {
        rowObj.bpmHistory.push(bpm);
        if (rowObj.bpmHistory.length > 30) rowObj.bpmHistory.shift();
      }
    } else {
      dotEl.className = 'status-dot offline';
      bpmEl.textContent = '--';
      zoneEl.textContent = 'NO SIGNAL';
      heartEl.classList.remove('beating');
    }

    renderMemberChart(rowObj);
    updateEmptyState();
  }

  function handleGroupUpdate(members) {
    if (!Array.isArray(members)) return;
    const activeSlotIds = new Set();

    members.forEach(m => {
      const slotId = m.slotId || m.userId || 'slot_1';
      if ((Number(m.bpm) || 0) > 0 || isTest) {
        activeSlotIds.add(slotId);
        updateMember(m);
      }
    });

    // Hide any cached slots that are no longer active/connected
    if (!isTest) {
      memberRows.forEach((rowObj, sId) => {
        if (!activeSlotIds.has(sId)) {
          rowObj.card.style.display = 'none';
        }
      });
    }

    updateEmptyState();
  }

  async function fetchInitialData() {
    try {
      const res = await fetch(`/api/heartrate/group?room=${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.members && data.members.length > 0) {
          handleGroupUpdate(data.members);
        } else {
          updateEmptyState();
        }
      } else {
        updateEmptyState();
      }
    } catch (e) {
      console.warn('Initial group HR fetch error:', e);
      updateEmptyState();
    }
  }

  function connectWs() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      console.log('[Group HR Combo Overlay] WebSocket Connected');
      ws.send(JSON.stringify({ type: 'subscribe_room', roomId }));
      ws.send(JSON.stringify({ type: 'subscribe', userId: '*' }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'group_heartrate_update') {
          if (!msg.roomId || msg.roomId === roomId || roomId === 'global') {
            handleGroupUpdate(msg.members);
          }
        } else if (msg.type === 'step_update' && msg.data) {
          const d = msg.data;
          if (d.bpm && d.bpm > 0) {
            updateMember({
              slotId: 'slot_1',
              name: d.name || d.userId || 'Streamer (Host)',
              bpm: d.bpm || 0,
              zone: d.bpmZone || 'DISCONNECTED',
              bpmHistory: d.bpmHistory || []
            });
          }
        } else if (msg.type === 'init' && msg.data) {
          const d = msg.data;
          if (d.bpm && d.bpm > 0) {
            updateMember({
              slotId: 'slot_1',
              name: d.name || d.userId || 'Streamer (Host)',
              bpm: d.bpm || 0,
              zone: d.bpmZone || 'DISCONNECTED',
              bpmHistory: d.bpmHistory || []
            });
          }
        }
      } catch (err) {
        console.error('Error processing group HR message:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWs, 3000);
    };
  }

  // Test Simulation Mode vs Live Mode
  if (isTest) {
    const testMembers = [
      {
        slotId: 'slot_1',
        name: 'Streamer (Host)',
        bpm: 134,
        zone: 'AEROBIC',
        bpmHistory: [118, 120, 122, 125, 128, 130, 132, 134, 133, 134]
      },
      {
        slotId: 'slot_2',
        name: 'Player 2 (Co-Host)',
        bpm: 152,
        zone: 'ANAEROBIC',
        bpmHistory: [130, 135, 140, 144, 148, 150, 153, 155, 151, 152]
      },
      {
        slotId: 'slot_3',
        name: 'Player 3 (Guest)',
        bpm: 96,
        zone: 'REST',
        bpmHistory: [88, 90, 92, 91, 94, 95, 93, 96, 95, 96]
      }
    ];

    testMembers.forEach(updateMember);

    // Dynamic wave simulation
    setInterval(() => {
      testMembers.forEach(m => {
        const delta = Math.floor(Math.random() * 5) - 2;
        m.bpm = Math.max(60, Math.min(190, m.bpm + delta));
        m.bpmHistory.push(m.bpm);
        if (m.bpmHistory.length > 25) m.bpmHistory.shift();
        updateMember(m);
      });
    }, 1800);
  } else {
    updateEmptyState();
    fetchInitialData();
    connectWs();
  }
})();

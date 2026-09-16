// StepAway Group Heart Rate Overlay Logic
(() => {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room') || 'global';
  const layoutMode = params.get('layout') || 'row'; // 'row', 'grid', 'vs'
  const bgAlpha = params.get('bg_alpha');
  const isTest = params.get('test') === 'true';

  if (bgAlpha !== null && !isNaN(parseFloat(bgAlpha))) {
    document.documentElement.style.setProperty('--bg-alpha', Math.max(0, Math.min(1, parseFloat(bgAlpha))));
  }

  const container = document.getElementById('groupContainer');
  if (container) {
    container.className = `group-container layout-${layoutMode}`;
  }

  const memberCards = new Map();
  let ws = null;

  function getZoneClass(bpm) {
    if (!bpm || bpm <= 0) return { cls: 'zone-disconnected', label: 'NO SIGNAL' };
    if (bpm < 100) return { cls: 'zone-warmup', label: 'WARM UP' };
    if (bpm < 140) return { cls: 'zone-aerobic', label: 'AEROBIC' };
    if (bpm < 170) return { cls: 'zone-anaerobic', label: 'ANAEROBIC' };
    return { cls: 'zone-peak', label: 'PEAK' };
  }

  function createMemberCard(slotId, name) {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.id = `card-${slotId}`;

    card.innerHTML = `
      <div class="card-header">
        <div class="member-info">
          <div id="dot-${slotId}" class="status-dot offline"></div>
          <span id="name-${slotId}" class="member-name">${name || slotId}</span>
        </div>
        <span class="slot-tag">${slotId.replace('_', ' ')}</span>
      </div>
      <div class="card-body">
        <div class="heart-wrap">
          <svg id="heart-${slotId}" class="heart-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
        <div class="bpm-display">
          <span id="bpm-${slotId}" class="bpm-number">--</span>
          <span class="bpm-unit">BPM</span>
        </div>
      </div>
      <div class="gauge-track">
        <div id="gauge-${slotId}" class="gauge-fill"></div>
      </div>
      <div id="zone-${slotId}" class="zone-pill">NO SIGNAL</div>
    `;

    // Handle VS Mode divider
    if (layoutMode === 'vs' && memberCards.size === 1) {
      const divider = document.createElement('div');
      divider.className = 'vs-divider';
      divider.textContent = 'VS';
      container.appendChild(divider);
    }

    container.appendChild(card);

    const elements = {
      card,
      nameEl: card.querySelector(`#name-${slotId}`),
      dotEl: card.querySelector(`#dot-${slotId}`),
      heartEl: card.querySelector(`#heart-${slotId}`),
      bpmEl: card.querySelector(`#bpm-${slotId}`),
      gaugeEl: card.querySelector(`#gauge-${slotId}`),
      zoneEl: card.querySelector(`#zone-${slotId}`)
    };

    memberCards.set(slotId, elements);
    return elements;
  }

  function updateMember(member) {
    const slotId = member.slotId || member.userId || 'slot_1';
    let cardObj = memberCards.get(slotId);
    if (!cardObj) {
      cardObj = createMemberCard(slotId, member.name);
    }

    const { card, nameEl, dotEl, heartEl, bpmEl, gaugeEl, zoneEl } = cardObj;
    if (member.name && nameEl) nameEl.textContent = member.name;

    const bpm = Math.max(0, Number(member.bpm) || 0);
    const prevBpm = parseInt(bpmEl.textContent, 10) || 0;

    const { cls, label } = getZoneClass(bpm);

    // Reset zone classes
    card.classList.remove('zone-disconnected', 'zone-warmup', 'zone-aerobic', 'zone-anaerobic', 'zone-peak', 'disconnected');
    card.classList.add(cls);

    if (bpm > 0) {
      dotEl.className = 'status-dot';
      bpmEl.textContent = bpm;
      zoneEl.textContent = member.zone || label;

      // Pulse animation rate
      const beatRate = (60 / bpm).toFixed(3);
      heartEl.style.animationDuration = `${beatRate}s`;
      heartEl.classList.add('beating');

      // Gauge progress (50 to 190 range)
      const pct = Math.min(100, Math.max(0, Math.round(((bpm - 50) / 140) * 100)));
      gaugeEl.style.width = `${pct}%`;

      if (bpm !== prevBpm) {
        bpmEl.classList.remove('bpm-bump');
        void bpmEl.offsetWidth;
        bpmEl.classList.add('bpm-bump');
      }
    } else {
      dotEl.className = 'status-dot offline';
      card.classList.add('disconnected');
      bpmEl.textContent = '--';
      zoneEl.textContent = 'NO SIGNAL';
      heartEl.classList.remove('beating');
      gaugeEl.style.width = '0%';
    }

    // Update VS leader highlight
    if (layoutMode === 'vs') {
      updateVsLeader();
    }
  }

  function updateVsLeader() {
    let highestBpm = 0;
    let leaderSlot = null;

    memberCards.forEach((obj, slotId) => {
      const bpm = parseInt(obj.bpmEl.textContent, 10) || 0;
      obj.card.classList.remove('leader');
      if (bpm > highestBpm) {
        highestBpm = bpm;
        leaderSlot = slotId;
      }
    });

    if (leaderSlot && highestBpm > 0) {
      memberCards.get(leaderSlot)?.card.classList.add('leader');
    }
  }

  async function fetchInitialData() {
    try {
      const res = await fetch(`/api/heartrate/group?room=${encodeURIComponent(roomId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.members && data.members.length > 0) {
          data.members.forEach(updateMember);
        }
      }
    } catch (e) {
      console.warn('Initial group HR fetch error:', e);
    }
  }

  function connectWs() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      console.log('[Group HR Overlay] WebSocket Connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'group_heartrate_update') {
          if (!msg.roomId || msg.roomId === roomId || roomId === 'global') {
            if (Array.isArray(msg.members)) {
              msg.members.forEach(updateMember);
            }
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

  // Test Simulation Mode
  if (isTest) {
    const testMembers = [
      { slotId: 'slot_1', name: 'Streamer (Host)', bpm: 132, zone: 'AEROBIC' },
      { slotId: 'slot_2', name: 'Player 2', bpm: 154, zone: 'ANAEROBIC' },
      { slotId: 'slot_3', name: 'Player 3', bpm: 95, zone: 'WARM UP' },
      { slotId: 'slot_4', name: 'Player 4', bpm: 172, zone: 'PEAK' }
    ];
    testMembers.forEach(updateMember);
  } else {
    fetchInitialData();
    connectWs();
  }
})();

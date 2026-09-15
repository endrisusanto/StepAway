// StepAway Multi-User Overlay Logic (Rooms & Direct Users)
(() => {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const usersParam = params.get('users') || 'streamer,guest';
  const targetUserIds = usersParam.split(',').map(u => u.trim()).filter(Boolean);
  const isTest = params.get('test') === 'true';

  const multiGridEl = document.getElementById('multiGrid');
  const userCards = new Map();
  let ws = null;

  // ponytail: dynamic milestone palette rotation
  function getMilestoneScheme(milestone) {
    const schemes = [
      { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', text: '#09090b', glow: 'rgba(16, 185, 129, 0.6)', accent: '#10b981' }, // Emerald
      { bg: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)', text: '#09090b', glow: 'rgba(6, 182, 212, 0.6)', accent: '#06b6d4' }, // Cyan Blue
      { bg: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', text: '#ffffff', glow: 'rgba(139, 92, 246, 0.6)', accent: '#8b5cf6' }, // Violet Purple
      { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', text: '#09090b', glow: 'rgba(245, 158, 11, 0.6)', accent: '#f59e0b' }, // Amber Gold
      { bg: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', text: '#ffffff', glow: 'rgba(244, 63, 94, 0.6)', accent: '#f43f5e' }, // Rose Crimson
      { bg: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)', text: '#ffffff', glow: 'rgba(236, 72, 153, 0.6)', accent: '#ec4899' }  // Pink Purple
    ];
    const idx = Math.max(0, Math.floor(Number(milestone || 1000) / 1000) - 1) % schemes.length;
    return schemes[idx];
  }

  function applyActivity(badgeEl, cardEl, status) {
    const s = (status || 'IDLE').toUpperCase();
    badgeEl.className = 'activity-badge';
    if (s === 'RUNNING') {
      badgeEl.textContent = 'RUNNING';
      badgeEl.classList.add('activity-running');
    } else if (s === 'WALKING') {
      badgeEl.textContent = 'WALKING';
      badgeEl.classList.add('activity-walking');
    } else {
      badgeEl.textContent = 'REST';
      badgeEl.classList.add('activity-idle');
    }
  }

  function createUserCard(userId) {
    const card = document.createElement('div');
    card.className = 'step-widget';
    card.id = `widget-${userId}`;
    card.innerHTML = `
      <div id="milestone-${userId}" class="milestone-banner">
        <div class="milestone-title">MILESTONE REACHED</div>
        <div id="milestoneVal-${userId}" class="milestone-value">1,000 STEPS</div>
      </div>
      <div id="particles-${userId}" class="particles-layer"></div>
      <div class="widget-header">
        <div class="user-badge">
          <div id="dot-${userId}" class="status-dot online"></div>
          <span id="name-${userId}" class="user-name">${userId}</span>
        </div>
        <div id="activity-${userId}" class="activity-badge activity-idle">REST</div>
      </div>
      <div class="counter-box">
        <div class="step-numbers">
          <span id="steps-${userId}" class="current-step-val">0</span>
          <span class="step-label">steps</span>
        </div>
        <div class="target-info">
          Goal: <span id="target-${userId}" class="target-val">5,000</span>
        </div>
      </div>
      <div class="progress-section">
        <div class="progress-track">
          <div id="bar-${userId}" class="progress-fill"></div>
        </div>
        <div id="percent-${userId}" class="percent-display">0%</div>
      </div>
    `;
    multiGridEl.appendChild(card);

    userCards.set(userId, {
      card,
      nameEl: card.querySelector(`#name-${userId}`),
      activityEl: card.querySelector(`#activity-${userId}`),
      stepsEl: card.querySelector(`#steps-${userId}`),
      targetEl: card.querySelector(`#target-${userId}`),
      barEl: card.querySelector(`#bar-${userId}`),
      percentEl: card.querySelector(`#percent-${userId}`),
      particlesEl: card.querySelector(`#particles-${userId}`),
      milestoneEl: card.querySelector(`#milestone-${userId}`),
      milestoneValEl: card.querySelector(`#milestoneVal-${userId}`)
    });

    return userCards.get(userId);
  }

  function spawnStepParticle(particlesEl, delta, stepsEl) {
    if (delta <= 0 || !particlesEl) return;
    const pop = document.createElement('div');
    pop.className = 'step-float-pop';
    pop.textContent = `+${delta}`;
    
    // Position directly above the "steps" label so it does not obscure the streamer name
    const numWidth = stepsEl ? stepsEl.offsetWidth : 30;
    const labelX = Math.max(65, 24 + numWidth + 10);
    const randomOffset = Math.floor(Math.random() * 14) - 7;
    pop.style.left = `${labelX + randomOffset}px`;
    pop.style.top = '48px';
    particlesEl.appendChild(pop);
    setTimeout(() => pop.remove(), 1100);
  }

  function updateCard(userData, delta = 0) {
    let cardObj = userCards.get(userData.userId);
    if (!cardObj) {
      cardObj = createUserCard(userData.userId);
    }

    const { card, nameEl, activityEl, stepsEl, targetEl, barEl, percentEl, particlesEl, milestoneEl, milestoneValEl } = cardObj;
    nameEl.textContent = userData.name || userData.userId;

    const prevSteps = cardObj.prevSteps !== undefined ? cardObj.prevSteps : (parseInt(stepsEl.textContent.replace(/,/g, ''), 10) || 0);
    const steps = userData.currentSteps || 0;
    cardObj.prevSteps = steps;
    const target = userData.targetSteps || 5000;
    stepsEl.textContent = steps.toLocaleString();
    targetEl.textContent = target.toLocaleString();

    const percentage = Math.round((steps / Math.max(1, target)) * 100);
    barEl.style.width = `${Math.min(100, percentage)}%`;
    percentEl.textContent = `${percentage}%`;

    const effectiveDelta = delta > 0 ? delta : (userData.delta > 0 ? userData.delta : ((steps > prevSteps && prevSteps > 0) ? steps - prevSteps : 0));

    applyActivity(activityEl, card, userData.activityStatus || (effectiveDelta > 3 ? 'RUNNING' : (effectiveDelta > 0 ? 'WALKING' : 'IDLE')));

    if (effectiveDelta > 0) {
      spawnStepParticle(particlesEl, effectiveDelta, stepsEl);
      if (stepsEl) {
        stepsEl.classList.remove('step-bump');
        void stepsEl.offsetWidth;
        stepsEl.classList.add('step-bump');
      }
      barEl.classList.remove('pulse-active');
      void barEl.offsetWidth;
      barEl.classList.add('pulse-active');
    }

    if (userData.milestone) {
      const scheme = getMilestoneScheme(userData.milestone);
      card.style.setProperty('--milestone-bg', scheme.bg);
      card.style.setProperty('--milestone-text', scheme.text);
      card.style.setProperty('--milestone-glow', scheme.glow);
      card.style.setProperty('--milestone-accent', scheme.accent);

      milestoneValEl.textContent = `${Number(userData.milestone).toLocaleString()} STEPS!`;
      milestoneEl.classList.add('show');
      card.classList.add('milestone-active');
      setTimeout(() => {
        milestoneEl.classList.remove('show');
        card.classList.remove('milestone-active');
      }, 3000);
    }
  }

  if (!roomId) {
    targetUserIds.forEach(u => createUserCard(u));
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (roomId) {
        ws.send(JSON.stringify({ type: 'subscribe_room', roomId }));
      } else {
        ws.send(JSON.stringify({ type: 'subscribe_multi', userIds: targetUserIds }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init_multi' && Array.isArray(msg.data)) {
          msg.data.forEach(u => updateCard(u, 0));
        } else if (msg.type === 'init_room' && Array.isArray(msg.data)) {
          msg.data.forEach(u => updateCard(u, 0));
        } else if (msg.type === 'step_update' && msg.data) {
          updateCard(msg.data, msg.data.delta || 0);
        }
      } catch (err) {
        console.error('[Multi-WS Error]', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 2500);
    };
  }

  if (isTest) {
    let s1 = 1200, s2 = 2400;
    updateCard({ userId: 'Streamer 1', currentSteps: s1, targetSteps: 5000, activityStatus: 'WALKING' });
    updateCard({ userId: 'Streamer 2', currentSteps: s2, targetSteps: 5000, activityStatus: 'RUNNING' });

    setInterval(() => {
      s1 += 2;
      s2 += 6;
      updateCard({ userId: 'Streamer 1', currentSteps: s1, targetSteps: 5000, activityStatus: 'WALKING' }, 2);
      updateCard({ userId: 'Streamer 2', currentSteps: s2, targetSteps: 5000, activityStatus: 'RUNNING' }, 6);
    }, 1800);
    function pollMultiFallback() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        if (roomId) {
          fetch(`/api/rooms/${encodeURIComponent(roomId)}`)
            .then(res => res.json())
            .then(json => {
              if (json.success && json.room && Array.isArray(json.room.members)) {
                json.room.members.forEach(u => updateCard(u, 0));
              }
            })
            .catch(() => {});
        } else {
          targetUserIds.forEach(uId => {
            fetch(`/api/users/${encodeURIComponent(uId)}`)
              .then(res => res.json())
              .then(json => {
                if (json.success && json.user) {
                  updateCard(json.user, 0);
                }
              })
              .catch(() => {});
          });
        }
      }
    }

    pollMultiFallback();
    connectWebSocket();

    // ponytail: periodic poll fallback (every 3s)
    setInterval(pollMultiFallback, 3000);
  }
})();

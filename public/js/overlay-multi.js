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
      badgeEl.textContent = 'IDLE';
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
        <div id="activity-${userId}" class="activity-badge activity-idle">IDLE</div>
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

  function spawnStepParticle(particlesEl, delta) {
    if (delta <= 0 || !particlesEl) return;
    const pop = document.createElement('div');
    pop.className = 'step-float-pop';
    pop.textContent = `+${delta}`;
    const randomX = Math.floor(Math.random() * 50) - 20;
    pop.style.left = `${90 + randomX}px`;
    pop.style.top = '10px';
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

    const steps = userData.currentSteps || 0;
    const target = userData.targetSteps || 5000;
    stepsEl.textContent = steps.toLocaleString();
    targetEl.textContent = target.toLocaleString();

    const percentage = Math.min(100, Math.round((steps / Math.max(1, target)) * 100));
    barEl.style.width = `${percentage}%`;
    percentEl.textContent = `${percentage}%`;

    applyActivity(activityEl, card, userData.activityStatus || (delta > 3 ? 'RUNNING' : (delta > 0 ? 'WALKING' : 'IDLE')));

    if (delta > 0) {
      spawnStepParticle(particlesEl, delta);
      barEl.classList.remove('pulse-active');
      void barEl.offsetWidth;
      barEl.classList.add('pulse-active');
    }

    if (userData.milestone) {
      milestoneValEl.textContent = `${userData.milestone.toLocaleString()} STEPS!`;
      milestoneEl.classList.add('show');
      setTimeout(() => milestoneEl.classList.remove('show'), 3000);
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

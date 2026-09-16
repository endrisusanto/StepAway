(function () {
  'use strict';

  // URL Parameters
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('user') || params.get('userId') || 'streamer';
  const streamKey = params.get('key') || params.get('streamKey') || '';
  const paramTheme = params.get('theme');
  const paramTitle = params.get('title');
  const paramShowStreak = params.get('showStreak');
  const paramShowHistory = params.get('showHistory');
  const paramOpacity = params.get('opacity');

  // DOM Elements
  const scoreWidget = document.getElementById('scoreWidget');
  const statusDot = document.getElementById('statusDot');
  const scoreTitle = document.getElementById('scoreTitle');
  const streakBadge = document.getElementById('streakBadge');
  const streakIcon = document.getElementById('streakIcon');
  const streakVal = document.getElementById('streakVal');
  const winBlock = document.getElementById('winBlock');
  const loseBlock = document.getElementById('loseBlock');
  const labelWin = document.getElementById('labelWin');
  const labelLose = document.getElementById('labelLose');
  const valWin = document.getElementById('valWin');
  const valLose = document.getElementById('valLose');
  const scoreHistory = document.getElementById('scoreHistory');
  const historyBreadcrumbs = document.getElementById('historyBreadcrumbs');

  // Local State
  let currentWins = 0;
  let currentLosses = 0;
  let currentStreak = 0;
  let ws = null;
  let reconnectTimer = null;
  let audioCtx = null;

  // ponytail: Web Audio API sound fx without external audio files
  function playSound(type) {
    try {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        audioCtx = new AudioContext();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.25);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }

  function applyScoreData(score, action = null) {
    if (!score) return;

    const newWins = typeof score.wins === 'number' ? score.wins : 0;
    const newLosses = typeof score.losses === 'number' ? score.losses : 0;
    const newStreak = typeof score.streak === 'number' ? score.streak : 0;

    // Trigger bump animation and sound
    if (action === 'win' || (action === null && newWins > currentWins)) {
      if (winBlock) {
        winBlock.classList.remove('bump-win');
        void winBlock.offsetWidth; // Reflow
        winBlock.classList.add('bump-win');
      }
      if (score.soundAlert) playSound('win');
    } else if (action === 'lose' || (action === null && newLosses > currentLosses)) {
      if (loseBlock) {
        loseBlock.classList.remove('bump-lose');
        void loseBlock.offsetWidth; // Reflow
        loseBlock.classList.add('bump-lose');
      }
      if (score.soundAlert) playSound('lose');
    }

    currentWins = newWins;
    currentLosses = newLosses;
    currentStreak = newStreak;

    // Update Text Content
    if (valWin) valWin.textContent = currentWins;
    if (valLose) valLose.textContent = currentLosses;
    if (labelWin) labelWin.textContent = score.labelWin || 'WIN';
    if (labelLose) labelLose.textContent = score.labelLoss || 'LOSE';
    if (scoreTitle) scoreTitle.textContent = paramTitle || score.title || 'MATCH SCORE';

    // Theme Class & Background Alpha (keeps text 100% solid, only background becomes transparent)
    const theme = paramTheme || score.theme || 'neon';
    if (scoreWidget) {
      scoreWidget.className = `score-widget theme-${theme}`;
      const rawOpacity = paramOpacity !== null ? parseFloat(paramOpacity) : (typeof score.opacity === 'number' ? score.opacity : 100);
      const safeOpacity = Math.max(0, Math.min(100, isNaN(rawOpacity) ? 100 : rawOpacity));
      const alpha = (safeOpacity / 100).toFixed(2);
      scoreWidget.style.setProperty('--bg-alpha', alpha);
      scoreWidget.style.opacity = '1';
    }

    // Streak Badge
    const showStreak = paramShowStreak !== null ? paramShowStreak === '1' || paramShowStreak === 'true' : (score.showStreak !== false);
    if (streakBadge) {
      if (showStreak && currentStreak !== 0) {
        streakBadge.style.display = 'inline-flex';
        streakBadge.className = 'streak-badge';
        if (currentStreak > 0) {
          streakBadge.classList.add('streak-win');
          if (streakIcon) streakIcon.textContent = '🔥';
          if (streakVal) streakVal.textContent = `${currentStreak} WIN STREAK`;
        } else {
          streakBadge.classList.add('streak-loss');
          if (streakIcon) streakIcon.textContent = '❄️';
          if (streakVal) streakVal.textContent = `${Math.abs(currentStreak)} LOSS STREAK`;
        }
      } else {
        streakBadge.style.display = 'none';
      }
    }

    // Match History Breadcrumbs
    const showHistory = paramShowHistory !== null ? paramShowHistory === '1' || paramShowHistory === 'true' : (score.showHistory !== false);
    const historyList = Array.isArray(score.history) ? score.history : [];
    if (scoreHistory && historyBreadcrumbs) {
      if (showHistory && historyList.length > 0) {
        scoreHistory.style.display = 'flex';
        historyBreadcrumbs.innerHTML = '';
        historyList.forEach((item, index) => {
          const pill = document.createElement('span');
          const isWin = item === 'W' || item === 'w';
          pill.className = `breadcrumb-pill ${isWin ? 'pill-w' : 'pill-l'}`;
          if (index === historyList.length - 1) {
            pill.classList.add('pill-latest');
          }
          pill.textContent = isWin ? 'W' : 'L';
          pill.title = isWin ? 'Victory' : 'Defeat';
          historyBreadcrumbs.appendChild(pill);
        });
      } else {
        scoreHistory.style.display = 'none';
      }
    }
  }

  // WebSocket Connection
  function connectWebSocket() {
    if (reconnectTimer) clearTimeout(reconnectTimer);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(wsUrl);

    ws.onopen = function () {
      if (statusDot) {
        statusDot.classList.remove('offline');
        statusDot.classList.add('online');
      }
      // Subscribe to score events
      ws.send(JSON.stringify({
        type: 'subscribe_score',
        userId: userId,
        key: streamKey
      }));
    };

    ws.onmessage = function (event) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'score_init' && msg.data) {
          applyScoreData(msg.data.score);
        } else if (msg.type === 'score_update' && msg.data) {
          applyScoreData(msg.data.score, msg.action);
        }
      } catch (err) {
        console.error('[Score Overlay] WS Parse Error:', err);
      }
    };

    ws.onclose = function () {
      if (statusDot) {
        statusDot.classList.remove('online');
        statusDot.classList.add('offline');
      }
      reconnectTimer = setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = function () {
      if (ws) ws.close();
    };
  }

  // Fallback initial REST Fetch
  async function fetchInitialScore() {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/score`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.score) {
          applyScoreData(json.score);
        }
      }
    } catch (e) {
      console.warn('[Score Overlay] REST fetch error:', e);
    }
  }

  // OBS Browser Source Interaction Hotkey Handler
  window.addEventListener('keydown', function (e) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    let action = null;
    if (e.key === '+' || e.key === '=' || e.key === 'w' || e.key === 'W') {
      action = 'win';
    } else if (e.key === '-' || e.key === '_' || e.key === 'l' || e.key === 'L') {
      action = 'lose';
    } else if (e.key === 'r' || e.key === 'R') {
      action = 'reset';
    }

    if (action) {
      ws.send(JSON.stringify({
        type: 'score_action',
        userId: userId,
        key: streamKey,
        action: action
      }));
    }
  });

  // Start
  fetchInitialScore();
  connectWebSocket();
})();

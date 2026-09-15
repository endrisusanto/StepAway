// StepAway Single User Overlay Logic
(() => {
  const params = new URLSearchParams(window.location.search);
  const userId = params.get('user') || 'streamer';
  const isTest = params.get('test') === 'true';

  const widgetEl = document.getElementById('stepWidget');
  const userNameEl = document.getElementById('userName');
  const activityTagEl = document.getElementById('activityTag');
  const statusDotEl = document.getElementById('statusDot');
  const currentStepValEl = document.getElementById('currentStepVal');
  const targetValEl = document.getElementById('targetVal');
  const progressFillEl = document.getElementById('progressFill');
  const percentDisplayEl = document.getElementById('percentDisplay');
  const particlesLayerEl = document.getElementById('particlesLayer');
  const milestoneBannerEl = document.getElementById('milestoneBanner');
  const milestoneValueEl = document.getElementById('milestoneValue');
  const hrChipEl = document.getElementById('hrChip');
  const hrChipValEl = document.getElementById('hrChipVal');

  let currentSteps = 0;
  let targetSteps = 5000;
  let ws = null;

  function applyActivityStatus(status) {
    const s = (status || 'IDLE').toUpperCase();
    activityTagEl.className = 'activity-badge';

    if (s === 'RUNNING') {
      activityTagEl.textContent = '🏃 RUNNING';
      activityTagEl.classList.add('activity-running');
    } else if (s === 'WALKING') {
      activityTagEl.textContent = '🚶 WALKING';
      activityTagEl.classList.add('activity-walking');
    } else {
      activityTagEl.textContent = '🧘 IDLE';
      activityTagEl.classList.add('activity-idle');
    }
  }

  function spawnStepParticle(delta) {
    if (delta <= 0) return;
    const pop = document.createElement('div');
    pop.className = 'step-float-pop';
    pop.textContent = `+${delta}`;
    
    const randomX = Math.floor(Math.random() * 60) - 20;
    pop.style.left = `${100 + randomX}px`;
    pop.style.top = '10px';

    particlesLayerEl.appendChild(pop);
    setTimeout(() => pop.remove(), 1100);
  }

  function triggerPulse() {
    progressFillEl.classList.remove('pulse-active');
    void progressFillEl.offsetWidth;
    progressFillEl.classList.add('pulse-active');
  }

  function triggerMilestoneCelebration(milestone) {
    milestoneValueEl.textContent = `${milestone.toLocaleString()} STEPS!`;
    milestoneBannerEl.classList.add('show');
    
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}

    setTimeout(() => {
      milestoneBannerEl.classList.remove('show');
    }, 3200);
  }

  function updateUI(data, delta = 0) {
    userNameEl.textContent = data.name || data.userId || userId;
    currentSteps = data.currentSteps || 0;
    targetSteps = data.targetSteps || 5000;

    currentStepValEl.textContent = currentSteps.toLocaleString();
    targetValEl.textContent = targetSteps.toLocaleString();

    const percentage = Math.min(100, Math.round((currentSteps / Math.max(1, targetSteps)) * 100));
    progressFillEl.style.width = `${percentage}%`;
    percentDisplayEl.textContent = `${percentage}%`;

    applyActivityStatus(data.activityStatus || (delta > 3 ? 'RUNNING' : (delta > 0 ? 'WALKING' : 'IDLE')));

    if (data.bpm !== undefined && data.bpm > 0) {
      if (hrChipEl) {
        hrChipEl.style.display = 'inline-flex';
        if (hrChipValEl) hrChipValEl.textContent = data.bpm;
        const beatSec = Math.max(0.28, Math.min(1.5, 60 / data.bpm)).toFixed(2);
        hrChipEl.style.setProperty('--chip-beat', `${beatSec}s`);
      }
    } else if (params.get('show_hr') === 'true' && hrChipEl) {
      hrChipEl.style.display = 'inline-flex';
    }

    if (delta > 0) {
      spawnStepParticle(delta);
      triggerPulse();
    }

    if (data.milestone) {
      triggerMilestoneCelebration(data.milestone);
    }
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      statusDotEl.classList.add('online');
      ws.send(JSON.stringify({ type: 'subscribe', userId }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init' && msg.data) {
          updateUI(msg.data, 0);
        } else if (msg.type === 'step_update' && msg.data && msg.data.userId === userId) {
          updateUI(msg.data, msg.data.delta || 0);
        } else if (msg.type === 'heartrate_update' && msg.data && msg.data.userId === userId) {
          if (hrChipEl) {
            hrChipEl.style.display = 'inline-flex';
            if (hrChipValEl) hrChipValEl.textContent = msg.data.bpm;
            const beatSec = Math.max(0.28, Math.min(1.5, 60 / msg.data.bpm)).toFixed(2);
            hrChipEl.style.setProperty('--chip-beat', `${beatSec}s`);
          }
        }
      } catch (err) {
        console.error('[WS Data Error]', err);
      }
    };

    ws.onclose = () => {
      statusDotEl.classList.remove('online');
      setTimeout(connectWebSocket, 2500);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  if (isTest) {
    statusDotEl.classList.add('online');
    let mockSteps = 980;
    updateUI({ userId: 'Streamer (Test)', currentSteps: mockSteps, targetSteps: 2000, activityStatus: 'WALKING' });

    let count = 0;
    setInterval(() => {
      count++;
      const isFast = count % 4 === 0;
      const delta = isFast ? 8 : 2;
      mockSteps += delta;
      const reachedMilestone = mockSteps >= 1000 && mockSteps < 1010 ? 1000 : null;
      updateUI({
        userId: 'Streamer (Test)',
        currentSteps: mockSteps,
        targetSteps: 2000,
        activityStatus: isFast ? 'RUNNING' : 'WALKING',
        milestone: reachedMilestone
      }, delta);
    }, 1600);
  } else {
    connectWebSocket();
  }
})();

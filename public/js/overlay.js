// StepAway Single User Overlay Logic
(() => {
  const params = new URLSearchParams(window.location.search);
  const streamKey = params.get('key') || params.get('streamKey');
  const userParam = params.get('user');
  const initialUserKey = streamKey || userParam || 'streamer';
  let resolvedUserId = initialUserKey;
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

  // Donation Alert Elements
  const donationBannerEl = document.getElementById('donationBanner');
  const donationAmountEl = document.getElementById('donationAmount');
  const donationSenderEl = document.getElementById('donationSender');
  const donationStepsBadgeEl = document.getElementById('donationStepsBadge');
  const donationMsgEl = document.getElementById('donationMsg');

  let currentSteps = 0;
  let targetSteps = 5000;
  let ws = null;
  let donationTimer = null;

  // Make widget draggable on canvas / OBS preview
  if (typeof makeDraggable === 'function' && widgetEl) {
    makeDraggable(widgetEl);
  }

  function applyActivityStatus(status) {
    const s = (status || 'IDLE').toUpperCase();
    activityTagEl.className = 'activity-badge';

    if (s === 'RUNNING') {
      activityTagEl.textContent = 'RUNNING';
      activityTagEl.classList.add('activity-running');
    } else if (s === 'WALKING') {
      activityTagEl.textContent = 'WALKING';
      activityTagEl.classList.add('activity-walking');
    } else {
      activityTagEl.textContent = 'IDLE';
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

    if (currentStepValEl) {
      currentStepValEl.classList.remove('step-bump');
      void currentStepValEl.offsetWidth;
      currentStepValEl.classList.add('step-bump');
    }
  }

  function triggerPulse() {
    progressFillEl.classList.remove('pulse-active');
    void progressFillEl.offsetWidth;
    progressFillEl.classList.add('pulse-active');
  }

  function triggerMilestoneCelebration(milestone) {
    milestoneValueEl.textContent = `${milestone.toLocaleString()} STEPS!`;
    milestoneBannerEl.classList.add('show');
    if (widgetEl) widgetEl.classList.add('milestone-active');
    
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
      if (widgetEl) widgetEl.classList.remove('milestone-active');
    }, 3200);
  }

  function triggerDonationAlert(donation) {
    if (!donationBannerEl || !donation) return;

    if (donationAmountEl) donationAmountEl.textContent = donation.formattedAmount || `Rp ${Number(donation.amount || 0).toLocaleString('id-ID')}`;
    if (donationSenderEl) donationSenderEl.textContent = donation.donatorName || 'Donatur Anonim';
    
    const label = donation.mode === 'direct_step' ? 'Steps' : 'Goal';
    if (donationStepsBadgeEl) donationStepsBadgeEl.textContent = `+${Number(donation.stepsAdded || 0).toLocaleString()} ${label}`;
    
    if (donationMsgEl) {
      if (donation.message && donation.message.trim()) {
        donationMsgEl.textContent = `"${donation.message.trim()}"`;
        donationMsgEl.style.display = 'block';
      } else {
        donationMsgEl.style.display = 'none';
      }
    }

    donationBannerEl.classList.add('show');

    // Subtle synthesizer chime
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const freqs = [587.33, 739.99, 880.00]; // D5, F#5, A5 major chord
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.08 + 0.45);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + idx * 0.08);
        osc.stop(audioCtx.currentTime + idx * 0.08 + 0.45);
      });
    } catch (e) {}

    if (donationTimer) clearTimeout(donationTimer);
    donationTimer = setTimeout(() => {
      donationBannerEl.classList.remove('show');
    }, 5500);
  }

  function updateUI(data, delta = 0) {
    if (data && data.userId) {
      resolvedUserId = data.userId;
    }
    userNameEl.textContent = data.name || data.userId || resolvedUserId;
    currentSteps = data.currentSteps || 0;
    targetSteps = data.targetSteps || 5000;

    currentStepValEl.textContent = currentSteps.toLocaleString();
    targetValEl.textContent = targetSteps.toLocaleString();

    const percentage = Math.min(100, Math.round((currentSteps / Math.max(1, targetSteps)) * 100));
    progressFillEl.style.width = `${percentage}%`;
    percentDisplayEl.textContent = `${percentage}%`;

    applyActivityStatus(data.activityStatus || (delta > 3 ? 'RUNNING' : (delta > 0 ? 'WALKING' : 'IDLE')));

    if (data.bpm !== undefined) {
      if (hrChipEl) {
        if (data.bpm > 0) {
          hrChipEl.style.display = 'inline-flex';
          if (hrChipValEl) hrChipValEl.textContent = data.bpm;
          const beatSec = Math.max(0.28, Math.min(1.5, 60 / data.bpm)).toFixed(2);
          hrChipEl.style.setProperty('--chip-beat', `${beatSec}s`);
        } else {
          if (params.get('show_hr') === 'true') {
            hrChipEl.style.display = 'inline-flex';
            if (hrChipValEl) hrChipValEl.textContent = '-';
            hrChipEl.style.setProperty('--chip-beat', '0s');
          } else {
            hrChipEl.style.display = 'none';
          }
        }
      }
    } else if (params.get('show_hr') === 'true' && hrChipEl) {
      hrChipEl.style.display = 'inline-flex';
      if (hrChipValEl) hrChipValEl.textContent = '-';
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
      ws.send(JSON.stringify({ type: 'subscribe', userId: initialUserKey, key: streamKey }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'init' && msg.data) {
          updateUI(msg.data, 0);
        } else if (msg.type === 'step_update' && (msg.userId === resolvedUserId || msg.userId === initialUserKey)) {
          updateUI(msg.data, msg.delta || 0);
        } else if (msg.type === 'donation_alert' && (msg.userId === resolvedUserId || msg.userId === initialUserKey)) {
          if (msg.data) {
            updateUI(msg.data, 0);
            if (msg.data.donation) {
              triggerDonationAlert(msg.data.donation);
            }
          }
        }
      } catch (err) {
        console.error('[WS Parse Error]', err);
      }
    };

    ws.onclose = () => {
      statusDotEl.classList.remove('online');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
      statusDotEl.classList.remove('online');
    };
  }

  // Initial Fetch & Connect
  function fetchStats() {
    fetch(`/api/users/${encodeURIComponent(initialUserKey)}`)
      .then(res => res.json())
      .then(json => {
        if (json.success && json.user) {
          updateUI(json.user, 0);
          if (statusDotEl) statusDotEl.classList.add('online');
        }
      })
      .catch(() => {});
  }

  fetchStats();
  connectWebSocket();

  // ponytail: periodic poll fallback (every 3s) if WebSocket is not open
  setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      fetchStats();
    }
  }, 3000);

  // Simulated test loop for Browser Preview test mode
  if (isTest) {
    let mockSteps = 1200;
    setInterval(() => {
      const stepGain = Math.floor(Math.random() * 4) + 1;
      mockSteps += stepGain;
      updateUI({
        userId,
        name: 'Streamer [DEMO]',
        currentSteps: mockSteps,
        targetSteps: 5000,
        bpm: Math.floor(Math.random() * 40) + 110,
        activityStatus: stepGain > 2 ? 'RUNNING' : 'WALKING'
      }, stepGain);
    }, 2500);
  }
})();

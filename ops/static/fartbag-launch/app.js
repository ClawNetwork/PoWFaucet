const COUNTDOWN_TARGET = new Date('2026-07-01T00:00:00Z');
const FAUCET_BASE_URL = 'https://faucet.fartbag.fun';
const FAUCET_IFRAME_ORIGIN = 'https://faucet.fartbag.fun';
const FAUCET_API_BASE = '/faucet-api';
const FAUCET_CLIENT_VERSION = '2.4.2';
const SIMPLE_ACCOUNT_FACTORY = '0x02e10A72Da4B211D432dC082f9440fe4ad383e07';
const RPC_CANDIDATES = ['https://ora0.fartbag.fun/'];
const GET_ADDRESS_SELECTOR = '0x8cb84e18';
const SIGNUP_EMAIL_KEY = 'claw_signed_up_email';
const SIGNUP_STATE_KEY = 'claw_signed_up_state_v2';
const CLIENT_IP_CACHE_KEY = 'claw_client_ip_v1';
const LAST_SESSION_MAP_KEY = 'claw_last_session_by_wallet_v1';
const AUDIO_OPT_IN_KEY = 'claw_tracker_audio_opt_in_v1';
const LANDING_VERSION = '0.2.0';
const LANDING_COMMIT = 'pending';
const BUBBLE_IMAGES = ['./reef_bubble1.png', './reef_bubble2.png'];
const MOBILE_BREAKPOINT_QUERY = '(max-width: 860px)';
const BUBBLE_SPAWN_MIN_MS = 2000;
const BUBBLE_SPAWN_MAX_MS = 4000;
const TRACKER_BUBBLE_SPAWN_MIN_MS = 450;
const TRACKER_BUBBLE_SPAWN_MAX_MS = 1200;
const MOBILE_MAX_VISIBLE_BUBBLES = 1;
const DESKTOP_MIN_VISIBLE_BUBBLES = 2;
const DESKTOP_MAX_VISIBLE_BUBBLES = 7;
const TRACKER_MOBILE_MAX_VISIBLE_BUBBLES = 4;
const TRACKER_DESKTOP_MIN_VISIBLE_BUBBLES = 12;
const TRACKER_DESKTOP_MAX_VISIBLE_BUBBLES = 24;
const LOBSTER_SWIM_START_DELAY_MS = 5000;
const TRACKER_POLL_MS = 5000;
const WEI_PER_CLAW = 1000000000000000000n;

const el = {
  days: document.getElementById('days'),
  hours: document.getElementById('hours'),
  minutes: document.getElementById('minutes'),
  seconds: document.getElementById('seconds'),
  subscribeForm: document.getElementById('subscribe-form'),
  subscribeEmail: document.getElementById('subscribe-email'),
  subscribeIpAddress: document.getElementById('subscribe-ip-address'),
  subscribeStatus: document.getElementById('subscribe-status'),
  faucetForm: document.getElementById('faucet-form'),
  walletInput: document.getElementById('wallet-input'),
  walletPreview: document.getElementById('wallet-preview'),
  ownerWallet: document.getElementById('owner-wallet'),
  smartWallet: document.getElementById('smart-wallet'),
  faucetStatus: document.getElementById('faucet-status'),
  startButton: document.getElementById('start-clawing'),
  modal: document.getElementById('mine-modal'),
  modalClose: document.getElementById('modal-close'),
  mineFrame: document.getElementById('mine-frame'),
  signupModal: document.getElementById('signup-modal'),
  signupModalClose: document.getElementById('signup-modal-close'),
  signupModalAction: document.getElementById('signup-modal-action'),
  validationModalTitle: document.getElementById('validation-modal-title'),
  validationModalBody: document.getElementById('validation-modal-body'),
  buildMeta: document.getElementById('build-meta'),
  buildMetaInline: document.getElementById('build-meta-inline'),
  reefBubbles: document.getElementById('reef-bubbles'),
  headerLobster: document.getElementById('header-lobster'),
  swimLobster: document.getElementById('swim-lobster'),
  trackerView: document.getElementById('claw-tracker-view'),
  trackerWallet: document.getElementById('tracker-wallet'),
  trackerBalance: document.getElementById('tracker-balance'),
  trackerStatus: document.getElementById('tracker-status'),
  trackerSession: document.getElementById('tracker-session'),
  trackerAudioToggle: document.getElementById('tracker-audio-toggle'),
};

let deriveTimer = null;
let signedUpEmail = '';
let signedUpEOA = '';
let resolvedClientIp = '';
let validationFocusTarget = null;
let bubbleSpawnTimer = null;
let bubbleMediaQuery = null;
const activeBubbles = new Set();
let lobsterMoveTimer = null;
let lobsterDirection = 1;
let lobsterCurrentX = 140;
let lobsterCurrentY = 120;
let trackerMode = false;
let trackerWallet = '';
let trackerSessionId = '';
let trackerSessionLocked = false;
let trackerBalanceWei = 0n;
let trackerMinClaimWei = 0n;
let trackerMaxClaimWei = 0n;
let trackerPollTimer = null;
let trackerAudioCtx = null;
let trackerAudioMaster = null;
let trackerAudioCompressor = null;
let trackerAudioEnabled = false;
let trackerMusicTimer = null;
let trackerAudioHooked = false;
const trackerSwimmers = [];
const trackerSwimmerTimers = new Map();

init();

function init() {
  const trackerRoute = resolveTrackerRoute();
  if (trackerRoute) {
    enterTrackerMode(trackerRoute);
  } else {
    startCountdown();
  }
  initReefBubbles();
  initLobsterSwim();
  initTrackerLobsterSwarm();
  loadSignupState();
  hydrateClientIp();
  renderBuildMeta();
  refreshBuildMeta().catch(() => {
    // fallback already rendered
  });

  el.subscribeForm?.addEventListener('submit', onSubscribe);
  el.subscribeEmail?.addEventListener('input', onSubscribeEmailInput);
  el.walletInput?.addEventListener('input', onWalletInput);
  el.faucetForm?.addEventListener('submit', onStartClawing);

  el.modalClose?.addEventListener('click', closeModal);
  el.modal?.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeModal === 'true') {
      closeModal();
    }
  });
  el.signupModalClose?.addEventListener('click', closeSignupModal);
  el.signupModalAction?.addEventListener('click', () => {
    closeSignupModal();
    if (validationFocusTarget === 'email') {
      el.subscribeEmail?.focus();
    } else if (validationFocusTarget === 'wallet') {
      el.walletInput?.focus();
    }
  });
  el.signupModal?.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closeSignup === 'true') {
      closeSignupModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
      closeSignupModal();
    }
  });

  el.trackerAudioToggle?.addEventListener('click', () => {
    if (trackerAudioEnabled) {
      disableTrackerAudio(true);
      return;
    }
    enableTrackerAudio(true).catch(() => {
      if (el.trackerAudioToggle) {
        el.trackerAudioToggle.textContent = 'Audio blocked, tap again';
      }
    });
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== FAUCET_IFRAME_ORIGIN) return;
    if (event?.data?.type === 'powfaucet:return-to-start') {
      closeModal();
      setStatus(el.faucetStatus, 'Back on the reef.', false);
    }
  });
}

function resolveTrackerRoute() {
  let url;
  try {
    url = new URL(window.location.href);
  } catch {
    return null;
  }

  let rawWallet = '';
  const pathMatch = decodeURIComponent(url.pathname || '').match(/\/claw_id=([^/?#]+)/i);
  if (pathMatch && pathMatch[1]) {
    rawWallet = pathMatch[1].trim();
  }
  if (!rawWallet) {
    rawWallet = (url.searchParams.get('claw_id') || '').trim();
  }
  if (!rawWallet) {
    return null;
  }

  const normalizedWallet = normalizeAddress(rawWallet);
  if (!normalizedWallet) {
    return null;
  }

  const sidRaw = (url.searchParams.get('sid') || '').trim();
  const sid =
    sidRaw && /^[0-9a-zA-Z-]{8,}$/.test(sidRaw)
      ? sidRaw
      : '';

  return {
    wallet: normalizedWallet,
    sid,
  };
}

function enterTrackerMode(route) {
  trackerMode = true;
  trackerWallet = route.wallet;
  trackerSessionId = route.sid || getStoredSessionId(route.wallet) || '';
  trackerSessionLocked = Boolean(route.sid);
  document.body.classList.add('tracker-mode');
  if (el.trackerView) {
    el.trackerView.hidden = false;
  }
  if (el.trackerWallet) {
    el.trackerWallet.textContent = trackerWallet;
  }
  if (el.trackerBalance) {
    el.trackerBalance.textContent = '0 CLAW';
  }
  if (el.trackerStatus) {
    el.trackerStatus.textContent = 'minimum not reached';
  }
  if (el.trackerSession) {
    el.trackerSession.textContent = trackerSessionId
      ? `Session: ${trackerSessionId}`
      : 'Session: waiting...';
  }

  initTrackerAudio();
  startTrackerPolling();
}

function startCountdown() {
  const tick = () => {
    const now = new Date();
    let delta = Math.floor((COUNTDOWN_TARGET.getTime() - now.getTime()) / 1000);
    if (delta < 0) delta = 0;

    const days = Math.floor(delta / (24 * 60 * 60));
    delta -= days * 24 * 60 * 60;
    const hours = Math.floor(delta / (60 * 60));
    delta -= hours * 60 * 60;
    const minutes = Math.floor(delta / 60);
    const seconds = delta - minutes * 60;

    setText(el.days, pad(days));
    setText(el.hours, pad(hours));
    setText(el.minutes, pad(minutes));
    setText(el.seconds, pad(seconds));
  };

  tick();
  setInterval(tick, 1000);
}

function initReefBubbles() {
  if (!el.reefBubbles) return;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  bubbleMediaQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_BREAKPOINT_QUERY)
      : null;

  if (bubbleMediaQuery) {
    const onMediaChange = () => {
      enforceBubbleLimits();
      seedBubbles();
    };

    if (typeof bubbleMediaQuery.addEventListener === 'function') {
      bubbleMediaQuery.addEventListener('change', onMediaChange);
    } else if (typeof bubbleMediaQuery.addListener === 'function') {
      bubbleMediaQuery.addListener(onMediaChange);
    }
  }

  seedBubbles();
  scheduleNextBubbleTick();
}

function initLobsterSwim() {
  if (!el.swimLobster || !el.headerLobster) return;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  window.setTimeout(() => {
    if (!el.swimLobster || !el.headerLobster) return;

    const from = el.headerLobster.getBoundingClientRect();
    lobsterCurrentX = Math.max(56, Math.round(from.left + from.width / 2));
    lobsterCurrentY = Math.max(120, Math.round(from.top + from.height / 2));

    el.headerLobster.style.opacity = '0';
    el.swimLobster.classList.add('active');
    el.swimLobster.style.left = `${lobsterCurrentX}px`;
    el.swimLobster.style.top = `${lobsterCurrentY}px`;
    el.swimLobster.style.transform = `translate(-50%, -50%) scaleX(${lobsterDirection})`;

    moveLobster();

    window.addEventListener('resize', () => {
      lobsterCurrentX = clamp(
        lobsterCurrentX,
        52,
        Math.max(52, window.innerWidth - 52),
      );
      lobsterCurrentY = clamp(
        lobsterCurrentY,
        120,
        Math.max(120, window.innerHeight - 132),
      );
      if (el.swimLobster) {
        el.swimLobster.style.left = `${lobsterCurrentX}px`;
        el.swimLobster.style.top = `${lobsterCurrentY}px`;
      }
    });
  }, LOBSTER_SWIM_START_DELAY_MS);
}

function moveLobster() {
  if (!el.swimLobster) return;

  const minX = 52;
  const maxX = Math.max(minX + 1, window.innerWidth - 52);
  const minY = 120;
  const maxY = Math.max(minY + 1, window.innerHeight - 138);

  const targetX = randomInt(minX, maxX);
  const targetY = randomInt(minY, maxY);
  const headingRight = targetX >= lobsterCurrentX;
  let nextDirection = headingRight ? 1 : -1;

  // Occasionally turn around for playful movement.
  if (Math.random() < 0.22) {
    nextDirection *= -1;
  }

  lobsterDirection = nextDirection;
  const durationMs = randomInt(2600, 6200);

  el.swimLobster.style.transitionDuration = `${durationMs}ms, ${durationMs}ms, 480ms, 420ms`;
  el.swimLobster.style.transform = `translate(-50%, -50%) scaleX(${lobsterDirection})`;
  el.swimLobster.style.left = `${targetX}px`;
  el.swimLobster.style.top = `${targetY}px`;

  lobsterCurrentX = targetX;
  lobsterCurrentY = targetY;

  if (lobsterMoveTimer) {
    clearTimeout(lobsterMoveTimer);
  }
  lobsterMoveTimer = window.setTimeout(
    moveLobster,
    durationMs + randomInt(400, 1600),
  );
}

function isMobileBubbleMode() {
  return bubbleMediaQuery ? bubbleMediaQuery.matches : window.innerWidth <= 860;
}

function getBubbleSpawnMinMs() {
  return trackerMode ? TRACKER_BUBBLE_SPAWN_MIN_MS : BUBBLE_SPAWN_MIN_MS;
}

function getBubbleSpawnMaxMs() {
  return trackerMode ? TRACKER_BUBBLE_SPAWN_MAX_MS : BUBBLE_SPAWN_MAX_MS;
}

function getMobileMaxVisibleBubbles() {
  return trackerMode ? TRACKER_MOBILE_MAX_VISIBLE_BUBBLES : MOBILE_MAX_VISIBLE_BUBBLES;
}

function getDesktopMinVisibleBubbles() {
  return trackerMode ? TRACKER_DESKTOP_MIN_VISIBLE_BUBBLES : DESKTOP_MIN_VISIBLE_BUBBLES;
}

function getDesktopMaxVisibleBubbles() {
  return trackerMode ? TRACKER_DESKTOP_MAX_VISIBLE_BUBBLES : DESKTOP_MAX_VISIBLE_BUBBLES;
}

function seedBubbles() {
  const desired = isMobileBubbleMode()
    ? getMobileMaxVisibleBubbles()
    : getDesktopMinVisibleBubbles();
  while (activeBubbles.size < desired) {
    spawnBubble();
  }
}

function scheduleNextBubbleTick() {
  if (bubbleSpawnTimer) {
    clearTimeout(bubbleSpawnTimer);
  }
  bubbleSpawnTimer = window.setTimeout(() => {
    runBubbleTick();
    scheduleNextBubbleTick();
  }, randomInt(getBubbleSpawnMinMs(), getBubbleSpawnMaxMs()));
}

function runBubbleTick() {
  if (!el.reefBubbles) return;

  if (isMobileBubbleMode()) {
    if (activeBubbles.size < getMobileMaxVisibleBubbles()) {
      spawnBubble();
    } else if (activeBubbles.size > getMobileMaxVisibleBubbles()) {
      enforceBubbleLimits();
    }
    return;
  }

  maintainBubbleFloor();

  const targetVisible = randomInt(
    getDesktopMinVisibleBubbles(),
    getDesktopMaxVisibleBubbles(),
  );

  if (activeBubbles.size < targetVisible) {
    const deficit = targetVisible - activeBubbles.size;
    const spawnCount = Math.min(
      deficit,
      randomInt(1, deficit > 3 ? 4 : 3),
    );
    for (let i = 0; i < spawnCount; i += 1) {
      spawnBubble();
    }
  } else if (activeBubbles.size > getDesktopMaxVisibleBubbles()) {
    enforceBubbleLimits();
  }
}

function maintainBubbleFloor() {
  if (isMobileBubbleMode()) return;
  while (activeBubbles.size < getDesktopMinVisibleBubbles()) {
    spawnBubble();
  }
}

function enforceBubbleLimits() {
  const maxAllowed = isMobileBubbleMode()
    ? getMobileMaxVisibleBubbles()
    : getDesktopMaxVisibleBubbles();
  if (activeBubbles.size <= maxAllowed) return;
  const overflow = activeBubbles.size - maxAllowed;
  const bubbles = [...activeBubbles];
  for (let i = 0; i < overflow; i += 1) {
    const bubble = bubbles[i];
    if (!bubble) continue;
    activeBubbles.delete(bubble);
    bubble.remove();
  }
}

function spawnBubble() {
  if (!el.reefBubbles) return;
  if (isMobileBubbleMode() && activeBubbles.size >= getMobileMaxVisibleBubbles()) {
    return;
  }
  if (!isMobileBubbleMode() && activeBubbles.size >= getDesktopMaxVisibleBubbles()) {
    return;
  }

  const bubble = document.createElement('img');
  bubble.className = 'reef-bubble';
  bubble.alt = '';
  const bubbleType = randomInt(0, BUBBLE_IMAGES.length - 1);
  bubble.src = BUBBLE_IMAGES[bubbleType];
  bubble.decoding = 'async';

  const mobile = isMobileBubbleMode();
  const size = trackerMode
    ? (mobile ? randomInt(92, 174) : randomInt(120, 260))
    : (mobile ? randomInt(60, 94) : randomInt(72, 136));
  const left = randomInt(8, 92);
  const drift = trackerMode ? randomInt(-95, 95) : randomInt(-60, 60);
  const maxRise = Math.max(220, window.innerHeight - 80);
  const rise = trackerMode
    ? randomInt(Math.floor(maxRise * 0.82), Math.floor(maxRise * 1.08))
    : (mobile
      ? randomInt(Math.floor(maxRise * 0.58), Math.floor(maxRise * 0.9))
      : randomInt(Math.floor(maxRise * 0.72), maxRise));
  const baseDurationMs = trackerMode
    ? (mobile ? randomInt(11000, 24000) : randomInt(14500, 34000))
    : (mobile ? randomInt(9000, 16500) : randomInt(12000, 24000));
  const fastLift = Math.random() < (trackerMode ? 0.18 : 0.3);
  const durationMs = fastLift
    ? Math.max(3200, Math.floor(baseDurationMs * (trackerMode ? 0.78 : 0.7)))
    : baseDurationMs;

  bubble.style.left = `${left}%`;
  bubble.style.width = `${size}px`;
  bubble.style.animationDuration = `${durationMs / 1000}s`;
  bubble.style.setProperty('--bubble-drift', `${drift}px`);
  bubble.style.setProperty('--bubble-rise', `${rise}px`);

  const handleDone = () => {
    bubble.removeEventListener('animationend', handleDone);
    activeBubbles.delete(bubble);
    bubble.remove();
    if (!isMobileBubbleMode()) {
      maintainBubbleFloor();
    }
  };

  bubble.addEventListener('animationend', handleDone);
  activeBubbles.add(bubble);
  el.reefBubbles.appendChild(bubble);
  playBubbleBloop(bubbleType);
}

function initTrackerLobsterSwarm() {
  if (!trackerMode) return;
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }

  const count = window.innerWidth <= 860 ? 2 : 4;
  for (let i = 0; i < count; i += 1) {
    const swimmer = document.createElement('img');
    swimmer.className = 'tracker-swimmer';
    swimmer.src = './larry_lobster_logo.png';
    swimmer.alt = '';
    swimmer.decoding = 'async';
    const scale = randomInt(68, 180) / 100;
    swimmer.dataset.scale = String(scale);
    swimmer.dataset.x = String(randomInt(80, Math.max(100, window.innerWidth - 80)));
    swimmer.dataset.y = String(
      randomInt(140, Math.max(180, window.innerHeight - 220)),
    );
    swimmer.dataset.dir = Math.random() > 0.5 ? '1' : '-1';
    document.body.appendChild(swimmer);
    trackerSwimmers.push(swimmer);
    scheduleSwimmerMove(swimmer, 220 + i * 120);
  }
}

function scheduleSwimmerMove(swimmer, delayMs = 0) {
  const timer = window.setTimeout(() => {
    moveTrackerSwimmer(swimmer);
  }, Math.max(0, delayMs));
  trackerSwimmerTimers.set(swimmer, timer);
}

function moveTrackerSwimmer(swimmer) {
  if (!swimmer || !trackerMode) return;
  const minX = 56;
  const maxX = Math.max(minX + 1, window.innerWidth - 56);
  const minY = 120;
  const maxY = Math.max(minY + 1, window.innerHeight - 170);

  const currentX = Number(swimmer.dataset.x || randomInt(minX, maxX));
  const targetX = randomInt(minX, maxX);
  const targetY = randomInt(minY, maxY);
  const scale = Number(swimmer.dataset.scale || 1);
  const headingRight = targetX >= currentX;
  const direction = headingRight ? 1 : -1;
  const durationMs = randomInt(3600, 7800);

  swimmer.dataset.x = String(targetX);
  swimmer.dataset.y = String(targetY);
  swimmer.dataset.dir = String(direction);
  swimmer.style.transitionDuration = `${durationMs}ms, ${durationMs}ms, 420ms`;
  swimmer.style.left = `${targetX}px`;
  swimmer.style.top = `${targetY}px`;
  swimmer.style.transform = `translate(-50%, -50%) scale(${scale}) scaleX(${direction})`;

  scheduleSwimmerMove(swimmer, durationMs + randomInt(260, 1200));
}

function startTrackerPolling() {
  if (!trackerMode || !trackerWallet) return;
  refreshTrackerConfig().catch(() => {
    trackerMinClaimWei = 0n;
    trackerMaxClaimWei = 0n;
  });
  refreshTrackerData().catch(() => {
    // handled by fallback text
  });
  if (trackerPollTimer) {
    clearInterval(trackerPollTimer);
  }
  trackerPollTimer = window.setInterval(() => {
    refreshTrackerData().catch(() => {
      // best-effort updates
    });
  }, TRACKER_POLL_MS);
}

async function refreshTrackerConfig() {
  const response = await fetch(
    `${FAUCET_API_BASE}/getFaucetConfig?cliver=${encodeURIComponent(FAUCET_CLIENT_VERSION)}`,
  );
  if (!response.ok) return;
  const data = await response.json().catch(() => null);
  if (!data || typeof data !== 'object') return;
  trackerMinClaimWei = toBigInt(data.minClaim);
  trackerMaxClaimWei = toBigInt(data.maxClaim);
}

async function refreshTrackerData() {
  if (!trackerMode || !trackerWallet) return;

  let balanceWei = 0n;
  let status = 'unknown';
  let displaySessionId = trackerSessionId;

  if (trackerSessionId && trackerSessionLocked) {
    const response = await fetch(
      `${FAUCET_API_BASE}/getSessionStatus?session=${encodeURIComponent(trackerSessionId)}`,
    );
    if (response.ok) {
      const data = await response.json().catch(() => null);
      if (data && typeof data === 'object') {
        balanceWei = toBigInt(data.balance);
        status = String(data.status || 'unknown');
      }
    }
  } else {
    const response = await fetch(`${FAUCET_API_BASE}/getFaucetStatus`);
    if (response.ok) {
      const data = await response.json().catch(() => null);
      const sessions = Array.isArray(data?.sessions) ? data.sessions : [];
      const latest = getLatestWalletSession(sessions, trackerWallet);
      if (latest) {
        balanceWei = toBigInt(latest.balance);
        status = String(latest.status || 'unknown');
        displaySessionId = String(latest.id || '');
        trackerSessionId = displaySessionId || trackerSessionId;
        if (displaySessionId) {
          storeSessionId(trackerWallet, displaySessionId);
        }
      }
    }
  }

  updateTrackerCounter(balanceWei);
  updateTrackerThresholdLabel(balanceWei);

  if (el.trackerSession) {
    if (displaySessionId) {
      el.trackerSession.textContent = `Session: ${displaySessionId} (${status})`;
    } else {
      el.trackerSession.textContent = 'Session: waiting...';
    }
  }
}

function getLatestWalletSession(sessions, wallet) {
  if (!Array.isArray(sessions) || !wallet) return null;
  const matches = sessions
    .filter((session) => normalizeAddress(String(session?.target || '')) === wallet)
    .sort((a, b) => Number(b?.start || 0) - Number(a?.start || 0));
  return matches.length > 0 ? matches[0] : null;
}

function updateTrackerCounter(nextBalanceWei) {
  const safeNext = nextBalanceWei > 0n ? nextBalanceWei : 0n;
  if (safeNext > trackerBalanceWei) {
    playCrusherSound();
  }
  trackerBalanceWei = safeNext;
  if (el.trackerBalance) {
    el.trackerBalance.textContent = `${formatClawAmount(safeNext)} CLAW`;
  }
}

function updateTrackerThresholdLabel(balanceWei) {
  if (!el.trackerStatus) return;
  if (trackerMaxClaimWei > 0n && balanceWei >= trackerMaxClaimWei) {
    el.trackerStatus.textContent = 'maximum reached. Remind your OpenClaw to collect.';
    return;
  }
  if (trackerMinClaimWei > 0n && balanceWei >= trackerMinClaimWei) {
    el.trackerStatus.textContent = 'minimum reached';
    return;
  }
  el.trackerStatus.textContent = 'minimum not reached';
}

function formatClawAmount(weiValue) {
  const safe = weiValue > 0n ? weiValue : 0n;
  const whole = safe / WEI_PER_CLAW;
  const fraction = safe % WEI_PER_CLAW;
  const wholeText = addCommas(whole.toString());
  let frac = fraction.toString().padStart(18, '0').slice(0, 3);
  frac = frac.replace(/0+$/, '');
  return frac ? `${wholeText}.${frac}` : wholeText;
}

function addCommas(numberText) {
  return numberText.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function toBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return BigInt(Math.floor(value));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^[0-9]+$/.test(trimmed)) {
      try {
        return BigInt(trimmed);
      } catch {
        return 0n;
      }
    }
  }
  return 0n;
}

function storeSessionId(wallet, sessionId) {
  if (!wallet || !sessionId) return;
  const map = safeJsonParseObject(localStorage.getItem(LAST_SESSION_MAP_KEY)) || {};
  map[wallet.toLowerCase()] = String(sessionId);
  localStorage.setItem(LAST_SESSION_MAP_KEY, JSON.stringify(map));
}

function getStoredSessionId(wallet) {
  if (!wallet) return '';
  const map = safeJsonParseObject(localStorage.getItem(LAST_SESSION_MAP_KEY));
  if (!map) return '';
  const sid = map[wallet.toLowerCase()];
  return typeof sid === 'string' ? sid : '';
}

function buildTrackerUrl(wallet, sessionId = '') {
  const base = `${window.location.origin}/claw_id=${wallet}`;
  if (!sessionId) return base;
  return `${base}?sid=${encodeURIComponent(sessionId)}`;
}

function initTrackerAudio() {
  if (!trackerMode || trackerAudioHooked) return;
  trackerAudioHooked = true;

  const unlock = () => {
    if (trackerAudioEnabled || !shouldAutoEnableTrackerAudio()) {
      return;
    }
    enableTrackerAudio(false).catch(() => {
      // retry on next gesture
      trackerAudioEnabled = false;
    });
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });

  const optedIn = shouldAutoEnableTrackerAudio();
  if (optedIn) {
    enableTrackerAudio(false).catch(() => {
      // gesture may still be required
    });
  } else {
    updateTrackerAudioButton(false);
  }
}

async function enableTrackerAudio(fromExplicitClick = false) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  if (!trackerAudioCtx) {
    trackerAudioCtx = new AudioCtx();
    trackerAudioCompressor = trackerAudioCtx.createDynamicsCompressor();
    trackerAudioMaster = trackerAudioCtx.createGain();
    trackerAudioMaster.gain.value = 0.24;
    trackerAudioCompressor.threshold.setValueAtTime(-24, trackerAudioCtx.currentTime);
    trackerAudioCompressor.knee.setValueAtTime(22, trackerAudioCtx.currentTime);
    trackerAudioCompressor.ratio.setValueAtTime(3.2, trackerAudioCtx.currentTime);
    trackerAudioCompressor.attack.setValueAtTime(0.004, trackerAudioCtx.currentTime);
    trackerAudioCompressor.release.setValueAtTime(0.18, trackerAudioCtx.currentTime);
    trackerAudioMaster.connect(trackerAudioCompressor);
    trackerAudioCompressor.connect(trackerAudioCtx.destination);
  }

  if (trackerAudioCtx.state === 'suspended') {
    await trackerAudioCtx.resume();
  }

  trackerAudioEnabled = trackerAudioCtx.state === 'running';
  if (trackerAudioEnabled) {
    startTrackerMusic();
    if (fromExplicitClick || localStorage.getItem(AUDIO_OPT_IN_KEY) === null) {
      localStorage.setItem(AUDIO_OPT_IN_KEY, '1');
    }
    updateTrackerAudioButton(true);
  } else {
    updateTrackerAudioButton(false);
  }
}

function disableTrackerAudio(fromExplicitClick = false) {
  trackerAudioEnabled = false;
  stopTrackerMusic();
  if (trackerAudioCtx && trackerAudioCtx.state === 'running') {
    trackerAudioCtx.suspend().catch(() => {
      // best effort
    });
  }
  if (fromExplicitClick) {
    localStorage.setItem(AUDIO_OPT_IN_KEY, '0');
  }
  updateTrackerAudioButton(false);
}

function shouldAutoEnableTrackerAudio() {
  const optedRaw = localStorage.getItem(AUDIO_OPT_IN_KEY);
  return optedRaw === null ? true : optedRaw === '1';
}

function updateTrackerAudioButton(enabled) {
  if (!el.trackerAudioToggle) return;
  if (enabled) {
    el.trackerAudioToggle.textContent = 'Reef Audio On (tap to mute)';
    el.trackerAudioToggle.classList.add('active');
  } else {
    el.trackerAudioToggle.textContent = 'Enable Reef Audio';
    el.trackerAudioToggle.classList.remove('active');
  }
}

function startTrackerMusic() {
  if (!trackerAudioEnabled || !trackerAudioCtx || !trackerAudioMaster) return;
  if (trackerMusicTimer) return;
  const lead = [
    523.25, 659.25, 783.99, 659.25,
    587.33, 523.25, 493.88, 440.0,
    392.0, 440.0, 493.88, 523.25,
    659.25, 523.25, 440.0, 392.0,
  ];
  const bass = [
    130.81, 146.83, 164.81, 146.83,
    130.81, 123.47, 110.0, 98.0,
  ];
  const sparkle = [1046.5, 987.77, 1174.66, 1318.51];
  let idx = 0;
  trackerMusicTimer = window.setInterval(() => {
    const now = trackerAudioCtx.currentTime;
    const leadFreq = lead[idx % lead.length];
    const bassFreq = bass[idx % bass.length];
    playTone(leadFreq, now, 0.2, 0.084, 'square');
    playTone(bassFreq, now, 0.28, 0.052, 'triangle');
    if (idx % 4 === 2) {
      playTone(leadFreq * 1.5, now + 0.05, 0.12, 0.045, 'sine');
    }
    if (idx % 8 === 0) {
      const sparkleFreq = sparkle[randomInt(0, sparkle.length - 1)];
      playTone(sparkleFreq, now + 0.02, 0.08, 0.032, 'sine');
      playTone(sparkleFreq * 0.5, now + 0.09, 0.08, 0.026, 'sine');
    }
    idx += 1;
  }, 250);
}

function stopTrackerMusic() {
  if (trackerMusicTimer) {
    clearInterval(trackerMusicTimer);
    trackerMusicTimer = null;
  }
}

function playTone(freq, startTime, duration, gainValue, type) {
  if (!trackerAudioCtx || !trackerAudioMaster) return;
  const osc = trackerAudioCtx.createOscillator();
  const gain = trackerAudioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(gainValue, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(trackerAudioMaster);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.04);
}

function playCrusherSound() {
  if (!trackerAudioEnabled || !trackerAudioCtx || !trackerAudioMaster) return;
  const now = trackerAudioCtx.currentTime;

  const bodyOsc = trackerAudioCtx.createOscillator();
  const bodyGain = trackerAudioCtx.createGain();
  bodyOsc.type = 'triangle';
  bodyOsc.frequency.setValueAtTime(640, now);
  bodyOsc.frequency.exponentialRampToValueAtTime(120, now + 0.2);
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.linearRampToValueAtTime(0.46, now + 0.01);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);
  bodyOsc.connect(bodyGain);
  bodyGain.connect(trackerAudioMaster);
  bodyOsc.start(now);
  bodyOsc.stop(now + 0.22);

  const noiseBuffer = trackerAudioCtx.createBuffer(
    1,
    Math.max(1, Math.floor(trackerAudioCtx.sampleRate * 0.2)),
    trackerAudioCtx.sampleRate,
  );
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) {
    noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length);
  }
  const noise = trackerAudioCtx.createBufferSource();
  const noiseFilter = trackerAudioCtx.createBiquadFilter();
  const noiseGain = trackerAudioCtx.createGain();
  noise.buffer = noiseBuffer;
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(1550, now);
  noiseFilter.Q.value = 0.72;
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.linearRampToValueAtTime(0.26, now + 0.012);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(trackerAudioMaster);
  noise.start(now);
  noise.stop(now + 0.21);

  const crack = trackerAudioCtx.createOscillator();
  const crackGain = trackerAudioCtx.createGain();
  crack.type = 'square';
  crack.frequency.setValueAtTime(190, now + 0.04);
  crack.frequency.exponentialRampToValueAtTime(82, now + 0.14);
  crackGain.gain.setValueAtTime(0.0001, now + 0.04);
  crackGain.gain.linearRampToValueAtTime(0.3, now + 0.06);
  crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  crack.connect(crackGain);
  crackGain.connect(trackerAudioMaster);
  crack.start(now + 0.04);
  crack.stop(now + 0.18);
}

function playBubbleBloop(bubbleType = 0) {
  if (!trackerAudioEnabled || !trackerAudioCtx || !trackerAudioMaster) return;
  const now = trackerAudioCtx.currentTime;
  const highTone = bubbleType === 1;
  const baseLow = randomInt(320, 460);
  const base = highTone ? baseLow * 2 : baseLow; // one octave up for bubble type 2
  const peakGain = highTone ? 0.38 : 0.31;
  const duration = highTone ? 0.22 : 0.28;

  const osc = trackerAudioCtx.createOscillator();
  const gain = trackerAudioCtx.createGain();
  const filter = trackerAudioCtx.createBiquadFilter();

  osc.type = highTone ? 'sine' : 'triangle';
  osc.frequency.setValueAtTime(base * 1.28, now);
  osc.frequency.exponentialRampToValueAtTime(base, now + duration * 0.45);
  osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + duration);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(highTone ? 4100 : 2800, now);
  filter.Q.setValueAtTime(0.86, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peakGain, now + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(trackerAudioMaster);
  osc.start(now);
  osc.stop(now + duration + 0.03);

  if (!highTone) {
    const subOsc = trackerAudioCtx.createOscillator();
    const subGain = trackerAudioCtx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(base * 0.52, now + 0.01);
    subOsc.frequency.exponentialRampToValueAtTime(base * 0.38, now + duration + 0.02);
    subGain.gain.setValueAtTime(0.0001, now + 0.01);
    subGain.gain.linearRampToValueAtTime(0.14, now + 0.028);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.03);
    subOsc.connect(subGain);
    subGain.connect(trackerAudioMaster);
    subOsc.start(now + 0.01);
    subOsc.stop(now + duration + 0.05);
  }

  // Short transient for clearer "bloop" attack.
  const pop = trackerAudioCtx.createOscillator();
  const popGain = trackerAudioCtx.createGain();
  pop.type = 'sine';
  pop.frequency.setValueAtTime(highTone ? 2200 : 1400, now);
  pop.frequency.exponentialRampToValueAtTime(highTone ? 900 : 620, now + 0.05);
  popGain.gain.setValueAtTime(0.0001, now);
  popGain.gain.linearRampToValueAtTime(highTone ? 0.16 : 0.13, now + 0.006);
  popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  pop.connect(popGain);
  popGain.connect(trackerAudioMaster);
  pop.start(now);
  pop.stop(now + 0.07);
}

function onSubscribe(event) {
  event.preventDefault();
  const email = (el.subscribeEmail?.value || '').trim();
  const eoaRaw = (el.walletInput?.value || '').trim();
  const eoa = normalizeAddress(eoaRaw);

  if (!isEmail(email)) {
    setStatus(el.subscribeStatus, 'Please enter a valid email.', true);
    return;
  }
  if (!eoa) {
    setStatus(el.subscribeStatus, 'Please add wallet address first.', true);
    el.walletInput?.focus();
    return;
  }

  // Keep a confirmed signup email locked to its original wallet on the client too.
  if (
    signedUpEmail &&
    signedUpEOA &&
    email.toLowerCase() === signedUpEmail.toLowerCase() &&
    eoa.toLowerCase() !== signedUpEOA.toLowerCase()
  ) {
    const reason = `This email is already linked to ${shortAddress(
      signedUpEOA,
    )}. Use the original wallet for this email.`;
    setStatus(el.subscribeStatus, reason, true);
    openValidationModal('Email already linked', reason, 'wallet');
    return;
  }

  const submitButton = el.subscribeForm?.querySelector('button[type="submit"]');
  if (submitButton instanceof HTMLButtonElement) {
    submitButton.disabled = true;
  }
  setStatus(el.subscribeStatus, 'Submitting...', false);

  submitKitSubscription(email, eoa)
    .then(() => {
      signedUpEmail = email;
      signedUpEOA = eoa;
      localStorage.setItem(SIGNUP_EMAIL_KEY, email);
      localStorage.setItem(
        SIGNUP_STATE_KEY,
        JSON.stringify({
          email,
          eoa,
        }),
      );
      setStatus(el.subscribeStatus, `Signed up: ${email} (${shortAddress(eoa)})`, false);
    })
    .catch((error) => {
      const reason =
        error instanceof Error && error.message
          ? error.message
          : 'Could not reach Kit right now. Please retry in a few seconds.';
      setStatus(
        el.subscribeStatus,
        reason,
        true,
      );
      if (
        error &&
        typeof error === 'object' &&
        String(error.failureCode || '') === 'KIT_EMAIL_EOA_LOCKED'
      ) {
        openValidationModal('Email already linked', reason, 'wallet');
      }
    })
    .finally(() => {
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = false;
      }
    });
}

async function submitKitSubscription(email, eoa) {
  const ip = await getRequiredClientIp();
  if (el.subscribeIpAddress) {
    el.subscribeIpAddress.value = ip;
  }
  const response = await fetch(`${FAUCET_API_BASE}/kitSubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      eoa,
      ip,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success !== true) {
    const error = new Error(
      data?.error || `Could not complete signup (HTTP ${response.status}).`,
    );
    if (data?.failureCode) {
      error.failureCode = String(data.failureCode);
    }
    throw error;
  }
  return data;
}

function onSubscribeEmailInput() {
  const email = (el.subscribeEmail?.value || '').trim();
  if (!email) {
    setStatus(el.subscribeStatus, '', false);
  } else if (
    signedUpEmail &&
    signedUpEOA &&
    email.toLowerCase() === signedUpEmail.toLowerCase()
  ) {
    setStatus(el.subscribeStatus, `Signed up: ${email} (${shortAddress(signedUpEOA)})`, false);
  }
}

function onWalletInput() {
  const owner = normalizeAddress(el.walletInput?.value || '');
  if (deriveTimer) {
    clearTimeout(deriveTimer);
    deriveTimer = null;
  }

  if (!owner) {
    hidePreview();
    setStatus(el.faucetStatus, '', false);
    return;
  }

  el.ownerWallet.textContent = owner;
  el.smartWallet.textContent = 'Deriving...';
  el.walletPreview.hidden = false;

  deriveTimer = setTimeout(async () => {
    const current = normalizeAddress(el.walletInput?.value || '');
    if (!current || current.toLowerCase() !== owner.toLowerCase()) {
      return;
    }

    const smart = await deriveSmartAccount(owner);
    if (!smart) {
      el.smartWallet.textContent = 'Unavailable right now';
      setStatus(
        el.faucetStatus,
        'Could not derive the gasless wallet yet. You can still start clawing.',
        true,
      );
      return;
    }

    el.smartWallet.textContent = smart;
    setStatus(el.faucetStatus, '', false);
  }, 280);
}

async function onStartClawing(event) {
  event.preventDefault();
  const owner = normalizeAddress(el.walletInput?.value || '');
  if (!owner) {
    setStatus(el.faucetStatus, 'Please add wallet address.', true);
    openValidationModal('Please add wallet address', 'Please add wallet address.', 'wallet');
    hidePreview();
    return;
  }
  if (!hasCompletedSignup()) {
    setStatus(el.faucetStatus, 'Please sign up.', true);
    openValidationModal('Please sign up', 'Please sign up.', 'email');
    return;
  }
  const signupEmailRaw = (el.subscribeEmail?.value || '').trim();
  const signupEmail = signupEmailRaw || signedUpEmail;
  if (!isEmail(signupEmail)) {
    setStatus(el.faucetStatus, 'Please sign up.', true);
    openValidationModal('Please sign up', 'Please sign up.', 'email');
    return;
  }
  if (el.subscribeEmail && !signupEmailRaw) {
    el.subscribeEmail.value = signupEmail;
  }

  if (el.startButton) el.startButton.disabled = true;
  setStatus(el.faucetStatus, 'Checking email confirmation...', false);

  try {
    const kitStatus = await getKitSubscriberStatus(signupEmail, owner);
    if (!kitStatus.confirmed) {
      const reason =
        kitStatus.error ||
        (kitStatus.state === 'inactive'
          ? 'Please confirm your email.'
          : 'Please confirm your email.');
      let modalTitle = 'Could not start clawing';
      let modalFocus = 'email';
      if (kitStatus.failureCode === 'KIT_EMAIL_NOT_REGISTERED') {
        modalTitle = 'Please sign up first';
        modalFocus = 'email';
      } else if (kitStatus.failureCode === 'KIT_EMAIL_NOT_CONFIRMED') {
        modalTitle = 'Please confirm your email';
        modalFocus = 'email';
      } else if (
        kitStatus.failureCode === 'KIT_WALLET_MISMATCH' ||
        kitStatus.failureCode === 'KIT_WALLET_REGISTERED_TO_OTHER_EMAIL' ||
        kitStatus.failureCode === 'KIT_WALLET_DUPLICATE'
      ) {
        modalTitle = 'Wallet check failed';
        modalFocus = 'wallet';
      }
      setStatus(el.faucetStatus, reason, true);
      openValidationModal(modalTitle, reason, modalFocus);
      return;
    }

    setStatus(el.faucetStatus, 'Creating clawing session...', false);
    const response = await fetch(
      `${FAUCET_API_BASE}/startSession?cliver=${encodeURIComponent(FAUCET_CLIENT_VERSION)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addr: owner,
          email: signupEmail,
          verifyKit: true,
        }),
      },
    );

    const data = await response.json();
    const sessionId =
      typeof data?.session === 'string' && data.session.trim().length > 0
        ? data.session.trim()
        : '';
    const failedCode = typeof data?.failedCode === 'string' ? data.failedCode : '';
    const failedReason = typeof data?.failedReason === 'string' ? data.failedReason : '';
    const failedStatus = typeof data?.status === 'string' ? data.status.toLowerCase() : '';

    if (sessionId) {
      storeSessionId(owner, sessionId);
      const trackerUrl = buildTrackerUrl(owner, sessionId);
      setStatus(
        el.faucetStatus,
        `Session created. Diving in... Track at ${trackerUrl}`,
        false,
      );
      openModal(buildFaucetEmbedUrl(`/#/mine/${sessionId}`));
      return;
    }

    if (!response.ok || failedStatus === 'failed' || failedCode || failedReason || data?.error) {
      const reason =
        failedReason ||
        data?.error ||
        `Could not start clawing session (HTTP ${response.status}).`;
      setStatus(el.faucetStatus, reason, true);
      openValidationModal('Could not start clawing', reason, null);
      return;
    }

    setStatus(el.faucetStatus, 'Could not start clawing session.', true);
    openValidationModal('Could not start clawing', 'Could not start clawing session.', null);
  } catch (error) {
    const reason =
      error instanceof Error && error.message
        ? error.message
        : 'Faucet API is currently unavailable.';
    setStatus(el.faucetStatus, reason, true);
    openValidationModal('Could not start clawing', reason, null);
  } finally {
    if (el.startButton) el.startButton.disabled = false;
  }
}

function buildFaucetEmbedUrl(hashPath) {
  return `${FAUCET_BASE_URL}/?embed=1&ui=claw${hashPath}`;
}

async function getKitSubscriberStatus(email, eoa) {
  try {
    const query = new URLSearchParams({
      email: email || '',
    });
    if (eoa) {
      query.set('eoa', eoa);
    }
    const response = await fetch(
      `${FAUCET_API_BASE}/kitSubscriberStatus?${query.toString()}`,
    );
    const data = await response.json();
    return {
      confirmed: data?.confirmed === true,
      state: typeof data?.state === 'string' ? data.state : null,
      error: data?.error ? String(data.error) : null,
      failureCode: data?.failureCode ? String(data.failureCode) : null,
    };
  } catch {
    return {
      confirmed: false,
      state: null,
      error: 'Please confirm your email.',
      failureCode: 'KIT_API_ERROR',
    };
  }
}

async function deriveSmartAccount(ownerAddress) {
  try {
    const response = await fetch(`${FAUCET_API_BASE}/deriveSmartAccount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addr: ownerAddress }),
    });

    const data = await response.json();
    if (data?.success && data?.smartAccountAddress && normalizeAddress(data.smartAccountAddress)) {
      return normalizeAddress(data.smartAccountAddress);
    }
  } catch {
    // fallback below
  }

  return await deriveViaFactory(ownerAddress);
}

async function deriveViaFactory(ownerAddress) {
  const cleanOwner = ownerAddress.toLowerCase().replace(/^0x/, '');
  const callData = `${GET_ADDRESS_SELECTOR}${cleanOwner.padStart(64, '0')}${'0'.repeat(64)}`;

  for (const rpcUrl of RPC_CANDIDATES) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_call',
          params: [
            {
              to: SIMPLE_ACCOUNT_FACTORY,
              data: callData,
            },
            'latest',
          ],
        }),
      });
      const data = await response.json();
      const result = data?.result;
      if (typeof result === 'string' && result.startsWith('0x') && result.length >= 66) {
        const candidate = `0x${result.slice(-40)}`;
        const normalized = normalizeAddress(candidate);
        if (normalized) return normalized;
      }
    } catch {
      // try next RPC
    }
  }

  return null;
}

function openModal(url) {
  if (!el.modal || !el.mineFrame) return;
  el.mineFrame.src = url;
  el.modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  if (!el.modal || !el.mineFrame || el.modal.hidden) return;
  el.modal.hidden = true;
  el.mineFrame.src = 'about:blank';
  document.body.style.overflow = '';
}

function openSignupModal() {
  if (!el.signupModal) return;
  el.signupModal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function openValidationModal(title, body, focusTarget) {
  validationFocusTarget = focusTarget || null;
  if (el.validationModalTitle) {
    el.validationModalTitle.textContent = title;
  }
  if (el.validationModalBody) {
    el.validationModalBody.textContent = body;
  }
  openSignupModal();
}

function closeSignupModal() {
  if (!el.signupModal || el.signupModal.hidden) return;
  el.signupModal.hidden = true;
  validationFocusTarget = null;
  if (el.modal?.hidden) {
    document.body.style.overflow = '';
  }
}

function hidePreview() {
  if (el.walletPreview) el.walletPreview.hidden = true;
}

function setStatus(target, text, isError) {
  if (!target) return;
  target.textContent = text;
  target.style.color = isError ? '#ff9f95' : '#9fb0d6';
}

function setText(target, text) {
  if (target) target.textContent = text;
}

function hasCompletedSignup() {
  const email = ((el.subscribeEmail?.value || '').trim() || signedUpEmail || '').trim();
  const eoa = normalizeAddress(el.walletInput?.value || '');
  return (
    isEmail(email) &&
    Boolean(signedUpEmail) &&
    Boolean(signedUpEOA) &&
    Boolean(eoa) &&
    email.toLowerCase() === signedUpEmail.toLowerCase() &&
    eoa.toLowerCase() === signedUpEOA.toLowerCase()
  );
}

function pad(num) {
  if (!Number.isFinite(num)) return '--';
  return String(num).padStart(2, '0');
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeAddress(value) {
  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return null;
  if (/^0x0{40}$/i.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function safeJsonParse(text, fallback) {
  try {
    if (!text) return fallback;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadSignupState() {
  const state = safeJsonParseObject(localStorage.getItem(SIGNUP_STATE_KEY));
  if (state && isEmail(state.email) && normalizeAddress(state.eoa || '')) {
    signedUpEmail = state.email;
    signedUpEOA = normalizeAddress(state.eoa);
    if (el.subscribeEmail && !el.subscribeEmail.value) {
      el.subscribeEmail.value = signedUpEmail;
    }
    if (el.walletInput && !el.walletInput.value) {
      el.walletInput.value = signedUpEOA;
    }
    setStatus(el.subscribeStatus, `Signed up: ${signedUpEmail} (${shortAddress(signedUpEOA)})`, false);
    return;
  }

  const saved = (localStorage.getItem(SIGNUP_EMAIL_KEY) || '').trim();
  if (!isEmail(saved)) return;
  signedUpEmail = saved;
  if (el.subscribeEmail && !el.subscribeEmail.value) {
    el.subscribeEmail.value = saved;
  }
  setStatus(el.subscribeStatus, `Signed up: ${saved}`, false);
}

function shortAddress(address) {
  const normalized = normalizeAddress(address || '');
  if (!normalized) return '';
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

function renderBuildMeta() {
  const text = `v${LANDING_VERSION} (${LANDING_COMMIT})`;
  if (el.buildMeta) {
    el.buildMeta.textContent = text;
  }
  if (el.buildMetaInline) {
    el.buildMetaInline.textContent = text;
  }
}

async function refreshBuildMeta() {
  if (!el.buildMeta && !el.buildMetaInline) return;
  const response = await fetch(`./build.json?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return;
  const data = await response.json();
  const version = typeof data?.version === 'string' && data.version ? data.version : LANDING_VERSION;
  const commit = typeof data?.commit === 'string' && data.commit ? data.commit : LANDING_COMMIT;
  const text = `v${version} (${commit})`;
  if (el.buildMeta) {
    el.buildMeta.textContent = text;
  }
  if (el.buildMetaInline) {
    el.buildMetaInline.textContent = text;
  }
}

function hydrateClientIp() {
  const cached = (sessionStorage.getItem(CLIENT_IP_CACHE_KEY) || '').trim();
  if (cached) {
    resolvedClientIp = cached;
    if (el.subscribeIpAddress) {
      el.subscribeIpAddress.value = cached;
    }
  }
  detectClientIp().catch(() => {
    // best-effort only; fallback handled at submit time
  });
}

async function getRequiredClientIp() {
  if (resolvedClientIp) return resolvedClientIp;
  await detectClientIp();
  if (resolvedClientIp) return resolvedClientIp;
  resolvedClientIp = '0.0.0.0';
  if (el.subscribeIpAddress) {
    el.subscribeIpAddress.value = resolvedClientIp;
  }
  return resolvedClientIp;
}

async function detectClientIp() {
  const probes = [
    async () => {
      const response = await fetch('https://api64.ipify.org?format=json');
      const data = await response.json();
      return typeof data?.ip === 'string' ? data.ip.trim() : '';
    },
  ];

  for (const probe of probes) {
    try {
      const ip = await probe();
      if (ip) {
        resolvedClientIp = ip;
        sessionStorage.setItem(CLIENT_IP_CACHE_KEY, ip);
        if (el.subscribeIpAddress) {
          el.subscribeIpAddress.value = ip;
        }
        return ip;
      }
    } catch {
      // try next source
    }
  }
  return '';
}

function safeJsonParseObject(text) {
  try {
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function randomInt(min, max) {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

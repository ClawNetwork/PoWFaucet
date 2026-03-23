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
const LANDING_VERSION = '0.2.0';
const LANDING_COMMIT = 'pending';
const BUBBLE_IMAGES = ['./reef_bubble1.png', './reef_bubble2.png'];
const MOBILE_BREAKPOINT_QUERY = '(max-width: 860px)';
const BUBBLE_SPAWN_MIN_MS = 2000;
const BUBBLE_SPAWN_MAX_MS = 4000;
const MOBILE_MAX_VISIBLE_BUBBLES = 1;
const DESKTOP_MIN_VISIBLE_BUBBLES = 2;
const DESKTOP_MAX_VISIBLE_BUBBLES = 7;
const LOBSTER_SWIM_START_DELAY_MS = 5000;

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

init();

function init() {
  startCountdown();
  initReefBubbles();
  initLobsterSwim();
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

  window.addEventListener('message', (event) => {
    if (event.origin !== FAUCET_IFRAME_ORIGIN) return;
    if (event?.data?.type === 'powfaucet:return-to-start') {
      closeModal();
      setStatus(el.faucetStatus, 'Back on the reef.', false);
    }
  });
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

function seedBubbles() {
  const desired = isMobileBubbleMode()
    ? MOBILE_MAX_VISIBLE_BUBBLES
    : DESKTOP_MIN_VISIBLE_BUBBLES;
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
  }, randomInt(BUBBLE_SPAWN_MIN_MS, BUBBLE_SPAWN_MAX_MS));
}

function runBubbleTick() {
  if (!el.reefBubbles) return;

  if (isMobileBubbleMode()) {
    if (activeBubbles.size < MOBILE_MAX_VISIBLE_BUBBLES) {
      spawnBubble();
    } else if (activeBubbles.size > MOBILE_MAX_VISIBLE_BUBBLES) {
      enforceBubbleLimits();
    }
    return;
  }

  maintainBubbleFloor();

  const targetVisible = randomInt(
    DESKTOP_MIN_VISIBLE_BUBBLES,
    DESKTOP_MAX_VISIBLE_BUBBLES,
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
  } else if (activeBubbles.size > DESKTOP_MAX_VISIBLE_BUBBLES) {
    enforceBubbleLimits();
  }
}

function maintainBubbleFloor() {
  if (isMobileBubbleMode()) return;
  while (activeBubbles.size < DESKTOP_MIN_VISIBLE_BUBBLES) {
    spawnBubble();
  }
}

function enforceBubbleLimits() {
  const maxAllowed = isMobileBubbleMode()
    ? MOBILE_MAX_VISIBLE_BUBBLES
    : DESKTOP_MAX_VISIBLE_BUBBLES;
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
  if (isMobileBubbleMode() && activeBubbles.size >= MOBILE_MAX_VISIBLE_BUBBLES) {
    return;
  }
  if (!isMobileBubbleMode() && activeBubbles.size >= DESKTOP_MAX_VISIBLE_BUBBLES) {
    return;
  }

  const bubble = document.createElement('img');
  bubble.className = 'reef-bubble';
  bubble.alt = '';
  bubble.src = BUBBLE_IMAGES[randomInt(0, BUBBLE_IMAGES.length - 1)];
  bubble.decoding = 'async';

  const mobile = isMobileBubbleMode();
  const size = mobile ? randomInt(60, 94) : randomInt(72, 136);
  const left = randomInt(8, 92);
  const drift = randomInt(-60, 60);
  const maxRise = Math.max(220, window.innerHeight - 80);
  const rise = mobile
    ? randomInt(Math.floor(maxRise * 0.58), Math.floor(maxRise * 0.9))
    : randomInt(Math.floor(maxRise * 0.72), maxRise);
  const baseDurationMs = mobile
    ? randomInt(9000, 16500)
    : randomInt(12000, 24000);
  const fastLift = Math.random() < 0.3;
  const durationMs = fastLift
    ? Math.max(3200, Math.floor(baseDurationMs * 0.7))
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
  const signupEmail = (el.subscribeEmail?.value || '').trim();

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
      setStatus(el.faucetStatus, 'Session created. Diving in...', false);
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
  const email = (el.subscribeEmail?.value || '').trim();
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
  return trimmed;
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

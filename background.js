const pending = new Map();
let running = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const inject = (tabId, func, args = []) => chrome.scripting.executeScript({ target: { tabId }, func, args });

function setBadge(text) {
  chrome.action.setBadgeText({ text });
  if (text) chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
}

function release(badge = '') {
  running = false;
  setBadge(badge);
}

function waitFor(type, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(type);
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeoutMs);
    pending.set(type, { resolve, reject, timer });
  });
}

function settle(type, error) {
  const entry = pending.get(type);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(type);
  if (error) entry.reject(new Error(error));
  else entry.resolve();
}

function settleAll(error) {
  [...pending.keys()].forEach((type) => settle(type, error));
}

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Recording tab video for scroll capture.'
  });
}

async function closeOffscreen() {
  if (await chrome.offscreen.hasDocument()) await chrome.offscreen.closeDocument();
}

function downloadFinished(id) {
  return new Promise((resolve) => {
    const finish = () => {
      chrome.downloads.onChanged.removeListener(listener);
      resolve();
    };
    const listener = (delta) => {
      if (delta.id === id && delta.state && delta.state.current !== 'in_progress') finish();
    };
    chrome.downloads.onChanged.addListener(listener);
    chrome.downloads.search({ id }).then(([item]) => {
      if (item && item.state !== 'in_progress') finish();
    });
  });
}

async function saveVideo(url, filename) {
  try {
    const id = await chrome.downloads.download({ url, filename, saveAs: true });
    await downloadFinished(id);
  } catch (err) {
    console.error(err);
  } finally {
    await closeOffscreen().catch(() => {});
    release();
  }
}

async function begin(message) {
  if (running) throw new Error('A run is already in progress.');
  running = true;
  setBadge('');
  try {
    await inject(message.tabId, prepareTab);
  } catch {
    release();
    throw new Error('This page cannot be recorded. Open a regular website.');
  }
  run(message);
}

async function run(message) {
  const { mode, tabId, countdown, durationMs, easing } = message;
  try {
    await sleep(500);
    if (countdown > 0) {
      await inject(tabId, showCountdownOverlay, [countdown]);
      await sleep(countdown * 1000 + 700);
      await inject(tabId, hideCountdownOverlay);
    }
    await sleep(500);

    if (mode === 'record') {
      await record(message);
      return;
    }

    await inject(tabId, startSmoothScroll, [durationMs, easing]);
    await sleep(400);
    await inject(tabId, restoreTab);
    release();
  } catch (err) {
    console.error(err);
    await closeOffscreen().catch(() => {});
    await inject(tabId, hideCountdownOverlay).catch(() => {});
    await inject(tabId, restoreTab).catch(() => {});
    release('!');
  }
}

async function record({ tabId, durationMs, easing, width, height, bitrate }) {
  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });

  const ready = waitFor('RECORDER_READY', 10000);
  chrome.runtime.sendMessage({
    type: 'INIT_RECORDER',
    streamId,
    width,
    height,
    bitrate,
    maxDurationMs: durationMs + 10000
  });
  await ready;
  setBadge('REC');

  await inject(tabId, startSmoothScroll, [durationMs, easing]);
  await sleep(400);

  const stopped = waitFor('RECORDER_STOPPED', 20000);
  chrome.runtime.sendMessage({ type: 'STOP_RECORDER' });
  await stopped;
  await inject(tabId, restoreTab);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_RECORDING':
      begin({ ...message, mode: 'record' })
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true;
    case 'START_SCROLL_ONLY':
      begin({ ...message, mode: 'scrollOnly' })
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true;
    case 'RECORDER_READY':
    case 'RECORDER_STOPPED':
      settle(message.type);
      break;
    case 'RECORDER_ERROR':
      settleAll(message.error);
      break;
    case 'DOWNLOAD_VIDEO':
      saveVideo(message.url, message.filename);
      break;
  }
});

function prepareTab() {
  if (!document.getElementById('ssr-recorder-styles')) {
    const style = document.createElement('style');
    style.id = 'ssr-recorder-styles';
    style.textContent = 'html, body { scrollbar-width: none !important; scroll-behavior: auto !important; } ::-webkit-scrollbar { display: none !important; }';
    document.head.appendChild(style);
  }
  const scroller = document.scrollingElement || document.documentElement;
  scroller.scrollTop = 0;
}

function restoreTab() {
  const style = document.getElementById('ssr-recorder-styles');
  if (style) style.remove();
}

function showCountdownOverlay(seconds) {
  const existing = document.getElementById('ssr-countdown-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ssr-countdown-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 150px;
    font-weight: bold;
    color: white;
    text-shadow: 0 0 30px rgba(0, 0, 0, 0.8);
  `;
  document.body.appendChild(overlay);

  let current = seconds;
  overlay.textContent = current;

  const interval = setInterval(() => {
    current -= 1;
    if (current > 0) {
      overlay.textContent = current;
      return;
    }
    clearInterval(interval);
    overlay.textContent = 'GO!';
    setTimeout(() => {
      overlay.style.transition = 'opacity 0.3s';
      overlay.style.opacity = '0';
    }, 300);
  }, 1000);
}

function hideCountdownOverlay() {
  const overlay = document.getElementById('ssr-countdown-overlay');
  if (overlay) overlay.remove();
}

function startSmoothScroll(durationMs, easingType) {
  return new Promise((resolve) => {
    const scroller = document.scrollingElement || document.documentElement;
    const start = scroller.scrollTop;
    const distance = scroller.scrollHeight - window.innerHeight - start;

    const easings = {
      linear: (t) => t,
      easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2)
    };
    const ease = easings[easingType] || easings.easeInOutQuart;

    let startTime = null;
    const step = (now) => {
      if (startTime === null) startTime = now;
      const progress = Math.min((now - startTime) / durationMs, 1);
      scroller.scrollTop = start + distance * ease(progress);
      if (progress < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

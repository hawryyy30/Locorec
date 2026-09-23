const FIELDS = ['duration', 'countdown', 'resolution', 'quality', 'easing'];
const LIMITS = { duration: [2, 120], countdown: [0, 10] };
const BLOCKED_URL = /^(chrome|edge|about|chrome-extension|devtools|view-source):|^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/;

const $ = (id) => document.getElementById(id);

const clamp = (value, [min, max], fallback) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

function setStatus(text, isError = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function setBusy(busy) {
  $('startRecordBtn').disabled = busy;
  $('startScrollOnlyBtn').disabled = busy;
}

document.addEventListener('DOMContentLoaded', async () => {
  const { lastSettings } = await chrome.storage.local.get('lastSettings');
  if (lastSettings) {
    FIELDS.forEach((id) => {
      const value = lastSettings[id];
      if (value !== undefined && value !== null && value !== '') $(id).value = value;
    });
  }

  $('startRecordBtn').addEventListener('click', () => start('record'));
  $('startScrollOnlyBtn').addEventListener('click', () => start('scrollOnly'));
});

async function start(mode) {
  setBusy(true);
  setStatus('Starting…');

  try {
    const duration = clamp(parseFloat($('duration').value), LIMITS.duration, 10);
    const countdown = Math.round(clamp(parseInt($('countdown').value, 10), LIMITS.countdown, 0));
    $('duration').value = duration;
    $('countdown').value = countdown;

    const settings = {
      duration,
      countdown,
      resolution: $('resolution').value,
      quality: $('quality').value,
      easing: $('easing').value
    };
    await chrome.storage.local.set({ lastSettings: settings });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || (tab.url && BLOCKED_URL.test(tab.url))) {
      throw new Error('Open a regular web page first.');
    }

    const [width, height] = settings.resolution.split('x').map(Number);
    const response = await chrome.runtime.sendMessage({
      type: mode === 'record' ? 'START_RECORDING' : 'START_SCROLL_ONLY',
      tabId: tab.id,
      durationMs: duration * 1000,
      width,
      height,
      bitrate: parseInt(settings.quality, 10),
      easing: settings.easing,
      countdown
    });

    if (!response || response.error) {
      throw new Error(response ? response.error : 'No response from the extension.');
    }
    window.close();
  } catch (err) {
    setStatus(err.message, true);
    setBusy(false);
  }
}

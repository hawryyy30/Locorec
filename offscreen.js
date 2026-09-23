const MIME_CANDIDATES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm'];

let recorder = null;
let stream = null;
let chunks = [];
let safetyTimer = null;
let keepAliveTimer = null;

const notify = (type, extra = {}) => chrome.runtime.sendMessage({ type, ...extra }).catch(() => {});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'INIT_RECORDER') start(message).catch(fail);
  if (message.type === 'STOP_RECORDER') stop();
});

async function start({ streamId, width, height, bitrate, maxDurationMs }) {
  if (recorder) return;
  chunks = [];

  const fps = width * height > 1920 * 1080 ? 30 : 60;

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
        minWidth: width,
        maxWidth: width,
        minHeight: height,
        maxHeight: height,
        minFrameRate: fps,
        maxFrameRate: fps
      }
    },
    audio: false
  });

  const mimeType = MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || 'video/webm';
  const baseType = mimeType.split(';')[0];
  const extension = baseType === 'video/mp4' ? 'mp4' : 'webm';

  recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };

  recorder.onerror = (event) => fail(event.error || new Error('Recorder error'));

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: baseType });
    chunks = [];
    teardown();
    notify('DOWNLOAD_VIDEO', {
      url: URL.createObjectURL(blob),
      filename: `scroll-recording-${width}x${height}-${Date.now()}.${extension}`
    });
    notify('RECORDER_STOPPED');
  };

  recorder.start(1000);

  keepAliveTimer = setInterval(() => notify('PING'), 20000);
  safetyTimer = setTimeout(stop, maxDurationMs);

  notify('RECORDER_READY');
}

function stop() {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}

function teardown() {
  clearTimeout(safetyTimer);
  clearInterval(keepAliveTimer);
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  recorder = null;
}

function fail(err) {
  chunks = [];
  teardown();
  notify('RECORDER_ERROR', { error: err.message || String(err) });
}

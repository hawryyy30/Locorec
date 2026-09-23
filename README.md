# Locorec

A Chrome extension that records a smooth, automated scroll of any web page and saves it as a video. Set a duration, resolution and easing curve, and the extension scrolls the page from top to bottom while capturing the tab.

It is built for product demos, portfolio walkthroughs and design reviews, where a steady hand-scrolled screen recording is hard to get right.

## Features

- Scrolls a page from top to bottom over a fixed duration (2 to 120 seconds)
- Three easing curves: smooth start and end, constant speed, fast start with slow end
- Output at 720p, 1080p, 4K or a vertical 1080 x 1920 frame
- Four bitrate presets from 2 to 12 Mbps
- Optional on-page countdown before recording starts
- Hides the page scrollbar during capture and restores it afterwards
- Scroll-only mode for previewing the motion without recording
- Saves as MP4 where the browser supports it, otherwise WebM
- Runs entirely on your machine, with no network requests or accounts

## Installation

The extension is not published on the Chrome Web Store. Install it from source:

1. Clone or download this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the project folder.
5. Pin the extension from the toolbar puzzle-piece menu.

## Usage

1. Open the page you want to record and make sure the tab is in the foreground.
2. Click the extension icon.
3. Adjust the settings and click **Record and scroll**.
4. Wait for the countdown. The page scrolls to the bottom and recording stops automatically.
5. Choose where to save the file in the dialog that appears.

Click **Scroll only** to run the same scroll and countdown without recording. This is useful for checking duration and easing before you capture.

While a recording is running, the toolbar icon shows a red `REC` badge. A `!` badge means the run failed. Details are in the service worker console (see [Development](#development)).

## Settings

| Setting | Options | Default |
| --- | --- | --- |
| Duration | 2 to 120 seconds | 10 |
| Countdown | 0 to 10 seconds | 3 |
| Resolution | 1080p (1920 x 1080), 4K (3840 x 2160), vertical (1080 x 1920), 720p (1280 x 720) | 1080p |
| Quality | Ultra 12 Mbps, High 8 Mbps, Medium 4 Mbps, Low 2 Mbps | High |
| Easing | Smooth start and end, constant speed, fast start and slow end | Smooth start and end |

Values outside the allowed range are corrected automatically. Your last settings are remembered.

Recordings run at 60 fps up to 1080p and 30 fps above that.

## Supported browsers

| Browser | Status |
| --- | --- |
| Google Chrome 116 and later | Supported |
| Microsoft Edge (Chromium) | Expected to work |
| Brave, Opera, Vivaldi, Arc | Expected to work |
| Firefox | Not supported |
| Safari | Not supported |

The extension uses Manifest V3 along with the `offscreen`, `tabCapture` and `scripting` APIs, so it requires a recent Chromium-based browser. Firefox and Safari do not provide the tab capture and offscreen document APIs it depends on.

MP4 output requires Chrome 126 or later. Older versions fall back to WebM automatically.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `activeTab` | Access the tab you started the recording from |
| `scripting` | Inject the scroll, countdown and scrollbar-hiding code into the page |
| `tabCapture` | Capture the tab's video stream |
| `offscreen` | Run the recorder in a hidden document, as Manifest V3 service workers cannot record media |
| `downloads` | Save the finished video to disk |
| `storage` | Remember your last settings |

## How it works

1. The popup validates your settings and sends them to the background service worker.
2. The service worker scrolls the tab to the top, hides the scrollbar and shows the countdown.
3. It opens an offscreen document, which starts a `MediaRecorder` on the tab's capture stream.
4. Once the recorder confirms it is running, the service worker starts the scroll and waits for it to finish.
5. It then stops the recorder, restores the scrollbar and saves the file. The offscreen document is closed afterwards to free memory.

## Project structure

```
manifest.json     Extension manifest (Manifest V3)
background.js     Service worker: sequencing, page scripts, downloads
offscreen.html    Hidden document that hosts the recorder
offscreen.js      Tab capture and MediaRecorder logic
popup.html        Popup interface and styles
popup.js          Popup logic: validation, settings, messaging
```

## Development

There is no build step. Edit the files and click the reload icon on the extension's card in `chrome://extensions`.

- **Service worker logs:** click **service worker** on the extension's card.
- **Recorder logs:** click **offscreen.html** under Inspect views while a recording is running.
- **Popup logs:** right-click the popup and choose **Inspect**.

## FAQ

**Why can't I record `chrome://` pages or the Chrome Web Store?**

>Chrome does not allow extensions to inject scripts into internal pages or the Web Store. The popup will tell you when the current tab is not supported.

**Does it record audio?**

>No. Only video is captured.

**Why is the video slightly longer than the duration I set?**

>Recording starts before the scroll begins and continues for a short moment after it ends, so the first and last frames are not clipped.

**Why does the page look different while recording?**

>The scrollbar is hidden during the run so it does not appear in the video. It is restored as soon as recording stops.

**Can I switch tabs while it records?**

>No. Browsers slow down animation in background tabs, which makes the scroll stutter. Keep the tab in the foreground until the file is saved.

**The scroll does not move, or stops partway. Why?**

>The extension scrolls the main document. Pages that scroll inside a nested container, use a scroll-hijacking library, or load more content as you scroll are not fully supported.

**Does the vertical preset make the page render as a mobile site?**

>No. It sets the video dimensions to 1080 x 1920 but does not resize the viewport, so responsive layouts still respond to your actual window width. To capture a mobile layout, narrow the browser window or use device emulation in DevTools first.

**The recording is choppy or my computer struggles at 4K.**

>4K capture is CPU and GPU intensive. Lower the resolution to 1080p or drop the quality preset. Closing other heavy tabs also helps.

**Why is the file so large?**

>File size follows the bitrate. Ultra (12 Mbps) uses roughly 90 MB per minute. Use High or Medium for smaller files.

**MP4 or WebM?**

>The extension picks MP4 when your browser supports it and falls back to WebM otherwise. MP4 is more widely accepted by video editors and social platforms.

**I clicked Start and nothing happened.**

>Check the toolbar badge. A `!` means the run failed, and the service worker console shows the reason. A message that a run is already in progress means the previous recording is still being saved.

**Is any data collected or uploaded?**

>No. Recording, encoding and saving all happen locally. The only stored data is your last-used settings, kept in `chrome.storage.local`.

## Contributing

Issues and pull requests are welcome. For bug reports, include your browser and version, the resolution and quality settings you used, and any errors from the service worker console.

## License

Released under the MIT License.

## Author

Made with love by [hawryyy30](https://github.com/hawryyy30).

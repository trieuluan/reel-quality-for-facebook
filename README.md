<p align="center"><img src="icons/icon-128.png" width="96" alt="Reel Quality icon"></p>

<h1 align="center">Reel Quality for Facebook</h1>

<p align="center">A Chrome extension that adds a quality menu to Facebook Reels.<br>Made by <b>Louis</b>.</p>

---

Facebook Reels has no quality setting. It picks a resolution for you and often settles on a blurry one. This extension adds a small **⚙ Auto** button to the reel you are watching. Open it to choose any resolution the video actually offers, such as 1080p, 720p or 540p.

## Features

- **Real qualities only.** The menu lists only the resolutions that exist for the current reel and that your browser can play. If a reel has a single quality, the button stays hidden.
- **Remembers your choice.** The quality you pick is applied to the next reels too. If a reel doesn't have that exact quality, the closest lower one is used.
- **Movable button.** Drag the button anywhere on the video, or pick one of 8 preset positions from the menu. The position is saved relative to the video, so it stays in place across reels, window sizes and fullscreen.
- **Seamless.** Facebook's player keeps handling sound, controls, looping and seeking. Until the chosen quality is ready, Facebook's own picture keeps showing, so you never see a black frame.
- **English and Vietnamese UI.** The menu follows Facebook's language setting.
- **Private.** No data collection, no network requests other than the video files Facebook already serves, and no extra permissions. See [PRIVACY.md](PRIVACY.md).

## Install

### From source (developer mode)

1. [Download the latest code](https://github.com/trieuluan/reel-quality-for-facebook/archive/refs/heads/main.zip) and unzip it, or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the project folder.
4. Open any `facebook.com/reel/...` page.

The extension works in Chrome, Edge, Brave, Opera and other Chromium browsers, version 111 or later.

### Build a zip for the Chrome Web Store

```bash
./scripts/package.sh
```

The script writes `dist/reel-quality-<version>.zip`, ready to upload in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

## How it works

| File | Role |
| --- | --- |
| `src/hooks.js` | Reads the DASH manifests (`dash_manifest`) embedded in Facebook's GraphQL responses and page data. It hooks `MediaSource`/`SourceBuffer` to match each manifest to its `<video>`, falling back to the `/reel/<id>` URL. |
| `src/mpd.js` | Parses the manifest and keeps the qualities the browser can play. It uses regex instead of `DOMParser`, which Facebook's Trusted Types policy blocks. |
| `src/player.js` | A small video-only DASH player. It reads the `sidx` index, plays the chosen quality through Media Source Extensions in a `<video>` laid over Facebook's, and follows Facebook's clock for play, pause, seek and loop. |
| `src/ui.js` | The button and menu, inside a closed Shadow DOM so Facebook's styles can't affect it. Also handles dragging, preset positions and localization. |

## Limitations

- While a fixed quality is selected, Facebook still streams its own copy underneath, so bandwidth use is higher.
- Facebook changes its internal data often, which can break the extension. If the button doesn't appear, open DevTools on the Facebook tab and run `__FBQ.manifests` to see which manifests were captured, then [open an issue](https://github.com/trieuluan/reel-quality-for-facebook/issues).
- Only MP4 streams indexed with `SegmentBase`/`sidx` are supported. This is the format Facebook currently uses for Reels.

## Debugging

In the DevTools console of a Facebook tab:

```js
__FBQ.manifests   // video id -> { reps }
__FBQ.ui.state    // targeted video, available qualities, active player, button position
```

## Disclaimer

This project is not affiliated with, endorsed by or sponsored by Meta Platforms, Inc. "Facebook" is a trademark of Meta Platforms, Inc.

## License

[MIT](LICENSE) © 2026 Louis

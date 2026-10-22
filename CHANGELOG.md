# Changelog

## Unreleased

- **Review ask after downloads.** After your second saved reel, a small "Finding Reel Quality useful? Rate it / Report a problem / Not now" card appears beside the download button. Clicking elsewhere just closes it (it may come back, at most once a day); "Not now" and the at-most-twice limit work as before.

## 1.3.0 (2026-10-22)

- **Download reels.** A **Download** button sits above Facebook's Like button. Pick a quality from its menu (with an estimated size) and the reel is saved as one MP4 with sound: the separate video and audio streams are joined in the browser, nothing is uploaded anywhere. The button shows the progress while downloading; click it again to cancel. `D` opens the menu. If the Like column can't be found, the download options appear in the quality menu instead.
- **18 more languages.** The menus and the store name/description are now available in Spanish, Portuguese (Brazil), French, German, Italian, Polish, Russian, Turkish, Arabic (right-to-left), Hindi, Indonesian, Malay, Filipino, Thai, Japanese, Korean and Chinese (Simplified and Traditional). The menu follows Facebook's language setting.
- **Tidier support card.** The MoMo/VietQR card now opens beside the quality menu instead of stretching it.

## 1.2.0 (2026-10-19)

- **Real resolution on the button.** On Auto, the button shows what Facebook is actually playing (for example `Auto · 540p`), so a quality drop is visible at a glance.
- **Auto-hide button.** The button fades out after a few seconds without mouse movement over the video and comes back as soon as you move the mouse. Can be turned off in the menu.
- **Keyboard shortcuts.** `Q` opens the menu, `Shift+↑` / `Shift+↓` step the quality up or down, `A` goes back to Auto, `E` expands a landscape clip. Ignored while typing.
- **Review reminder.** After a few days of use, the menu shows a one-time "Rate it / Report a problem / Not now" line.

## 1.1.1 (2026-10-19)

- Store name and description are now localized (English and Vietnamese) through `_locales`, so the Chrome Web Store can show a Vietnamese listing.

## 1.1.0 (2026-10-16)

- **New: expand landscape clips.** When a reel is a horizontal clip inside a vertical frame with black bars, the menu offers **⤢ Expand landscape clip** to show it large in the middle of the screen. On Auto it switches to the reel's best quality while the viewer is open. Click the clip to pause, press Esc or click outside to close.
- Clip detection works with dark footage and ignores captions in the bars.

## 1.0.0 (2026-10-16)

- First release: quality menu for Facebook Reels, remembered quality, draggable button with 8 preset positions, English and Vietnamese UI, Ko-fi and MoMo/VietQR support link.

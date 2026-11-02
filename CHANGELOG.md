# Changelog

## 1.5.1 (2026-11-02)

- **Every reel goes into the history.** Only the first reel was recorded: after ↑/↓, the next reels were taken for the previous one, because the id found next to a video's data in Facebook's responses (which carry several reels at once) could belong to another reel. The reel is now the one in the address bar (/reel/<id>), and a reel shown in a new player before the address catches up is no longer counted twice.
- Downloaded files are named after the reel in the address bar too (`reel-<id>-1080p.mp4`), for the same reason.

## 1.5.0 (2026-11-02)

- **Watch history.** Reels you watch are kept in a history once they have actually played for 3 seconds, so reels you scroll past stay out (paused, buffering or a hidden tab don't count). The menu can switch this to right away or 10 seconds. Each entry has the page name, caption, a sharp thumbnail (taken from the HD layer when you picked a quality), the length and how far you got; a reel that looped counts as watched to the end. Watching it again moves it to the top.
- **Watched before.** A reel already in the history shows "Watched 2 days ago · stopped at 0:42" under the ⚙ button, with **Resume** to jump back to where you left off.
- **Watch later.** A **🔖** button under Download, or `B`, adds the reel to Watch later (or takes it out). In fullscreen, or when the Like column isn't found, it's in the quality menu and `B` shows a short confirmation.
- **Toolbar popup.** Clicking the extension's icon shows the latest 50 watched or saved reels with a search over page names and captions. Click one to open it in the current Facebook tab (Ctrl/⌘ or middle click: a background tab); hover for 🔖 and ✕. It also has a switch to pause the history.
- **Library page.** **Open library** shows everything grouped by day, with search, multi-select delete, clearing the last hour / 24 hours / 7 days / all of the history (Watch later stays), and export / import as a JSON file.
- **Fullscreen only where it belongs.** The ⛶ button, `F` and the hidden pointer now only appear in the Reels viewer (facebook.com/reel/…), no longer on videos in the feed, groups or Watch, which have Facebook's own controls.
- Stored with `chrome.storage.local` on your device only; new permissions `storage`, `unlimitedStorage` and `activeTab`, none of which shows an install warning.

## 1.4.0 (2026-11-01)

- **Fullscreen for Reels.** Facebook Reels on desktop have no fullscreen button and `F` does nothing. Click the **⛶** button at the video's bottom right, level with the page name (it moves up with it when the description is expanded, so it never covers the text), or press `F`, to watch the reel fullscreen, letterboxed, with the chosen HD quality. The same button, `F` or Esc leaves. It fades out with the ⚙ button while you watch. Since Facebook's own keys and progress bar don't reach a fullscreen reel, fullscreen has its own: a progress bar with the time just above the page name and description, sharing its line with the ⛶ button (both move up when the description is expanded; click or drag the bar to seek, and hover it for a thumbnail of that moment with its time, taken from the reel's lowest quality so it loads fast), Space or `K` to play/pause, ←/→ to skip 5 seconds, and ↑/↓ for the previous/next reel, which comes back fullscreen. While fullscreen, the download options move into the quality menu.
- **Mouse pointer hides while you watch.** Resting the mouse on a playing reel now hides the pointer together with the ⚙ and ⛶ buttons; moving it brings everything back. It stays visible while the video is paused, a menu is open, the mouse is off the video, or "Hide button until the mouse moves" is off.
- **Rate link in the menu.** The menu footer now always has **⭐ Rate** next to **☕ Support**.
- **Review ask that actually shows up.** Watching in HD on 3 different days (a remembered quality applied automatically counts too) now earns the ask, shown as a small card where the menu opens instead of only inside the menu. Cards brushed away three times count as one "Not now", so it never nags.

## 1.3.1 (2026-10-22)

- **Review ask after downloads.** After your second saved reel, a small "Finding Reel Quality useful? Rate it / Report a problem / Not now" card appears beside the download button. Clicking elsewhere just closes it (it may come back, at most once a day); "Not now" and the at-most-twice limit work as before.
- **Store name and summary say what people search for.** In all 20 languages they now lead with downloading Facebook Reels and videos in HD with sound ("Facebook Reels & Video Downloader", "Tải video, Reels Facebook HD", "Descargar videos y Reels de Facebook"…), then watching in 1080p.
- **Store descriptions lead with downloading.** In all 20 languages the long description now opens with saving Facebook Reels and videos in HD with sound, adds a short how-to, a FAQ (free, no watermark, where files go, nothing uploaded) and a disclaimer asking people to download only videos they own or may save.

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

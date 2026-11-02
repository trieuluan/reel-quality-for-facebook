# Privacy Policy

_Reel Quality for Facebook. Last updated: November 2, 2026._

Reel Quality for Facebook does not collect, store, sell or share any personal data.

- **No data collection.** The extension has no analytics, tracking, accounts or remote servers.
- **What it reads.** On facebook.com pages, the extension reads the video manifests that Facebook already sends to your browser. It needs them to list the available video qualities. To find landscape clips inside vertical reels, it also looks at small, low-resolution copies of a few video frames. All of this is processed in memory, in the page, and is never stored or sent anywhere.
- **Network requests.** The extension only downloads video from Facebook's own video servers (`*.fbcdn.net`): segments of the quality you selected for playback, and the full video and audio streams of a reel when you click Download.
- **Downloads.** When you download a reel, its video and audio streams are joined into one MP4 file inside your browser and handed to your browser's normal download, which saves it on your computer. Nothing is uploaded, and the extension keeps no record of what you downloaded.
- **Watch history and Watch later.** For reels you watch on facebook.com/reel/… (after a few seconds of playback, unless you pause the history) and reels you add to Watch later, the extension keeps the reel's link and id, the page name and caption shown on screen, its length, how far you watched, when you watched or saved it, and a small thumbnail taken from the video. This is stored only in the extension's own storage on your device (`chrome.storage.local`), is never sent anywhere, and is not synced to other devices. You can pause the history, delete single reels, clear the last hour / day / week or everything, and export or import it as a file from the extension's popup and library page. Facebook's page can only ask the extension about the reel it is showing, never read the list. Removing the extension deletes it all.
- **Review reminder.** After you have used the extension for a few days, the menu may show a small "Rate it / Report a problem / Not now" line. It appears at most twice, and its links open the Chrome Web Store or GitHub only when you click them.
- **Support link.** The ☕ Support link in the menu opens ko-fi.com in a new tab, and only when you click it. The MoMo/VietQR code shown to Vietnamese users is built into the extension, so showing it makes no network request.
- **Local storage.** A few settings are saved in your browser's local storage for facebook.com: the quality you chose, the button position, whether the button auto-hides, and a small counter used to decide when to show the one-time review reminder (how many times you picked a quality and whether you already answered it). They never leave your device. Clearing site data for facebook.com removes them.
- **Permissions.** `storage` and `unlimitedStorage` keep the watch history on your device (thumbnails need more room than the default limit). `activeTab` lets the toolbar popup see whether the tab you are on is Facebook, so a reel you pick opens there instead of in a new tab; it only applies after you click the extension's icon. The extension only runs on `www.facebook.com` and `web.facebook.com`.

Questions: please [open an issue](https://github.com/trieuluan/reel-quality-for-facebook/issues).

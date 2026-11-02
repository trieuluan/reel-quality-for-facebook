// Watch history and Watch later, kept in chrome.storage.local (this browser only, never sent anywhere).
// Shared by the content-script bridge, the toolbar popup and the library page.
//
// "items" maps a reel id to { id, url, page, caption, duration, pos, done, watchedAt, savedAt, firstAt, views };
// a reel is in the history while watchedAt > 0 and in Watch later while savedAt > 0. Thumbnails (small JPEG
// data URLs) live under their own "thumb:<id>" keys, so listing the reels stays light.
(() => {
  const ITEMS = 'items';
  const PREFS = 'prefs';
  const HISTORY_MAX = 5000; // oldest history entries go first; saved reels always stay
  const DEFAULT_PREFS = { delay: 3, paused: false }; // delay: seconds of actual playback before a reel counts as watched
  const DELAYS = [0, 3, 10];
  const thumbKey = (id) => `thumb:${id}`;
  const local = chrome.storage.local;

  // Writes from one page run one at a time, so a read-modify-write never loses another one's change.
  let queue = Promise.resolve();
  const serial = (fn) => (queue = queue.then(fn, fn));

  const items = async () => (await local.get(ITEMS))[ITEMS] || {};
  const prefs = async () => ({ ...DEFAULT_PREFS, ...(await local.get(PREFS))[PREFS] });

  // Only fields the page actually found replace what is stored, so a missed caption doesn't wipe an earlier one.
  function merge(item, meta) {
    for (const k of ['url', 'page', 'caption', 'duration']) if (meta[k]) item[k] = meta[k];
    return item;
  }
  const blank = (id, now) => ({ id, url: `https://www.facebook.com/reel/${id}`, page: '', caption: '', duration: 0, pos: 0, done: false, watchedAt: 0, savedAt: 0, firstAt: now, views: 0 });

  // Drop reels that are in neither list, and the oldest history beyond the cap.
  async function commit(all, thumbs = {}) {
    const gone = [];
    for (const [id, it] of Object.entries(all)) if (!it.watchedAt && !it.savedAt) gone.push(id);
    const watched = Object.values(all).filter((it) => it.watchedAt).sort((a, b) => b.watchedAt - a.watchedAt);
    for (const it of watched.slice(HISTORY_MAX)) {
      if (it.savedAt) it.watchedAt = 0;
      else gone.push(it.id);
    }
    for (const id of gone) delete all[id];
    await local.set({ [ITEMS]: all, ...thumbs });
    if (gone.length) await local.remove(gone.map(thumbKey));
  }

  const RQStore = {
    DELAYS,
    thumbKey,
    items,
    prefs,

    async status(id) {
      const [all, p] = await Promise.all([items(), prefs()]);
      return { item: all[id] || null, prefs: p };
    },

    // A reel counted as watched: move it to the top of the history.
    visit: (meta, thumb) =>
      serial(async () => {
        if ((await prefs()).paused || !meta?.id) return null;
        const all = await items();
        const now = Date.now();
        const item = merge(all[meta.id] || blank(meta.id, now), meta);
        item.watchedAt = now;
        item.views++;
        item.pos = 0;
        item.done = false;
        all[item.id] = item;
        await commit(all, thumb ? { [thumbKey(item.id)]: thumb } : {});
        return item;
      }),

    // How far the reel got (furthest point reached), once it is in the history.
    progress: (id, pos, duration, done) =>
      serial(async () => {
        const all = await items();
        const item = all[id];
        if (!item?.watchedAt) return null;
        Object.assign(item, { pos: Math.max(0, pos || 0), duration: duration || item.duration, done: !!done });
        await local.set({ [ITEMS]: all });
        return item;
      }),

    setSaved: (meta, on, thumb) =>
      serial(async () => {
        if (!meta?.id) return null;
        const all = await items();
        const item = merge(all[meta.id] || blank(meta.id, Date.now()), meta);
        item.savedAt = on ? Date.now() : 0;
        all[item.id] = item;
        const keepThumb = on && thumb && !(await local.get(thumbKey(item.id)))[thumbKey(item.id)];
        await commit(all, keepThumb ? { [thumbKey(item.id)]: thumb } : {});
        return all[item.id] || null;
      }),

    // Take reels out of one list ('history' or 'saved'); a reel in neither is deleted with its thumbnail.
    remove: (ids, list) =>
      serial(async () => {
        const all = await items();
        for (const id of ids) {
          if (!all[id]) continue;
          if (list === 'saved') all[id].savedAt = 0;
          else all[id].watchedAt = 0;
        }
        await commit(all);
      }),

    // Clear the history watched since a time (0 = all of it). Watch later stays.
    clearHistory: (since = 0) =>
      serial(async () => {
        const all = await items();
        for (const it of Object.values(all)) if (it.watchedAt && it.watchedAt >= since) it.watchedAt = 0;
        await commit(all);
      }),

    setPrefs: (patch) =>
      serial(async () => {
        const next = { ...(await prefs()), ...patch };
        if (!DELAYS.includes(next.delay)) next.delay = DEFAULT_PREFS.delay;
        next.paused = !!next.paused;
        await local.set({ [PREFS]: next });
        return next;
      }),

    async thumbs(ids) {
      return local.get(ids.map(thumbKey));
    },

    async exportAll() {
      const all = await items();
      const thumbs = await local.get(Object.keys(all).map(thumbKey));
      return { app: 'reel-quality', version: 1, exportedAt: Date.now(), items: Object.values(all).map((it) => ({ ...it, thumb: thumbs[thumbKey(it.id)] || '' })) };
    },

    // Merge an export in: the newer watch / save time wins for each reel. Returns how many reels were added or updated.
    importAll: (data) =>
      serial(async () => {
        if (data?.app !== 'reel-quality' || !Array.isArray(data.items)) throw new Error('not a Reel Quality export');
        const all = await items();
        const thumbs = {};
        let n = 0;
        for (const raw of data.items) {
          if (!/^\d{6,}$/.test(String(raw?.id))) continue;
          const id = String(raw.id);
          const now = Date.now();
          const item = all[id] || blank(id, now);
          const before = JSON.stringify(item);
          merge(item, { url: /^https:\/\/(www|web)\.facebook\.com\//.test(raw.url) ? raw.url : '', page: String(raw.page || '').slice(0, 200), caption: String(raw.caption || '').slice(0, 300), duration: +raw.duration || 0 });
          if (+raw.watchedAt > item.watchedAt) Object.assign(item, { watchedAt: +raw.watchedAt, pos: +raw.pos || 0, done: !!raw.done });
          if (+raw.savedAt > item.savedAt) item.savedAt = +raw.savedAt;
          item.firstAt = Math.min(item.firstAt, +raw.firstAt || now);
          item.views = Math.max(item.views, +raw.views || 0);
          if (!item.watchedAt && !item.savedAt) continue;
          all[id] = item;
          if (typeof raw.thumb === 'string' && raw.thumb.startsWith('data:image/')) thumbs[thumbKey(id)] = raw.thumb;
          if (JSON.stringify(item) !== before) n++;
        }
        await commit(all, thumbs);
        return n;
      }),
  };
  globalThis.RQStore = RQStore;
})();

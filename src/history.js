// Watch history and Watch later on the page side. Storage lives in the extension (see store.js); this file
// talks to it through bridge.js, follows the reel on screen and decides when it counts as watched.
//
// A reel counts once it has actually played for a few seconds (3 by default; paused, buffering or a hidden
// tab don't count), so reels skipped while scrolling stay out of the history. After that, how far it got is
// kept up to date, and a reel that looped is marked as watched to the end.
(() => {
  const FBQ = (window.__FBQ ||= {});
  const FLUSH_EVERY = 15_000; // ms between progress writes while a recorded reel plays
  const ANSWER_WITHIN = 5000; // ms to wait for the extension before giving up on a call
  // px, longer side of the stored thumbnail: sharp on a library card on a 2x screen. WebP keeps it around 20 KB.
  const THUMB = 480;

  // --- calls into the extension ---------------------------------------------------

  let seq = 0;
  const waiting = new Map();
  const changeListeners = new Set();
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (e.source !== window || !m || typeof m !== 'object') return;
    if (m.__rq === 'res' && waiting.has(m.id)) {
      const { resolve, reject } = waiting.get(m.id);
      waiting.delete(m.id);
      m.error ? reject(new Error(m.error)) : resolve(m.result);
    } else if (m.__rq === 'changed') {
      for (const fn of changeListeners) fn();
    }
  });
  function call(op, ...args) {
    return new Promise((resolve, reject) => {
      const id = `fbq-${++seq}-${Math.random().toString(36).slice(2)}`;
      waiting.set(id, { resolve, reject });
      window.postMessage({ __rq: 'req', id, op, args }, location.origin);
      setTimeout(() => waiting.delete(id) && reject(new Error('[FBQ] no answer from the extension')), ANSWER_WITHIN);
    });
  }

  // --- what we store about a reel ----------------------------------------------------

  // Only the Reels viewer counts: /reel/<id> (and /reels/<id>) in the address bar.
  const onReelPage = () => /^\/reels?\/\d+/.test(location.pathname);
  function reelId(entry) {
    if (!onReelPage()) return null;
    const id = entry?.id || /^\/reels?\/(\d+)/.exec(location.pathname)[1];
    return /^\d{6,}$/.test(id) ? id : null;
  }

  const visibleText = (node) => {
    const p = node.parentElement;
    if (!p || p.closest('script, style, [aria-hidden="true"]')) return null;
    const r = p.getBoundingClientRect();
    return r.width && r.height ? r : null;
  };

  // Page name: the first text right of the page's avatar, on its row. Caption: the user text below that row,
  // inside the video (Facebook marks user text with dir="auto"). Both are best effort: the layout may change.
  function scrape(video, avatar, scope) {
    const out = { page: '', caption: '' };
    const a = avatar?.isConnected && avatar.getBoundingClientRect();
    if (!a || !scope) return out;
    const v = video.getBoundingClientRect();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let pageX = Infinity;
    const blocks = new Map(); // dir="auto" block (or the text's parent) -> its text
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (text.length < 2) continue;
      const r = visibleText(n);
      if (!r || r.left < v.left - 2 || r.right > v.right + 2) continue;
      const cy = r.top + r.height / 2;
      if (cy >= a.top && cy <= a.bottom && r.left >= a.right - 2 && r.left < pageX) {
        pageX = r.left;
        out.page = text;
      } else if (r.top >= a.bottom - 2 && r.bottom <= v.bottom + 2) {
        const block = n.parentElement.closest('[dir="auto"]') || n.parentElement;
        blocks.set(block, `${blocks.get(block) || ''} ${text}`.trim());
      }
    }
    out.caption = [...blocks.values()].sort((x, y) => y.length - x.length)[0] || '';
    out.page = out.page.slice(0, 200);
    out.caption = out.caption.slice(0, 300);
    return out;
  }

  const canvas = document.createElement('canvas');
  function snapshot(video) {
    try {
      if (!video || video.readyState < 2 || !video.videoWidth) return '';
      const scale = Math.min(1, THUMB / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', 0.8);
    } catch {
      return ''; // a tainted or not yet decodable frame
    }
  }

  // --- following the reel on screen -------------------------------------------------

  let prefs = { delay: 3, paused: false };
  let session = null; // { id, video, before, saved, ready, played, recorded, furthest, done, lastTime, lastTick, flushedAt, startedAt }
  let describe = () => ({}); // set by tick(): page name, caption and thumbnail of the reel on screen
  const listeners = new Set();
  const round = (sec) => Math.round(sec * 10) / 10;
  const notify = () => listeners.forEach((fn) => fn());

  function refresh(s) {
    call('status', s.id)
      .then((st) => {
        prefs = st.prefs;
        if (session !== s) return;
        if (!s.ready) s.before = st.item?.watchedAt ? st.item : null; // what the history said before this visit
        s.saved = !!st.item?.savedAt;
        s.ready = true;
        notify();
      })
      .catch(() => {});
  }

  function start(video, id) {
    const now = performance.now();
    session = { id, video, before: null, saved: false, ready: false, played: 0, recorded: false, furthest: 0, done: false, lastTime: video.currentTime, lastTick: now, flushedAt: now, startedAt: Date.now() };
    refresh(session);
    notify();
  }

  function meta(s) {
    const d = s.video.duration;
    return { id: s.id, url: `https://www.facebook.com/reel/${s.id}`, duration: Number.isFinite(d) ? round(d) : 0, ...describe(s.video) };
  }

  function flush(s) {
    if (!s?.recorded) return;
    s.flushedAt = performance.now();
    const d = s.video.duration;
    const pos = s.done && Number.isFinite(d) ? d : s.furthest;
    call('progress', s.id, round(pos), Number.isFinite(d) ? round(d) : 0, s.done).catch(() => {});
  }

  function record(s) {
    s.recorded = true;
    const { thumb, ...m } = meta(s);
    call('visit', m, thumb || snapshot(s.video)).then(() => flush(s), () => (s.recorded = false));
  }

  /**
   * Call regularly with the reel on screen (or nulls). `info(video)` returns { page, caption } for it.
   */
  function tick(video, entry, info) {
    describe = info;
    const id = video && reelId(entry);
    if (session && (session.id !== id || session.video !== video)) {
      flush(session);
      session = null;
      notify();
    }
    if (!id) return;
    if (!session) start(video, id);
    const s = session;
    const now = performance.now();
    const dt = now - s.lastTick;
    s.lastTick = now;
    const playing = !video.paused && !video.ended && video.readyState >= 3 && !document.hidden;
    if (playing && dt < 2000) s.played += dt;
    const t = video.currentTime;
    const d = video.duration;
    if (Number.isFinite(d) && d > 0) {
      if (video.ended || (t + 1 < s.lastTime && s.lastTime > d - 1.5)) s.done = true; // reached the end, or looped
      s.furthest = Math.max(s.furthest, Math.min(t, d));
    }
    s.lastTime = t;
    if (!s.recorded && s.ready && !prefs.paused && video.readyState >= 2 && s.played >= prefs.delay * 1000) record(s);
    if (s.recorded && now - s.flushedAt > FLUSH_EVERY) flush(s);
  }

  changeListeners.add(() => session && refresh(session));
  addEventListener('pagehide', () => flush(session));
  document.addEventListener('visibilitychange', () => document.hidden && flush(session));

  FBQ.history = {
    tick,
    scrape,
    snapshot,
    onChange: (fn) => listeners.add(fn),
    get session() {
      return session;
    },
    get prefs() {
      return prefs;
    },
    // Watch later on/off for the reel on screen. Returns the new state, or null when there is no reel.
    toggleSaved() {
      const s = session;
      if (!s) return null;
      s.saved = !s.saved;
      notify();
      const { thumb, ...m } = meta(s);
      call('setSaved', m, s.saved, s.saved ? thumb || snapshot(s.video) : '').catch(() => {
        s.saved = !s.saved; // the extension didn't answer (e.g. it was just updated): show the real state
        notify();
      });
      return s.saved;
    },
    setDelay(delay) {
      prefs = { ...prefs, delay };
      notify();
      return call('setDelay', delay).catch(() => {});
    },
  };
})();

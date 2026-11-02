// Helpers shared by the toolbar popup and the library page.
(() => {
  const { t, rtl } = window.__FBQ.i18n;
  const ICONS = {
    bookmark: 'M6.5 3.5h11v17L12 16.5l-5.5 4z',
    close: 'M6 6l12 12M18 6 6 18',
    external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  };

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('aria-') || k === 'role') node.setAttribute(k, v);
      else node[k] = v;
    }
    for (const c of children) if (c != null) node.append(c);
    return node;
  }

  function icon(name) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.append(path);
    return svg;
  }

  // Fill each <html> text marked data-t / data-t-placeholder / data-t-title from the strings.
  function translatePage() {
    document.documentElement.dir = rtl() ? 'rtl' : 'ltr';
    for (const n of document.querySelectorAll('[data-t]')) n.textContent = t(n.dataset.t).replace(/^🔖\s*/u, ''); // the tabs need no icon
    for (const n of document.querySelectorAll('[data-t-placeholder]')) n.placeholder = t(n.dataset.tPlaceholder);
    for (const n of document.querySelectorAll('[data-t-title]')) n.title = t(n.dataset.tTitle);
  }

  // The reels of one list, newest first, narrowed by a search over page name and caption (accents ignored).
  const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  function listOf(items, list, query) {
    const key = list === 'saved' ? 'savedAt' : 'watchedAt';
    const words = fold(query || '').split(/\s+/).filter(Boolean);
    return Object.values(items)
      .filter((it) => it[key] > 0)
      .filter((it) => !words.length || words.every((w) => fold(`${it.page} ${it.caption}`).includes(w)))
      .sort((a, b) => b[key] - a[key]);
  }
  const counts = (items) => ({
    history: Object.values(items).filter((it) => it.watchedAt).length,
    saved: Object.values(items).filter((it) => it.savedAt).length,
  });

  const thumbCache = new Map(); // id -> data URL, so a re-render doesn't flash empty boxes
  function thumb(item) {
    const box = el('div', { className: 'thumb' });
    if (thumbCache.has(item.id)) box.append(el('img', { src: thumbCache.get(item.id), alt: '' }));
    const frac = item.done ? 1 : item.duration ? Math.min(1, item.pos / item.duration) : 0;
    if (item.watchedAt && frac > 0) box.append(el('div', { className: 'bar' }, [el('i', { style: `width:${(frac * 100).toFixed(1)}%` })]));
    return box;
  }

  // Load thumbnails for the rows that are on screen, a page of them at a time.
  function loadThumbs(rows) {
    const pending = new Map();
    let timer = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        pending.set(e.target.dataset.id, e.target);
      }
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const batch = new Map(pending);
        pending.clear();
        const found = await RQStore.thumbs([...batch.keys()]);
        for (const [id, row] of batch) {
          const src = found[RQStore.thumbKey(id)];
          if (src) thumbCache.set(id, src);
          const box = row.querySelector('.thumb');
          if (src && box && !box.querySelector('img')) box.prepend(el('img', { src, alt: '', loading: 'lazy' }));
        }
      }, 30);
    }, { rootMargin: '200px' });
    for (const r of rows) if (!thumbCache.has(r.dataset.id)) io.observe(r);
    return io;
  }

  // Open a reel: in the current tab when it is already on Facebook (the popup), otherwise in a new one.
  async function openReel(item, { newTab = false, background = false } = {}) {
    const url = /^https:\/\/(www|web)\.facebook\.com\//.test(item.url) ? item.url : `https://www.facebook.com/reel/${item.id}`;
    if (!newTab) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && /^https:\/\/(www|web)\.facebook\.com\//.test(tab.url || '')) return chrome.tabs.update(tab.id, { url });
    }
    return chrome.tabs.create({ url, active: !background });
  }

  const pageName = (item) => item.page || 'Facebook Reel';
  const metaLine = (item, list) => {
    const parts = [window.__FBQ.fmt.ago(list === 'saved' ? item.savedAt : item.watchedAt)];
    if (item.duration) parts.push(window.__FBQ.fmt.clock(item.duration));
    return parts.join(' · ');
  };

  window.RQPage = { el, icon, translatePage, listOf, counts, thumb, loadThumbs, openReel, pageName, metaLine };
})();

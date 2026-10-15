// Capture DASH manifests from Facebook's network traffic and figure out which <video> each belongs to.
//
// Association chain: FB player downloads a segment (URL path == a BaseURL in some manifest)
// -> appends a buffer of the same byteLength to a SourceBuffer -> that SourceBuffer's MediaSource
// -> the blob: URL created for it -> video.src. Fallback: /reel/<id> in the address bar.
(() => {
  const FBQ = (window.__FBQ ||= {});
  const MANIFEST_KEYS = ['dash_manifest', 'manifest_xml'];
  const ID_KEYS = ['videoId', 'video_id', 'id'];

  const byId = new Map(); // video id -> entry
  const byPath = new Map(); // BaseURL pathname -> entry
  const byXml = new Map(); // manifest text -> entry
  const recentSizes = new Map(); // segment byteLength -> entry
  const blobToMs = new Map(); // blob: URL -> WeakRef<MediaSource>
  const sbToMs = new WeakMap();
  const msToEntry = new WeakMap();

  FBQ.fetch = window.fetch.bind(window);
  FBQ.manifests = byId; // handy for debugging in the console

  const pathOf = (url) => {
    try {
      return new URL(url, location.href).pathname;
    } catch {
      return null;
    }
  };

  function register(xml, id) {
    let entry = byXml.get(xml);
    if (!entry) {
      const reps = FBQ.parseMpd(xml);
      if (!reps.length) return;
      entry = { id, reps };
      byXml.set(xml, entry);
      for (const r of reps) byPath.set(pathOf(r.url), entry);
    }
    if (id) {
      entry.id ||= id;
      byId.set(id, entry);
    }
  }

  function findId(chain) {
    for (let i = chain.length - 1; i >= Math.max(0, chain.length - 6); i--) {
      for (const k of ID_KEYS) {
        const v = chain[i][k];
        if ((typeof v === 'string' || typeof v === 'number') && /^\d{6,}$/.test(String(v))) return String(v);
      }
    }
    return null;
  }

  function walk(node, chain, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 80) return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v, chain, depth + 1);
      return;
    }
    chain.push(node);
    for (const k of MANIFEST_KEYS) {
      if (typeof node[k] === 'string' && node[k].includes('<MPD')) register(node[k], findId(chain));
    }
    for (const k in node) {
      const v = node[k];
      if (v && typeof v === 'object') walk(v, chain, depth + 1);
    }
    chain.pop();
  }

  // Last resort for payloads that are not clean JSON: pull the manifest strings out directly.
  function scanRegex(text) {
    for (const m of text.matchAll(/"(?:dash_manifest|manifest_xml)":("(?:[^"\\]|\\.)*")/g)) {
      let xml;
      try {
        xml = JSON.parse(m[1]);
      } catch {
        continue;
      }
      if (!xml.includes('<MPD')) continue;
      const before = text.slice(Math.max(0, m.index - 4000), m.index);
      const ids = [...before.matchAll(/"(?:videoId|video_id|id)":"(\d{6,})"/g)];
      register(xml, ids.at(-1)?.[1] || null);
    }
  }

  function scanText(text) {
    if (!text || !MANIFEST_KEYS.some((k) => text.includes(k))) return;
    const body = text.replace(/^\s*for\s*\(;;\);/, '');
    try {
      walk(JSON.parse(body), []);
      return;
    } catch {}
    let parsed = false;
    for (const line of body.split('\n')) {
      if (!line.trim()) continue;
      try {
        walk(JSON.parse(line), []);
        parsed = true;
      } catch {}
    }
    if (!parsed) scanRegex(body);
  }

  function noteSegment(url, byteLength) {
    const entry = byPath.get(pathOf(url));
    if (!entry || !byteLength) return;
    recentSizes.delete(byteLength);
    recentSizes.set(byteLength, entry);
    if (recentSizes.size > 400) recentSizes.delete(recentSizes.keys().next().value);
  }

  // --- network hooks ---------------------------------------------------------

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__fbqUrl = String(url);
    return xhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', () => {
      try {
        const type = this.responseType;
        if (type === '' || type === 'text') scanText(this.responseText);
        else if (type === 'json') walk(this.response, []);
        else if (type === 'arraybuffer' && this.response) noteSegment(this.__fbqUrl, this.response.byteLength);
      } catch {}
    });
    return xhrSend.apply(this, args);
  };

  window.fetch = function (input, init) {
    const promise = FBQ.fetch(input, init);
    const url = typeof input === 'string' ? input : input?.url || String(input);
    promise
      .then((res) => {
        if (byPath.has(pathOf(url))) {
          res.clone().arrayBuffer().then((b) => noteSegment(url, b.byteLength), () => {});
          return;
        }
        const type = res.headers.get('content-type') || '';
        if (/\/api\/graphql|\/ajax\//.test(url) || type.includes('json')) {
          res.clone().text().then(scanText, () => {});
        }
      })
      .catch(() => {});
    return promise;
  };

  // Manifests for the first reel are server-rendered into <script type="application/json">.
  const scannedScripts = new WeakSet();
  function scanScripts() {
    for (const s of document.querySelectorAll('script[type="application/json"]')) {
      if (scannedScripts.has(s)) continue;
      scannedScripts.add(s);
      scanText(s.textContent);
    }
  }
  document.addEventListener('DOMContentLoaded', scanScripts);
  let scanQueued = false;
  new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => {
      scanQueued = false;
      if (document.readyState !== 'loading') scanScripts();
    }, 300);
  }).observe(document.documentElement, { childList: true, subtree: true });

  // --- MediaSource hooks -----------------------------------------------------

  const createObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (obj) {
    const url = createObjectURL.call(this, obj);
    if (obj instanceof MediaSource) blobToMs.set(url, new WeakRef(obj));
    return url;
  };
  const revokeObjectURL = URL.revokeObjectURL;
  URL.revokeObjectURL = function (url) {
    blobToMs.delete(url);
    return revokeObjectURL.call(this, url);
  };

  const addSourceBuffer = MediaSource.prototype.addSourceBuffer;
  MediaSource.prototype.addSourceBuffer = function (...args) {
    const sb = addSourceBuffer.apply(this, args);
    sbToMs.set(sb, this);
    return sb;
  };

  const appendBuffer = SourceBuffer.prototype.appendBuffer;
  SourceBuffer.prototype.appendBuffer = function (data) {
    const entry = recentSizes.get(data?.byteLength);
    const ms = entry && sbToMs.get(this);
    if (ms) msToEntry.set(ms, entry);
    return appendBuffer.call(this, data);
  };

  FBQ.entryForVideo = function entryForVideo(video) {
    const ms = blobToMs.get(video.currentSrc || video.src)?.deref();
    const entry = ms && msToEntry.get(ms);
    if (entry) return entry;
    const reelId = /\/reels?\/(\d+)/.exec(location.pathname)?.[1];
    return (reelId && byId.get(reelId)) || null;
  };
})();

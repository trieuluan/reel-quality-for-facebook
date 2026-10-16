// "Expand landscape clip": many Reels are a horizontal clip pasted into a vertical 9:16 frame with
// black bars (often with a caption in the bar). We find that clip in the frame and show it large
// in a viewer over the page, drawn live from the video. Facebook's player keeps running underneath.
(() => {
  const FBQ = (window.__FBQ ||= {});
  const SAMPLE_W = 96; // detection works on a small copy of the frame
  const MIN_ASPECT = 1.2; // only offer it when the clip inside is clearly landscape
  // Common shapes for clips pasted into reels. A measured band that is shorter than any of these
  // usually means dark footage blended into the black bars, so we fall back to 16:9.
  const ASPECTS = [16 / 9, 1.85, 2, 2.35, 2.39, 4 / 3, 3 / 2];
  const LIT = 18; // luma above which a pixel is not "bar black"
  const CHANGED = 12; // luma change that counts as motion between two samples

  const probe = document.createElement('canvas');
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });
  const memory = new WeakMap(); // video -> evidence gathered over several frames

  // Per-pixel evidence over time: was it ever bright, and how often did it change.
  // Bars stay black and captions in them rarely change; the clip moves almost all the time.
  function sample(video, w, h) {
    probe.width = w;
    probe.height = h;
    probeCtx.drawImage(video, 0, 0, w, h);
    const px = probeCtx.getImageData(0, 0, w, h).data;
    let m = memory.get(video);
    if (!m || m.w !== w || m.h !== h || m.src !== video.currentSrc) {
      m = { w, h, src: video.currentSrc, maxL: new Uint8Array(w * h), changes: new Uint16Array(w * h), prev: null, compares: 0, time: -1 };
      memory.set(video, m);
    }
    if (video.currentTime === m.time) return m; // same frame as last time, nothing new
    m.time = video.currentTime;
    const luma = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      luma[i] = px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11;
      if (luma[i] > m.maxL[i]) m.maxL[i] = luma[i];
      if (m.prev && Math.abs(luma[i] - m.prev[i]) > CHANGED) m.changes[i]++;
    }
    if (m.prev) m.compares++;
    m.prev = luma;
    return m;
  }

  // Returns the clip rectangle as fractions of the video frame ({ x, y, w, h }), or null.
  FBQ.detectLandscapeClip = function detectLandscapeClip(video) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || video.readyState < 2 || vh <= vw) return null;
    const w = SAMPLE_W;
    const h = Math.round((SAMPLE_W * vh) / vw);
    let m;
    try {
      m = sample(video, w, h);
    } catch {
      return null; // cross-origin frame: canvas is tainted
    }
    const moving = m.compares >= 3 ? (i) => m.changes[i] / m.compares >= 0.25 : () => false;

    // Clip rows: mostly moving, or bright nearly edge to edge (a caption box is not that wide).
    const clipRow = [];
    const barRow = []; // black apart from the odd caption
    for (let y = 0; y < h; y++) {
      let mov = 0;
      let lit = 0;
      for (let x = 0; x < w; x++) {
        if (moving(y * w + x)) mov++;
        if (m.maxL[y * w + x] > LIT) lit++;
      }
      clipRow.push(mov / w > 0.2 || lit / w > 0.85);
      barRow.push(mov / w < 0.2 && lit / w < 0.5);
    }
    // Longest run of clip rows, tolerating short dark stretches inside the clip.
    let best = null;
    let start = -1;
    let last = -1;
    const commit = () => {
      if (start >= 0 && (!best || last + 1 - start > best.end - best.start)) best = { start, end: last + 1 };
    };
    for (let y = 0; y < h; y++) {
      if (!clipRow[y]) continue;
      if (start < 0 || y - last > 4) {
        commit();
        start = y;
      }
      last = y;
    }
    commit();
    if (!best || best.end - best.start < h * 0.08) return null;

    // A landscape clip in a vertical frame spans the full width (it is the narrow side), so only the
    // vertical extent is measured. Dark footage would make any side-bar guess unreliable anyway.
    const left = 0;
    const right = w;

    // Measured band in frame pixels. Sharp, bright edges usually land on a standard shape; if the
    // band is shorter than 16:9, dark parts of the clip were taken for bars, so use a 16:9 window.
    const clipW = ((right - left) / w) * vw;
    let top = (best.start / h) * vh;
    let height = ((best.end - best.start) / h) * vh;
    const measured = clipW / height;
    const standard = ASPECTS.find((a) => Math.abs(measured - a) / a < 0.05);
    if (standard) {
      const exact = clipW / standard;
      top += (height - exact) / 2;
      height = exact;
    } else if (measured > 16 / 9) {
      const want = clipW / (16 / 9);
      // Most edits center the clip; keep that if it still covers what we saw, else just cover it.
      const centered = (vh - want) / 2;
      top = centered <= top && centered + want >= top + height ? centered : Math.min(top, Math.max(0, top + height - want));
      height = want;
    }
    top = Math.max(0, Math.min(vh - height, top));

    // Everything outside the clip must look like bars, otherwise this is just a normal vertical reel.
    const clipFirst = Math.floor((top / vh) * h);
    const clipLast = Math.ceil(((top + height) / vh) * h);
    let outside = 0;
    let bars = 0;
    for (let y = 0; y < h; y++) {
      if (y >= clipFirst && y < clipLast) continue;
      outside++;
      if (barRow[y]) bars++;
    }
    if (!outside || bars / outside < 0.7) return null;
    // Trim a hair off the edges so no bar line shows when scaled up.
    const trim = vh * 0.004;
    const rect = { x: left / w, y: (top + trim) / vh, w: (right - left) / w, h: (height - 2 * trim) / vh };
    if (rect.h > 0.85) return null;
    return (rect.w * vw) / (rect.h * vh) >= MIN_ASPECT ? rect : null;
  };

  const SHEET = new CSSStyleSheet();
  const CSS = `
    .viewer { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.9); cursor: zoom-out; }
    .viewer canvas { display: block; border-radius: 8px; box-shadow: 0 20px 60px rgba(0,0,0,.6); cursor: pointer; }
    .viewer .tip { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); color: #fff; opacity: .6;
      font: 13px system-ui, -apple-system, "Segoe UI", sans-serif; }
  `;
  SHEET.replaceSync(CSS);

  class ClipViewer {
    constructor(root, getSource, rect, tip, onClose) {
      this.getSource = getSource; // returns the <video> to draw from (our HD layer when it is active)
      this.rect = rect;
      this.onClose = onClose;
      this.el = document.createElement('div');
      this.el.className = 'viewer';
      this.canvas = document.createElement('canvas');
      const tipEl = document.createElement('div');
      tipEl.className = 'tip';
      tipEl.textContent = tip;
      this.el.append(this.canvas, tipEl);
      if (!root.adoptedStyleSheets.includes(SHEET)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, SHEET];
      root.append(this.el);

      this.el.addEventListener('click', (e) => {
        if (e.target !== this.canvas) return this.close();
        const fb = getSource(true);
        fb.paused ? fb.play().catch(() => {}) : fb.pause();
      });
      this.onKey = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          this.close();
        }
      };
      document.addEventListener('keydown', this.onKey, true);
      this.draw = this.draw.bind(this);
      this.raf = requestAnimationFrame(this.draw);
    }

    draw() {
      this.raf = requestAnimationFrame(this.draw);
      const src = this.getSource();
      if (!src?.videoWidth) return;
      const rect = typeof this.rect === 'function' ? this.rect() : this.rect; // may keep refining while open
      if (!rect) return;
      const { x, y, w, h } = rect;
      const sw = src.videoWidth * w;
      const sh = src.videoHeight * h;
      const scale = Math.min((innerWidth * 0.92) / sw, (innerHeight * 0.85) / sh);
      const cssW = Math.round(sw * scale);
      const cssH = Math.round(sh * scale);
      const dpr = devicePixelRatio || 1;
      if (this.canvas.width !== Math.round(cssW * dpr)) {
        this.canvas.width = Math.round(cssW * dpr);
        this.canvas.height = Math.round(cssH * dpr);
        this.canvas.style.width = `${cssW}px`;
        this.canvas.style.height = `${cssH}px`;
      }
      const ctx = this.canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, src.videoWidth * x, src.videoHeight * y, sw, sh, 0, 0, this.canvas.width, this.canvas.height);
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      cancelAnimationFrame(this.raf);
      document.removeEventListener('keydown', this.onKey, true);
      this.el.remove();
      this.onClose?.();
    }
  }

  FBQ.ClipViewer = ClipViewer;
})();

// "Expand landscape clip": many Reels are a horizontal clip pasted into a vertical 9:16 frame with
// black bars (often with a caption in the bar). We find that clip in the frame and show it large
// in a viewer over the page, drawn live from the video. Facebook's player keeps running underneath.
(() => {
  const FBQ = (window.__FBQ ||= {});
  const SAMPLE_W = 64; // detection works on a tiny copy of the frame
  const MIN_ASPECT = 1.2; // only offer it when the clip inside is clearly landscape

  const probe = document.createElement('canvas');
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });

  // Returns the clip rectangle as fractions of the video frame ({ x, y, w, h }), or null.
  FBQ.detectLandscapeClip = function detectLandscapeClip(video) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || video.readyState < 2 || vh <= vw) return null;
    const w = SAMPLE_W;
    const h = Math.round((SAMPLE_W * vh) / vw);
    probe.width = w;
    probe.height = h;
    let data;
    try {
      probeCtx.drawImage(video, 0, 0, w, h);
      data = probeCtx.getImageData(0, 0, w, h).data;
    } catch {
      return null; // cross-origin frame: canvas is tainted
    }
    const lit = (i) => data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11 > 14;

    // A clip row is mostly non-black; caption rows in the bars are mostly black with some text.
    const rowFill = [];
    for (let y = 0; y < h; y++) {
      let n = 0;
      for (let x = 0; x < w; x++) if (lit((y * w + x) * 4)) n++;
      rowFill.push(n / w);
    }
    // Longest run of filled rows, tolerating a couple of dark rows inside the clip.
    let best = null;
    let start = -1;
    let last = -1;
    const commit = () => {
      if (start >= 0 && (!best || last + 1 - start > best.end - best.start)) best = { start, end: last + 1 };
    };
    for (let y = 0; y < h; y++) {
      if (rowFill[y] <= 0.5) continue;
      if (start < 0 || y - last > 3) {
        commit();
        start = y;
      }
      last = y;
    }
    commit();
    if (!best) return null;
    const top = best.start + 1; // step inside by one sample row to avoid the bar edge
    const bottom = best.end - 1;
    if (bottom - top < h * 0.15 || bottom - top > h * 0.85) return null;

    let left = w;
    let right = 0;
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let y = top; y < bottom; y++) if (lit((y * w + x) * 4)) n++;
      if (n / (bottom - top) > 0.3) {
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
      }
    }
    if (right - left < w * 0.5) return null;
    const rect = { x: left / w, y: top / h, w: (right - left) / w, h: (bottom - top) / h };
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
      const { x, y, w, h } = this.rect;
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

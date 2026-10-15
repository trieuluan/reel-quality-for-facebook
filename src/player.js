// A tiny video-only DASH player laid over Facebook's own <video>.
//
// Facebook's player keeps running underneath (it still owns audio, controls, looping and
// seeking); we only paint the chosen quality on top and follow its clock. If our layer is
// not ready at the current time it turns transparent, so Facebook's picture shows through.
(() => {
  const FBQ = (window.__FBQ ||= {});
  const AHEAD = 20; // seconds buffered past the current time
  const BEHIND = 20; // seconds kept behind it
  const MAX_DRIFT = 0.6; // hard re-sync above this, otherwise nudge playbackRate

  async function fetchRange(url, { start, end }) {
    const want = end - start + 1;
    const attempts = [
      () => [url, { headers: { Range: `bytes=${start}-${end}` } }],
      () => {
        const u = new URL(url);
        u.searchParams.set('bytestart', start);
        u.searchParams.set('byteend', end);
        return [u.href, {}];
      },
    ];
    for (const make of attempts) {
      const [u, opts] = make();
      const ctrl = new AbortController();
      try {
        const res = await FBQ.fetch(u, { ...opts, signal: ctrl.signal });
        const len = +res.headers.get('content-length');
        if (!res.ok || (len && len !== want)) {
          ctrl.abort(); // server ignored the range; don't download the whole file
          continue;
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength === want) return buf;
      } catch {}
    }
    throw new Error(`[FBQ] could not fetch bytes ${start}-${end}`);
  }

  // Segment index (ISO-BMFF 'sidx' box) -> [{ start, end, range }] in seconds / absolute bytes.
  function parseSidx(buf, indexStart) {
    const v = new DataView(buf);
    let p = 0;
    for (;;) {
      if (p + 8 > v.byteLength) throw new Error('[FBQ] sidx box not found');
      const size = v.getUint32(p);
      const type = String.fromCharCode(v.getUint8(p + 4), v.getUint8(p + 5), v.getUint8(p + 6), v.getUint8(p + 7));
      if (type === 'sidx') break;
      if (size < 8) throw new Error('[FBQ] bad box');
      p += size;
    }
    const anchor = indexStart + p + v.getUint32(p); // first_offset counts from the byte after the box
    const version = v.getUint8(p + 8);
    p += 16; // header, version/flags, reference_ID
    const timescale = v.getUint32(p);
    p += 4;
    let time, offset;
    if (version === 0) {
      time = v.getUint32(p);
      offset = v.getUint32(p + 4);
      p += 8;
    } else {
      time = Number(v.getBigUint64(p));
      offset = Number(v.getBigUint64(p + 8));
      p += 16;
    }
    const count = v.getUint16(p + 2);
    p += 4;
    const segments = [];
    let byte = anchor + offset;
    for (let i = 0; i < count; i++, p += 12) {
      const size = v.getUint32(p) & 0x7fffffff;
      const duration = v.getUint32(p + 4);
      segments.push({ start: time / timescale, end: (time + duration) / timescale, range: { start: byte, end: byte + size - 1 } });
      byte += size;
      time += duration;
    }
    return segments;
  }

  class OverlayPlayer {
    constructor(source, rep, onEnd) {
      this.source = source;
      this.rep = rep;
      this.onEnd = onEnd;
      this.srcAtStart = source.currentSrc || source.src;
      this.dead = false;
      this.busy = false;
      this.failures = 0;

      const v = (this.video = document.createElement('video'));
      v.muted = true;
      v.playsInline = true;
      v.dataset.fbq = '';
      v.style.cssText = 'position:absolute;pointer-events:none;opacity:0;margin:0;padding:0;background:transparent;';
      this.ms = new MediaSource();
      this.blobUrl = URL.createObjectURL(this.ms);
      v.src = this.blobUrl;
      this.ms.addEventListener('sourceopen', () => this.open().catch((e) => this.fail(e)), { once: true });
      source.insertAdjacentElement('afterend', v);

      this.tick = this.tick.bind(this);
      this.raf = requestAnimationFrame(this.tick);
      this.pumpTimer = setInterval(() => this.pump(), 300);
      this.onSeek = () => this.pump();
      source.addEventListener('seeking', this.onSeek);
    }

    async open() {
      const r = this.rep;
      this.sb = this.ms.addSourceBuffer(`${r.mime}; codecs="${r.codecs}"`);
      const [init, index] = await Promise.all([fetchRange(r.url, r.init), fetchRange(r.url, r.index)]);
      if (this.dead) return;
      this.segments = parseSidx(index, r.index.start);
      const duration = Number.isFinite(this.source.duration) ? this.source.duration : this.segments.at(-1)?.end;
      if (duration) this.ms.duration = duration;
      await this.sbOp(() => this.sb.appendBuffer(init));
      this.pump();
    }

    sbOp(run) {
      return new Promise((resolve, reject) => {
        const done = () => {
          this.sb.removeEventListener('updateend', done);
          this.sb.removeEventListener('error', done);
          this.dead ? reject(new Error('stopped')) : resolve();
        };
        this.sb.addEventListener('updateend', done);
        this.sb.addEventListener('error', done);
        run();
      });
    }

    isBuffered(seg) {
      const mid = (seg.start + seg.end) / 2;
      const b = this.sb.buffered;
      for (let i = 0; i < b.length; i++) if (b.start(i) <= mid && b.end(i) >= mid) return true;
      return false;
    }

    async pump() {
      if (this.busy || this.dead || !this.segments || this.ms.readyState !== 'open') return;
      this.busy = true;
      try {
        const t = this.source.currentTime;
        const b = this.sb.buffered;
        if (b.length && t - b.start(0) > BEHIND + 5) await this.sbOp(() => this.sb.remove(0, t - BEHIND));
        const seg = this.segments.find((s) => s.end > t && s.start < t + AHEAD && !this.isBuffered(s));
        if (seg) {
          const data = await fetchRange(this.rep.url, seg.range);
          if (!this.dead) await this.sbOp(() => this.sb.appendBuffer(data));
        }
        this.failures = 0;
      } catch (e) {
        if (++this.failures >= 5) this.fail(e);
      } finally {
        this.busy = false;
      }
    }

    tick() {
      if (this.dead) return;
      this.raf = requestAnimationFrame(this.tick);
      const fb = this.source;
      const me = this.video;
      // Facebook swapped the video under us (next reel reusing the element) or removed it.
      if (!fb.isConnected || (fb.currentSrc || fb.src) !== this.srcAtStart) return this.stop();

      const cs = getComputedStyle(fb);
      Object.assign(me.style, {
        left: `${fb.offsetLeft}px`,
        top: `${fb.offsetTop}px`,
        width: `${fb.offsetWidth}px`,
        height: `${fb.offsetHeight}px`,
        objectFit: cs.objectFit,
        objectPosition: cs.objectPosition,
        borderRadius: cs.borderRadius,
        transform: cs.transform,
        zIndex: cs.zIndex,
      });
      if (!this.segments) return;

      const drift = me.currentTime - fb.currentTime;
      if (fb.paused || fb.seeking) {
        if (!me.paused) me.pause();
        if (Math.abs(drift) > 0.05 && !me.seeking) me.currentTime = fb.currentTime;
      } else {
        if (Math.abs(drift) > MAX_DRIFT) {
          if (!me.seeking) me.currentTime = fb.currentTime;
        } else {
          const rate = fb.playbackRate * (1 - drift);
          me.playbackRate = Math.min(fb.playbackRate * 1.25, Math.max(fb.playbackRate * 0.75, rate));
        }
        if (me.paused && me.readyState >= 2) me.play().catch(() => {});
      }
      const inSync = me.readyState >= 2 && !me.seeking && Math.abs(me.currentTime - fb.currentTime) < 0.25;
      me.style.opacity = inSync ? '1' : '0';
    }

    fail(err) {
      console.warn('[FBQ] quality overlay stopped:', err);
      this.error = err;
      this.stop();
    }

    stop() {
      if (this.dead) return;
      this.dead = true;
      cancelAnimationFrame(this.raf);
      clearInterval(this.pumpTimer);
      this.source.removeEventListener('seeking', this.onSeek);
      this.video.removeAttribute('src');
      this.video.load();
      this.video.remove();
      URL.revokeObjectURL(this.blobUrl);
      this.onEnd?.(this);
    }
  }

  FBQ.OverlayPlayer = OverlayPlayer;
  FBQ.parseSidx = parseSidx;
})();

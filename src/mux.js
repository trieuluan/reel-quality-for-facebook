// Join Facebook's separate video-only and audio-only fragmented MP4 files into one playable file.
//
// Both inputs are DASH "on demand" files: ftyp, moov (one trak + mvex), sidx, then moof/mdat pairs.
// The output keeps that fragmented layout: one moov holding both traks, then every moof/mdat pair
// from both inputs ordered by start time. Each pair is copied byte for byte apart from the track ID
// and sequence number, so the trun data offsets (relative to their moof) stay valid.
(() => {
  const FBQ = (window.__FBQ ||= {});

  const type = (b, p) => String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);

  // Top-level boxes of b[start, end) as { type, start, end, body } (body = first byte after the header).
  function boxes(b, start = 0, end = b.length) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const out = [];
    for (let p = start; p + 8 <= end; ) {
      let size = v.getUint32(p);
      let body = p + 8;
      if (size === 1) {
        size = Number(v.getBigUint64(p + 8));
        body = p + 16;
      } else if (size === 0) {
        size = end - p;
      }
      if (size < 8 || p + size > end) throw new Error(`[FBQ] broken MP4 box at ${p}`);
      out.push({ type: type(b, p), start: p, end: p + size, body });
      p += size;
    }
    return out;
  }

  const child = (b, box, name) => boxes(b, box.body, box.end).find((c) => c.type === name);
  // Descend through a path of box types, e.g. find(b, trak, 'mdia', 'mdhd').
  function find(b, node, ...path) {
    for (const name of path) node = node && child(b, node, name);
    return node || null;
  }

  const view = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);

  function header(name, size) {
    const h = new Uint8Array(8);
    view(h).setUint32(0, size);
    for (let i = 0; i < 4; i++) h[4 + i] = name.charCodeAt(i);
    return h;
  }
  function box(name, ...parts) {
    const size = 8 + parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(size);
    out.set(header(name, size));
    let p = 8;
    for (const part of parts) {
      out.set(part, p);
      p += part.length;
    }
    return out;
  }

  // Full-box fields: version byte, then version-dependent offsets after the 4-byte version/flags.
  function setTime(b, at, version, value) {
    version ? view(b).setBigUint64(at, BigInt(Math.round(value))) : view(b).setUint32(at, Math.min(0xffffffff, Math.round(value)));
  }

  function parseInput(data, index) {
    const b = new Uint8Array(data);
    const top = boxes(b);
    const moov = top.find((x) => x.type === 'moov');
    const trak = moov && child(b, moov, 'trak');
    const mdhd = find(b, trak, 'mdia', 'mdhd');
    const mvhd = moov && child(b, moov, 'mvhd');
    const trex = find(b, moov, 'mvex', 'trex');
    if (!trak || !mdhd || !mvhd || !trex) throw new Error('[FBQ] not a fragmented MP4');
    const v = view(b);
    const mvhdV = b[mvhd.body];
    const mdhdV = b[mdhd.body];
    const fragments = [];
    for (let i = 0; i < top.length; i++) {
      if (top[i].type !== 'moof') continue;
      const moof = top[i];
      const mdat = top[i + 1]?.type === 'mdat' ? top[i + 1] : null;
      const traf = child(b, moof, 'traf');
      const tfdt = traf && child(b, traf, 'tfdt');
      if (!traf || !mdat) continue;
      const time = tfdt ? (b[tfdt.body] ? Number(v.getBigUint64(tfdt.body + 4)) : v.getUint32(tfdt.body + 4)) : 0;
      fragments.push({ input: index, moof, mdat, traf, time });
    }
    return {
      b,
      trak,
      trex,
      mvhd,
      movieScale: v.getUint32(mvhd.body + (mvhdV ? 20 : 12)),
      mediaScale: v.getUint32(mdhd.body + (mdhdV ? 20 : 12)),
      fragments,
    };
  }

  // Copy of the trak with a new track ID. Its durations are zeroed: in a fragmented file they only count
  // samples stored in the moov (none here), and Apple's players add them to the fragments' own length,
  // so a 30 s reel would show as 1 min. The last edit runs to the end of the media for the same reason;
  // earlier edits (start offsets) are rescaled to the output's movie timescale.
  function rewriteTrak(input, id, movieScale) {
    const b = input.b.slice(input.trak.start, input.trak.end);
    const root = { body: 8, end: b.length };
    const v = view(b);
    const tkhd = child(b, root, 'tkhd');
    const tkV = b[tkhd.body];
    v.setUint32(tkhd.body + (tkV ? 20 : 12), id);
    setTime(b, tkhd.body + (tkV ? 28 : 20), tkV, 0);
    const mdhd = find(b, root, 'mdia', 'mdhd');
    const mdV = b[mdhd.body];
    setTime(b, mdhd.body + (mdV ? 24 : 16), mdV, 0);
    const elst = find(b, root, 'edts', 'elst');
    if (elst) {
      const elV = b[elst.body];
      const count = v.getUint32(elst.body + 4);
      for (let i = 0, p = elst.body + 8; i < count; i++, p += elV ? 20 : 12) {
        const old = elV ? Number(v.getBigUint64(p)) : v.getUint32(p);
        setTime(b, p, elV, i === count - 1 ? 0 : (old * movieScale) / input.movieScale);
      }
    }
    return b;
  }

  /**
   * @param {{ data: ArrayBuffer, duration: number }[]} tracks  video first; duration in seconds (only fills mehd)
   * @returns {Blob} video/mp4
   */
  FBQ.muxMp4 = function muxMp4(tracks) {
    const inputs = tracks.map((t, i) => parseInput(t.data, i));
    const duration = Math.max(...tracks.map((t) => t.duration || 0));
    const main = inputs[0];
    const movieScale = main.movieScale;

    const mvhd = main.b.slice(main.mvhd.start, main.mvhd.end);
    const mvV = mvhd[8];
    setTime(mvhd, 8 + (mvV ? 24 : 16), mvV, 0); // see rewriteTrak; the real length goes in mehd
    view(mvhd).setUint32(mvhd.length - 4, inputs.length + 1); // next_track_ID

    const traks = inputs.map((input, i) => rewriteTrak(input, i + 1, movieScale));
    const trexes = inputs.map((input, i) => {
      const t = input.b.slice(input.trex.start, input.trex.end);
      view(t).setUint32(12, i + 1);
      return t;
    });
    const mehd = new Uint8Array(12); // version 1, 64-bit fragment_duration
    mehd[0] = 1;
    view(mehd).setBigUint64(4, BigInt(Math.round(duration * movieScale)));

    const ftyp = box('ftyp', ...['isom', '\0\0\x02\0', 'isom', 'iso6', 'mp41'].map((s) => Uint8Array.from(s, (c) => c.charCodeAt(0))));
    const moov = box('moov', mvhd, ...traks, box('mvex', box('mehd', mehd), ...trexes));

    // Interleave fragments by start time so players never have to read far ahead for the other track.
    const fragments = inputs
      .flatMap((input) => input.fragments)
      .sort((a, b) => a.time / inputs[a.input].mediaScale - b.time / inputs[b.input].mediaScale || a.input - b.input);

    const parts = [ftyp, moov];
    let offset = ftyp.length + moov.length;
    fragments.forEach((f, seq) => {
      const src = inputs[f.input].b;
      const moof = src.slice(f.moof.start, f.moof.end);
      const v = view(moof);
      const shift = f.moof.start;
      const root = { body: 8, end: moof.length };
      const mfhd = child(moof, root, 'mfhd');
      if (mfhd) v.setUint32(mfhd.body + 4, seq + 1);
      for (const traf of boxes(moof, 8).filter((x) => x.type === 'traf')) {
        const tfhd = child(moof, traf, 'tfhd');
        const flags = v.getUint32(tfhd.body) & 0xffffff;
        v.setUint32(tfhd.body + 4, f.input + 1);
        // An explicit base offset is absolute in the source file; move it with the fragment.
        if (flags & 1) v.setBigUint64(tfhd.body + 8, v.getBigUint64(tfhd.body + 8) - BigInt(shift) + BigInt(offset));
      }
      const mdat = src.subarray(f.mdat.start, f.mdat.end);
      parts.push(moof, mdat);
      offset += moof.length + mdat.length;
    });
    return new Blob(parts, { type: 'video/mp4' });
  };
})();

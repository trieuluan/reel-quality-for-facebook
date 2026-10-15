// Parse the DASH manifests Facebook embeds in its GraphQL responses.
// Regex-based on purpose: facebook.com enforces Trusted Types, which blocks DOMParser.
(() => {
  const FBQ = (window.__FBQ ||= {});

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e]);

  function attrs(tag) {
    const out = {};
    for (const [, k, v] of tag.matchAll(/([\w:.-]+)="([^"]*)"/g)) out[k] = decode(v);
    return out;
  }

  function range(str) {
    const m = /^(\d+)-(\d+)$/.exec(str || '');
    return m ? { start: +m[1], end: +m[2] } : null;
  }

  FBQ.parseMpd = function parseMpd(xml) {
    const reps = [];
    for (const [, setTag, setBody] of xml.matchAll(/<AdaptationSet\b([^>]*)>([\s\S]*?)<\/AdaptationSet>/g)) {
      const set = attrs(setTag);
      for (const [, repTag, repBody] of setBody.matchAll(/<Representation\b([^>]*)>([\s\S]*?)<\/Representation>/g)) {
        const rep = attrs(repTag);
        const mime = rep.mimeType || set.mimeType || '';
        const kind = mime.split('/')[0] || set.contentType;
        const baseUrl = /<BaseURL[^>]*>([^<]+)<\/BaseURL>/.exec(repBody)?.[1];
        const segBase = attrs(/<SegmentBase\b([^>]*)>/.exec(repBody)?.[1] || '');
        const init = attrs(/<Initialization\b([^>]*?)\/?>/.exec(repBody)?.[1] || '');
        const width = +rep.width || 0;
        const height = +rep.height || 0;
        const item = {
          kind,
          mime,
          codecs: rep.codecs || set.codecs || '',
          url: baseUrl && new URL(decode(baseUrl.trim()), location.href).href,
          width,
          height,
          bandwidth: +rep.bandwidth || 0,
          label: rep.FBQualityLabel || (width && height ? `${Math.min(width, height)}p` : ''),
          init: range(init.range),
          index: range(segBase.indexRange),
        };
        if (item.url && item.init && item.index && item.label) reps.push(item);
      }
    }
    return reps;
  };

  // Video qualities this browser can actually play through our MSE player, best first, one per label.
  FBQ.playableQualities = function playableQualities(reps) {
    const byLabel = new Map();
    for (const r of reps) {
      if (r.kind !== 'video' || r.mime !== 'video/mp4') continue;
      if (!MediaSource.isTypeSupported(`${r.mime}; codecs="${r.codecs}"`)) continue;
      const prev = byLabel.get(r.label);
      if (!prev || r.bandwidth > prev.bandwidth) byLabel.set(r.label, r);
    }
    return [...byLabel.values()].sort((a, b) => qualityHeight(b) - qualityHeight(a) || b.bandwidth - a.bandwidth);
  };

  const qualityHeight = (r) => parseInt(r.label, 10) || Math.min(r.width, r.height);
  FBQ.qualityHeight = qualityHeight;
})();

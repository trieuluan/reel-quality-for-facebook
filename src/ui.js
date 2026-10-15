// Quality button + menu pinned to the reel that is currently on screen.
// Only shown when the video's manifest offers at least two qualities this browser can play.
(() => {
  const FBQ = (window.__FBQ ||= {});
  const PREF_KEY = 'fbq-quality';
  const POS_KEY = 'fbq-button-pos';
  const MARGIN = 12; // px between the button and the video edge
  const DEFAULT_POS = { x: 0.5, y: 0 }; // fractions of the free space inside the video: 0 = left/top, 1 = right/bottom
  const PRESETS = [
    ['topLeft', 0, 0], ['topCenter', 0.5, 0], ['topRight', 1, 0],
    ['middleLeft', 0, 0.5], null, ['middleRight', 1, 0.5],
    ['bottomLeft', 0, 1], ['bottomCenter', 0.5, 1], ['bottomRight', 1, 1],
  ];
  const AUTHOR = 'Louis';
  const KOFI_URL = 'https://ko-fi.com/luantruong19136';
  // MoMo / VietQR (Napas 247) payment code, 45x45 modules, one row per 12 hex digits (45 bits + 3 padding).
  // Drawn as SVG rather than loaded as an image so Facebook's img-src CSP can't block it.
  const DONATE_QR = [
    'fe2051af8bf8', '8280a8541208', 'ba175513d2e8', 'bac1b4f51ae8', 'ba796fcb7ae8', '82d4b8b14208',
    'feaaaaaaabf8', '0049589a4800', 'fb917fe42d50', '198d40cbc8a0', 'e3a0b0705340', '91bf5507c878',
    'f2b13cffa660', '7c13018e0ab0', 'caf8e0b51140', '083f0f124920', '5340b8f43730', 'b9f3600fc8a0',
    '76d8a0141540', '801f401b4938', '9ff10015afc0', 'e899000a58a0', '0aac80055ad0', '38f9000248b0',
    '9fcdc0143f90', 'edf0000bde30', '7b00a01248d0', '419750cbd130', '16e32d35a028', '3de924c81f20',
    '73acf17708d0', 'ac1908921530', '07dc25745930', 'e0eb7d8bc720', '0a1d28b608d0', '798c50934b28',
    '9a192ff5bfc8', '00a5388858a8', 'fe88fa931ad0', '8259388a48a0', 'ba89bff42ff0', 'baf1014bc130',
    'baa4b2d45f40', '82944dcb58f8', 'fec122453f50',
  ];

  const STRINGS = {
    en: {
      buttonTitle: 'Video quality', quality: 'Quality', auto: 'Auto', position: 'Button position',
      dragHint: 'Or drag the button', credit: `Reel Quality · by ${AUTHOR}`, support: '☕ Support',
      topLeft: 'Top left', topCenter: 'Top center', topRight: 'Top right', middleLeft: 'Middle left',
      middleRight: 'Middle right', bottomLeft: 'Bottom left', bottomCenter: 'Bottom center', bottomRight: 'Bottom right',
    },
    vi: {
      buttonTitle: 'Chất lượng video', quality: 'Chất lượng', auto: 'Tự động', position: 'Vị trí nút',
      dragHint: 'Hoặc giữ chuột và kéo nút', credit: `Reel Quality · by ${AUTHOR}`, support: '☕ Ủng hộ',
      scanToDonate: 'Quét bằng MoMo hoặc app ngân hàng', orKofi: 'Hoặc ủng hộ qua Ko-fi',
      topLeft: 'Trên - Trái', topCenter: 'Trên - Giữa', topRight: 'Trên - Phải', middleLeft: 'Giữa - Trái',
      middleRight: 'Giữa - Phải', bottomLeft: 'Dưới - Trái', bottomCenter: 'Dưới - Giữa', bottomRight: 'Dưới - Phải',
    },
  };
  // Follow Facebook's own UI language, falling back to the browser's.
  const lang = () => ((document.documentElement.lang || navigator.language || 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en');
  const t = (key) => STRINGS[lang()][key];
  const GEAR =
    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.47.47 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z';

  const CSS = `
    :host { all: initial; position: fixed; z-index: 2147483000; display: none; font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .btn { display: flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px 0 7px; border: 0; border-radius: 15px;
      background: rgba(0,0,0,.55); color: #fff; cursor: pointer; font: inherit; font-weight: 600; backdrop-filter: blur(4px); }
    .btn:hover { background: rgba(0,0,0,.75); }
    .btn.dragging { cursor: grabbing; background: rgba(0,0,0,.8); }
    .btn svg { width: 18px; height: 18px; fill: currentColor; }
    .menu { position: absolute; min-width: 170px; padding: 6px; border-radius: 10px;
      background: rgba(28,28,30,.96); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.4); display: none; }
    .menu.open { display: block; }
    .menu.down { top: 36px; } .menu.up { bottom: 36px; }
    .menu.al-left { left: 0; } .menu.al-right { right: 0; } .menu.al-center { left: 50%; transform: translateX(-50%); }
    .sep { height: 1px; margin: 6px 4px; background: rgba(255,255,255,.12); }
    .grid { display: grid; grid-template-columns: repeat(3, 26px); gap: 4px; padding: 2px 10px 6px; }
    .cell { height: 18px; padding: 0; border: 0; border-radius: 4px; background: rgba(255,255,255,.15); cursor: pointer; }
    .cell:hover { background: rgba(255,255,255,.3); }
    .cell.active { background: #2d88ff; }
    .hint { padding: 0 10px 4px; font-size: 11px; opacity: .5; }
    .footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 4px 0 10px; }
    .credit { font-size: 10px; opacity: .4; white-space: nowrap; }
    .support { white-space: nowrap; padding: 3px 6px; border: 0; border-radius: 5px; background: none; color: #fbbf24; font: inherit; font-size: 11px;
      font-weight: 600; cursor: pointer; opacity: .85; }
    .support:hover { background: rgba(251,191,36,.12); opacity: 1; }
    .donate { display: grid; justify-items: center; gap: 6px; margin: 6px 4px 2px; padding: 10px; border-radius: 8px; background: #fff; color: #1c1c1e; }
    .donate svg { width: 150px; height: 150px; display: block; }
    .donate span { font-size: 11px; text-align: center; }
    .donate a { font-size: 11px; color: #2d6ff7; text-decoration: none; }
    .donate a:hover { text-decoration: underline; }
    .title { padding: 4px 10px 6px; font-size: 12px; opacity: .6; }
    .item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: 0; border-radius: 6px;
      background: none; color: inherit; font: inherit; text-align: left; white-space: nowrap; cursor: pointer; }
    .item:hover { background: rgba(255,255,255,.1); }
    .check { width: 14px; }
    .sub { margin-left: auto; padding-left: 12px; font-size: 11px; opacity: .55; }
    .hd { font-size: 9px; font-weight: 700; padding: 1px 3px; border-radius: 3px; background: #e41e3f; }
  `;

  const state = {
    video: null, // Facebook <video> currently targeted
    qualities: [], // playable reps for it, best first
    player: null, // active OverlayPlayer
    failed: new Set(), // rep URLs that failed, so we don't retry them in a loop
    pref: readPref(),
    pos: readPos(),
    donateOpen: false,
  };

  function readPref() {
    try {
      return localStorage.getItem(PREF_KEY);
    } catch {
      return null;
    }
  }
  function readPos() {
    try {
      const { x, y } = JSON.parse(localStorage.getItem(POS_KEY));
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) return { x, y };
    } catch {}
    return { ...DEFAULT_POS };
  }
  function writePos(pos) {
    state.pos = pos;
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(pos));
    } catch {}
  }
  function writePref(label) {
    state.pref = label;
    try {
      label ? localStorage.setItem(PREF_KEY, label) : localStorage.removeItem(PREF_KEY);
    } catch {}
  }

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    for (const c of children) node.append(c);
    return node;
  }
  function qrIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const size = DONATE_QR.length;
    let d = '';
    DONATE_QR.forEach((hex, y) => {
      const bits = parseInt(hex, 16).toString(2).padStart(48, '0');
      for (let x = 0; x < size; x++) if (bits[x] === '1') d += `M${x + 4} ${y + 4}h1v1h-1z`;
    });
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size + 8} ${size + 8}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#000');
    svg.append(path);
    return svg;
  }
  function gearIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', GEAR);
    svg.append(path);
    return svg;
  }

  // --- DOM ---------------------------------------------------------------------

  const host = el('div');
  const root = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS); // constructable sheet: not blocked by the page's style CSP
  root.adoptedStyleSheets = [sheet];
  const btnLabel = el('span');
  const btn = el('button', { className: 'btn', title: t('buttonTitle') }, [gearIcon(), btnLabel]);
  const menu = el('div', { className: 'menu' });
  root.append(btn, menu);
  for (const type of ['click', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick']) {
    host.addEventListener(type, (e) => e.stopPropagation());
  }
  btn.addEventListener('click', () => {
    if (suppressClick) return (suppressClick = false);
    if (menu.classList.toggle('open')) state.donateOpen = false; // start collapsed each time
    renderMenu();
  });

  // Drag the button anywhere inside the video. A short press without movement still opens the menu.
  let drag = null;
  let suppressClick = false;
  const clamp01 = (n) => Math.min(1, Math.max(0, n));
  const snap = (n) => [0, 0.5, 1].find((s) => Math.abs(n - s) < 0.04) ?? n;
  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !state.video) return;
    const b = host.getBoundingClientRect();
    drag = { startX: e.clientX, startY: e.clientY, dx: e.clientX - b.left, dy: e.clientY - b.top, moved: false };
    btn.setPointerCapture(e.pointerId);
  });
  btn.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
    drag.moved = true;
    btn.classList.add('dragging');
    menu.classList.remove('open');
    const r = state.video.getBoundingClientRect();
    const spanX = Math.max(1, r.width - host.offsetWidth - 2 * MARGIN);
    const spanY = Math.max(1, r.height - host.offsetHeight - 2 * MARGIN);
    state.pos = {
      x: snap(clamp01((e.clientX - drag.dx - r.left - MARGIN) / spanX)),
      y: snap(clamp01((e.clientY - drag.dy - r.top - MARGIN) / spanY)),
    };
  });
  const endDrag = () => {
    if (drag?.moved) {
      writePos(state.pos);
      suppressClick = true; // swallow the click that follows this pointerup...
      setTimeout(() => (suppressClick = false)); // ...but never a later one
    }
    drag = null;
    btn.classList.remove('dragging');
  };
  btn.addEventListener('pointerup', endDrag);
  btn.addEventListener('pointercancel', endDrag);
  document.addEventListener('pointerdown', (e) => {
    if (!e.composedPath().includes(host)) menu.classList.remove('open');
  });

  const current = () => (state.player && !state.player.dead ? state.player.rep : null);
  const fbPlayingLabel = (v) => (v?.videoHeight ? `${Math.min(v.videoWidth, v.videoHeight)}p` : '');

  function renderButton() {
    btnLabel.textContent = current()?.label || 'Auto';
  }

  let menuSignature = '';
  function renderMenu() {
    if (!menu.classList.contains('open')) return (menuSignature = '');
    const active = current();
    // Rebuild only on change: replacing the buttons mid-click would swallow the click.
    const signature = [active?.url, fbPlayingLabel(state.video), state.pos.x, state.pos.y, state.donateOpen, lang(), ...state.qualities.map((r) => r.url)].join('|');
    if (signature === menuSignature) return;
    menuSignature = signature;
    const item = (label, checked, sub, onPick) =>
      el('button', { className: 'item', onclick: onPick }, [
        el('span', { className: 'check', textContent: checked ? '✓' : '' }),
        label,
        el('span', { className: 'sub', textContent: sub }),
      ]);
    const rows = [el('div', { className: 'title', textContent: t('quality') })];
    rows.push(item(t('auto'), !active, fbPlayingLabel(state.video), () => choose(null)));
    for (const rep of state.qualities) {
      const label = el('span', {}, [rep.label]);
      if (FBQ.qualityHeight(rep) >= 720) label.append(' ', el('span', { className: 'hd', textContent: 'HD' }));
      rows.push(item(label, active === rep, `${Math.round(rep.bandwidth / 1000)} kbps`, () => choose(rep)));
    }
    rows.push(el('div', { className: 'sep' }), el('div', { className: 'title', textContent: t('position') }));
    const cells = PRESETS.map((p) => {
      if (!p) return el('span');
      const [name, x, y] = p;
      const active = state.pos.x === x && state.pos.y === y;
      return el('button', { className: `cell${active ? ' active' : ''}`, title: t(name), onclick: () => movePreset(x, y) });
    });
    rows.push(el('div', { className: 'grid' }, cells), el('div', { className: 'hint', textContent: t('dragHint') }));
    const support = el('button', { className: 'support', textContent: t('support'), onclick: openSupport });
    rows.push(el('div', { className: 'sep' }), el('div', { className: 'footer' }, [el('span', { className: 'credit', textContent: t('credit') }), support]));
    if (state.donateOpen) {
      const kofi = el('a', { href: KOFI_URL, target: '_blank', rel: 'noopener', textContent: t('orKofi') });
      rows.push(el('div', { className: 'donate' }, [qrIcon(), el('span', { textContent: t('scanToDonate') }), kofi]));
    }
    menu.replaceChildren(...rows);
  }

  // Vietnamese users get a MoMo/bank QR right in the menu; everyone else goes to Ko-fi.
  function openSupport() {
    if (lang() === 'vi') {
      state.donateOpen = !state.donateOpen;
      renderMenu();
    } else {
      window.open(KOFI_URL, '_blank', 'noopener');
    }
  }

  function movePreset(x, y) {
    writePos({ x, y });
    renderMenu();
  }

  // --- behaviour ---------------------------------------------------------------

  function stopPlayer() {
    const p = state.player;
    state.player = null;
    p?.stop();
  }

  function startPlayer(rep) {
    stopPlayer();
    const player = new FBQ.OverlayPlayer(state.video, rep, (p) => {
      if (state.player === p) state.player = null;
      if (p.error) state.failed.add(p.rep.url);
      renderButton();
      renderMenu();
    });
    state.player = player;
  }

  function choose(rep) {
    writePref(rep?.label || null);
    rep ? startPlayer(rep) : stopPlayer();
    menu.classList.remove('open');
    renderButton();
  }

  // Apply the remembered quality to a newly shown reel: same label, else the next lower one.
  function applyPref() {
    if (!state.pref || current()) return;
    const want = parseInt(state.pref, 10);
    const usable = state.qualities.filter((r) => !state.failed.has(r.url));
    const rep = usable.find((r) => FBQ.qualityHeight(r) <= want) || usable.at(-1);
    if (rep) startPlayer(rep);
  }

  function pickVideo() {
    let best = null;
    let bestScore = 0;
    for (const v of document.querySelectorAll('video:not([data-fbq])')) {
      const r = v.getBoundingClientRect();
      if (r.width < 150 || r.height < 150) continue;
      const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
      const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      const score = Math.max(0, w) * Math.max(0, h) * (v.paused ? 0.5 : 1);
      if (score > bestScore) {
        best = v;
        bestScore = score;
      }
    }
    return best;
  }

  function update() {
    const video = pickVideo();
    if (video !== state.video) {
      stopPlayer();
      state.video = video;
      menu.classList.remove('open');
    }
    const entry = video && FBQ.entryForVideo(video);
    state.qualities = entry ? FBQ.playableQualities(entry.reps) : [];
    const visible = state.qualities.length >= 2;
    host.style.display = visible ? 'block' : 'none';
    if (visible) applyPref();
    else stopPlayer();
    renderButton();
    renderMenu();
  }

  function position() {
    requestAnimationFrame(position);
    if (!state.video || host.style.display === 'none') return;
    const container = document.fullscreenElement || document.body;
    if (host.parentNode !== container) container.append(host);
    const r = state.video.getBoundingClientRect();
    const { x, y } = state.pos;
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    const left = r.left + MARGIN + x * Math.max(0, r.width - w - 2 * MARGIN);
    const top = r.top + MARGIN + y * Math.max(0, r.height - h - 2 * MARGIN);
    host.style.left = `${Math.min(innerWidth - w - 8, Math.max(8, left))}px`;
    host.style.top = `${Math.min(innerHeight - h - 8, Math.max(8, top))}px`;
    // Open the menu towards the inside of the video.
    menu.classList.toggle('down', y < 0.5);
    menu.classList.toggle('up', y >= 0.5);
    menu.classList.toggle('al-left', x < 0.34);
    menu.classList.toggle('al-right', x > 0.66);
    menu.classList.toggle('al-center', x >= 0.34 && x <= 0.66);
  }

  FBQ.ui = { state, menu, choose }; // for debugging from the console

  function boot() {
    document.body.append(host);
    setInterval(update, 400);
    requestAnimationFrame(position);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();

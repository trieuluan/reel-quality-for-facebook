// Quality button + menu pinned to the reel that is currently on screen.
// Only shown when the video's manifest offers at least two qualities this browser can play.
// Download button stacked above Facebook's Like button; if that column can't be found, downloads
// move into the quality menu instead.
(() => {
  const FBQ = (window.__FBQ ||= {});
  const PREF_KEY = 'fbq-quality';
  const POS_KEY = 'fbq-button-pos';
  const AUTOHIDE_KEY = 'fbq-autohide';
  const DL_ICON = 40; // px, round hit area around the download arrow
  const HIDE_AFTER = 2500; // ms without mouse movement over the video before the button fades out
  const MARGIN = 12; // px between the button and the video edge
  const DEFAULT_POS = { x: 0.5, y: 0 }; // fractions of the free space inside the video: 0 = left/top, 1 = right/bottom
  const PRESETS = [
    ['topLeft', 0, 0], ['topCenter', 0.5, 0], ['topRight', 1, 0],
    ['middleLeft', 0, 0.5], null, ['middleRight', 1, 0.5],
    ['bottomLeft', 0, 1], ['bottomCenter', 0.5, 1], ['bottomRight', 1, 1],
  ];
  const AUTHOR = 'Louis';
  const KOFI_URL = 'https://ko-fi.com/luantruong19136';
  const REVIEW_URL = 'https://chromewebstore.google.com/detail/nbgnfkagjipmlfhlpilandmenjmilmcc/reviews';
  const ISSUES_URL = 'https://github.com/trieuluan/reel-quality-for-facebook/issues/new';
  const REVIEW_KEY = 'fbq-review';
  const DAY = 24 * 60 * 60 * 1000;
  // Ask for a review only once the extension has proven useful, and at most twice in total.
  const REVIEW_AFTER_SWITCHES = 5;
  const REVIEW_AFTER_DAYS = 3;
  // A saved reel is the clearest moment of value, so downloads alone are enough, without the waiting period.
  const REVIEW_AFTER_DOWNLOADS = 2;
  // Watching in HD on a few different days counts too, including a remembered quality applied automatically:
  // the happiest users pick 1080p once and never touch the menu again.
  const REVIEW_AFTER_HD_DAYS = 3;
  const REVIEW_HD_FOR = 20_000; // ms of HD playback in one go before the card may appear beside the ⚙ button
  const REVIEW_CARD_FOR = 30_000; // ms a review card stays up if ignored
  const REVIEW_IGNORES = 3; // cards brushed away this many times count as one "Not now"
  const REVIEW_SNOOZE_DAYS = 21;
  const REVIEW_MAX_ASKS = 2;
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

  const { lang, t, rtl } = FBQ.i18n; // strings live in i18n.js
  const GEAR =
    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.61l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.47.47 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z';

  const CSS = `
    :host { all: initial; position: fixed; z-index: 2147483000; display: none; transition: opacity .25s; font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
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
    .footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-block: 0; padding-inline: 10px 4px; }
    .credit { font-size: 10px; opacity: .4; white-space: nowrap; }
    .support { white-space: nowrap; padding: 3px 6px; border: 0; border-radius: 5px; background: none; color: #fbbf24; font: inherit; font-size: 11px;
      font-weight: 600; cursor: pointer; opacity: .85; }
    .support:hover, .support.active { background: rgba(251,191,36,.12); opacity: 1; }
    .links { display: flex; gap: 2px; }
    .fs { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px;
      background: rgba(0,0,0,.55); color: #fff; cursor: pointer; backdrop-filter: blur(4px); }
    .fs:hover { background: rgba(0,0,0,.75); }
    .bar { position: relative; display: flex; align-items: center; gap: 10px; color: #fff; font-size: 12px; font-weight: 600;
      font-variant-numeric: tabular-nums; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
    .bar .time { white-space: nowrap; }
    .bar .hit { flex: 1; padding: 8px 0; cursor: pointer; }
    .bar .track { position: relative; height: 4px; border-radius: 2px; background: rgba(255,255,255,.3); box-shadow: 0 1px 2px rgba(0,0,0,.4); }
    .bar .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; background: #fff; }
    .bar .knob { position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #fff;
      opacity: 0; transition: opacity .15s; }
    .bar .hit:hover .knob, .bar.seeking .knob { opacity: 1; }
    .tip { position: absolute; bottom: calc(100% + 4px); display: none; flex-direction: column; align-items: center; gap: 4px; pointer-events: none; }
    .tip.on { display: flex; }
    .tip canvas { display: block; border-radius: 6px; background: #000; border: 2px solid rgba(255,255,255,.9); box-shadow: 0 4px 16px rgba(0,0,0,.6); }
    .tip canvas:not([data-ready]) { visibility: hidden; }
    .tip span { padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,.75); }
    .fs svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .donate { position: absolute; display: none; width: 190px; box-sizing: border-box; justify-items: center; gap: 6px; padding: 12px;
      border-radius: 10px; background: #fff; color: #1c1c1e; box-shadow: 0 8px 24px rgba(0,0,0,.4); }
    .donate.open { display: grid; }
    .donate svg { width: 150px; height: 150px; display: block; }
    .donate span { font-size: 11px; text-align: center; }
    .donate a { font-size: 11px; color: #2d6ff7; text-decoration: none; }
    .donate a:hover { text-decoration: underline; }
    .review { margin: 2px 0; padding: 8px 10px; border-radius: 8px; background: rgba(251,191,36,.08); }
    .review .ask { font-size: 12px; margin-bottom: 6px; }
    .review .acts { display: flex; gap: 4px; }
    .review button { padding: 4px 8px; border: 0; border-radius: 5px; background: rgba(255,255,255,.1); color: inherit; font: inherit;
      font-size: 11px; cursor: pointer; white-space: nowrap; }
    .review button:hover { background: rgba(255,255,255,.2); }
    .review button.primary { background: #fbbf24; color: #1c1c1e; font-weight: 600; }
    .review button.primary:hover { background: #fcd34d; }
    .review button.quiet { margin-inline-start: auto; background: none; opacity: .6; }
    .title { padding: 4px 10px 6px; font-size: 12px; opacity: .6; }
    .item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: 0; border-radius: 6px;
      background: none; color: inherit; font: inherit; text-align: start; white-space: nowrap; cursor: pointer; }
    .item:hover { background: rgba(255,255,255,.1); }
    .check { width: 14px; }
    .sub { margin-inline-start: auto; padding-inline-start: 12px; direction: ltr; unicode-bidi: isolate; font-size: 11px; opacity: .55; }
    .hd { font-size: 9px; font-weight: 700; padding: 1px 3px; border-radius: 3px; background: #e41e3f; }
    .dl { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 56px; max-width: 96px; text-align: center; padding: 0; border: 0; background: none;
      color: #fff; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 600; line-height: 1.2; text-shadow: 0 1px 2px rgba(0,0,0,.45); }
    .dl .icon { display: grid; place-items: center; width: ${DL_ICON}px; height: ${DL_ICON}px; border-radius: 50%; transition: background .15s; }
    .dl:hover .icon { background: rgba(255,255,255,.12); }
    .dl:focus { outline: none; } .dl:focus-visible .icon { outline: 2px solid #2d88ff; }
    .dl.running .icon { background: conic-gradient(rgba(255,255,255,.35) var(--p), transparent 0); }
    .dl svg { width: 28px; height: 28px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,.4)); }
    .dl-menu { top: 0; right: calc(100% + 8px); }
    .col { display: flex; flex-direction: column; align-items: center; gap: var(--gap, 16px); }
    .dl.saved svg { fill: currentColor; }
    .note { display: flex; align-items: center; gap: 8px; height: 30px; padding-block: 0; padding-inline: 10px 6px; border-radius: 15px; box-sizing: border-box;
      background: rgba(0,0,0,.6); color: #fff; font-size: 12px; font-weight: 600; white-space: nowrap; backdrop-filter: blur(4px); }
    .note .msg { direction: inherit; unicode-bidi: plaintext; }
    .note button { height: 22px; padding: 0 9px; border: 0; border-radius: 11px; background: #fff; color: #1c1c1e; font: inherit; cursor: pointer; }
    .note button:hover { background: #e4e6eb; }
    .note .x { padding: 0 5px; background: none; color: #fff; opacity: .7; }
    .note .x:hover { background: none; opacity: 1; }
    .note.toast { padding-inline-end: 10px; }
    .review-card { width: 260px; padding: 4px; }
    .review-card .review { margin: 0; }
  `;

  const state = {
    video: null, // Facebook <video> currently targeted
    qualities: [], // playable reps for it, best first
    player: null, // active OverlayPlayer
    failed: new Set(), // rep URLs that failed, so we don't retry them in a loop
    pref: readPref(),
    pos: readPos(),
    autoHide: readAutoHide(),
    lastActive: Date.now(), // last mouse movement over the video, or a shortcut
    hovering: false,
    donateOpen: false,
    review: readReview(),
    clip: null, // landscape clip found inside a vertical reel, see expand.js
    viewer: null,
    entry: null, // manifest entry of state.video
    downloads: [], // downloadable video reps for it, best first
    rail: null, // { like, item, next }: Facebook's Like button, its block (icon + count) and the Comment button below
    avatar: null, // the page's avatar over the video's bottom left; the ⛶ button lines up with it
    download: null, // { video, rep, progress, status: 'running'|'done'|'error', ctrl }
  };

  function readPref() {
    try {
      return localStorage.getItem(PREF_KEY);
    } catch {
      return null;
    }
  }
  function readAutoHide() {
    try {
      return localStorage.getItem(AUTOHIDE_KEY) !== '0'; // on unless turned off
    } catch {
      return true;
    }
  }
  function writeAutoHide(on) {
    state.autoHide = on;
    try {
      localStorage.setItem(AUTOHIDE_KEY, on ? '1' : '0');
    } catch {}
  }

  function readPos() {
    try {
      const { x, y } = JSON.parse(localStorage.getItem(POS_KEY));
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) return { x, y };
    } catch {}
    return { ...DEFAULT_POS };
  }
  // { firstSeen, switches, downloads, hdDays, asks, snoozedUntil, done, ... }: kept only in this browser's localStorage.
  function readReview() {
    let r = null;
    try {
      r = JSON.parse(localStorage.getItem(REVIEW_KEY));
    } catch {}
    r = { firstSeen: Date.now(), switches: 0, downloads: 0, hdDays: 0, lastHdDay: '', asks: 0, snoozedUntil: 0, cardShownAt: 0, ignored: 0, done: false, ...(r || {}) };
    saveReview(r);
    return r;
  }
  function saveReview(r) {
    try {
      localStorage.setItem(REVIEW_KEY, JSON.stringify(r));
    } catch {}
  }
  function shouldAskReview() {
    const r = state.review;
    const earned =
      (r.switches >= REVIEW_AFTER_SWITCHES && Date.now() - r.firstSeen >= REVIEW_AFTER_DAYS * DAY) ||
      r.downloads >= REVIEW_AFTER_DOWNLOADS ||
      r.hdDays >= REVIEW_AFTER_HD_DAYS;
    return !r.done && earned && Date.now() >= r.snoozedUntil;
  }
  function snoozeReview(r) {
    r.asks++;
    r.ignored = 0;
    r.snoozedUntil = Date.now() + REVIEW_SNOOZE_DAYS * DAY;
    if (r.asks >= REVIEW_MAX_ASKS) r.done = true;
  }
  function answerReview(action) {
    const r = state.review;
    if (action === 'later') {
      snoozeReview(r);
    } else {
      r.done = true;
      window.open(action === 'rate' ? REVIEW_URL : ISSUES_URL, '_blank', 'noopener');
    }
    saveReview(r);
    hideReviewCard();
    renderMenu();
  }

  // Rate and Report always appear together, so unhappy users get a place to go too.
  function reviewBlock() {
    const act = (key, cls, action) => el('button', { className: cls, textContent: t(key), onclick: () => answerReview(action) });
    return el('div', { className: 'review' }, [
      el('div', { className: 'ask', textContent: t('reviewAsk') }),
      el('div', { className: 'acts' }, [act('reviewRate', 'primary', 'rate'), act('reviewIssue', '', 'issue'), act('reviewLater', 'quiet', 'later')]),
    ]);
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
  function downloadIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M12 3.5v12M6.5 10.5 12 16l5.5-5.5M4.5 20.5h15');
    svg.append(path);
    return svg;
  }
  function bookmarkIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M6.5 3.5h11v17L12 16.5l-5.5 4z');
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
  const donate = el('div', { className: 'donate' }); // MoMo/VietQR card that opens beside the menu
  const qReviewCard = el('div', { className: 'menu review-card' }); // review ask that opens where the menu would
  root.append(btn, menu, donate, qReviewCard);
  for (const type of ['click', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick']) {
    host.addEventListener(type, (e) => e.stopPropagation());
  }
  btn.addEventListener('click', () => {
    if (suppressClick) return (suppressClick = false);
    hideReviewCard();
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
  const dlHost = el('div');
  const dlRoot = dlHost.attachShadow({ mode: 'closed' });
  dlRoot.adoptedStyleSheets = [sheet];
  const dlLabel = el('span');
  const dlBtn = el('button', { className: 'dl' }, [el('span', { className: 'icon' }, [downloadIcon()]), dlLabel]);
  const dlMenu = el('div', { className: 'menu dl-menu' });
  const reviewCard = el('div', { className: 'menu dl-menu review-card' }); // review ask after a successful download
  // 🔖 Watch later, right under Download and above Like.
  const saveLabel = el('span');
  const saveBtn = el('button', { className: 'dl', onclick: () => toggleSaved() }, [el('span', { className: 'icon' }, [bookmarkIcon()]), saveLabel]);
  const dlCol = el('div', { className: 'col' }, [dlBtn, saveBtn]);
  dlRoot.append(dlCol, dlMenu, reviewCard);
  for (const type of ['click', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick']) {
    dlHost.addEventListener(type, (e) => e.stopPropagation());
  }
  dlBtn.addEventListener('click', () => {
    if (state.download?.status === 'running' && state.download.video === state.video) return state.download.ctrl.abort();
    hideReviewCard();
    dlMenu.classList.toggle('open');
    renderDownload();
  });

  document.addEventListener('pointerdown', (e) => {
    const path = e.composedPath();
    if (!path.includes(host)) menu.classList.remove('open');
    if (!path.includes(dlHost)) dlMenu.classList.remove('open');
    if (!path.includes(host) && !path.includes(dlHost)) hideReviewCard(true); // brushed away, not an answer
  });

  const current = () => (state.player && !state.player.dead ? state.player.rep : null);
  const fbPlayingLabel = (v) => (v?.videoHeight ? `${Math.min(v.videoWidth, v.videoHeight)}p` : '');

  // On Auto, show what Facebook is actually playing, so a drop to 360p is visible at a glance.
  function renderButton() {
    const playing = fbPlayingLabel(state.video);
    btnLabel.textContent = current()?.label || (playing ? `Auto · ${playing}` : 'Auto');
  }

  let menuSignature = '';
  function renderMenu() {
    if (!menu.classList.contains('open')) return (menuSignature = '');
    const active = current();
    // Rebuild only on change: replacing the buttons mid-click would swallow the click.
    const s = watching();
    const signature = [active?.url, fbPlayingLabel(state.video), state.pos.x, state.pos.y, state.donateOpen, !!state.clip, shouldAskReview(), state.autoHide, lang(), ...state.qualities.map((r) => r.url), railShown() ? '' : downloadSignature(), !!s, s?.saved, railShown(), FBQ.history.prefs.delay].join('|');
    if (signature === menuSignature) return;
    menuSignature = signature;
    const item = (label, checked, sub, onPick) =>
      el('button', { className: 'item', onclick: onPick }, [
        el('span', { className: 'check', textContent: checked ? '✓' : '' }),
        label,
        el('span', { className: 'sub', textContent: sub }),
      ]);
    const rows = [];
    if (state.qualities.length >= 2) {
      rows.push(el('div', { className: 'title', textContent: t('quality') }));
      rows.push(item(t('auto'), !active, fbPlayingLabel(state.video), () => choose(null)));
      for (const rep of state.qualities) {
        const label = el('span', {}, [rep.label]);
        if (FBQ.qualityHeight(rep) >= 720) label.append(' ', el('span', { className: 'hd', textContent: 'HD' }));
        rows.push(item(label, active === rep, `${Math.round(rep.bandwidth / 1000)} kbps`, () => choose(rep)));
      }
    }
    if (state.clip) {
      if (rows.length) rows.push(el('div', { className: 'sep' }));
      rows.push(el('button', { className: 'item', textContent: t('expand'), onclick: openViewer }));
    }
    if (!railShown() && state.downloads.length) {
      if (rows.length) rows.push(el('div', { className: 'sep' }));
      rows.push(...downloadRows());
    }
    if (!railShown() && s) {
      if (rows.length) rows.push(el('div', { className: 'sep' }));
      rows.push(item(t('watchLater'), s.saved, 'B', toggleSaved));
    }
    rows.push(el('div', { className: 'sep' }), el('div', { className: 'title', textContent: t('position') }));
    const cells = PRESETS.map((p) => {
      if (!p) return el('span');
      const [name, x, y] = p;
      const active = state.pos.x === x && state.pos.y === y;
      return el('button', { className: `cell${active ? ' active' : ''}`, title: t(name), onclick: () => movePreset(x, y) });
    });
    rows.push(el('div', { className: 'grid' }, cells), el('div', { className: 'hint', textContent: t('dragHint') }));
    rows.push(item(t('autoHide'), state.autoHide, '', () => {
      writeAutoHide(!state.autoHide);
      renderMenu();
    }));
    if (s) rows.push(item(t('historyAfter'), false, delayLabel(FBQ.history.prefs.delay), cycleDelay));
    rows.push(el('div', { className: 'hint', textContent: t('shortcuts') }));
    if (shouldAskReview()) rows.push(el('div', { className: 'sep' }), reviewBlock());
    const support = el('button', { className: `support${state.donateOpen ? ' active' : ''}`, textContent: t('support'), onclick: openSupport });
    // Always there for anyone who wants to rate, whether or not the one-off ask has come up.
    const rate = el('button', { className: 'support', textContent: `⭐ ${t('reviewRate')}`, onclick: () => answerReview('rate') });
    const links = el('span', { className: 'links' }, [rate, support]);
    rows.push(el('div', { className: 'sep' }), el('div', { className: 'footer' }, [el('span', { className: 'credit', textContent: `Reel Quality · by ${AUTHOR}` }), links]));
    menu.dir = rtl() ? 'rtl' : 'ltr';
    menu.replaceChildren(...rows);
  }

  // Vietnamese users get a MoMo/bank QR in a card beside the menu; everyone else goes to Ko-fi.
  function openSupport() {
    if (lang() === 'vi') {
      state.donateOpen = !state.donateOpen;
      if (state.donateOpen) {
        const kofi = el('a', { href: KOFI_URL, target: '_blank', rel: 'noopener', textContent: t('orKofi') });
        donate.replaceChildren(qrIcon(), el('span', { textContent: t('scanToDonate') }), kofi);
      }
      renderMenu();
    } else {
      window.open(KOFI_URL, '_blank', 'noopener');
    }
  }

  // --- download ------------------------------------------------------------------

  const audioRep = () => (state.entry ? FBQ.bestAudio(state.entry.reps) : null);
  const mine = () => (state.download?.video === state.video ? state.download : null);
  const megabytes = (bytes) => (bytes >= 10e6 ? Math.round(bytes / 1e6) : (bytes / 1e6).toFixed(1));
  const codecName = (r) => ({ avc1: '', avc3: '', hev1: 'HEVC', hvc1: 'HEVC', vp09: 'VP9', av01: 'AV1' })[r.codecs.slice(0, 4)] ?? r.codecs.slice(0, 4);

  function downloadSignature() {
    const dl = mine();
    return [dl?.rep.url, dl?.status, dl && Math.floor(dl.progress * 100), ...state.downloads.map((r) => r.url)].join(',');
  }

  // Shared by the download menu and the quality-menu fallback.
  function downloadRows() {
    const dl = mine();
    const playing = current()?.label || fbPlayingLabel(state.video);
    const audio = audioRep();
    const rows = [el('div', { className: 'title', textContent: t('downloadTitle') })];
    for (const rep of state.downloads) {
      const label = el('span', {}, [rep.label]);
      if (FBQ.qualityHeight(rep) >= 720) label.append(' ', el('span', { className: 'hd', textContent: 'HD' }));
      let sub = `~${megabytes(FBQ.estimateSize(rep, audio, state.video?.duration))} MB`;
      if (codecName(rep)) sub += ` · ${codecName(rep)}`;
      if (dl?.rep === rep && dl.status === 'running') sub = `${Math.floor(dl.progress * 100)}%`;
      const onPick = () => (dl?.status === 'running' ? dl.rep === rep && dl.ctrl.abort() : startDownload(rep));
      rows.push(
        el('button', { className: 'item', onclick: onPick }, [
          el('span', { className: 'check', textContent: rep.label === playing ? '•' : '' }),
          label,
          el('span', { className: 'sub', textContent: sub }),
        ])
      );
    }
    if (!audio) rows.push(el('div', { className: 'hint', textContent: t('noSound') }));
    return rows;
  }

  // One review card at a time, beside the download button or where the quality menu opens; at most one a day.
  let reviewTimer = 0;
  const reviewCardOpen = () => reviewCard.classList.contains('open') || qReviewCard.classList.contains('open');
  const mayShowReviewCard = () => shouldAskReview() && !reviewCardOpen() && Date.now() - state.review.cardShownAt >= DAY;
  function showReviewCard(card) {
    dlMenu.classList.remove('open');
    menu.classList.remove('open');
    card.dir = rtl() ? 'rtl' : 'ltr';
    card.replaceChildren(reviewBlock());
    card.classList.add('open');
    state.review.cardShownAt = Date.now();
    saveReview(state.review);
    clearTimeout(reviewTimer);
    reviewTimer = setTimeout(() => hideReviewCard(true), REVIEW_CARD_FOR);
  }
  // Ignored cards come back on another day; a few ignored ones count as one "Not now", so it never nags forever.
  function hideReviewCard(ignored = false) {
    clearTimeout(reviewTimer);
    if (!reviewCardOpen()) return;
    reviewCard.classList.remove('open');
    qReviewCard.classList.remove('open');
    if (!ignored) return;
    const r = state.review;
    if (++r.ignored >= REVIEW_IGNORES) snoozeReview(r);
    saveReview(r);
  }

  let dlSignature = '';
  function renderDownload() {
    const dl = mine();
    dlBtn.classList.toggle('running', dl?.status === 'running');
    dlBtn.style.setProperty('--p', `${Math.round((dl?.progress || 0) * 360)}deg`);
    dlLabel.textContent =
      dl?.status === 'running' ? `${Math.floor(dl.progress * 100)}%` : dl?.status === 'done' ? '✓' : dl?.status === 'error' ? '!' : t('download');
    dlBtn.title = dl?.status === 'running' ? t('downloadCancel') : dl?.status === 'error' ? t('downloadFailed') : t('downloadTitle');
    if (!dlMenu.classList.contains('open')) return (dlSignature = '');
    const signature = [downloadSignature(), current()?.label, fbPlayingLabel(state.video), lang()].join('|');
    if (signature === dlSignature) return;
    dlSignature = signature;
    dlMenu.dir = rtl() ? 'rtl' : 'ltr';
    dlMenu.replaceChildren(...downloadRows());
  }

  const fileName = (rep) => {
    const id = /\/reels?\/(\d+)/.exec(location.pathname)?.[1] || state.entry?.id || Date.now(); // the address bar names the reel on screen
    return `reel-${id}-${rep.label}.mp4`;
  };

  async function startDownload(rep) {
    if (state.download?.status === 'running' || !state.video) return;
    const dl = (state.download = { video: state.video, rep, progress: 0, status: 'running', ctrl: new AbortController() });
    const name = fileName(rep);
    const audio = audioRep();
    dlMenu.classList.remove('open');
    menu.classList.remove('open');
    const refresh = () => {
      renderDownload();
      renderMenu();
    };
    refresh();
    let last = 0;
    try {
      const blob = await FBQ.downloadReel({
        video: rep,
        audio,
        signal: dl.ctrl.signal,
        onProgress: (p) => {
          dl.progress = p;
          if (Date.now() - last > 100 || p === 1) {
            last = Date.now();
            refresh();
          }
        },
      });
      FBQ.saveBlob(blob, name);
      dl.status = 'done';
      state.review.downloads++;
      saveReview(state.review);
      if (railShown() && state.video === dl.video && mayShowReviewCard()) showReviewCard(reviewCard);
    } catch (e) {
      dl.status = dl.ctrl.signal.aborted ? 'cancelled' : 'error';
      if (dl.status === 'error') console.warn('[FBQ] download failed:', e);
    }
    const clear = () => {
      if (state.download === dl) state.download = null;
      refresh();
    };
    dl.status === 'cancelled' ? clear() : setTimeout(clear, dl.status === 'done' ? 2000 : 4000);
    refresh();
  }

  // --- watch history and Watch later (see history.js) ---------------------------------

  const NOTE_FOR = 8000; // ms the "Watched …" note stays up on its own when a reel you've seen comes back
  const TOAST_FOR = 2000; // ms for "Saved to Watch later" and the like
  const RESUME_MIN = 5; // s: no "Resume" for a reel left in its first or last seconds
  // The history session for the reel on screen, if this is a reel the history follows.
  const watching = () => {
    const s = FBQ.history.session;
    return s && s.video === state.video ? s : null;
  };

  function renderSave() {
    const s = watching();
    saveBtn.classList.toggle('saved', !!s?.saved);
    saveLabel.textContent = t(s?.saved ? 'saved' : 'save');
    saveBtn.title = `${t(s?.saved ? 'unsaveTitle' : 'saveTitle')} (B)`;
  }

  function toggleSaved() {
    const saved = FBQ.history.toggleSaved();
    if (saved === null) return;
    // The 🔖 button shows the new state; when it isn't on screen (fullscreen, no Like column), say so.
    if (!railShown()) toast(t(saved ? 'savedToast' : 'unsavedToast'));
    renderMenu();
  }

  const delayLabel = (d) => (d ? t('delaySec').replace('{n}', d) : t('delayNow'));
  function cycleDelay() {
    const list = [0, 3, 10];
    const d = FBQ.history.prefs.delay;
    FBQ.history.setDelay(list[(list.indexOf(d) + 1) % list.length]);
    renderMenu();
  }

  // A small note under the ⚙ button: "Watched 2 days ago · stopped at 0:42 [Resume] ✕" on a reel that is in the
  // history already, or a short message after B.
  const noteHost = el('div');
  const noteRoot = noteHost.attachShadow({ mode: 'closed' });
  noteRoot.adoptedStyleSheets = [sheet];
  const note = el('div', { className: 'note' });
  noteRoot.append(note);
  for (const type of ['click', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick']) {
    noteHost.addEventListener(type, (e) => e.stopPropagation());
  }
  noteHost.addEventListener('pointerenter', () => (state.hovering = true));
  noteHost.addEventListener('pointerleave', () => {
    state.hovering = false;
    reveal();
  });
  let toastMsg = null; // { text, until }
  function toast(text) {
    toastMsg = { text, until: Date.now() + TOAST_FOR };
    reveal();
  }

  let noteSignature = '';
  function renderNote() {
    const s = watching();
    let content = null;
    if (toastMsg && Date.now() < toastMsg.until) {
      content = ['toast', toastMsg.text];
    } else if (s?.before && !s.noteClosed) {
      const b = s.before;
      const duration = b.duration || state.video.duration;
      const canResume = !s.resumed && !b.done && b.pos > RESUME_MIN && Number.isFinite(duration) && b.pos < duration - RESUME_MIN;
      let text = t('watchedAgo').replace('{ago}', FBQ.fmt.ago(b.watchedAt, lang()));
      if (canResume) text += ` · ${t('stoppedAt').replace('{time}', clock(b.pos, duration >= 3600))}`;
      content = ['seen', text, canResume];
    }
    const signature = JSON.stringify([content, lang()]);
    if (signature === noteSignature) return !!content;
    noteSignature = signature;
    if (!content) return false;
    const [kind, text, canResume] = content;
    note.className = `note${kind === 'toast' ? ' toast' : ''}`;
    note.dir = rtl() ? 'rtl' : 'ltr';
    const rows = [el('span', { className: 'msg', textContent: text })];
    if (canResume) {
      rows.push(el('button', { textContent: t('resume'), onclick: () => {
        const sv = watching();
        if (sv) {
          sv.resumed = true;
          state.video.currentTime = sv.before.pos;
          state.video.play().catch(() => {});
        }
      } }));
    }
    if (kind === 'seen') rows.push(el('button', { className: 'x', textContent: '✕', title: t('close'), onclick: () => watching() && (watching().noteClosed = true) }));
    note.replaceChildren(...rows);
    return true;
  }

  function positionNote() {
    const shown = !!state.video && renderNote() && !menu.classList.contains('open') && !reviewCardOpen();
    noteHost.style.display = shown ? 'block' : 'none';
    if (!shown) return;
    const container = document.fullscreenElement || document.body;
    if (noteHost.parentNode !== container) container.append(noteHost);
    const s = watching();
    const fresh = toastMsg && Date.now() < toastMsg.until;
    const visible = fresh || controlsVisible() || (s && Date.now() - s.startedAt < NOTE_FOR);
    noteHost.style.opacity = visible ? '1' : '0';
    noteHost.style.pointerEvents = visible ? '' : 'none';
    // Under the ⚙ button (above it when the button sits low), lined up the same way its menu is.
    const r = pictureBox(state.video);
    const w = noteHost.offsetWidth;
    const h = noteHost.offsetHeight;
    const { x, y } = state.pos;
    const anchor = host.style.display !== 'none' ? host.getBoundingClientRect() : null;
    let left = x < 0.34 ? r.left + MARGIN : x > 0.66 ? r.right - MARGIN - w : r.left + (r.width - w) / 2;
    if (anchor) left = x < 0.34 ? anchor.left : x > 0.66 ? anchor.right - w : anchor.left + anchor.width / 2 - w / 2;
    const top = y < 0.5 ? (anchor ? anchor.bottom + 6 : r.top + MARGIN) : (anchor ? anchor.top - 6 - h : r.bottom - MARGIN - h);
    noteHost.style.left = `${Math.min(innerWidth - w - 4, Math.max(4, left))}px`;
    noteHost.style.top = `${Math.min(innerHeight - h - 4, Math.max(4, top))}px`;
  }

  FBQ.history.onChange(() => {
    renderSave();
    renderMenu();
  });

  // Facebook's reel actions (Like, Comment, Share, ...) form an evenly spaced column of labelled buttons
  // just right of the video. Class names are obfuscated and labels are translated, so go by layout only.
  function findRail(video) {
    const v = video.getBoundingClientRect();
    const columns = [];
    for (const node of document.querySelectorAll('[role="button"][aria-label], button[aria-label]')) {
      const r = node.getBoundingClientRect();
      if (r.width < 20 || r.width > 90 || r.height < 20 || r.height > 90) continue;
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (x < v.right - 100 || x > v.right + 160 || y < v.top || y > v.bottom) continue;
      let col = columns.find((c) => Math.abs(c.x - x) < 10);
      if (!col) columns.push((col = { x, items: [] }));
      if (!col.items.some((i) => Math.abs(i.y - y) < 6)) col.items.push({ node, y }); // skip nested duplicates
    }
    for (const col of columns.sort((a, b) => b.items.length - a.items.length)) {
      if (col.items.length < 3) break;
      const [a, b, c] = col.items.sort((p, q) => p.y - q.y);
      const gap = b.y - a.y;
      if (gap > 30 && gap < 140 && Math.abs(c.y - b.y - gap) < gap * 0.35) return { like: a.node, item: railItem(a.node, b.node), next: b.node };
    }
    return null;
  }

  // The Like button's whole block, count included: its widest ancestor that stays narrow and doesn't reach Comment.
  function railItem(like, next) {
    let item = like;
    for (let n = like.parentElement, i = 0; n && i < 5; n = n.parentElement, i++) {
      if (n.contains(next) || n.getBoundingClientRect().width > 120) break;
      item = n;
    }
    return item;
  }

  function positionDownload() {
    const rail = state.rail;
    const canSave = !!watching();
    const show = !!(rail?.like.isConnected && (state.downloads.length || canSave) && railShown());
    dlHost.style.display = show ? 'block' : 'none';
    if (!show) return;
    const container = document.fullscreenElement || document.body;
    if (dlHost.parentNode !== container) container.append(dlHost);
    dlBtn.style.display = state.downloads.length ? '' : 'none';
    saveBtn.style.display = canSave ? '' : 'none';
    // Leave the same empty space above Like (and between our two buttons) as Facebook leaves between the
    // Like count and Comment, with the icons centred on the column's axis.
    const r = rail.like.getBoundingClientRect();
    const space = Math.min(32, Math.max(8, rail.next.getBoundingClientRect().top - rail.item.getBoundingClientRect().bottom));
    dlCol.style.setProperty('--gap', `${space}px`);
    const left = r.left + r.width / 2 - dlHost.offsetWidth / 2;
    const top = r.top - space - dlHost.offsetHeight;
    dlHost.style.left = `${Math.min(innerWidth - dlHost.offsetWidth - 4, Math.max(4, left))}px`;
    dlHost.style.top = `${Math.max(4, top)}px`;
  }

  // --- fullscreen ------------------------------------------------------------------
  //
  // Reels on desktop have no fullscreen button. Fullscreen the video's own box (the outermost ancestor with the
  // same size), so Facebook's click-to-pause layer and our HD layer come along, and letterbox the video in it.

  const fsSheet = new CSSStyleSheet();
  fsSheet.replaceSync(`
    [data-fbq-fs]:fullscreen { background: #000 !important; }
    [data-fbq-idle] { cursor: none !important; }
    [data-fbq-fs]:fullscreen video { position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important;
      max-width: none !important; max-height: none !important; object-fit: contain !important; transform: none !important; }
  `);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, fsSheet];

  function fullscreenBox(video) {
    const v = video.getBoundingClientRect();
    const same = (r) => Math.abs(r.left - v.left) < 3 && Math.abs(r.top - v.top) < 3 && Math.abs(r.width - v.width) < 3 && Math.abs(r.height - v.height) < 3;
    let box = video.parentElement; // holds our HD layer, which sits right after Facebook's <video>
    for (let n = box?.parentElement, i = 0; n && n !== document.body && i < 8; n = n.parentElement, i++) {
      if (!same(n.getBoundingClientRect())) break;
      box = n;
    }
    return box;
  }

  const inOurFullscreen = () => !!document.fullscreenElement?.hasAttribute('data-fbq-fs');
  // Fullscreen (⛶, F) and the hidden pointer are for the Reels viewer only: videos in the feed, groups or Watch
  // have Facebook's own player controls.
  const inReelViewer = () => /^\/reels?\/\d+/.test(location.pathname) || inOurFullscreen();

  // ⛶ at the video's bottom right, level with the page name: where players put it, and it comes along into
  // fullscreen so the same button leaves again (the Like column doesn't).
  const FS_RIGHT = 12; // px from the video's right edge
  const FS_BOTTOM = 47; // px from the video's bottom edge to the button's when no page name is found
  const FS_MIN_BOTTOM = 16; // never lower than this above the video's bottom edge (the progress bar)
  const FS_ICONS = { enter: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', exit: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' };
  const fsHost = el('div');
  const fsRoot = fsHost.attachShadow({ mode: 'closed' });
  fsRoot.adoptedStyleSheets = [sheet];
  const fsBtn = el('button', { className: 'fs', onclick: () => toggleFullscreen() });
  fsRoot.append(fsBtn);
  for (const type of ['click', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick']) {
    fsHost.addEventListener(type, (e) => e.stopPropagation());
  }
  fsHost.addEventListener('pointerenter', () => (state.hovering = true));
  fsHost.addEventListener('pointerleave', () => {
    state.hovering = false;
    reveal();
  });
  let fsIcon = '';
  function renderFullscreenButton() {
    const mode = inOurFullscreen() ? 'exit' : 'enter';
    if (mode === fsIcon) return;
    fsIcon = mode;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', FS_ICONS[mode]);
    svg.append(path);
    fsBtn.replaceChildren(svg);
    const label = t(mode === 'exit' ? 'exitFullscreen' : 'fullscreen').replace(/^⛶\s*/, '');
    fsBtn.title = `${label} (F)`;
    fsBtn.setAttribute('aria-label', label);
  }
  // In our fullscreen the video is letterboxed: place the buttons on the picture, not out on the black bars.
  function pictureBox(video) {
    const r = video.getBoundingClientRect();
    if (!inOurFullscreen() || !video.videoWidth || !video.videoHeight) return r;
    const scale = Math.min(r.width / video.videoWidth, r.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    const left = r.left + (r.width - width) / 2;
    const top = r.top + (r.height - height) / 2;
    return { left, top, width, height, right: left + width, bottom: top + height };
  }

  // Box of the page's avatar (start of Facebook's author row) when it is on screen, else null.
  function avatarBox() {
    const a = state.avatar;
    if (!a?.isConnected || (document.fullscreenElement && !document.fullscreenElement.contains(a))) return null;
    const r = a.getBoundingClientRect();
    return r.height ? r : null;
  }

  function positionFullscreenButton(visible) {
    const show = !!state.video && inReelViewer();
    fsHost.style.display = show ? 'block' : 'none';
    if (!show) return;
    const container = document.fullscreenElement || document.body;
    if (fsHost.parentNode !== container) container.append(fsHost);
    renderFullscreenButton();
    const r = pictureBox(state.video);
    const h = fsHost.offsetHeight;
    let top;
    if (barShown()) {
      // Fullscreen: at the right end of the progress bar's line, so the two never overlap.
      const line = barLine(r);
      top = line.bottom - line.height / 2 - h / 2;
    } else {
      // Level with the page name row, which moves up when the description is expanded, so the button never sits on the text.
      const ar = avatarBox();
      top = ar ? Math.min(r.bottom - FS_MIN_BOTTOM - h, ar.top + ar.height / 2 - h / 2) : r.bottom - FS_BOTTOM - h;
    }
    fsHost.style.left = `${Math.min(innerWidth - fsHost.offsetWidth - 4, r.right - FS_RIGHT - fsHost.offsetWidth)}px`;
    fsHost.style.top = `${Math.min(innerHeight - h - 4, Math.max(r.top + 4, top))}px`;
    fsHost.style.opacity = visible ? '1' : '0';
  }

  // Facebook's author row (avatar, page name, Follow) sits over the video's bottom left, above the description.
  // Its avatar is the topmost round-ish picture there, so look for that rather than for translated text.
  function findAvatar(video) {
    const v = video.getBoundingClientRect();
    const scope = fullscreenBox(video)?.parentElement || document.body;
    let best = null;
    let bestTop = Infinity;
    for (const n of scope.querySelectorAll('img, svg')) {
      const r = n.getBoundingClientRect();
      if (r.width < 24 || r.width > 64 || Math.abs(r.width - r.height) > 4) continue;
      if (r.left < v.left || r.right > v.left + v.width * 0.4 || r.top < v.top + v.height * 0.25 || r.bottom > v.bottom) continue;
      if (r.top < bestTop) {
        best = n;
        bestTop = r.top;
      }
    }
    return best;
  }

  function enterFullscreen(video) {
    const box = video && fullscreenBox(video);
    if (!box) return;
    box.setAttribute('data-fbq-fs', '');
    box.requestFullscreen().catch((e) => {
      box.removeAttribute('data-fbq-fs');
      console.warn('[FBQ] fullscreen failed:', e);
    });
  }
  function toggleFullscreen() {
    menu.classList.remove('open');
    if (document.fullscreenElement) return void document.exitFullscreen().catch(() => {});
    enterFullscreen(state.video);
  }

  // Facebook ignores its own keys while our box is fullscreen, and plays the next reel in another box anyway.
  // So ↑/↓ leave fullscreen, hand Facebook the same arrow key, and go fullscreen again on the reel it shows next.
  // The key press still counts as user activation for a few seconds, which requestFullscreen needs.
  const NAV_WAIT = 4000; // ms to wait for Facebook to show the next reel
  let pendingNav = null; // { from: <video>, until }
  function switchReel(down) {
    const key = down ? 'ArrowDown' : 'ArrowUp';
    const code = down ? 40 : 38;
    pendingNav = { from: state.video, until: Date.now() + NAV_WAIT };
    document
      .exitFullscreen()
      .catch(() => {})
      .then(() => {
        const target = document.activeElement || document.body;
        for (const type of ['keydown', 'keyup']) {
          target.dispatchEvent(new KeyboardEvent(type, { key, code: key, keyCode: code, which: code, bubbles: true, cancelable: true }));
        }
      });
  }
  function resumeFullscreenAfterSwitch(video) {
    if (!pendingNav) return;
    if (Date.now() > pendingNav.until) return void (pendingNav = null);
    if (!video || video === pendingNav.from) return;
    pendingNav = null;
    enterFullscreen(video);
  }

  const SEEK_STEP = 5; // seconds for ← / →
  // Keys while our box is fullscreen: true when handled.
  function fullscreenKey(e) {
    const v = state.video;
    if (e.shiftKey) return false;
    if (e.code === 'Space' || e.code === 'KeyK') {
      v.paused ? v.play().catch(() => {}) : v.pause();
    } else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      if (!Number.isFinite(v.duration)) return true;
      const step = e.code === 'ArrowRight' ? SEEK_STEP : -SEEK_STEP;
      v.currentTime = Math.min(v.duration - 0.1, Math.max(0, v.currentTime + step));
    } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      switchReel(e.code === 'ArrowDown');
    } else {
      return false;
    }
    return true;
  }

  // --- progress bar while fullscreen --------------------------------------------------
  //
  // Facebook's own bar stays outside the fullscreen box, so draw one at the bottom of the picture.

  const BAR_SIDE = 16; // px from the picture's left and right edges
  const BAR_BOTTOM = 10; // px from the picture's bottom edge when Facebook's author row isn't there
  const BAR_GAP = 6; // px between the bar's line and the author row above which it sits
  const BAR_FS_GAP = 10; // px between the bar's end and the ⛶ button on the same line
  const barHost = el('div');
  const barRoot = barHost.attachShadow({ mode: 'closed' });
  barRoot.adoptedStyleSheets = [sheet];
  const barTime = el('span', { className: 'time' });
  const barFill = el('div', { className: 'fill' });
  const barKnob = el('div', { className: 'knob' });
  const barHit = el('div', { className: 'hit' }, [el('div', { className: 'track' }, [barFill, barKnob])]);
  // Hover thumbnail: a frame from a hidden low-quality player, with the time under it.
  const PREVIEW_SIZE = 160; // px, longer side of the thumbnail
  const tipCanvas = el('canvas');
  const tipTime = el('span');
  const tip = el('div', { className: 'tip' }, [tipCanvas, tipTime]);
  const bar = el('div', { className: 'bar' }, [barTime, barHit, tip]);
  barRoot.append(bar);
  for (const type of ['click', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick']) {
    barHost.addEventListener(type, (e) => e.stopPropagation());
  }
  barHost.addEventListener('pointerenter', () => (state.hovering = true));
  barHost.addEventListener('pointerleave', () => {
    state.hovering = false;
    reveal();
  });
  let seeking = false;
  function seekTo(e) {
    const v = state.video;
    if (!v || !Number.isFinite(v.duration)) return;
    const r = barHit.getBoundingClientRect();
    v.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * v.duration;
  }
  barHit.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    seeking = true;
    bar.classList.add('seeking');
    barHit.setPointerCapture(e.pointerId);
    seekTo(e);
  });
  let preview = null; // FramePreview for state.video while fullscreen
  function previewFor(video) {
    if (preview?.owner === video && !preview.dead) return preview;
    preview?.destroy();
    preview = null;
    // The lowest quality this browser can play through MSE is plenty for a 160 px thumbnail.
    const rep = state.qualities.at(-1) || state.downloads.findLast((r) => MediaSource.isTypeSupported(`${r.mime}; codecs="${r.codecs}"`));
    if (!rep) return null;
    preview = new FBQ.FramePreview(rep);
    preview.owner = video; // the Facebook <video> this preview belongs to
    const ratio = rep.width && rep.height ? rep.width / rep.height : 9 / 16;
    tipCanvas.width = Math.round(ratio >= 1 ? PREVIEW_SIZE : PREVIEW_SIZE * ratio);
    tipCanvas.height = Math.round(ratio >= 1 ? PREVIEW_SIZE / ratio : PREVIEW_SIZE);
    delete tipCanvas.dataset.ready;
    return preview;
  }
  function stopPreview() {
    tip.classList.remove('on');
    preview?.destroy();
    preview = null;
  }
  function showTip(e) {
    const v = state.video;
    if (!v || !Number.isFinite(v.duration)) return;
    const hit = barHit.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - hit.left) / hit.width));
    const t = frac * v.duration;
    tipTime.textContent = clock(t, v.duration >= 3600);
    tip.classList.add('on');
    // Centre over the pointer, kept inside the bar.
    const box = bar.getBoundingClientRect();
    const w = tip.offsetWidth;
    tip.style.left = `${Math.min(box.width - w, Math.max(0, e.clientX - box.left - w / 2))}px`;
    previewFor(v)?.frameAt(t, tipCanvas);
  }
  barHit.addEventListener('pointermove', (e) => {
    if (seeking) seekTo(e);
    showTip(e);
  });
  barHit.addEventListener('pointerleave', () => !seeking && tip.classList.remove('on'));
  const endSeek = () => {
    seeking = false;
    bar.classList.remove('seeking');
    if (!barHit.matches(':hover')) tip.classList.remove('on');
  };
  barHit.addEventListener('pointerup', endSeek);
  barHit.addEventListener('pointercancel', endSeek);

  // m:ss, or h:mm:ss once the video is an hour or longer (both sides then use hours, like 0:05:12 / 1:12:24).
  const clock = (t, hours) => FBQ.fmt.clock(t, hours);
  const barShown = () => !!state.video && inOurFullscreen() && Number.isFinite(state.video.duration) && state.video.duration > 0;

  // The line shared by the progress bar and the ⛶ button in fullscreen. Facebook's author row and description come
  // along into fullscreen: the line sits just above them, and moves up with them when the description is expanded.
  function barLine(r) {
    const ar = avatarBox();
    const bottom = ar ? Math.min(r.bottom - BAR_BOTTOM, ar.top - BAR_GAP) : r.bottom - BAR_BOTTOM;
    const height = Math.max(barHost.offsetHeight, fsHost.offsetHeight);
    return { bottom: Math.max(r.top + height, bottom), height };
  }

  function positionBar(visible) {
    const v = state.video;
    const show = barShown();
    barHost.style.display = show ? 'block' : 'none';
    if (!show || (preview && preview.owner !== v)) stopPreview(); // left fullscreen, or another reel
    if (!show) return;
    if (barHost.parentNode !== document.fullscreenElement) document.fullscreenElement.append(barHost);
    const r = pictureBox(v);
    const line = barLine(r);
    barHost.style.left = `${r.left + BAR_SIDE}px`;
    // Leave the right end of the line to the ⛶ button.
    barHost.style.width = `${Math.max(0, r.width - BAR_SIDE - FS_RIGHT - fsHost.offsetWidth - BAR_FS_GAP)}px`;
    barHost.style.top = `${line.bottom - line.height / 2 - barHost.offsetHeight / 2}px`;
    barHost.style.opacity = visible || seeking ? '1' : '0';
    const pct = `${(Math.min(1, v.currentTime / v.duration) * 100).toFixed(2)}%`;
    barFill.style.width = pct;
    barKnob.style.left = pct;
    const hours = v.duration >= 3600;
    barTime.textContent = `${clock(v.currentTime, hours)} / ${clock(v.duration, hours)}`;
  }
  document.addEventListener('fullscreenchange', () => {
    for (const n of document.querySelectorAll('[data-fbq-fs]')) if (n !== document.fullscreenElement) n.removeAttribute('data-fbq-fs');
    renderMenu();
  });

  // The Like column stays outside a fullscreen video, so downloads then move into the quality menu.
  const railShown = () => !!state.rail && (!document.fullscreenElement || document.fullscreenElement.contains(state.rail.like));

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
    if (rep) {
      state.review.switches++; // a picked quality is the moment the extension is useful
      saveReview(state.review);
    }
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

  // Draw from our HD layer when it is showing, otherwise from Facebook's video.
  function viewerSource(facebookOnly) {
    const layer = state.player && !state.player.dead && state.player.video;
    return !facebookOnly && layer?.readyState >= 2 ? layer : state.video;
  }

  // On Auto, switch this reel to its best quality while the viewer is open, without touching the
  // saved preference; the boost ends with the viewer unless the user picked a quality meanwhile.
  function openViewer() {
    menu.classList.remove('open');
    if (!state.clip || state.viewer) return;
    let boost = null;
    const best = state.qualities.find((r) => !state.failed.has(r.url));
    if (!current() && best) {
      startPlayer(best);
      boost = state.player;
    }
    state.viewer = new FBQ.ClipViewer(root, viewerSource, () => state.clip, t('viewerTip'), () => {
      state.viewer = null;
      if (boost && state.player === boost) stopPlayer();
      renderButton();
    });
    renderButton();
  }

  let lastDetect = 0;
  function detectClip() {
    if (!state.video || Date.now() - lastDetect < 1000) return;
    lastDetect = Date.now();
    // Always sample Facebook's own video: evidence is gathered per element over many frames.
    const rect = FBQ.detectLandscapeClip(state.video);
    if (rect) state.clip = rect;
  }

  // A day counts once a chosen (or remembered) quality has actually played in HD for a while.
  let hdSince = 0;
  function noteHdPlayback() {
    const playingHd = current() && state.video && !state.video.paused;
    if (!playingHd) return (hdSince = 0);
    hdSince ||= Date.now();
    if (Date.now() - hdSince < REVIEW_HD_FOR) return;
    const r = state.review;
    const today = new Date().toDateString();
    if (r.lastHdDay !== today) {
      r.lastHdDay = today;
      r.hdDays++;
      saveReview(r);
    }
    if (host.style.display !== 'none' && !menu.classList.contains('open') && mayShowReviewCard()) showReviewCard(qReviewCard);
  }

  function update() {
    const video = pickVideo();
    if (video !== state.video) {
      stopPlayer();
      state.viewer?.close();
      state.video = video;
      state.clip = null;
      lastDetect = 0;
      menu.classList.remove('open');
      dlMenu.classList.remove('open');
      hideReviewCard(true);
      hdSince = 0;
    }
    const entry = video && FBQ.entryForVideo(video);
    state.entry = entry;
    state.qualities = entry ? FBQ.playableQualities(entry.reps) : [];
    state.downloads = entry ? FBQ.downloadQualities(entry.reps) : [];
    state.avatar = video ? findAvatar(video) : null;
    // The thumbnail comes from our HD layer when it is showing, so it is as sharp as the quality you picked.
    FBQ.history.tick(video, (v) => ({
      ...FBQ.history.scrape(v, state.avatar, fullscreenBox(v)?.parentElement),
      thumb: FBQ.history.snapshot(viewerSource()),
    }));
    state.rail = video && (state.downloads.length || watching()) ? findRail(video) : null;
    resumeFullscreenAfterSwitch(video);
    detectClip();
    const visible = state.qualities.length >= 2 || !!state.clip || (!railShown() && (state.downloads.length > 0 || !!watching())) || inOurFullscreen();
    host.style.display = visible ? 'block' : 'none';
    if (state.qualities.length >= 2) applyPref();
    else stopPlayer();
    renderButton();
    renderMenu();
    renderDownload();
    renderSave();
    noteHdPlayback();
  }

  // The ⚙ and ⛶ buttons fade out together while you watch and come back with the mouse.
  const controlsVisible = () =>
    !state.autoHide ||
    menu.classList.contains('open') ||
    qReviewCard.classList.contains('open') ||
    drag ||
    state.hovering ||
    seeking ||
    state.video.paused ||
    Date.now() - state.lastActive < HIDE_AFTER;

  // The mouse pointer hides along with the buttons, but only while it rests on the playing picture: the element
  // under it gets cursor: none until the mouse moves again.
  let pointer = null; // last mouse position, page-wide
  let idleEl = null;
  function updateCursor(visible) {
    let target = null;
    if (!visible && pointer) {
      const r = pictureBox(state.video);
      if (pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom) {
        target = document.elementFromPoint(pointer.x, pointer.y);
      }
    }
    if (target === idleEl) return;
    idleEl?.removeAttribute('data-fbq-idle');
    idleEl = target;
    idleEl?.setAttribute('data-fbq-idle', '');
  }

  function position() {
    requestAnimationFrame(position);
    positionDownload();
    const visible = !!state.video && controlsVisible();
    positionFullscreenButton(visible);
    updateCursor(visible || !inReelViewer());
    positionBar(visible);
    positionNote();
    if (!state.video || host.style.display === 'none') return;
    const container = document.fullscreenElement || document.body;
    if (host.parentNode !== container) container.append(host);
    const r = pictureBox(state.video);
    const { x, y } = state.pos;
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    const left = r.left + MARGIN + x * Math.max(0, r.width - w - 2 * MARGIN);
    const top = r.top + MARGIN + y * Math.max(0, r.height - h - 2 * MARGIN);
    host.style.left = `${Math.min(innerWidth - w - 8, Math.max(8, left))}px`;
    host.style.top = `${Math.min(innerHeight - h - 8, Math.max(8, top))}px`;
    host.style.opacity = controlsVisible() ? '1' : '0';
    // An open menu (and the support card beside it) may reach over the download button: keep it on top.
    host.style.zIndex = menu.classList.contains('open') || qReviewCard.classList.contains('open') ? '2147483001' : '';
    // Open the menu (and the review card) towards the inside of the video.
    for (const box of [menu, qReviewCard]) {
      box.classList.toggle('down', y < 0.5);
      box.classList.toggle('up', y >= 0.5);
      box.classList.toggle('al-left', x < 0.34);
      box.classList.toggle('al-right', x > 0.66);
      box.classList.toggle('al-center', x >= 0.34 && x <= 0.66);
    }
    positionDonate();
  }

  // Beside the menu on whichever side has room (the reading side first), bottom-aligned with its ☕ row.
  // Closes along with the menu.
  function positionDonate() {
    const open = state.donateOpen && menu.classList.contains('open');
    donate.classList.toggle('open', open);
    if (!open) return;
    const GAP = 8;
    const FOOTER = 40; // height of the menu's credit / ☕ row
    const m = menu.getBoundingClientRect();
    const box = host.getBoundingClientRect(); // the card is positioned inside the fixed host
    const w = donate.offsetWidth;
    const h = donate.offsetHeight;
    const right = m.right + GAP + w <= innerWidth - 8 ? m.right + GAP : null;
    const left = m.left - GAP - w >= 8 ? m.left - GAP - w : null;
    const side = rtl() ? left ?? right : right ?? left;
    // No room on either side (very narrow window): lay the card over the menu, above its ☕ row so that stays clickable.
    const x = side ?? Math.min(innerWidth - w - 8, Math.max(8, m.left));
    const y = Math.min(innerHeight - h - 8, Math.max(8, m.bottom - h - (side === null ? FOOTER : 0)));
    donate.style.left = `${x - box.left}px`;
    donate.style.top = `${y - box.top}px`;
  }

  FBQ.ui = { state, menu, choose, openViewer, startDownload, openSupport, toggleFullscreen, toggleSaved }; // for debugging from the console

  // --- auto-hide and keyboard shortcuts ------------------------------------------

  const reveal = () => (state.lastActive = Date.now());
  host.addEventListener('pointerenter', () => (state.hovering = true));
  host.addEventListener('pointerleave', () => {
    state.hovering = false;
    reveal();
  });
  document.addEventListener(
    'mousemove',
    (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      if (!state.video) return;
      const r = state.video.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) reveal();
    },
    { passive: true }
  );

  // Shift+Up / Shift+Down: one step up or down from the current quality. On Auto, step from
  // what Facebook is playing right now.
  function stepQuality(up) {
    const list = state.qualities; // best first
    if (list.length < 2) return;
    const active = current();
    let target;
    if (active) {
      const i = list.indexOf(active);
      target = up ? list[i - 1] : list[i + 1];
    } else {
      const playing = parseInt(fbPlayingLabel(state.video), 10) || 0;
      target = up
        ? list.filter((r) => FBQ.qualityHeight(r) > playing).at(-1) || list[0]
        : list.find((r) => FBQ.qualityHeight(r) < playing) || list.at(-1);
    }
    if (target && target !== active) choose(target);
  }

  window.addEventListener(
    'keydown',
    (e) => {
      if (!state.video || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.composedPath()[0];
      if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName)) return; // typing a comment
      if (inOurFullscreen() && fullscreenKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        return reveal();
      }
      if (e.code === 'KeyF' && !e.shiftKey && inReelViewer()) {
        e.preventDefault();
        e.stopPropagation();
        return toggleFullscreen();
      }
      if (e.code === 'KeyB' && !e.shiftKey && watching()) {
        e.preventDefault();
        e.stopPropagation();
        reveal();
        return toggleSaved();
      }
      if (host.style.display === 'none') return;
      let handled = true;
      if (e.code === 'KeyQ' && !e.shiftKey) {
        if (menu.classList.toggle('open')) state.donateOpen = false;
        renderMenu();
      } else if (e.code === 'KeyA' && !e.shiftKey) {
        if (current() || state.pref) choose(null); // back to Auto, and forget the saved quality
      } else if (e.shiftKey && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
        stepQuality(e.code === 'ArrowUp');
      } else if (e.code === 'KeyD' && !e.shiftKey && state.downloads.length) {
        if (mine()?.status === 'running') {
          // already downloading this reel; D does nothing rather than cancelling by surprise
        } else if (railShown()) {
          dlMenu.classList.toggle('open');
          renderDownload();
        } else {
          menu.classList.add('open');
          state.donateOpen = false;
          renderMenu();
        }
      } else if (e.code === 'KeyE' && !e.shiftKey && (state.clip || state.viewer)) {
        state.viewer ? state.viewer.close() : openViewer();
      } else if (e.code === 'Escape' && (menu.classList.contains('open') || dlMenu.classList.contains('open'))) {
        menu.classList.remove('open');
        dlMenu.classList.remove('open');
      } else {
        handled = false;
      }
      if (!handled) return;
      e.preventDefault();
      e.stopPropagation();
      reveal();
    },
    true
  );

  function boot() {
    document.body.append(host, dlHost, fsHost, barHost, noteHost);
    setInterval(update, 400);
    requestAnimationFrame(position);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();

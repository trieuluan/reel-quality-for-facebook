// Library page: the whole history and Watch later, grouped by day, with search, multi-select delete,
// clearing a period of history, and export / import.
(() => {
  const { t } = window.__FBQ.i18n;
  const { el, icon, translatePage, listOf, counts, thumb, loadThumbs, openReel, pageName, metaLine } = RQPage;
  const PAGE = 120; // cards added each time the end of the page comes into view
  const HOUR = 60 * 60 * 1000;
  const SINCE = { hour: HOUR, day: 24 * HOUR, week: 7 * 24 * HOUR, all: Infinity };

  const $ = (s) => document.querySelector(s);
  const groupsBox = $('.groups');
  const search = $('.search');
  const pause = $('.pause');
  const banner = $('.banner');
  const tabs = [...document.querySelectorAll('.tab')];
  const pop = $('.clear-menu .pop');
  const fileInput = $('.import-file');
  const deleteBtn = $('.delete');

  const params = new URLSearchParams(location.search);
  let list = params.get('list') === 'saved' ? 'saved' : 'history';
  let items = {};
  let shownCount = PAGE;
  let selecting = false;
  const picked = new Set();
  let observer = null;

  translatePage();
  document.title = t('libraryTitle');

  function toast(text) {
    const n = el('div', { className: 'toast', role: 'status', textContent: text });
    document.body.append(n);
    setTimeout(() => n.remove(), 2500);
  }

  function card(item) {
    const saved = item.savedAt > 0;
    const save = el('button', { className: `icon-btn${saved ? ' on' : ''}`, title: t(saved ? 'unsaveTitle' : 'saveTitle'), 'aria-label': t(saved ? 'unsaveTitle' : 'saveTitle') }, [icon('bookmark')]);
    save.addEventListener('click', (e) => {
      e.stopPropagation();
      RQStore.setSaved({ id: item.id }, !saved);
    });
    const remove = el('button', { className: 'icon-btn', title: t('remove'), 'aria-label': t('remove') }, [icon('close')]);
    remove.addEventListener('click', (e) => {
      e.stopPropagation();
      RQStore.remove([item.id], list);
    });
    const pick = el('input', { type: 'checkbox', className: 'pick', checked: picked.has(item.id), tabIndex: -1, 'aria-label': pageName(item) });
    const box = thumb(item);
    if (item.duration) box.append(el('span', { className: 'dur', textContent: window.__FBQ.fmt.clock(item.duration) }));
    const node = el('div', { className: `card${picked.has(item.id) ? ' picked' : ''}`, tabIndex: 0, dataset: { id: item.id }, title: item.caption || pageName(item) }, [
      box,
      pick,
      el('div', { className: 'acts' }, [save, remove]),
      el('div', { className: 'page', dir: 'auto', textContent: pageName(item) }),
      item.caption ? el('div', { className: 'caption', dir: 'auto', textContent: item.caption }) : null,
      el('div', { className: 'meta', textContent: metaLine(item, list) }),
    ]);
    const toggle = () => {
      picked.has(item.id) ? picked.delete(item.id) : picked.add(item.id);
      pick.checked = picked.has(item.id);
      node.classList.toggle('picked', pick.checked);
      renderSelectTools();
    };
    // From the library a reel always opens in a new tab; Ctrl/⌘ or middle click keeps this one in front.
    const open = (e) => {
      if (selecting) return toggle();
      openReel(item, { newTab: true, background: e.ctrlKey || e.metaKey || e.button === 1 });
    };
    node.addEventListener('click', open);
    node.addEventListener('auxclick', (e) => e.button === 1 && !selecting && open(e));
    node.addEventListener('keydown', (e) => (e.key === 'Enter' || (selecting && e.key === ' ')) && (e.preventDefault(), open(e)));
    return node;
  }

  function render() {
    const c = counts(items);
    for (const tab of tabs) {
      tab.setAttribute('aria-selected', String(tab.dataset.list === list));
      tab.querySelector('.n').textContent = c[tab.dataset.list] || '';
    }
    $('.clear').disabled = !c.history;
    const all = listOf(items, list, search.value);
    for (const id of picked) if (!all.some((it) => it.id === id)) picked.delete(id);
    renderSelectTools();
    observer?.disconnect();
    if (!all.length) {
      const text = search.value.trim() ? t('noMatch') : t(list === 'saved' ? 'emptySaved' : 'emptyHistory');
      groupsBox.replaceChildren(el('div', { className: 'empty', textContent: text }));
      return;
    }
    const key = list === 'saved' ? 'savedAt' : 'watchedAt';
    const sections = [];
    const cards = [];
    let heading = '';
    let grid = null;
    for (const item of all.slice(0, shownCount)) {
      const day = window.__FBQ.fmt.day(item[key]);
      if (day !== heading) {
        heading = day;
        grid = el('div', { className: 'grid' });
        sections.push(el('section', {}, [el('h2', { textContent: day }), grid]));
      }
      const node = card(item);
      cards.push(node);
      grid.append(node);
    }
    groupsBox.replaceChildren(...sections);
    observer = loadThumbs(cards);
  }

  function renderSelectTools() {
    document.body.classList.toggle('selecting', selecting);
    $('.normal-tools').hidden = selecting;
    $('.select-tools').hidden = !selecting;
    deleteBtn.textContent = t('deleteN').replace('{n}', picked.size);
    deleteBtn.disabled = !picked.size;
  }

  async function load() {
    const [all, prefs] = await Promise.all([RQStore.items(), RQStore.prefs()]);
    items = all;
    pause.checked = prefs.paused;
    banner.hidden = !prefs.paused;
    render();
  }

  // --- controls ----------------------------------------------------------------------

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      list = tab.dataset.list;
      history.replaceState(null, '', list === 'saved' ? '?list=saved' : location.pathname);
      shownCount = PAGE;
      picked.clear();
      scrollTo(0, 0);
      render();
    });
  }
  search.addEventListener('input', () => {
    shownCount = PAGE;
    render();
  });
  pause.addEventListener('change', () => RQStore.setPrefs({ paused: pause.checked }));

  $('.select').addEventListener('click', () => {
    selecting = true;
    picked.clear();
    render();
  });
  $('.cancel').addEventListener('click', () => {
    selecting = false;
    picked.clear();
    render();
  });
  deleteBtn.addEventListener('click', async () => {
    const ids = [...picked];
    selecting = false;
    picked.clear();
    await RQStore.remove(ids, list);
  });

  $('.clear').addEventListener('click', (e) => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
  });
  document.addEventListener('click', () => (pop.hidden = true));
  for (const b of pop.querySelectorAll('button')) {
    b.addEventListener('click', async () => {
      pop.hidden = true;
      if (!confirm(`${t(b.dataset.t)}: ${t('clearConfirm')}`)) return;
      const span = SINCE[b.dataset.since];
      await RQStore.clearHistory(span === Infinity ? 0 : Date.now() - span);
    });
  }

  $('.export').addEventListener('click', async () => {
    const data = await RQStore.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `reel-quality-library-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  });
  $('.import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const n = await RQStore.importAll(JSON.parse(await file.text()));
      toast(t('imported').replace('{n}', n));
    } catch {
      toast(t('importFailed'));
    }
  });

  // Add more cards when the end of the page comes into view.
  new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    const total = listOf(items, list, search.value).length;
    if (shownCount >= total) return;
    shownCount += PAGE;
    render();
  }, { rootMargin: '600px' }).observe($('.more'));

  chrome.storage.onChanged.addListener((changes, area) => area === 'local' && (changes.items || changes.prefs) && load());
  load();
})();

// Toolbar popup: the latest reels of the history or Watch later, a search, and the way into the library.
(() => {
  const { t } = window.__FBQ.i18n;
  const { el, icon, translatePage, listOf, counts, thumb, loadThumbs, openReel, pageName, metaLine } = RQPage;
  const SHOW = 50; // the library has the rest

  const listBox = document.querySelector('.list');
  const search = document.querySelector('.search');
  const pause = document.querySelector('.pause');
  const banner = document.querySelector('.banner');
  const tabs = [...document.querySelectorAll('.tab')];
  let list = 'history';
  let items = {};
  let observer = null;

  translatePage();
  document.querySelector('.open-lib').append(icon('external'));

  function row(item) {
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
    const node = el('div', { className: 'row', role: 'listitem', tabIndex: 0, dataset: { id: item.id }, title: item.caption || pageName(item) }, [
      thumb(item),
      el('div', { className: 'text' }, [
        el('div', { className: 'page', dir: 'auto', textContent: pageName(item) }),
        item.caption ? el('div', { className: 'caption', dir: 'auto', textContent: item.caption }) : null,
        el('div', { className: 'meta', textContent: metaLine(item, list) }),
      ]),
      el('div', { className: 'acts' }, [save, remove]),
    ]);
    // Click: this tab (when it is Facebook). Ctrl/⌘ or middle click: a background tab, and the popup stays open.
    const open = (e) => {
      const background = e.ctrlKey || e.metaKey || e.button === 1;
      openReel(item, { newTab: background, background }).then(() => background || window.close());
    };
    node.addEventListener('click', open);
    node.addEventListener('auxclick', (e) => e.button === 1 && open(e));
    node.addEventListener('keydown', (e) => e.key === 'Enter' && open(e));
    return node;
  }

  function render() {
    const c = counts(items);
    for (const tab of tabs) {
      tab.setAttribute('aria-selected', String(tab.dataset.list === list));
      tab.querySelector('.n').textContent = c[tab.dataset.list] || '';
    }
    const shown = listOf(items, list, search.value).slice(0, SHOW);
    observer?.disconnect();
    if (!shown.length) {
      const text = search.value.trim() ? t('noMatch') : t(list === 'saved' ? 'emptySaved' : 'emptyHistory');
      listBox.replaceChildren(el('div', { className: 'empty', textContent: text }));
      return;
    }
    const rows = shown.map(row);
    listBox.replaceChildren(...rows);
    observer = loadThumbs(rows);
  }

  async function load() {
    const [all, prefs] = await Promise.all([RQStore.items(), RQStore.prefs()]);
    items = all;
    pause.checked = prefs.paused;
    banner.hidden = !prefs.paused;
    render();
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      list = tab.dataset.list;
      listBox.scrollTop = 0;
      render();
    });
  }
  search.addEventListener('input', render);
  pause.addEventListener('change', () => RQStore.setPrefs({ paused: pause.checked }));
  document.querySelector('.open-lib').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });
  chrome.storage.onChanged.addListener((changes, area) => area === 'local' && (changes.items || changes.prefs) && load());
  load();
})();

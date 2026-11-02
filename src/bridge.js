// Runs in the extension's isolated world and lets the page-side code (MAIN world, which has no chrome.storage)
// read and write the watch history through window messages.
//
// Facebook's own scripts see these messages too, so only per-reel calls are offered: the page can ask about
// the reel it is showing and record it, but never list the history.
(() => {
  const OPS = {
    status: (id) => RQStore.status(String(id)),
    visit: (meta, thumb) => RQStore.visit(meta, thumb),
    progress: (id, pos, duration, done) => RQStore.progress(String(id), pos, duration, done),
    setSaved: (meta, on, thumb) => RQStore.setSaved(meta, on, thumb),
    setDelay: (delay) => RQStore.setPrefs({ delay }),
  };

  window.addEventListener('message', async (e) => {
    const m = e.data;
    if (e.source !== window || m?.__rq !== 'req' || !Object.hasOwn(OPS, m.op)) return;
    let result = null;
    let error = null;
    try {
      result = await OPS[m.op](...(Array.isArray(m.args) ? m.args : []));
    } catch (err) {
      error = String(err?.message || err);
    }
    window.postMessage({ __rq: 'res', id: m.id, result, error }, location.origin);
  });

  // Something changed elsewhere (the popup, the library, another tab): the page asks again about its reel.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.items || changes.prefs)) window.postMessage({ __rq: 'changed' }, location.origin);
  });
})();

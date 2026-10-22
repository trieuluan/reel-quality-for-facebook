// Download one quality of a reel, with its sound, as a single MP4 file.
//
// Each DASH representation is one file on Facebook's CDN. Its sidx tells us where the last segment
// ends, which is the file's length; we then pull it in ranged chunks (so progress is smooth and a
// cancel stops quickly) and hand video + audio to the muxer.
(() => {
  const FBQ = (window.__FBQ ||= {});
  const CHUNK = 1 << 20; // 1 MB per range request
  const PARALLEL = 4;

  async function fileInfo(rep, signal) {
    const index = await FBQ.fetchRange(rep.url, rep.index, signal);
    const segments = FBQ.parseSidx(index, rep.index.start);
    if (!segments.length) throw new Error('[FBQ] empty segment index');
    return { size: segments.at(-1).range.end + 1, duration: segments.at(-1).end };
  }

  // Fetch bytes [0, size) of each file, reporting the bytes received so far across all of them.
  async function fetchAll(files, onBytes, signal) {
    const jobs = [];
    const buffers = files.map(({ size }, i) => {
      for (let start = 0; start < size; start += CHUNK) jobs.push({ file: i, start, end: Math.min(size, start + CHUNK) - 1 });
      return new Uint8Array(size);
    });
    // One failed chunk fails the download, so stop the other workers too.
    const ctrl = new AbortController();
    const cancel = () => ctrl.abort();
    signal?.addEventListener('abort', cancel);
    let next = 0;
    let received = 0;
    async function worker() {
      while (next < jobs.length) {
        const job = jobs[next++];
        const data = await FBQ.fetchRange(files[job.file].rep.url, job, ctrl.signal);
        buffers[job.file].set(new Uint8Array(data), job.start);
        received += data.byteLength;
        onBytes(received);
      }
    }
    try {
      await Promise.all(Array.from({ length: PARALLEL }, () => worker().catch((e) => (cancel(), Promise.reject(e)))));
    } finally {
      signal?.removeEventListener('abort', cancel);
    }
    signal?.throwIfAborted(); // report a user cancel as such, not as whichever chunk noticed it
    return buffers.map((b) => b.buffer);
  }

  /**
   * @param {{ video: object, audio: object|null, onProgress?: (fraction: number) => void, signal?: AbortSignal }} opts
   * @returns {Promise<Blob>}
   */
  FBQ.downloadReel = async function downloadReel({ video, audio, onProgress = () => {}, signal }) {
    const reps = audio ? [video, audio] : [video];
    const infos = await Promise.all(reps.map((rep) => fileInfo(rep, signal)));
    const files = infos.map((info, i) => ({ ...info, rep: reps[i] }));
    const total = files.reduce((n, f) => n + f.size, 0);
    onProgress(0);
    const data = await fetchAll(files, (bytes) => onProgress(bytes / total), signal);
    return FBQ.muxMp4(files.map((f, i) => ({ data: data[i], duration: f.duration })));
  };

  // Rough size in bytes before anything is fetched, from the manifest's bitrates and duration.
  FBQ.estimateSize = (video, audio, fallbackDuration) =>
    (((video.bandwidth || 0) + (audio?.bandwidth || 0)) / 8) * (video.duration || fallbackDuration || 0);

  FBQ.saveBlob = function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
})();

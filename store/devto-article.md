---
title: I couldn't change the quality of Facebook Reels, so I built a Chrome extension that can
published: true
tags: showdev, javascript, webdev, opensource
cover_image: https://raw.githubusercontent.com/trieuluan/reel-quality-for-facebook/main/store/shot-1-1280x800.png
---

Lately I've been hooked on AI-made short films. The Vietnamese channels that translate them keep getting copyright strikes on YouTube, so I started watching them on Facebook instead. Then a new annoyance appeared: halfway through a reel, Facebook would quietly drop the quality to 540p, then 360p. On a fast connection. And Reels has no quality setting at all.

So I built one. **Reel Quality** is a small Chrome extension that adds a ⚙ button to the reel you're watching, lists the resolutions that reel actually has, and lets you pick one.

![Quality menu on a reel](https://raw.githubusercontent.com/trieuluan/reel-quality-for-facebook/main/store/shot-1-1280x800.png)

- Chrome Web Store: https://chromewebstore.google.com/detail/nbgnfkagjipmlfhlpilandmenjmilmcc
- Source (MIT): https://github.com/trieuluan/reel-quality-for-facebook

> **Transparency note:** I built this with a lot of help from an AI coding assistant (Claude Code), and it also helped me edit this post. The debugging on real Facebook pages, the design decisions and the bugs are mine.

Here's how it works under the hood, because it turned out to be more interesting than I expected.

## 1. Where do the qualities come from?

Facebook plays Reels with **DASH over Media Source Extensions**. The `<video>` element only has a `blob:` URL, so there's nothing to swap. But the page receives a DASH manifest for every reel, embedded in its GraphQL responses as a `dash_manifest` string (an MPD XML document). Each `<Representation>` in it is one quality, with a `FBQualityLabel` like `720p`, its own `BaseURL`, and byte ranges for the init segment and the segment index.

The extension runs a content script in the page's **MAIN world** at `document_start`, wraps `fetch` and `XMLHttpRequest`, and scans JSON responses for `dash_manifest`. The first reel's data is server-rendered into `<script type="application/json">` tags, so those get scanned too.

One fun surprise: facebook.com enforces **Trusted Types**, so `DOMParser` is off the table. The MPD is simple enough that a few regular expressions parse it reliably.

## 2. Which manifest belongs to which video?

The page holds manifests for several reels at once, so I needed to tie each one to its `<video>`. The chain I ended up with:

1. Facebook's player downloads a segment whose URL path matches a `BaseURL` from some manifest. I remember the response's byte length.
2. The player appends a buffer of that same length to a `SourceBuffer`.
3. That `SourceBuffer` belongs to a `MediaSource`, which was turned into the `blob:` URL that sits in `video.src`.

```js
const appendBuffer = SourceBuffer.prototype.appendBuffer;
SourceBuffer.prototype.appendBuffer = function (data) {
  const entry = recentSizes.get(data?.byteLength);
  const ms = entry && sbToMs.get(this);
  if (ms) msToEntry.set(ms, entry);
  return appendBuffer.call(this, data);
};
```

Hooks on `URL.createObjectURL` and `MediaSource.prototype.addSourceBuffer` fill in the other two links. If the chain ever fails, the `/reel/<id>` in the address bar is a decent fallback.

## 3. Facebook won't switch quality, so don't ask it to

This was the key decision. Facebook's player reads the manifest once and picks a quality on its own, and there's no public way to tell it otherwise. Rewriting its internals felt fragile.

Instead, the extension lays **its own `<video>` over Facebook's** and plays the chosen quality there, video only. Facebook's player keeps running underneath and still owns the sound, the controls, looping and seeking. My layer just follows its clock:

```js
const drift = me.currentTime - fb.currentTime;
if (Math.abs(drift) > MAX_DRIFT) {
  me.currentTime = fb.currentTime;            // big jump: seek
} else {
  const rate = fb.playbackRate * (1 - drift); // small drift: nudge the speed
  me.playbackRate = Math.min(fb.playbackRate * 1.25, Math.max(fb.playbackRate * 0.75, rate));
}
// Only show the HD layer when it is actually in sync; otherwise Facebook's picture shows through.
me.style.opacity = inSync ? '1' : '0';
```

That last line is what makes it feel seamless: you never get a black frame while the HD layer is buffering, you just see Facebook's own picture for a moment.

## 4. A tiny DASH player

Each Facebook representation is a single fragmented MP4 with a `sidx` box (segment index). Read the `sidx` and you know exactly which byte range holds which seconds of video:

```js
for (let i = 0; i < count; i++, p += 12) {
  const size = v.getUint32(p) & 0x7fffffff; // referenced_size
  const duration = v.getUint32(p + 4);      // subsegment_duration
  segments.push({
    start: time / timescale,
    end: (time + duration) / timescale,
    range: { start: byte, end: byte + size - 1 },
  });
  byte += size;
  time += duration;
}
```

From there it's a small loop: fetch the init segment, then keep about 20 seconds buffered ahead of Facebook's current time with range requests, and trim what's behind.

## 5. Bonus: landscape clips stuck in vertical reels

A lot of reels are really a horizontal clip pasted into a 9:16 frame, with black bars and a caption on top. Version 1.1 spots those and can show the clip large in the middle of the screen.

![Expand landscape clip](https://raw.githubusercontent.com/trieuluan/reel-quality-for-facebook/main/store/shot-3-1280x800.png)

My first version looked at one frame and searched for bright rows. It failed badly on a night-time clip, where most of the "clip" was as black as the bars. The fix was to gather evidence over several frames instead:

- **Bars** stay black and never change.
- **Captions** in the bars are bright but rarely change.
- **The clip** changes almost all the time, even when it's dark.

So each pixel tracks its maximum brightness and how often it changes. Rows that move are clip rows. Then the band snaps to a common aspect ratio (16:9, 1.85, 2.39…); if it's shorter than 16:9, part of a dark clip was probably mistaken for bars, so it falls back to a centered 16:9 window. Finally, everything outside the band has to look like bars, or it's just a normal vertical reel and the option stays hidden.

## Honest limitations

- While a fixed quality is selected, Facebook still streams its own copy underneath, so bandwidth goes up by roughly 25–30%. On Auto, the extension does nothing at all.
- Facebook changes its internals often. When it does, this will break until I fix it.
- Desktop Chromium browsers only. Mobile browsers don't run extensions.

## Try it

- Chrome Web Store: https://chromewebstore.google.com/detail/nbgnfkagjipmlfhlpilandmenjmilmcc
- GitHub: https://github.com/trieuluan/reel-quality-for-facebook

It collects no data and asks for no extra permissions. If you find a reel where it doesn't work, an issue on GitHub would help a lot. And I'd love to hear how you'd have approached the "can't control the player" problem differently.

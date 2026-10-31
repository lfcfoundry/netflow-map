# Developer changelog

Copyright (c) 2026 LFC Foundry. MIT License.

What changed for people who read or change the code, newest first, each day in three tiers: **Simple** (what to know without reading code), **Moderate** (where it lives and how it behaves), **Deep** (the mechanism, the numbers and the traps). The plain list for people who use the app is CHANGELOG.md. Timings are lab browser runs unless stated.

## October 30

### Simple
- Big network maps lay out faster: 100,000 items 7.2 s to 4.0 s in lab Chromium (PRs 100 and 101). Below 50,000 items the pictures are identical to before.
- Far-out dotted links draw as one thin solid line (PR 99), 283 ms to 3 ms a picture at 2,000 items.
- memory-compression 2.6.2 to 2.6.6 (PR 102): same packed bytes, faster pack and wake.
- New laptop-test section for turning 3D maps (x3d), source in the project files (laptop-extra11-source.js).

### Moderate
- `wasm/stress.c` `bfs` switches to bottom-up once a level holds more than 1/20 of the items. Hop counts are unchanged, so pairs and pictures are unchanged. Rebuild with `sh wasm/build.sh && python3 wasm/embed.py`; the toolchain reproduces the old bytes exactly from the old source.
- `networkLayout` keeps `sizeAt[i]` (each item's size worked out once); the push-apart, spread and packing read it by index.
- `STRESS.sepPassesBig` (10) applies when a piece has more than `STRESS.sepBigMin` (50,000) items. Both are part of the saved-layout fingerprint, so older saved layouts of big maps are laid out once more.
- `src/render.js` `tessellate(S, opts)` takes `opts.k` (the zoom). A dotted link (`dash === 1`) whose dot spacing times k is under 2 px is drawn solid at alpha times on/(on + off). WebGL 2 `draw()` cuts the dots again when `view.k >= T.solidDotK`. Canvas and WebGPU are unchanged.

### Deep
- Why the BFS mattered: the multilevel start halves the map until 2,000 items or fewer, and its coarsest copy is dense (100,000 items gave 1,816 items with 337,892 neighbor entries, about 186 each). That level uses every pair (`full`), so 1,816 top-down walks touched about 614 million entries (1.0 s). Bottom-up stops at the first neighbor in the frontier: 0.25 s. Profile split at 100,000 after both changes: push-apart is the largest step (about 2.9 s before PR 101), Stress about 1.2 s, setup about 2.5 s.
- `separate` (wasm) now skips the square root when `d2 > need^2 * 1.000001`; the exact test still decides every close pair, so positions are identical. No measurable gain: the cost is memory access and the pushes themselves, not the square root.
- Fewer passes: truth 0.1785 against 0.1784, same area at 30,000 and 100,000 in the browser. Below 50,000 the area sometimes grew about 20% (an extra grow round), so the threshold stays at 50,000.
- Dotted links: 1,467 dotted links of 300 to 900 units were cut into about 250,000 pieces (about 60 MB of mesh per picture); profile was bufferData 998 ms, garbage collection 206 ms, tessellation 360 ms over 8 pictures. Picture match after: 103 of 921,600 pixels differ by more than 24 levels at fit zoom, identical at 8x.
- Tried and not kept: map file positions and importance columns as plain number columns instead of base64 text (1,493 KB to 1,381 KB at 30,000 items, 7.5% smaller) made opening 53 ms to 168 ms and saving about 25% slower, so the base64 form stays.

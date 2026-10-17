# wasm/ : the Force and Distances arrangements in WebAssembly

Copyright (c) 2026 LFC Foundry. MIT License.

`force.c` is a line-for-line C port of one round of `forceSim` in `src/engine.js` (Barnes-Hut tree, repulsion, springs, gravity, move), 2D and 3D. `force.wasm` is its build (7,260 bytes). `python3 wasm/embed.py` puts those bytes into `src/engine.js` between the `WASM:force:BEGIN` and `WASM:force:END` markers as base64, so the page stays one file and the helper thread gets the same text.

Rebuild, from the repository root (needs clang with the wasm32 target and wasm-ld; checked with Ubuntu clang 18.1.3, and two builds in a row give the same bytes):

```
sh wasm/build.sh          # prints the size
python3 wasm/embed.py     # puts the bytes into src/engine.js
node tools/build.mjs      # rebuilds index.html
node test/force-wasm.test.js
```

Rules:
- The JavaScript `forceSimJs` stays the first answer and the fallback. `forceSim` in `src/engine.js` normalizes the item weights once, then uses WebAssembly for 150 items or more (`E.forceWasm.minItems`), and falls back to JavaScript if WebAssembly is missing, blocked or throws (`E.forceWasm.error` says why; `E.forceWasm.on = false` turns it off).
- If you change `forceSimJs`, change `force.c` the same way and rebuild: `test/force-wasm.test.js` must show a largest position difference of 0. The build uses `-ffp-contract=off` so no multiply and add are fused; keep it.
- The only page policy change WebAssembly needs is `'wasm-unsafe-eval'` in `script-src` (this page has no policy at all today). Do not add `'unsafe-eval'`.
- `rnd` is imported from the page: the rare case of two items on exactly the same spot draws from the page's own random generator, so JavaScript and WebAssembly agree there too.
- Numbers: `docs/BENCHMARKS.md` section 21 and `node bench/force-wasm.js <node|chromium|firefox|webkit|epiphany>`.

## stress.c: the Distances layout and the push-apart

`stress.c` (5,616 bytes) is a port of `stressComponent`'s pair building (every pair for small pieces; pivots, links and near neighbors for big ones), the one-time shuffle (the same xorshift), the forward and backward sweeps, and of `separate`'s grid passes (2D). `src/engine.js` embeds it between `WASM:stress:BEGIN` and `WASM:stress:END`; `E.stressWasm` has `on`, `minItems` (150), `calls`, `sepCalls`, `pairs` and `error`.
- Pairs are two item numbers plus one Uint16 hop code (the hop count, +512 for a pivot pair) with two 1,024-entry float32 tables for distance and weight: 10 bytes a pair instead of 16, the same numbers. The JavaScript path stores them the same way. A hop count over 511 (a very long chain) makes both use the old Float32 lists.
- The wasm path writes X only at the end, so any failure (no WebAssembly, blocked, memory refused, hop count over 511) leaves the JavaScript to start from the same picture and the same random seed.
- `separate` hands back "start table too small" or "grid over 4,000,000 cells" and the page continues with a bigger table or the sparse version, as the JavaScript does.
- Check: `node test/stress-wasm.test.js` (largest position difference must be 0, also against Closeness, a 700-item chain, a crowded push-apart, a grid larger than the start table, a grid over 4,000,000 cells, and broken or missing WebAssembly). Numbers: `docs/BENCHMARKS.md` section 22 and `node bench/stress-wasm.js <node|chromium|firefox|webkit|epiphany>`.
- Not ported: the settle step (`settleOverlaps`), 3D stress, the exact-quality path, the tuning option `reshuffle`.

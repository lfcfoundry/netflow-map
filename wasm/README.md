# wasm/ : the Force arrangement in WebAssembly

Copyright (c) 2026 LFC Foundry. MIT License.

`force.c` is a line-for-line C port of one round of `forceSim` in `src/engine.js` (Barnes-Hut tree, repulsion, springs, gravity, move), 2D and 3D. `force.wasm` is its build (7,260 bytes). `python3 wasm/embed.py` puts those bytes into `src/engine.js` between the `WASM:BEGIN` and `WASM:END` markers as base64, so the page stays one file and the helper thread gets the same text.

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

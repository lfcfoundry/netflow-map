/* Copyright (c) 2026 LFC Foundry. MIT License. Force arrangement rounds: JavaScript against the WebAssembly build (wasm/force.c), one engine at a time.
 *   node bench/force-wasm.js node|chromium|firefox|webkit|epiphany [reps]     prints a Markdown table (milliseconds, lower is better) and saves bench/results/force-wasm-<engine>.json
 * The positions of the two are compared too (the largest difference must be 0). Browsers: see bench/driver.js for the programs. */
'use strict';
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const texts = { columns: R('src/columns.js'), engine: R('src/engine.js') };
const CASES = [[100, 2, 150], [150, 2, 150], [300, 2, 150], [2000, 2, 240], [10000, 2, 120], [30000, 2, 60], [10000, 3, 90]];   // items, dimensions, rounds
async function inPage(arg) {
  const { texts, reps, cases } = arg, g = globalThis;
  (0, eval)(texts.columns.replace(/if \(typeof module[^\n]*\n?/, '') + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  (0, eval)(texts.engine.replace(/if \(typeof module[^\n]*\n?/, '').replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  const E = g.NFMEngine, W = E.forceWasm, rows = [];
  function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let q = Math.imul(s ^ s >>> 15, 1 | s); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; }; }
  function graph(k, dim) { const r = rng(7), X = new Float64Array(k * dim), pairs = [], deg = new Float64Array(k); for (let i = 0; i < k * dim; i++) X[i] = (r() - 0.5) * 2 * Math.sqrt(k) * 20; for (let i = 1; i < k; i++) for (let e = 0; e < 2; e++) { const j = Math.floor(r() * i); pairs.push(i, j); deg[i]++; deg[j]++; } const mass = new Float64Array(k); for (let i = 0; i < k; i++) mass[i] = 1 + deg[i]; return { X, pairs, mass }; }
  W.minItems = 0;   // measure the kernel itself, whatever the size
  for (const [k, dim, iters] of cases) {
    const gr = graph(k, dim), tj = [], tw = []; let maxd = 0, used = true;
    for (let r = 0; r < reps; r++) {
      const xa = Float64Array.from(gr.X), ma = Float64Array.from(gr.mass); W.on = false; let t = performance.now(); E.forceSim(xa, k, dim, gr.pairs.slice(), ma, iters, 60, rng(1)); tj.push(performance.now() - t);
      const xb = Float64Array.from(gr.X), mb = Float64Array.from(gr.mass); W.on = true; const c0 = W.calls; t = performance.now(); E.forceSim(xb, k, dim, gr.pairs.slice(), mb, iters, 60, rng(1)); tw.push(performance.now() - t); if (W.calls === c0) used = false;
      if (r === 0) for (let i = 0; i < xa.length; i++) maxd = Math.max(maxd, Math.abs(xa[i] - xb[i]));
    }
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
    rows.push({ k, dim, iters, js: +med(tj).toFixed(1), wasm: +med(tw).toFixed(1), maxd, used, error: W.error });
  }
  return rows;
}
(async () => {
  const which = process.argv[2] || 'node', reps = +(process.argv[3] || 3), arg = { texts, reps, cases: CASES };
  let rows, version;
  if (which === 'node') { rows = await inPage(arg); version = 'Node ' + process.version; }
  else { const D = await require('./driver.js').open(which, { timeout: 3600000 }); version = D.version; await D.goto('about:blank'); rows = await D.page.evaluate(inPage, arg); await D.close(); }
  console.log('\n' + version + ' (median of ' + reps + ' runs; milliseconds, lower is better)\n\n| items | dim | rounds | JavaScript ms | WebAssembly ms | times faster (higher is better) | largest position difference |\n| ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  rows.forEach((r) => console.log(`| ${r.k.toLocaleString('en-US')} | ${r.dim}D | ${r.iters} | ${r.js} | ${r.used ? r.wasm : 'wasm did not run: ' + r.error} | ${(r.js / r.wasm).toFixed(2)} | ${r.maxd} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'force-wasm-' + which + '.json'), JSON.stringify({ version, reps, rows }, null, 1));
  process.exit(0);
})();

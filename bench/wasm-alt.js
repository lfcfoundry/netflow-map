/* Copyright (c) 2026 LFC Foundry. MIT License. WebAssembly against JavaScript for the arrangements that use wasm/stress.c's second set (Distances 3D, Closeness, Circle, Radial), in one page per browser with the two versions ALTERNATING
 * (JS, wasm, JS, wasm, ...) so a slow stretch of the machine hits both alike. One untimed pair first (warm-up), then `reps` timed pairs; the table gives the medians and the middle ratio.
 *   node bench/wasm-alt.js chromium|firefox|webkit|epiphany [reps] [arrangements, comma separated] [sizes, comma separated]
 * Lower milliseconds are better; the ratio is JavaScript time divided by WebAssembly time (above 1 means WebAssembly is faster). The largest position difference must be 0. */
'use strict';
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const texts = { layers: R('vendor/netflow-layers.js'), sankey: R('vendor/netflow-sankey.js'), columns: R('src/columns.js'), engine: R('src/engine.js'), gen: R('bench/gen.js') };
async function inPage(arg) {
  const { texts, reps, arrs, sizes } = arg, g = globalThis, ev = (code) => (0, eval)(code), strip = (t) => t.replace(/if \(typeof module[^\n]*\n?/, '');
  ev(texts.layers); ev(texts.sankey);
  ev(strip(texts.columns) + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  ev(strip(texts.engine).replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  ev(strip(texts.gen) + '\n;globalThis.NFMGen = NFMGen;');
  const E = g.NFMEngine, C = g.NFMColumns, GEN = g.NFMGen, W = E.stressWasm, rows = [], med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  for (const arr of arrs) for (const n of sizes) {
    const dg = C.derive(JSON.parse(JSON.stringify(GEN.graph('moderate', n, 11)))), tj = [], tw = []; let a, b, d = 0;
    const run = (on) => { W.on = on; const t0 = performance.now(); const L = E.build(dg, { view: 'network', arrange: arr, colorBy: 'group' }); return [performance.now() - t0, L]; };
    run(false); run(true);
    for (let r = 0; r < reps; r++) { const x = run(r % 2 === 0 ? false : true), y = run(r % 2 === 0 ? true : false); const j = r % 2 === 0 ? x : y, w = r % 2 === 0 ? y : x; tj.push(j[0]); tw.push(w[0]); a = j[1]; b = w[1]; }
    a.nodes.forEach((q, i) => { d = Math.max(d, Math.abs(q.cx - b.nodes[i].cx), Math.abs(q.cy - b.nodes[i].cy), Math.abs((q.z || 0) - (b.nodes[i].z || 0))); });
    const ratios = tj.map((t, i) => t / tw[i]);
    rows.push({ arr, n, js: Math.round(med(tj)), wasm: Math.round(med(tw)), ratio: +med(ratios).toFixed(2), diff: d, used: { c3: W.calls3, cc: W.closeCalls, sp: W.sparseCalls, sep: W.sepCalls } });
  }
  return rows;
}
(async () => {
  const which = process.argv[2] || 'chromium', reps = +(process.argv[3] || 5), arrs = (process.argv[4] || 'stress3d,closeness,radial,circle').split(','), sizes = (process.argv[5] || '1000,3000,10000,30000').split(',').map(Number);
  const D = await require('./driver.js').open(which, { timeout: 3600000 }); await D.goto('about:blank');
  const rows = await D.page.evaluate(inPage, { texts, reps, arrs, sizes }); const version = D.version; await D.close();
  console.log('\n' + version + ' (median of ' + reps + ' alternating pairs after one warm-up pair; milliseconds, lower is better; ratio = JavaScript time / WebAssembly time, above 1 means WebAssembly is faster)\n\n| arrangement | items | JavaScript ms | WebAssembly ms | ratio (higher is better) | largest position difference |\n|---|---|---|---|---|---|');
  rows.forEach((r) => console.log(`| ${r.arr} | ${r.n.toLocaleString('en-US')} moderate | ${r.js} | ${r.wasm} | ${r.ratio} | ${r.diff} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'wasm-alt-' + which + '.json'), JSON.stringify({ version, reps, rows }, null, 1));
  process.exit(0);
})();

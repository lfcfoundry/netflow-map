/* Copyright (c) 2026 LFC Foundry. MIT License. The raised "too many stops" limit for layered views (Flow here), measured in a FRESH page each time: the old engine (limit 90,000 stops, from the text file given) against the current src/engine.js (limit 250,000). A map the old engine refuses shows "refused"; for the rest, "first" is the first layout of the page (cold code). Milliseconds, lower is better. Heap is the page's used JS heap after the layout (MB, lower is better).
 *   node bench/stops-limit.js chromium|firefox|webkit|epiphany [reps] [old-engine.js] [sizes, comma separated]
 * Uses the 'moderate' generator (about 3 links per page). */
'use strict';
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const base = { columns: R('src/columns.js'), gen: R('bench/gen.js'), layers: R('vendor/netflow-layers.js') };
async function inPage(arg) {
  const { base, engine, n } = arg, g = globalThis, ev = (code) => (0, eval)(code), strip = (t) => t.replace(/if \(typeof module[^\n]*\n?/, '');
  ev(base.layers);
  ev(strip(base.columns) + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  ev(strip(base.gen) + '\n;globalThis.NFMGen = NFMGen;');
  ev(strip(engine).replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  const gr = g.NFMColumns.derive(JSON.parse(JSON.stringify(g.NFMGen.graph('moderate', n, 11))));
  const t0 = performance.now(); let nodes = 0, err = null;
  try { nodes = g.NFMEngine.build(gr, { view: 'flow' }).nodes.length; } catch (e) { err = String(e.message || e).slice(0, 40); }
  const ms = performance.now() - t0, heap = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0;
  return { ms, nodes, err, heap };
}
(async () => {
  const which = process.argv[2] || 'chromium', reps = +(process.argv[3] || 3), oldE = fs.readFileSync(process.argv[4] || '/tmp/engine-main.js', 'utf8'), newE = R('src/engine.js');
  const sizes = (process.argv[5] || '3000,5000,6500,8000').split(',').map(Number), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const D = await require('./driver.js').open(which, { timeout: 3600000 }), rows = [];
  const once = async (engine, n) => { await D.goto('about:blank'); return D.page.evaluate(inPage, { base, engine, n }); };
  for (const n of sizes) {
    await once(newE, Math.min(n, 300));   // warm-up
    const o = [], w = [];
    for (let r = 0; r < reps; r++) { const first = r % 2 === 0 ? [oldE, newE] : [newE, oldE]; const a = await once(first[0], n), b = await once(first[1], n); o.push(r % 2 === 0 ? a : b); w.push(r % 2 === 0 ? b : a); }
    const f = (arr, k) => med(arr.map((x) => x[k]));
    rows.push({ n, old: o[0].err ? 'refused' : f(o, 'ms'), oldErr: o[0].err, nw: w[0].err ? 'refused' : f(w, 'ms'), newErr: w[0].err, nodes: w[0].nodes, oldHeap: f(o, 'heap'), newHeap: f(w, 'heap') });
  }
  const version = D.version; await D.close();
  const fm = (v) => (typeof v === 'number' ? v.toFixed(0) : v);
  console.log('\n' + version + ' (median of ' + reps + ' fresh pages per version, taking turns; milliseconds and MB, lower is better)\n\n| pages | old engine first Flow layout | new engine first Flow layout | heap old → new (MB) |\n|---|---|---|---|');
  rows.forEach((r) => console.log(`| ${r.n} | ${fm(r.old)} | ${fm(r.nw)} | ${fm(r.oldHeap)} → ${fm(r.newHeap)} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'stops-limit-' + which + '.json'), JSON.stringify({ version, reps, rows }, null, 1));
  process.exit(0);
})();

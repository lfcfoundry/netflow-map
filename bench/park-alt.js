/* Copyright (c) 2026 LFC Foundry. MIT License. The idle layout park (src/layout-park.js) with two versions of memory-compression, run the same way in a FRESH page each time with the versions taking turns: pack the link list of a big layout ("park"), read one link from the packed list (first read = the chunk is opened; second read in the same chunk; a read from another chunk), then read the whole list back ("wake"). Milliseconds, lower is better; the packed size in bytes (lower is better) must be the same or smaller.
 *   node bench/park-alt.js chromium|firefox|webkit|epiphany [reps] [old.js] [new.js] [pages, simple tree]
 * Sizes pages: a plain tree has about one link per page, so 60,000 pages gives about 60,000 links (3 chunks of 25,000). */
'use strict';
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const base = { columns: R('src/columns.js'), engine: R('src/engine.js'), gen: R('bench/gen.js'), layers: R('vendor/netflow-layers.js'), gw: R('vendor/graph-walk.js'), sk: R('vendor/netflow-sankey.js'), park: R('src/layout-park.js') };
async function inPage(arg) {
  const { base, mc, n } = arg, g = globalThis, ev = (code) => (0, eval)(code), strip = (t) => t.replace(/if \(typeof module[^\n]*\n?/, '');
  g.MEMORY_COMPRESSION_NO_EVAL = true; ev(mc); ev(base.layers); ev(base.gw); ev(base.sk);
  ev(strip(base.columns) + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  ev(strip(base.gen) + '\n;globalThis.NFMGen = NFMGen;');
  ev(strip(base.engine).replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  ev(base.park);
  const gr = g.NFMColumns.derive(JSON.parse(JSON.stringify(g.NFMGen.graph('simple', n, 11)))), L = g.NFMEngine.build(gr, { view: 'flow' }), edges = L.edges.length;
  g.NFMPark.attach(L, { min: 1, delay: 1e9 });
  const t0 = performance.now(); L.parkNow(); const park = performance.now() - t0, bytes = L.parkBytes();
  const t1 = performance.now(); L.edgeAt(5); const first = performance.now() - t1;
  const t2 = performance.now(); L.edgeAt(9000); const same = performance.now() - t2;
  const t3 = performance.now(); L.edgeAt(edges - 5); const other = performance.now() - t3;
  const t4 = performance.now(); const all = L.edges.length; const wake = performance.now() - t4;
  return { edges, packed: L.parked() === false, park, bytes, first, same, other, wake, ok: all === edges };
}
(async () => {
  const which = process.argv[2] || 'chromium', reps = +(process.argv[3] || 7), oldT = fs.readFileSync(process.argv[4] || '/tmp/mc-203.js', 'utf8'), newT = fs.readFileSync(process.argv[5] || '/tmp/mc-232.js', 'utf8'), n = +(process.argv[6] || 60000);
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const D = await require('./driver.js').open(which, { timeout: 3600000 });
  const once = async (mc) => { await D.goto('about:blank'); return D.page.evaluate(inPage, { base, mc, n }); };
  await once(oldT); await once(newT);
  const o = [], w = [];
  for (let r = 0; r < reps; r++) { const first = r % 2 === 0 ? [oldT, newT] : [newT, oldT]; const a = await once(first[0]), b = await once(first[1]); o.push(r % 2 === 0 ? a : b); w.push(r % 2 === 0 ? b : a); }
  const version = D.version; await D.close();
  const f = (arr, k) => med(arr.map((x) => x[k])), rows = ['park', 'first', 'same', 'other', 'wake', 'bytes'].map((k) => ({ k, old: f(o, k), nw: f(w, k) }));
  console.log('\n' + version + ' (median of ' + reps + ' fresh pages per version, taking turns; ' + o[0].edges + ' links; milliseconds and bytes, lower is better; all read back equal: ' + (o.every((x) => x.ok) && w.every((x) => x.ok)) + ')\n\n| step | old → new | ratio old / new (higher is better) |\n|---|---|---|');
  rows.forEach((r) => console.log(`| ${r.k} | ${r.old.toFixed(r.k === 'bytes' ? 0 : 1)} → ${r.nw.toFixed(r.k === 'bytes' ? 0 : 1)} | ${(r.old / r.nw).toFixed(2)} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'park-alt-' + which + '.json'), JSON.stringify({ version, reps, edges: o[0].edges, rows }, null, 1));
  process.exit(0);
})();

/* Copyright (c) 2026 LFC Foundry. MIT License. Two versions of the vendored netflow-layers, run the same way in the app's own engine (a Flow layout), in a FRESH page each time with the versions taking turns (old, new, new, old, ...), so a slow stretch of the machine hits both alike.
 *   node bench/layers-alt.js chromium|firefox|webkit|epiphany [reps] [old.js] [new.js] [sizes, comma separated] [view] [moderate|simple]
 * "first" is the first Flow layout of a page (cold code); "again" is a second layout in the same page; "later" is one after the page has been open a moment. Milliseconds, lower is better; ratio = old / new (higher is better, above 1 means the new one is faster). The pictures must match (digest of the layout). */
'use strict';
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const base = { columns: R('src/columns.js'), engine: R('src/engine.js'), gen: R('bench/gen.js') };
async function inPage(arg) {   // layout with the given netflow-layers text, straight after its script ("first": cold code) and again in the same page ("again")
  const { base, lay, n, view, kind } = arg, g = globalThis, ev = (code) => (0, eval)(code), strip = (t) => t.replace(/if \(typeof module[^\n]*\n?/, '');
  ev(lay);
  ev(strip(base.columns) + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  ev(strip(base.gen) + '\n;globalThis.NFMGen = NFMGen;');
  ev(strip(base.engine).replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  const E = g.NFMEngine, C = g.NFMColumns, GEN = g.NFMGen;
  const mk = () => { const gr = GEN.graph(kind, n, 11); return C.derive(JSON.parse(JSON.stringify(gr))); };
  const g1 = mk(), g2 = mk(), g3 = mk();
  const t0 = performance.now(); const L = E.build(g1, { view }); const t1 = performance.now();
  const L2 = E.build(g2, { view }); const t2 = performance.now();
  await new Promise((r) => setTimeout(r, 30));
  const t3 = performance.now(); const L3 = E.build(g3, { view }); const t4 = performance.now();
  const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
  const dig = (X) => fnv(JSON.stringify(X, (k, v) => (k === 'ms' ? undefined : ArrayBuffer.isView(v) ? Array.from(v) : v)));
  return { first: t1 - t0, again: t2 - t1, later: t4 - t3, digest: dig(L) + dig(L2) + dig(L3), nodes: L.nodes.length };
}
(async () => {
  const which = process.argv[2] || 'chromium', reps = +(process.argv[3] || 5), oldT = fs.readFileSync(process.argv[4] || '/tmp/nl-130.js', 'utf8'), newT = fs.readFileSync(process.argv[5] || '/tmp/nl-131.js', 'utf8');
  const sizes = (process.argv[6] || '300,2000,5000,20000').split(',').map(Number), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const D = await require('./driver.js').open(which, { timeout: 3600000 }), rows = [];
  const view = process.argv[7] || 'flow', kind = process.argv[8] || 'moderate', once = async (lay, n) => { await D.goto('about:blank'); return D.page.evaluate(inPage, { base, lay, n, view, kind }); };
  for (const n of sizes) {
    await once(oldT, n); await once(newT, n);   // warm-up pair (disk cache, JIT of the driver)
    const o = [], w = []; let same = true;
    for (let r = 0; r < reps; r++) { const first = r % 2 === 0 ? [oldT, newT] : [newT, oldT]; const a = await once(first[0], n), b = await once(first[1], n); const ro = r % 2 === 0 ? a : b, rn = r % 2 === 0 ? b : a; o.push(ro); w.push(rn); if (ro.digest !== rn.digest) same = false; }
    const f = (k, arr) => med(arr.map((x) => x[k]));
    rows.push({ n, nodes: w[0].nodes, oldFirst: f('first', o), newFirst: f('first', w), oldAgain: f('again', o), newAgain: f('again', w), oldLater: f('later', o), newLater: f('later', w), same });
  }
  const version = D.version; await D.close();
  console.log('\n' + version + ' (median of ' + reps + ' fresh pages per version, taking turns; milliseconds, lower is better; ratio = old / new, higher is better)\n\n| map size | first layout old → new (ratio) | second layout, same page (ratio) | layout after a moment (ratio) | same layout |\n|---|---|---|---|---|');
  rows.forEach((r) => console.log(`| ${r.nodes} nodes | ${r.oldFirst.toFixed(0)} → ${r.newFirst.toFixed(0)} (${(r.oldFirst / r.newFirst).toFixed(2)}) | ${r.oldAgain.toFixed(0)} → ${r.newAgain.toFixed(0)} (${(r.oldAgain / r.newAgain).toFixed(2)}) | ${r.oldLater.toFixed(0)} → ${r.newLater.toFixed(0)} (${(r.oldLater / r.newLater).toFixed(2)}) | ${r.same ? 'yes' : 'NO'} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'layers-alt-' + kind + '-' + which + '.json'), JSON.stringify({ version, reps, rows }, null, 1));
  process.exit(0);
})();

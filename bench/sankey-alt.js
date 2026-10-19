/* Copyright (c) 2026 LFC Foundry. MIT License. Two versions of the vendored netflow-sankey, built the same way in the app's own engine, in a FRESH page each time with the versions taking turns (old, new, new, old, ...), so a slow stretch of the machine hits both alike.
 *   node bench/sankey-alt.js chromium|firefox|webkit|epiphany [reps] [old.js] [new.js] [sizes, comma separated]
 * "first" is the whole first Sankey of a page: the module's script, any start-up work it does (the WebAssembly compile) and the layout; "again" is a second layout in the same page. Milliseconds, lower is better; ratio = old / new (higher is better, above 1 means the new one is faster). The pictures must match (digest of the layout). */
'use strict';
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const base = { layers: R('vendor/netflow-layers.js'), columns: R('src/columns.js'), engine: R('src/engine.js'), gen: R('bench/gen.js') };
async function inPage(arg) {   // 'first' = layout straight after the script (wasm compiled on the spot); 'later' = layout after the early compile is done (the usual case in the app: the page is open for a moment before Sankey is chosen)
  const { base, sk, n } = arg, g = globalThis, ev = (code) => (0, eval)(code), strip = (t) => t.replace(/if \(typeof module[^\n]*\n?/, '');
  ev(base.layers);
  ev(strip(base.columns) + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  ev(strip(base.gen) + '\n;globalThis.NFMGen = NFMGen;');
  const t0 = performance.now(); ev(sk);
  ev(strip(base.engine).replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  const E = g.NFMEngine, C = g.NFMColumns, GEN = g.NFMGen;
  const mk = () => { const gr = GEN.graph('moderate', n, 11); return C.derive(JSON.parse(JSON.stringify(gr))); };
  const t1 = performance.now(); const L = E.build(mk(), { view: 'sankey' }); const t2 = performance.now();
  const L2 = E.build(mk(), { view: 'sankey' }); const t3 = performance.now();
  if (g.NetflowSankey && g.NetflowSankey.wasmReady) await g.NetflowSankey.wasmReady(); await new Promise((r) => setTimeout(r, 30));
  const t4 = performance.now(); const L3 = E.build(mk(), { view: 'sankey' }); const t5 = performance.now();
  const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
  const dig = (X) => fnv(JSON.stringify(X, (k, v) => (k === 'ms' ? undefined : ArrayBuffer.isView(v) ? Array.from(v) : v)));
  return { first: t2 - t0, again: t3 - t2, later: t5 - t4, digest: dig(L) + dig(L2) + dig(L3), nodes: L.nodes.length, wasm: !!(g.NetflowSankey && g.NetflowSankey.wasmAvailable && g.NetflowSankey.wasmAvailable()) };
}
(async () => {
  const which = process.argv[2] || 'chromium', reps = +(process.argv[3] || 5), oldT = fs.readFileSync(process.argv[4] || '/tmp/nfs-2.2.1.js', 'utf8'), newT = fs.readFileSync(process.argv[5] || '/tmp/nfs-2.3.0.js', 'utf8');
  const sizes = (process.argv[6] || '60,300,1000,3000').split(',').map(Number), med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const D = await require('./driver.js').open(which, { timeout: 3600000 }), rows = [];
  const once = async (sk, n) => { await D.goto('about:blank'); return D.page.evaluate(inPage, { base, sk, n }); };
  for (const n of sizes) {
    await once(oldT, n); await once(newT, n);   // warm-up pair (disk cache, JIT of the driver)
    const o = [], w = []; let same = true;
    for (let r = 0; r < reps; r++) { const first = r % 2 === 0 ? [oldT, newT] : [newT, oldT]; const a = await once(first[0], n), b = await once(first[1], n); const ro = r % 2 === 0 ? a : b, rn = r % 2 === 0 ? b : a; o.push(ro); w.push(rn); if (ro.digest !== rn.digest) same = false; }
    const f = (k, arr) => med(arr.map((x) => x[k]));
    rows.push({ n, nodes: w[0].nodes, oldFirst: f('first', o), newFirst: f('first', w), oldAgain: f('again', o), newAgain: f('again', w), oldLater: f('later', o), newLater: f('later', w), same, wasm: w[0].wasm });
  }
  const version = D.version; await D.close();
  console.log('\n' + version + ' (median of ' + reps + ' fresh pages per version, taking turns; milliseconds, lower is better; ratio = old / new, higher is better)\n\n| story size | first Sankey old → new (ratio) | second Sankey, same page (ratio) | Sankey after the page has been open a moment (ratio) | same picture | WebAssembly used by new |\n|---|---|---|---|---|---|');
  rows.forEach((r) => console.log(`| ${r.nodes} nodes | ${r.oldFirst.toFixed(0)} → ${r.newFirst.toFixed(0)} (${(r.oldFirst / r.newFirst).toFixed(2)}) | ${r.oldAgain.toFixed(0)} → ${r.newAgain.toFixed(0)} (${(r.oldAgain / r.newAgain).toFixed(2)}) | ${r.oldLater.toFixed(0)} → ${r.newLater.toFixed(0)} (${(r.oldLater / r.newLater).toFixed(2)}) | ${r.same ? 'yes' : 'NO'} | ${r.wasm ? 'yes' : 'no'} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'sankey-alt-' + which + '.json'), JSON.stringify({ version, reps, rows }, null, 1));
  process.exit(0);
})();

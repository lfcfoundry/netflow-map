/* Copyright (c) 2026 LFC Foundry. MIT License. Flat Force: the old start (spiral, 120 to 240 rounds) against the new one (Distances picture, 40 gentle rounds) for maps of 5,000 items or more, in one page per browser with the two ALTERNATING (old, new, old, new, ...);
 * one untimed pair first, then `reps` timed pairs. Prints medians (milliseconds, lower is better), the middle ratio old / new (above 1 means the new start is faster) and the hop error of each picture (lower is truer).
 *   node bench/force2d-alt.js chromium|firefox|webkit|epiphany [reps] [sizes] [kinds] */
'use strict';
const fs = require('fs'), path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const texts = { layers: R('vendor/netflow-layers.js'), sankey: R('vendor/netflow-sankey.js'), columns: R('src/columns.js'), engine: R('src/engine.js'), gen: R('bench/gen.js') };
async function inPage(arg) {
  const { texts, reps, sizes, kinds } = arg, g = globalThis, ev = (code) => (0, eval)(code), strip = (t) => t.replace(/if \(typeof module[^\n]*\n?/, '');
  ev(texts.layers); ev(texts.sankey);
  ev(strip(texts.columns) + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  ev(strip(texts.engine).replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  ev(strip(texts.gen) + '\n;globalThis.NFMGen = NFMGen;');
  const E = g.NFMEngine, C = g.NFMColumns, GEN = g.NFMGen, T = E.force2dTuning, rows = [], med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  function sampled(gr, L) {
    const idx = new Map(gr.nodes.map((n, i) => [n.id, i])), adj = gr.nodes.map(() => []), pos = new Map(L.nodes.map((n) => [n.nodeId || n.id, [n.cx, n.cy]]));
    gr.edges.forEach((e) => { const a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { adj[a].push(b); adj[b].push(a); } });
    const k = gr.nodes.length; let num = 0, den = 0; const rr = [];
    for (let s = 0; s < 12; s++) { const src = Math.floor(s * k / 12), d = new Int32Array(k).fill(-1), q = [src]; d[src] = 0; for (let h = 0; h < q.length; h++) for (const w of adj[q[h]]) if (d[w] < 0) { d[w] = d[q[h]] + 1; q.push(w); } for (let x = 0; x < k; x += 3) if (x !== src && d[x] > 0) { const a = pos.get(gr.nodes[src].id), b = pos.get(gr.nodes[x].id); if (a && b) rr.push([d[x], Math.hypot(a[0] - b[0], a[1] - b[1])]); } }
    rr.forEach(([h, e]) => { num += e / h; den += e * e / (h * h); }); const sc = den > 0 ? num / den : 1; let st = 0; rr.forEach(([h, e]) => { const r = (h - sc * e) / h; st += r * r; }); return st / rr.length;
  }
  for (const kind of kinds) for (const n of sizes) {
    const gr = GEN.graph(kind, n, 11), dg = C.derive(JSON.parse(JSON.stringify(gr))), to = [], tn = []; let lo, ln;
    const run = (isNew) => { T.stressMin = isNew ? 5000 : 0; T.stressMax = 1e9; const t0 = performance.now(); const L = E.build(dg, { view: 'network', arrange: 'force', colorBy: 'group' }); return [performance.now() - t0, L]; };
    run(false); run(true);
    for (let r = 0; r < reps; r++) { const first = r % 2 === 0 ? false : true, x = run(first), y = run(!first), o = first ? y : x, nw = first ? x : y; to.push(o[0]); tn.push(nw[0]); lo = o[1]; ln = nw[1]; }
    rows.push({ kind, n, old: Math.round(med(to)), nw: Math.round(med(tn)), ratio: +med(to.map((t, i) => t / tn[i])).toFixed(2), eo: +sampled(gr, lo).toFixed(3), en: +sampled(gr, ln).toFixed(3) });
  }
  return rows;
}
(async () => {
  const which = process.argv[2] || 'chromium', reps = +(process.argv[3] || 3), sizes = (process.argv[4] || '5000,10000,30000').split(',').map(Number), kinds = (process.argv[5] || 'moderate,complex').split(',');
  const D = await require('./driver.js').open(which, { timeout: 3600000 }); await D.goto('about:blank');
  const rows = await D.page.evaluate(inPage, { texts, reps, sizes, kinds }); const version = D.version; await D.close();
  console.log('\n' + version + ' (median of ' + reps + ' alternating pairs after one warm-up pair; milliseconds, lower is better; ratio = old time / new time, above 1 means the new start is faster; hop error, lower is truer)\n\n| map | items | old start ms | new start ms | ratio (higher is better) | old hop error | new hop error |\n|---|---|---|---|---|---|---|');
  rows.forEach((r) => console.log(`| ${r.kind} | ${r.n.toLocaleString('en-US')} | ${r.old} | ${r.nw} | ${r.ratio} | ${r.eo} | ${r.en} |`));
  fs.writeFileSync(path.join(__dirname, 'results', 'force2d-alt-' + which + '.json'), JSON.stringify({ version, reps, rows }, null, 1));
  process.exit(0);
})();

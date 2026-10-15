/* Copyright (c) 2026 JNFoo. MIT License. Node-only tuning tool for the stress layout: time and truth (sampled stress) for settings side by side.
 * node bench/stress-tune.js <kind> <n> '<json settings>' ...   (settings: any key of NFMEngine.stressTuning; "before" runs the engine as committed before the typed-array change) */
'use strict';
const fs = require('fs'), path = require('path');
global.NFMColumns = require('../src/columns.js');
const load = (f, g) => (0, eval)(fs.readFileSync(path.join(__dirname, f), 'utf8') + '\n;' + g);
const E = require('../src/engine.js'), C = require('../src/columns.js'), GEN = load('gen.js', 'NFMGen');
const EB = load('engine-before.js', 'NFMEngineBefore');
const XM = require('../src/examples.js'), makeGraph = (kind, n) => (kind === 'planted' ? XM.bigNetwork(n, Math.max(6, Math.round(Math.sqrt(n) / 4)), 7) : GEN.graph(kind, n, 11));   // same graphs as bench/suites.js
function hop(ids, edges, pos) {
  const idx = new Map(ids.map((id, i) => [id, i])), n = ids.length, adj = ids.map(() => []);
  edges.forEach((e) => { const a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { adj[a].push(b); adj[b].push(a); } });
  const ns = Math.min(60, n), pairs = []; let num = 0, den = 0;
  for (let s = 0; s < ns; s++) {
    const src = Math.floor(s * n / ns), d = new Int32Array(n).fill(-1), q = [src]; d[src] = 0;
    for (let h = 0; h < q.length; h++) { const u = q[h]; for (const w of adj[u]) if (d[w] < 0) { d[w] = d[u] + 1; q.push(w); } }
    for (let t = 0; t < n; t += (n > 3000 ? 7 : 1)) if (t !== src && d[t] > 0) { const p = pos[ids[src]], r = pos[ids[t]]; const e = Math.hypot(p[0] - r[0], p[1] - r[1]); pairs.push([d[t], e]); num += e / d[t]; den += e * e / (d[t] * d[t]); }
  }
  const sc = num / den; let st = 0; pairs.forEach((pr) => { st += Math.pow(pr[0] - sc * pr[1], 2) / (pr[0] * pr[0]); });
  return Math.round(st / pairs.length * 1000) / 1000;
}
const [kind, n, ...settings] = process.argv.slice(2);
const g = makeGraph(kind, +n), ids = g.nodes.map((x) => x.id);
const defaults = Object.assign({}, E.stressTuning);
for (const st of settings) {
  const eng = st === 'before' ? EB : E, tun = st === 'before' ? {} : JSON.parse(st);
  Object.assign(E.stressTuning, defaults, tun);
  const dg = C.derive(JSON.parse(JSON.stringify(g)));
  const ms = [], reps = +n > 3000 ? 1 : 3; let L;
  for (let r = 0; r < reps; r++) { const t = process.hrtime.bigint(); L = eng.build(dg, { view: 'network', arrange: 'stress', colorBy: 'group' }); ms.push(Number(process.hrtime.bigint() - t) / 1e6); }
  const pos = {}; L.nodes.forEach((nd) => { pos[nd.nodeId || nd.id] = [nd.cx, nd.cy]; });
  ms.sort((a, b) => a - b);
  console.log(kind.padEnd(8), String(n).padStart(6), (st === 'before' ? 'before' : st).padEnd(46), 'ms', ms[ms.length >> 1].toFixed(0).padStart(6), 'stress', hop(ids, g.edges, pos));
}

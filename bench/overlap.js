/* Copyright (c) 2026 LFC Foundry. MIT License. Node-only: how many items sit on top of each other in each layout?
 * node bench/overlap.js <kind> <n> ...   Every layout is drawn with the same item sizes (ours). Libraries that place points are first
 * scaled so the median link is as long as ours (130), the kindest fair scale. "zoom" = how much bigger the page would have to be
 * to pull the worst pair apart (1.0 = nothing overlaps). Also reports sampled truth (lower = truer) and time. */
'use strict';
const fs = require('fs'), path = require('path');
global.NFMColumns = require('../src/columns.js');
const load = (f, g) => (0, eval)(fs.readFileSync(path.join(__dirname, f), 'utf8') + '\n;' + g);
const E = require('../src/engine.js'), C = require('../src/columns.js'), GEN = load('gen.js', 'NFMGen');
const d3 = require('./node_modules/d3-force'), Graph = require('./node_modules/graphology'), fa2 = require('./node_modules/graphology-layout-forceatlas2');
const XM = require('../src/examples.js'), makeGraph = (kind, n) => (kind === 'planted' ? XM.bigNetwork(n, Math.max(6, Math.round(Math.sqrt(n) / 4)), 7) : GEN.graph(kind, n, 11));   // same graphs as bench/suites.js
function truth(ids, edges, pos) {
  const idx = new Map(ids.map((id, i) => [id, i])), n = ids.length, adj = ids.map(() => []);
  edges.forEach((e) => { const a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { adj[a].push(b); adj[b].push(a); } });
  const ns = Math.min(60, n), pairs = []; let num = 0, den = 0;
  for (let s = 0; s < ns; s++) {
    const src = Math.floor(s * n / ns), d = new Int32Array(n).fill(-1), q = [src]; d[src] = 0;
    for (let h = 0; h < q.length; h++) { const u = q[h]; for (const w of adj[u]) if (d[w] < 0) { d[w] = d[u] + 1; q.push(w); } }
    for (let t = 0; t < n; t += (n > 3000 ? 7 : 1)) if (t !== src && d[t] > 0) { const p = pos[ids[src]], r = pos[ids[t]]; const e = Math.hypot(p[0] - r[0], p[1] - r[1]); pairs.push([d[t], e]); num += e / d[t]; den += e * e / (d[t] * d[t]); }
  }
  const sc = num / den; let st = 0; pairs.forEach((pr) => { st += Math.pow(pr[0] - sc * pr[1], 2) / (pr[0] * pr[0]); });
  return st / pairs.length;
}
/** Neighborhood preservation (as in tsNET and DRGraph): for each sampled item, the share of its direct neighbors that are among its k nearest on the page, with k = its number of neighbors (Jaccard overlap; 1 = perfect, higher is better). 600 evenly spaced items. */
function np(ids, edges, pos) {
  const n = ids.length, idx = new Map(ids.map((id, i) => [id, i])), adj = ids.map(() => new Set());
  edges.forEach((e) => { const a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { adj[a].add(b); adj[b].add(a); } });
  const xs = new Float64Array(n), ys = new Float64Array(n); ids.forEach((id, i) => { xs[i] = pos[id][0]; ys[i] = pos[id][1]; });
  let sum = 0, cnt = 0; const step = Math.max(1, Math.floor(n / 600)), d = new Float64Array(n), order = new Int32Array(n);
  for (let v = 0; v < n; v += step) {
    const k = adj[v].size; if (!k) continue;
    for (let j = 0; j < n; j++) { d[j] = (xs[j] - xs[v]) ** 2 + (ys[j] - ys[v]) ** 2; order[j] = j; }
    d[v] = Infinity;
    const top = Array.from(order).sort((a, b) => d[a] - d[b]).slice(0, k);   // the k nearest on the page
    let inter = 0; for (const j of top) if (adj[v].has(j)) inter++;
    sum += inter / (2 * k - inter); cnt++;
  }
  return sum / cnt;
}
/** Overlapping pairs of discs (grid of cells as wide as the largest disc); items touched; zoom needed to separate the worst pair. */
function overlaps(ids, pos, rad) {
  const n = ids.length; let rmax = 0; for (const id of ids) rmax = Math.max(rmax, rad[id]);
  const cell = 2 * rmax, grid = new Map(), key = (cx, cy) => cx * 73856093 ^ cy * 19349663;
  ids.forEach((id, i) => { const p = pos[id], k = key(Math.floor(p[0] / cell), Math.floor(p[1] / cell)); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  let pairs = 0, zoom = 1; const hit = new Uint8Array(n);
  ids.forEach((id, i) => {
    const p = pos[id], cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell);
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) { const l = grid.get(key(cx + gx, cy + gy)); if (!l) continue; for (const j of l) { if (j <= i) continue; const q = pos[ids[j]], dd = Math.hypot(p[0] - q[0], p[1] - q[1]), rs = rad[id] + rad[ids[j]]; if (dd < rs) { pairs++; hit[i] = hit[j] = 1; zoom = Math.max(zoom, rs / Math.max(dd, 1e-9)); } } }
  });
  let items = 0; for (let i = 0; i < n; i++) items += hit[i];
  return { pairs, pct: 100 * items / n, zoom: Math.min(zoom, 999) };
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] || 1; };
function rescale(ids, edges, pos, target) {
  const len = edges.filter((e) => e.from !== e.to && pos[e.from] && pos[e.to]).map((e) => Math.hypot(pos[e.from][0] - pos[e.to][0], pos[e.from][1] - pos[e.to][1]));
  const f = target / median(len), out = {}; ids.forEach((id) => { out[id] = [pos[id][0] * f, pos[id][1] * f]; }); return out;
}
if (process.env.TUNE) Object.assign(E.stressTuning, JSON.parse(process.env.TUNE));   // e.g. TUNE='{"sepPasses":60}'
const ONLY = process.env.ONLY, [kind, ...ns] = process.argv.slice(2);
const rows = [];
for (const n of ns.map(Number)) {
  const g = makeGraph(kind, n), ids = g.nodes.map((x) => x.id), dg = C.derive(JSON.parse(JSON.stringify(g)));
  const run = (name, fn) => { const t = process.hrtime.bigint(); const pos = fn(); const ms = Number(process.hrtime.bigint() - t) / 1e6; return [name, pos, ms]; };
  let rad = {};
  const ours = run('ours (' + (process.env.ARR || 'stress') + ')', () => { const L = E.build(dg, { view: 'network', arrange: process.env.ARR || 'stress', colorBy: 'group' }); const pos = {}; L.nodes.forEach((nd) => { const id = nd.nodeId || nd.id; pos[id] = [nd.cx, nd.cy]; rad[id] = nd.w / 2; }); return pos; });
  const res = [ours];
  if (ONLY === 'ours') { for (const [name, pos, ms] of res) { const o = overlaps(ids, pos, rad); rows.push({ kind, items: n, layout: name, ms: Math.round(ms), truth: +truth(ids, g.edges, pos).toFixed(3), np: +np(ids, g.edges, pos).toFixed(3), pairs: o.pairs, pctItems: +o.pct.toFixed(1), zoom: +o.zoom.toFixed(1) }); } continue; }
  res.push(run('d3-force', () => { const nodes = ids.map((id) => ({ id })), links = g.edges.map((e) => ({ source: e.from, target: e.to })); const sim = d3.forceSimulation(nodes).force('link', d3.forceLink(links).id((d) => d.id).distance(30)).force('charge', d3.forceManyBody().strength(-30)).force('center', d3.forceCenter(0, 0)).stop(); const ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())); for (let i = 0; i < ticks; i++) sim.tick(); const pos = {}; nodes.forEach((q) => { pos[q.id] = [q.x, q.y]; }); return rescale(ids, g.edges, pos, 130); }));
  res.push(run('d3-force + forceCollide', () => { const nodes = ids.map((id) => ({ id })), links = g.edges.map((e) => ({ source: e.from, target: e.to })); const sim = d3.forceSimulation(nodes).force('link', d3.forceLink(links).id((d) => d.id).distance(130)).force('charge', d3.forceManyBody().strength(-300)).force('collide', d3.forceCollide((d) => rad[d.id])).force('center', d3.forceCenter(0, 0)).stop(); const ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())); for (let i = 0; i < ticks; i++) sim.tick(); const pos = {}; nodes.forEach((q) => { pos[q.id] = [q.x, q.y]; }); return pos; }));
  if (n <= 20000) res.push(run('ForceAtlas2', () => { const gr = new Graph({ type: 'undirected' }); ids.forEach((id, i) => gr.addNode(id, { x: Math.cos(i) * 10 + Math.random(), y: Math.sin(i) * 10 + Math.random() })); g.edges.forEach((e) => { if (e.from !== e.to && !gr.hasEdge(e.from, e.to)) gr.addEdge(e.from, e.to); }); fa2.assign(gr, { iterations: 300, settings: Object.assign(fa2.inferSettings(gr), { barnesHutOptimize: n > 500 }) }); const pos = {}; gr.forEachNode((id, at) => { pos[id] = [at.x, at.y]; }); return rescale(ids, g.edges, pos, 130); }));
  for (const [name, pos, ms] of res) { const o = overlaps(ids, pos, rad); rows.push({ kind, items: n, layout: name, ms: Math.round(ms), truth: +truth(ids, g.edges, pos).toFixed(3), np: +np(ids, g.edges, pos).toFixed(3), pairs: o.pairs, pctItems: +o.pct.toFixed(1), zoom: +o.zoom.toFixed(1) }); }
}
console.table(rows);

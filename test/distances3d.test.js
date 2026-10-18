/* Copyright (c) 2026 LFC Foundry. MIT License. Distances 3D (arrangement stress3d): the flat Distances method in three dimensions, with a multilevel start. */
'use strict';
global.NFMColumns = require('../src/columns.js');
const E = require('../src/engine.js'); global.NFMEngine = E;
const GEN = require('../bench/gen.js'); let bad = 0;
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
/** Mean of (hops - scale*distance)^2 / hops^2 over 24 breadth-first sources in the largest piece, in 3D (z is 0 for a flat picture); lower is truer. */
function score(g, L) {
  const n = g.nodes.length, idx = new Map(g.nodes.map((nd, i) => [nd.id, i])), adj = Array.from({ length: n }, () => []);
  g.edges.forEach((e) => { const a = idx.get(e.from), b = idx.get(e.to); if (a !== b) { adj[a].push(b); adj[b].push(a); } });
  const comp = new Int32Array(n).fill(-1), q = new Int32Array(n); let best = 0, bestSize = 0, c = 0;
  for (let i = 0; i < n; i++) if (comp[i] < 0) { let h = 0, tl = 1; q[0] = i; comp[i] = c; while (h < tl) { const u = q[h++]; for (const w of adj[u]) if (comp[w] < 0) { comp[w] = c; q[tl++] = w; } } if (tl > bestSize) { bestSize = tl; best = c; } c++; }
  const pos = new Map(L.nodes.map((nd) => [nd.nodeId || nd.id, nd])), P = g.nodes.map((nd) => { const p = pos.get(nd.id); return [p.cx, p.cy, p.z || 0]; }), mem = [];
  for (let i = 0; i < n; i++) if (comp[i] === best) mem.push(i);
  const ns = Math.min(24, mem.length), dist = new Int32Array(n), pairs = []; let num = 0, den = 0;
  for (let s = 0; s < ns; s++) {
    const src = mem[Math.floor(s * mem.length / ns)]; dist.fill(-1); dist[src] = 0; q[0] = src; let h = 0, tl = 1;
    while (h < tl) { const u = q[h++]; for (const w of adj[u]) if (dist[w] < 0) { dist[w] = dist[u] + 1; q[tl++] = w; } }
    for (const v of mem) if (v !== src && dist[v] > 0) { const e = Math.hypot(P[src][0] - P[v][0], P[src][1] - P[v][1], P[src][2] - P[v][2]); pairs.push(dist[v], e); num += e / dist[v]; den += e * e / (dist[v] * dist[v]); }
  }
  const sc = num / den; let st = 0; for (let i = 0; i < pairs.length; i += 2) st += Math.pow(pairs[i] - sc * pairs[i + 1], 2) / (pairs[i] * pairs[i]);
  return st / (pairs.length / 2);
}
const build = (g, arrange) => E.build(JSON.parse(JSON.stringify(NFMColumns.derive(g))), { view: 'network', arrange, colorBy: 'group' });
const fingerprint = (L) => L.nodes.map((n) => [n.cx.toFixed(3), n.cy.toFixed(3), (n.z || 0).toFixed(3)].join(',')).join(';');
const T = E.force3dTuning;

t('Distances 3D is a turnable 3D picture with a name in the arrangement list', () => {
  ok(E.ARRANGE_NAMES.stress3d === 'Distances 3D (stress)', 'name missing');
  const L = build(GEN.graph('moderate', 300, 3), 'stress3d');
  ok(L.is3d === true && L.arrange === 'stress3d', 'not 3D');
  ok(L.nodes.every((n) => isFinite(n.cx) && isFinite(n.cy) && isFinite(n.z)), 'a position is not a number');
  ok(new Set(L.nodes.map((n) => Math.round(n.z))).size > 10, 'every item sits at one depth');
});
t('Distances 3D gives the same picture every run', () => {
  const g = GEN.graph('moderate', 2500, 5);
  ok(fingerprint(build(g, 'stress3d')) === fingerprint(build(g, 'stress3d')), 'two runs differ');
});
[['moderate', 1000, 0.105, 0.95], ['moderate', 3000, 0.125, 0.95], ['complex', 3000, 0.145, 1.03], ['moderate', 10000, 0.13, 0.95]].forEach(([kind, n, lim, vs]) => t('Distances 3D, ' + kind + ' ' + n.toLocaleString() + ' items: hop error under ' + lim + (vs < 1 ? ', and clearly truer than the flat Distances' : ', and no worse than the flat Distances (a dense map gains little from the third axis)'), () => {
  const g = GEN.graph(kind, n, 11), s3 = score(g, build(g, 'stress3d')), s2 = score(g, build(g, 'stress'));
  ok(s3 < lim, 'hop error ' + s3.toFixed(3) + ' (limit ' + lim + ')');
  ok(s3 < s2 * vs, '3D ' + s3.toFixed(3) + ' is not under ' + vs + ' times the flat ' + s2.toFixed(3));
  return 'truth ' + s2.toFixed(3) + ' flat -> ' + s3.toFixed(3) + ' in 3D (lower is truer)';
}));
t('the multilevel start makes a big piece truer and can be switched off; 3D force does not use it', () => {
  const g = GEN.graph('moderate', 6000, 7), keep = T.ml;
  T.ml = 0; const off = score(g, build(g, 'stress3d')), forceOff = fingerprint(build(GEN.graph('moderate', 900, 9), 'force3d'));
  T.ml = 1; const on = score(g, build(g, 'stress3d')), forceOn = fingerprint(build(GEN.graph('moderate', 900, 9), 'force3d')); T.ml = keep;
  ok(on < off * 0.95, 'multilevel truth ' + on.toFixed(3) + ' is not clearly better than ' + off.toFixed(3));
  ok(forceOff === forceOn, '3D force changed with the multilevel switch');
  return 'truth ' + off.toFixed(3) + ' -> ' + on.toFixed(3) + ' (lower is truer)';
});
t('odd inputs: no links, one item, two pieces, a self-link, a repeated link', () => {
  const mk = (ids, ed) => ({ nodes: ids.map((id) => ({ id, label: id })), edges: ed.map(([from, to]) => ({ from, to, weight: 1 })) });
  [mk([], []), mk(['a'], []), mk(['a', 'b', 'c'], []), mk(['a', 'b', 'c', 'd'], [['a', 'b'], ['c', 'd']]), mk(['a', 'b'], [['a', 'a'], ['a', 'b'], ['a', 'b']])].forEach((g) => {
    const L = build(g, 'stress3d'); ok(L.nodes.every((n) => isFinite(n.cx + n.cy + n.z)), 'a position is not a number');
  });
});
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);

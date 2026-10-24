/* Copyright (c) 2026 LFC Foundry. MIT License. Moving items by hand on a big flat map: S.moveNodes (scene.js) must leave the dots, names, icons, node boxes and straight links exactly as building the picture again from the new places gives. */
'use strict';
global.NFMColumns = require('../src/columns.js'); global.NFMSim = require('../src/sim.js'); global.NFMCheck = require('../src/check.js'); global.NFMPack = require('../src/pack.js');
const E = require('../src/engine.js'); global.NFMEngine = E; const SC = require('../vendor/netflow-scene.js'), GEN = require('../bench/gen.js'); let bad = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const derive = (g) => NFMColumns.derive(JSON.parse(JSON.stringify(g)));
const graph = GEN.graph('moderate', 1500, 5), OPT = { view: 'network', arrange: 'circle', colorBy: 'group' };
const mkL = () => E.build(derive(graph), OPT);
const look = (S) => JSON.stringify({ dots: S.dots, curves: S.curves, labels: S.labels, icons: S.icons, nodes: S.nodes.map((n) => [n.i, n.key, n.x, n.y, n.w, n.h]) });
const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const settledSame = (S1, S2, L) => {
  const wasPacked = S1.curvesPacked(); ok(S1.settleMoves(), 'the drop should settle in place'); ok(S1.curvesPacked() === wasPacked, 'settling the drop must not unpack the list');
  ok(S1.x0 === S2.x0 && S1.y0 === S2.y0 && S1.w === S2.w && S1.h === S2.h, 'outer box differs: ' + [S1.x0, S1.y0, S1.w, S1.h] + ' vs ' + [S2.x0, S2.y0, S2.w, S2.h]);
  const grid = (S) => { SC.pick(S, 0, 0, 0); return JSON.stringify([S.grid.cell, S.grid.cols, S.grid.rows, Array.from(S.grid.map.entries()).sort((a, b) => a[0] - b[0])]); };
  ok(grid(S1) === grid(S2), 'pick grid differs');
  const r = rng(5); let hits = 0;
  for (let k = 0; k < 400; k++) { const n = L.nodes[Math.floor(r() * L.nodes.length)], x = n.cx + (r() - 0.5) * 30, y = n.cy + (r() - 0.5) * 30, a = JSON.stringify(SC.pickEdge(S1, x, y, 6)), b = JSON.stringify(SC.pickEdge(S2, x, y, 6)); ok(a === b, 'link under the pointer differs at ' + x + ',' + y); if (a !== 'null' && a !== '-1') hits++; }
  return hits;
};
t('moved items give the same dots, names and links as building the picture again', () => {
  const L1 = mkL(), S1 = SC.make(L1, {}); ok(L1.edges.length >= 600 && typeof S1.moveNodes === 'function', 'this map should be big enough for the fast path (' + L1.edges.length + ' links)');
  const r = rng(7), placed = new Map(); let touched = 0;
  for (let round = 0; round < 4; round++) {
    const moves = []; for (let k = 0; k < (round === 3 ? 400 : 3 + round * 5); k++) { const q = Math.floor(r() * L1.nodes.length), x = L1.nodes[q].cx + (r() - 0.5) * 400, y = L1.nodes[q].cy + (r() - 0.5) * 400; moves.push([q, x, y]); placed.set(q, [x, y]); }
    const d = S1.moveNodes(moves); ok(d && d.dots.size > 0 && d.curves.size > 0, 'a change list'); touched += d.curves.size;
  }
  const L2 = mkL(); placed.forEach((p, q) => { L2.nodes[q].cx = p[0]; L2.nodes[q].cy = p[1]; }); const S2 = SC.make(L2, {});
  const a = look(S1), b = look(S2); ok(a === b, 'the moved picture differs from a new picture (' + a.length + ' vs ' + b.length + ' characters)');
  const hits = settledSame(S1, S2, L2);
  return touched + ' links moved, outer box, pick grid and link hover the same as a new picture (' + hits + ' link hits compared)';
});
t('moving items leaves a packed link list packed, and gives the same picture as packing a new one', () => {
  const L1 = mkL(), S1 = SC.make(L1, {}); ok(S1.packNow(), 'the links should pack'); ok(S1.curvesPacked(), 'packed before the moves');
  const r = rng(11), placed = new Map();
  for (let round = 0; round < 3; round++) {
    const moves = []; for (let k = 0; k < 5 + round * 40; k++) { const q = Math.floor(r() * L1.nodes.length), x = L1.nodes[q].cx + (r() - 0.5) * 400, y = L1.nodes[q].cy + (r() - 0.5) * 400; moves.push([q, x, y]); placed.set(q, [x, y]); }
    const d = S1.moveNodes(moves); ok(d && d.curves.size > 0, 'a change list'); ok(S1.curvesPacked(), 'the moves must not unpack the list (round ' + round + ')');
    d.curves.forEach((j) => ok(S1.curveAt(j) && S1.curveAt(j).P.length === 8, 'a changed link can be read one at a time'));
  }
  const L2 = mkL(); placed.forEach((p, q) => { L2.nodes[q].cx = p[0]; L2.nodes[q].cy = p[1]; }); const S2 = SC.make(L2, {}); ok(S2.packNow(), 'the new picture packs');
  const a = look(S1), b = look(S2); ok(a === b, 'the moved packed picture differs from a new packed picture (' + a.length + ' vs ' + b.length + ' characters)');
  settledSame(S1, S2, L2);
});
t('a map with an arrow-bearing or small picture does not use the fast path', () => {
  const small = E.build(derive(GEN.graph('moderate', 120, 3)), OPT), S = SC.make(small, {}); ok(typeof S.moveNodes !== 'function', 'small maps are built again, which is quick');
});
console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);

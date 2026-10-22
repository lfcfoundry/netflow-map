/* Copyright (c) 2026 LFC Foundry. MIT License. Moving items by hand on a big flat map: S.moveNodes (scene.js) must leave the dots, names, icons, node boxes and straight links exactly as building the picture again from the new places gives. */
'use strict';
global.NFMColumns = require('../src/columns.js'); global.NFMSim = require('../src/sim.js'); global.NFMCheck = require('../src/check.js'); global.NFMPack = require('../src/pack.js');
const E = require('../src/engine.js'); global.NFMEngine = E; const SC = require('../src/scene.js'), GEN = require('../bench/gen.js'); let bad = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const derive = (g) => NFMColumns.derive(JSON.parse(JSON.stringify(g)));
const graph = GEN.graph('moderate', 1500, 5), OPT = { view: 'network', arrange: 'circle', colorBy: 'group' };
const mkL = () => E.build(derive(graph), OPT);
const look = (S) => JSON.stringify({ dots: S.dots, curves: S.curves, labels: S.labels, icons: S.icons, nodes: S.nodes.map((n) => [n.i, n.key, n.x, n.y, n.w, n.h]) });
const rng = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
t('moved items give the same dots, names and links as building the picture again', () => {
  const L1 = mkL(), S1 = SC.make(L1, {}); ok(L1.edges.length >= 600 && typeof S1.moveNodes === 'function', 'this map should be big enough for the fast path (' + L1.edges.length + ' links)');
  const r = rng(7), placed = new Map(); let touched = 0;
  for (let round = 0; round < 4; round++) {
    const moves = []; for (let k = 0; k < (round === 3 ? 400 : 3 + round * 5); k++) { const q = Math.floor(r() * L1.nodes.length), x = L1.nodes[q].cx + (r() - 0.5) * 400, y = L1.nodes[q].cy + (r() - 0.5) * 400; moves.push([q, x, y]); placed.set(q, [x, y]); }
    const d = S1.moveNodes(moves); ok(d && d.dots.size > 0 && d.curves.size > 0, 'a change list'); touched += d.curves.size;
  }
  const L2 = mkL(); placed.forEach((p, q) => { L2.nodes[q].cx = p[0]; L2.nodes[q].cy = p[1]; }); const S2 = SC.make(L2, {});
  const a = look(S1), b = look(S2); ok(a === b, 'the moved picture differs from a new picture (' + a.length + ' vs ' + b.length + ' characters)');
  return touched + ' links moved';
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
});
t('a map with an arrow-bearing or small picture does not use the fast path', () => {
  const small = E.build(derive(GEN.graph('moderate', 120, 3)), OPT), S = SC.make(small, {}); ok(typeof S.moveNodes !== 'function', 'small maps are built again, which is quick');
});
console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);

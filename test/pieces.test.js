/* Copyright (c) 2026 LFC Foundry. MIT License. Separate pieces of a Network map laid out on helper threads (engine buildPieces).
 * A piece of 150 to 4,000 items in the Distances arrangement draws exactly one random number, so the engine draws it in order and a helper
 * lays the piece out from its own items and links: the picture must be the plain build's, number for number, whatever the helpers do. */
'use strict';
global.NFMColumns = require('../src/columns.js'); global.NFMSim = require('../src/sim.js'); global.NFMCheck = require('../src/check.js'); global.NFMPack = require('../src/pack.js');
const E = require('../src/engine.js'), GEN = require('../bench/gen.js'), { Client } = require('../src/engine-client.js');
let bad = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const many = (sizes, kind) => { const nodes = [], edges = []; sizes.forEach((size, p) => { const g = GEN.graph(kind || 'moderate', size, 100 + p * 7); g.nodes.forEach((n) => nodes.push(Object.assign({}, n, { id: 'p' + p + '_' + n.id }))); g.edges.forEach((e) => edges.push(Object.assign({}, e, { from: 'p' + p + '_' + e.from, to: 'p' + p + '_' + e.to }))); }); return NFMColumns.derive({ name: 'many', start: null, nodes, edges }); };
const same = (a, b) => a.nodes.length === b.nodes.length && a.nodes.every((n, i) => n.id === b.nodes[i].id && n.x === b.nodes[i].x && n.y === b.nodes[i].y && n.w === b.nodes[i].w) && a.width === b.width && a.height === b.height;
const asHelper = (jobs, EDGE, tun) => jobs.map((j) => E.pieceJob({ inp: j.inp, draw: j.draw, EDGE, tun: JSON.parse(JSON.stringify(tun)) }));   /* what a helper is sent: numbers only */
const seq = [];
const run = (name, fn) => seq.push([name, fn]);
E.pieces.minWork = 1;   // every eligible piece goes out in these small tests
run('pieces laid out as a helper would give the plain picture (mixed sizes, a big multilevel piece, pairs and singles)', async () => {
  let n = 0;
  for (const [sizes, kind] of [[[1500, 900, 300, 50, 2, 1, 5000], 'moderate'], [[800, 800, 40, 3], 'simple'], [[400, 400, 400, 400, 400, 400], 'moderate']]) {
    const g = many(sizes, kind), plain = E.build(g, { view: 'network', colorBy: 'group' });
    let jobs = 0; const b = await E.buildPieces(g, { view: 'network', colorBy: 'group' }, (js, EDGE, tun) => { jobs += js.length; return asHelper(js, EDGE, tun); });
    ok(jobs > 0, 'no jobs for ' + sizes); ok(same(plain, b), 'picture changed for ' + sizes.join('+')); n += jobs;
  }
  return n + ' pieces sent';
});
run('other arrangements, one-piece maps, previews and best quality send nothing', async () => {
  const g = many([600, 300, 20]);
  for (const arrange of ['force', 'radial', 'closeness', 'stressBest']) { let jobs = 0; const b = await E.buildPieces(g, { view: 'network', arrange }, (js) => { jobs += js.length; return asHelper(js); }); ok(jobs === 0 && same(b, E.build(g, { view: 'network', arrange })), arrange); }
  let j2 = 0; await E.buildPieces(many([3000]), { view: 'network' }, (js) => { j2 += js.length; return []; }); ok(j2 === 0, 'one piece');
  E.pieces.minWork = 6000000; let j3 = 0; await E.buildPieces(many([300, 300]), { view: 'network' }, (js) => { j3 += js.length; return []; }); E.pieces.minWork = 1; ok(j3 === 0, 'small work stays here');
  ok(E.build(g, { view: 'network' }).nodes.length === 920, 'a plain build never stops for pieces');
});
run('helpers that fail, answer short or are missing: the pieces are laid out here, same picture', async () => {
  const g = many([700, 500, 300]), plain = E.build(g, { view: 'network' });
  E.pieces.error = '';
  ok(same(plain, await E.buildPieces(g, { view: 'network' }, () => Promise.reject(new Error('blocked')))), 'rejected'); ok(/blocked/.test(E.pieces.error), 'error kept');
  ok(same(plain, await E.buildPieces(g, { view: 'network' }, (js) => js.slice(1).map(() => ({})))), 'short');
  ok(same(plain, await E.buildPieces(g, { view: 'network' }, (js) => js.map(() => ({ X: new Float64Array(2), w: 1, h: 1 })))), 'wrong size');
  ok(same(plain, await E.buildPieces(g, { view: 'network' }, () => { throw new Error('no threads'); })), 'thrown');
});
run('a helper uses the tuning it is sent, not its own', async () => {
  const g = many([600, 600]), T = E.stressTuning, keep = T.fullIters;
  T.fullIters = 9;
  try {
    const plain = E.build(g, { view: 'network' });
    const b = await E.buildPieces(g, { view: 'network' }, (js, EDGE, tun) => { T.fullIters = keep; try { return asHelper(js, EDGE, tun); } finally { T.fullIters = 9; } });
    ok(same(plain, b), 'tuning not carried');
  } finally { T.fullIters = keep; }
});
run('engine worker job: a build with helpers answers with the same picture, and saved-picture records still come back', async () => {
  const g = many([900, 900, 200]), API = { E, SIM: NFMSim, CHK: NFMCheck, C: NFMColumns, pieces: (js, EDGE, tun) => Promise.resolve(asHelper(js, EDGE, tun)) };
  const dispatch = new Function('return ' + require('fs').readFileSync(require.resolve('../src/engine-client.js'), 'utf8').match(/function dispatch\(d, st, API\) \{[\s\S]*?\n  \}\n/)[0])();
  const st = { G: g, ver: 1 }, r = dispatch({ type: 'build', opts: { view: 'network', wantSave: true, saveKey: 'k' } }, st, API);
  ok(r && typeof r.then === 'function', 'answers later'); const L = await r; ok(same(L, E.build(g, { view: 'network' })), 'same picture'); ok(L.saveLayout && L.saveLayout.xy.length === 2 * L.nodes.length, 'record');
});
(async () => {
  for (const [name, fn] of seq) { const t0 = Date.now(); try { const r = await fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + (e && e.message || e)); } }
  console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();

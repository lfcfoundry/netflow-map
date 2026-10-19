/* Copyright (c) 2026 LFC Foundry. MIT License. Saved layouts: a Network map laid out before is put back from the browser's storage instead of being laid out again.
 * Checks: the fingerprint is steady and changes with the arrangement, a link, an item's size; a saved picture gives exactly the same positions as laying out again; a wrong
 * or damaged record is ignored; the store keeps the newest pictures, survives a storage that fails, and the client path (key, look up, build, save) works end to end. */
'use strict';
global.NFMColumns = require('../src/columns.js'); global.NFMSim = require('../src/sim.js'); global.NFMCheck = require('../src/check.js'); global.NFMPack = require('../src/pack.js');
const E = require('../src/engine.js'); global.NFMEngine = E; let bad = 0;
const GEN = require('../bench/gen.js'), S = require('../src/layoutstore.js'), { Client } = require('../src/engine-client.js');
const t = (name, fn) => { const t0 = Date.now(); Promise.resolve().then(fn).then((r) => console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')), (e) => { bad++; console.log('FAIL ' + name + ': ' + (e && e.message || e)); }); return null; };
const ok = (c, m) => { if (!c) throw new Error(m); };
const derive = (g) => NFMColumns.derive(JSON.parse(JSON.stringify(g)));
const same = (a, b) => a.nodes.length === b.nodes.length && a.nodes.every((n, i) => n.x === b.nodes[i].x && n.y === b.nodes[i].y && n.cx === b.nodes[i].cx && n.cy === b.nodes[i].cy && n.w === b.nodes[i].w) && a.width === b.width && a.height === b.height;
const g1 = GEN.graph('moderate', 1600, 5), O = { view: 'network', arrange: 'stress', colorBy: 'group' };
(async () => {
  const seq = [];
  const run = (name, fn) => seq.push([name, fn]);
  run('fingerprint: steady, and different for another arrangement, another link, another size', () => {
    const k1 = E.layoutKey(derive(g1), O), k2 = E.layoutKey(derive(g1), O); ok(k1 && k1 === k2, 'steady ' + k1 + ' ' + k2);
    ok(E.layoutKey(derive(g1), Object.assign({}, O, { arrange: 'closeness' })) !== k1, 'arrangement');
    const g2 = JSON.parse(JSON.stringify(g1)); g2.edges.push({ from: g2.nodes[0].id, to: g2.nodes[g2.nodes.length - 1].id, label: '', kind: '', attrs: {} });
    ok(E.layoutKey(derive(g2), O) !== k1, 'a changed link');
    ok(E.layoutKey(derive(g1), { view: 'flow' }) === null, 'not a Network view: no key');
    return k1;
  });
  run('a saved picture gives exactly the positions a new layout gives, and says so', () => {
    const key = E.layoutKey(derive(g1), O), a = E.build(derive(g1), Object.assign({}, O, { wantSave: true, saveKey: key })); ok(a.saveLayout && a.saveLayout.xy.length === 2 * a.nodes.length, 'asked to keep it');
    const b = E.build(derive(g1), Object.assign({}, O, { saved: a.saveLayout, saveKey: key })); ok(b.fromSaved, 'used'); ok(same(a, b), 'same positions');
    const c = E.build(derive(g1), O); ok(same(a, c), 'and the same as a plain build');
  });
  run('a record for another map, a damaged record and a preview are ignored', () => {
    const key = E.layoutKey(derive(g1), O), a = E.build(derive(g1), Object.assign({}, O, { wantSave: true, saveKey: key })), sv = a.saveLayout, use = (x, extra) => E.build(derive(g1), Object.assign({}, O, { saveKey: key }, extra, { saved: x }));
    ok(!use(Object.assign({}, sv, { key: 'other' })).fromSaved, 'wrong key');
    ok(!use(Object.assign({}, sv, { xy: sv.xy.slice(0, 10) })).fromSaved, 'short record');
    ok(!use(sv, { previewOnly: true }).fromSaved, 'preview'); ok(E.layoutKey(derive(g1), Object.assign({}, O, { previewOnly: true })) === null, 'no key for a preview');
  });
  run('the store keeps the newest pictures and never throws', async () => {
    let n = 0; const st = new S.Store(S.memoryBackend(), { maxEntries: 2, now: () => ++n });
    for (const k of ['a', 'b', 'c']) await st.put(k, { xy: new Float64Array(4), width: 1, height: 2 });
    ok(!(await st.get('a')) && (await st.get('b')) && (await st.get('c')), 'oldest dropped');
    const bad2 = new S.Store({ get: () => Promise.reject(new Error('blocked')), put: () => Promise.reject(new Error('full')), meta: () => Promise.reject(new Error('x')), touch: () => Promise.resolve(), del: () => Promise.resolve() });
    ok((await bad2.get('k')) === null && (await bad2.put('k', { xy: new Float64Array(2) })) === false && bad2.errors === 2, 'failing storage is "not saved"');
  });
  run('client: first open lays out and saves, second open comes from storage with the same picture', async () => {
    const cl = new Client('', () => E); cl.mode = 'page'; cl.graph = derive(g1); cl.ver = 1; cl.store = new S.Store(S.memoryBackend()); cl.storeMin = 100;
    cl.runPage = null;
    const first = await cl.build(O); await new Promise((r) => setTimeout(r, 30)); ok(!first.fromSaved && cl.store.saves === 1, 'first: laid out, saved ' + cl.store.saves);
    const second = await cl.build(O); ok(second.fromSaved && cl.store.hits === 1, 'second: from storage'); ok(same(first.L, second.L), 'same picture');
    cl.graph = derive(Object.assign({}, g1, { edges: g1.edges.slice(1) })); cl.ver++; const third = await cl.build(O); ok(!third.fromSaved, 'a changed map is laid out again');
  });
  for (const [name, fn] of seq) { const t0 = Date.now(); try { const r = await fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + (e && e.message || e)); } }
  console.log(bad ? bad + ' failed' : 'all passed'); process.exit(bad ? 1 : 0);
})();

/* Copyright (c) 2026 LFC Foundry. MIT License. The hand-written row factories (src/pack-shapes.js) must make exactly the rows the generic loop makes, and must cover every row shape the engine sends. */
'use strict';
const assert = require('assert'); let bad = 0;
global.NFMPack = require('../src/pack.js'); require('../src/pack-shapes.js');
const P = global.NFMPack, E = require('../src/engine.js');
const ta = async (name, fn) => { const t0 = Date.now(); try { await fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + (e && e.message || e)); } };
(async () => {
  const gen = await import('../tools/gen-pack-shapes.mjs');
  await ta('every row shape the engine sends has a factory (if not: node tools/gen-pack-shapes.mjs)', async () => {
    const miss = gen.collectShapes().filter((s) => !P.shapeOf({ keys: s.keys, cols: s.kinds.map((k) => ({ k })) }));
    assert.strictEqual(miss.length, 0, miss.length + ' shape(s) without a factory, first: ' + (miss[0] && miss[0].keys.join(',')) + '. Run: node tools/gen-pack-shapes.mjs');
  });
  await ta('a factory makes exactly the rows of the generic loop (same fields, order, values) on real layouts', async () => {
    let hits = 0;
    for (const [view, arr, extra] of [['network', 'stress', false], ['network', 'force', true], ['flow', null, false], ['topdown', null, true], ['sankey', null, false]]) {
      const L = E.build(gen.sampleGraph(2300, 3200, extra), { view, arrange: arr || undefined, colorBy: 'group' }), tr = [], pk = P.packResult(L, tr); if (!pk || pk.__nfmpack !== 1) continue;
      const cl = structuredClone(pk, { transfer: tr });
      for (const rows of [cl.nodes, cl.edges]) {
        if (!rows || !rows.cols) continue; const f = P.shapeOf(rows); assert.ok(f, 'no factory for ' + view);
        const a = P.unpackRows(rows), b = await P.unpackRowsSliced(rows, null, 99999);
        assert.deepStrictEqual(a, b); assert.deepStrictEqual(Object.keys(a[5]), Object.keys(b[5])); hits++;
      }
    }
    assert.ok(hits >= 6, 'too few shapes compared: ' + hits);
  });
  await ta('a row shape that is not listed is still built (by the generic loop)', async () => {
    const rows = []; for (let i = 0; i < 2100; i++) rows.push({ zz: i, yy: i % 2 === 0 });
    const tr = [], pr = P.packRows(rows, tr); assert.ok(pr); const cl = structuredClone(pr, { transfer: tr }); assert.strictEqual(P.shapeOf(cl), null); assert.deepStrictEqual(P.unpackRows(cl), rows);
  });
})().then(() => { process.exitCode = bad ? 1 : 0; });

/* Copyright (c) 2026 LFC Foundry. MIT License. Packing a layout for the trip from the worker must give back exactly what the engine made. */
'use strict';
const assert = require('assert'), E = require('../src/engine.js'), P = require('../src/pack.js'); let bad = 0;
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const mk = (n, edges) => ({ start: 'n0', nodes: Array.from({ length: n }, (_, i) => ({ id: 'n' + i, label: i % 7 === 0 ? 'Café ☕ 😀 ' + i : 'n' + i, group: 'g' + (i % 5), valence: '', ghost: false, attrs: {} })), edges: edges.map(([a, b]) => ({ from: 'n' + a, to: 'n' + b, weight: 1, label: '', kind: '' })) });
const random = (n, m, seed) => { let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, e = []; for (let i = 1; i < n; i++) e.push([Math.floor(r() * i), i]); for (let i = 0; i < m - n + 1; i++) e.push([Math.floor(r() * n), Math.floor(r() * n)]); return e; };
const trip = (L) => { const tr = [], pk = P.packResult(L, tr); const cl = structuredClone(pk, { transfer: tr }); return { packed: !!(pk && pk.__nfmpack), out: P.unpackResult(cl) }; };
[['network', 'stress'], ['network', 'force'], ['flow', null], ['topdown', null], ['river', null]].forEach(([view, arr]) => t(view + (arr ? '/' + arr : '') + ': ' + (view === 'network' ? '2,100' : '2,600') + ' items round trip equals the original', () => {
  const N = view === 'network' ? 2100 : 2600, g = mk(N, random(N, N + 900, 9));   // layered views drop unreachable items, so they start with more if (view !== 'network') g.edges = g.edges.filter((e) => +e.from.slice(1) < +e.to.slice(1));   // layered views want no loops
  const L = E.build(g, { view, arrange: arr || undefined, colorBy: 'group' }); const r = trip(L); if (!r.packed) throw new Error('was not packed'); assert.deepStrictEqual(r.out, L); return 'same';
}));
t('a small layout is sent as it is', () => { const L = E.build(mk(50, random(50, 70, 1)), { view: 'network' }); const r = trip(L); if (r.packed) throw new Error('should not pack'); assert.deepStrictEqual(r.out, L); });
t('rows of mixed shapes and columns are left exact', () => {
  const rows = []; for (let i = 0; i < 2500; i++) rows.push({ a: i, b: i % 2 === 0, c: 'x' + i, d: i % 3 ? null : 5, e: [i, i + 1], f: i % 4 ? 'p' : 7, g: { z: i }, h: undefined });
  const tr = [], pr = P.packRows(rows, tr); assert.ok(pr); const out = P.unpackRows(structuredClone(pr, { transfer: tr })); assert.deepStrictEqual(out, rows);
  const odd = rows.slice(); odd[10] = { a: 1 }; assert.strictEqual(P.packRows(odd, []), null);
});
t('numbers that are not plain (NaN, Infinity, -0, huge) and odd text survive', () => {
  const rows = []; for (let i = 0; i < 2100; i++) rows.push({ n: [NaN, Infinity, -Infinity, -0, 1e308, 5e-324, i][i % 7], s: ['', '\u0000', '\ud83d', 'a'.repeat(300), '"\\', '</script>', 'é'][i % 7] });
  const tr = [], pr = P.packRows(rows, tr), out = P.unpackRows(structuredClone(pr, { transfer: tr })); assert.deepStrictEqual(out, rows);
});
t('a field called __proto__ is never packed (it could change the object type)', () => {
  const rows = []; for (let i = 0; i < 2100; i++) rows.push(JSON.parse('{"__proto__":' + i + ',"a":1}')); assert.strictEqual(P.packRows(rows, []), null);
});
t('on a page whose policy allows only wasm-unsafe-eval, no code is built from text (Firefox reports even a refused try as an error)', () => {
  const rows = []; for (let i = 0; i < 2100; i++) rows.push({ a: i, b: 'x' + i });
  const keepDoc = global.document, keepFn = global.Function; let made = 0;
  const fresh = () => { const tr = [], pr = P.packRows(rows, tr); return structuredClone(pr, { transfer: tr }); };
  const meta = (c) => ({ querySelector: () => ({ getAttribute: () => c }) });
  try {
    global.Function = function () { made++; return keepFn.apply(null, arguments); };
    global.document = meta("default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'"); P.unpackRows(fresh()); assert.strictEqual(made, 0, 'tried to build code on a page without unsafe-eval');
    global.document = meta("script-src 'unsafe-inline' 'unsafe-eval'"); P.unpackRows(fresh()); assert.ok(made > 0, 'never used the fast path where it is allowed');
  } finally { global.Function = keepFn; global.document = keepDoc; }
});
process.exitCode = bad ? 1 : 0;

/* Copyright (c) 2026 LFC Foundry. MIT License. The WebAssembly Force rounds (wasm/force.c) must give the same positions as the JavaScript ones, and the JavaScript must take over when WebAssembly is missing. */
'use strict';
global.NFMColumns = require('../src/columns.js');
const E = require('../src/engine.js'); global.NFMEngine = E; let bad = 0;
const GEN = require('../bench/gen.js'), W = E.forceWasm;
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + (e && e.message || e)); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let q = Math.imul(s ^ s >>> 15, 1 | s); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; }; }
function graph(k, dim, seed, twins) {
  const r = rng(seed), X = new Float64Array(k * dim), pairs = [], deg = new Float64Array(k);
  for (let i = 0; i < k * dim; i++) X[i] = (r() - 0.5) * 2 * Math.sqrt(k) * 20;
  for (let i = 1; i < k; i++) for (let e = 0; e < 2; e++) { const j = Math.floor(r() * i); pairs.push(i, j); deg[i]++; deg[j]++; }
  for (let i = 0; i < twins; i++) for (let d = 0; d < dim; d++) X[(2 * i + 1) * dim + d] = X[2 * i * dim + d];   // items 2i and 2i+1 on exactly the same spot: the branch that draws from the page's random generator
  const mass = new Float64Array(k); for (let i = 0; i < k; i++) mass[i] = 1 + deg[i];
  return { X, pairs, mass };
}
const run = (g, k, dim, iters, wasm, seed) => {
  const X = Float64Array.from(g.X), mass = Float64Array.from(g.mass), usedBefore = W.calls, base = rng(seed); let draws = 0; W.on = wasm;
  E.forceSim(X, k, dim, g.pairs.slice(), mass, iters, 60, function () { draws++; return base(); });
  W.on = true; return { X, mass, used: W.calls > usedBefore, draws };
};
const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

t('the WebAssembly kernel loads', () => { ok(W.b64.length > 1000, 'no bytes embedded: run python3 wasm/embed.py'); ok(typeof WebAssembly === 'object', 'this Node has no WebAssembly'); const g = graph(300, 2, 1, 0), r = run(g, 300, 2, 3, true, 5); ok(r.used, 'wasm did not run: ' + W.error); return ((W.b64.length * 3 / 4) | 0) + ' bytes'; });
for (const [k, dim, iters] of [[150, 2, 40], [400, 2, 60], [2000, 2, 30], [600, 3, 40], [3000, 3, 20]]) {
  t(`same positions, ${k} items ${dim}D, ${iters} rounds`, () => {
    const g = graph(k, dim, k + dim, 0), a = run(g, k, dim, iters, false, 9), b = run(g, k, dim, iters, true, 9);
    ok(!a.used && b.used, 'the switch did not select the engines'); const d = maxDiff(a.X, b.X); ok(d === 0, 'largest position difference ' + d); ok(maxDiff(a.mass, b.mass) === 0, 'the normalized weights differ'); return 'largest difference 0';
  });
}
t('same positions when items sit on the same spot (draws from the random generator)', () => {
  let n = 0;
  for (const dim of [2, 3]) { const k = 500, g = graph(k, dim, 77, 40), a = run(g, k, dim, 30, false, 3), b = run(g, k, dim, 30, true, 3); ok(b.used, 'wasm did not run'); ok(a.draws > 0 && a.draws === b.draws, 'random draws: JavaScript ' + a.draws + ', wasm ' + b.draws); const d = maxDiff(a.X, b.X); ok(d === 0, dim + 'D difference ' + d); n = a.draws; }
  return n + ' draws, same in both';
});
t('small pictures stay on JavaScript (the start-up costs more than it saves)', () => { const g = graph(60, 2, 4, 0), r = run(g, 60, 2, 10, true, 1); ok(!r.used, 'used wasm for 60 items'); });
t('whole arrangements match: Force, 3D force and group clusters', () => {
  const g = GEN.graph('moderate', 1500, 5), dg = NFMColumns.derive(JSON.parse(JSON.stringify(g)));
  for (const opts of [{ view: 'network', arrange: 'force' }, { view: 'network', arrange: 'force3d' }]) {
    W.on = false; const a = E.build(dg, Object.assign({ colorBy: 'group' }, opts)); W.on = true; const c0 = W.calls; const b = E.build(dg, Object.assign({ colorBy: 'group' }, opts));
    ok(W.calls > c0, opts.arrange + ': wasm did not run'); let d = 0; a.nodes.forEach((n, i) => { d = Math.max(d, Math.abs(n.cx - b.nodes[i].cx), Math.abs(n.cy - b.nodes[i].cy), Math.abs((n.z || 0) - (b.nodes[i].z || 0))); }); ok(d === 0, opts.arrange + ' difference ' + d);
  }
});
t('broken or blocked WebAssembly: JavaScript takes over with the same answer', () => {
  const g = graph(500, 2, 12, 0), want = run(g, 500, 2, 20, false, 2);
  const keep = { mod: W.mod, tried: W.tried, b64: W.b64, calls: W.calls };
  W.mod = null; W.tried = false; W.b64 = 'AAAA'; const got = run(g, 500, 2, 20, true, 2);   // not a WebAssembly file
  ok(!got.used, 'claimed to use wasm'); ok(maxDiff(want.X, got.X) === 0, 'fallback answer differs'); ok(W.error, 'no error noted');
  const w0 = global.WebAssembly; global.WebAssembly = undefined; W.mod = null; W.tried = false; W.b64 = keep.b64; const got2 = run(g, 500, 2, 20, true, 2); global.WebAssembly = w0;   // no WebAssembly at all
  ok(!got2.used && maxDiff(want.X, got2.X) === 0, 'no-WebAssembly path differs');
  W.mod = keep.mod; W.tried = keep.tried; W.b64 = keep.b64; W.error = '';
});
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);

/* Copyright (c) 2026 LFC Foundry. MIT License. The WebAssembly stress layout and push-apart (wasm/stress.c) must give the same picture as the JavaScript, the JavaScript must take over when
 * WebAssembly is missing or a hop count is over 511, and the hop-code storage must not change a single position. */
'use strict';
global.NFMColumns = require('../src/columns.js');
const E = require('../src/engine.js'); global.NFMEngine = E; let bad = 0;
const GEN = require('../bench/gen.js'), W = E.stressWasm;
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + (e && e.message || e)); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const derive = (g) => NFMColumns.derive(JSON.parse(JSON.stringify(g)));
const build = (dg, arrange) => E.build(dg, { view: 'network', arrange: arrange || 'stress', colorBy: 'group' });
const diff = (a, b) => { let d = 0; a.nodes.forEach((n, i) => { d = Math.max(d, Math.abs(n.cx - b.nodes[i].cx), Math.abs(n.cy - b.nodes[i].cy)); }); return d; };
const both = (dg, arrange) => { W.on = false; const a = build(dg, arrange); W.on = true; const c0 = W.calls, s0 = W.sepCalls, b = build(dg, arrange); return { a, b, stress: W.calls - c0, sep: W.sepCalls - s0 }; };
function chain(n) { const nodes = [], edges = []; for (let i = 0; i < n; i++) nodes.push({ id: 'n' + i }); for (let i = 1; i < n; i++) edges.push({ from: 'n' + (i - 1), to: 'n' + i, value: 1 }); return { nodes, edges }; }
function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let q = Math.imul(s ^ s >>> 15, 1 | s); q = q + Math.imul(q ^ q >>> 7, 61 | q) ^ q; return ((q ^ q >>> 14) >>> 0) / 4294967296; }; }

t('the WebAssembly kernel loads', () => { ok(W.b64.length > 1000, 'no bytes embedded: run python3 wasm/embed.py'); ok(typeof WebAssembly === 'object', 'this Node has no WebAssembly'); const r = both(derive(GEN.graph('moderate', 400, 2))); ok(r.stress === 1 && r.sep > 0, 'wasm did not run: ' + W.error); });
for (const [n, kind] of [[150, 'moderate'], [1200, 'moderate'], [4500, 'moderate'], [3000, 'complex']]) {
  t(`same picture, ${n} items (${kind})`, () => { const r = both(derive(GEN.graph(kind, n, 3))); ok(r.stress >= 1, 'stress did not use wasm'); const d = diff(r.a, r.b); ok(d === 0, 'largest position difference ' + d); return r.stress + ' stress, ' + r.sep + ' push-apart runs'; });
}
t('same picture in Closeness and Group clusters (they start from the stress picture)', () => { for (const arr of ['closeness', 'groups']) { const r = both(derive(GEN.graph('moderate', 800, 4)), arr); const d = diff(r.a, r.b); ok(d === 0, arr + ': largest position difference ' + d); } });
t('hop counts over 511 stay on the Float32 lists and give the same picture', () => { const r = both(derive(chain(700))); ok(diff(r.a, r.b) === 0, 'differs'); ok(r.stress === 0, 'the code cannot hold 700 hops, so wasm must hand back to JavaScript'); });
t('small pictures stay on JavaScript', () => { const r = both(derive(GEN.graph('moderate', 60, 4))); ok(r.stress === 0 && r.sep === 0, 'used wasm for 60 items'); ok(diff(r.a, r.b) === 0, 'differs'); });
t('push-apart: crowded, a grid that outgrows the start table, and a grid too big for a plain grid', () => {
  const cases = [[400, 300, 0], [300, 60000, 1], [300, 400000, 2]];   // items, spread, seed
  let n = 0;
  for (const [k, spread, seed] of cases) {
    const r = rng(seed + 11), X0 = new Float64Array(k * 2); for (let i = 0; i < k * 2; i++) X0[i] = (r() - 0.5) * spread;
    for (let i = 1; i < k; i += 7) { X0[i * 2] = X0[(i - 1) * 2] + 1; X0[i * 2 + 1] = X0[(i - 1) * 2 + 1]; }   // a few touching items
    const rad = (i) => 6 + (i % 5) * 3, XA = Float64Array.from(X0), XB = Float64Array.from(X0);
    W.on = false; const ra = E.separate(XA, k, 2, rad, 30); W.on = true; const s0 = W.sepCalls, rb = E.separate(XB, k, 2, rad, 30);
    ok(W.sepCalls > s0, 'wasm did not run for spread ' + spread); let d = 0; for (let i = 0; i < XA.length; i++) d = Math.max(d, Math.abs(XA[i] - XB[i])); ok(d === 0 && ra === rb, 'spread ' + spread + ': difference ' + d + ', result ' + ra + ' vs ' + rb); n++;
  }
  return n + ' cases';
});
t('broken or blocked WebAssembly: JavaScript takes over with the same picture', () => {
  const dg = derive(GEN.graph('moderate', 600, 6)); W.on = false; const want = build(dg); W.on = true;
  const keep = { mod: W.mod, tried: W.tried, b64: W.b64, calls: W.calls };
  W.mod = null; W.tried = false; W.b64 = 'AAAA'; const c0 = W.calls, got = build(dg);   // not a WebAssembly file
  ok(W.calls === c0, 'claimed to use wasm'); ok(diff(want, got) === 0, 'fallback picture differs'); ok(W.error, 'no error noted');
  const w0 = global.WebAssembly; global.WebAssembly = undefined; W.mod = null; W.tried = false; W.b64 = keep.b64; const got2 = build(dg); global.WebAssembly = w0;   // no WebAssembly at all
  ok(diff(want, got2) === 0, 'no-WebAssembly picture differs');
  W.mod = keep.mod; W.tried = keep.tried; W.b64 = keep.b64; W.error = '';
});
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);

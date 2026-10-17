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
for (const [n, kind] of [[150, 'moderate'], [1200, 'moderate'], [4500, 'moderate'], [3000, 'complex'], [22000, 'moderate']]) {   // 22,000 is over the size where a very crowded picture gets one bigger stretch first
  t(`same picture, ${n} items (${kind})`, () => { const r = both(derive(GEN.graph(kind, n, 3))); ok(r.stress >= 1, 'stress did not use wasm'); const d = diff(r.a, r.b); ok(d === 0, 'largest position difference ' + d); return r.stress + ' stress, ' + r.sep + ' push-apart runs'; });
}
t('early preview: a rough picture first, then the finished one is the same as without a preview', () => {
  const dg = derive(GEN.graph('moderate', 12000, 3)), opt = { view: 'network', arrange: 'stress', colorBy: 'group' };
  const want = E.build(dg, opt);   // no preview
  const t0 = Date.now(), rough = E.build(dg, Object.assign({ previewOnly: true }, opt)), tRough = Date.now() - t0;
  ok(rough.rough === true, 'the preview build did not stop early'); ok(rough.nodes.every((n) => Number.isFinite(n.cx) && Number.isFinite(n.cy)), 'preview positions are not numbers');
  const t1 = Date.now(), fin = E.build(dg, opt), tFin = Date.now() - t1;
  ok(!fin.rough, 'the finished build says it is rough'); ok(diff(want, fin) === 0, 'the finished picture changed after a preview (largest gap ' + diff(want, fin) + ')');
  const again = E.build(dg, opt); ok(diff(want, again) === 0, 'a second build changed (the kept preview was used twice)');
  const small = E.build(derive(GEN.graph('moderate', 800, 4)), Object.assign({ previewOnly: true }, opt)); ok(!small.rough, 'a small map claims a preview');
  return 'preview ' + tRough + ' ms, finish after it ' + tFin + ' ms';
});
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
function sampledStress(g, L) {   /* mean of (hops - scale*distance)^2 / hops^2 over 12 breadth-first sources: lower is truer */
  const idx = new Map(g.nodes.map((n, i) => [n.id, i])), adj = g.nodes.map(() => []), pos = new Map(L.nodes.map((n) => [n.nodeId || n.id, [n.cx, n.cy]]));
  g.edges.forEach((e) => { const a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { adj[a].push(b); adj[b].push(a); } });
  const k = g.nodes.length, pairs = []; let num = 0, den = 0;
  for (let s = 0; s < 12; s++) {
    const src = Math.floor(s * k / 12), d = new Int32Array(k).fill(-1), q = [src]; d[src] = 0;
    for (let h = 0; h < q.length; h++) for (const w of adj[q[h]]) if (d[w] < 0) { d[w] = d[q[h]] + 1; q.push(w); }
    const p = pos.get(g.nodes[src].id);
    for (let t = 0; t < k; t += 5) if (d[t] > 0) { const r = pos.get(g.nodes[t].id), e = Math.hypot(p[0] - r[0], p[1] - r[1]); pairs.push([d[t], e]); num += e / d[t]; den += e * e / (d[t] * d[t]); }
  }
  const sc = num / den; let st = 0; pairs.forEach(([h, e]) => { st += Math.pow(h - sc * e, 2) / (h * h); });
  return st / pairs.length;
}
t('multilevel start: big pieces come out truer, the same every run, and the option can be switched off', () => {
  const g = GEN.graph('moderate', 6000, 5), T = E.stressTuning, keep = T.multi;
  T.multi = 0; const off = build(derive(g)); T.multi = 1; const on = build(derive(g)), again = build(derive(g)); T.multi = keep;
  ok(diff(on, again) === 0, 'two runs differ');
  const a = sampledStress(g, off), b = sampledStress(g, on); ok(b < a * 0.95, 'multilevel truth ' + b.toFixed(3) + ' is not clearly better than ' + a.toFixed(3));
  T.multi = 1; const small = GEN.graph('moderate', 1200, 5); T.multi = 0; const s0 = build(derive(small)); T.multi = 1; const s1 = build(derive(small)); T.multi = keep;
  ok(diff(s0, s1) === 0, 'a piece under the size limit changed');
  return 'truth ' + a.toFixed(3) + ' -> ' + b.toFixed(3) + ' (lower is truer)';
});
console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);

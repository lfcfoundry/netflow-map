/* Copyright (c) 2026 LFC Foundry. MIT License. Flat Force: maps of 5,000 up to 20,000 items start from the Distances picture and take 40 gentle force rounds; smaller maps are exactly as before.
 * Checks: the switch (below the size nothing changes, at it the picture is different), the same picture every run, truth no worse than the old start (hop error, lower is truer), WebAssembly and JavaScript agree. */
'use strict';
global.NFMColumns = require('../src/columns.js');
const E = require('../src/engine.js'); global.NFMEngine = E; let bad = 0;
const GEN = require('../bench/gen.js'), T = E.force2dTuning;
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + (e && e.message || e)); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const derive = (g) => NFMColumns.derive(JSON.parse(JSON.stringify(g)));
const build = (g) => E.build(derive(g), { view: 'network', arrange: 'force', colorBy: 'group' });
const diff = (a, b) => { let d = 0; a.nodes.forEach((n, i) => { d = Math.max(d, Math.abs(n.cx - b.nodes[i].cx), Math.abs(n.cy - b.nodes[i].cy)); }); return d; };
function sampled(g, L) {
  const idx = new Map(g.nodes.map((n, i) => [n.id, i])), adj = g.nodes.map(() => []), pos = new Map(L.nodes.map((n) => [n.nodeId || n.id, [n.cx, n.cy]]));
  g.edges.forEach((e) => { const a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { adj[a].push(b); adj[b].push(a); } });
  const k = g.nodes.length; let num = 0, den = 0; const rows = [];
  for (let s = 0; s < 12; s++) { const src = Math.floor(s * k / 12), d = new Int32Array(k).fill(-1), q = [src]; d[src] = 0; for (let h = 0; h < q.length; h++) for (const w of adj[q[h]]) if (d[w] < 0) { d[w] = d[q[h]] + 1; q.push(w); } for (let x = 0; x < k; x += 3) if (x !== src && d[x] > 0) { const a = pos.get(g.nodes[src].id), b = pos.get(g.nodes[x].id); if (a && b) rows.push([d[x], Math.hypot(a[0] - b[0], a[1] - b[1])]); } }
  rows.forEach(([h, e]) => { num += e / h; den += e * e / (h * h); }); const sc = den > 0 ? num / den : 1; let st = 0; rows.forEach(([h, e]) => { const r = (h - sc * e) / h; st += r * r; }); return st / rows.length;
}
const keep = Object.assign({}, T);
const withTuning = (o, fn) => { Object.assign(T, keep, o); try { return fn(); } finally { Object.assign(T, keep); } };

t('the defaults: from 5,000 items up to (not including) 20,000, 40 rounds', () => { ok(T.stressMin === 5000 && T.stressMax === 20000 && T.polish === 40, JSON.stringify(T)); });
t('below 5,000 items the picture is exactly as before (2,000 items)', () => { const g = GEN.graph('moderate', 2000, 5); const a = withTuning({ stressMin: 0 }, () => build(g)), b = build(g); ok(diff(a, b) === 0, 'differs by ' + diff(a, b)); });
t('at 5,200 items the start is different, the same every run, and no less true (moderate and dense maps)', () => {
  let msg = '';
  for (const kind of ['moderate', 'complex']) {
    const g = GEN.graph(kind, 5200, 7), old = withTuning({ stressMin: 0 }, () => build(g)), a = build(g), b = build(g);
    ok(diff(old, a) > 0, kind + ': picture did not change'); ok(diff(a, b) === 0, kind + ': two runs differ');
    const eo = sampled(g, old), en = sampled(g, a); ok(en <= eo * 1.03, kind + ': less true, ' + eo.toFixed(3) + ' to ' + en.toFixed(3)); msg += kind + ' ' + eo.toFixed(3) + ' to ' + en.toFixed(3) + '; ';
  }
  return 'hop error ' + msg;
});
t('WebAssembly on and off give the same big Force picture', () => { const g = GEN.graph('moderate', 5200, 9); E.stressWasm.on = false; E.forceWasm.on = false; const a = build(g); E.stressWasm.on = true; E.forceWasm.on = true; const b = build(g); ok(diff(a, b) === 0, 'differs by ' + diff(a, b)); });
console.log(bad ? bad + ' FAILED' : 'force2d: all passed'); process.exit(bad ? 1 : 0);

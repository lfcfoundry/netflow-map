/* Copyright (c) 2026 LFC Foundry. MIT License. A big flat map is built straight into the packed link lists (S.flatLinks in src/scene.js): the links equal the ones a styled build makes as objects (to 32-bit precision), styling and the picture lists read them without waking the objects, and S.curves still gives the objects. Pass/fail only. */
'use strict';
const E = require('../src/engine.js'), SC = require('../vendor/netflow-scene.js'), EX = require('../src/examples.js');
const ok = (c, m) => { if (!c) { console.log('FAIL ' + m); process.exit(1); } };
const L = E.build(EX.bigNetwork(1500, 4, 7), { view: 'network', arrange: 'circle', colorBy: 'group' });
const base = { colorBy: 'group', theme: 'light' };
const flat = SC.make(L, base), objs = SC.make(L, Object.assign({ flat: false }, base));
const n = flat.curveCount(); ok(n > 2000 && n === objs.curveCount(), 'a big map: ' + n + ' vs ' + objs.curveCount());
ok(flat.curvesPacked() && !objs.curvesPacked(), 'the flat build is packed from the start, the styled one is objects');
const snap = (S) => S.curves.map((c) => JSON.stringify([c.P, c.w, c.color, c.arrow, c.line, c.edge, c.from, c.to, c.dash || 0], (k, v) => typeof v === 'number' ? Math.fround(v) : v));
const f0 = flat.curves.map((c) => c), o0 = snap(objs);   /* waking the flat one is allowed */
ok(!flat.curvesPacked(), 'reading S.curves makes the objects');
const fs = snap(flat); for (let i = 0; i < n; i++) ok(fs[i] === o0[i], 'link ' + i + ' differs:\n' + fs[i] + '\n' + o0[i]);
/* styling and picture lists on fresh packed scenes */
const mk = () => SC.make(L, base), a = mk(), b = SC.make(L, Object.assign({ flat: false }, base));
const focus = new Set(L.nodes.slice(0, 40).map((x) => x.key || x.id));
for (const st of [{}, { focus }, { focus, edges: new Set([3, 5, 9]) }, {}]) {
  SC.style(a, st); SC.style(b, st); ok(a.curvesPacked(), 'styling leaves the links packed');
  const A = a.curves.map((c) => c.a === undefined ? 1 : c.a), B = b.curves.map((c) => c.a === undefined ? 1 : c.a);
  for (let i = 0; i < n; i++) ok(Math.fround(A[i]) === Math.fround(B[i]), 'alpha of link ' + i + ': ' + A[i] + ' vs ' + B[i]);
  a.packNow(); ok(a.curvesPacked(), 'packed again');
}
const c = mk(); SC.style(c, { selEdges: new Set([2]) }); ok(c.curves[2].base && c.curves[2].a === 1, 'a selected link falls back to objects and is lit');
console.log('ok   flat links: ' + n + ' links equal, styling reads the lists');

/* Copyright (c) 2026 LFC Foundry. MIT License. A big flat map with link rules, dashes, arrowheads and bent links is also built straight into the packed lists, and equals the object build (to 32-bit precision), tips included. Pass/fail only. */
'use strict';
const E = require('../src/engine.js'), SC = require('../vendor/netflow-scene.js'), EX = require('../src/examples.js');
const ok = (c, m) => { if (!c) { console.log('FAIL ' + m); process.exit(1); } };
const L = E.build(EX.bigNetwork(1500, 4, 7), { view: 'network', arrange: 'circle', colorBy: 'group' });
const rules = (e, ei) => ei % 11 === 0 ? { color: '#d33', w: 3, dash: 'dot' } : ei % 7 === 0 ? { arrow: true } : ei % 5 === 0 ? { bend: 0.2, opacity: 0.4 } : ei % 13 === 0 ? { hide: true } : ei % 17 === 0 ? { dash: 'long', arrow: true, bend: -0.15 } : null;
const snap = (S) => S.curves.map((c) => JSON.stringify([c.P, c.w, c.color, c.arrow, c.line, c.tip, c.edge, c.from, c.to, c.dash || 0, c.a], (k, v) => typeof v === 'number' ? Math.fround(v) : v));
for (const extra of [{ linkStyle: rules }, { curve: 0.25 }, { linkStyle: rules, curve: 0.1 }]) {
  const base = Object.assign({ colorBy: 'group', theme: 'light' }, extra);
  const flat = SC.make(L, base), objs = SC.make(L, Object.assign({ flat: false }, base));
  const n = flat.curveCount(); ok(n > 2000 && n === objs.curveCount(), 'count ' + n + ' vs ' + objs.curveCount());
  ok(flat.curvesPacked() && !objs.curvesPacked(), 'flat is packed from the start');
  let tips = 0, seen = 0; flat.eachCurveView((v) => { seen++; if (v.tip) tips++; }); ok(seen === n && flat.curvesPacked(), 'eachCurveView leaves it packed');
  const fs = snap(flat), os = snap(objs);
  for (let i = 0; i < n; i++) ok(fs[i] === os[i], 'link ' + i + ' differs:\n' + fs[i] + '\n' + os[i]);
  console.log('ok   flat rules ' + Object.keys(extra).join('+') + ': ' + n + ' links equal, ' + tips + ' arrowheads packed');
}

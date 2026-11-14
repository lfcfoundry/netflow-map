/* Copyright (c) 2026 LFC Foundry. MIT License. Builds that share a holder (o.cacheHolder) reuse the flat arrays and importance answers of one graph; every view comes out the same as with no holder, in any order, and changed options (hidden kinds, a block list) are not mixed up. */
'use strict';
global.NFMCharts = require('../src/charts.js');
const E = require('../src/engine.js'), Col = require('../src/columns.js'), X = require('../src/examples.js');
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const js = (L) => JSON.stringify(L, (k, v) => (k === 'ms' ? 0 : typeof v === 'number' && v !== v ? 'NaN' : v instanceof Float64Array || v instanceof Int32Array ? Array.from(v) : v));
const g = X.bigNetwork(260, 4, 3);
g.nodes.forEach((n) => { n.group = 'c' + n.attrs.community; });
g.edges.forEach((e, i) => { e.kind = i % 5 === 0 ? 'k1' : ''; });
const G = Col.derive(g), holder = {};
const views = ['flow', 'down', 'spine', 'lanes', 'sankey', 'arc', 'matrix', 'treemap', 'sunburst', 'network', 'flow', 'treemap'];
views.forEach((view, i) => {
  const o = { view };
  const a = E.build(G, o), b = E.build(G, Object.assign({ cacheHolder: holder }, o));
  ok(js(a) === js(b), 'step ' + i + ' ' + view + ': same as with no holder');
});
ok(holder.piP && holder.piImp, 'the holder kept the arrays');
const o2 = { view: 'flow', hideKinds: ['k1'] };
ok(js(E.build(G, o2)) === js(E.build(G, Object.assign({ cacheHolder: holder }, o2))), 'hidden kinds are not mixed up with the plain build');
const o3 = { view: 'flow', block: [g.nodes[5].id] };
ok(js(E.build(G, o3)) === js(E.build(G, Object.assign({ cacheHolder: holder }, o3))), 'a block list is not mixed up');
ok(js(E.build(G, { view: 'flow' })) === js(E.build(G, { view: 'flow', cacheHolder: holder })), 'back to the plain options');
console.log(fails ? fails + ' FAILED of ' + checks : 'prep reuse: ' + checks + ' checks passed');
process.exit(fails ? 1 : 0);

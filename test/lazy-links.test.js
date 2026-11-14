/* Copyright (c) 2026 LFC Foundry. MIT License. Nested views (treemap, icicle, sunburst, pack) can leave their link records unmade (lazyLinks); the records made later equal the ones the full build makes, and the picture's layout is the same. */
'use strict';
global.NFMCharts = require('../src/charts.js');
const E = require('../src/engine.js'), Col = require('../src/columns.js'), X = require('../src/examples.js');
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const same = (a, b) => JSON.stringify(a, (k, v) => (typeof v === 'number' && v !== v ? 'NaN' : v)) === JSON.stringify(b, (k, v) => (typeof v === 'number' && v !== v ? 'NaN' : v));
const g = X.bigNetwork(3000, 6, 7);
g.nodes.forEach((n) => { n.group = 'c' + n.attrs.community; });
g.edges.forEach((e, i) => { if (i % 7 === 0) e.label = 'link ' + i; });
const G = Col.derive(g);
['treemap', 'icicle', 'sunburst', 'pack'].forEach((view) => {
  [{}, { nest: 'links' }, { sizeBy: 'sys:degree' }].forEach((extra) => {
    const full = E.build(G, Object.assign({ view }, extra)), lazy = E.build(G, Object.assign({ view, lazyLinks: true }, extra));
    const tag = view + ' ' + JSON.stringify(extra);
    ok(lazy.lazyLinks && lazy.edges.length === 0, tag + ': links left unmade');
    ok(same(full.nodes, lazy.nodes), tag + ': same items');
    ok(same(full.chart.par, lazy.chart.par) && full.chart.mode === lazy.chart.mode, tag + ': same nesting');
    E.lazyLinks(lazy, () => G.edges);
    ok(lazy.edges.length === full.edges.length, tag + ': link count ' + lazy.edges.length + ' vs ' + full.edges.length);
    ok(same(full.edges, lazy.edges), tag + ': same link records');
    ok(lazy.edges === lazy.edges && Object.getOwnPropertyDescriptor(lazy, 'edges').value === lazy.edges, tag + ': made once');
  });
});
/* views and options that need the records are built in full */
const flow = E.build(G, { view: 'treemap', lazyLinks: true, widthBy: 'weight' });
ok(!flow.lazyLinks && flow.edges.length > 0, 'width by a channel keeps the records');
const tree = E.build(G, { view: 'tree', lazyLinks: true });
ok(!tree.lazyLinks && tree.edges.length > 0, 'the tree view keeps the records');
console.log(fails ? fails + ' FAILED of ' + checks : 'lazy links: ' + checks + ' checks passed');
process.exit(fails ? 1 : 0);

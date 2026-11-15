/* Copyright (c) 2026 LFC Foundry. MIT License. A big nested view drawn from the reach alone (lite importance) gets the same traffic and choke points a moment later (impFull), and every other picture field is the same as a full build. */
'use strict';
global.NFMCharts = require('../src/charts.js');
const E = require('../src/engine.js'), Col = require('../src/columns.js'), X = require('../src/examples.js');
let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.log('FAIL', m); } };
const g = X.bigNetwork(1500, 5, 4);
g.nodes.forEach((n) => { n.group = 'c' + n.attrs.community; });
const G = Col.derive(g);
['treemap', 'icicle', 'sunburst', 'pack'].forEach((view) => {
  const holder = {}, full = E.build(G, { view, lazyLinks: true, colorBy: 'group' }), lite = E.build(G, { view, lazyLinks: true, cacheHolder: holder });
  ok(lite.imp.lite === true && lite.imp.tok === holder.piTok, view + ': lite build says so');
  ok(E.build(G, { view, lazyLinks: true, cacheHolder: {}, sizeBy: 'sys:traffic' }).imp.lite !== true, view + ': sizing by traffic keeps the full answers');
  ok(lite.nodes.every((n, i) => n.unreached === full.nodes[i].unreached), view + ': reached items are the same');
  ok(lite.imp.reached === full.imp.reached, view + ': reach count is the same');
  const f = E.impFull(holder, lite.imp.tok), f2 = E.impFull(holder, lite.imp.tok + 1);
  ok(f2 === null, view + ': a wrong token gets nothing');
  ok(f && JSON.stringify(f.imp) === JSON.stringify({ goal: full.imp.goal, goalKind: full.imp.goalKind, spine: full.imp.spine, routesLog10: full.imp.routesLog10, reached: full.imp.reached, chokeCount: full.imp.chokeCount }), view + ': summary is the same as the full build');
  let same = true;
  lite.nodes.forEach((n, i) => { let tr = 0, ch = false; n.pages.forEach((pi) => { if (f.traffic[pi] > tr) tr = f.traffic[pi]; if (f.choke[pi]) ch = true; }); if (tr !== full.nodes[i].traffic || ch !== full.nodes[i].choke) same = false; });
  ok(same, view + ': traffic and choke on every item match the full build');
  ok(!holder.piImp.lite, view + ': the holder now keeps the full answers');
  const again = E.build(G, { view, lazyLinks: true, cacheHolder: holder });
  ok(!again.imp.lite && JSON.stringify(again.imp) === JSON.stringify(full.imp), view + ': the next build reuses the full answers');
});
{ const holder = {}, a = E.build(G, { view: 'treemap', lazyLinks: true, cacheHolder: holder }), b = E.build(G, { view: 'flow', cacheHolder: holder });
  ok(a.imp.lite === true && b.imp.lite !== true && !holder.piImp.lite, 'a flow view after a lite build upgrades the holder'); }
{ const a = E.build(G, { view: 'treemap', lazyLinks: true }); ok(a.imp.lite !== true, 'no holder: the full answers'); }
console.log(fails ? fails + ' FAILED of ' + checks : 'late importance: ' + checks + ' checks passed');
process.exit(fails ? 1 : 0);

/* Copyright (c) 2026 LFC Foundry. MIT License. Every built-in example loads, passes the data check without a problem, and draws in the views that make sense. */
'use strict';
global.NFMColumns = require('../src/columns.js'); global.NFMImport = require('../src/importers.js');
const X = require('../src/examples.js'), C = require('../src/check.js'), E = require('../src/engine.js'); let bad = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const t = (name, fn) => { try { const r = fn(); console.log('ok   ' + name + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
X.LIST.forEach((ex) => t('example "' + ex.id + '": loads, no problems in the data check, draws as a network', () => {
  const r = ex.load(), g = NFMColumns.derive(r.graph), res = C.run(g, {});
  ok(g.nodes.length > 3, 'too small'); ok(res.counts.error === 0, res.counts.error + ' problems: ' + res.findings.filter((f) => f.sev === 'error').map((f) => f.title).join('; '));
  const L = E.build(g, { view: 'network', colorBy: 'group' }); ok(L.nodes.length === g.nodes.length || ex.id === 'states', 'items lost in the drawing');
  return res.verdict + ' (' + res.counts.warn + ' to look at)';
}));
t('the app\'s own steps: flow is conserved (nothing lost between steps), the only note is the two loops', () => {
  const ex = X.LIST.find((e) => e.id === 'itself'), g = NFMColumns.derive(ex.load().graph), res = C.run(g, {});
  ok(g.nodes.length === 26 && g.edges.length === 34, 'size ' + g.nodes.length + '/' + g.edges.length);
  ok(!res.findings.some((f) => /do not pass on what comes in/.test(f.title)), 'flow is not conserved: ' + res.findings.filter((f) => /pass on/.test(f.title)).map((f) => f.items.join(',')));
  const warn = res.findings.filter((f) => f.sev === 'warn'); ok(warn.length === 1 && /go backward/.test(warn[0].title), 'unexpected notes: ' + warn.map((f) => f.title).join('; '));
  const inW = {}, outW = {}; g.edges.forEach((e) => { outW[e.from] = (outW[e.from] || 0) + e.weight; inW[e.to] = (inW[e.to] || 0) + e.weight; });
  g.nodes.forEach((n) => { if (n.id !== 'file' && n.id !== 'exp') ok(inW[n.id] === outW[n.id], n.id + ' takes in ' + inW[n.id] + ' and passes on ' + outW[n.id]); });
});
if (bad) { console.log(bad + ' failed'); process.exit(1); } console.log('examples: all passed');

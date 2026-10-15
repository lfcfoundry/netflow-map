/* Columns and Check tests. Copyright (c) 2026 JNFoo. MIT License. Run: node test/columns.test.js */
var C = require('../src/columns.js'), K = require('../src/check.js'), assert = require('assert');
var ok = 0; function t(name, f) { try { f(); ok++; } catch (e) { console.error('FAIL', name, e.message); process.exitCode = 1; } }

t('num reads people-style numbers', function () {
  assert.strictEqual(C.num('1,234.5'), 1234.5); assert.strictEqual(C.num('$12'), 12); assert.strictEqual(C.num('(300)'), -300);
  assert.strictEqual(C.num('12%'), 12); assert.ok(isNaN(C.num('N/A'))); assert.ok(isNaN(C.num('12 kg'))); assert.ok(isNaN(C.num(''))); assert.strictEqual(C.num(' -4 '), -4);
});
t('profile kinds', function () {
  var g = { nodes: [], edges: [] };
  for (var i = 0; i < 30; i++) g.nodes.push({ id: 'n' + i, label: 'n' + i, group: i % 3 ? 'A' : 'B', attrs: { pop: String(i * 1000), when: '2024-0' + (1 + i % 9) + '-01', note: 'free text number ' + i } });
  var p = C.profile(g), by = {}; p.nodes.forEach(function (c) { by[c.key] = c; });
  assert.strictEqual(by.pop.kind, 'number'); assert.strictEqual(by.when.kind, 'date'); assert.strictEqual(by.group.kind, 'category'); assert.strictEqual(by.note.kind, 'text');
});
t('formulas', function () {
  var f = C.compile('([a] + 2) * [b] / 4 - min(1, 2) + if([a] > 1, 10, 20)');
  assert.strictEqual(f.fn(function (n) { return n === 'a' ? 2 : 8; }), (4 * 8) / 4 - 1 + 10);
  assert.deepStrictEqual(f.vars.sort(), ['a', 'b']);
  assert.throws(function () { C.compile('2 +'); }); assert.throws(function () { C.compile('foo(1)'); }); assert.throws(function () { C.compile('constructor'); (function () { throw new Error('x'); })(); });
  assert.ok(isNaN(C.compile('1/0').fn(function () { return 0; })));
});
t('derive adds calculated columns', function () {
  var g = { name: 'x', nodes: [{ id: 'a', label: 'a', attrs: { cost: 10 } }, { id: 'b', label: 'b', attrs: { cost: 30 } }], edges: [{ from: 'a', to: 'b', weight: 5 }], calc: [{ scope: 'nodes', name: 'double', formula: '[cost]*2' }, { scope: 'edges', name: 'share', formula: '[weight] / to.double' }] };
  var d = C.derive(g); assert.strictEqual(d.nodes[1].attrs.double, 60); assert.ok(Math.abs(d.edges[0].attrs.share - 5 / 60) < 1e-6);
  assert.strictEqual(C.derive({ nodes: [], edges: [] }).nodes.length, 0);
});
t('formula cannot reach the machine', function () {
  var f = C.compile('[constructor] + [__proto__]'); assert.ok(isNaN(f.fn(function () { return NaN; })));
});
t('isStory neutral by default', function () {
  assert.strictEqual(C.isStory({ nodes: [{ id: 'a' }], edges: [] }), false);
  assert.strictEqual(C.isStory({ flavor: 'story', nodes: [], edges: [] }), true);
  assert.strictEqual(C.isStory({ nodes: [{ id: 'a', valence: 'good' }], edges: [] }), true);
});
t('guess roles picks weight and size', function () {
  var g = { nodes: [{ id: 'a', label: 'a', attrs: { revenue: 5 } }, { id: 'b', label: 'b', attrs: { revenue: 7 } }], edges: [{ from: 'a', to: 'b', weight: 3 }] };
  var r = C.guessRoles(C.profile(g), g); assert.strictEqual(r.widthBy, 'weight'); assert.strictEqual(r.sizeBy, 'col:revenue');
});
t('state suggestions', function () {
  var g = { nodes: [], edges: [] }; for (var i = 0; i < 6; i++) g.edges.push({ from: 'a', to: 'b', weight: 1, attrs: { year: 2020 + i % 3 } });
  var s = C.suggestStates(g); assert.ok(s.rows.some(function (r) { return r.key === 'year'; }));
  var g2 = { nodes: [], edges: [{ from: 'a', to: 'b', attrs: { 'Baseline': 1, 'Year 1': 2, 'Year 2': 3 } }] };
  assert.strictEqual(C.suggestStates(g2).cols[0].keys.length, 3);
});

/* check */
function base() { var g = { name: 't', nodes: [], edges: [] }; ['A', 'B', 'C', 'D', 'E', 'F'].forEach(function (x) { g.nodes.push({ id: x, label: x }); }); [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'E'], ['E', 'F'], ['A', 'C']].forEach(function (p) { g.edges.push({ from: p[0], to: p[1], weight: 5 }); }); return g; }
t('check finds a broken link, self link, and spaces', function () {
  var g = base(); g.edges.push({ from: 'A', to: 'Zed' }, { from: 'B', to: 'B' }); g.nodes.push({ id: 'G ', label: 'G ' });
  var r = K.run(g), ids = r.findings.map(function (f) { return f.id; });
  assert.ok(ids.indexOf('brokenlinks') >= 0); assert.ok(ids.indexOf('selflinks') >= 0); assert.ok(ids.indexOf('spaces') >= 0); assert.strictEqual(r.verdict, 'attention');
});
t('check finds a decimal slip', function () {
  var g = base(); for (var i = 0; i < 30; i++) g.edges.push({ from: 'A', to: 'B', weight: 10 + (i % 5), kind: 'k' + i }); g.edges.push({ from: 'C', to: 'D', weight: 1200, kind: 'z' });
  var f = K.run(g).findings.filter(function (x) { return /^outliers/.test(x.id); })[0]; assert.ok(f, 'no outlier finding'); assert.ok(/decimal|unit|10, 100/.test(f.text) || f.count >= 1);
});
t('check finds category variants and fixes them', function () {
  var g = base(); g.nodes.forEach(function (n, i) { n.group = i % 2 ? 'North' : 'north'; }); g.nodes[0].group = 'Nrth';
  var f = K.run(g).findings.filter(function (x) { return /^catvariants/.test(x.id); })[0]; assert.ok(f);
  var fx = K.applyFix(g, f.fix); assert.ok(fx); var groups = new Set(fx.graph.nodes.map(function (n) { return n.group; })); assert.ok(groups.size < 3);
});
t('check finds odds that do not add up', function () {
  var g = { nodes: [], edges: [] }; for (var i = 0; i < 10; i++) { g.nodes.push({ id: 'n' + i, label: 'n' + i }); }
  for (i = 0; i < 9; i++) { g.edges.push({ from: 'n' + i, to: 'n' + (i + 1), weight: 0.6 }, { from: 'n' + i, to: 'n' + ((i + 3) % 10), weight: 0.4 }); }
  g.edges[4].weight = 0.9;
  var f = K.run(g).findings.filter(function (x) { return x.id === 'oddsum'; })[0]; assert.ok(f, 'no oddsum'); assert.strictEqual(f.items.length, 1);
});
t('check finds leaking flow', function () {
  var g = { nodes: [], edges: [] }; for (var i = 0; i < 12; i++) g.nodes.push({ id: 'n' + i, label: 'n' + i });
  for (i = 0; i < 11; i++) g.edges.push({ from: 'n' + i, to: 'n' + (i + 1), weight: 100 });
  g.edges[5].weight = 60;
  var f = K.run(g).findings.filter(function (x) { return x.id === 'leaks'; })[0]; assert.ok(f, 'no leaks'); assert.ok(f.items.length >= 1);
});
t('similar-name detection does not pair a name with itself or numbered ids', function () {
  var g = base(); g.nodes.push({ id: 'Atlas 10', label: 'Atlas 10' }, { id: 'Atlas 100', label: 'Atlas 100' }); var r = K.run(g);
  assert.ok(!r.findings.some(function (f) { return f.id === 'similarnames'; }));
  g.nodes.push({ id: 'Kitchen', label: 'Kitchen' }, { id: 'Kitchn', label: 'Kitchn' }); assert.ok(K.run(g).findings.some(function (f) { return f.id === 'similarnames'; }));
});
t('fixes are pure', function () {
  var g = base(); g.edges.push({ from: 'B', to: 'B' }); var n = g.edges.length; var fx = K.applyFix(g, { id: 'dropSelf' }); assert.strictEqual(g.edges.length, n); assert.strictEqual(fx.graph.edges.length, n - 1);
});
t('markdown report', function () { var g = base(); g.edges.push({ from: 'A', to: 'Q' }); var md = K.toMarkdown(K.run(g), g); assert.ok(/^# Data check/.test(md)); assert.ok(/does not exist/.test(md)); });
t('clean data stays clean of errors', function () { var r = K.run(base()); assert.strictEqual(r.counts.error, 0); });
console.log('columns+check:', ok, 'passed' + (process.exitCode ? ' (with failures)' : ''));

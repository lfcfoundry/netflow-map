/* Link columns tests. Copyright (c) 2026 LFC Foundry. MIT License. Run: node test/link-cols.test.js */
var LC = require('../src/link-cols.js'), I = require('../src/importers.js'), E = require('../src/examples.js'), assert = require('assert');
var ok = 0; function t(name, f) { try { f(); ok++; } catch (e) { console.error('FAIL', name, e.message); process.exitCode = 1; } }
function posOf(nodes) { var p = new Map(); nodes.forEach(function (n, i) { p.set(n.id, i); }); return p; }
t('rows round trip, same rows, bundle too', function () {
  var g = E.bigNetwork(800, 6, 3), s = I.sanitizeGraph(g);
  s.edges.forEach(function (e, i) { if (i % 7 === 0) { e.weight = i / 4; } if (i % 5 === 0) e.kind = 'k' + (i % 3); if (i % 11 === 0) e.label = 'L' + i; if (i % 13 === 0) { e.attrs.a = i; if (i % 2) e.attrs.b = 'x' + i; } });
  var s2 = I.sanitizeGraph(s);   /* what sanitizing makes of them */
  var L = LC.fromEdges(s2.edges, posOf(s2.nodes)); assert.ok(L);
  var L2 = LC.fromBundle(JSON.parse(JSON.stringify(LC.toBundle(L)))); assert.ok(LC.valid(L2, s2.nodes.length));
  var back = LC.rows(L2, s2.nodes); assert.strictEqual(back.length, s2.edges.length);
  s2.edges.forEach(function (e, i) { assert.deepStrictEqual(JSON.parse(JSON.stringify(back[i])), JSON.parse(JSON.stringify(e))); assert.strictEqual(Object.keys(back[i]).sort().join(), Object.keys(e).sort().join()); });
});
t('lazy edges build once, setter replaces', function () {
  var s = I.sanitizeGraph(E.bigNetwork(200, 4, 1)), L = LC.fromEdges(s.edges, posOf(s.nodes)), g = { name: 'x', nodes: s.nodes };
  LC.lazyEdges(g, L); assert.strictEqual(LC.pending(g), L); assert.ok(Object.keys(g).indexOf('edges') >= 0);
  var a = g.edges; assert.strictEqual(a.length, s.edges.length); assert.strictEqual(g.edges, a); assert.strictEqual(LC.pending(g), null);
  var h = { nodes: s.nodes }; LC.lazyEdges(h, L); h.edges = []; assert.strictEqual(h.edges.length, 0); assert.strictEqual(LC.pending(h), null);
});
t('refuses links it cannot keep', function () {
  var nodes = [{ id: 'a' }, { id: 'b' }], p = posOf(nodes);
  assert.strictEqual(LC.fromEdges([{ from: 'a', to: 'z', label: '', kind: '', attrs: {} }], p), null);
  assert.strictEqual(LC.fromEdges([{ from: 'a', to: 'b', label: '', kind: '', attrs: {}, vals: [1] }], p), null);
  assert.strictEqual(LC.fromEdges([{ from: 'a', to: 'b', label: '', kind: '', attrs: { x: [1] } }], p), null);
  assert.strictEqual(LC.fromEdges([{ from: 'a', to: 'b', label: '', kind: '', attrs: { x: 1, y: 2 } }, { from: 'a', to: 'b', label: '', kind: '', attrs: { y: 1, x: 2 } }], p), null);
});
t('bad file is refused', function () {
  assert.throws(function () { LC.fromBundle({ n: 2, fi: 'AAAA', ti: 'AAAA', kinds: [''], labels: [''], ak: [], ac: [] }); });
  var L = { n: 1, fi: new Int32Array([5]), ti: new Int32Array([0]), kinds: [''], labels: [''], kx: null, lx: null, w: null, ak: [], ac: [] }; assert.strictEqual(LC.valid(L, 2), false);
});
console.log('link-cols tests: ' + ok + ' passed'); 

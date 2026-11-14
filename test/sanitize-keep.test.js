/* Copyright (c) 2026 LFC Foundry. MIT License. sanitizeGraph keeps rows that are already clean (no copy) and gives the same graph as the copying version for every kind of row. Run: node test/sanitize-keep.test.js */
'use strict';
var assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), n = 0;
var NEW = require('../src/importers.js');
var oldPath = process.env.NFM_OLD_IMPORTERS;   /* a copy of the importers before this change (optional: without it only the identity checks run) */
var OLD = oldPath && fs.existsSync(oldPath) ? require(oldPath) : null;
var nodes = [
  { id: 'a', label: 'A', group: '', valence: '', ghost: false, attrs: {} },                       // clean
  { id: 'b', label: 'B', group: 'g', valence: 'good', ghost: true, attrs: { c: 3, d: 'x', e: true } }, // clean
  { id: 'c', label: 'C', group: '', valence: 'win', ghost: false, attrs: {} },                    // valence word changes
  { id: 'd', label: 'D', group: '', valence: '', ghost: false, attrs: { f: NaN } },               // NaN value dropped to text
  { id: 'e', label: 'E', group: '', valence: '', ghost: false, attrs: { __proto__x: 1 }, extra: 1 }, // extra field
  { id: 'f', label: 'x'.repeat(500), group: '', valence: '', ghost: false, attrs: {} },           // long label
  { id: 'g', label: 'G', group: '', valence: '', ghost: 0, attrs: {} },                           // ghost not boolean
  { id: 'h', attrs: {} }, { id: 7, label: 'seven', group: '', valence: '', ghost: false, attrs: {} },
  { id: 'a', label: 'dup', group: '', valence: '', ghost: false, attrs: {} },
  { id: 'i', label: 'I', group: '', valence: '', ghost: false, attrs: [1, 2] }, { id: 'j', label: 'J', group: '', valence: '', ghost: false, attrs: { n: { deep: 1 } } }
];
var edges = [
  { from: 'a', to: 'b', label: '', kind: '', attrs: {} },                           // clean (no weight)
  { from: 'a', to: 'b', label: 'L', kind: 'k', weight: 2.5, attrs: { w: 1 } },      // clean with weight
  { from: 'b', to: 'c', label: '', kind: '', weight: undefined, attrs: {} },        // clean, explicit undefined weight
  { from: 'b', to: 'c', label: '', kind: '', weight: '3', attrs: {} },              // weight text becomes a number
  { from: 'b', to: 'c', label: '', kind: '', weight: Infinity, attrs: {} },
  { from: 'a', to: 'zz', label: '', kind: '', attrs: {} },                          // missing end: dropped
  { from: 'a', to: 'b', label: '', kind: 'k'.repeat(60), attrs: {} }, { from: 'a', to: 'b', label: '', kind: '', attrs: {}, vals: [1] }, { from: 'a', to: 'b' }
];
var out = NEW.sanitizeGraph({ name: 'T', start: 'a', nodes: nodes, edges: edges });
assert.strictEqual(out.nodes[0], nodes[0]); assert.strictEqual(out.nodes[1], nodes[1]); n++;       // clean rows are kept as they are
assert.notStrictEqual(out.nodes[2], nodes[2]); assert.strictEqual(out.nodes[2].valence, 'good'); n++;
assert.strictEqual(out.edges[0], edges[0]); assert.strictEqual(out.edges[1], edges[1]); assert.strictEqual(out.edges[2], edges[2]); n++;
assert.strictEqual(typeof out.edges[3].weight, 'number'); assert.ok(out.edges.every(function (e) { return e !== edges[4] && e !== edges[6]; })); n++;
if (OLD) {
  var ref = OLD.sanitizeGraph({ name: 'T', start: 'a', nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }), mine = NEW.sanitizeGraph({ name: 'T', start: 'a', nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
  var J = function (x) { return JSON.parse(JSON.stringify(x)); };
  assert.deepStrictEqual(J(mine), J(ref)); n++;   /* equal values; a kept row may list its fields in another order */
  var rnd = 12345, r = function () { rnd = (rnd * 1664525 + 1013904223) >>> 0; return rnd / 4294967296; }, junk = [undefined, null, 0, 1, -1, NaN, 'x', '', 'good', ' Bad ', true, false, [], {}, { a: 1 }, 'y'.repeat(450)];
  for (var q = 0; q < 300; q++) {
    var N = [], E = [], i, pick = function () { return junk[Math.floor(r() * junk.length)]; };
    for (i = 0; i < 12; i++) { var o = {}; ['id', 'label', 'group', 'valence', 'ghost', 'attrs'].forEach(function (k) { if (r() < 0.8) o[k] = k === 'id' ? 'n' + (i % 9) : r() < 0.5 ? (k === 'attrs' ? { x: pick() } : pick()) : (k === 'ghost' ? false : k === 'attrs' ? {} : k === 'valence' ? '' : 's'); }); if (r() < 0.1) o.extra = 1; N.push(o); }
    for (i = 0; i < 20; i++) { var e = {}; ['from', 'to', 'label', 'kind', 'weight', 'attrs'].forEach(function (k) { if (r() < 0.8) e[k] = k === 'from' || k === 'to' ? 'n' + Math.floor(r() * 10) : r() < 0.5 ? (k === 'attrs' ? { y: pick() } : pick()) : (k === 'weight' ? 2 : k === 'attrs' ? {} : ''); }); E.push(e); }
    var a = NEW.sanitizeGraph({ name: 'f', nodes: JSON.parse(JSON.stringify(N)), edges: JSON.parse(JSON.stringify(E)) }), b = OLD.sanitizeGraph({ name: 'f', nodes: JSON.parse(JSON.stringify(N)), edges: JSON.parse(JSON.stringify(E)) });
    assert.deepStrictEqual(J(a), J(b), 'fuzz ' + q);
  }
  n++;
}
console.log('sanitize-keep: ' + n + ' passed' + (OLD ? '' : ' (no old copy: set NFM_OLD_IMPORTERS for the comparison)'));

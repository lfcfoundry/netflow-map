/* Copyright (c) 2026 JNFoo. MIT License. Quick checks for the importers. Run: node test/importers.test.js */
'use strict';
var I = require('../src/importers.js'), assert = require('assert'), n = 0;
function t(name, fn) { try { fn(); n++; } catch (e) { console.log('FAIL', name, '\n  ', e.message); process.exitCode = 1; } }
t('csv edge list with header', function () {
  var r = I.importAny([{ name: 'e.csv', text: 'source,target,weight\nA,B,2\nB,C,1\nA,C,3\n' }]);
  assert.equal(r.graph.nodes.length, 3); assert.equal(r.graph.edges.length, 3); assert.equal(r.graph.edges[0].weight, 2);
});
t('tsv, quotes and a comma in a name', function () {
  var r = I.importAny([{ name: 'e.tsv', text: 'from\tto\tlabel\n"A, one"\tB\t"say ""hi"""\n' }]);
  assert.equal(r.graph.nodes[0].id, 'A, one'); assert.equal(r.graph.edges[0].label, 'say "hi"');
});
t('semicolon with decimal comma', function () {
  var r = I.importAny([{ name: 'e.csv', text: 'from;to;weight\nA;B;1,5\nB;C;2,25\n' }]);
  assert.equal(r.graph.edges[0].weight, 1.5);
});
t('node table with links column makes placeholders', function () {
  var r = I.importAny([{ name: 'n.csv', text: 'id,links,group\nA,B;C,x\nB,C,y\n' }]);
  assert.equal(r.graph.edges.length, 3); assert.equal(r.graph.nodes.find(function (x) { return x.id === 'C'; }).ghost, true);
});
t('parent column tree', function () {
  var r = I.importAny([{ name: 't.csv', text: 'id,parent\nroot,\na,root\nb,root\nc,a\n' }]);
  assert.equal(r.graph.edges.length, 3);
});
t('adjacency matrix', function () {
  var r = I.importAny([{ name: 'm.csv', text: ',A,B,C\nA,0,1,1\nB,0,0,1\nC,0,0,0\n' }]);
  assert.equal(r.graph.edges.length, 3);
});
t('json nodes+links, numeric indexes', function () {
  var r = I.importAny([{ name: 'g.json', text: JSON.stringify({ nodes: [{ id: 'a' }, { id: 'b' }], links: [{ source: 'a', target: 'b' }] }) }]);
  assert.equal(r.graph.edges.length, 1);
});
t('json cytoscape', function () {
  var r = I.importAny([{ name: 'c.json', text: JSON.stringify({ elements: { nodes: [{ data: { id: 'a' } }, { data: { id: 'b' } }], edges: [{ data: { source: 'a', target: 'b' } }] } }) }]);
  assert.equal(r.graph.edges.length, 1); assert.match(r.report.notes[0], /Cytoscape/);
});
t('json canvas', function () {
  var r = I.importAny([{ name: 'x.canvas', text: JSON.stringify({ nodes: [{ id: '1', type: 'text', text: '# Hello', x: 0, y: 0 }, { id: '2', type: 'text', text: 'World', x: 1, y: 1 }, { id: 'g', type: 'group', x: 0, y: 0 }], edges: [{ id: 'e', fromNode: '1', toNode: '2' }] }) }]);
  assert.equal(r.graph.nodes.length, 2); assert.equal(r.graph.nodes[0].label, 'Hello'); assert.equal(r.graph.edges.length, 1);
});
t('json story passages', function () {
  var r = I.importAny([{ name: 's.json', text: JSON.stringify({ start: 'a', passages: [{ id: 'a', choices: [{ to: 'b', label: 'go' }] }, { id: 'b', ending: true, valence: 'good' }] }) }]);
  assert.equal(r.graph.start, 'a'); assert.equal(r.graph.nodes[1].valence, 'good');
});
t('json adjacency object', function () {
  var r = I.importAny([{ name: 'a.json', text: '{"a":["b","c"],"b":["c"]}' }]);
  assert.equal(r.graph.edges.length, 3);
});
t('json hostile keys are ignored', function () {
  var r = I.importAny([{ name: 'h.json', text: '{"nodes":[{"id":"a","__proto__":{"x":1},"constructor":"y"}],"edges":[]}' }]);
  assert.equal(({}).x, undefined); assert.equal(r.graph.nodes.length, 1);
});
t('arrow lines and dot', function () {
  var r = I.importAny([{ name: 'a.txt', text: 'digraph G {\n a -> b [label="x"];\n b -> c;\n}\n' }], { format: 'arrows' });
  assert.equal(r.graph.edges.length, 2); assert.equal(r.graph.edges[0].label, 'x');
  r = I.importAny('Start -> Left : go left\nStart -> Right\nLeft -> End\nRight -> End');
  assert.equal(r.graph.edges.length, 4); assert.equal(r.graph.edges[0].label, 'go left');
});
t('indented outline with wiki link', function () {
  var r = I.importAny('- Root\n  - A\n    - A1\n  - B [[A1]]\n');
  assert.equal(r.graph.edges.length, 4);
});
t('notes with wiki links, aliases and ghosts', function () {
  var r = I.importAny([{ name: 'A.md', path: 'v/A.md', text: '---\ntags: [x]\n---\n# Alpha\nSee [[b]] and [[Nope]] and [C](c.md)' }, { name: 'B.md', path: 'v/B.md', text: '[[A]]' }, { name: 'C.md', path: 'v/C.md', text: 'hi' }]);
  assert.equal(r.graph.nodes.length, 4); assert.equal(r.report.ghosts, 1);
  assert.equal(r.graph.nodes.find(function (x) { return x.id === 'A'; }).label, 'Alpha');
  assert.equal(r.graph.edges.length, 4);
});
t('clean-ups', function () {
  var g = I.importAny('a -> a\na -> b\na -> b : x').graph;
  assert.equal(I.CLEAN.selfLinks(g).graph.edges.length, 2);
  assert.equal(I.CLEAN.twoWay(g).graph.edges.length > g.edges.length, true);
});
t('bad json explains itself', function () { assert.throws(function () { I.importJSON('{oops', 'x'); }, /not valid JSON/); });
console.log(process.exitCode ? 'importers: FAILED' : 'importers: all ' + n + ' checks passed');

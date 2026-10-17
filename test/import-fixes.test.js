/* Copyright (c) 2026 LFC Foundry. MIT License. Regression cases for confirmed data-import bugs. Run: node test/import-fixes.test.js */
'use strict';
var I = require('../src/importers.js'), K = require('../src/columns.js'), assert = require('assert'), fails = 0, passes = 0;
function t(name, fn) {
  try { fn(); passes++; console.log('ok   ' + name); }
  catch (e) { fails++; console.log('FAIL ' + name + '\n     ' + String(e && e.message).split('\n').slice(0, 4).join('\n     ')); }
}
function ids(g) { return g.nodes.map(function (n) { return n.id; }); }
function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function noteMatch(r, re) { return r.report.notes.some(function (x) { return re.test(x); }); }
function csv(text, name, opts) { return I.importAny([{ name: name || 'x.csv', text: text }], opts); }
function xml(strings) { return '<?xml version="1.0"?><sst>' + strings + '</sst>'; }

/* ---------------------------------------------------------------- 1. odd names as plain-object keys */
var ODD = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf'];
t('1a. "merge same name" keeps items named constructor, toString, __proto__ and leaves their links as text', function () {
  var g = { name: 'x', start: null, nodes: ODD.concat(['a']).map(function (s) { return { id: s, label: s, group: '', valence: '', ghost: false, attrs: {} }; }), edges: [{ from: 'constructor', to: 'a', label: '', kind: '', attrs: {} }, { from: '__proto__', to: 'toString', label: '', kind: '', attrs: {} }] };
  var r = I.CLEAN.sameLabel(g);
  assert.strictEqual(r.changed, 0); assert.strictEqual(r.graph.nodes.length, 6);
  r.graph.edges.forEach(function (e) { assert.strictEqual(typeof e.from, 'string'); assert.strictEqual(typeof e.to, 'string'); });
  assert.strictEqual(r.graph.edges[0].from, 'constructor'); assert.strictEqual(r.graph.edges[1].to, 'toString');
  // and a real merge still works
  var g2 = { name: 'x', nodes: [{ id: 'toString', label: 'Same' }, { id: 'q', label: 'same ' }], edges: [{ from: 'q', to: 'q' }] };
  var r2 = I.CLEAN.sameLabel(g2); assert.strictEqual(r2.changed, 1); assert.strictEqual(r2.graph.edges[0].from, 'toString');
});
t('1b. a valence column that says "constructor" or "toString" is not a valence', function () {
  assert.strictEqual(I.valenceOf('constructor'), ''); assert.strictEqual(I.valenceOf('toString'), ''); assert.strictEqual(I.valenceOf('__proto__'), '');
  assert.strictEqual(I.valenceOf('Good'), 'good');
  var r = csv('id,valence\nA,constructor\nB,toString\nC,win\n');
  assert.deepStrictEqual(r.graph.nodes.map(function (n) { return n.valence; }), ['', '', 'good']);
});
t('1c. columns named toString / valueOf / hasOwnProperty are kept as extra columns (table and JSON)', function () {
  var r = csv('from,to,toString,valueOf\nA,B,5,six\n');
  assert.strictEqual(r.graph.edges[0].attrs.toString, '5'); assert.strictEqual(r.graph.edges[0].attrs.valueOf, 'six');
  var j = I.importJSON(JSON.stringify({ nodes: [{ id: 'a', toString: 'x', hasOwnProperty: 3 }], links: [] }), 'j', {});
  assert.strictEqual(j.graph.nodes[0].attrs.toString, 'x'); assert.strictEqual(j.graph.nodes[0].attrs.hasOwnProperty, 3);
  var m = I.mergeGraphs({ name: 'a', nodes: [{ id: 'a', label: 'a', attrs: {} }], edges: [] }, { name: 'b', nodes: [{ id: 'a', label: 'a', attrs: { toString: 'kept' } }], edges: [] });
  assert.strictEqual(m.nodes[0].attrs.toString, 'kept');
});
t('1d. two notes called constructor.md in different folders stay two items', function () {
  var r = I.importNotes([{ name: 'constructor.md', path: 'a/constructor.md', text: 'one' }, { name: 'constructor.md', path: 'b/constructor.md', text: 'two' }], 'n', {});
  assert.strictEqual(r.graph.nodes.length, 2);
});
t('1e. story JSON: links to "constructor"/"toString" get placeholders; to:0 is a link; null passages and choices do not throw', function () {
  var r = I.importJSON(JSON.stringify({ passages: [{ id: 'a', choices: [{ to: 'constructor' }, { to: 'toString' }, { to: 0 }, null, 5] }, null, { id: 0 }, { id: 'b', links: 'nope' }], start: 'a' }), 's', {});
  var by = {}; r.graph.nodes.forEach(function (n) { by[n.id] = n; });
  assert.ok(by.constructor && by.constructor.ghost === true, 'constructor placeholder'); assert.ok(by.toString && by.toString.ghost === true, 'toString placeholder');
  assert.ok(by['0'] && by['0'].ghost === false, 'passage 0 is real');
  var tos = r.graph.edges.map(function (e) { return e.to; });
  assert.ok(tos.indexOf('0') >= 0, 'to:0 link kept'); assert.ok(tos.indexOf('constructor') >= 0);
  assert.ok(ids(r.graph).indexOf('null') < 0 && ids(r.graph).indexOf('undefined') < 0);
});
t('1f. columns: a state value called "constructor" counts as a value; attrs named toString do not leak the function', function () {
  var g = { name: 'x', nodes: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }], edges: [{ from: 'a', to: 'b', attrs: { year: 'constructor' } }, { from: 'a', to: 'b', attrs: { year: 'toString' } }, { from: 'a', to: 'b', attrs: { year: 'x' } }] };
  var s = K.buildStates(g, { mode: 'rows', key: 'year' });
  assert.strictEqual(s.states.names.length, 3);
  assert.ok(Number.isNaN(K.numOf({ attrs: { a: 1 } }, 'col:toString')));
});

/* ---------------------------------------------------------------- 2. CR-only line ends */
t('2a. a file whose lines end in a lone CR is read line by line', function () {
  var r = csv('src,dst\rA,B\rB,C\r'); assert.strictEqual(r.graph.edges.length, 2); assert.deepStrictEqual(ids(r.graph).sort(), ['A', 'B', 'C']);
  assert.deepStrictEqual(I.parseDelimited('a,b\rc,d', ','), [['a', 'b'], ['c', 'd']]);
});
t('2b. CRLF, LF and CR can be mixed; quoted fields keep their line breaks', function () {
  assert.deepStrictEqual(I.parseDelimited('a,b\r\nc,d\re,f\ng,h', ','), [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h']]);
  assert.deepStrictEqual(I.parseDelimited('"x\ry",1\rz,2\r', ','), [['x\ry', '1'], ['z', '2']]);
  assert.deepStrictEqual(I.parseDelimited('"x\r\ny",1\r\nz,2', ','), [['x\r\ny', '1'], ['z', '2']]);
  assert.deepStrictEqual(I.parseDelimited('a,"b"\rc,d\r', ','), [['a', 'b'], ['c', 'd']]);
});
t('2c. a big CR-only file reads fast (no repeated searching)', function () {
  var s = 'a,b\r', parts = []; for (var i = 0; i < 100000; i++) parts.push('n' + i + ',n' + (i + 1)); var text = s + parts.join('\r');
  var t0 = Date.now(), rows = I.parseDelimited(text, ','); var ms = Date.now() - t0;
  assert.strictEqual(rows.length, 100001); assert.ok(ms < 1500, 'took ' + ms + ' ms');
});

/* ---------------------------------------------------------------- 3. decimal marks and number words */
t('3a. a semicolon file with US decimals reads 3.5 as 3.5; with decimal commas it still reads 1,5 as 1.5', function () {
  assert.strictEqual(csv('from;to;weight\nA;B;3.5\nB;C;2.25\n').graph.edges[0].weight, 3.5);
  var r = csv('from;to;weight\nA;B;1,5\nB;C;2,25\n'); assert.deepStrictEqual(r.graph.edges.map(function (e) { return e.weight; }), [1.5, 2.25]);
  var r2 = csv('from;to;weight\nA;B;1.234,5\nB;C;1.234.567\n'); assert.deepStrictEqual(r2.graph.edges.map(function (e) { return e.weight; }), [1234.5, 1234567]);
});
t('3b. a tab file with 1,5 reads 1.5, and a thousands comma still reads as thousands', function () {
  assert.deepStrictEqual(csv('from\tto\tweight\nA\tB\t1,5\nB\tC\t2,25\n', 'x.tsv').graph.edges.map(function (e) { return e.weight; }), [1.5, 2.25]);
  assert.deepStrictEqual(csv('from\tto\tweight\nA\tB\t1,234\nB\tC\t2,500,000\nC\tD\t3.5\n', 'x.tsv').graph.edges.map(function (e) { return e.weight; }), [1234, 2500000, 3.5]);
  assert.strictEqual(csv('from,to,weight\nA,B,"1,234.50"\n').graph.edges[0].weight, 1234.5);
});
t('3c. 0x10, 0b11 and 0o7 are not numbers (they are counted as unreadable)', function () {
  var r = csv('from,to,weight\nA,B,0x10\nB,C,0b11\nC,D,0o7\nD,E,12\n');
  assert.deepStrictEqual(r.graph.edges.map(function (e) { return e.weight; }), [undefined, undefined, undefined, 12]);
  assert.ok(noteMatch(r, /3 weights were not numbers/));
  assert.ok(Number.isNaN(K.num('0x10')) && Number.isNaN(K.num('0b11')));
});
t('3d. the table reader and the column reader agree on how numbers are written', function () {
  var cases = ['12,5', '1 234', '1 234', '1 234,5', '1.234,5', '1,234.5', '1,234', '12', '-3.5', '+4', '.5', '5.', '1e3', '$12', '(300)', '12%', '12,25', '1234,5', 'abc', '', '1,2,3', '0x1f', '12 34', '1.2.3'];
  cases.forEach(function (c) {
    var r = csv('from,to,weight\nA,B,"' + c.replace(/"/g, '""') + '"\n'), w = r.graph.edges[0].weight, k = K.num(c);
    var a = w === undefined ? 'NaN' : String(w), b = Number.isNaN(k) ? 'NaN' : String(k);
    if (c === '') return;   // empty is "no weight", not a bad number
    assert.strictEqual(a, b, JSON.stringify(c) + ': table reader ' + a + ', column reader ' + b);
  });
  assert.strictEqual(K.num('12,5'), 12.5); assert.strictEqual(K.num('1 234'), 1234); assert.strictEqual(K.num('1,234'), 1234);
  // and on 4,000 random strings made of number-ish characters
  var s = 7, rnd = function () { return (s = (s * 16807) % 2147483647) / 2147483647; }, alpha = '0123456789012345678901234567890123456789..,,,  $%()-+eE\u00a0x', bad = [];
  for (var i = 0; i < 4000 && bad.length < 5; i++) {
    var len = 1 + Math.floor(rnd() * 9), c = ''; for (var j = 0; j < len; j++) c += alpha.charAt(Math.floor(rnd() * alpha.length));
    if (!c.trim() || /^[\s"]*$/.test(c)) continue;
    var r = csv('from,to,weight\nA,B,"' + c + '"\n'), w = r.graph.edges[0] && r.graph.edges[0].weight, k = K.num(c);
    var a = w === undefined ? 'NaN' : String(w), b = Number.isNaN(k) ? 'NaN' : String(k);
    if (a !== b) bad.push(JSON.stringify(c) + ' table ' + a + ' columns ' + b);
  }
  assert.deepStrictEqual(bad, []);
});

/* ---------------------------------------------------------------- 4. extension beats the arrow sniff */
t('4. a .csv file that is a table with a header is a table even when cells hold arrows; .txt and unknown files still read arrows', function () {
  var text = 'route,count\nNYC->LAX,5\nNYC->SFO,7\nBOS->LAX,3\n';
  assert.strictEqual(I.sniff(text, 'routes.csv'), 'table'); assert.strictEqual(I.sniff(text.replace(/,/g, '\t'), 'routes.tsv'), 'table');
  assert.strictEqual(I.sniff(text, 'routes.txt'), 'arrows'); assert.strictEqual(I.sniff(text, 'Pasted data'), 'arrows');
  assert.strictEqual(I.sniff('A -> B\nB -> C\nC -> D\n', 'g.csv'), 'arrows');   // no table at all
  assert.strictEqual(csv(text).kind, 'table');
});

/* ---------------------------------------------------------------- 5. matrices */
t('5a. a zero-filled matrix written with 0.00 / 0.0 cells has no links', function () {
  var r = csv(',A,B,C\nA,0.00,0.0,0\nB,0,0.00,0.000\nC,0.0,0,0.00\n'); assert.strictEqual(r.graph.edges.length, 0);
  var r2 = csv(',A,B,C\nA,0.00,1.50,0\nB,0,0.00,2\nC,0.0,0,0.00\n'); assert.strictEqual(r2.graph.edges.length, 2); assert.strictEqual(r2.graph.edges[0].weight, 1.5);
});
t('5b. from,to,weight with numeric ids and two data rows is an edge list, not a matrix', function () {
  var r = csv('from,to,weight\n1,2,5\n3,4,7\n'); assert.strictEqual(r.graph.edges.length, 2); assert.deepStrictEqual(ids(r.graph), ['1', '2', '3', '4']); assert.strictEqual(r.graph.edges[1].weight, 7);
  var r2 = csv('1,2,5\n3,4,7\n5,6,9\n'); assert.strictEqual(r2.graph.edges.length, 3);
  var r3 = csv(',a,b,c\na,0,1,1\nb,0,0,1\nc,0,0,0\n'); assert.strictEqual(r3.graph.edges.length, 3);   // a real matrix whose names look like column roles
  var r4 = csv(',1,2,3\n1,0,1,1\n2,0,0,1\n3,0,0,0\n'); assert.strictEqual(r4.graph.edges.length, 3);
});

/* ---------------------------------------------------------------- 6. JSON drops data */
t('6a. JSON weights written as text use the table number reader and are counted when unreadable', function () {
  var r = I.importJSON(JSON.stringify({ nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], links: [{ source: 'a', target: 'b', weight: '1,234.50' }, { source: 'b', target: 'c', weight: 'lots' }, { source: 'a', target: 'c', weight: '0x10' }] }), 'j', {});
  assert.deepStrictEqual(r.graph.edges.map(function (e) { return e.weight; }), [1234.5, undefined, undefined]);
  assert.ok(noteMatch(r, /2 weights were not numbers/), r.report.notes.join(' | '));
});
t('6b. extra fields on JSON links are kept (year, note), node size and color are kept', function () {
  var r = I.importJSON(JSON.stringify({ nodes: [{ id: 'a', size: 5, color: 'red', pop: 3 }, { id: 'b' }], links: [{ source: 'a', target: 'b', weight: 2, year: 2020, note: 'x', meta: { deep: 1 } }] }), 'j', {});
  assert.strictEqual(r.graph.edges[0].attrs.year, 2020); assert.strictEqual(r.graph.edges[0].attrs.note, 'x'); assert.ok(!has(r.graph.edges[0].attrs, 'meta')); assert.ok(!has(r.graph.edges[0].attrs, 'source'));
  assert.strictEqual(r.graph.nodes[0].attrs.size, 5); assert.strictEqual(r.graph.nodes[0].attrs.color, 'red'); assert.strictEqual(r.graph.nodes[0].attrs.pop, 3);
  assert.strictEqual(r.graph.edges[0].weight, 2);
});
t('6c. null and non-link entries in link or item lists make no items called "null" or "undefined" and are mentioned', function () {
  var shapes = [
    { nodes: [{ id: 'a' }, { id: 'b' }], links: [null, { foo: 1 }, 7, [null, 'b'], { source: 'a', target: 'b' }] },
    { links: [null, { foo: 1 }, [null, 'b'], { source: 'a', target: 'b' }] },
    { nodes: [null, { id: 'a' }, true, { foo: 1 }], links: [] },
    { elements: { nodes: [{ data: { id: 'a' } }, { data: { id: 'b' } }], edges: [null, { data: { source: 'a', target: 'b' } }] } }
  ];
  shapes.forEach(function (s, i) {
    var r = I.importJSON(JSON.stringify(s), 'j', {});
    assert.ok(ids(r.graph).indexOf('null') < 0 && ids(r.graph).indexOf('undefined') < 0 && ids(r.graph).indexOf('true') < 0, 'shape ' + i + ': ' + ids(r.graph));
    assert.ok(noteMatch(r, /skipped|dropped/), 'shape ' + i + ' says nothing: ' + r.report.notes.join(' | '));
  });
  var r0 = I.importJSON(JSON.stringify(shapes[0]), 'j', {}); assert.strictEqual(r0.graph.edges.length, 1);
});

/* ---------------------------------------------------------------- 7. "JSON (everything)" round trip */
t('7. what the export button writes is read back whole, even with no states, calc or roles', function () {
  var graph = { name: 'Trip', start: 'A', flavor: 'story', nodes: [
    { id: 'A', label: 'The start', group: 'g1', valence: '', ghost: false, attrs: { cost: '10', n: 5 } },
    { id: 'B', label: 'B', group: '', valence: 'good', ghost: false, attrs: {} },
    { id: 'C', label: 'C', group: '', valence: '', ghost: true, attrs: {} }],
  edges: [{ from: 'A', to: 'B', label: 'go', weight: 2.5, kind: 'k', attrs: { year: '2020' } }, { from: 'A', to: 'C', label: '', kind: '', attrs: {} }] };
  var S = { graph: graph };   // the exact shape of src/app/70-export.js
  var text = JSON.stringify({ name: S.graph.name, start: S.graph.start, flavor: S.graph.flavor, calc: S.graph.calc, roles: S.graph.roles, states: S.graph.states, nodes: S.graph.nodes, edges: S.graph.edges }, null, 1);
  var r = I.importAny([{ name: 'Trip.json', text: text }]), g = r.graph;
  assert.strictEqual(g.start, 'A'); assert.strictEqual(g.flavor, 'story'); assert.strictEqual(g.name, 'Trip');
  assert.strictEqual(g.nodes[2].ghost, true); assert.ok(!has(g.nodes[2].attrs, 'ghost'));
  assert.strictEqual(g.nodes[0].attrs.cost, '10'); assert.strictEqual(g.nodes[0].attrs.n, 5); assert.strictEqual(g.nodes[1].valence, 'good'); assert.strictEqual(g.nodes[0].group, 'g1'); assert.strictEqual(g.nodes[0].label, 'The start');
  assert.strictEqual(g.edges[0].attrs.year, '2020'); assert.strictEqual(g.edges[0].weight, 2.5); assert.strictEqual(g.edges[0].label, 'go'); assert.strictEqual(g.edges[0].kind, 'k');
  assert.strictEqual(r.report.ghosts, 1);
  // twice around gives the same thing
  var again = I.importAny([{ name: 'Trip.json', text: JSON.stringify(g) }]).graph; assert.deepStrictEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(g)));
  // a graph without any items is not claimed, and a marker is honored
  var m = I.importJSON(JSON.stringify({ format: 'net-flow-map', name: 'M', start: 'x', nodes: [{ id: 'x' }], edges: [] }), 'm', {}); assert.strictEqual(m.graph.start, 'x');
});

/* ---------------------------------------------------------------- 8. Excel phonetic text */
t('8. phonetic guides in Excel text are ignored (shared strings and inline strings)', function () {
  var sst = xml('<si><t>東京</t><rPh sb="0" eb="2"><t>トウキョウ</t></rPh><phoneticPr fontId="1"/></si><si><r><t>A</t></r><r><t>B</t></r><rPh sb="0" eb="1"><t>x</t></rPh></si>');
  var sheet = '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>日本</t><rPh sb="0" eb="2"><t>ニホン</t></rPh></is></c></row></sheetData></worksheet>';
  var out = I.xlsxSheets({ 'xl/sharedStrings.xml': sst, 'xl/workbook.xml': '<workbook><sheets><sheet name="S" sheetId="1"/></sheets></workbook>', 'xl/worksheets/sheet1.xml': sheet });
  assert.strictEqual(out[0].csv, '東京,AB,日本');
});

/* ---------------------------------------------------------------- 9. silent losses in the table path */
t('9a. two different 450-character names that share their first 399 characters stay two items (and a link is not lost)', function () {
  var p = new Array(451).join('x'), a = p + 'A', b = p + 'B';
  var r = csv('from,to\n' + a + ',' + b + '\n' + b + ',' + a + '\n' + a + ',' + b + '\n');
  assert.strictEqual(r.graph.nodes.length, 2, 'items ' + r.graph.nodes.length); assert.strictEqual(r.graph.edges.length, 2);
  assert.ok(r.graph.nodes[0].id !== r.graph.nodes[1].id); assert.ok(r.graph.nodes.every(function (n) { return n.id.length <= 400; }));
  assert.ok(noteMatch(r, /shortened/));
  assert.ok(r.graph.edges.every(function (e) { return ids(r.graph).indexOf(e.from) >= 0 && ids(r.graph).indexOf(e.to) >= 0; }));
});
t('9b. a list with no header row (alice,bob / bob,carol / carol,dave) keeps its first link; a real header is still a header', function () {
  var r = csv('alice,bob\nbob,carol\ncarol,dave\n'); assert.strictEqual(r.graph.edges.length, 3); assert.deepStrictEqual(ids(r.graph).slice(0, 2), ['alice', 'bob']); assert.ok(noteMatch(r, /no header row/));
  var h = csv('person,friend\nalice,bob\nbob,carol\n'); assert.strictEqual(h.graph.edges.length, 2); assert.ok(noteMatch(h, /header row/) && noteMatch(h, /person, friend|"person"/), h.report.notes.join(' | '));
  assert.strictEqual(csv('from,to\nA,B\nB,C\n').graph.edges.length, 2);
});
t('9c. an unterminated quote is reported', function () {
  var r = csv('"x,1\ny,2\nz,3\n'); assert.ok(noteMatch(r, /quote was never closed/), r.report.notes.join(' | '));
  assert.ok(!noteMatch(csv('a,b\n"x",1\n'), /quote/));
  var rows = I.parseDelimited('a,b\n"x,1\ny,2\n', ','); assert.strictEqual(I.importTable(rows, I.guessMapping(rows), 't', {}).report.notes.some(function (x) { return /quote was never closed/.test(x); }), true);
});
t('9d. columns past the 40th extra column are reported', function () {
  var head = ['from', 'to'], row = ['A', 'B']; for (var i = 1; i <= 45; i++) { head.push('c' + i); row.push('v' + i); }
  var r = csv(head.join(',') + '\n' + row.join(',') + '\n'); assert.strictEqual(Object.keys(r.graph.edges[0].attrs).length, 40);
  assert.ok(noteMatch(r, /40 extra columns/), r.report.notes.join(' | '));
  var few = csv('from,to,c1\nA,B,1\n'); assert.ok(!noteMatch(few, /40 extra columns/));
});
t('9e. duplicate headers are made unique and reported', function () {
  var r = csv('from,to,v,v\nA,B,1,2\n'); var at = r.graph.edges[0].attrs;
  assert.strictEqual(at.v, '1'); assert.strictEqual(at['v 2'], '2'); assert.ok(noteMatch(r, /"v 2"/), r.report.notes.join(' | '));
  var r2 = csv('from,to,column 3,\nA,B,1,2\n'); assert.deepStrictEqual(Object.keys(r2.graph.edges[0].attrs).sort(), ['column 3', 'column 4']);
});

/* ---------------------------------------------------------------- 10. sanitizeGraph speed */
t('10. sanitizeGraph with states and 20,000 items takes well under half a second and keeps the values', function () {
  var nodes = [], edges = [], n = 20000;
  for (var i = 0; i < n; i++) nodes.push({ id: 'n' + i, label: 'n' + i, vals: [i, i + 1] });
  for (i = 1; i < n; i++) edges.push({ from: 'n' + (i - 1), to: 'n' + i, vals: [1, 2] });
  var t0 = Date.now(), g = I.sanitizeGraph({ name: 'big', nodes: nodes, edges: edges, states: { names: ['a', 'b'] } }), ms = Date.now() - t0;
  assert.ok(ms < 500, 'took ' + ms + ' ms'); assert.deepStrictEqual(g.nodes[19999].vals, [19999, 20000]); assert.deepStrictEqual(g.edges[5].vals, [1, 2]); assert.strictEqual(g.nodes.length, n);
});

/* ---------------------------------------------------------------- 11. smaller */
t('11a. round(1.005, 2) is 1.01 and ordinary rounding is unchanged', function () {
  function r(x, d) { return K.compile('round(' + x + ',' + d + ')').fn(function () { return NaN; }); }
  assert.strictEqual(r(1.005, 2), 1.01); assert.strictEqual(r(2.675, 2), 2.68); assert.strictEqual(r(1.255, 2), 1.26); assert.strictEqual(r(3.14159, 3), 3.142);
  assert.strictEqual(r(2.5, 0), 3); assert.strictEqual(r(1234.5678, 0), 1235); assert.strictEqual(r(1e-7, 2), 0); assert.strictEqual(r(1234, -2), 1200);
});
t('11b. a [[link]] that fits two notes with the same name is reported', function () {
  var r = I.importNotes([{ name: 'Index.md', path: 'a/Index.md', text: 'x' }, { name: 'Index.md', path: 'b/Index.md', text: 'y' }, { name: 'Home.md', path: 'Home.md', text: 'see [[Index]] and [[a/Index]]' }], 'n', {});
  assert.ok(noteMatch(r, /more than one note/), r.report.notes.join(' | '));
  var ok = I.importNotes([{ name: 'Index.md', path: 'Index.md', text: 'x' }, { name: 'Home.md', path: 'Home.md', text: '[[Index]]' }], 'n', {});
  assert.ok(!noteMatch(ok, /more than one note/));
});

console.log(fails ? '\nimport-fixes: ' + fails + ' FAILED, ' + passes + ' passed' : '\nimport-fixes: all ' + passes + ' checks passed');
process.exit(fails ? 1 : 0);

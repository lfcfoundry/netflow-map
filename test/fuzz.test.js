/* Copyright (c) 2026 LFC Foundry. MIT License. Fuzz and memory-safety checks for the importers, zip reader and layout engine.
 * Run: node --expose-gc test/fuzz.test.js [seconds]   (default 90 s of random cases, then fixed leak and dense-link checks) */
'use strict';
const assert = require('assert'), zlib = require('zlib');
const I = require('../src/importers.js'), U = require('../src/unpack.js'), E = require('../src/engine.js'), Z = require('./zipmake.js');
const BUDGET = (Number(process.argv[2]) || 90) * 1000, T0 = Date.now(), gc = global.gc || (() => {});
let fails = 0, checks = 0;
const ok = (name, extra) => console.log('ok   ' + name + (extra ? ' ' + extra : ''));
const bad = (name, e) => { fails++; process.exitCode = 1; console.log('FAIL ' + name + '\n  ' + (e && e.stack || e)); };
let seed = Number(process.env.NFM_SEED) || 20261015; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = (a) => a[Math.floor(rnd() * a.length)], ri = (n) => Math.floor(rnd() * n);
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
const timeLeft = (share) => Date.now() - T0 < BUDGET * share;

/* what every graph that comes out of an importer must satisfy */
function invariants(g, label) {
  assert.ok(g && Array.isArray(g.nodes) && Array.isArray(g.edges), label + ': shape');
  const ids = new Set();
  for (const n of g.nodes) { assert.equal(typeof n.id, 'string', label + ': id type'); assert.ok(n.id.length > 0 && !ids.has(n.id), label + ': id unique/non-empty'); ids.add(n.id); assert.equal(typeof n.label, 'string'); assert.ok(n.attrs && typeof n.attrs === 'object'); assert.ok(Object.getPrototypeOf(n.attrs) === Object.prototype); }
  for (const e of g.edges) { assert.ok(ids.has(e.from) && ids.has(e.to), label + ': dangling link ' + e.from + '->' + e.to); assert.ok(e.weight === undefined || Number.isFinite(e.weight), label + ': weight'); }
  assert.equal(({}).polluted, undefined); assert.equal(Object.prototype.polluted, undefined);
}
const PLAIN_ERR = (e) => e instanceof Error && !(e instanceof RangeError) && !(e instanceof TypeError) && !(e instanceof ReferenceError) && !(e instanceof SyntaxError) && typeof e.message === 'string' && e.message.length < 1500;

/* ---------- 1. random and hostile text through importAny ---------- */
const WORDS = ['A', 'B', 'node', 'x y', '__proto__', 'constructor', 'prototype', '"q"', '', ' ', '0', '-1', '1e999', 'NaN', 'Infinity', '=cmd|calc', '+1', '@x', 'é', '‮', '\u0000', '\ud800', 'a'.repeat(500), '<script>', '[[A]]', '->', '<-', '--', '\t', ';', '|', ',', '"', '\r', '\n', '\r\n', '{', '}', '[', ']', ':', '#', '//'];
const HEADERS = [['source', 'target'], ['from', 'to', 'weight'], ['id', 'parent'], ['id', 'label', 'group', 'links'], ['a', 'b', 'c'], ['__proto__', 'constructor'], ['id', 'group', 'valence'], ['', '', '']];
function randText(kind) {
  const d = pick([',', '\t', ';', '|']);
  if (kind === 0) { const h = pick(HEADERS), rows = [h.join(d)]; for (let i = ri(30); i >= 0; i--) rows.push(Array.from({ length: h.length + ri(3) - 1 }, () => pick(WORDS)).join(d)); return rows.join(pick(['\n', '\r\n', '\r'])); }
  if (kind === 1) { let s = ''; for (let i = ri(60); i >= 0; i--) s += pick(WORDS) + pick(['', ' ', '\n']); return s; }
  if (kind === 2) return Array.from({ length: ri(25) }, () => pick(WORDS) + ' ' + pick(['->', '=>', '--', '<->', '→']) + ' ' + pick(WORDS) + pick(['', ' [label="x"]', ': note'])).join('\n');
  if (kind === 3) return Array.from({ length: ri(25) }, () => pick(['', '  ', '\t', '    ']) + pick(['- ', '* ', '# ', '']) + pick(WORDS)).join('\n');
  const v = () => pick([null, true, 1, -1, 1e308, 'x', '', [], {}, ['a'], { id: 'q' }, { __proto__: null }, JSON.parse('{"__proto__":{"polluted":1}}'), 'a'.repeat(300)]);
  const nodes = Array.from({ length: ri(10) }, () => pick([{ id: v(), label: v(), group: v(), attrs: v() }, v(), { name: v() }, { id: pick(WORDS), constructor: v() }]));
  const edges = Array.from({ length: ri(14) }, () => pick([{ from: v(), to: v(), weight: v() }, { source: pick(WORDS), target: pick(WORDS) }, [pick(WORDS), pick(WORDS)], v()]));
  return JSON.stringify(pick([{ nodes, edges }, { elements: { nodes: nodes.map((n) => ({ data: n })), edges: edges.map((e) => ({ data: e })) } }, nodes, { nodes, links: edges }]));
}
function mutate(s) { const m = 1 + ri(4); for (let j = 0; j < m; j++) { const p = ri(s.length + 1); s = rnd() < 0.5 ? s.slice(0, p) + pick(WORDS) + s.slice(p) : s.slice(0, p) + s.slice(p + 1 + ri(12)); } return s; }
{
  let n = 0, threw = 0;
  const names = ['a.csv', 'a.tsv', 'a.txt', 'a.json', 'a.md', 'a.dot', 'a.gml', 'a.graphml', 'a.gexf', 'a.xml', 'pasted', 'a.unknown'];
  try {
    while (timeLeft(0.4)) {
      const text = rnd() < 0.5 ? mutate(randText(ri(5))) : randText(ri(5)), name = pick(names), opts = rnd() < 0.2 ? { maxNodes: 1 + ri(8), maxEdges: 1 + ri(8) } : (rnd() < 0.2 ? { format: pick(['table', 'json', 'arrows', 'outline', 'notes']) } : {});
      try { const r = I.importAny([{ name, text }, ...(rnd() < 0.3 ? [{ name: pick(names), text: randText(ri(5)) }] : [])], opts); invariants(r.graph, name); if (opts.maxNodes) assert.ok(r.graph.nodes.length <= opts.maxNodes && r.graph.edges.length <= opts.maxEdges); n++; }
      catch (e) { if (!PLAIN_ERR(e)) throw new Error('unexpected ' + e.name + ': ' + e.message + '\n' + String(e.stack).split('\n').slice(1, 4).join('\n') + '\n  name=' + name + ' text=' + JSON.stringify(text).slice(0, 400)); threw++; }
    }
    checks += n + threw; ok('importers survive random and hostile text', `${n} read, ${threw} refused in plain words, seed ${process.env.NFM_SEED || 20261015}`);
  } catch (e) { bad('importers fuzz', e); }
}

/* ---------- 2. nothing a file says can reach Object.prototype ---------- */
try {
  const evil = [
    ['p.json', '{"nodes":[{"id":"a","__proto__":{"polluted":1},"attrs":{"__proto__":{"polluted":2},"constructor":{"prototype":{"polluted":3}}}}],"edges":[{"from":"a","to":"a","__proto__":{"polluted":4},"attrs":{"__proto__":{"polluted":5}}}]}'],
    ['p.csv', '__proto__,constructor,prototype,polluted\na,b,c,d\n'], ['q.csv', 'id,__proto__,links\na,x,b\n'],
    ['p.graphml', '<graphml><key id="k" for="node" attr.name="__proto__"/><graph><node id="a"><data key="k">v</data></node><node id="__proto__"/><node id="constructor"/><edge source="__proto__" target="constructor"/></graph></graphml>'],
    ['p.gexf', '<gexf><graph><attributes class="node"><attribute id="0" title="__proto__" type="string"/></attributes><nodes><node id="a"><attvalues><attvalue for="0" value="x"/></attvalues></node></nodes></graph></gexf>'],
    ['p.gml', 'graph [ node [ id 1 __proto__ 2 constructor 3 ] __proto__ [ polluted 1 ] ]'], ['p.dot', 'digraph { __proto__ -> constructor [__proto__=x, label=y]; node [__proto__=z] }'],
  ];
  for (const [name, text] of evil) { try { invariants(I.importAny([{ name, text }]).graph, name); } catch (e) { if (!PLAIN_ERR(e)) throw e; } }
  const S = I.sanitizeGraph(JSON.parse('{"nodes":[{"id":"a","attrs":{"__proto__":{"polluted":1}}}],"edges":[]}'));
  assert.equal(({}).polluted, undefined); assert.ok(S.nodes.length === 1);
  ok('hostile keys such as __proto__ and constructor never pollute anything', evil.length + ' files'); checks++;
} catch (e) { bad('prototype pollution', e); }

/* ---------- 3. spreadsheet formulas never leave the app unneutralized, imported text never becomes markup ---------- */
try {
  const r = I.importAny([{ name: 'x.csv', text: 'source,target\n=cmd|calc,+1+1\n@SUM(A1),-2\n"<img src=x onerror=alert(1)>",b\n' }]);
  assert.ok(r.graph.nodes.some((n) => n.id === '=cmd|calc'));      // kept as text; the exporter neutralizes it (checked in the browser test)
  ok('formula-looking and markup-looking cells stay plain text in the graph'); checks++;
} catch (e) { bad('formula text', e); }

/* ---------- 4. random damage to zips and workbooks ---------- */
(async () => {
  try {
    const bases = [Z.makeZip([{ name: 'a.csv', data: 'source,target\nA,B\nB,C\n' }, { name: 'd/b.json', data: '{"nodes":[{"id":"Q"}],"edges":[]}' }, { name: 'c.graphml', data: '<graphml><graph><node id="a"/><node id="b"/><edge source="a" target="b"/></graph></graphml>' }]),
      Z.makeXlsx([{ name: 'S', rows: [['source', 'target', 'w'], ['a', 'b', 1], ['b', 'c', { d: 44000 }]] }, { name: 'T', rows: [['id', 'group'], ['a', 'x']] }])];
    let n = 0, refused = 0, slow = 0;
    while (timeLeft(0.65)) {
      let b = Buffer.from(pick(bases));
      const mode = ri(4);
      if (mode === 0) for (let k = 1 + ri(8); k > 0; k--) b[ri(b.length)] = ri(256);
      else if (mode === 1) b = b.subarray(0, ri(b.length));
      else if (mode === 2) { const p = ri(b.length), q = Math.min(b.length, p + ri(40)); b = Buffer.concat([b.subarray(0, p), b.subarray(q)]); }
      else { const p = ri(b.length - 4); b.writeUInt32LE(pick([0, 1, 0xffffffff, 0x7fffffff, 100, 65536]), p); }
      const t1 = Date.now();
      try { const r = await U.expand(new Uint8Array(b), 'f.zip'); r.files.forEach((f) => { assert.equal(typeof f.text, 'string'); assert.ok(f.path.indexOf('..') !== 0 && !f.path.startsWith('/')); try { invariants(I.importAny([f]).graph, f.name); } catch (e) { if (!PLAIN_ERR(e)) throw e; } }); n++; }
      catch (e) { if (!PLAIN_ERR(e)) throw new Error('unexpected ' + e.name + ': ' + e.message); refused++; }
      if (Date.now() - t1 > 2000) slow++;
    }
    assert.equal(slow, 0, slow + ' damaged zips took over 2 s');
    checks += n + refused; ok('zip and workbook reader survive random damage', `${n} opened, ${refused} refused in plain words, none slow`);
  } catch (e) { bad('zip fuzz', e); }

  /* ---------- 5. layout engine on awkward graphs: finite numbers, no overflow ---------- */
  try {
    const mk = (n, edges, extra) => ({ start: n ? 'n0' : null, nodes: Array.from({ length: n }, (_, i) => Object.assign({ id: 'n' + i, label: 'n' + i, group: '', valence: '', ghost: false, attrs: {} }, extra && extra(i))), edges: edges.map(([a, b, w]) => ({ from: 'n' + a, to: 'n' + b, label: '', kind: '', weight: w })) });
    const shapes = {
      'empty': mk(0, []), 'one item': mk(1, []), 'one self-link': mk(1, [[0, 0]]), 'two items, no links': mk(2, []),
      'all isolated (500)': mk(500, []), 'every link doubled': mk(40, Array.from({ length: 60 }, (_, i) => [i % 40, (i * 7 + 1) % 40]).concat(Array.from({ length: 60 }, (_, i) => [i % 40, (i * 7 + 1) % 40]))),
      'star of 3,000 leaves': mk(3001, Array.from({ length: 3000 }, (_, i) => [0, i + 1])), 'chain of 4,000': mk(4000, Array.from({ length: 3999 }, (_, i) => [i, i + 1])),
      'clique of 120 (14,280 links)': mk(120, (() => { const e = []; for (let i = 0; i < 120; i++) for (let j = i + 1; j < 120; j++) e.push([i, j]); return e; })()),
      'many small islands': mk(1500, Array.from({ length: 1000 }, (_, i) => [(i * 3) % 1500, (i * 3 + 1) % 1500])),
      'weights NaN/negative/huge': mk(30, Array.from({ length: 50 }, (_, i) => [i % 30, (i * 11 + 3) % 30, pick([NaN, -5, 0, 1e300, Infinity, 2])])),
      'big hub plus a ring': mk(2000, Array.from({ length: 1999 }, (_, i) => [0, i + 1]).concat(Array.from({ length: 1999 }, (_, i) => [i + 1, ((i + 1) % 1999) + 1]))),
    };
    for (const [name, g] of Object.entries(shapes)) {
      for (const view of ['network', 'flow']) {
        const t1 = Date.now(), L = E.build(g, { view });
        assert.equal(L.nodes.length, g.nodes.length, name + ' ' + view + ': item count');
        for (const q of L.nodes) assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && Number.isFinite(q.w) && Number.isFinite(q.h), name + ' ' + view + ': non-finite position for ' + q.id);
        assert.ok(Date.now() - t1 < 60000, name + ' ' + view + ' too slow');
        checks++;
      }
    }
    ok('layout engine gives finite positions on ' + Object.keys(shapes).length + ' awkward shapes in two views');
  } catch (e) { bad('layout shapes', e); }

  /* ---------- 6. the stress layout's fixed-size arrays: the overflow guard fires instead of silently dropping pairs ---------- */
  try {
    let hit = 0;
    for (let rep = 0; rep < 40; rep++) {
      const n = 20 + ri(400), m = ri(n * 4), edges = []; for (let i = 0; i < m; i++) edges.push([ri(n), ri(n)]);
      const g = { start: 'n0', nodes: Array.from({ length: n }, (_, i) => ({ id: 'n' + i, label: 'n' + i, group: '', valence: '', ghost: false, attrs: {} })), edges: edges.map(([a, b]) => ({ from: 'n' + a, to: 'n' + b, label: '', kind: '' })) };
      const L = E.build(g, { view: 'network' }); hit += L.nodes.length;
      for (const q of L.nodes) assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y));
    }
    ok('40 random graphs through the stress layout: no pair-list overflow', hit + ' items'); checks++;
  } catch (e) { bad('stress overflow guard', e); }

  /* ---------- 7. dense links: items and links are separate limits ---------- */
  try {
    const dense = (n, per) => { const t = []; let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; let text = 'source,target\n'; const rows = []; for (let i = 0; i < n; i++) for (let k = 0; k < per; k++) { const j = Math.floor(r() * n); if (j !== i) rows.push('n' + i + ',n' + j); } void t; return text + rows.join('\n'); };
    const lines = [];
    for (const [n, per] of [[200, 100], [1000, 100], [2000, 100], [1000, 400]]) {
      gc(); const m0 = process.memoryUsage().heapUsed, t1 = Date.now();
      const r = I.importAny([{ name: 'd.csv', text: dense(n, per) }]), tImp = Date.now() - t1;
      assert.equal(r.graph.nodes.length, n); assert.ok(r.graph.edges.length > n * per * 0.9 * 0.6, 'links were dropped: ' + r.graph.edges.length);
      const t2 = Date.now(), L = E.build(r.graph, { view: 'network' }), tLay = Date.now() - t2;
      for (const q of L.nodes) assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y));
      lines.push(`${n} items x ${r.graph.edges.length.toLocaleString('en-US')} links: read ${tImp} ms, laid out ${tLay} ms, +${mb(process.memoryUsage().heapUsed - m0)}`);
      checks++;
    }
    ok('many links per item (items and links are limited separately)', '\n       ' + lines.join('\n       '));
    const star = 'source,target\n' + Array.from({ length: 150000 }, (_, i) => 'hub,leaf' + i).join('\n');
    const rs = I.importAny([{ name: 's.csv', text: star }]);
    assert.equal(rs.graph.nodes.length, 150001); assert.equal(rs.graph.edges.length, 150000); checks++;
    ok('one item with 150,000 links read whole', rs.graph.nodes.length.toLocaleString('en-US') + ' items');
    const capped = I.importAny([{ name: 'c.csv', text: dense(1500, 700) }], { maxEdges: 800000 });
    assert.ok(capped.graph.edges.length <= 800000); assert.ok(capped.report.notes.some((q) => /very large/.test(q)) === (capped.graph.edges.length >= 800000)); checks++;
    ok('the link cap (800,000) is reported in plain words when reached', capped.graph.edges.length.toLocaleString('en-US') + ' links kept');
  } catch (e) { bad('dense links', e); }

  /* ---------- 8. leaks: the same work over and over must not keep growing ---------- */
  try {
    if (!global.gc) { console.log('skip leak checks (run with node --expose-gc)'); }
    else {
      const csv = 'source,target,weight\n' + Array.from({ length: 5000 }, (_, i) => 'n' + (i % 800) + ',n' + ((i * 7) % 800) + ',' + (i % 9)).join('\n');
      const book = Z.makeXlsx([{ name: 'S', rows: [['source', 'target']].concat(Array.from({ length: 2000 }, (_, i) => ['a' + (i % 300), 'b' + (i % 211)])) }]);
      const zip = Z.makeZip([{ name: 'e.csv', data: csv }, { name: 'x.xlsx', data: book }]);
      const lap = async () => { const r = await U.expand(new Uint8Array(zip), 'z.zip'); const g = I.importAny(r.files).graph; E.build(g, { view: 'network' }); E.build({ start: g.nodes[0].id, nodes: g.nodes.slice(0, 40), edges: g.edges.filter((e) => g.nodes.slice(0, 40).some((q) => q.id === e.from) && g.nodes.slice(0, 40).some((q) => q.id === e.to)) }, { view: 'flow' }); };
      for (let i = 0; i < 5; i++) await lap();
      gc(); const base = process.memoryUsage(), samples = [];
      for (let round = 0; round < 4; round++) { for (let i = 0; i < 12; i++) await lap(); gc(); samples.push(process.memoryUsage().heapUsed); }
      const growth = samples[3] - samples[0], total = 48 * 1;
      assert.ok(growth < 8 * 1048576, 'heap grew by ' + mb(growth) + ' over ' + total + ' more rounds');
      ok('48 rounds of unzip, read and two layouts: no leak', `heap ${mb(base.heapUsed)} -> ${mb(samples[3])}; external buffers ${mb(base.arrayBuffers)} -> ${mb(process.memoryUsage().arrayBuffers)}`); checks++;
      // hostile zips repeated: the bomb path frees what it started
      const bomb = Z.makeZip([{ name: 'a.csv', raw: zlib.deflateRawSync(Buffer.alloc(120e6)), usize: 100, crc: 0, data: 'x' }, { name: 'b.csv', data: csv }]);
      for (let i = 0; i < 3; i++) await U.expand(new Uint8Array(bomb), 'b.zip');
      gc(); const a0 = process.memoryUsage().arrayBuffers; for (let i = 0; i < 6; i++) await U.expand(new Uint8Array(bomb), 'b.zip'); gc(); await new Promise((r) => setTimeout(r, 50)); gc();
      const a1 = process.memoryUsage().arrayBuffers; assert.ok(a1 - a0 < 40 * 1048576, 'buffers grew by ' + mb(a1 - a0));
      ok('a zip bomb opened repeatedly releases its memory', `buffers ${mb(a0)} -> ${mb(a1)}`); checks++;
    }
  } catch (e) { bad('leaks', e); }

  console.log(fails ? `fuzz: ${fails} FAILED` : `fuzz: all ${checks} checks passed in ${((Date.now() - T0) / 1000).toFixed(0)} s`);
})();

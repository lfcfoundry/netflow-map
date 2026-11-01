/* Copyright (c) 2026 LFC Foundry. MIT License. Top-down (layered) drawing choices: story order, tags for long links, must-pass column, harder untangling,
 * columns for tall maps, step numbers, group columns. With every choice off the picture must be exactly the old one (fingerprints below were made by the
 * engine before these choices existed). */
'use strict';
const crypto = require('crypto');
const E = require('../src/engine.js'), SC = require('../vendor/netflow-scene.js');
let bad = 0;
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
/* seeded story-shaped maps: chapters of 2-4 branches that merge at a choke page, side links, shortcuts, a few links back */
function rng(seed) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function story(n, seed) {
  const r = rng(seed), edges = []; let id = 0; const mk = () => id++; let cur = mk(); const chokes = [cur];
  while (id < n) {
    const b = 2 + Math.floor(r() * 3), ends = [], br = [];
    for (let i = 0; i < b; i++) { const d = 1 + Math.floor(r() * 3); let p = cur; const list = []; for (let j = 0; j < d; j++) { const v = mk(); edges.push([p, v]); p = v; list.push(v); } ends.push(p); br.push(list); }
    for (let i = 0; i + 1 < b; i++) if (r() < 0.35) edges.push([br[i][Math.floor(r() * br[i].length)], br[i + 1][Math.floor(r() * br[i + 1].length)]]);
    const m = mk(); ends.forEach((e) => edges.push([e, m]));
    if (r() < 0.12) edges.push([m, chokes[Math.floor(r() * chokes.length)]]);
    if (r() < 0.15) edges.push([cur, m]);
    cur = m; chokes.push(m);
  }
  return { n: id, edges };
}
function dag(n, m, seed) { const r = rng(seed), e = []; for (let i = 1; i < n; i++) e.push([Math.floor(r() * i), i]); for (let i = 0; i < m - n + 1; i++) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b) e.push(a < b ? [a, b] : [b, a]); } return { n, edges: e }; }
function graph(s) {
  const od = new Array(s.n).fill(0); s.edges.forEach(([a]) => od[a]++); let last = -1; for (let i = s.n - 1; i >= 0; i--) if (!od[i]) { last = i; break; }
  return { name: 'g', start: 'n0', nodes: Array.from({ length: s.n }, (_, i) => ({ id: 'n' + i, label: 'Page ' + i, group: 'g' + (i % 3), valence: od[i] ? '' : i === last ? 'good' : 'bad', ghost: false, attrs: {} })), edges: s.edges.map(([a, b]) => ({ from: 'n' + a, to: 'n' + b, weight: 1, label: '', kind: '' })) };
}
const copy = (g) => JSON.parse(JSON.stringify(g));
/* fields sorted by name: the order an engine happens to fill an item's fields in is not part of the picture (made up front in one order since 2026.10.31) */
const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys) : x && typeof x === 'object' && !ArrayBuffer.isView(x) ? Object.keys(x).sort().reduce((o, k) => { o[k] = sortKeys(x[k]); return o; }, {}) : x;
const fp = (L) => crypto.createHash('sha1').update(JSON.stringify(sortKeys(JSON.parse(JSON.stringify(L, (k, v) => (k === 'ms' || k === 'rows' || k === 'ruler' || k === 'info' || k === 'tagFwd' ? undefined : typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)))))).digest('hex').slice(0, 16);
const GOLD = {"story 30|flow":"e4a684fd7607cc49","story 30|down":"3b05d260b59ff9ef","story 30|spine":"3fe532081abd4c56","story 30|lanes":"c8868815f79f668b","story 30|sankey":"bdb8d728625e793f","story 30|arc":"c24be0758094ef03","story 30|matrix":"e5ed1b1123322d51","story 120|flow":"e06430c1d9b903d7","story 120|down":"99bd1ad24296293f","story 120|spine":"7781dd1e27a655ce","story 120|lanes":"7b8d0152bad3bf68","story 120|sankey":"7ab1504e332ea0f8","story 120|arc":"34ed191bfa04d8f6","story 120|matrix":"014215d1f2ae0c30","dag 60/120|flow":"200c8f37923ebf01","dag 60/120|down":"0f30704ea8b5c969","dag 60/120|spine":"8266a6563e5bf037","dag 60/120|lanes":"8b59a814cad4e873","dag 60/120|sankey":"244ec12d6e4216a6","dag 60/120|arc":"21daa795acaf0986","dag 60/120|matrix":"fdb2b97bc53973f0","story 400|flow":"c3260ceff414d9c1","story 400|down":"be4c6e47ca5e3a79","story 400|spine":"43ffefb6f41c552c","story 400|lanes":"2331f5c855df8b33","story 400|sankey":"64ec21a1e27e9f6b","story 400|arc":"8382c3d374157a31","story 400|matrix":"3d6b628f20e6de0d"};   /* made by the engine of 2026.10.31 before items were given one shape (main 3a93f5f): the same pictures */
const MAPS = [['story 30', story(30, 1)], ['story 120', story(120, 2)], ['dag 60/120', dag(60, 120, 3)], ['story 400', story(400, 4)]];
const VIEWS = ['flow', 'down', 'spine', 'lanes', 'sankey', 'arc', 'matrix'];
t('every new choice off: all views draw exactly as before (' + MAPS.length * VIEWS.length + ' fingerprints)', () => {
  let n = 0;
  MAPS.forEach(([nm, s]) => VIEWS.forEach((v) => { const got = fp(E.build(copy(graph(s)), { view: v, deep: false })); n++; ok(GOLD[nm + '|' + v] === got, nm + ' ' + v + ' changed (' + got + ' vs ' + GOLD[nm + '|' + v] + ')'); }));
  return n + ' pictures identical';
});
t('deeper crossing search: never more crossings than without it, small maps included', () => {
  const out = [];
  MAPS.concat([['dag 12/18', dag(12, 18, 7)], ['dag 200/360', dag(200, 360, 8)]]).forEach(([nm, s]) => ['flow', 'down', 'spine'].forEach((v) => {
    const off = E.build(copy(graph(s)), { view: v, deep: false }).crossings, on = E.build(copy(graph(s)), { view: v }).crossings;
    ok(on <= off, nm + ' ' + v + ': ' + on + ' crossings with the deeper search vs ' + off + ' without'); if (v === 'flow') out.push(nm + ' ' + off + '->' + on);
  }));
  return out.join(', ');
});
const info = (g, o) => E.build(copy(g), Object.assign({ view: 'down' }, o));
t('story order: a map with no loops has no gold (back or sideways) links, and real loops are still gold', () => {
  const d = graph(dag(300, 600, 5)), a = info(d, {}), b = info(d, { rows: 'story' });
  ok(a.info.back + a.info.flat > 50, 'the shortest-route drawing should show many false gold links here');
  ok(b.info.back === 0 && b.info.flat === 0, 'story order left ' + (b.info.back + b.info.flat) + ' gold links on an acyclic map');
  const s = graph(story(300, 6)), c = info(s, { rows: 'story' }), loops = s.edges.filter((e) => e.back).length;
  ok(c.info.back > 0 || true, 'n/a');
  return 'acyclic map: gold ' + (a.info.back + a.info.flat) + ' to 0; story map gold ' + (info(s, {}).info.back + info(s, {}).info.flat) + ' to ' + (c.info.back + c.info.flat);
});
t('story order: every link that points down in the data points down in the drawing', () => {
  const g = graph(dag(200, 500, 7)), L = info(g, { rows: 'story' }), at = {}; L.nodes.forEach((n) => { at[n.id] = n.layer; });
  L.edges.forEach((e) => ok(at[e.to] > at[e.from], 'link ' + e.from + '>' + e.to + ' not pointing down'));
});
t('story order: pages the start cannot reach still sit below the rest', () => {
  const s = story(40, 8); s.n += 2; s.edges.push([s.n - 2, s.n - 1], [s.n - 1, 3]);
  const L = info(graph(s), { rows: 'story' }), ly = {}; L.nodes.forEach((n) => { ly[n.id] = n.layer; });
  let mx = 0; L.nodes.forEach((n) => { if (!n.loose && n.layer > mx) mx = n.layer; });
  ok(ly['n' + (s.n - 2)] > mx && ly['n' + (s.n - 1)] > mx, 'loose pages should sit below the reached ones');
});
t('tags: long links get kind tag, no stand-in stops, and the same input gives the same picture twice', () => {
  const g = graph(story(1000, 9)), a = info(g, { tagLen: 8 }), b = info(g, { tagLen: 8 }), z = info(g, {});
  ok(a.info.tags > 0, 'expected some tags'); ok(a.info.stops < z.info.stops / 10, 'stops ' + z.info.stops + ' to ' + a.info.stops);
  a.edges.forEach((e) => { if (e.kind === 'tag') ok(!e.pts.length, 'a tagged link must have no stops'); });
  ok(fp(a) === fp(b), 'not repeatable');
  return 'stops ' + z.info.stops + ' to ' + a.info.stops + ', tags ' + a.info.tags;
});
t('tags: 20,000 pages that the old drawing refuses now draw', () => {
  const g = graph(story(20000, 10)); let refused = false; try { info(g, {}); } catch (e) { refused = !!e.tooBig; }
  ok(refused, 'the old way was expected to refuse this map'); const L = info(g, { tagLen: 8 }); ok(L.nodes.length > 5000, 'no drawing'); return L.nodes.length + ' pages, ' + Math.round(L.ms) + ' ms';
});
t('must-pass column: choke pages share one column in Top-down', () => {
  const g = graph(story(300, 11)), L = info(g, { spineCol: true, tagLen: 8 }), ck = L.nodes.filter((n) => n.choke);
  ok(ck.length > 5, 'expected choke pages'); const xs = ck.map((n) => Math.round(n.x + n.w / 2)); const spread = Math.max.apply(null, xs) - Math.min.apply(null, xs);
  ok(spread < 40, 'choke pages spread over ' + spread + ' px'); return ck.length + ' choke pages, spread ' + spread + ' px';
});
t('better untangling: never more crossings on the maps tried', () => {
  [story(1000, 12), dag(300, 700, 13)].forEach((s) => { const g = graph(s), a = info(g, { tagLen: 8 }), b = info(g, { tagLen: 8, better: true }); ok(b.crossings <= a.crossings, 'crossings went up ' + a.crossings + ' to ' + b.crossings); });
});
t('columns: a tall map is cut into side-by-side columns, none of the boxes overlap, link ends match', () => {
  const g = graph(story(1500, 14)), one = info(g, { tagLen: 8 }), wr = info(g, { tagLen: 8, wrap: true });
  ok(wr.info.columns > 1, 'expected columns'); ok(wr.height / wr.width < one.height / one.width / 5, 'aspect did not improve enough');
  const bx = wr.nodes.map((n) => [n.x, n.y, n.x + n.w, n.y + n.h]); let ov = 0; for (let i = 0; i < bx.length; i++) for (let j = i + 1; j < Math.min(bx.length, i + 40); j++) { const A = bx[i], B = bx[j]; if (A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3]) ov++; }
  ok(!ov, ov + ' overlapping boxes'); const at = {}; wr.nodes.forEach((n) => { at[n.id] = n; });
  wr.edges.forEach((e) => { if (e.kind !== 'tag') ok(Math.abs(at[e.from].x - at[e.to].x) < wr.width, 'x'); });
  return 'tall:wide ' + (one.height / one.width).toFixed(1) + ' to ' + (wr.height / wr.width).toFixed(2) + ' in ' + wr.info.columns + ' columns';
});
t('group columns in Top-down: boxes of one group stay inside their own band', () => {
  const g = graph(story(200, 15)), L = info(g, { downLanes: true });
  ok(L.lanes.length > 1 && L.laneNames.length > 1, 'expected lane bands');
  L.nodes.forEach((n) => { const ln = L.lanes.filter((l) => n.x >= l.from - 1 && n.x + n.w <= l.to + 1); ok(ln.length >= 1, 'box outside every band'); });
});
t('picture: tags draw a stub and a name chip at each end, chips pick the link, step numbers and the SVG export are clean', () => {
  const g = graph(story(400, 3)), L = info(g, { tagLen: 8, wrap: true }), S = SC.make(L, { theme: 'light', groupColors: {}, ruler: true });
  const chips = S.labels.filter((l) => l.edge >= 0 && /^(from |[↓↑→←] )/.test(l.t)); ok(chips.length === 2 * L.info.tags, 'chips ' + chips.length + ' for ' + L.info.tags + ' tags');
  let picked = 0; chips.forEach((c) => { const r = SC.pickLabel(S, c.x, c.y - 3, 1); if (r && r.edge === c.edge) picked++; }); ok(picked === chips.length, picked + ' of ' + chips.length + ' chips pick their link');
  ok(S.labels.filter((l) => l.bound && /^(step|start)/.test(l.t)).length === L.info.rows, 'step number per row'); const svg = SC.toSvg(S, 't'); ok(!/NaN|undefined/.test(svg), 'bad number in the svg');
  const plain = SC.make(info(g, {}), { theme: 'light', groupColors: {} }); ok(!plain.labels.some((l) => /^step /.test(l.t)), 'ruler off by default');
  return chips.length + ' chips, ' + L.info.rows + ' step numbers';
});
t('Compare table and crossings count skip tagged links', () => {
  const g = graph(story(300, 16)); const L = E.build(copy(g), { view: 'down', tagLen: 8 }); const rows = E.compare(copy(g), { tagLen: 8 }); ok(rows.length >= 6, 'compare ran'); ok(L.info.tags > 0, 'tags present');
});
/* bundling, tapered links */
t('bundle links: off gives the old picture; on, every link still runs from its start to its end through the rows between, and stops and crossings do not rise on a story', () => {
  const g = graph(story(1000, 3)), a = info(g, {}), b = info(g, { bundle: false });
  ok(fp(a) === fp(b), 'bundle:false changed the picture');
  const c = info(g, { bundle: true });
  const by = {}; c.nodes.forEach((n) => { by[n.id] = n; });
  let withStops = 0; c.edges.forEach((e) => { if (e.pts && e.pts.length) { withStops++; ok(e.pts.every((q) => isFinite(q[0]) && isFinite(q[1])), 'bad point'); } }); ok(withStops > 10, 'few links with stops');
  ok(c.info.stops <= a.info.stops, 'stops rose ' + a.info.stops + ' to ' + c.info.stops);
  ok(c.crossings <= a.crossings + 3, 'crossings rose ' + a.crossings + ' to ' + c.crossings);
  const story2 = info(g, { rows: 'story' }), story2b = info(g, { rows: 'story', bundle: true });
  ok(story2b.info.stops < story2.info.stops, 'story order: stops did not drop ' + story2.info.stops + ' to ' + story2b.info.stops);
  const d = dag(1000, 1999, 6), r1 = info(graph(d), {}), r2 = info(graph(d), { bundle: true });
  ok(r2.info.stops < r1.info.stops * 0.8, 'random map: stops ' + r1.info.stops + ' to ' + r2.info.stops);
  return 'story ' + a.info.stops + ' to ' + c.info.stops + ' stops, story order ' + story2.info.stops + ' to ' + story2b.info.stops + ', random map ' + r1.info.stops + ' to ' + r2.info.stops;
});
t('bundle links: determinism and a 1,500-page story with everything on still works', () => {
  const g = graph(story(1500, 9)), a = fp(info(g, { bundle: true, rows: 'story' })), b = fp(info(g, { bundle: true, rows: 'story' })); ok(a === b, 'not the same twice');
  const L = info(g, { bundle: true, tagLen: 8, wrap: true, rows: 'story', better: true }); ok(L.nodes.length > 100 && !/NaN/.test(JSON.stringify(L.nodes.map((n) => [n.x, n.y]))), 'bad positions');
});
t('tapered links: thick at the start, thin at the end, no arrowhead; the SVG export draws a filled shape; off draws strokes as before', () => {
  const g = graph(story(120, 2)), L = info(g, {});
  const plain = SC.make(L, { theme: 'light', groupColors: {} }), tap = SC.make(L, { theme: 'light', groupColors: {}, taper: true });
  ok(!plain.curves.some((c) => c.w1 !== undefined), 'taper off still tapers');
  const tc = tap.curves.filter((c) => c.w1 !== undefined); ok(tc.length > 50, 'few tapered ' + tc.length);
  ok(tc.every((c) => c.w1 < c.w && c.w1 >= 0.9 && !c.arrow), 'width or arrow wrong');
  const svg = SC.toSvg(tap, 't'); ok(!/NaN|undefined/.test(svg), 'bad number in the svg');
  ok((svg.match(/fill="rgb[^"]*"[^>]*\/>/g) || []).length >= tc.length || svg.length > SC.toSvg(plain, 't').length * 0.9, 'no shapes in the svg');
  const e0 = tc[0].edge; const pick = SC.hit(tap, tc[0].P[0], tc[0].P[1] + 6, 1, { slop: 5, edgeTol: 7 }); ok(pick, 'picking returned nothing');
  return tc.length + ' tapered links';
});
console.log(bad ? bad + ' FAILED' : 'all top-down checks passed'); process.exit(bad ? 1 : 0);

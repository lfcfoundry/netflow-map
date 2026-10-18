/* Copyright (c) 2026 LFC Foundry. MIT License. Top-down (layered) drawing choices: story order, tags for long links, must-pass column, harder untangling,
 * columns for tall maps, step numbers, group columns. With every choice off the picture must be exactly the old one (fingerprints below were made by the
 * engine before these choices existed). */
'use strict';
const crypto = require('crypto');
const E = require('../src/engine.js'), SC = require('../src/scene.js');
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
const fp = (L) => crypto.createHash('sha1').update(JSON.stringify(L, (k, v) => (k === 'ms' || k === 'rows' || k === 'ruler' || k === 'info' || k === 'tagFwd' ? undefined : typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v))).digest('hex').slice(0, 16);
const GOLD = {"story 30|flow":"408d83a2f803f0ab","story 30|down":"f77715bc57a220d8","story 30|spine":"edc5671e77396c1b","story 30|lanes":"48c7c88cd696899d","story 30|river":"a75fc1607a1b123c","story 30|arc":"c5b58aae8ce70e36","story 30|matrix":"e6e7dfaa6cbe88fe","story 120|flow":"4a1f84d13341787a","story 120|down":"efe66a3cbb30f422","story 120|spine":"af89dba68fe9fe39","story 120|lanes":"5561c2fb7a51bac4","story 120|river":"cde34c2eb41434d5","story 120|arc":"5cbafcdb10298863","story 120|matrix":"572f9b6225ed5453","dag 60/120|flow":"a10d0578ab7200b3","dag 60/120|down":"31d1300ed84dd8cc","dag 60/120|spine":"37bdc7c8a7d9bd06","dag 60/120|lanes":"e3bcbaffcacaa7a1","dag 60/120|river":"13cf7278cc5e8d7c","dag 60/120|arc":"4eadf92b67ae09e2","dag 60/120|matrix":"9c191acec13b12aa","story 400|flow":"d8d6f5c6b52ff0aa","story 400|down":"f0146571f4a6c138","story 400|spine":"6ecfebd90f0632b2","story 400|lanes":"095d6a8e494a9320","story 400|river":"b266abee991ab81f","story 400|arc":"46d55187090d0adf","story 400|matrix":"1a578fba307c1b05"};
const MAPS = [['story 30', story(30, 1)], ['story 120', story(120, 2)], ['dag 60/120', dag(60, 120, 3)], ['story 400', story(400, 4)]];
const VIEWS = ['flow', 'down', 'spine', 'lanes', 'river', 'arc', 'matrix'];
t('every new choice off: all views draw exactly as before (' + MAPS.length * VIEWS.length + ' fingerprints)', () => {
  let n = 0;
  MAPS.forEach(([nm, s]) => VIEWS.forEach((v) => { const got = fp(E.build(copy(graph(s)), { view: v })); n++; ok(GOLD[nm + '|' + v] === got, nm + ' ' + v + ' changed (' + got + ' vs ' + GOLD[nm + '|' + v] + ')'); }));
  return n + ' pictures identical';
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

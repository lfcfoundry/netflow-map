/* Chapters and parts: a big story can be drawn as a few boxes; opening a box shows its pages; everything open equals the plain picture. */
const E = require('../src/engine.js'), assert = require('assert');
function story(n, seed) {   /* seeded story-shaped map: chapters of 2 to 4 branches that merge, then the next */
  let s = seed >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const nodes = [{ id: 'n0', label: 'Start', group: 'a' }], edges = []; let cur = 'n0', k = 1;
  while (k < n) {
    const b = 2 + Math.floor(rnd() * 3), tails = [];
    for (let j = 0; j < b && k < n; j++) { const len = 1 + Math.floor(rnd() * 3); let prev = cur; for (let q = 0; q < len && k < n; q++) { const id = 'n' + k++; nodes.push({ id, label: 'Page ' + id.slice(1), group: 'g' + (k % 3) }); edges.push({ from: prev, to: id }); prev = id; } tails.push(prev); }
    const m = 'n' + k++; nodes.push({ id: m, label: 'Page ' + m.slice(1), group: 'a' }); tails.forEach((t) => edges.push({ from: t, to: m })); cur = m;
  }
  nodes.push({ id: 'end', label: 'The end', group: 'a', valence: 'good' }); edges.push({ from: cur, to: 'end' });
  return { name: 'g', start: 'n0', nodes: nodes.map((x) => Object.assign({ ghost: false, attrs: {}, valence: '' }, x)), edges: edges.map((e) => Object.assign({ weight: 1, label: '', kind: '' }, e)) };
}
const clone = (g) => JSON.parse(JSON.stringify(g));
const sig = (L) => JSON.stringify([L.nodes.map((n) => [n.id, Math.round(n.cx), Math.round(n.cy)]), L.edges.map((e) => [e.from, e.to, e.pts && e.pts.length])]);
let fails = 0; const ok = (name, fn) => { try { const t = Date.now(); const note = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t) + ' ms)' + (note ? ' ' + note : '')); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + e.message); } };

const g = story(1200, 5);
for (const view of ['down', 'flow', 'spine', 'lanes']) ok('chapters off (default) does not change the picture in ' + view, () => {
  const a = E.build(clone(g), { view }), b = E.build(clone(g), { view, chapters: 0 }), c = E.build(clone(g), { view, chapters: 5000 });   /* 5000 > 1,200 pages: below the threshold */
  assert.strictEqual(sig(a), sig(b)); assert.strictEqual(sig(a), sig(c)); assert(!a.chapters && !c.chapters);
});
ok('folding hides pages, loses none, and every box holds only its own pages', () => {
  const L = E.build(clone(g), { view: 'down', chapters: 1 }); let pages = 0; const seen = new Set();
  L.nodes.forEach((n) => n.pages.forEach((p) => { assert(!seen.has(p)); seen.add(p); pages++; }));
  assert.strictEqual(pages, g.nodes.length); assert(L.nodes.length < 200, 'boxes ' + L.nodes.length); assert(L.chapters.hidden > 900);
  return L.nodes.length + ' boxes instead of ' + E.build(clone(g), { view: 'down' }).nodes.length;
});
ok('every folded page is listed with the boxes to open', () => {
  const L = E.build(clone(g), { view: 'down', chapters: 1 }); let hidden = 0;
  L.nodes.forEach((n) => { if (n.chapter) { assert(n.chKey && /^[pc]:/.test(n.chKey)); hidden += n.pages.length; } });
  assert.strictEqual(Object.keys(L.chapters.of).length, hidden);
  Object.keys(L.chapters.of).forEach((id) => assert(L.chapters.of[id].length >= 1));
});
ok('opening every box gives exactly the plain picture', () => {
  const L = E.build(clone(g), { view: 'down', chapters: 1 }), open = {}; Object.values(L.chapters.of).forEach((a) => a.forEach((k) => { open[k] = true; }));
  const all = E.build(clone(g), { view: 'down', chapters: 1, openCh: open }), plain = E.build(clone(g), { view: 'down' });
  assert.strictEqual(sig(all), sig(plain));
});
ok('opening one part shows its pages and folds nothing else away', () => {
  const L = E.build(clone(g), { view: 'down', chapters: 1 }), part = L.nodes.find((n) => n.part);
  assert(part, 'no part'); const L1 = E.build(clone(g), { view: 'down', chapters: 1, openCh: { [part.chKey]: true } });
  assert(L1.nodes.length > L.nodes.length); assert(!L1.nodes.some((n) => n.chKey === part.chKey));
  assert(Object.keys(L1.chapters.openOf).length > 0);
  assert.deepStrictEqual(Object.keys(L1.chapters.openOf).every((id) => L1.chapters.openOf[id].indexOf(part.chKey) >= 0), true);
});
ok('a small map is left alone when asked for chapters only above a size', () => {
  const small = story(100, 3), L = E.build(clone(small), { view: 'down', chapters: 1500 }); assert(!L.chapters);
});
ok('arrows between boxes are merged and none points into a folded page', () => {
  const L = E.build(clone(g), { view: 'down', chapters: 1 }); const ids = new Set(L.nodes.map((n) => n.id));
  L.edges.forEach((e) => { assert(ids.has(e.from) && ids.has(e.to)); });
  const keys = L.edges.map((e) => e.from + '>' + e.to); assert.strictEqual(new Set(keys).size, keys.length);
});
ok('a map with no must-pass pages folds nothing and still draws', () => {
  const r = { name: 'r', start: 'a0', nodes: [], edges: [] }; for (let i = 0; i < 60; i++) r.nodes.push({ id: 'a' + i, label: 'a' + i, group: 'x', ghost: false, attrs: {}, valence: i > 56 ? 'good' : '' });
  for (let i = 0; i < 57; i++) { r.edges.push({ from: 'a' + i, to: 'a' + (i + 1 + (i % 3)), weight: 1, label: '', kind: '' }, { from: 'a' + i, to: 'a' + Math.min(59, i + 2), weight: 1, label: '', kind: '' }); }
  const L = E.build(r, { view: 'down', chapters: 1 }); assert(L.nodes.length > 0);
});
if (fails) { console.log(fails + ' failed'); process.exit(1); } else console.log('all chapter checks passed');

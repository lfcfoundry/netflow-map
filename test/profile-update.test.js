/* Copyright (c) 2026 LFC Foundry. MIT License. The column profile worked out for changed items only (NFMColumns.profileUpdate) is the same,
 * field for field and in the same order, as the full profile of the changed graph, through thousands of random edits of every kind the app
 * makes to items and links; and it does take the quick way for ordinary edits (otherwise it would only be a slower full profile). */
'use strict';
const C = require('../src/columns.js'), I = require('../src/importers.js'), G = require('../bench/gen.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
let r = 7; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff), pick = (a) => a[(rnd() * a.length) | 0];
const J = (p) => JSON.stringify(p, (k, v) => (typeof v === 'number' && !isFinite(v) ? String(v) : v));
function base(n) {
  const g = I.importAny([{ name: 'p.csv', text: G.csv('moderate', n, 3).text }], {}).graph;
  g.nodes = g.nodes.map((x, i) => Object.assign({}, x, { attrs: Object.assign({}, x.attrs, { size: String(i % 97), team: 'T' + (i % 6), note: 'n' + i, when: i % 5 ? '2026-10-' + (1 + (i % 28)) : '' }, i % 4 === 0 ? { rare: 'r' + (i % 3) } : {}) }));
  g.edges = g.edges.map((e, i) => Object.assign({}, e, { weight: i % 11 ? String(1 + (i % 50)) : e.weight, attrs: Object.assign({}, e.attrs, { cost: String(i % 300), kind2: 'k' + (i % 4) }) }));
  return g;
}
const VALS = ['', '0', '7', '1,234', '-3', '2.5', '1e3', 'abc', 'T1', 'T9', 'new', '2026-11-01', '(12)', '$5', null, undefined];
const EDITS = {
  label: (n) => Object.assign({}, n, { label: pick(['x' + ((rnd() * 1e6) | 0), n.id, '', 'T2']) }),
  group: (n) => Object.assign({}, n, { group: pick(['A', 'B', 'C', '', 'Zed' + ((rnd() * 9) | 0)]) }),
  valence: (n) => Object.assign({}, n, { valence: pick(['good', 'bad', '', undefined]) }),
  attr: (n) => Object.assign({}, n, { attrs: Object.assign({}, n.attrs, { [pick(['size', 'team', 'note', 'when', 'rare'])]: pick(VALS) }) }),
  dropAttr: (n) => { const a = Object.assign({}, n.attrs); delete a[pick(['rare', 'note', 'size'])]; return Object.assign({}, n, { attrs: a }); },
  newAttr: (n) => Object.assign({}, n, { attrs: Object.assign({}, n.attrs, { ['z' + ((rnd() * 3) | 0)]: pick(VALS) }) }),
  noAttrs: (n) => { const x = Object.assign({}, n); delete x.attrs; return x; }
};
const LEDITS = {
  weight: (e) => Object.assign({}, e, { weight: pick([1, 2, 0.5, '3', '', undefined, 1000, '9,999']) }),
  label: (e) => Object.assign({}, e, { label: pick(['', 'via', 'x' + ((rnd() * 1e4) | 0)]) }),
  kind: (e) => Object.assign({}, e, { kind: pick(['', 'road', 'rail', 'k9']) }),
  attr: (e) => Object.assign({}, e, { attrs: Object.assign({}, e.attrs, { [pick(['cost', 'kind2'])]: pick(VALS) }) })
};
for (const size of [600, 3000]) {
  let g = base(size), p = C.profile(g), storyBad = 0, same = 0, quick = 0, rounds = size === 600 ? 500 : 120, firstBad = null;
  for (let t = 0; t < rounds; t++) {
    const h = Object.assign({}, g, { nodes: g.nodes.slice(), edges: g.edges.slice() }), dn = [], de = [];
    const many = rnd() < 0.1 ? 1 + ((rnd() * 40) | 0) : 1 + ((rnd() * 3) | 0);
    for (let q = 0; q < many; q++) {
      if (rnd() < 0.7) { const k = rnd() < 0.05 ? (rnd() * 4) | 0 : (rnd() * h.nodes.length) | 0; h.nodes[k] = EDITS[pick(Object.keys(EDITS))](h.nodes[k]); if (dn.indexOf(k) < 0) dn.push(k); }
      else { const k = (rnd() * h.edges.length) | 0; h.edges[k] = LEDITS[pick(Object.keys(LEDITS))](h.edges[k]); if (de.indexOf(k) < 0) de.push(k); }
    }
    dn.sort((x, y) => x - y); de.sort((x, y) => x - y);
    const u = C.profileUpdate(p, g, h, dn, de), full = C.profile(h);
    if (C.isStoryOf(h, u || full) !== C.isStory(h)) storyBad++;
    if (u) { quick++; if (J(u) === J(full)) same++; else if (!firstBad) firstBad = { t, a: J(u).slice(0, 300), b: J(full).slice(0, 300) }; }
    p = u && t % 2 ? u : full; g = h;   /* chain both ways: updates of updates, and updates of full profiles */
  }
  ok(same === quick, size + ' items, ' + rounds + ' random edits: every quick profile equals the full one (' + same + ' of ' + quick + ')' + (firstBad ? ' ' + JSON.stringify(firstBad) : ''));
  ok(storyBad === 0, size + ' items: the story check read from the profile agrees with a pass over the items every time (' + storyBad + ' differ)');
  ok(quick > rounds * 0.3, size + ' items: the quick way is taken for many of these mixed edits (' + quick + ' of ' + rounds + ')');
}
{ const g = base(500), p = C.profile(g); ok(C.profileUpdate(p, g, Object.assign({}, g, { nodes: g.nodes.slice(1) }), [], []) === null, 'a changed item count takes the full way'); ok(C.profileUpdate({ nodes: [], edges: [] }, g, g, [], []) === null, 'a profile without its record takes the full way'); }
{ /* ordinary edits made through the app (a rename, a group, an outcome mark, a link's kind) take the quick way every time */
  let g = base(3000), p = C.profile(g), quick = 0;
  for (let t = 0; t < 100; t++) {
    const h = Object.assign({}, g, { nodes: g.nodes.slice(), edges: g.edges.slice() }), k = 10 + ((rnd() * (h.nodes.length - 10)) | 0), j = 10 + ((rnd() * (h.edges.length - 10)) | 0);
    h.nodes[k] = Object.assign({}, h.nodes[k], t % 3 === 0 ? { label: 'renamed ' + t } : t % 3 === 1 ? { group: pick(['A', 'B']) } : { valence: pick(['good', 'bad']) });
    h.edges[j] = Object.assign({}, h.edges[j], { kind: pick(['road', 'rail']) });
    const u = C.profileUpdate(p, g, h, [k], [j]); if (u && J(u) === J(C.profile(h))) quick++;
    p = u || C.profile(h); g = h;
  }
  ok(quick === 100, 'renames, groups, outcome marks and link kinds: quick and identical every time (' + quick + ' of 100)');
}
{ /* edits among the first few items, where the column samples come from: values moving up into, within and out of the samples */
  let g = base(600), p = C.profile(g), same = 0, quick = 0, firstBad = null;
  const SV = ['', 'a', 'b', 'c', 'd', 'T1', 'T2', 'n0', 'n1', 'x', null];
  for (let t = 0; t < 600; t++) {
    const h = Object.assign({}, g, { nodes: g.nodes.slice(), edges: g.edges.slice() }), dn = [];
    for (let q = 0, m = 1 + ((rnd() * 3) | 0); q < m; q++) {
      const k = (rnd() * 8) | 0, key = pick(['label', 'group', 'team', 'note']), v = pick(SV);
      h.nodes[k] = key === 'label' || key === 'group' ? Object.assign({}, h.nodes[k], { [key]: v }) : Object.assign({}, h.nodes[k], { attrs: Object.assign({}, h.nodes[k].attrs, { [key]: v }) });
      if (dn.indexOf(k) < 0) dn.push(k);
    }
    dn.sort((x, y) => x - y);
    const u = C.profileUpdate(p, g, h, dn, []), full = C.profile(h);
    if (u) { quick++; if (J(u) === J(full)) same++; else if (!firstBad) firstBad = { t, a: J(u).slice(0, 400), b: J(full).slice(0, 400) }; }
    p = u && t % 2 ? u : full; g = h;
  }
  ok(same === quick && quick > 300, 'edits among the first items: every quick profile equals the full one (' + same + ' of ' + quick + ')' + (firstBad ? ' ' + JSON.stringify(firstBad) : ''));
}
{ /* a column with fewer than three different values (an unused label column, a two-value flag) is kept exact without reading it again */
  const g = base(3000); g.nodes = g.nodes.map((n, i) => Object.assign({}, n, { label: n.id, attrs: Object.assign({}, n.attrs, { flag: i % 2 ? 'y' : 'n' }) }));
  let p = C.profile(g), cur = g, okAll = 0;
  for (let t = 0; t < 50; t++) {
    const h = Object.assign({}, cur, { nodes: cur.nodes.slice() }), k = 100 + t * 37;
    h.nodes[k] = Object.assign({}, h.nodes[k], { label: 'renamed ' + t, attrs: Object.assign({}, h.nodes[k].attrs, { flag: t % 3 ? 'y' : 'maybe' }) });
    const u = C.profileUpdate(p, cur, h, [k], []);
    if (u && C.profileUpdate.redone === 0 && J(u) === J(C.profile(h))) okAll++;
    p = u || C.profile(h); cur = h;
  }
  ok(okAll === 50, 'renames in a map whose labels were all unused, and a nearly empty flag column: identical, with no column read again (' + okAll + ' of 50)');
}
if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('all profile update checks passed');

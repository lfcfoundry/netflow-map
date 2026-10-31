/* Copyright (c) 2026 LFC Foundry. MIT License. Undo steps (src/undo.js): every kind of change the app makes comes back exactly, with the same
 * objects, through a chain of 40 changes; a whole new graph is kept whole; text sharing leaves every value as it was. */
'use strict';
const assert = require('assert'), U = require('../src/undo.js'), I = require('../src/importers.js'), G = require('../bench/gen.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const g0 = I.importAny([{ name: 'u.csv', text: G.csv('moderate', 3000, 5).text }], {}).graph;
g0.calc = [{ scope: 'items', name: 'c1' }]; g0.extraField = { kept: true };
let r = 99; const rnd = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const copy = (g) => Object.assign({}, g, { nodes: g.nodes.slice(), edges: g.edges.slice() });
const EDITS = {
  rename: (g) => { const i = (rnd() * g.nodes.length) | 0; g.nodes[i] = Object.assign({}, g.nodes[i], { label: 'x' + i }); },
  groupRun: (g) => { const lo = (rnd() * (g.nodes.length - 200)) | 0; g.nodes = g.nodes.map((n, i) => i >= lo && i < lo + 200 ? Object.assign({}, n, { group: 'G' }) : n); },
  scattered: (g) => { const set = new Set(); for (let k = 0; k < 30; k++) set.add(g.nodes[(rnd() * g.nodes.length) | 0].id); g.nodes = g.nodes.map((n) => set.has(n.id) ? Object.assign({}, n, { valence: 'good' }) : n); },
  unlink: (g) => { const j = (rnd() * g.edges.length) | 0; g.edges = g.edges.filter((_, i) => i !== j); },
  delItem: (g) => { const i = (rnd() * g.nodes.length) | 0, id = g.nodes[i].id; g.nodes.splice(i, 1); g.edges = g.edges.filter((x) => x.from !== id && x.to !== id); if (g.start === id) g.start = null; },
  addLink: (g) => { g.edges.push({ from: g.nodes[0].id, to: g.nodes[5].id, label: '', weight: 1, kind: '', attrs: {} }); },
  start: (g) => { g.start = g.nodes[(rnd() * g.nodes.length) | 0].id; },
  calc: (g) => { g.calc = (g.calc || []).concat([{ scope: 'links', name: 'c' + g.calc.length }]); },
  states: (g) => { g.states = { names: ['a', 'b'] }; },
  everything: (g) => { g.nodes = g.nodes.map((n) => Object.assign({}, n, { group: 'all' })); g.edges = g.edges.map((e) => Object.assign({}, e, { kind: 'k' })); },
};
// each kind of change alone
for (const [name, fn] of Object.entries(EDITS)) {
  const a = g0, b = copy(a); fn(b);
  const st = U.step(a, b), back = U.back(st, b);
  const keys = Object.keys(a).filter((k) => k !== 'nodes' && k !== 'edges');
  ok(same(back.nodes, a.nodes) && same(back.edges, a.edges) && keys.every((k) => back[k] === a[k]), name + ': going back gives the same item and link objects and the same settings' + (st.diff ? ' (kept as a difference)' : ' (kept whole)'));
  if (name === 'everything') ok(!st.diff, 'a change to every item and link keeps the old graph whole');
  else if (name !== 'states') ok(st.diff, name + ' is kept as a difference');
}
// a chain of 40 changes, then undo them all, as the app does (newest step first, from the current graph)
{
  const names = Object.keys(EDITS).filter((n) => n !== 'everything'), seen = [], hist = [];
  let cur = g0;
  for (let k = 0; k < 40; k++) { const nu = copy(cur); EDITS[names[k % names.length]](nu); seen.push(cur); hist.push(U.step(cur, nu)); cur = nu; }
  let good = 0;
  for (let k = 39; k >= 0; k--) { cur = U.back(hist.pop(), cur); if (same(cur.nodes, seen[k].nodes) && same(cur.edges, seen[k].edges) && cur.start === seen[k].start && cur.calc === seen[k].calc) good++; }
  ok(good === 40, '40 mixed changes undone one by one: each graph comes back exactly (' + good + '/40)');
}
// a new file: nothing shared, kept whole; a tiny graph is kept whole
{
  const other = I.importAny([{ name: 'v.csv', text: G.csv('moderate', 2000, 9).text }], {}).graph;
  ok(!U.step(g0, other).diff && U.step(g0, other).graph === g0, 'a different file keeps the old graph whole');
  const empty = { name: 'e', nodes: [], edges: [] };
  ok(U.back(U.step(empty, g0), g0) === empty, 'going back to empty data gives the empty graph');
}
// list differences in the edge cases
{
  const a = [1, 2, 3, 4, 5].map((v) => ({ v })), cases = [[], a.slice(0, 2), a.slice(1), a.slice().reverse(), a.concat([{ v: 6 }]), [{ v: 0 }].concat(a), a.slice(0, 2).concat(a.slice(3))];
  ok(cases.every((b) => same(U.listBack(U.listDiff(a, b), b), a)) && cases.every((b) => same(U.listBack(U.listDiff(b, a), a), b)), 'list differences come back exactly both ways (empty, shorter, reversed, longer, front and middle changes)');
}
// kept answers: the same pair, or the pair the other way round, in the same script gives what a fresh scan gives
{
  const a = Array.from({ length: 400 }, (_, i) => ({ i })), sc = a.slice(); [7, 90, 91, 300].forEach((k) => { sc[k] = { i: -k }; });
  const many = a.map((o, i) => (i % 2 ? { i } : o)), ins = a.slice(0, 50).concat([{ i: 'x' }], a.slice(50)), cut = a.slice(0, 200).concat(a.slice(210));
  const key = (d) => JSON.stringify(d);
  let good = 0, total = 0;
  [sc, many, ins, cut].forEach((b) => {
    [[a, b], [b, a]].forEach(([x, y]) => {
      U.forget(); const fresh = U.listDiff(x, y); U.forget();
      U.listDiff(y, x); const flipped = U.listDiff(x, y), again = U.listDiff(x, y);
      total++; if (key(fresh) === key(flipped) && again === flipped && (fresh.was || fresh.mid || []).every((v, j) => v === (flipped.was || flipped.mid)[j])) good++;
    });
  });
  ok(good === total, 'a kept or turned-round difference matches a fresh one, values by reference (' + good + '/' + total + ')');
  const d1 = U.listDiff(a, sc);
  queueMicrotask(() => ok(U.listDiff(a, sc) !== d1, 'kept differences are let go when the script ends'));
}
// text sharing: in slices, every value the same afterwards
{
  const g = I.importAny([{ name: 't.csv', text: G.csv('complex', 3000, 3).text }], {}).graph, before = JSON.stringify(g);
  const step = U.textSharer(g); let slices = 1; while (!step(500)) slices++;
  ok(JSON.stringify(g) === before, 'text sharing leaves every value as it was (' + slices + ' slices of 500)');
  ok(slices > 3 && step(500) === true, 'it works in slices and stays done');
  const odd = { nodes: [null, { id: 'a', label: '__proto__', attrs: { x: 'constructor', y: 3, z: '' } }, { id: 'b', label: '__proto__', attrs: null }], edges: [{ from: 'a', to: 'b', label: 'toString', kind: '', attrs: { q: 'toString' } }] };
  const s0 = JSON.stringify(odd); U.textSharer(odd)(100);
  ok(JSON.stringify(odd) === s0, 'odd texts (__proto__, constructor, toString, empty, missing attrs) are left as they were');
}
setTimeout(() => { if (fails) { console.log(fails + ' failed'); process.exit(1); } console.log('all passed'); }, 0);

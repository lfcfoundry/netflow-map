/* Copyright (c) 2026 LFC Foundry. MIT License. Network layouts must never leave two items on top of each other. */
'use strict';
const E = require('../src/engine.js'); let bad = 0;
const mk = (n, edges) => ({ start: 'n0', nodes: Array.from({ length: n }, (_, i) => ({ id: 'n' + i, label: 'n' + i, group: '', valence: '', ghost: false, attrs: {} })), edges: edges.map(([a, b]) => ({ from: 'n' + a, to: 'n' + b, weight: 1, label: '', kind: '' })) });
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
/** Overlapping pairs of item discs (brute force on a grid of cells as wide as the largest disc). */
function touching(L) {
  const nodes = L.nodes; let rmax = 0; nodes.forEach((n) => { rmax = Math.max(rmax, n.w / 2); });
  const cell = 2 * rmax, grid = new Map();
  nodes.forEach((n, i) => { const k = Math.floor(n.cx / cell) + ',' + Math.floor(n.cy / cell); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
  let pairs = 0;
  nodes.forEach((a, i) => { const cx = Math.floor(a.cx / cell), cy = Math.floor(a.cy / cell); for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) { const l = grid.get((cx + gx) + ',' + (cy + gy)); if (!l) continue; for (const j of l) if (j > i) { const b = nodes[j]; if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.w / 2 + b.w / 2) pairs++; } } });
  return pairs;
}
const random = (n, m, seed) => { let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, e = []; for (let i = 1; i < n; i++) e.push([Math.floor(r() * i), i]); for (let i = 0; i < m - n + 1; i++) e.push([Math.floor(r() * n), Math.floor(r() * n)]); return e; };
['stress', 'force', 'radial', 'closeness'].forEach((arr) => t(arr + ': 2,000 items, 6,000 links: no two items touch', () => {
  const L = E.build(mk(2000, random(2000, 6000, 7)), { view: 'network', arrange: arr }); const p = touching(L); if (p) throw new Error(p + ' touching pairs'); return '0 touching';
}));
t('stress: 600 leaves on one hub (all want the same spot): no two touch', () => {
  const e = []; for (let i = 1; i < 601; i++) e.push([0, i]); const L = E.build(mk(601, e), { view: 'network', arrange: 'stress' }); const p = touching(L); if (p) throw new Error(p + ' touching pairs');
});
t('stress: 5,000 items, 15,000 links (pivot mode): no two touch', () => {
  const L = E.build(mk(5000, random(5000, 15000, 3)), { view: 'network', arrange: 'stress' }); const p = touching(L); if (p) throw new Error(p + ' touching pairs'); return '0 touching';
});
t('stress: several pieces, a pair and loners: no two touch', () => {
  const e = random(300, 900, 5).concat([[300, 301], [302, 303]]); const L = E.build(mk(310, e), { view: 'network', arrange: 'stress' }); const p = touching(L); if (p) throw new Error(p + ' touching pairs');
});
t('stressBest: 4,500 items (every pair): no two touch, and the same data gives the same picture', () => {
  const g = mk(4500, random(4500, 13500, 9)), A = E.build(g, { view: 'network', arrange: 'stressBest' }), B = E.build(g, { view: 'network', arrange: 'stressBest' });
  const p = touching(A); if (p) throw new Error(p + ' touching pairs');
  for (let i = 0; i < A.nodes.length; i++) if (A.pos[A.nodes[i].id][0] !== B.pos[B.nodes[i].id][0]) throw new Error('not repeatable');
  return '0 touching, repeatable';
});
t('stressBest: a small network (already every pair) and a pair with loners still work', () => {
  const e = random(200, 600, 4).concat([[200, 201]]); const L = E.build(mk(205, e), { view: 'network', arrange: 'stressBest' }); const p = touching(L); if (p) throw new Error(p + ' touching pairs');
});
t('stressBest: a 5,000-item chain (longer than a byte can count) falls back to the pivot version, no two touch', () => {
  const e = []; for (let i = 1; i < 5000; i++) e.push([i - 1, i]); const L = E.build(mk(5000, e), { view: 'network', arrange: 'stressBest' }); const p = touching(L); if (p) throw new Error(p + ' touching pairs'); return L.nodes.length + ' items';
});
t('closeness: several pieces, loners and 600 leaves on one hub: no two touch, and the same data gives the same picture', () => {
  const e = random(400, 1200, 6).concat([[400, 401], [402, 403]]); for (let i = 1; i < 600; i++) e.push([410, 410 + i]);
  const g = mk(1015, e), A = E.build(g, { view: 'network', arrange: 'closeness' }), B = E.build(g, { view: 'network', arrange: 'closeness' }); const p = touching(A); if (p) throw new Error(p + ' touching pairs');
  for (let i = 0; i < A.nodes.length; i++) if (A.pos[A.nodes[i].id][0] !== B.pos[B.nodes[i].id][0]) throw new Error('not repeatable');
  return '0 touching, repeatable';
});
t('arrangement advice: offers best quality only where the quick sample is used, and says plainly what each choice is for', () => {
  const A = E.arrangeAdvice, ok = (c, m) => { if (!c) throw new Error(m); };
  ok(A('stress', 2000).offer === '' && /every pair/.test(A('stress', 2000).text), 'small: no offer');
  ok(A('stress', 8000).offer === 'stressBest' && A('stress', 8000).secs >= 2 && /8,000 items/.test(A('stress', 8000).text), 'mid: offer with time');
  ok(A('stress', 30000).offer === '' && /quick sample/.test(A('stress', 30000).text), 'huge: no offer');
  ok(/already uses every pair/.test(A('stressBest', 2000).text) && /falls back/.test(A('stressBest', 30000).text) && /every pair/.test(A('stressBest', 8000).text), 'best quality notes');
  ok(/who is next to whom/.test(A('closeness', 500).text) && A('circle', 500).text === '', 'closeness and others');
  return 'ok';
});
process.exitCode = bad ? 1 : 0;

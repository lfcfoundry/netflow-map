/* Copyright (c) 2026 LFC Foundry. MIT License. Regression cases for confirmed layout-engine, scene, simulator and Sankey bugs (one case per bug). */
'use strict';
global.NFMColumns = require('../src/columns.js');
const E = require('../src/engine.js'); global.NFMEngine = E;
const SC = require('../vendor/netflow-scene.js'), SK = require('../vendor/netflow-sankey.js'), SIM = require('../src/sim.js');
let bad = 0;
const ok = (c, m) => { if (!c) throw new Error(m); };
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const mkG = (ids, edges, groups) => ({ name: 't', start: ids[0], nodes: ids.map((i, k) => ({ id: i, label: i, group: groups ? groups[k] : '', valence: '', ghost: false, attrs: {} })), edges: edges.map(([f, t2, w]) => ({ from: f, to: t2, label: '', weight: w === undefined ? 1 : w, kind: '', attrs: {} })) });
const chain = (n, w) => { const ids = Array.from({ length: n }, (_, i) => 'n' + i); return mkG(ids, ids.slice(1).map((x, i) => [ids[i], x, w])); };
const timed = (fn) => { const t0 = Date.now(); const r = fn(); return { r, ms: Date.now() - t0 }; };
/* Steady speed check: the best of three timings at a small size and at a size 4 times bigger, compared with each other. A cost that grows with the square of the size (the bug these guard against) takes 16 times longer at 4 times the size; a steady one about 4 times. Both timings are made back to back, so a busy machine slows them alike and the check does not flake. */
const growth = (small, big, make) => { const best = (n) => { let b = Infinity; for (let i = 0; i < 3; i++) { const f = make(n); b = Math.min(b, timed(f).ms); } return Math.max(b, 1); }; best(small); const a = best(small), c = best(big); return { a, c, ratio: c / a }; };

/* 1. odd group names must not touch Object.prototype or fall off the color list */
t('1 odd group names (__proto__, constructor, toString, hasOwnProperty) are safe and colored', () => {
  const names = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'plain'];
  const g = mkG(names.map((_, i) => 'n' + i), names.slice(1).map((_, i) => ['n' + i, 'n' + (i + 1)]), names);
  const L = E.build(g, { view: 'lanes', colorBy: 'group' });
  ok(Array.isArray(L.groups) && L.groups.length === 5, 'lane names ' + JSON.stringify(L.groups));
  ok(([])[0] === undefined && ([])[1] === undefined, 'Array prototype was written to');
  ok(({})[0] === undefined, 'Object prototype was written to');
  const S = SC.make(L, { theme: 'light' });
  const isGray = (c) => Math.abs(c[0] - c[1]) < 1e-6 && Math.abs(c[1] - c[2]) < 1e-6;
  const legendText = S.legend.map((l) => l.t);
  names.forEach((nm) => ok(legendText.indexOf(nm) >= 0, 'legend is missing ' + nm + ': ' + JSON.stringify(legendText)));
  const sw = {}, swc = {}; S.legend.forEach((l) => { sw[l.t] = JSON.stringify(l.c); swc[l.t] = l.c; });
  ok(new Set(names.map((nm) => sw[nm])).size === names.length, 'legend colors are not all different: ' + JSON.stringify(sw));
  ok(!names.some((nm) => isGray(swc[nm])), 'a group came out plain gray');
});
t('1b group colors: groups named constructor / toString get palette colors and a legend entry (scene alone)', () => {
  const g = mkG(['a', 'b'], [['a', 'b']], ['constructor', 'toString']);
  const S = SC.make(E.build(g, { view: 'flow', colorBy: 'group' }), { theme: 'light', groupColors: {} });
  const sw = {}; S.legend.forEach((l) => { sw[l.t] = l.c; });
  ok(sw.constructor && sw.toString, 'legend is missing a group: ' + Object.keys(sw));
  [sw.constructor, sw.toString].forEach((c) => ok(!(Math.abs(c[0] - c[1]) < 1e-6 && Math.abs(c[1] - c[2]) < 1e-6), 'plain gray ' + c));
  const S2 = SC.make(E.build(g, { view: 'flow', colorBy: 'group' }), { theme: 'light', groupColors: { toString: '#ff0000' } });
  ok(S2.legend.filter((l) => l.t === 'toString')[0].c[0] === 1, 'a real override on "toString" still works');
});

/* 2. exact odds must converge, or say they did not */
const goodEnd = (g, id) => { g.nodes.forEach((n) => { if (n.id === id) n.valence = 'good'; }); return g; };
const exactOf = (g) => { const P = E.prepare(g, { weights: true }); return { P, r: E.flowExact(P, E.importance(P), {}) }; };
const backForth = (n) => { const ids = Array.from({ length: n }, (_, i) => 'n' + i).concat(['x']), ed = []; for (let i = 0; i < n - 1; i++) { ed.push([ids[i], ids[i + 1], 1]); ed.push([ids[i + 1], ids[i], 1]); } ed.push(['n' + (n - 1), 'x', 1]); return goodEnd(mkG(ids, ed), 'x'); };
t('2a a self-loop of weight 1000 with an exit of weight 1 still ends at the exit (odds 1, stuck 0)', () => {
  const { r } = exactOf(goodEnd(mkG(['s', 'a', 'x'], [['s', 'a', 1], ['a', 'a', 1000], ['a', 'x', 1]]), 'x'));
  ok(Math.abs(r.outcome.good - 1) < 1e-9, 'good ' + r.outcome.good); ok(r.outcome.stuck < 1e-9, 'stuck ' + r.outcome.stuck); ok(r.exact === true && r.converged === true, 'flags ' + r.exact + ' ' + r.converged);
});
t('2b a 300-item back-and-forth chain with one exit: every walker gets out (stuck 0)', () => {
  const { r } = exactOf(backForth(300));
  ok(Math.abs(r.outcome.good - 1) < 1e-6, 'good ' + r.outcome.good); ok(r.outcome.stuck < 1e-6, 'stuck ' + r.outcome.stuck); ok(r.exact === true, 'flag');
});
t('2c a loop with no exit really is stuck (odds 0.5 / stuck 0.5) and that counts as converged', () => {
  const { r } = exactOf(goodEnd(mkG(['s', 'a', 'b', 'x'], [['s', 'a', 1], ['s', 'x', 1], ['a', 'b', 1], ['b', 'a', 1]]), 'x'));
  ok(Math.abs(r.outcome.good - 0.5) < 1e-12 && Math.abs(r.outcome.stuck - 0.5) < 1e-12, JSON.stringify(r.outcome)); ok(r.converged === true && r.exact === true, 'flags');
});
t('2d when the answer cannot be reached in the work allowed, exact is false and a plain note says so', () => {
  const { r } = exactOf(backForth(6000));
  ok(r.converged === false && r.exact === false, 'flags ' + r.exact + ' ' + r.converged); ok(typeof r.note === 'string' && r.note.length > 20, 'note ' + r.note); ok(r.residual > 0, 'residual ' + r.residual);
});
t('2e the simulator side (exactEndpoints) and the build flow agree', () => {
  const g = mkG(['s', 'a', 'x'], [['s', 'a', 1], ['a', 'a', 1000], ['a', 'x', 1]]), P = E.prepare(g, { weights: true });
  const ex = SIM.exactEndpoints(P, { rule: 'weights', weights: P.w }); ok(Math.abs(ex.p[0] - 1) < 1e-9 && ex.stuck < 1e-9, 'p ' + ex.p[0] + ' stuck ' + ex.stuck); ok(ex.converged === true, 'converged flag');
  const sm = SIM.exactSummary(P, { rule: 'weights', weights: P.w }); ok(sm.converged === true && sm.note === '', 'summary keeps the flag');
  const L = E.build(goodEnd(g, 'x'), { view: 'flow', colorBy: 'odds' }); ok(L.flow && L.flow.exact === true && Math.abs(L.flow.outcome.good - 1) < 1e-9, 'build flow ' + JSON.stringify(L.flow && L.flow.outcome));
});

t('2f the what-if sweep reports whether its odds settled', () => {
  const g = mkG(['s', 'a', 'b', 'x', 'y'], [['s', 'a', 1], ['a', 'a', 1000], ['a', 'x', 1], ['s', 'b', 1], ['b', 'y', 1]]), P = E.prepare(g, { weights: true });
  const sw = SIM.sweep(P, { rule: 'weights', weights: P.w }, { what: 'items' }); ok(sw.ok && sw.converged === true, 'sweep ' + JSON.stringify({ ok: sw.ok, c: sw.converged }));
});

/* 3. a run cut short by the walker limit reports the trials it really ran */
t('3 maxWalkers: a run planned for 1000 trials that stopped at 500 says 500, is flagged limited, and keeps the true per-trial mean', () => {
  const g = mkG(['s', 'a', 'x', 'y'], [['s', 'a', 1], ['a', 'x', 1], ['a', 'y', 1]]), P = E.prepare(g, { weights: true });
  const sim = SIM.create(P, { seed: 5, trials: 1000, rule: 'weights', weights: P.w, arrivals: { dist: 'fixed', a: 5 }, maxWalkers: 2500 });
  const r = sim.run(1e9, 1e9), snap = sim.snapshot();
  ok(r.done === true, 'run should report done'); ok(snap.trials === 500 && snap.planned === 1000, 'trials ' + snap.trials + ' of ' + snap.planned);
  ok(snap.limited === true && typeof snap.note === 'string' && snap.note.length > 20, 'limited flag / note: ' + snap.limited + ' ' + snap.note);
  const mean = snap.endpoints.reduce((a, e) => a + e.perTrial.mean, 0); ok(Math.abs(mean - 5) < 1e-9, 'per-trial mean ' + mean + ' (want 5)');
  const full = SIM.create(P, { seed: 5, trials: 100, rule: 'weights', weights: P.w, arrivals: { dist: 'fixed', a: 5 } }); full.run(1e9, 1e9); const fs = full.snapshot();
  ok(fs.limited === false && fs.note === '' && fs.trials === 100, 'an unlimited run is not flagged');
});

/* 4. compare scores must describe what is drawn, and say so when work was skipped */
const rnd = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const arcPairs = (L) => { /* brute force: interleaving arcs (all arcs are drawn above the line) */
  const iv = L.edges.filter((e) => e.from !== e.to).map((e) => [Math.min(L.pos[e.from].ai, L.pos[e.to].ai), Math.max(L.pos[e.from].ai, L.pos[e.to].ai)]); let c = 0;
  for (let i = 0; i < iv.length; i++) for (let j = i + 1; j < iv.length; j++) { const [a, b] = iv[i], [c2, d] = iv[j]; if ((a < c2 && c2 < b && b < d) || (c2 < a && a < d && d < b)) c++; }
  return c;
};
t('4a arcs: a forward arc a->c and a back arc d->b interleave, and that counts as a crossing', () => {
  const g = mkG(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'c'], ['d', 'b']]), L = E.build(g, { view: 'arc', fold: false });
  ok(arcPairs(L) === 1, 'test set-up: ' + arcPairs(L)); const m = E.metrics(L, 0, L.cls, null, false);
  ok(m.raw.crossings === 1, 'crossings ' + m.raw.crossings); ok(m.scores.crossings < 1, 'score ' + m.scores.crossings);
});
t('4b arcs with more than 3,000 links are counted, not skipped (matches a brute-force count)', () => {
  const r = rnd(11), n = 400, ids = Array.from({ length: n }, (_, i) => 'n' + i), ed = []; for (let i = 1; i < n; i++) ed.push([ids[i - 1], ids[i]]);
  const seen = new Set(); while (ed.length < 3300) { const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a !== b && !seen.has(a + ',' + b) && Math.abs(a - b) !== 1) { seen.add(a + ',' + b); ed.push([ids[a], ids[b]]); } }
  const L = E.build(mkG(ids, ed), { view: 'arc', fold: false }), want = arcPairs(L), m = E.metrics(L, 0, L.cls, null, false);
  ok(L.edges.length > 3000, 'links ' + L.edges.length); ok(m.raw.crossings === want, 'crossings ' + m.raw.crossings + ' want ' + want); ok(m.scores.crossings < 0.5, 'score ' + m.scores.crossings);
  return want + ' crossings';
});
t('4c a network with more than 4,000 segments reports crossings as not measured, not perfect', () => {
  const r = rnd(5), n = 1500, ids = Array.from({ length: n }, (_, i) => 'n' + i), ed = []; for (let i = 1; i < n; i++) ed.push([ids[Math.floor(r() * i)], ids[i]]); while (ed.length < 4300) ed.push([ids[Math.floor(r() * n)], ids[Math.floor(r() * n)]]);
  const L = E.build(mkG(ids, ed), { view: 'network', arrange: 'closeness' }), m = E.metrics(L, 0, L.cls, null, false);
  ok(m.scores.crossings === null, 'score ' + m.scores.crossings); ok(m.notMeasured.indexOf('crossings') >= 0, 'notMeasured ' + JSON.stringify(m.notMeasured));
  ok(m.raw.crossings === null, 'raw ' + m.raw.crossings); ok(E.taskScore(m.scores, 'edit') > 0, 'task scores still work without it');
});
t('4d more than 600 items: neighbors is not measured (null), small maps still measure it', () => {
  const big = chain(700, 1), L = E.build(big, { view: 'flow' }), m = E.metrics(L, 0, L.cls, null, false);
  ok(m.scores.neighbors === null && m.notMeasured.indexOf('neighbors') >= 0, 'neighbors ' + m.scores.neighbors + ' ' + JSON.stringify(m.notMeasured));
  const sm = E.metrics(E.build(chain(30, 1), { view: 'flow' }), 0, null, null, false); ok(typeof sm.scores.neighbors === 'number' && sm.notMeasured.length === 0, 'small ' + sm.scores.neighbors + ' ' + JSON.stringify(sm.notMeasured));
  const rows = E.compare(chain(30, 1), {}); ok(rows.every((r2) => r2.skipped || Array.isArray(r2.notMeasured)), 'compare rows carry notMeasured');
});

/* 5. hidden quadratics */
t('5a 40,000 items with 40,000 different groups: the build time grows in step with the size (lane lookup was one indexOf per item)', () => {
  const mk = (n) => { const g = mkG(Array.from({ length: n }, (_, i) => 'n' + i), Array.from({ length: n - 1 }, (_, i) => ['n' + i, 'n' + (i + 1)]), Array.from({ length: n }, (_, i) => 'g' + i)); return () => E.build(g, { view: 'lanes' }); };
  const r = growth(10000, 40000, mk); ok(r.ratio < 9, '4 times the items took ' + r.ratio.toFixed(1) + ' times as long (' + r.a + ' ms to ' + r.c + ' ms; steady is about 4, the old bug about 16)'); return r.a + ' ms to ' + r.c + ' ms (' + r.ratio.toFixed(1) + 'x)';
});
t('5b shape view: a 10,000-item chain (every item a choke point) in under 1 s', () => {
  const { ms } = timed(() => E.build(chain(10000, 1), { view: 'shape' })); ok(ms < 1000, ms + ' ms'); return ms + ' ms';
});
t('5c shape view: stretches and loops are the same as the slow remove-one-choke-point-and-search way (60 random graphs)', () => {
  const r = rnd(99); let checked = 0;
  for (let k = 0; k < 60; k++) {
    let n = 8 + Math.floor(r() * 40); const ed = [];
    if (k % 2) { /* a chain of blocks: hubs with a few parallel items between them, so there are real choke points, plus a few links back */
      let hub = 0; n = 1; const blocks = 3 + Math.floor(r() * 6);
      for (let b = 0; b < blocks; b++) { const w = 1 + Math.floor(r() * 3), next = n + w; for (let q = 0; q < w; q++) { ed.push([hub, n + q]); ed.push([n + q, next]); if (r() < 0.3 && q > 0) ed.push([n + q - 1, n + q]); } hub = next; n = next + 1; }
      n = hub + 1; for (let q = 0; q < 3; q++) ed.push([Math.floor(r() * n), Math.floor(r() * n)]);
    } else {
      for (let i = 1; i < n; i++) ed.push([Math.floor(r() * i), i]);
      const extra = Math.floor(r() * n); for (let q = 0; q < extra; q++) ed.push([Math.floor(r() * n), Math.floor(r() * n)]);
    }
    const ids = Array.from({ length: n }, (_, i) => 'n' + i), g = mkG(ids, ed.map(([a, b]) => ['n' + a, 'n' + b]));
    if (k % 3 === 0 || k % 2) g.nodes.forEach((nd, i) => { if (i > n - 4) nd.valence = 'good'; });
    const P = E.prepare(g), imp = E.importance(P), L = E.build(g, { view: 'shape' }), spine = imp.spine, owner = new Array(P.n).fill(-1);
    spine.forEach((c, si) => { const w = E.bfs(P, P.start, c); for (let i = 0; i < P.n; i++) if (i !== c && w[i] < 0 && imp.depth[i] >= 0) owner[i] = si; });
    spine.forEach((c, si) => { owner[c] = si; });
    const isS = new Set(spine), want = spine.map(() => []);
    for (let i = 0; i < P.n; i++) { if (imp.depth[i] < 0 || isS.has(i)) continue; const sg = owner[i] >= 0 ? owner[i] : 0; if (want[sg]) want[sg].push(P.nodes[i].id); }
    ok(L.segs.length === spine.length, 'segment count');
    L.segs.forEach((sg, si) => {
      ok(JSON.stringify(sg.pageIds) === JSON.stringify(want[si]), 'graph ' + k + ' stretch ' + si + ' items ' + sg.pageIds + ' want ' + want[si]);
      const inside = new Set(want[si].concat([P.nodes[spine[si]].id])), end = spine[si + 1] !== undefined ? spine[si + 1] : -1; let loops = false;
      for (let e = 0; e < P.m; e++) { const a = P.from[e], b = P.to[e]; if (inside.has(P.nodes[a].id) && inside.has(P.nodes[b].id) && imp.depth[b] <= imp.depth[a] && b !== end) loops = true; }
      ok(/with a loop/.test(sg.pattern) === loops, 'graph ' + k + ' stretch ' + si + ' loop flag');
      checked++;
    });
  }
  return checked + ' stretches';
});
t('5d group clusters: 6,000 overlapping group circles are pushed apart in under 1 s with nothing left touching (was every pair, many times)', () => {
  const k = 6000, r = rnd(3), X = new Float64Array(k * 2), rads = new Float64Array(k); for (let i = 0; i < k; i++) { X[i * 2] = r() * 4000; X[i * 2 + 1] = r() * 4000; rads[i] = 12 + r() * 30; }
  const { ms } = timed(() => E.separateGroups(X, k, (q) => rads[q]));
  let touching = 0; const cell = 100, grid = new Map(); for (let i = 0; i < k; i++) { const key = Math.floor(X[i * 2] / cell) + ',' + Math.floor(X[i * 2 + 1] / cell); (grid.get(key) || grid.set(key, []).get(key)).push(i); }
  for (let i = 0; i < k; i++) { const cx = Math.floor(X[i * 2] / cell), cy = Math.floor(X[i * 2 + 1] / cell); for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) for (const j of grid.get((cx + gx) + ',' + (cy + gy)) || []) if (j > i && Math.hypot(X[i * 2] - X[j * 2], X[i * 2 + 1] - X[j * 2 + 1]) < rads[i] + rads[j]) touching++; }
  ok(ms < 1000, ms + ' ms'); ok(touching < k * 0.02, touching + ' pairs still touching'); return ms + ' ms, ' + touching + ' touching';
});
t('5e the Group clusters arrangement with 4,000 different groups still lays out and nothing touches', () => {
  const n = 4000, g = mkG(Array.from({ length: n }, (_, i) => 'n' + i), Array.from({ length: n - 1 }, (_, i) => ['n' + i, 'n' + (i + 1)]), Array.from({ length: n }, (_, i) => 'g' + i));
  const L = E.build(g, { view: 'network', arrange: 'groups' }); let t2 = 0; const N = L.nodes, cell = 80, grid = new Map();
  N.forEach((a, i) => { const key = Math.floor(a.cx / cell) + ',' + Math.floor(a.cy / cell); (grid.get(key) || grid.set(key, []).get(key)).push(i); });
  N.forEach((a, i) => { const cx = Math.floor(a.cx / cell), cy = Math.floor(a.cy / cell); for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) for (const j of grid.get((cx + gx) + ',' + (cy + gy)) || []) if (j > i && Math.hypot(a.cx - N[j].cx, a.cy - N[j].cy) < a.w / 2 + N[j].w / 2) t2++; });
  ok(t2 === 0, t2 + ' touching');
});
t('5f scene: 30,000 links with 30,000 different link colors (by category): the drawing time grows in step with the size', () => {
  const mk = (n) => { const g = mkG(Array.from({ length: n }, (_, i) => 'n' + i), Array.from({ length: n - 1 }, (_, i) => ['n' + i, 'n' + (i + 1)])); g.edges.forEach((e, i) => { e.attrs = { cat: 'c' + i }; }); const L = E.build(g, { view: 'network', arrange: 'circle', edgeColorBy: 'col:cat' }); ok(L.ch.ecolor && L.ch.ecolor.kind === 'cat', 'set-up: categories'); return () => { const S = SC.make(L, { theme: 'light', colorBy: 'group' }); ok(S.curves.length > n - 1000, 'curves ' + S.curves.length); return S; }; };
  const r = growth(7500, 30000, mk); ok(r.ratio < 9, '4 times the links took ' + r.ratio.toFixed(1) + ' times as long (' + r.a + ' ms to ' + r.c + ' ms; steady is about 4)'); return r.a + ' ms to ' + r.c + ' ms (' + r.ratio.toFixed(1) + 'x)';
});
t('5g Sankey scene: 6,000 bars with end values and labels draw in under 1 s (was one pass over all links per bar)', () => {
  const n = 6000, e = []; for (let i = 1; i <= n / 3; i++) e.push(['n0', 'n' + i]); for (let i = n / 3 + 1; i < n; i++) e.push(['n' + (1 + (i % (n / 3))), 'n' + i]);
  const L = E.build(mkG(Array.from({ length: n }, (_, i) => 'n' + i), e), { view: 'sankey', amounts: true, widthBy: 'weight', colorBy: 'group', sk: {} }); ok(L.sk, 'set-up: Sankey layout');
  const { r: S, ms } = timed(() => SC.make(L, { theme: 'light', colorBy: 'group', sk: { nodeValues: true } })); ok(S.labels.length > 1000, 'labels ' + S.labels.length); ok(ms < 1000, ms + ' ms'); return ms + ' ms';
});
t('5h Sankey layout: a 400-item chain with a link from the first item to every other is capped (not 80,000 bands) and says so', () => {
  const n = 400, ids = Array.from({ length: n }, (_, i) => 'n' + i), e = []; for (let i = 1; i < n; i++) e.push([ids[i - 1], ids[i]]); for (let i = 2; i < n; i++) e.push([ids[0], ids[i]]);
  const L = E.build(mkG(ids, e), { view: 'sankey', amounts: true, widthBy: 'weight', colorBy: 'group' });
  const { r: R, ms } = timed(() => SK.layout(L)); ok(R.bands.length < 30000, R.bands.length + ' bands'); ok(R.simplified > 0 && /long links/.test(R.note), 'note: ' + R.note); ok(ms < 800, ms + ' ms');
  const usable = L.edges.filter((x) => x.kind !== 'self' && x.flow > 1e-9).length, drawn = new Set(R.bands.map((b) => b.edge).concat(R.loops.map((l) => l.edge))).size; ok(drawn === usable, 'every link is still drawn: ' + drawn + ' of ' + usable);
  return R.bands.length + ' bands, ' + R.simplified + ' links drawn straight through, ' + ms + ' ms';
});
t('5i Sankey layout: a small map is not changed by the cap (no note, every long link routed)', () => {
  const ids = Array.from({ length: 30 }, (_, i) => 'n' + i), e = []; for (let i = 1; i < 30; i++) e.push([ids[i - 1], ids[i]]); for (let i = 2; i < 30; i += 3) e.push([ids[0], ids[i]]);
  const L = E.build(mkG(ids, e), { view: 'sankey', amounts: true, widthBy: 'weight', colorBy: 'group' }), R = SK.layout(L); ok(R.simplified === 0 && R.note === '', 'simplified ' + R.simplified);
});
t('5i2 Sankey layout: a big random network with links drawn straight through still gets a real crossing count (was NaN)', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const n = 1100, ids = Array.from({ length: n }, (_, i) => 'n' + i), e = []; for (let i = 1; i < n; i++) e.push([ids[Math.floor(rnd() * i)], ids[i]]); for (let k = 0; k < n * 2; k++) { const a = Math.floor(rnd() * n), b = Math.floor(rnd() * n); if (a !== b) e.push([ids[a], ids[b]]); }
  const L = E.build(mkG(ids, e), { view: 'sankey', amounts: true, widthBy: 'weight', colorBy: 'group' }), R = SK.layout(L);
  ok(R.simplified > 0, 'set-up: links drawn straight through ' + R.simplified); ok(Number.isFinite(R.crossingWeight), 'crossingWeight ' + R.crossingWeight);
  return R.simplified + ' links straight through, crossingWeight ' + R.crossingWeight;
});
t('5j folding a long chain still makes one run (visited marks replaced run.indexOf)', () => {
  const ids = Array.from({ length: 50 }, (_, i) => 'n' + i).concat(['x']), ed = [['n0', 'x']]; for (let i = 1; i < 50; i++) ed.push([ids[i - 1], ids[i]]);
  const P = E.prepare(mkG(ids, ed)), imp = E.importance(P), G = E.mapGraph(P, imp, { fold: true });
  ok(G.runs.length === 1 && G.runs[0].length === 48 && G.nodes.length === 4, 'runs ' + G.runs.map((r) => r.length) + ' nodes ' + G.nodes.length);
});

t('5k spread: wide makes the story views wider, tight and no choice are the same drawing', () => {
  const ids = Array.from({ length: 120 }, (_, i) => 'p' + i), e = []; for (let i = 1; i < 120; i++) { e.push([ids[i - 1], ids[i]]); if (i > 3 && i % 3 === 0) e.push([ids[i - 3], ids[i]]); }
  const g = mkG(ids, e);
  ['flow', 'down', 'spine', 'lanes'].forEach((view) => {
    const none = E.build(g, { view, dir: 'TB' }), tight = E.build(g, { view, dir: 'TB', spread: 'tight' }), wide = E.build(g, { view, dir: 'TB', spread: 'wide' });
    ok(JSON.stringify(none.nodes) === JSON.stringify(tight.nodes), view + ': tight is not the old drawing'); ok(wide.width > none.width * 1.05, view + ': wide ' + wide.width + ' against ' + none.width);
  });
  const lr = E.build(g, { view: 'flow', dir: 'LR' }), lw = E.build(g, { view: 'flow', dir: 'LR', spread: 'wide' }); ok(lw.width > lr.width * 1.05, 'left to right: wide ' + lw.width + ' against ' + lr.width);
  return 'top-to-bottom width ' + Math.round(E.build(g, { view: 'flow', dir: 'TB' }).width) + ' to ' + Math.round(E.build(g, { view: 'flow', dir: 'TB', spread: 'wide' }).width);
});

/* 6. picking */
t('6a matrix: every link cell can be picked, also below the diagonal (3-cycle a>b, b>c, c>a)', () => {
  const L = E.build(mkG(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a']]), { view: 'matrix' }), S = SC.make(L, { theme: 'light' }), M = S.matrix; let seen = 0;
  M.at.forEach((ei, key) => {
    const iy = Math.floor(key / M.n), jx = key % M.n, h = SC.hit(S, M.head + jx * M.cell + M.cell / 2, M.head + iy * M.cell + M.cell / 2, 1);
    ok(h.type === 'edge' && h.edge === ei && h.from === M.ids[iy] && h.to === M.ids[jx], 'cell row ' + iy + ' col ' + jx + ' gave ' + JSON.stringify({ type: h.type, edge: h.edge })); seen++;
  });
  ok(seen === 3, 'cells ' + seen);
  const lab = SC.hit(S, 20, M.head + M.cell / 2, 1); ok(lab.type === 'node', 'the row label area still picks the item: ' + lab.type);
});
t('6b a long straight link (item at 0,0 to item at 3000,3000) can be hovered anywhere along it', () => {
  const L = E.build(mkG(['a', 'b'], [['a', 'b']]), { view: 'network', arrange: 'circle' });
  L.nodes[0].cx = 0; L.nodes[0].cy = 0; L.nodes[1].cx = 3000; L.nodes[1].cy = 3000;
  const S = SC.make(L, { theme: 'light' }); const h = SC.hit(S, 1500, 1500, 1); ok(h.type === 'edge' && h.edge === 0, 'middle: ' + h.type);
  const h2 = SC.hit(S, 700, 700, 1); ok(h2.type === 'edge', 'near the start: ' + h2.type); const h3 = SC.hit(S, 2200, 2204, 1); ok(h3.type === 'edge', 'near the end: ' + h3.type);
  const miss = SC.hit(S, 1500, 1900, 1); ok(miss.type !== 'edge', 'a point 400 units off the link is not the link: ' + miss.type);
});

/* 7. the turn cache (plan: true) must follow theme and labels */
t('7 plan: true keeps looks between camera angles but not across a theme change or a new label function', () => {
  const ids = Array.from({ length: 40 }, (_, i) => 'n' + i), ed = []; for (let i = 1; i < 40; i++) ed.push([ids[(i * 7) % i], ids[i]]);
  const g = mkG(ids, ed, ids.map((_, i) => 'g' + (i % 3))), L = E.build(g, { view: 'network', arrange: 'sphere' }); ok(L.is3d, 'set-up: 3D');
  const key = (S) => JSON.stringify({ d: S.dots.map((d) => d.fill), l: S.labels.map((x) => x.t + '|' + x.color), c: S.curves.map((c) => c.color) });
  const base = { colorBy: 'group', cam: { yaw: 0.6, pitch: 0.35, persp: 2.4 } };
  SC.make(L, Object.assign({ plan: true, theme: 'light' }, base));
  const dark = SC.make(L, Object.assign({ plan: true, theme: 'dark' }, base)), darkFresh = SC.make(L, Object.assign({ theme: 'dark' }, base));
  ok(key(dark) === key(darkFresh), 'a dark picture after a light one has light colors');
  const f1 = (n) => 'A-' + n.label, f2 = (n) => 'B-' + n.label;
  SC.make(L, Object.assign({ plan: true, theme: 'dark', labelFn: f1 }, base));
  const second = SC.make(L, Object.assign({ plan: true, theme: 'dark', labelFn: f2 }, base)); ok(second.labels.some((x) => /^B-/.test(x.t)) && !second.labels.some((x) => /^A-/.test(x.t)), 'labels: ' + second.labels.slice(0, 3).map((x) => x.t));
  const net0 = L.__plan.net;
  const again = SC.make(L, Object.assign({ plan: true, theme: 'dark', labelFn: f2 }, base, { cam: { yaw: 0.9, pitch: 0.35, persp: 2.4 } })); ok(again.labels.some((x) => /^B-/.test(x.t)), 'same settings still draw'); ok(L.__plan.net === net0, 'same settings must keep the cache (turning stays fast)');
});

/* 8. SVG export matches the canvas: dimming, label backings, label limit */
t('8a SVG export: dimmed items are exported dimmed; an undimmed scene has no opacity attributes at all', () => {
  const g = mkG(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]), L = E.build(g, { view: 'flow' }), S = SC.make(L, { theme: 'light' });
  const plain = SC.toSvg(S, 't'); ok(!/ opacity=/.test(plain), 'plain scene should have no opacity attributes');
  SC.style(S, { focus: new Set([S.nodes[0].key]) }); const dim = SC.toSvg(S, 't');
  ok(/ opacity="0\.22"/.test(dim), 'a dimmed item must carry opacity 0.22'); ok((dim.match(/ opacity="0\.22"/g) || []).length >= 4, 'dimmed boxes, their labels and links: ' + (dim.match(/ opacity=/g) || []).length);
  SC.style(S, { focus: null }); ok(SC.toSvg(S, 't') === plain, 'after clearing the dimming the export is byte-for-byte the plain one');
});
t('8b SVG export: link labels keep their pale backing', () => {
  const g = mkG(['a', 'b'], [['a', 'b']]); g.edges[0].label = 'hello there';
  const S = SC.make(E.build(g, { view: 'flow' }), { theme: 'light' }), bgl = S.labels.filter((l) => l.bg); ok(bgl.length === 1, 'set-up: one backed label, got ' + bgl.length);
  const svg = SC.toSvg(S, 't'), i = svg.indexOf('>hello there<'); ok(i > 0, 'label text exported'); const before = svg.slice(Math.max(0, i - 400), i);
  ok(/<rect [^>]*fill="rgba\([^"]*0\.82\)"[^>]*\/>\s*<text [^>]*$/.test(before), 'a backing rect right before the text: ' + before.slice(-200));
});
t('8c SVG export: labels stop at 2,500 in list order, like the canvas (not at 1,500 with the low-priority ones dropped)', () => {
  const S = SC.make(E.build(mkG(['a', 'b'], [['a', 'b']]), { view: 'flow' }), { theme: 'light' }), base = S.labels[0];
  const mkLabels = (n) => Array.from({ length: n }, (_, i) => Object.assign({}, base, { t: 'L' + i, minK: 0.9 }));
  S.labels = mkLabels(2400); const c1 = (SC.toSvg(S, 't').match(/<text /g) || []).length; ok(c1 === 2400, '2,400 labels gave ' + c1);
  S.labels = mkLabels(2600); const svg = SC.toSvg(S, 't'), c2 = (svg.match(/<text /g) || []).length; ok(c2 === 2500, '2,600 labels gave ' + c2); ok(svg.indexOf('>L2499<') > 0 && svg.indexOf('>L2500<') < 0, 'the first 2,500 in list order');
});

/* 9. smaller Sankey items */
t('9 an empty Sankey has height 0 (not -Infinity) and applies cleanly', () => {
  const L = { nodes: [], edges: [], pos: {} }, R = SK.layout(L); ok(R.height === 0 && isFinite(R.width), 'height ' + R.height + ' width ' + R.width);
  SK.apply(L, R); ok(L.height === 0, 'L.height ' + L.height);
  const L2 = E.build(mkG(['a'], []), { view: 'sankey', amounts: true, widthBy: 'weight', sk: {} }); ok(isFinite(L2.height) && isFinite(L2.width), 'one item alone: ' + L2.height + ' x ' + L2.width);
});
t('12 two link filters keep only the links that pass both (edgeFacets)', () => {
  const g = mkG(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'd']]);
  const at = [{ k: 'x', m: 'y' }, { k: 'x', m: 'z' }, { k: 'w', m: 'y' }, { k: 'x', m: 'y' }]; g.edges.forEach((e, i) => { e.attrs = at[i]; });
  const edgesOf = (o) => E.build(g, Object.assign({ view: 'network', arrange: 'force', colorBy: 'group' }, o)).edges.length;
  ok(edgesOf({}) === 4, 'no filter');
  ok(edgesOf({ edgeFacets: [{ col: 'k', values: ['x'] }] }) === 3, 'one filter');
  ok(edgesOf({ edgeFacets: [{ col: 'k', values: ['x'] }, { col: 'm', values: ['y'] }] }) === 2, 'two filters must both apply');
  ok(edgesOf({ edgeFacet: { col: 'k', values: ['x'] } }) === 3, 'the old single option still works');
});
t('13 hiding a group does not recolor the others (groupOrder keeps each group in its place)', () => {
  const g = mkG(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']], ['alpha', 'beta', 'gamma']);
  const colorOf = (S, grp) => JSON.stringify(S.legend.filter((l) => l.t === grp)[0].c);
  const full = SC.make(E.build(g, { view: 'network', arrange: 'force', colorBy: 'group' }), { theme: 'light', groupOrder: ['alpha', 'beta', 'gamma'] });
  const g2 = mkG(['b', 'c'], [['b', 'c']], ['beta', 'gamma']);
  const part = SC.make(E.build(g2, { view: 'network', arrange: 'force', colorBy: 'group' }), { theme: 'light', groupOrder: ['alpha', 'beta', 'gamma'] });
  ok(colorOf(full, 'beta') === colorOf(part, 'beta') && colorOf(full, 'gamma') === colorOf(part, 'gamma'), 'colors moved when alpha was hidden');
  const old = SC.make(E.build(g2, { view: 'network', arrange: 'force', colorBy: 'group' }), { theme: 'light' });
  ok(colorOf(old, 'beta') !== colorOf(full, 'beta'), 'control: without groupOrder the colors do move');
});

/* Sankey whose start item has no links out: nothing flows, so it used to draw every item in one column with no bands (2026.10.31); now it draws the link weights and says so */
t('Sankey with a dead-end start draws the link weights instead of one empty column', () => {
  const g = mkG(['s', 'a', 'b', 'c', 'd'], [['a', 'b', 2], ['a', 'c', 1], ['b', 'd', 3], ['c', 'd', 1]]);
  g.start = 's';
  const L = E.build(g, { view: 'sankey', colorBy: 'group', sk: {} });
  const cols = new Set(L.nodes.filter((n) => n.id !== 's').map((n) => Math.round(n.x))).size;
  ok(L.weightsFallback === true, 'no fallback flag');
  ok(L.sk && L.sk.bands && L.sk.bands.length === 4, 'bands ' + (L.sk && L.sk.bands && L.sk.bands.length));
  ok(cols >= 3, 'columns ' + cols);
  const g2 = mkG(['a', 'b', 'c'], [['a', 'b', 1], ['b', 'c', 1]]);
  const L2 = E.build(g2, { view: 'sankey', colorBy: 'group', sk: {} });
  ok(!L2.weightsFallback && L2.sk.bands.length === 2, 'a start with links out keeps its flows');
});
if (bad) process.exit(1);

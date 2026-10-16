/* Copyright (c) 2026 LFC Foundry. MIT License. The 3D force arrangement must stay true to the number of links between items at any size. */
'use strict';
global.NFMColumns = require('../src/columns.js');
const E = require('../src/engine.js'); global.NFMEngine = E;
const GEN = require('../bench/gen.js'); let bad = 0;
const t = (name, fn) => { const t0 = Date.now(); try { const r = fn(); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)' + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
/** Positions of the items of the largest connected piece, with its links (the same score the tester uses: 60 breadth-first sources, best-scale fit, mean of (hops - scale*distance)^2 / hops^2; lower is truer). */
function score(g, L) {
  const n = g.nodes.length, idx = new Map(g.nodes.map((nd, i) => [nd.id, i])), adj = Array.from({ length: n }, () => []);
  g.edges.forEach((e) => { const a = idx.get(e.from), b = idx.get(e.to); if (a !== b) { adj[a].push(b); adj[b].push(a); } });
  const comp = new Int32Array(n).fill(-1), q = new Int32Array(n); let best = 0, bestSize = 0, c = 0;
  for (let i = 0; i < n; i++) if (comp[i] < 0) { let h = 0, tl = 1; q[0] = i; comp[i] = c; while (h < tl) { const u = q[h++]; for (const w of adj[u]) if (comp[w] < 0) { comp[w] = c; q[tl++] = w; } } if (tl > bestSize) { bestSize = tl; best = c; } c++; }
  const pos = new Map(L.nodes.map((nd) => [nd.nodeId || nd.id, nd])), P = g.nodes.map((nd) => { const p = pos.get(nd.id); return [p.cx, p.cy, p.z]; });
  const mem = []; for (let i = 0; i < n; i++) if (comp[i] === best) mem.push(i);
  const ns = Math.min(60, mem.length), dist = new Int32Array(n), pairs = []; let num = 0, den = 0;
  for (let s = 0; s < ns; s++) {
    const src = mem[Math.floor(s * mem.length / ns)]; dist.fill(-1); dist[src] = 0; q[0] = src; let h = 0, tl = 1;
    while (h < tl) { const u = q[h++]; for (const w of adj[u]) if (dist[w] < 0) { dist[w] = dist[u] + 1; q[tl++] = w; } }
    for (const v of mem) if (v !== src && dist[v] > 0) { const e = Math.hypot(P[src][0] - P[v][0], P[src][1] - P[v][1], P[src][2] - P[v][2]); pairs.push(dist[v], e); num += e / dist[v]; den += e * e / (dist[v] * dist[v]); }
  }
  const sc = num / den; let st = 0; for (let i = 0; i < pairs.length; i += 2) st += Math.pow(pairs[i] - sc * pairs[i + 1], 2) / (pairs[i] * pairs[i]);
  // spread along the three principal axes (square roots of the eigenvalues of the covariance matrix, by Jacobi turns): smallest over largest
  const m = [0, 0, 0]; mem.forEach((i) => { for (let a = 0; a < 3; a++) m[a] += P[i][a] / mem.length; });
  let A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; mem.forEach((i) => { for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) A[a][b] += (P[i][a] - m[a]) * (P[i][b] - m[b]) / mem.length; });
  for (let sw = 0; sw < 40; sw++) {
    let p = 0, r = 1, mx = Math.abs(A[0][1]); if (Math.abs(A[0][2]) > mx) { p = 0; r = 2; mx = Math.abs(A[0][2]); } if (Math.abs(A[1][2]) > mx) { p = 1; r = 2; mx = Math.abs(A[1][2]); } if (mx < 1e-9) break;
    const th = (A[r][r] - A[p][p]) / (2 * A[p][r]), tt = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), cs = 1 / Math.sqrt(tt * tt + 1), sn = tt * cs, B = A.map((row) => row.slice());
    for (let k = 0; k < 3; k++) { B[k][p] = cs * A[k][p] - sn * A[k][r]; B[k][r] = sn * A[k][p] + cs * A[k][r]; }
    const D = B.map((row) => row.slice()); for (let k = 0; k < 3; k++) { D[p][k] = cs * B[p][k] - sn * B[r][k]; D[r][k] = sn * B[p][k] + cs * B[r][k]; } A = D;
  }
  const ev = [A[0][0], A[1][1], A[2][2]].map((v) => Math.sqrt(Math.max(0, v))).sort((a, b) => a - b);
  return { err: st / (pairs.length / 2), flat: ev[0] / ev[2] };
}
const build = (g) => E.build(JSON.parse(JSON.stringify(NFMColumns.derive(g))), { view: 'network', arrange: 'force3d', colorBy: 'group' });
const bigOnes = [['moderate', 3000, 0.125, 0.3], ['complex', 3000, 0.15, 0.3]];
bigOnes.forEach(([kind, n, lim, flatMin]) => t('3D force, ' + kind + ' ' + n.toLocaleString() + ' items: hop error under ' + lim + ', and not flat or collapsed', () => {
  const g = GEN.graph(kind, n, 11), L = build(g), s = score(g, L);
  ok(s.err < lim, 'hop error ' + s.err.toFixed(3) + ' (limit ' + lim + ')');
  ok(s.flat >= flatMin, 'smallest/largest spread ' + s.flat.toFixed(2) + ' (limit ' + flatMin + ')');
  ok(L.is3d && L.nodes.every((nd) => isFinite(nd.cx) && isFinite(nd.cy) && isFinite(nd.z)), 'positions must be finite');
  return 'error ' + s.err.toFixed(3) + ', spread ' + s.flat.toFixed(2);
}));
t('3D force: the same data gives the same picture', () => {
  const g = GEN.graph('moderate', 800, 3), A = build(g), B = build(g);
  for (let i = 0; i < A.nodes.length; i++) ok(A.nodes[i].cx === B.nodes[i].cx && A.nodes[i].cy === B.nodes[i].cy && A.nodes[i].z === B.nodes[i].z, 'not repeatable');
});
const mk = (n, edges) => ({ start: 'n0', nodes: Array.from({ length: n }, (_, i) => ({ id: 'n' + i, label: 'n' + i, group: '', valence: '', ghost: false, attrs: {} })), edges: edges.map(([a, b]) => ({ from: 'n' + a, to: 'n' + b, weight: 1, label: '', kind: '', attrs: {} })) });
t('3D force: no items, one, two, loners, self-links, repeated links, several pieces: all finite and apart', () => {
  const cases = [mk(0, []), mk(1, []), mk(2, [[0, 1]]), mk(2, []), mk(3, [[0, 0]]), mk(3, [[0, 1], [0, 1], [1, 2]]), mk(40, Array.from({ length: 12 }, (_, i) => [i, (i + 1) % 12]).concat([[20, 21], [22, 23], [24, 24]]))];
  cases.forEach((g) => {
    const L = build(g), seen = new Set();
    L.nodes.forEach((nd) => { ok(isFinite(nd.cx) && isFinite(nd.cy) && isFinite(nd.z), 'non-finite position with ' + g.nodes.length + ' items'); const k = [nd.cx, nd.cy, nd.z].map((v) => v.toFixed(2)).join(); ok(!seen.has(k), 'two items on one spot with ' + g.nodes.length + ' items'); seen.add(k); });
  });
});
t('3D force: a 2,000-leaf hub and a 3,000-item chain finish and stay finite', () => {
  const star = []; for (let i = 1; i <= 2000; i++) star.push([0, i]);
  const chain = []; for (let i = 1; i < 3000; i++) chain.push([i - 1, i]);
  [mk(2001, star), mk(3000, chain)].forEach((g) => { const L = build(g); ok(L.nodes.every((nd) => isFinite(nd.cx) && isFinite(nd.cy) && isFinite(nd.z)), 'non-finite position'); });
});
t('turning a 3D map: reusing what each item looks like gives exactly the same picture, only faster to work out', () => {
  const SC = require('../src/scene.js'), g = GEN.graph('moderate', 800, 11), L = E.build(g, { view: 'network', arrange: 'force3d', colorBy: 'group' }), plan = {};
  const j = (S) => JSON.stringify([S.dots, S.curves.map((c) => [c.P, c.w, c.color, c.arrow]), S.labels.map((l) => [l.x, l.y, l.t, l.size, l.color]), S.nodes.length]);
  SC.make(L, { colorBy: 'group', theme: 'light', plan, cam: { yaw: 0.3, pitch: 0.2, persp: 2.4 } });
  [0.9, 2.0].forEach((yaw) => { const cam = { yaw, pitch: 0.4, persp: 2.4 }; ok(j(SC.make(L, { colorBy: 'group', theme: 'light', plan, cam })) === j(SC.make(L, { colorBy: 'group', theme: 'light', cam })), 'differs at yaw ' + yaw); });
});
t('drawing a map: a plain straight link is written as one quad with the same numbers the general path gives, and the shared buffer is safe to reuse', () => {
  global.NFMScene = require('../src/scene.js'); const R = require('../src/render.js');
  const line = (x0, y0, x1, y1, col, a) => ({ P: [x0, y0, x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, x0 + 2 * (x1 - x0) / 3, y0 + 2 * (y1 - y0) / 3, x1, y1], w: 3, color: col, arrow: false, line: true, a });
  const scene = (curves) => ({ rects: [], dots: [], ribbons: [], polys: [], curves });
  /* the general path (a bent link with two pieces is not a plain segment) gives the reference for a straight one: same endpoints, same normal, same six corners */
  const A = R.tessellate(scene([line(0, 0, 30, 40, [0.1, 0.2, 0.3, 0.8], 0.5)])), a = Array.from(A.mesh);
  ok(A.nMesh === 6 && a.length === 60, 'one quad = 6 corners of 10 numbers');
  const nx = -40 / 50, ny = 30 / 50, corner = (k) => a.slice(k * 10, k * 10 + 10), c0 = corner(0), c1 = corner(1), c2 = corner(2), c5 = corner(5);
  ok(c0[0] === 0 && c0[1] === 0 && Math.abs(c0[2] - nx) < 1e-6 && Math.abs(c0[3] - ny) < 1e-6 && c0[4] === 1.5 && c0[5] === -1, 'first corner');
  ok(c1[5] === 1 && c2[0] === 30 && c2[1] === 40 && c2[5] === -1 && c5[0] === 30 && c5[5] === 1, 'other corners');
  ok(Math.abs(c0[9] - 0.4) < 1e-6 && Math.abs(c0[6] - 0.1) < 1e-6, 'color and item alpha');
  /* a zero-length link has no direction but must not produce NaN */
  const Z = Array.from(R.tessellate(scene([line(5, 5, 5, 5, [1, 1, 1, 1])])).mesh); ok(Z.every(isFinite), 'zero-length link is finite');
  /* the second picture reuses the first one's buffer: the first must have been copied out already, and the second must be complete and clean */
  const B = R.tessellate(scene([line(0, 0, 10, 0, [1, 0, 0, 1]), line(0, 0, 0, 10, [0, 1, 0, 1])])), b = Array.from(B.mesh);
  ok(B.nMesh === 12 && b.length === 120 && b.every(isFinite), 'two links, nothing left over from the earlier picture');
  ok(b[2] === 0 && b[3] === 1 && b[62] === -1 && b[63] === 0, 'normals of a flat and a tall link');
});
t('turning a big 3D map on the card: a new angle gives the same places, paint order, names and link ends as a full picture, and styling carries over', () => {
  const SC = require('../src/scene.js'), g = GEN.graph('moderate', 1200, 13), L = E.build(g, { view: 'network', arrange: 'force3d', colorBy: 'group' });
  const base = (cam, extra) => Object.assign({ colorBy: 'group', theme: 'light', cam }, extra);
  const S = SC.make(L, base({ yaw: 0.3, pitch: 0.2, persp: 2.4 }, { plan: {}, rig: true }));
  ok(S.rig && typeof S.turnTo === 'function' && S.rig.m > 1500, 'a big 3D map with plain links can be turned on the card');
  const c1 = { yaw: 1.37, pitch: 0.55, persp: 2.8 }, T = S.turnTo(c1, 2), F = SC.make(L, base(c1));
  const byKey = new Map(F.nodes.map((r) => [r.key, r])); let worst = 0;
  S.nodes.forEach((r) => { const f = byKey.get(r.key); worst = Math.max(worst, Math.abs(f.x - r.x), Math.abs(f.y - r.y), Math.abs(f.w - r.w)); });
  ok(worst < 1e-9, 'item places differ by ' + worst);
  ok(S.nodes.slice().sort((a, b) => a.o - b.o).map((r) => r.key).join() === F.nodes.map((r) => r.key).join(), 'paint order');
  const names = (sc) => sc.labels.filter((l) => l.minK <= 2).map((l) => [sc.nodes[l.node].key, l.x.toFixed(4), l.y.toFixed(4), l.t, l.size.toFixed(4), JSON.stringify(l.color), l.bold, l.minK.toFixed(4)].join('|')).join('\n');
  ok(names(S) === names(F) && S.labels.length > 10, 'the names that can be seen at zoom 2');
  /* the card's arithmetic (the same lines the shaders use) against the curves of the full picture */
  const rig = S.rig, proj = (q) => { const x = rig.pos[q * 4], y = rig.pos[q * 4 + 1], z = rig.pos[q * 4 + 2], x1 = x * T.cy + z * T.sy, z1 = -x * T.sy + z * T.cy, y2 = y * T.cp - z1 * T.sp, z2 = y * T.sp + z1 * T.cp, f = T.D3 / (T.D3 + z2); return { p: [T.c3x + x1 * f, T.c3y + y2 * f], r: rig.pos[q * 4 + 3] * f, f, fd: T.fadeOn ? 0.42 + 0.58 * (1 - (z2 - T.dmin) * T.inv) : 1 }; };
  let we = 0, ww = 0, wa = 0;
  for (let k = 0; k < rig.m; k++) {
    const e = rig.edgeF, s0 = proj(e[k * 8]), t0 = proj(e[k * 8 + 1]), dx = t0.p[0] - s0.p[0], dy = t0.p[1] - s0.p[1], d = Math.sqrt(dx * dx + dy * dy) || 1, c = F.curves[k];
    ok(c.edge === rig.edgeIdx[k], 'link order');
    we = Math.max(we, Math.abs(c.P[0] - (s0.p[0] + dx / d * s0.r)), Math.abs(c.P[6] - (t0.p[0] - dx / d * t0.r)), Math.abs(c.P[7] - (t0.p[1] - dy / d * t0.r)));
    ww = Math.max(ww, Math.abs(c.w - e[k * 8 + 2] * (s0.f + t0.f) / 2)); wa = Math.max(wa, Math.abs(c.color[3] - e[k * 8 + 7] * (s0.fd + t0.fd) / 2));
  }
  ok(we < 1e-9 && ww < 1e-6 && wa < 1e-6, 'link ends ' + we + ' width ' + ww + ' alpha ' + wa);
  /* dimming, a selected item and a selected link carry over to what the card is given */
  const id0 = F.nodes[5].key, id1 = F.nodes[9].key; SC.style(S, { focus: new Set([id0, id1]), sel: new Set([id0]), selEdges: new Set([F.curves[3].edge]) });
  const st = SC.rigStyle(S), q0 = L.nodes.findIndex((n) => n.id === id0), q1 = L.nodes.findIndex((n) => n.id === id1), qOther = L.nodes.findIndex((n) => n.id !== id0 && n.id !== id1);
  ok(st.node[q0 * 8] === 1 && st.node[q0 * 8 + 1] === 1 && st.node[q1 * 8 + 1] === 0 && Math.abs(st.node[qOther * 8] - 0.22) < 1e-6, 'item dimming and ring');
  ok(st.edge[3 * 4 + 1] === 1 && st.edge[3 * 4] === 1 && st.edge[2 * 4 + 1] === 0 && Math.abs(st.edge[2 * 4] - 0.08) < 1e-6, 'selected and dimmed links');
  /* picking follows the turn, and links are not picked while they live only on the card */
  const k0 = S.nodes[7], cx = k0.x + k0.w / 2, cy = k0.y + k0.h / 2, hit = SC.hit(S, cx, cy, 1, { slop: 2 });
  ok(hit.type === 'node', 'a turned item can still be picked');
  /* maps that cannot be drawn this way keep the ordinary picture */
  const small = E.build(GEN.graph('moderate', 120, 3), { view: 'network', arrange: 'force3d', colorBy: 'group' }), SS = SC.make(small, base({ yaw: 0.3, pitch: 0.2, persp: 2.4 }, { plan: {}, rig: true }));
  ok(!SS.turnTo, 'a small map (arrows on its links) is drawn the ordinary way');
  const bent = SC.make(L, base({ yaw: 0.3, pitch: 0.2, persp: 2.4 }, { plan: {}, rig: true, curve: 0.2 })); ok(!bent.turnTo, 'bent links are drawn the ordinary way');
});
process.exitCode = bad ? 1 : 0;

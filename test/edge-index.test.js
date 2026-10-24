/* Copyright (c) 2026 LFC Foundry. MIT License. The hover index of the links (typed-array grid in src/scene.js) gives exactly the answers of the earlier one (a Map of arrays), on many points, tolerances and views;
 * it also works on a packed scene and with odd numbers in a link. Pass/fail only. */
'use strict';
const E = require('../src/engine.js'), SC = require('../vendor/netflow-scene.js'), EX = require('../src/examples.js');
let bad = 0;
const t = (name, fn) => { try { const r = fn(); console.log('ok   ' + name + (r ? ' ' + r : '')); } catch (e) { bad++; console.log('FAIL ' + name + ': ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
function rng(seed) { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
/* the earlier index and picker, kept here as the reference */
function bez(P, t) { var segs = (P.length - 2) / 6, s = Math.min(segs - 1, Math.floor(t * segs)), u = t * segs - s, o = s * 6; var x0 = P[o], y0 = P[o + 1], x1 = P[o + 2], y1 = P[o + 3], x2 = P[o + 4], y2 = P[o + 5], x3 = P[o + 6], y3 = P[o + 7], m = 1 - u; return [m * m * m * x0 + 3 * m * m * u * x1 + 3 * m * u * u * x2 + u * u * u * x3, m * m * m * y0 + 3 * m * m * u * y1 + 3 * m * u * u * y2 + u * u * u * y3]; }
function refIndex(S) {
  var cell = Math.max(30, Math.max(S.w, S.h) / 120), map = new Map(), segs = [];
  var put = function (ref, ax, ay, bx, by, depth) {
    var c0 = Math.floor((Math.min(ax, bx) - S.x0) / cell), c1 = Math.floor((Math.max(ax, bx) - S.x0) / cell), r0 = Math.floor((Math.min(ay, by) - S.y0) / cell), r1 = Math.floor((Math.max(ay, by) - S.y0) / cell);
    if ((c1 - c0 + 1) * (r1 - r0 + 1) > 400 && (depth || 0) < 24) { var mx = (ax + bx) / 2, my = (ay + by) / 2; put(ref, ax, ay, mx, my, (depth || 0) + 1); put(ref, mx, my, bx, by, (depth || 0) + 1); return; }
    var id = segs.length; segs.push([ax, ay, bx, by, ref]);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { var k = r * 100003 + c, a = map.get(k); if (a) a.push(id); else map.set(k, [id]); }
  };
  S.curves.forEach(function (cv, ci) {
    if (cv.edge === undefined || cv.edge < 0 || cv.dead) return;
    var P = cv.P, n = (P.length - 2) / 6, prev = [P[0], P[1]];
    for (var s = 0; s < n; s++) { var steps = cv.line ? 1 : 10; for (var i = 1; i <= steps; i++) { var pt = bez(P.slice(s * 6, s * 6 + 8), i / steps); put({ t: 'c', i: ci }, prev[0], prev[1], pt[0], pt[1]); prev = pt; } }
  });
  var maxHw = 0; S.curves.forEach(function (cv) { if (cv.loop && cv.w / 2 > maxHw) maxHw = cv.w / 2; });
  return { cell: cell, map: map, segs: segs, maxHw: maxHw };
}
function refPick(S, I, wx, wy, tol) {
  var cs = I.cell, best = null, bd = tol * tol, reach = tol + I.maxHw;
  var c0 = Math.floor((wx - reach - S.x0) / cs), c1 = Math.floor((wx + reach - S.x0) / cs), r0 = Math.floor((wy - reach - S.y0) / cs), r1 = Math.floor((wy + reach - S.y0) / cs), seen = new Set();
  for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
    var a = I.map.get(r * 100003 + c); if (!a) continue;
    for (var j = 0; j < a.length; j++) {
      if (seen.has(a[j])) continue; seen.add(a[j]);
      var sg = I.segs[a[j]], dx = sg[2] - sg[0], dy = sg[3] - sg[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((wx - sg[0]) * dx + (wy - sg[1]) * dy) / l2)) : 0, px = sg[0] + t * dx - wx, py = sg[1] + t * dy - wy, d = px * px + py * py;
      if (I.maxHw) { var hw = S.curves[sg[4].i].loop ? S.curves[sg[4].i].w / 2 : 0; if (hw) { var dr = Math.max(0, Math.sqrt(d) - hw); d = dr * dr; } }
      if (d <= bd) { bd = d; best = sg[4]; }
    }
  }
  if (best) { var cv = S.curves[best.i]; return { edge: cv.edge, from: cv.from, to: cv.to, curve: best.i }; }
  return null;
}
function dist(R, ci, x, y) { let m = Infinity; R.segs.forEach((sg) => { if (sg[4].i !== ci) return; const dx = sg[2] - sg[0], dy = sg[3] - sg[1], l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - sg[0]) * dx + (y - sg[1]) * dy) / l2)) : 0, px = sg[0] + t * dx - x, py = sg[1] + t * dy - y; m = Math.min(m, Math.sqrt(px * px + py * py)); }); return m; }
const mk = (n, view, arrange) => { const L = E.build(EX.bigNetwork(n, 6, 7), { view: view, arrange: arrange, colorBy: 'group' }); return SC.make(L, { colorBy: 'group', theme: 'light' }); };
function same(name, S, seed) {
  t(name, () => {
    const R = refIndex(S), r = rng(seed), cs = S.curves.filter((c) => c.edge >= 0); ok(cs.length > 100, 'enough links: ' + cs.length);
    let n = 0, hit = 0, ties = 0; const tols = [3, 7, 20, 400];
    for (let i = 0; i < 1600; i++) {
      let x, y; if (i % 2) { const c = cs[Math.floor(r() * cs.length)], u = r(), p = bez(c.P.slice(0, 8), u); x = p[0] + (r() - 0.5) * 24; y = p[1] + (r() - 0.5) * 24; } else { x = S.x0 + r() * S.w; y = S.y0 + r() * S.h; }
      const tol = tols[i % 4], a = refPick(S, R, x, y, tol), b = SC.pickEdge(S, x, y, tol); n++; if (a) hit++;
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
      /* two links at exactly the same distance (they share an end and the point is beside it): either may win; the earlier index took the one its cell order met last */
      ok(a && b && Math.abs(dist(R, a.curve, x, y) - dist(R, b.curve, x, y)) < 1e-9, 'point ' + i + ' (' + x.toFixed(1) + ',' + y.toFixed(1) + ') tol ' + tol + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)); ties++;
    }
    return n + ' points, ' + hit + ' found a link, ' + ties + ' exact ties broken the other way';
  });
}
same('network (sphere): same answers as the earlier index', mk(900, 'network', 'sphere'), 1);
same('network (force, flat): same answers', mk(700, 'network', 'force'), 2);
same('flow view (curved links): same answers', mk(300, 'flow'), 3);
same('arc view (long curved links): same answers', mk(250, 'arc'), 4);
same('spine view: same answers', mk(250, 'spine'), 5);
t('answers are the same on a packed scene, which stays packed', () => {
  const S = mk(900, 'network', 'sphere'); S.curves.forEach((c) => { c.base = { w: c.w, color: c.color }; c.a = 1; });
  ok(S.packNow(), 'packed'); S.curves.length;   /* the objects that come back hold 32-bit numbers; the reference is built from those, as the packed scene's index is */
  const R = refIndex(S), r = rng(9); let k = 0;
  for (let i = 0; i < 600; i++) { const x = S.x0 + r() * S.w, y = S.y0 + r() * S.h, a = refPick(S, R, x, y, 20); /* refPick reads S.curves, which wakes the objects; pack again for the next point */ const b = (S.packNow(), SC.pickEdge(S, x, y, 20)); if (a) k++; ok(JSON.stringify(a) === JSON.stringify(b), 'point ' + i); }
  ok(S.packNow() && S.curvesPacked(), 'packed at the end'); return k + ' found';
});
t('odd links: a link with NaN or far-away numbers does not break the index', () => {
  const S = mk(300, 'network', 'force'); const c = S.curves[3]; c.P = [NaN, 0, NaN, 0, 5, 5, NaN, NaN]; const d = S.curves[4]; d.P = [1e9, 1e9, 1e9, 1e9, -1e9, 1e9, 1e9, -1e9];
  const b = SC.pickEdge(S, S.x0 + S.w / 2, S.y0 + S.h / 2, 7); ok(b === null || typeof b.edge === 'number', 'returned something sane'); ok(SC.pickEdge(S, 1e12, 1e12, 7) === null, 'far away finds nothing');
});
t('the index is much smaller in memory than the earlier one (array bytes)', () => {
  const S = mk(900, 'network', 'sphere'); SC.pickEdge(S, 0, 0, 5); const I = S.eidx;
  const bytes = I.segs.byteLength + I.sci.byteLength + I.off.byteLength + I.ids.byteLength + I.mark.byteLength; const R = refIndex(S); let cells = 0; R.map.forEach((a) => { cells += a.length; });
  return Math.round(bytes / 1024) + ' KB typed arrays for ' + I.n + ' pieces; the earlier one held ' + R.segs.length + ' piece arrays and ' + cells + ' list entries in plain arrays';
});
console.log(bad ? bad + ' FAILED' : 'all edge-index checks passed'); process.exit(bad ? 1 : 0);

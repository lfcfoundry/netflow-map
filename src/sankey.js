/*!
 * Net Flow Map river (Sankey) layout, prototype. Copyright (c) 2026 LFC Foundry. MIT License.
 * Takes the engine's River drawing (which layer each item is in, the links and how much flows on each) and lays it out the way a
 * careful Sankey should be: one scale for the whole picture (a band is as thick as its flow, everywhere), item bars as tall as the
 * flow through them, long links routed through the layers in between instead of over the top of other items, an order that
 * minimizes WEIGHTED crossings (big flows crossing big flows cost most), link ends stacked in the order of where they go, and links
 * that run backwards (loops) drawn as bands that circle round below the picture instead of thin lines.
 * Also: measure(), the same yardstick for the old picture and the new one. See docs/SANKEY.md.
 */
var NFMSankey = (function () {
  'use strict';
  var EPS = 1e-9;
  function rng(seed) { var s = seed | 0; return function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /** Weighted crossings between two neighbouring layers: links as [posTop, posBottom, weight]. Sum of w1*w2 over crossing pairs, in n log n. */
  function crossWeight(links, nb) {
    if (links.length < 2) return 0;
    var idx = links.slice().sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; }), bit = new Float64Array(nb + 2), total = 0, i = 0, j, k;
    var add = function (p, w) { for (p++; p <= nb + 1; p += p & -p) bit[p] += w; };
    var sum = function (p) { var s = 0; for (p++; p > 0; p -= p & -p) s += bit[p]; return s; };
    var all = 0;
    while (i < idx.length) {
      j = i; while (j < idx.length && idx[j][0] === idx[i][0]) j++;
      for (k = i; k < j; k++) total += idx[k][2] * (all - sum(idx[k][1]));   // earlier links (smaller top position) that end strictly lower down the page
      for (k = i; k < j; k++) { add(idx[k][1], idx[k][2]); all += idx[k][2]; }
      i = j;
    }
    return total;
  }

  /**
   * Layers for a flow diagram: break cycles by turning the lightest-looking backward links around (weighted Eades-Lin-Smyth), give every item the
   * length of its longest path from a source, pull sources up next to their first consumer, and (optionally) send items that nothing leaves to the last layer.
   * ids: item ids; edges: [{from, to, flow}] with from/to as indexes. Returns { layer: Int32Array, feedback: Set of edge indexes that run backwards }.
   */
  function layering(n, edges, justifySinks) {
    var outE = [], inE = [], i, e;
    for (i = 0; i < n; i++) { outE.push([]); inE.push([]); }
    edges.forEach(function (ed, q) { if (ed.from !== ed.to) { outE[ed.from].push(q); inE[ed.to].push(q); } });
    /* order the items so that few links run backwards */
    var rank = new Int32Array(n), left = [], right = [], alive = new Uint8Array(n), nAlive = n, od = new Float64Array(n), idg = new Float64Array(n);
    for (i = 0; i < n; i++) { outE[i].forEach(function (q) { od[i] += edges[q].flow; }); inE[i].forEach(function (q) { idg[i] += edges[q].flow; }); }
    var remove = function (v) { alive[v] = 0; nAlive--; outE[v].forEach(function (q) { var w = edges[q].to; if (alive[w]) idg[w] -= edges[q].flow; }); inE[v].forEach(function (q) { var w = edges[q].from; if (alive[w]) od[w] -= edges[q].flow; }); };
    var aliveOut = function (v) { return outE[v].some(function (q) { return alive[edges[q].to]; }); }, aliveIn = function (v) { return inE[v].some(function (q) { return alive[edges[q].from]; }); };
    for (i = 0; i < n; i++) alive[i] = 1;
    while (nAlive > 0) {
      var moved = true;
      while (moved) {
        moved = false;
        for (i = 0; i < n; i++) if (alive[i] && !aliveOut(i)) { right.push(i); remove(i); moved = true; }
        for (i = 0; i < n; i++) if (alive[i] && !aliveIn(i)) { left.push(i); remove(i); moved = true; }
      }
      if (nAlive > 0) { var bv = -1, bs = -Infinity; for (i = 0; i < n; i++) if (alive[i] && od[i] - idg[i] > bs) { bs = od[i] - idg[i]; bv = i; } left.push(bv); remove(bv); }
    }
    var seq = left.concat(right.reverse()); seq.forEach(function (v, q) { rank[v] = q; });
    var feedback = new Set(), indeg = new Int32Array(n), layer = new Int32Array(n), succ = [], pred = [];
    for (i = 0; i < n; i++) { succ.push([]); pred.push([]); }
    edges.forEach(function (ed, q) { if (ed.from === ed.to) return; if (rank[ed.from] > rank[ed.to]) feedback.add(q); else { succ[ed.from].push(ed.to); pred[ed.to].push(ed.from); indeg[ed.to]++; } });
    var queue = []; for (i = 0; i < n; i++) if (!indeg[i]) queue.push(i);
    for (var h = 0; h < queue.length; h++) { var u = queue[h]; succ[u].forEach(function (w) { if (layer[w] < layer[u] + 1) layer[w] = layer[u] + 1; if (--indeg[w] === 0) queue.push(w); }); }
    var maxL = 0; for (i = 0; i < n; i++) maxL = Math.max(maxL, layer[i]);
    for (var r = queue.length - 1; r >= 0; r--) { var v = queue[r]; if (!pred[v].length && succ[v].length) { var mn = Infinity; succ[v].forEach(function (w) { mn = Math.min(mn, layer[w]); }); layer[v] = mn - 1; } }
    if (justifySinks) for (i = 0; i < n; i++) if (pred[i].length && !succ[i].length) layer[i] = maxL;
    return { layer: layer, feedback: feedback, levels: maxL + 1, order: seq };
  }

  /**
   * layout(L, opts). L: the River drawing from the engine (L.nodes with .id .layer .label, L.edges with .from .to .flow .kind and, for long links, .pts).
   * opts: unweighted (order as the old picture does: every link counts the same, no restarts), justifySinks, height (picture height to aim for), nodeW (bar width), gapLayer, pad (space between bars), restarts, budgetMs, seed.
   * Returns { nodes: [{id, label, x, y, w, h, layer, flow}], bands: [{edge, from, to, x0, y0a, y0b, x1, y1a, y1b, xm}], loops: [{edge, from, to, d, w, pts}],
   *           width, height, ky (pixels per unit of flow), crossingWeight, ms }.
   */
  function layout(L, opts) {
    opts = opts || {};
    var t0 = Date.now(), nodeW = opts.nodeW || 14, gapLayer = opts.gapLayer || 190, pad = opts.pad === undefined ? 12 : opts.pad, padD = 3;
    var byId = {}, V = [], layers = [], i, k, idx = {};
    var usable = []; L.edges.forEach(function (e, ei) { if (e.kind !== 'self' && e.from !== e.to && e.flow > EPS && L.pos[e.from] && L.pos[e.to]) usable.push(ei); });
    L.nodes.forEach(function (n, q) { idx[n.id] = q; });
    var lay = layering(L.nodes.length, usable.map(function (ei) { var e = L.edges[ei]; return { from: idx[e.from], to: idx[e.to], flow: e.flow }; }), opts.justifySinks !== false);
    var nL = lay.levels; for (k = 0; k < nL; k++) layers.push([]);
    var rankKey = {}; lay.order.forEach(function (q, r) { rankKey[L.nodes[q].id] = r; });
    L.nodes.forEach(function (n, q) {
      var v = { id: n.id, node: n, layer: lay.layer[q], size: 0, up: [], down: [], key: rankKey[n.id], h: 0, y: 0, pos: 0, inAll: 0, outAll: 0 };
      byId[n.id] = v; V.push(v); layers[v.layer].push(v);
    });
    var fwd = [], loops = [];
    usable.forEach(function (ei, q) {
      var e = L.edges[ei], a = byId[e.from], b = byId[e.to];
      if (!lay.feedback.has(q) && b.layer > a.layer) {
        var prev = a;
        for (k = a.layer + 1; k < b.layer; k++) {
          var d = { id: null, edge: ei, layer: k, size: e.flow, up: [], down: [], key: (a.key + b.key) / 2, h: 0, y: 0, pos: 0, dummy: true };
          V.push(d); layers[k].push(d); prev.down.push({ o: d, w: e.flow, ei: ei }); d.up.push({ o: prev, w: e.flow, ei: ei }); prev = d;
        }
        prev.down.push({ o: b, w: e.flow, ei: ei }); b.up.push({ o: prev, w: e.flow, ei: ei }); a.outAll += e.flow; b.inAll += e.flow; fwd.push(ei);
      } else { loops.push(ei); a.outAll += e.flow; b.inAll += e.flow; }
    });
    V.forEach(function (v) { if (!v.dummy) v.size = Math.max(v.inAll, v.outAll, EPS); });
    /* ---- order inside each layer: weighted barycentre sweeps and weighted neighbour swaps, best of a few restarts ---- */
    var nbOf = function (list) { return list.length + 1; }, ow = opts.unweighted ? function () { return 1; } : function (w) { return w; };
    var setPos = function () { layers.forEach(function (list) { list.forEach(function (v, j) { v.pos = j; }); }); };
    var total = function () {
      var c = 0;
      for (var q = 0; q + 1 < nL; q++) { var ls = []; layers[q].forEach(function (v) { v.down.forEach(function (d) { ls.push([v.pos, d.o.pos, ow(d.w)]); }); }); c += crossWeight(ls, nbOf(layers[q + 1])); }
      return c;
    };
    layers.forEach(function (list) { list.sort(function (a, b) { return a.key - b.key; }); }); setPos();
    var snap = function () { return layers.map(function (l) { return l.slice(); }); };
    var restore = function (s) { s.forEach(function (l, q) { layers[q] = l.slice(); }); setPos(); };
    var sweep = function (q, nb) {
      var len = layers[q].length || 1;
      layers[q].forEach(function (v) { var s = 0, w = 0; nb[v.dummy ? 'dummy' : 'node'](v).forEach(function (d) { s += ow(d.w) * (d.o.pos + 0.5) / (layers[d.o.layer].length || 1); w += ow(d.w); }); v.bary = w ? s / w : (v.pos + 0.5) / len; });
      layers[q].sort(function (a, b) { return a.bary - b.bary || a.pos - b.pos; }); layers[q].forEach(function (v, j) { v.pos = j; });
    };
    var upNb = { dummy: function (v) { return v.up; }, node: function (v) { return v.up; } }, downNb = { dummy: function (v) { return v.down; }, node: function (v) { return v.down; } };
    var swapPass = function (q) {
      var improved = true, guard = 0;
      while (improved && guard++ < 6) {
        improved = false;
        for (var j = 0; j + 1 < layers[q].length; j++) {
          var a = layers[q][j], b = layers[q][j + 1], before = 0, after = 0;
          var tally = function (ea, eb) { ea.forEach(function (x) { eb.forEach(function (y) { if (x.o.pos > y.o.pos) before += ow(x.w) * ow(y.w); else if (x.o.pos < y.o.pos) after += ow(x.w) * ow(y.w); }); }); };
          tally(a.up, b.up); tally(a.down, b.down);
          if (after < before - 1e-12) { layers[q][j] = b; layers[q][j + 1] = a; a.pos = j + 1; b.pos = j; improved = true; }
        }
      }
    };
    var run = function (rounds) {
      var best = snap(), bestC = total(), cur;
      for (var r = 0; r < rounds && bestC > 0; r++) {
        for (var q = 1; q < nL; q++) sweep(q, upNb);
        for (var q2 = nL - 2; q2 >= 0; q2--) sweep(q2, downNb);
        if (V.length <= 800) for (var q3 = 0; q3 < nL; q3++) swapPass(q3);
        cur = total(); if (cur < bestC - 1e-12) { bestC = cur; best = snap(); }
      }
      restore(best); return bestC;
    };
    var bestC = run(V.length > 1500 ? 2 : 8), bestSnap = snap();
    var restarts = opts.unweighted ? 0 : opts.restarts === undefined ? (V.length <= 300 ? 8 : V.length <= 800 ? 3 : 0) : opts.restarts, rnd = rng(opts.seed || 7), budget = opts.budgetMs || 400;
    for (i = 0; i < restarts && bestC > 0 && Date.now() - t0 < budget; i++) {
      restore(bestSnap);
      layers.forEach(function (list) { var len = list.length || 1; list.forEach(function (v) { v.key2 = (v.pos + 0.5) / len + (rnd() + rnd() + rnd() - 1.5) * 0.35; }); list.sort(function (a, b) { return a.key2 - b.key2; }); });
      setPos(); var c2 = run(6); if (c2 < bestC - 1e-12) { bestC = c2; bestSnap = snap(); }
    }
    restore(bestSnap); var crossingWeight = bestC;
    /* ---- one scale for everything, bar heights from flow, then vertical positions by relaxation ---- */
    var Hs = opts.height || Math.max(380, Math.min(900, 26 * layers.reduce(function (m, l) { return Math.max(m, l.length); }, 1))), ky = Infinity;
    layers.forEach(function (list) {
      var tot = 0, gaps = 0; list.forEach(function (v, j) { tot += v.size; if (j) gaps += v.dummy || list[j - 1].dummy ? padD : pad; });
      if (tot > 0) ky = Math.min(ky, Math.max(0.0001, Hs - gaps) / tot);
    });
    if (!isFinite(ky)) ky = 1;
    var minBar = 5;
    V.forEach(function (v) { v.h = v.dummy ? Math.max(v.size * ky, 0.8) : Math.max(v.size * ky, minBar); });
    var gapBetween = function (a, b) { return a.dummy || b.dummy ? padD : pad; };
    var pack = function (list) { var y = 0; list.forEach(function (v, j) { if (j) y += gapBetween(list[j - 1], v); v.y = y + v.h / 2; y += v.h; }); return y; };
    layers.forEach(function (list) { var h = pack(list); var shift = (Hs - h) / 2; list.forEach(function (v) { v.y += shift; }); });
    var settle = function (list) {   // keep the order, enforce gaps, then pull back inside the top
      var j;
      for (j = 1; j < list.length; j++) { var lim = list[j - 1].y + list[j - 1].h / 2 + gapBetween(list[j - 1], list[j]) + list[j].h / 2; if (list[j].y < lim) list[j].y = lim; }
      if (list.length) { var up = list[0].y - list[0].h / 2; if (up < 0) for (j = 0; j < list.length; j++) list[j].y -= up; }
    };
    var pull = function (list, nb, a) {
      list.forEach(function (v) { var s = 0, w = 0; nb(v).forEach(function (d) { s += d.o.y * d.w; w += d.w; }); if (w > 0) v.y += (s / w - v.y) * a; });
      settle(list);
    };
    var nbUp = function (v) { return v.up; }, nbDown = function (v) { return v.down; }, nbBoth = function (v) { return v.up.concat(v.down); };
    for (var it = 0; it < 14; it++) {
      var a = Math.max(0.15, 0.95 * Math.pow(0.84, it));
      for (k = 1; k < nL; k++) pull(layers[k], it % 3 === 2 ? nbBoth : nbUp, a);
      for (k = nL - 2; k >= 0; k--) pull(layers[k], it % 3 === 2 ? nbBoth : nbDown, a);
    }
    var top = Infinity, bottom = -Infinity; V.forEach(function (v) { top = Math.min(top, v.y - v.h / 2); bottom = Math.max(bottom, v.y + v.h / 2); });
    var off = 30 - top; V.forEach(function (v) { v.y += off; }); bottom += off;
    /* ---- columns ---- */
    var colX = []; for (k = 0; k < nL; k++) colX.push(30 + k * (nodeW + gapLayer));
    V.forEach(function (v) { v.w = v.dummy ? 0 : nodeW; v.x = v.dummy ? colX[v.layer] + nodeW / 2 : colX[v.layer]; });
    /* ---- link ends: stack in the order of where they go ---- */
    var thick = function (f) { return Math.max(f * ky, 0.8); };
    var outY = {}, inY = {};    // key edge index + ':' + vertex id -> top of the band end
    V.forEach(function (v) {
      var outs = v.down.slice().sort(function (p, q) { return p.o.y - q.o.y || p.ei - q.ei; }), ins = v.up.slice().sort(function (p, q) { return p.o.y - q.o.y || p.ei - q.ei; });
      var so = 0, si = 0; outs.forEach(function (d) { so += thick(d.w); }); ins.forEach(function (d) { si += thick(d.w); });
      v.loopOutTop = 0; v.loopInTop = 0;
      var lo = 0, li = 0;
      loops.forEach(function (ei) { var e = L.edges[ei]; if (!v.dummy && e.from === v.id) lo += thick(e.flow); if (!v.dummy && e.to === v.id) li += thick(e.flow); });
      var yo = v.y - v.h / 2 + Math.max(0, (v.h - so - lo) / 2), yi = v.y - v.h / 2 + Math.max(0, (v.h - si - li) / 2);
      outs.forEach(function (d) { outY[d.ei + ':' + (v.dummy ? 'd' + v.layer : v.id)] = yo; yo += thick(d.w); });
      ins.forEach(function (d) { inY[d.ei + ':' + (v.dummy ? 'd' + v.layer : v.id)] = yi; yi += thick(d.w); });
      v.loopOutTop = yo; v.loopInTop = yi;
    });
    var bands = [];
    V.forEach(function (u) {
      u.down.forEach(function (d) {
        var v = d.o, t = thick(d.w), ukey = d.ei + ':' + (u.dummy ? 'd' + u.layer : u.id), vkey = d.ei + ':' + (v.dummy ? 'd' + v.layer : v.id), e = L.edges[d.ei];
        var x0 = u.x + u.w, x1 = v.x - (v.dummy ? 0 : 0), y0 = outY[ukey], y1 = inY[vkey];
        bands.push({ edge: d.ei, from: e.from, to: e.to, x0: x0, y0a: y0, y0b: y0 + t, x1: x1, y1a: y1, y1b: y1 + t, xm: (x0 + x1) / 2 });
      });
    });
    /* ---- loops: bands that leave the right side, circle under the picture and come back in on the left ---- */
    var order = loops.slice().sort(function (p, q) {
      var a = L.edges[p], b = L.edges[q], sa = Math.abs(byId[a.to].layer - byId[a.from].layer), sb = Math.abs(byId[b.to].layer - byId[b.from].layer);
      return sa - sb || p - q;
    }), yLane = bottom + 22, loopOut = [];
    order.forEach(function (ei, lane) {
      var e = L.edges[ei], u = byId[e.from], v = byId[e.to], t = thick(e.flow), g = 16 + Math.min(40, lane * 4);
      var ys = u.loopOutTop + t / 2; u.loopOutTop += t; var ye = v.loopInTop + t / 2; v.loopInTop += t;
      var xs = u.x + u.w, xe = v.x, yl = yLane + t / 2; yLane += t + 7;
      var P = [[xs, ys], [xs + g, ys], [xs + g, yl], [xe - g, yl], [xe - g, ye], [xe, ye]];
      loopOut.push({ edge: ei, from: e.from, to: e.to, w: t, d: roundPath(P, Math.min(12, 3 + t)), pts: P });
    });
    var height = Math.max(bottom, yLane) + 30, width = colX[nL - 1] + nodeW + 30;
    var nodes = V.filter(function (v) { return !v.dummy; }).map(function (v) { return { id: v.id, label: v.node.label || v.id, x: v.x, y: v.y - v.h / 2, w: v.w, h: v.h, layer: v.layer, flow: v.size }; });
    return { nodes: nodes, bands: bands, loops: loopOut, width: width, height: height, ky: ky, crossingWeight: crossingWeight, ms: Date.now() - t0 };
  }

  /** A polyline with rounded corners, as an SVG path. */
  function roundPath(P, r) {
    var d = 'M' + f(P[0][0]) + ' ' + f(P[0][1]), i;
    for (i = 1; i + 1 < P.length; i++) {
      var a = P[i - 1], b = P[i], c = P[i + 1], l1 = Math.hypot(b[0] - a[0], b[1] - a[1]), l2 = Math.hypot(c[0] - b[0], c[1] - b[1]), rr = Math.min(r, l1 / 2, l2 / 2);
      var p1 = [b[0] - (b[0] - a[0]) / (l1 || 1) * rr, b[1] - (b[1] - a[1]) / (l1 || 1) * rr], p2 = [b[0] + (c[0] - b[0]) / (l2 || 1) * rr, b[1] + (c[1] - b[1]) / (l2 || 1) * rr];
      d += 'L' + f(p1[0]) + ' ' + f(p1[1]) + 'Q' + f(b[0]) + ' ' + f(b[1]) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    var z = P[P.length - 1]; return d + 'L' + f(z[0]) + ' ' + f(z[1]);
  }
  function f(n) { return +n.toFixed(2); }

  /* ---------------------------------------------------------------- the yardstick (same for the old and the new picture) */
  function centerline(b, n) { var pts = [], t, m0 = (b.y0a + b.y0b) / 2, m1 = (b.y1a + b.y1b) / 2; for (var q = 0; q <= n; q++) { t = q / n; var s = 1 - t; pts.push([s * s * s * b.x0 + 3 * s * s * t * b.xm + 3 * s * t * t * b.xm + t * t * t * b.x1, s * s * s * m0 + 3 * s * s * t * m0 + 3 * s * t * t * m1 + t * t * t * m1]); } return pts; }
  function segCross(p, q, r, s) {
    var d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = s[0] - r[0], d2y = s[1] - r[1], den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return false;
    var t = ((r[0] - p[0]) * d2y - (r[1] - p[1]) * d2x) / den, u = ((r[0] - p[0]) * d1y - (r[1] - p[1]) * d1x) / den;
    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
  }
  /**
   * measure(g, edgeFlow, only): only (optional Set of edge indexes) limits the count to those links, so two pictures that draw different links can be compared fairly. g = { bands, loops (optional), nodes: [{id, x, y, w, h}], height, width }.
   * Returns { crossings, crossingWeight (percent of the most it could be: sum of flow*flow over crossing pairs / total flow squared), nodeHits (links drawn over an item they do not touch),
   *           widthSpread (thickest per unit flow / thinnest per unit flow: 1 means every band is as thick as its flow), drawnShare (share of the flow that is drawn as a band),
   *           bend (flow-weighted average rise or fall of a band as a share of the picture height) }.
   */
  function measure(g, edgeFlow, only) {
    var bands = only ? g.bands.filter(function (b) { return only.has(b.edge); }) : g.bands, N = 16, lines = bands.map(function (b) { return centerline(b, N); }), nCross = 0, wCross = 0, totalFlow = 0, i, j, a, b, q, r;
    var flowOf = function (ei) { return edgeFlow(ei); }, seen = {};
    bands.forEach(function (bd) { if (!seen[bd.edge]) { seen[bd.edge] = 1; totalFlow += flowOf(bd.edge); } });
    var allFlow = totalFlow + (g.loops || []).reduce(function (s, l) { return s + flowOf(l.edge); }, 0) + (g.undrawn || 0);
    for (i = 0; i < bands.length; i++) for (j = i + 1; j < bands.length; j++) {
      if (bands[i].edge === bands[j].edge) continue;
      a = bands[i]; b = bands[j]; if (a.x1 <= b.x0 || b.x1 <= a.x0) continue;
      var hit = false;
      for (q = 0; q < N && !hit; q++) for (r = 0; r < N && !hit; r++) if (segCross(lines[i][q], lines[i][q + 1], lines[j][r], lines[j][r + 1])) hit = true;
      if (hit) { nCross++; wCross += flowOf(a.edge) * flowOf(b.edge); }
    }
    var hits = {};
    g.nodes.forEach(function (n) {
      bands.forEach(function (bd, bi) {
        var e = bd.edge; if (bd.from === n.id || bd.to === n.id) return;
        var ln = lines[bi];
        for (var p = 0; p < ln.length; p++) { var pt = ln[p]; if (pt[0] > n.x + 1 && pt[0] < n.x + n.w - 1 && pt[1] > n.y + 1 && pt[1] < n.y + n.h - 1) { hits[e + ':' + n.id] = 1; break; }
          if (p + 1 < ln.length && n.w > 0) { /* a long band can jump over a narrow bar between two samples */ var nx = ln[p + 1]; if ((pt[0] < n.x + n.w / 2) !== (nx[0] < n.x + n.w / 2)) { var tt = (n.x + n.w / 2 - pt[0]) / ((nx[0] - pt[0]) || 1e-9), yy = pt[1] + tt * (nx[1] - pt[1]); if (yy > n.y + 1 && yy < n.y + n.h - 1) { hits[e + ':' + n.id] = 1; break; } } } }
      });
    });
    var lo = Infinity, hi = 0; bands.forEach(function (bd) { var fl = flowOf(bd.edge), tk = ((bd.y0b - bd.y0a) + (bd.y1b - bd.y1a)) / 2; if (fl > EPS && tk > 0.81) { var t = tk / fl; lo = Math.min(lo, t); hi = Math.max(hi, t); } });
    var bend = 0, bw = 0; bands.forEach(function (bd) { var fl = flowOf(bd.edge); bend += fl * Math.abs((bd.y1a + bd.y1b) / 2 - (bd.y0a + bd.y0b) / 2); bw += fl; });
    var drawn = seen, drawnFlow = totalFlow + (g.loops || []).reduce(function (s, l) { return s + flowOf(l.edge); }, 0);
    return { crossings: nCross, crossingWeight: totalFlow > 0 ? 100 * wCross / (totalFlow * totalFlow) : 0, nodeHits: Object.keys(hits).length, widthSpread: isFinite(lo) && lo > 0 ? hi / lo : 1, drawnShare: allFlow > 0 ? drawnFlow / allFlow : 1, bend: bw > 0 && g.height ? bend / bw / g.height : 0, height: g.height, width: g.width, drawn: Object.keys(drawn).length };
  }

  return { layout: layout, layering: layering, measure: measure, crossWeight: crossWeight, roundPath: roundPath };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMSankey;

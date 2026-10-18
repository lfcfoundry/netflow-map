/*!
 * Net Flow Map scene: turns an engine layout into plain drawing lists that every drawing backend (Canvas2D, WebGL2, WebGPU)
 * and the SVG export read the same way. No DOM. Copyright (c) 2026 JNFoo. MIT License.
 *
 * World units are the engine's. Colors are [r, g, b, a] with 0..1 numbers.
 * scene = { x0, y0, w, h, rects, dots, curves, ribbons, labels, nodes, legend, grid }
 */
var NFMScene = (function () {
  'use strict';
  var HEAD = 9;

  /* ---------------------------------------------------------------- colors */
  function hex(h, a) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, a === undefined ? 1 : a];
  }
  function mix(a, b, t) { t = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]; }
  function alpha(c, a) { return [c[0], c[1], c[2], a]; }
  function css(c) { return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (+c[3].toFixed(3)) + ')'; }
  var THEMES = {
    light: { bg: '#f6f5f1', box: '#ffffff', boxLine: '#aeb4c2', fg: '#1d2330', muted: '#7b8294', line: '#6f778a', good: '#2c9a69', bad: '#d1495b', neutral: '#8590a8', accent: '#2563d6', gold: '#d99a00', lane0: '#ecebe5', lane1: '#f6f5f1',
      groups: ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#b07aa1', '#edc948', '#9c755f', '#ff9da7', '#86bc86', '#8c6bb1', '#5fa2ce'] },
    dark: { bg: '#14171f', box: '#222735', boxLine: '#4a5266', fg: '#e8ebf2', muted: '#8d95a8', line: '#8a93a8', good: '#4cc38a', bad: '#f06a7b', neutral: '#8f9ab3', accent: '#6ea0ff', gold: '#f2b632', lane0: '#1b1f2a', lane1: '#14171f',
      groups: ['#6a9fd1', '#f6a04d', '#74c06b', '#f0787a', '#8bd0cb', '#c797bb', '#f0d36a', '#b8917a', '#ffb3bb', '#a3d6a3', '#a58bcc', '#7bbbe6'] }
  };
  function palette(name) {
    var T = THEMES[name] || THEMES.light, P = { name: name };
    Object.keys(T).forEach(function (k) { if (k !== 'groups') P[k] = hex(T[k]); });
    P.hex = T; P.groups = T.groups.map(function (g) { return hex(g); });
    return P;
  }

  /* ---------------------------------------------------------------- small helpers */
  function wrap(text, maxChars, maxLines) {
    text = String(text || '');
    if (text.length <= maxChars) return [text];
    var words = text.split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      while (w.length > maxChars) { if (cur) { lines.push(cur); cur = ''; } lines.push(w.slice(0, maxChars - 1) + '…'); w = ''; if (lines.length >= maxLines) break; }
      if (!w) continue;
      if ((cur + ' ' + w).trim().length <= maxChars) cur = (cur + ' ' + w).trim();
      else { lines.push(cur); cur = w; }
      if (lines.length >= maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length > maxLines) lines.length = maxLines;
    var joined = lines.join(' ');
    if (joined.length < text.length - 1 && lines.length) { var l = lines[lines.length - 1]; if (l.slice(-1) !== '…') lines[lines.length - 1] = (l.length >= maxChars ? l.slice(0, maxChars - 1) : l) + '…'; }
    return lines;
  }
  function bez(P, t) { /* point on a flat control list at t in 0..1 (start, then c1 c2 p per segment) */
    var segs = (P.length - 2) / 6, s = Math.min(segs - 1, Math.floor(t * segs)), u = t * segs - s, o = s * 6;
    var x0 = P[o], y0 = P[o + 1], x1 = P[o + 2], y1 = P[o + 3], x2 = P[o + 4], y2 = P[o + 5], x3 = P[o + 6], y3 = P[o + 7], m = 1 - u;
    return [m * m * m * x0 + 3 * m * m * u * x1 + 3 * m * u * u * x2 + u * u * u * x3, m * m * m * y0 + 3 * m * m * u * y1 + 3 * m * u * u * y2 + u * u * u * y3];
  }

  /* ---------------------------------------------------------------- the scene */
  /**
   * L: engine layout. o: { colorBy, theme, traffic, n (graph size), names: {nodeId: label} }
   */
  function make(L, o) {
    o = o || {};
    var T = palette(o.theme || 'light'), view = L.view || 'flow', colorBy = o.colorBy || 'group';
    var S = { rects: [], dots: [], curves: [], ribbons: [], labels: [], nodes: [], legend: [], theme: T, view: view, x0: 0, y0: 0, w: 100, h: 100, kind: L.kind };
    var groupIdx = new Map();
    if (L.nodes) {
      var gs = Array.from(new Set(L.nodes.map(function (n) { return n.group || ''; }))).sort();
      gs.forEach(function (g, i) { groupIdx.set(g, i); });
    }
    var gcol = function (g) { var i = groupIdx.get(g || '') || 0; return g === '(none)' ? T.neutral : T.groups[i % T.groups.length]; };
    var maxVisits = 0, maxTraffic = 0.0001;
    (L.nodes || []).forEach(function (n) { if (n.visits > maxVisits) maxVisits = n.visits; if (n.traffic > maxTraffic) maxTraffic = n.traffic; });
    maxVisits = maxVisits || 1;
    var HEAT = [hex('#fbe9a8'), hex('#f4a259'), hex('#d1495b')];
    var heat = function (t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? mix(HEAT[0], HEAT[1], t * 2) : mix(HEAT[1], HEAT[2], (t - 0.5) * 2); };
    var valCol = function (v) { return v === 'good' ? T.good : v === 'bad' ? T.bad : T.neutral; };
    var fillOf = function (n) {
      var f;
      if (colorBy === 'choke') f = n.choke ? alpha(T.gold, 0.55) : T.box;
      else if (colorBy === 'traffic') f = mix(T.box, T.accent, 0.12 + 0.8 * Math.sqrt(n.traffic / maxTraffic));
      else if (colorBy === 'heat') f = n.visits > 0 ? heat(Math.sqrt(n.visits / maxVisits)) : T.box;
      else if (colorBy === 'odds') { var s = n.pGood + n.pBad; f = s > 0.001 ? mix(T.bad, T.good, n.pGood / s) : T.box; if (s > 0.001) f = mix(T.box, f, 0.25 + 0.7 * Math.min(1, s)); }
      else if (colorBy === 'none') f = T.box;
      else f = mix(T.box, gcol(n.group), n.group && n.group !== '(none)' ? 0.55 : 0);
      if (n.ghost) f = alpha(f, 0.35);
      if (n.unreached) f = alpha(f, Math.min(f[3], 0.5));
      return f;
    };
    var legendSet = {};
    var legend = function (c, t) { if (!legendSet[t]) { legendSet[t] = 1; S.legend.push([c, t]); } };
    var addNode = function (n, x, y, w, h, extra) {
      var rec = { i: S.nodes.length, key: n.id, nodeId: n.nodeId, x: x, y: y, w: w, h: h, deg: n.deg || 0, label: n.label, n: n };
      if (extra) for (var k in extra) rec[k] = extra[k];
      S.nodes.push(rec);
      return rec;
    };
    var lab = function (x, y, t, size, c, op) {
      var l = { x: x, y: y, t: t, size: size, color: c, align: 'c', bold: false, rot: 0, minK: 0, node: -1 };
      if (op) for (var k in op) l[k] = op[k];
      S.labels.push(l);
      return l;
    };
    var pad = 30;
    var nodeLabel = function (n, rec, size) {
      var maxChars = Math.max(6, Math.floor((n.w - 16) / (size * 0.56))), lines = wrap(n.label, maxChars, n.sub ? 1 : 2);
      var total = lines.length * (size + 3) + (n.sub ? 12 : 0), y0 = n.y + n.h / 2 - total / 2 + size;
      lines.forEach(function (ln, i) { lab(n.x + n.w / 2, y0 + i * (size + 3) - 2, ln, size, T.fg, { bold: true, node: rec.i, minK: 0.18 }); });
      if (n.sub) lab(n.x + n.w / 2, y0 + lines.length * (size + 3), wrap(n.sub, maxChars + 4, 1)[0], 10, T.muted, { node: rec.i, minK: 0.5 });
    };

    if (L.kind === 'shape') {
      shapeScene(S, L, T, lab, addNode, valCol);
    } else if (view === 'matrix') {
      matrixScene(S, L, T, lab, addNode, gcol);
    } else if (view === 'arc') {
      arcScene(S, L, T, lab, addNode, fillOf, valCol);
    } else if (view === 'network') {
      networkScene(S, L, T, lab, addNode, fillOf, valCol, gcol, o);
    } else {
      layeredScene(S, L, T, lab, addNode, fillOf, valCol, nodeLabel, o, view);
    }

    /* legend by color mode */
    if (view !== 'matrix' && L.kind !== 'shape') {
      if (colorBy === 'group' || colorBy === 'found') { var sh = 0; groupIdx.forEach(function (i, g) { if (sh++ < 10) legend(T.groups[i % T.groups.length], g || '(no group)'); }); }
      else if (colorBy === 'choke') legend(alpha(T.gold, 0.7), 'choke point: every route passes here');
      else if (colorBy === 'traffic') { legend(mix(T.box, T.accent, 0.2), 'few routes'); legend(mix(T.box, T.accent, 0.9), 'many routes'); }
      else if (colorBy === 'odds') { legend(T.good, 'players mostly end well'); legend(T.bad, 'players mostly end badly'); }
      else if (colorBy === 'heat') { legend(HEAT[0], 'rarely visited'); legend(HEAT[2], 'busy'); }
      if (view !== 'river') { legend(T.good, 'good ending'); legend(T.bad, 'bad ending'); }
    }

    /* bounds, then a grid for picking */
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    S.nodes.forEach(function (n) { if (n.x < x0) x0 = n.x; if (n.y < y0) y0 = n.y; if (n.x + n.w > x1) x1 = n.x + n.w; if (n.y + n.h > y1) y1 = n.y + n.h; });
    S.rects.forEach(function (r) { if (r.x < x0) x0 = r.x; if (r.y < y0) y0 = r.y; if (r.x + r.w > x1) x1 = r.x + r.w; if (r.y + r.h > y1) y1 = r.y + r.h; });
    S.dots.forEach(function (d) { if (d.cx - d.r < x0) x0 = d.cx - d.r; if (d.cy - d.r < y0) y0 = d.cy - d.r; if (d.cx + d.r > x1) x1 = d.cx + d.r; if (d.cy + d.r > y1) y1 = d.cy + d.r; });
    if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 100; y1 = 100; }
    S.x0 = x0 - pad; S.y0 = y0 - pad; S.w = x1 - x0 + 2 * pad; S.h = y1 - y0 + 2 * pad + (view === 'arc' ? 110 : 0);
    buildGrid(S);
    return S;
  }

  function buildGrid(S) {
    var cell = Math.max(40, Math.max(S.w, S.h) / 80), cols = Math.ceil(S.w / cell) + 1, rows = Math.ceil(S.h / cell) + 1, g = new Map();
    S.nodes.forEach(function (n) {
      var c0 = Math.floor((n.x - S.x0) / cell), c1 = Math.floor((n.x + n.w - S.x0) / cell), r0 = Math.floor((n.y - S.y0) / cell), r1 = Math.floor((n.y + n.h - S.y0) / cell);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { var k = r * cols + c; var a = g.get(k); if (a) a.push(n.i); else g.set(k, [n.i]); }
    });
    S.grid = { cell: cell, cols: cols, rows: rows, map: g };
  }
  /** Which node box is under this world point (topmost = last drawn); slop is in world units. */
  function pick(S, wx, wy, slop) {
    slop = slop || 0;
    var G = S.grid, best = null, cs = G.cell;
    var c0 = Math.floor((wx - slop - S.x0) / cs), c1 = Math.floor((wx + slop - S.x0) / cs), r0 = Math.floor((wy - slop - S.y0) / cs), r1 = Math.floor((wy + slop - S.y0) / cs);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var a = G.map.get(r * G.cols + c);
      if (!a) continue;
      for (var j = 0; j < a.length; j++) {
        var n = S.nodes[a[j]];
        if (wx >= n.x - slop && wx <= n.x + n.w + slop && wy >= n.y - slop && wy <= n.y + n.h + slop) { if (!best || n.i > best.i) best = n; }
      }
    }
    return best;
  }

  /* ---------------------------------------------------------------- layered views (flow, top-down, spine, lanes, river) */
  function layeredScene(S, L, T, lab, addNode, fillOf, valCol, nodeLabel, o, view) {
    var LR = L.dir !== 'TB', river = view === 'river', W = L.width || 0, H = L.height || 0;
    (L.lanes || []).forEach(function (ln, i) {
      var name = (L.laneNames || [])[ln.lane] || '';
      var r = LR ? { x: -10, y: ln.from, w: W + 20, h: ln.to - ln.from } : { x: ln.from, y: -10, w: ln.to - ln.from, h: H + 20 };
      S.rects.push({ x: r.x, y: r.y, w: r.w, h: r.h, r: 0, fill: i % 2 ? alpha(T.lane1, 0.55) : alpha(T.lane0, 0.8), stroke: [0, 0, 0, 0], sw: 0, layer: 0, node: -1 });
      lab(LR ? r.x + 12 : r.x + 8, LR ? r.y + 16 : r.y + 16, name, 12, T.muted, { align: 'l', bold: true, minK: 0.12, fixed: true });
    });
    if (view === 'spine') {
      var ch = L.nodes.filter(function (n) { return n.choke; }).sort(function (a, b) { return a.x - b.x; });
      if (ch.length > 1) { var P = [ch[0].x + ch[0].w / 2, ch[0].y + ch[0].h / 2]; for (var i = 1; i < ch.length; i++) { var a = ch[i - 1], b = ch[i]; var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2; P.push(ax + (bx - ax) / 3, ay, ax + 2 * (bx - ax) / 3, by, bx, by); } S.curves.push({ P: P, w: 14, color: alpha(T.gold, 0.28), arrow: false, edge: -1, from: null, to: null, back: true }); }
    }
    var recOf = {};
    var order = L.nodes.slice().sort(function (a, b) { return a.layer - b.layer || (LR ? a.y - b.y : a.x - b.x); });
    var edgesBefore = S.curves.length;
    /* ports */
    var slots = {};
    var sideOf = function (e, end) {
      if (e.kind === 'self') return 'R';
      if (e.kind === 'flat') return LR ? 'R' : 'B';
      if (LR) return (e.kind === 'fwd') === (end === 'out') ? 'R' : 'L';
      return (e.kind === 'fwd') === (end === 'out') ? 'B' : 'T';
    };
    if (!river) {
      L.edges.forEach(function (e) {
        var a = L.pos[e.from], b = L.pos[e.to];
        if (!a || !b) return;
        var nextOut = e.pts.length ? e.pts[0] : [b.x + b.w / 2, b.y + b.h / 2], nextIn = e.pts.length ? e.pts[e.pts.length - 1] : [a.x + a.w / 2, a.y + a.h / 2];
        e.so = sideOf(e, 'out'); e.si = sideOf(e, 'in');
        (slots[e.from + '|' + e.so] = slots[e.from + '|' + e.so] || []).push({ e: e, end: 'out', k: LR || e.so === 'R' ? nextOut[1] : nextOut[0] });
        (slots[e.to + '|' + e.si] = slots[e.to + '|' + e.si] || []).push({ e: e, end: 'in', k: LR || e.si === 'R' ? nextIn[1] : nextIn[0] });
      });
      Object.keys(slots).forEach(function (key) {
        var parts = key.split('|'), n = L.pos[parts[0]], side = parts[1], list = slots[key].sort(function (p, q) { return p.k - q.k; });
        list.forEach(function (it, i) {
          var f = (i + 1) / (list.length + 1);
          it.e[it.end === 'out' ? 'p0' : 'p1'] = side === 'R' ? [n.x + n.w, n.y + n.h * f] : side === 'L' ? [n.x, n.y + n.h * f] : side === 'B' ? [n.x + n.w * f, n.y + n.h] : [n.x + n.w * f, n.y];
        });
      });
      var off = function (side) { return side === 'R' ? [HEAD, 0] : side === 'L' ? [-HEAD, 0] : side === 'B' ? [0, HEAD] : [0, -HEAD]; };
      var many = L.edges.length > 3000;
      L.edges.forEach(function (e, ei) {
        if (!e.p0 || !e.p1) return;
        var oo = off(e.si), end = [e.p1[0] + oo[0], e.p1[1] + oo[1]], P;
        if (e.kind === 'self' || e.kind === 'flat') {
          var out = 34 + (ei % 4) * 8;
          if (e.so === 'R') { var x = Math.max(e.p0[0], end[0]) + out; P = [e.p0[0], e.p0[1], x, e.p0[1], x, end[1], end[0], end[1]]; }
          else { var y = Math.max(e.p0[1], end[1]) + out; P = [e.p0[0], e.p0[1], e.p0[0], y, end[0], y, end[0], end[1]]; }
        } else {
          var pts = [e.p0].concat(e.pts, [end]);
          P = [pts[0][0], pts[0][1]];
          for (var i = 0; i + 1 < pts.length; i++) {
            var x0 = pts[i][0], y0 = pts[i][1], x1 = pts[i + 1][0], y1 = pts[i + 1][1];
            if (LR) { var m = (x1 - x0) / 2; P.push(x0 + m, y0, x1 - m, y1, x1, y1); } else { var mm = (y1 - y0) / 2; P.push(x0, y0 + mm, x1, y1 - mm, x1, y1); }
          }
        }
        var w = Math.min(1.5 + Math.log2(e.count) * 0.9, 4.5);
        var back = e.kind === 'back' || e.kind === 'self' || e.kind === 'flat';
        S.curves.push({ P: P, w: w, color: back ? alpha(T.gold, 0.8) : alpha(T.line, 0.78), arrow: !many, tip: e.p1, edge: ei, from: e.from, to: e.to, back: back });
        if (e.label && !many && L.edges.length < 400) { var mid = bez(P, 0.5); lab(mid[0], mid[1] - 4, e.label.length > 28 ? e.label.slice(0, 27) + '…' : e.label, 10, T.muted, { minK: 0.9, edge: ei, bg: true }); }
      });
    } else riverRibbons(S, L, T);

    order.forEach(function (n) {
      var f = fillOf(n), vc = n.end ? valCol(n.valence) : null;
      if (river) {
        var rec0 = addNode(n, n.x, n.y, n.w, n.h);
        var s = n.pGood + n.pBad, bc = s > 0.001 ? mix(T.bad, T.good, n.pGood / s) : n.end ? valCol(n.valence) : T.neutral;
        S.rects.push({ x: n.x, y: n.y, w: n.w, h: n.h, r: 3, fill: bc, stroke: n.start ? T.accent : [0, 0, 0, 0], sw: n.start ? 2 : 0, layer: 1, node: rec0.i });
        if (n.h > 14 || n.start || n.end) lab(n.x + n.w + 6, n.y + Math.min(n.h, 28) / 2 + 4, n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label, 11, T.fg, { align: 'l', node: rec0.i, minK: 0.3, bold: n.start });
        return;
      }
      var rec = addNode(n, n.x, n.y, n.w, n.h);
      if (n.run) S.rects.push({ x: n.x + 5, y: n.y + 5, w: n.w, h: n.h, r: 10, fill: alpha(T.box, 0.7), stroke: alpha(T.boxLine, 0.8), sw: 1, layer: 1, node: rec.i });
      var stroke = n.start ? T.accent : vc ? vc : T.boxLine, sw = n.start ? 3 : vc ? 3 : 1.2;
      S.rects.push({ x: n.x, y: n.y, w: n.w, h: n.h, r: 10, fill: f, stroke: n.ghost ? alpha(T.muted, 0.8) : stroke, sw: n.ghost ? 1.2 : sw, layer: 1, node: rec.i });
      if (n.choke) S.dots.push({ cx: n.x + 11, cy: n.y + 11, r: 5, fill: T.gold, stroke: alpha(T.box, 0.9), sw: 1.5, layer: 1, node: rec.i });
      if (n.start) lab(n.x + n.w - 8, n.y + 14, 'START', 9, T.accent, { align: 'r', bold: true, node: rec.i, minK: 0.7 });
      nodeLabel(n, rec, 13);
    });
  }

  function riverRibbons(S, L, T) {
    var K = 420, outs = {}, ins = {};
    L.edges.forEach(function (e, ei) { if (e.kind === 'fwd' && e.flow > 1e-6) { (outs[e.from] = outs[e.from] || []).push(ei); (ins[e.to] = ins[e.to] || []).push(ei); } });
    var y0 = {}, y1 = {}, th = {};
    Object.keys(outs).forEach(function (id) {
      var a = L.pos[id], list = outs[id].sort(function (p, q) { var bp = L.pos[L.edges[p].to], bq = L.pos[L.edges[q].to]; return bp.y + bp.h / 2 - (bq.y + bq.h / 2); }), tot = 0;
      list.forEach(function (ei) { tot += L.edges[ei].flow; });
      var sc = Math.min(K, a.h / Math.max(tot, 1e-9)), y = a.y;
      list.forEach(function (ei) { var t = L.edges[ei].flow * sc; y0[ei] = y; th[ei] = Math.min(th[ei] === undefined ? t : th[ei], t); y += t; });
    });
    Object.keys(ins).forEach(function (id) {
      var b = L.pos[id], list = ins[id].sort(function (p, q) { var ap = L.pos[L.edges[p].from], aq = L.pos[L.edges[q].from]; return ap.y + ap.h / 2 - (aq.y + aq.h / 2); }), tot = 0;
      list.forEach(function (ei) { tot += L.edges[ei].flow; });
      var sc = Math.min(K, b.h / Math.max(tot, 1e-9)), y = b.y;
      list.forEach(function (ei) { var t = L.edges[ei].flow * sc; y1[ei] = y; th[ei] = Math.min(th[ei] === undefined ? t : th[ei], t); y += t; });
    });
    L.edges.forEach(function (e, ei) {
      var a = L.pos[e.from], b = L.pos[e.to];
      if (!a || !b) return;
      if (e.kind !== 'fwd' || y0[ei] === undefined || y1[ei] === undefined) {
        if (e.kind === 'self' || e.flow <= 1e-6) return;
        var ax = a.x + a.w, ay = a.y + a.h / 2, bx = b.x, by = b.y + b.h / 2;
        S.curves.push({ P: [ax, ay, ax + 60, ay - 70, bx - 60, by - 70, bx, by], w: 1.5, color: alpha(T.gold, 0.55), arrow: false, edge: ei, from: e.from, to: e.to, back: true });
        return;
      }
      var t = Math.max(0.8, th[ei]), xa = a.x + a.w, xb = b.x, xm = (xa + xb) / 2;
      var s = b.pGood + b.pBad, c = s > 0.001 ? mix(T.bad, T.good, b.pGood / s) : b.end ? (b.valence === 'good' ? T.good : b.valence === 'bad' ? T.bad : T.neutral) : T.neutral;
      S.ribbons.push({ x0: xa, y0a: y0[ei], y0b: y0[ei] + t, x1: xb, y1a: y1[ei], y1b: y1[ei] + t, xm: xm, color: alpha(c, 0.42), edge: ei, from: e.from, to: e.to });
    });
  }

  /* ---------------------------------------------------------------- arc view */
  function arcScene(S, L, T, lab, addNode, fillOf, valCol) {
    var y0 = L.baseline, maxX = 0;
    L.nodes.forEach(function (n) { maxX = Math.max(maxX, n.cx); });
    S.curves.push({ P: [0, y0, (maxX + 30) / 3, y0, 2 * (maxX + 30) / 3, y0, maxX + 30, y0], w: 1, color: alpha(T.boxLine, 0.6), arrow: false, edge: -1, from: null, to: null });
    L.edges.forEach(function (e, ei) {
      var a = L.pos[e.from], b = L.pos[e.to];
      if (!a || !b || a === b) return;
      var xa = a.cx, xb = b.cx, dx = Math.abs(xb - xa), h = Math.min(dx * 0.5, y0 - 16), back = xb < xa;
      var k = h * 4 / 3;
      S.curves.push({ P: [xa, y0, xa, y0 - k, xb, y0 - k, xb, y0], w: Math.min(1.2 + Math.log2(e.count), 4), color: back ? alpha(T.gold, 0.55) : alpha(T.line, 0.45), arrow: false, edge: ei, from: e.from, to: e.to, back: back });
    });
    L.nodes.forEach(function (n) {
      var r = 5 + 6 * Math.sqrt(n.traffic || 0), rec = addNode(n, n.cx - r, y0 - r, 2 * r, 2 * r);
      var vc = n.end ? valCol(n.valence) : null;
      S.dots.push({ cx: n.cx, cy: y0, r: r, fill: n.start ? T.accent : fillOf(n).map(function (v, i) { return i < 3 ? v : Math.max(v, 0.9); }), stroke: vc || T.box, sw: vc ? 2.5 : 1.5, layer: 1, node: rec.i });
      lab(n.cx + 4, y0 + r + 10, n.label.length > 26 ? n.label.slice(0, 25) + '…' : n.label, 11, T.fg, { align: 'l', rot: 60, node: rec.i, minK: 0.3 });
    });
  }

  /* ---------------------------------------------------------------- matrix view */
  function matrixScene(S, L, T, lab, addNode, gcol) {
    var cell = L.cell, head = L.head, n = L.nodes.length, big = n > 300;
    S.rects.push({ x: head, y: head, w: n * cell, h: n * cell, r: 0, fill: alpha(T.box, 0.6), stroke: alpha(T.boxLine, 0.8), sw: 1, layer: 0, node: -1 });
    L.nodes.forEach(function (nd) {
      var rec = addNode(nd, 0, head + nd.mi * cell, head + (nd.mi + 1) * cell, cell);
      void rec;
      S.rects.push({ x: head + nd.mi * cell, y: head + nd.mi * cell, w: cell, h: cell, r: 0, fill: alpha(T.muted, 0.18), stroke: [0, 0, 0, 0], sw: 0, layer: 0, node: -1 });
      var sz = Math.min(11, cell - 3);
      lab(head - 6, head + nd.mi * cell + cell / 2 + sz / 3, nd.label.length > 26 ? nd.label.slice(0, 25) + '…' : nd.label, sz, T.fg, { align: 'r', node: rec.i, minK: big ? 0.9 : 0.25 });
      lab(head + nd.mi * cell + cell / 2 + sz / 3, head - 6, nd.label.length > 26 ? nd.label.slice(0, 25) + '…' : nd.label, sz, T.fg, { align: 'l', rot: -90, node: rec.i, minK: big ? 0.9 : 0.25 });
    });
    L.edges.forEach(function (e, ei) {
      var a = L.pos[e.from], b = L.pos[e.to];
      if (!a || !b) return;
      var back = e.kind === 'back' || e.kind === 'self';
      S.rects.push({ x: head + b.mi * cell + 1, y: head + a.mi * cell + 1, w: cell - 2, h: cell - 2, r: Math.min(3, cell / 4), fill: back ? alpha(T.gold, 0.9) : alpha(gcol(a.group), 0.95), stroke: [0, 0, 0, 0], sw: 0, layer: 1, node: -1, edge: ei, from: e.from, to: e.to });
    });
    lab(head + n * cell + 10, head + 12, 'rows are where a link starts, columns are where it goes', 10, T.muted, { align: 'l', minK: 0.3 });
  }

  /* ---------------------------------------------------------------- network view */
  function networkScene(S, L, T, lab, addNode, fillOf, valCol, gcol, o) {
    var m = L.edges.length, arrows = m <= 500, a = Math.max(0.1, Math.min(0.65, 1.1 - Math.log10(Math.max(10, m)) * 0.28));
    L.edges.forEach(function (e, ei) {
      var s = L.pos[e.from], t = L.pos[e.to];
      if (!s || !t || s === t) return;
      var dx = t.cx - s.cx, dy = t.cy - s.cy, d = Math.hypot(dx, dy) || 1, r = t.w / 2 + (arrows ? HEAD : 0), ex = t.cx - dx / d * r, ey = t.cy - dy / d * r;
      var sx = s.cx + dx / d * (s.w / 2), sy = s.cy + dy / d * (s.w / 2);
      var same = s.group && s.group === t.group;
      S.curves.push({ P: [sx, sy, sx + (ex - sx) / 3, sy + (ey - sy) / 3, sx + 2 * (ex - sx) / 3, sy + 2 * (ey - sy) / 3, ex, ey], w: Math.min(1 + Math.log2(e.count) * 0.4, 2.5), color: same ? alpha(gcol(s.group), a + 0.1) : alpha(T.line, a), arrow: arrows, line: true, tip: [t.cx - dx / d * t.w / 2, t.cy - dy / d * t.w / 2], edge: ei, from: e.from, to: e.to, back: false });
    });
    var rank = L.nodes.map(function (n, i) { return i; }).sort(function (p, q) { return L.nodes[q].deg - L.nodes[p].deg; }), rk = new Array(L.nodes.length);
    rank.forEach(function (i, r) { rk[i] = r; });
    L.nodes.forEach(function (n, i) {
      var r = n.w / 2, rec = addNode(n, n.cx - r, n.cy - r, 2 * r, 2 * r), vc = n.end ? valCol(n.valence) : null;
      S.dots.push({ cx: n.cx, cy: n.cy, r: r, fill: n.start ? mix(fillOf(n), T.accent, 0.7) : fillOf(n).map(function (v, k) { return k < 3 ? v : Math.max(v, 0.92); }), stroke: n.start ? T.accent : vc || alpha(T.box, 0.9), sw: n.start ? 3 : vc ? 2.5 : 1.2, layer: 1, node: rec.i });
      if (n.choke) S.dots.push({ cx: n.cx + r * 0.72, cy: n.cy - r * 0.72, r: Math.max(2.5, r * 0.3), fill: T.gold, stroke: alpha(T.box, 0.9), sw: 1, layer: 1, node: rec.i });
      lab(n.cx, n.cy + r + 11, n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label, 11, T.fg, { node: rec.i, minK: 0.22 * (1 + rk[i] / 35), bold: rk[i] < 8 });
    });
  }

  /* ---------------------------------------------------------------- story shape */
  function shapeScene(S, L, T, lab, addNode, valCol) {
    var spine = (L.imp && L.imp.spine) || [], segs = L.segs, y = 0, W = 340, byId = {};
    var box = function (id, label, big) {
      var rec = addNode({ id: 'shape:' + id, nodeId: id, label: label, deg: 0 }, 0, y, W, 46);
      S.rects.push({ x: 0, y: y, w: W, h: 46, r: 12, fill: alpha(T.gold, 0.22), stroke: T.gold, sw: 2.5, layer: 1, node: rec.i });
      lab(W / 2, y + 28, label.length > 38 ? label.slice(0, 37) + '…' : label, 14, T.fg, { bold: true, node: rec.i });
      y += 46;
    };
    var join = function (h) { S.curves.push({ P: [W / 2, y, W / 2, y + h / 3, W / 2, y + 2 * h / 3, W / 2, y + h], w: 2.5, color: alpha(T.line, 0.7), arrow: false, edge: -1, from: null, to: null }); y += h; };
    if (!segs.length) { lab(W / 2, 30, 'This map has no choke points yet, so there is no shape to show.', 13, T.muted, {}); return; }
    segs.forEach(function (s, i) {
      if (i === 0) { box(s.fromId, s.fromLabel); }
      join(16);
      var e = s.endings, lines = [s.pattern, s.routes > 1 ? s.routes.toLocaleString('en-US') + ' different routes' : s.pages.length ? 'one route' : 'a direct step', s.pages.length + ' page' + (s.pages.length === 1 ? '' : 's') + ' in between' + (e.good + e.bad + e.neutral ? ' · endings: ' + e.good + ' good, ' + e.bad + ' bad, ' + e.neutral + ' other' : '')];
      var h = 80;
      S.rects.push({ x: 24, y: y, w: W - 48, h: h, r: 10, fill: alpha(T.box, 0.95), stroke: T.boxLine, sw: 1.2, layer: 1, node: -1 });
      lab(W / 2, y + 24, lines[0].length > 52 ? lines[0].slice(0, 51) + '…' : lines[0], 13, T.fg, { bold: true });
      lab(W / 2, y + 45, lines[1], 12, T.muted, {});
      lab(W / 2, y + 64, lines[2].length > 60 ? lines[2].slice(0, 59) + '…' : lines[2], 11, T.muted, {});
      y += h; join(16);
      if (s.toId) box(s.toId, s.toLabel); else { lab(W / 2, y + 22, 'the story branches out to its endings from here', 12, T.muted, {}); y += 36; }
    });
    void spine; void byId;
  }

  /* ---------------------------------------------------------------- drawing state (selection and neighbors) */
  /** Sets item.a for dimming. sel: Set of box ids to keep bright (selected + neighbors) or null. */
  function restyle(S, sel, hot) {
    var on = !!(sel && sel.size);
    var edgeA = function (c) { return !on || !hot || c.from === null || c.from === undefined ? 1 : (c.from === hot || c.to === hot) ? 1 : 0.08; };
    S.nodes.forEach(function (n) { n.a = !on || sel.has(n.key) ? 1 : 0.22; });
    S.rects.forEach(function (r) { r.a = r.node >= 0 && S.nodes[r.node] ? S.nodes[r.node].a : r.from !== undefined ? edgeA(r) : 1; });
    S.dots.forEach(function (d) { d.a = d.node >= 0 && S.nodes[d.node] ? S.nodes[d.node].a : 1; });
    S.labels.forEach(function (l) { l.a = l.node >= 0 && S.nodes[l.node] ? S.nodes[l.node].a : 1; });
    S.curves.forEach(function (c) { c.a = edgeA(c); });
    S.ribbons.forEach(function (c) { c.a = edgeA(c); });
    return S;
  }

  /* ---------------------------------------------------------------- SVG export (same lists) */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toSvg(S, title) {
    var T = S.theme, f = function (n) { return +n.toFixed(2); }, out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f(S.x0) + ' ' + f(S.y0) + ' ' + f(S.w) + ' ' + f(S.h) + '" width="' + Math.round(Math.min(S.w, 3000)) + '" height="' + Math.round(Math.min(S.w, 3000) * S.h / S.w) + '" font-family="system-ui, sans-serif">');
    if (title) out.push('<title>' + esc(title) + '</title>');
    out.push('<rect x="' + f(S.x0) + '" y="' + f(S.y0) + '" width="' + f(S.w) + '" height="' + f(S.h) + '" fill="' + css(T.bg) + '"/>');
    S.rects.filter(function (r) { return r.layer === 0; }).forEach(function (r) { out.push(rectSvg(r, css, f)); });
    S.ribbons.forEach(function (r) { out.push('<path d="M' + f(r.x0) + ' ' + f(r.y0a) + 'C' + f(r.xm) + ' ' + f(r.y0a) + ' ' + f(r.xm) + ' ' + f(r.y1a) + ' ' + f(r.x1) + ' ' + f(r.y1a) + 'L' + f(r.x1) + ' ' + f(r.y1b) + 'C' + f(r.xm) + ' ' + f(r.y1b) + ' ' + f(r.xm) + ' ' + f(r.y0b) + ' ' + f(r.x0) + ' ' + f(r.y0b) + 'Z" fill="' + css(r.color) + '"/>'); });
    S.curves.forEach(function (c) {
      var d = 'M' + f(c.P[0]) + ' ' + f(c.P[1]);
      for (var i = 2; i < c.P.length; i += 6) d += 'C' + f(c.P[i]) + ' ' + f(c.P[i + 1]) + ' ' + f(c.P[i + 2]) + ' ' + f(c.P[i + 3]) + ' ' + f(c.P[i + 4]) + ' ' + f(c.P[i + 5]);
      out.push('<path d="' + d + '" fill="none" stroke="' + css(c.color) + '" stroke-width="' + f(c.w) + '"/>');
      if (c.arrow) { var tri = arrowTri(c); out.push('<path d="M' + tri.map(f).join(' ').replace(/(\S+ \S+) /g, '$1L') + 'Z" fill="' + css(c.color) + '"/>'); }
    });
    S.rects.filter(function (r) { return r.layer === 1; }).forEach(function (r) { out.push(rectSvg(r, css, f)); });
    S.dots.forEach(function (d) { out.push('<circle cx="' + f(d.cx) + '" cy="' + f(d.cy) + '" r="' + f(d.r) + '" fill="' + css(d.fill) + '" stroke="' + css(d.stroke) + '" stroke-width="' + f(d.sw) + '"/>'); });
    S.labels.forEach(function (l) {
      if (S.labels.length > 1500 && l.minK > 0.6) return;
      var anchor = l.align === 'l' ? 'start' : l.align === 'r' ? 'end' : 'middle';
      out.push('<text x="' + f(l.x) + '" y="' + f(l.y) + '" font-size="' + l.size + '" text-anchor="' + anchor + '" fill="' + css(l.color) + '"' + (l.bold ? ' font-weight="700"' : '') + (l.rot ? ' transform="rotate(' + l.rot + ' ' + f(l.x) + ' ' + f(l.y) + ')"' : '') + '>' + esc(l.t) + '</text>');
    });
    out.push('</svg>');
    return out.join('\n');
  }
  function rectSvg(r, css, f) { return '<rect x="' + f(r.x) + '" y="' + f(r.y) + '" width="' + f(r.w) + '" height="' + f(r.h) + '" rx="' + f(r.r) + '" fill="' + css(r.fill) + '" stroke="' + (r.sw ? css(r.stroke) : 'none') + '" stroke-width="' + f(r.sw) + '"/>'; }
  /** Arrow triangle for a curve: tip at c.tip (or the curve end), base at the curve end. Returns [x1,y1,x2,y2,x3,y3]. */
  function arrowTri(c) {
    var P = c.P, ex = P[P.length - 2], ey = P[P.length - 1], tip = c.tip || [ex, ey], dx = tip[0] - ex, dy = tip[1] - ey, d = Math.hypot(dx, dy);
    if (d < 1e-6) { dx = ex - P[P.length - 4]; dy = ey - P[P.length - 3]; d = Math.hypot(dx, dy) || 1; tip = [ex + dx / d * HEAD, ey + dy / d * HEAD]; dx = tip[0] - ex; dy = tip[1] - ey; d = Math.hypot(dx, dy); }
    var nx = -dy / d * 4.2, ny = dx / d * 4.2;
    return [tip[0], tip[1], ex + nx, ey + ny, ex - nx, ey - ny];
  }

  return { make: make, pick: pick, restyle: restyle, toSvg: toSvg, palette: palette, THEMES: THEMES, css: css, hex: hex, mix: mix, alpha: alpha, arrowTri: arrowTri, bez: bez, HEAD: HEAD };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMScene;

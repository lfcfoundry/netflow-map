/*!
 * Net Flow Map scene: turns an engine layout into plain drawing lists that every drawing backend (Canvas2D, WebGL2, WebGPU)
 * and the SVG export read the same way. No DOM. Copyright (c) 2026 LFC Foundry. MIT License.
 *
 * World units are the engine's. Colors are [r, g, b, a] with 0..1 numbers.
 * scene = { x0, y0, w, h, rects, dots, curves, ribbons, polys, icons, labels, nodes, legend, grid }
 *
 * Options (all optional) the page can pass to make(L, o):
 *   theme, colorBy, palette, ramp, groupColors {group: '#hex'}, story (bool),
 *   nodeStyle(n) -> { fill, stroke, sw, shape, scale, opacity, icon, image, iconMode, hide, labelShow, labelColor, labelSize, labelBold, labelText }
 *   linkStyle(e) -> { color, w, wmul, opacity, dash, hide, arrow, label, bend }
 *   labelFn(n) -> text,  linkLabelFn(e) -> text,  chName(channel) -> words
 *   lab { items: {show, scale, color, fixed, topN}, links: {show, scale}, groups: {show} }
 *   widthScale 'sqrt' | 'linear' | 'log', widthMul, hulls (bool), cam {yaw, pitch, persp}, lens {x, y, r, d}, curve (0..1 bend for network links)
 */
var NFMScene = (function () {
  'use strict';
  var HEAD = 9;

  /* ---------------------------------------------------------------- colors */
  function hex(h, a) {
    h = String(h || '#888888').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    if (r !== r || g !== g || b !== b) { r = g = b = 136; }
    return [r / 255, g / 255, b / 255, a === undefined ? 1 : a];
  }
  function toHex(c) { var f = function (v) { var s = Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16); return s.length < 2 ? '0' + s : s; }; return '#' + f(c[0]) + f(c[1]) + f(c[2]); }
  function mix(a, b, t) { t = Math.max(0, Math.min(1, t)); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]; }
  function alpha(c, a) { return [c[0], c[1], c[2], a]; }
  function css(c) { return 'rgba(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ',' + (+c[3].toFixed(3)) + ')'; }
  var THEMES = {
    light: { bg: '#f6f5f1', box: '#ffffff', boxLine: '#aeb4c2', fg: '#1d2330', muted: '#7b8294', line: '#6f778a', good: '#2c9a69', bad: '#d1495b', neutral: '#8590a8', accent: '#2563d6', gold: '#d99a00', lane0: '#ecebe5', lane1: '#f6f5f1',
      groups: ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#b07aa1', '#edc948', '#9c755f', '#ff9da7', '#86bc86', '#8c6bb1', '#5fa2ce'] },
    dark: { bg: '#14171f', box: '#222735', boxLine: '#4a5266', fg: '#e8ebf2', muted: '#8d95a8', line: '#8a93a8', good: '#4cc38a', bad: '#f06a7b', neutral: '#8f9ab3', accent: '#6ea0ff', gold: '#f2b632', lane0: '#1b1f2a', lane1: '#14171f',
      groups: ['#6a9fd1', '#f6a04d', '#74c06b', '#f0787a', '#8bd0cb', '#c797bb', '#f0d36a', '#b8917a', '#ffb3bb', '#a3d6a3', '#a58bcc', '#7bbbe6'] }
  };
  /** Color sets the person can choose between for groups and categories. */
  var PALETTES = {
    standard: null,
    colorblind: ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#56B4E9', '#CC79A7', '#F0E442', '#999999', '#332288', '#88CCEE', '#117733', '#AA4499'],
    vivid: ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#9a6324', '#469990', '#800000', '#808000'],
    soft: ['#a6cee3', '#b2df8a', '#fb9a99', '#fdbf6f', '#cab2d6', '#ffff99', '#8dd3c7', '#fccde5', '#bebada', '#80b1d3', '#d9d9d9', '#bc80bd'],
    earth: ['#6b705c', '#a5a58d', '#b7b7a4', '#cb997e', '#ddbea9', '#ffe8d6', '#3f4238', '#8f5d43', '#c9ada7', '#9a8c98', '#4a4e69', '#22223b'],
    mono: ['#2b3a55', '#4d5f82', '#6f82a8', '#92a3c7', '#b5c3e0', '#d4dcee', '#1b2438', '#3a4a6b', '#5c6e94', '#7f90b5', '#a3b3d3', '#c6d1e6']
  };
  var RAMPS = {
    warm: ['#fbe9a8', '#f4a259', '#d1495b', '#5b1a3a'], cool: ['#eaf3fb', '#8fb8de', '#3b7bbf', '#14406e'], green: ['#f0f7e6', '#a8d08d', '#4a9d5b', '#14532d'],
    viridis: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'], plasma: ['#f0f921', '#f89540', '#cc4778', '#7e03a8', '#0d0887'],
    diverging: ['#2c7bb6', '#abd9e9', '#f7f7f7', '#fdae61', '#d7191c'], gray: ['#f2f2f2', '#bdbdbd', '#737373', '#252525']
  };
  var RAMP_NAMES = { warm: 'Warm', cool: 'Cool', green: 'Green', viridis: 'Viridis', plasma: 'Plasma', diverging: 'Blue to red', gray: 'Gray' };
  function rampAt(name, t) {
    var stops = (RAMPS[name] || RAMPS.warm).map(function (h) { return hex(h); });
    t = Math.max(0, Math.min(1, t === t ? t : 0));
    var x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
    return mix(stops[i], stops[i + 1], x - i);
  }
  function palette(name, pal) {
    var T = THEMES[name] || THEMES.light, P = { name: name };
    Object.keys(T).forEach(function (k) { if (k !== 'groups') P[k] = hex(T[k]); });
    var list = pal && PALETTES[pal] ? PALETTES[pal] : T.groups;
    P.hex = T; P.groups = list.map(function (g) { return hex(g); });
    return P;
  }

  /* ---------------------------------------------------------------- icons: small outline pictures in a 24 x 24 box */
  var ICONS = {
    person: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7',
    people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14c2.2.7 3.5 2.6 3.5 5',
    building: 'M5 21V4h9v17M14 9h5v12M2 21h20M8 8h3M8 12h3M8 16h3',
    house: 'M3 11l9-8 9 8M5 9.5V21h14V9.5M10 21v-6h4v6',
    factory: 'M2 21V10l6 4V10l6 4V6h4v15zM2 21h20',
    database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    server: 'M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01',
    cloud: 'M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1.2-2-3.4-2.2.8-1.8-1L14.6 4h-4l-.4 3.2-1.8 1-2.2-.8-2 3.4L5 12l-2 1.2 2 3.4 2.2-.8 1.8 1 .4 3.2h4l.4-3.2 1.8-1 2.2.8 2-3.4z',
    document: 'M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7',
    mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
    flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
    star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.2 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
    heart: 'M12 20s-8-4.7-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.3 12 20 12 20z',
    cart: 'M3 4h2l2.4 11h11l2-8H6M9 20h.01M17 20h.01',
    truck: 'M2 6h12v10H2zM14 9h4l3 3v4h-7M6 19h.01M17 19h.01',
    money: 'M12 2v20M17 6.5c-1-1.5-3-2-5-2-2.5 0-4 1.2-4 3s1.5 2.4 4 3 4 1.2 4 3-1.5 3-4 3c-2.2 0-4-.6-5-2',
    chart: 'M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-8',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
    bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
    box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    book: 'M4 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-6M20 4v15h-6',
    key: 'M8 14a4 4 0 1 1 3.9-5H21v3h-3v3h-3v-3h-3.1A4 4 0 0 1 8 14z',
    skull: 'M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14zM9 12h.01M15 12h.01M11 16h2',
    door: 'M6 21V3h12v18M3 21h18M14 12h.01'
  };
  var SHAPE_KIND = { square: 0, rounded: 0, dot: 1, circle: 1, diamond: 2, hexagon: 3, triangle: 4 };
  var SHAPE_NAMES = { dot: 'Circle', square: 'Square', rounded: 'Rounded box', diamond: 'Diamond', hexagon: 'Hexagon', triangle: 'Triangle' };
  /** Points (flat) of a diamond, hexagon or triangle inside a circle of radius r. */
  function shapePts(kind, cx, cy, r) {
    if (kind === 2) return [cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy];
    if (kind === 3) { var p = []; for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; p.push(cx + r * Math.cos(a), cy + r * Math.sin(a)); } return p; }
    if (kind === 4) return [cx, cy - r, cx + r * 0.866, cy + r * 0.5, cx - r * 0.866, cy + r * 0.5];
    return [];
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
  function fmtNum(v) {
    if (typeof NFMColumns !== 'undefined') return NFMColumns.fmt(v);
    return String(Math.round(v * 100) / 100);
  }
  function clip(s, n) { s = String(s === undefined || s === null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function hull(pts) { /* convex hull of flat [x, y, ...] (monotone chain) */
    var p = []; for (var i = 0; i < pts.length; i += 2) p.push([pts[i], pts[i + 1]]);
    if (p.length < 3) return pts.slice();
    p.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var cross = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }, lo = [], up = [];
    p.forEach(function (q) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (var j = p.length - 1; j >= 0; j--) { var q2 = p[j]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q2) <= 0) up.pop(); up.push(q2); }
    lo.pop(); up.pop();
    var h = lo.concat(up), out = []; h.forEach(function (q3) { out.push(q3[0], q3[1]); });
    return out;
  }

  /* ---------------------------------------------------------------- the scene */
  function make(L, o) {
    o = o || {};
    var T = palette(o.theme || 'light', o.palette), view = L.view || 'flow', colorBy = o.colorBy || 'group', CH = L.ch || {};
    var S = { rects: [], dots: [], curves: [], ribbons: [], polys: [], icons: [], labels: [], nodes: [], legend: [], legendTitle: '', theme: T, view: view, x0: 0, y0: 0, w: 100, h: 100, kind: L.kind, is3d: !!L.is3d, widthCh: CH.width ? CH.width.ch : '', story: !!o.story };
    var story = !!o.story, chName = o.chName || function (c) { return String(c || '').replace(/^(col|sys):/, ''); };
    var groupIdx = new Map(), gOver = o.groupColors || {};
    if (L.nodes) {
      var gs = Array.from(new Set(L.nodes.map(function (n) { return n.group || ''; }))).sort();
      gs.forEach(function (g, i) { groupIdx.set(g, i); });
    }
    var gcol = function (g) {
      if (g !== undefined && Object.prototype.hasOwnProperty.call(gOver, g) && gOver[g]) return hex(gOver[g]);
      var i = groupIdx.get(g || '') || 0; return g === '(none)' ? T.neutral : T.groups[i % T.groups.length];
    };
    var maxVisits = 0, maxTraffic = 0.0001;
    (L.nodes || []).forEach(function (n) { if (n.visits > maxVisits) maxVisits = n.visits; if (n.traffic > maxTraffic) maxTraffic = n.traffic; });
    maxVisits = maxVisits || 1;
    var rampName = o.ramp || 'warm', HEAT = 'warm';
    var heat = function (t) { return rampAt(HEAT, t); };
    var valCol = function (v) { return v === 'good' ? T.good : v === 'bad' ? T.bad : T.neutral; };
    var colRange = CH.color && CH.color.kind === 'num' ? CH.color : null, numMode = !!colRange || colorBy === 'sim' || /^sys:/.test(colorBy);
    var diverging = colRange && colRange.min < 0 && colRange.max > 0;
    var colT = function (v) {
      if (v !== v) return NaN;
      if (diverging) { var m = Math.max(Math.abs(colRange.min), Math.abs(colRange.max)); return 0.5 + 0.5 * v / m; }
      var lo = colRange ? colRange.min : 0, hi = colRange ? colRange.max : 1; return hi > lo ? (v - lo) / (hi - lo) : 0.5;
    };
    var nodeRamp = diverging ? 'diverging' : rampName;
    var classes = L.flow && L.flow.classes, nonStoryOdds = colorBy === 'odds' && !story && classes && classes.length;
    var classCol = function (k) { return k >= 0 ? T.groups[k % T.groups.length] : T.neutral; };
    var endCol = function (n) { /* color a box by where flow ends up */
      if (nonStoryOdds) return n.dom >= 0 ? mix(T.box, classCol(n.dom), 0.3 + 0.65 * Math.min(1, n.domP)) : null;
      var s = n.pGood + n.pBad; return s > 0.001 ? mix(T.bad, T.good, n.pGood / s) : null;
    };
    var fillOf = function (n) {
      var f, st = n._st;
      if (st && st.fill) f = hex(st.fill);
      else if (colorBy === 'choke') f = n.choke ? alpha(T.gold, 0.55) : T.box;
      else if (colorBy === 'traffic') f = mix(T.box, T.accent, 0.12 + 0.8 * Math.sqrt(n.traffic / maxTraffic));
      else if (colorBy === 'heat') f = n.visits > 0 ? heat(Math.sqrt(n.visits / maxVisits)) : T.box;
      else if (colorBy === 'odds') { var c = endCol(n); if (c) { var s = nonStoryOdds ? 1 : n.pGood + n.pBad; f = nonStoryOdds ? c : mix(T.box, c, 0.25 + 0.7 * Math.min(1, s)); } else f = T.box; }
      else if (numMode) { var t = colT(n.colorV); f = t === t ? rampAt(nodeRamp, t) : alpha(T.neutral, 0.35); }
      else if (colorBy === 'none') f = T.box;
      else f = mix(T.box, gcol(n.group), n.group && n.group !== '(none)' ? 0.55 : 0);
      if (n.ghost) f = alpha(f, 0.35);
      if (n.unreached) f = alpha(f, Math.min(f[3], 0.5));
      if (st && st.opacity !== undefined) f = alpha(f, Math.min(f[3], st.opacity));
      return f;
    };
    var legendSet = new Set();
    var legend = function (c, t, key) { if (!legendSet.has(t)) { legendSet.add(t); S.legend.push({ k: 'swatch', c: c, t: t, key: key || t }); } };

    /* per-item looks the person asked for */
    (L.nodes || []).forEach(function (n) { n._st = o.nodeStyle ? o.nodeStyle(n) : null; });
    var edgeCats = null, edgeCatIdx = null, ecR = CH.ecolor && CH.ecolor.kind === 'num' ? CH.ecolor : null, widthR = CH.width && CH.width.n ? CH.width : null;
    if (CH.ecolor && CH.ecolor.kind === 'cat') {
      var cnt = new Map(); (L.edges || []).forEach(function (e) { if (e.colorC) cnt.set(e.colorC, (cnt.get(e.colorC) || 0) + 1); });
      edgeCats = Array.from(cnt.keys()).sort(function (a, b) { return cnt.get(b) - cnt.get(a) || (a < b ? -1 : 1); });
      edgeCatIdx = new Map(); edgeCats.forEach(function (c, ix) { edgeCatIdx.set(c, ix); });
    }
    var wmul = o.widthMul || 1, wscale = o.widthScale || 'sqrt';
    var m0 = (L.edges || []).length;
    var autoA = Math.max(0.1, Math.min(0.65, 1.1 - Math.log10(Math.max(10, m0)) * 0.28));
    /** How to draw one link: width, color, dash, arrow, hide, label. */
    var look = function (e, ei, def) {
      var w = def.w, c = def.color, r = { w: w, color: c, dash: 0, arrow: def.arrow, hide: false, label: null, bend: o.curve || 0 };
      if (widthR) {
        var v = e.widthV, t = v === v && widthR.max > 0 ? Math.max(0, v) / widthR.max : 0;
        if (wscale === 'linear') t = t; else if (wscale === 'log') t = widthR.max > 0 && v === v ? Math.log1p(Math.max(0, v) / Math.max(1e-12, widthR.max) * 100) / Math.log1p(100) : 0; else t = Math.pow(t, 0.55);
        r.w = v === v ? 0.9 + 9.5 * t : 0.9;
        if (v !== v) r.color = alpha(c, c[3] * 0.4);
      }
      if (ecR) { var te = e.colorV === e.colorV ? (ecR.max > ecR.min ? (e.colorV - ecR.min) / (ecR.max - ecR.min) : 0.5) : NaN; r.color = te === te ? alpha(rampAt('plasma', 1 - te), Math.max(0.45, c[3])) : alpha(T.neutral, 0.3); }
      else if (edgeCats && e.colorC) { var ix = edgeCatIdx.has(e.colorC) ? edgeCatIdx.get(e.colorC) : -1; r.color = alpha(ix >= 0 ? T.groups[(ix + 3) % T.groups.length] : T.neutral, Math.max(0.55, c[3])); }
      var ls = o.linkStyle ? o.linkStyle(e, ei) : null;
      if (ls) {
        if (ls.hide) r.hide = true;
        if (ls.color) r.color = alpha(hex(ls.color), ls.opacity !== undefined ? ls.opacity : Math.max(0.6, r.color[3]));
        else if (ls.opacity !== undefined) r.color = alpha(r.color, ls.opacity);
        if (ls.w) r.w = ls.w; if (ls.wmul) r.w *= ls.wmul;
        if (ls.dash) r.dash = ls.dash === 'dot' ? 1 : ls.dash === 'long' ? 3 : 2;
        if (ls.arrow !== undefined) r.arrow = !!ls.arrow;
        if (ls.label !== undefined) r.label = ls.label;
        if (ls.bend !== undefined) r.bend = ls.bend;
      }
      r.w = Math.min(60, r.w * wmul);
      return r;
    };
    /* labels */
    var LC = { items: { show: true, scale: 1, color: 'auto', fixed: '#222222', topN: 0 }, links: { show: true, scale: 1 }, groups: { show: false, scale: 1 } };
    if (o.lab) ['items', 'links', 'groups'].forEach(function (k) { if (o.lab[k]) Object.assign(LC[k], o.lab[k]); });
    var tx = function (n) { var st = n._st; if (st && st.labelText) return st.labelText; return o.labelFn ? o.labelFn(n) : n.label; };
    var labColor = function (n, fill) {
      var st = n._st; if (st && st.labelColor) return hex(st.labelColor);
      var m = LC.items.color;
      if (m === 'group') return mix(T.fg, gcol(n.group), 0.65);
      if (m === 'fill' && fill) return mix(T.fg, fill, 0.7);
      if (m === 'value' && numMode) { var t = colT(n.colorV); return t === t ? mix(T.fg, rampAt(nodeRamp, t), 0.6) : T.fg; }
      if (m === 'fixed') return hex(LC.items.fixed);
      return T.fg;
    };
    var addNode = function (n, x, y, w, h, extra) {
      var rec = { i: S.nodes.length, key: n.id, nodeId: n.nodeId, x: x, y: y, w: w, h: h, deg: n.deg || 0, label: n.label, n: n };
      if (extra) for (var k in extra) rec[k] = extra[k];
      S.nodes.push(rec);
      return rec;
    };
    var lab = function (x, y, t, size, c, op) {
      var item = op && op.node >= 0 && !op.sub, st = item && S.nodes[op.node] && S.nodes[op.node].n ? S.nodes[op.node].n._st : null;
      if (item) {
        if (!LC.items.show && !(st && st.labelShow)) return null;
        if (st && st.labelShow === false) return null;
        size = size * LC.items.scale * (st && st.labelSize ? st.labelSize : 1);
      }
      var l = { x: x, y: y, t: t, size: size, color: c, align: 'c', bold: !!(st && st.labelBold), rot: 0, minK: 0, node: -1 };
      if (op) for (var k in op) l[k] = op[k];
      if (item && LC.items.fixedMin !== undefined) l.minK = Math.min(l.minK, LC.items.fixedMin);
      S.labels.push(l);
      return l;
    };
    var pad = 30;
    var nodeLabel = function (n, rec, size) {
      var maxChars = Math.max(6, Math.floor((n.w - 16) / (size * 0.56))), lines = wrap(tx(n), maxChars, n.sub ? 1 : 2);
      var total = lines.length * (size + 3) + (n.sub ? 12 : 0), y0 = n.y + n.h / 2 - total / 2 + size, col = labColor(n, fillOf(n));
      lines.forEach(function (ln, i) { lab(n.x + n.w / 2, y0 + i * (size + 3) - 2, ln, size, col, { bold: true, node: rec.i, minK: 0.18 }); });
      if (n.sub) lab(n.x + n.w / 2, y0 + lines.length * (size + 3), wrap(n.sub, maxChars + 4, 1)[0], 10, T.muted, { node: rec.i, minK: 0.5, sub: true });
    };
    /** Icon or picture in place of (or inside) a node. */
    var addIcon = function (n, rec, cx, cy, r) {
      var st = n._st; if (!st || (!st.icon && !st.image)) return;
      var inside = st.iconMode === 'inside';
      S.icons.push({ cx: cx, cy: cy, r: inside ? r * 0.58 : r * 0.92, icon: st.image ? null : st.icon, img: st.image || null, color: st.iconColor ? hex(st.iconColor) : (inside ? mix(T.fg, T.box, 0.1) : T.fg), node: rec.i, key: n.id, a: 1, replace: !inside, minK: 0.12 });
    };
    var X = { S: S, L: L, T: T, o: o, lab: lab, addNode: addNode, fillOf: fillOf, valCol: valCol, gcol: gcol, nodeLabel: nodeLabel, look: look, tx: tx, labColor: labColor, LC: LC, addIcon: addIcon, autoA: autoA, endCol: endCol, nonStoryOdds: nonStoryOdds, classCol: classCol, colT: colT, nodeRamp: nodeRamp, numMode: numMode, story: story, linkText: function (e, r) { return r && r.label !== null && r.label !== undefined ? r.label : (o.linkLabelFn ? o.linkLabelFn(e) : e.label); } };

    if (L.kind === 'shape') shapeScene(X);
    else if (view === 'matrix') matrixScene(X);
    else if (view === 'arc') arcScene(X);
    else if (view === 'network') networkScene(X);
    else layeredScene(X, view);

    /* legend by color mode */
    S.legendTitle = '';
    if (view !== 'matrix' && L.kind !== 'shape') {
      var nm = chName(colorBy);
      if (colorBy === 'group' || colorBy === 'found' || (CH.color && CH.color.kind === 'cat')) {
        S.legendTitle = colorBy === 'found' ? 'Found groups' : colorBy === 'group' ? 'Groups' : nm;
        var sh = 0, rest = 0; groupIdx.forEach(function (i, g) { if (sh++ < 14) legend(gcol(g), g || '(no group)', 'g:' + g); else rest++; });
        if (rest) S.legend.push({ k: 'text', t: '+ ' + rest + ' more' });
      } else if (colorBy === 'choke') { S.legendTitle = 'Choke points'; legend(alpha(T.gold, 0.7), 'every route passes here', 'choke'); }
      else if (colorBy === 'traffic') { S.legendTitle = 'Routes through'; S.legend.push({ k: 'ramp', a: mix(T.box, T.accent, 0.2), b: mix(T.box, T.accent, 0.9), lo: 'few', hi: 'many', t: '' }); }
      else if (colorBy === 'odds') {
        if (nonStoryOdds) { S.legendTitle = 'Where it ends'; classes.forEach(function (c, k) { if (k < 9) legend(classCol(k), c.label, 'class:' + k); }); }
        else { S.legendTitle = 'Where it ends up'; legend(T.good, story ? 'mostly good endings' : 'mostly the good class', 'good'); legend(T.bad, story ? 'mostly bad endings' : 'mostly the bad class', 'bad'); }
      } else if (colorBy === 'heat') { S.legendTitle = 'Traffic'; S.legend.push({ k: 'ramp', a: rampAt(HEAT, 0), b: rampAt(HEAT, 1), lo: 'rarely', hi: 'busy', t: '', ramp: HEAT }); }
      else if (numMode && colRange) { S.legendTitle = colorBy === 'sim' || colorBy === 'sys:sim' ? 'Simulated visits' : nm; S.legend.push({ k: 'ramp', ramp: nodeRamp, a: rampAt(nodeRamp, 0), b: rampAt(nodeRamp, 1), lo: fmtNum(colRange.min), hi: fmtNum(colRange.max), t: '' }); }
      if (CH.size && CH.size.n) S.legend.push({ k: 'size', t: 'Size: ' + chName(CH.size.ch), lo: fmtNum(CH.size.min), hi: fmtNum(CH.size.max) });
      if (widthR) S.legend.push({ k: 'width', t: 'Line width: ' + (widthR.ch === 'sys:sim' ? 'Simulated traffic' : chName(widthR.ch)), lo: fmtNum(widthR.min), hi: fmtNum(widthR.max) });
      if (ecR) S.legend.push({ k: 'ramp', ramp: 'plasma', a: rampAt('plasma', 1), b: rampAt('plasma', 0), lo: fmtNum(ecR.min), hi: fmtNum(ecR.max), t: 'Line color: ' + chName(CH.ecolor.ch) });
      else if (edgeCats) { S.legend.push({ k: 'text', t: 'Line color: ' + chName(CH.ecolor.ch), head: true }); edgeCats.slice(0, 8).forEach(function (c, i) { legend(T.groups[(i + 3) % T.groups.length], c, 'e:' + c); }); }
      if (story && view !== 'river') { legend(T.good, 'good ending', 'endgood'); legend(T.bad, 'bad ending', 'endbad'); }
      if (S.nodes.some(function (n) { return n.n && n.n.start; })) S.legend.push({ k: 'mark', c: T.accent, t: 'start', key: 'start' });
      if (colorBy !== 'choke' && (L.nodes || []).some(function (n) { return n.choke; })) S.legend.push({ k: 'mark', c: T.gold, t: 'choke point', key: 'chokemark', dot: true });
    }

    /* bounds, then a grid for picking */
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    S.nodes.forEach(function (n) { if (n.x < x0) x0 = n.x; if (n.y < y0) y0 = n.y; if (n.x + n.w > x1) x1 = n.x + n.w; if (n.y + n.h > y1) y1 = n.y + n.h; });
    S.rects.forEach(function (r) { if (r.x < x0) x0 = r.x; if (r.y < y0) y0 = r.y; if (r.x + r.w > x1) x1 = r.x + r.w; if (r.y + r.h > y1) y1 = r.y + r.h; });
    S.dots.forEach(function (d) { if (d.cx - d.r < x0) x0 = d.cx - d.r; if (d.cy - d.r < y0) y0 = d.cy - d.r; if (d.cx + d.r > x1) x1 = d.cx + d.r; if (d.cy + d.r > y1) y1 = d.cy + d.r; });
    S.polys.forEach(function (p) { for (var i = 0; i < p.pts.length; i += 2) { if (p.pts[i] < x0) x0 = p.pts[i]; if (p.pts[i] > x1) x1 = p.pts[i]; if (p.pts[i + 1] < y0) y0 = p.pts[i + 1]; if (p.pts[i + 1] > y1) y1 = p.pts[i + 1]; } });
    if (view === 'river' && L.sk) {
      S.labels.forEach(function (l) { if (!l.bound) return; var b = labelBox(l); if (b) { if (b[0] < x0) x0 = b[0]; if (b[2] > x1) x1 = b[2]; } });
      if (L.height && L.height > y1) y1 = L.height;
    }
    if (!isFinite(x0)) { x0 = 0; y0 = 0; x1 = 100; y1 = 100; }
    if (L.is3d && L.c3) { var R3 = (L.radius3 || 300) * 1.18; x0 = L.c3[0] - R3; x1 = L.c3[0] + R3; y0 = L.c3[1] - R3; y1 = L.c3[1] + R3; }
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
    if (S.recStale) S.syncRecs();
    if (S.gridStale) { buildGrid(S); S.gridStale = false; }
    var G = S.grid, best = null, cs = G.cell;
    var c0 = Math.floor((wx - slop - S.x0) / cs), c1 = Math.floor((wx + slop - S.x0) / cs), r0 = Math.floor((wy - slop - S.y0) / cs), r1 = Math.floor((wy + slop - S.y0) / cs);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var a = G.map.get(r * G.cols + c);
      if (!a) continue;
      for (var j = 0; j < a.length; j++) {
        var n = S.nodes[a[j]];
        if (n.hidden) continue;
        if (wx >= n.x - slop && wx <= n.x + n.w + slop && wy >= n.y - slop && wy <= n.y + n.h + slop) { if (!best || (n.o !== undefined ? n.o : n.i) > (best.o !== undefined ? best.o : best.i)) best = n; }
      }
    }
    return best;
  }
  /** Node ids whose centers are inside a rectangle (world units). */
  function inRect(S, ax, ay, bx, by) {
    var x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by), out = [];
    if (S.recStale) S.syncRecs();
    S.nodes.forEach(function (n) { if (n.hidden || n.key.indexOf('shape:') === 0) return; var cx = n.x + n.w / 2, cy = n.y + n.h / 2; if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) out.push(n.key); });
    return out;
  }
  /** Node ids inside a free-hand outline (flat [x, y, ...] in world units). */
  function inLasso(S, poly) {
    var out = [], n = poly.length / 2;
    if (n < 3) return out;
    if (S.recStale) S.syncRecs();
    S.nodes.forEach(function (nd) {
      if (nd.hidden || nd.key.indexOf('shape:') === 0) return;
      var x = nd.x + nd.w / 2, y = nd.y + nd.h / 2, inside = false;
      for (var i = 0, j = n - 1; i < n; j = i++) { var xi = poly[i * 2], yi = poly[i * 2 + 1], xj = poly[j * 2], yj = poly[j * 2 + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; }
      if (inside) out.push(nd.key);
    });
    return out;
  }
  /* ---- edge picking: sample each curve into a coarse grid once, then test the nearest segments */
  function edgeIndex(S) {
    if (S.eidx) return S.eidx;
    var cell = Math.max(30, Math.max(S.w, S.h) / 120), map = new Map(), segs = [];
    var put = function (ref, ax, ay, bx, by, depth) {
      var c0 = Math.floor((Math.min(ax, bx) - S.x0) / cell), c1 = Math.floor((Math.max(ax, bx) - S.x0) / cell), r0 = Math.floor((Math.min(ay, by) - S.y0) / cell), r1 = Math.floor((Math.max(ay, by) - S.y0) / cell);
      if ((c1 - c0 + 1) * (r1 - r0 + 1) > 400 && (depth || 0) < 24) {   /* a long straight link: cut it in halves until each piece covers few cells (it used to be skipped, so it could not be hovered) */
        var mx = (ax + bx) / 2, my = (ay + by) / 2;
        put(ref, ax, ay, mx, my, (depth || 0) + 1); put(ref, mx, my, bx, by, (depth || 0) + 1);
        return;
      }
      var id = segs.length; segs.push([ax, ay, bx, by, ref]);
      for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) { var k = r * 100003 + c, a = map.get(k); if (a) a.push(id); else map.set(k, [id]); }
    };
    S.curves.forEach(function (cv, ci) {
      if (cv.edge === undefined || cv.edge < 0 || cv.dead) return;
      var P = cv.P, n = (P.length - 2) / 6, prev = [P[0], P[1]];
      for (var s = 0; s < n; s++) {
        var steps = cv.line ? 1 : 10;
        for (var i = 1; i <= steps; i++) { var pt = bez(P.slice(s * 6, s * 6 + 8), i / steps); put({ t: 'c', i: ci }, prev[0], prev[1], pt[0], pt[1]); prev = pt; }
      }
    });
    var maxHw = 0; S.curves.forEach(function (cv) { if (cv.loop && cv.w / 2 > maxHw) maxHw = cv.w / 2; });
    S.eidx = { cell: cell, map: map, segs: segs, maxHw: maxHw };
    return S.eidx;
  }
  /** The link cell of a matrix picture under a point (cells are drawn on top of the row bands, so they win over them), or null. */
  function matrixCellAt(S, wx, wy) {
    var M = S.matrix; if (!M) return null;
    var jx = Math.floor((wx - M.head) / M.cell), iy = Math.floor((wy - M.head) / M.cell);
    if (jx >= 0 && iy >= 0 && jx < M.n && iy < M.n) { var ee = M.at.get(iy * M.n + jx); if (ee !== undefined) return { edge: ee, from: M.ids[iy], to: M.ids[jx], cell: true }; }
    return null;
  }
  function pickEdge(S, wx, wy, tol) {
    var I = edgeIndex(S), cs = I.cell, best = null, bd = tol * tol, reach = tol + I.maxHw;
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
    for (var q = 0; q < S.ribbons.length; q++) { /* river ribbons */
      var rb = S.ribbons[q]; if (wx < rb.x0 || wx > rb.x1) continue;
      var lo = 0, hi = 1, u;   // the band's x runs along a cubic; find where it is at wx, then read the height there
      for (var it = 0; it < 14; it++) { u = (lo + hi) / 2; var m = 1 - u, xx = m * m * m * rb.x0 + 3 * m * m * u * rb.xm + 3 * m * u * u * rb.xm + u * u * u * rb.x1; if (xx < wx) lo = u; else hi = u; }
      u = (lo + hi) / 2; var m2 = 1 - u, w0 = m2 * m2 * (m2 + 3 * u), w1 = u * u * (3 * m2 + u);
      var ya = rb.y0a * w0 + rb.y1a * w1, yb = rb.y0b * w0 + rb.y1b * w1;
      if (wy >= Math.min(ya, yb) - tol && wy <= Math.max(ya, yb) + tol) return { edge: rb.edge, from: rb.from, to: rb.to, ribbon: q };
    }
    return matrixCellAt(S, wx, wy);
  }
  /** Rough box of a label in world units (for clicking labels). */
  function labelBox(l) {
    var w = l.t.length * l.size * 0.55, h = l.size * 1.1;
    if (l.rot) return null;
    var x = l.align === 'l' ? l.x : l.align === 'r' ? l.x - w : l.x - w / 2;
    return [x, l.y - h * 0.85, x + w, l.y + h * 0.25];
  }
  /** Which label is under a world point; k is the current zoom (labels hidden at this zoom are skipped). */
  function pickLabel(S, wx, wy, k) {
    for (var i = S.labels.length - 1; i >= 0; i--) {
      var l = S.labels[i]; if (k < l.minK || l.size * k < 6.5 || (l.a !== undefined && l.a < 0.05)) continue;
      var b = labelBox(l); if (b && wx >= b[0] && wx <= b[2] && wy >= b[1] && wy <= b[3]) return l;
    }
    return null;
  }
  function inPoly(pts, x, y) {
    var n = pts.length / 2, inside = false;
    for (var i = 0, j = n - 1; i < n; j = i++) { var xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; }
    return inside;
  }
  /**
   * What is under a point, in the order a person expects: a node, a label, a line, a group blob, a lane.
   * Returns { type: 'node'|'label'|'edge'|'group'|'lane'|'bg', ... }.
   */
  function hit(S, wx, wy, k, opt) {
    opt = opt || {};
    var slop = (opt.slop || 6) / k, mc = S.matrix ? matrixCellAt(S, wx, wy) : null;
    if (mc) return { type: 'edge', edge: mc.edge, from: mc.from, to: mc.to, cell: true };
    var n = pick(S, wx, wy, slop);
    if (n) return { type: 'node', node: n, key: n.key };
    var l = pickLabel(S, wx, wy, k);
    if (l) { if (l.group !== undefined) return { type: 'group', group: l.group }; if (l.node >= 0 && S.nodes[l.node]) return { type: 'label', node: S.nodes[l.node], key: S.nodes[l.node].key, label: l }; if (l.edge !== undefined && l.edge >= 0) { var cv = S.curves.filter(function (c) { return c.edge === l.edge; })[0]; return { type: 'edge', edge: l.edge, from: l.from !== undefined ? l.from : cv && cv.from, to: l.to !== undefined ? l.to : cv && cv.to }; } }
    var e = S.turn && S.turn.on ? null : pickEdge(S, wx, wy, (opt.edgeTol || 7) / k);   /* while a big 3D map is being turned its links are only on the card */
    if (e) return { type: 'edge', edge: e.edge, from: e.from, to: e.to, cell: e.cell };
    for (var i = S.polys.length - 1; i >= 0; i--) { var p = S.polys[i]; if (p.group !== undefined && inPoly(p.pts, wx, wy)) return { type: 'group', group: p.group }; }
    for (var j = 0; j < S.rects.length; j++) { var r = S.rects[j]; if (r.lane !== undefined && wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return { type: 'lane', lane: r.lane }; }
    return { type: 'bg' };
  }

  /* ---------------------------------------------------------------- layered views (flow, top-down, spine, lanes, river) */
  function layeredScene(X, view) {
    var S = X.S, L = X.L, T = X.T, lab = X.lab, addNode = X.addNode, fillOf = X.fillOf, valCol = X.valCol, nodeLabel = X.nodeLabel;
    var LR = L.dir !== 'TB', river = view === 'river', W = L.width || 0, H = L.height || 0;
    (L.lanes || []).forEach(function (ln, i) {
      var name = (L.laneNames || [])[ln.lane] || '';
      var r = LR ? { x: -10, y: ln.from, w: W + 20, h: ln.to - ln.from } : { x: ln.from, y: -10, w: ln.to - ln.from, h: H + 20 };
      S.rects.push({ x: r.x, y: r.y, w: r.w, h: r.h, r: 0, fill: i % 2 ? alpha(T.lane1, 0.55) : alpha(T.lane0, 0.8), stroke: [0, 0, 0, 0], sw: 0, layer: 0, node: -1, lane: name });
      lab(LR ? r.x + 12 : r.x + 8, LR ? r.y + 16 : r.y + 16, name, 12, T.muted, { align: 'l', bold: true, minK: 0.12, fixed: true, group: name });
    });
    if (view === 'spine') {
      var ch = L.nodes.filter(function (n) { return n.choke; }).sort(function (a, b) { return a.x - b.x; });
      if (ch.length > 1) { var P = [ch[0].x + ch[0].w / 2, ch[0].y + ch[0].h / 2]; for (var i = 1; i < ch.length; i++) { var a = ch[i - 1], b = ch[i]; var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2; P.push(ax + (bx - ax) / 3, ay, ax + 2 * (bx - ax) / 3, by, bx, by); } S.curves.push({ P: P, w: 9, color: alpha(T.gold, 0.28), arrow: false, edge: -1, from: null, to: null }); }
    }
    var order = L.nodes.slice().sort(function (a, b) { return a.layer - b.layer || (LR ? a.y - b.y : a.x - b.x); });
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
        var a0 = L.pos[e.from], b0 = L.pos[e.to];
        if ((a0 && a0._st && a0._st.hide) || (b0 && b0._st && b0._st.hide)) return;
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
        var back = e.kind === 'back' || e.kind === 'self' || e.kind === 'flat';
        var lk = X.look(e, ei, { w: Math.min(1.5 + Math.log2(e.count) * 0.9, 4.5), color: back ? alpha(T.gold, 0.8) : alpha(T.line, 0.78), arrow: !many });
        if (lk.hide) return;
        S.curves.push({ P: P, w: lk.w, color: lk.color, arrow: lk.arrow, tip: e.p1, edge: ei, from: e.from, to: e.to, back: back, dash: lk.dash });
        var txt = X.linkText(e, lk);
        if (txt && X.LC.links.show && !many && L.edges.length < 400) { var mid = bez(P, 0.5); lab(mid[0], mid[1] - 4, clip(txt, 28), 10 * X.LC.links.scale, T.muted, { minK: 0.9, edge: ei, bg: true }); }
        else if (!txt && X.o.edgeValueLabels && e.widthV === e.widthV && L.edges.length < 400) { var mid2 = bez(P, 0.5); lab(mid2[0], mid2[1] - 4, fmtNum(e.widthV), 10 * X.LC.links.scale, T.muted, { minK: 0.7, edge: ei, bg: true }); }
      });
    } else if (L.sk) sankeyBands(X); else riverRibbons(X);

    order.forEach(function (n) {
      var st = n._st, f = fillOf(n), vc = n.end ? valCol(n.valence) : null;
      if (st && st.hide) return;
      var sc = st && st.scale ? st.scale : 1, nx = n.x - (n.w * (sc - 1)) / 2, ny = n.y - (n.h * (sc - 1)) / 2, nw = n.w * sc, nh = n.h * sc, rr = st && (st.shape === 'dot' || st.shape === 'circle') ? Math.min(nw, nh) / 2 : st && st.shape === 'square' ? 2 : 10;
      if (river && L.sk) { sankeyNode(X, n); return; }
      if (river) {
        var rec0 = addNode(n, n.x, n.y, n.w, n.h);
        var bc = (X.endCol(n) || (n.end ? valCol(n.valence) : T.neutral));
        if (st && st.fill) bc = hex(st.fill);
        S.rects.push({ x: n.x, y: n.y, w: n.w, h: n.h, r: 3, fill: bc, stroke: n.start ? T.accent : [0, 0, 0, 0], sw: n.start ? 2 : 0, layer: 1, node: rec0.i });
        if (n.h > 14 || n.start || n.end) lab(n.x + n.w + 6, n.y + Math.min(n.h, 28) / 2 + 4, clip(X.tx(n), 24), 11, X.labColor(n, bc), { align: 'l', node: rec0.i, minK: 0.3, bold: n.start });
        return;
      }
      var rec = addNode(n, nx, ny, nw, nh);
      if (n.run) S.rects.push({ x: nx + 5, y: ny + 5, w: nw, h: nh, r: 10, fill: alpha(T.box, 0.7), stroke: alpha(T.boxLine, 0.8), sw: 1, layer: 1, node: rec.i });
      var stroke = st && st.stroke ? hex(st.stroke) : n.start ? T.accent : vc ? vc : T.boxLine, sw = st && st.sw !== undefined ? st.sw : n.start ? 3 : vc ? 3 : 1.2;
      S.rects.push({ x: nx, y: ny, w: nw, h: nh, r: rr, fill: f, stroke: n.ghost ? alpha(T.muted, 0.8) : stroke, sw: n.ghost ? 1.2 : sw, layer: 1, node: rec.i });
      if (n.choke) S.dots.push({ cx: nx + 11, cy: ny + 11, r: 5, fill: T.gold, stroke: alpha(T.box, 0.9), sw: 1.5, layer: 1, node: rec.i });
      if (n.start) lab(nx + nw - 8, ny + 14, 'START', 9, T.accent, { align: 'r', bold: true, node: rec.i, minK: 0.7, sub: true });
      var ic = st && (st.icon || st.image) && st.iconMode !== 'inside';
      X.addIcon(n, rec, nx + nw / 2, ny + nh / 2 - (ic ? 0 : nh * 0.12), Math.min(nw, nh) / 2 * (ic ? 0.95 : 1));
      if (ic) { var rr2 = S.rects[S.rects.length - 1]; rr2.fill = alpha(rr2.fill, 0.25); }
      nodeLabel(n, rec, 13);
    });
  }

  /* ---------------------------------------------------------------- Sankey (river) pictures from NFMSankey.layout */
  /** Color of one bar: the person's choice, else by group (each item its own color when there are no groups), else what the color mode says. */
  function sankeyColor(X, n) {
    var T = X.T, st = n._st, cb = X.o.colorBy || 'group', L = X.L;
    if (st && st.fill) return hex(st.fill);
    if (cb === 'odds') return X.endCol(n) || (n.end ? X.valCol(n.valence) : T.neutral);
    if (cb === 'group') {
      var gset = X.groupsSeen || (X.groupsSeen = new Set(L.nodes.map(function (q) { return q.group || ''; })));
      if (gset.size > 1 && n.group && n.group !== '(none)') return X.gcol(n.group);
      if (!X.idxOf) { X.idxOf = {}; L.nodes.slice().sort(function (a, b) { return a.layer - b.layer || a.y - b.y; }).forEach(function (q, i) { X.idxOf[q.id] = i; }); }
      return T.groups[X.idxOf[n.id] % T.groups.length];
    }
    var f = X.fillOf(n); return [f[0], f[1], f[2], 1];
  }
  function sankeyBands(X) {
    var S = X.S, L = X.L, T = X.T, K = L.sk, sk = X.o.sk || {}, mode = sk.color || 'target', base = sk.opacity === undefined ? 0.45 : sk.opacity, seen = {};
    var look = function (ei) {
      if (seen[ei] !== undefined) return seen[ei];
      var e = L.edges[ei], a = L.pos[e.from], b = L.pos[e.to], r = null;
      if (e && a && b && !(a._st && a._st.hide) && !(b._st && b._st.hide)) {
        var lk = X.look(e, ei, { w: 1, color: [0, 0, 0, base], arrow: false });
        if (!lk.hide) {
          var ls = X.o.linkStyle ? X.o.linkStyle(e, ei) : null, ca = sankeyColor(X, a), cb = sankeyColor(X, b), c, c2 = null;
          var md = ls && ls.mode ? ls.mode : mode;
          if (md === 'source') c = ca; else if (md === 'gradient') { c = ca; c2 = cb; } else if (md === 'solid') c = alpha(T.line, 1); else if (md === 'group') c = ca; else c = cb;
          if (L.ch && L.ch.ecolor) c = lk.color;
          if (ls && ls.color) c = hex(ls.color);
          if (ls && ls.color2) c2 = hex(ls.color2);
          r = { c: c, c2: c2, a: ls && ls.opacity !== undefined ? ls.opacity : base, e: e };
        }
      }
      seen[ei] = r; return r;
    };
    K.bands.forEach(function (bd) {
      var lk = look(bd.edge); if (!lk) return;
      S.ribbons.push({ x0: bd.x0, y0a: bd.y0a, y0b: bd.y0b, x1: bd.x1, y1a: bd.y1a, y1b: bd.y1b, xm: bd.xm, color: alpha(lk.c, lk.a), color2: lk.c2 ? alpha(lk.c2, lk.a) : null, edge: bd.edge, from: bd.from, to: bd.to });
    });
    K.loops.forEach(function (lp) {
      var lk = look(lp.edge); if (!lk) return;
      S.curves.push({ P: lp.P, w: Math.max(lp.w, 1), color: alpha(lk.c, lk.a * 0.85), arrow: false, edge: lp.edge, from: lp.from, to: lp.to, back: true, dash: 0, loop: true });
    });
    /* amounts on the flows */
    if (X.o.edgeValueLabels) {
      var done = {};
      K.bands.forEach(function (bd) {
        if (done[bd.edge]) return; var lk = look(bd.edge); if (!lk) return; var e = lk.e;
        var txt = e.widthV === e.widthV ? fmtNum(e.widthV) : '';
        var ls = X.o.linkStyle ? X.o.linkStyle(e, bd.edge) : null; if (ls && ls.label !== undefined && ls.label !== '') txt = ls.label;
        if (!txt) return; done[bd.edge] = 1;
        var thick = (bd.y0b - bd.y0a);
        X.lab(bd.x0 + 7, (bd.y0a + bd.y0b) / 2 + 4, clip(txt, 18), Math.max(9, Math.min(13, thick * 0.9)) * X.LC.links.scale, T.fg, { align: 'l', minK: 0.5, edge: bd.edge, from: bd.from, to: bd.to });
      });
    }
  }
  /** Total flow through an item in the data's own units (sum of the link amounts), or NaN. */
  function sankeyTotal(X, n) {
    if (!X.skTotals) {   /* every item's totals in one pass over the links (not one pass per item) */
      var tin = new Map(), tout = new Map();
      X.L.edges.forEach(function (e) { if (e.widthV !== e.widthV || e.kind === 'self') return; tin.set(e.to, (tin.get(e.to) || 0) + e.widthV); tout.set(e.from, (tout.get(e.from) || 0) + e.widthV); });
      X.skTotals = { tin: tin, tout: tout };
    }
    var hasIn = X.skTotals.tin.has(n.id), hasOut = X.skTotals.tout.has(n.id);
    return hasIn || hasOut ? Math.max(X.skTotals.tin.get(n.id) || 0, X.skTotals.tout.get(n.id) || 0) : NaN;
  }
  function sankeyNode(X, n) {
    var S = X.S, L = X.L, T = X.T, st = n._st, sk = X.o.sk || {};
    if (st && st.hide) return;
    if (X.skLastCol === undefined) { X.skLastCol = 0; L.nodes.forEach(function (q) { if (q.layer > X.skLastCol) X.skLastCol = q.layer; }); }
    var lastCol = X.skLastCol;
    var rec = X.addNode(n, n.x, n.y, n.w, n.h), bc = sankeyColor(X, n);
    if (st && st.opacity !== undefined) bc = alpha(bc, st.opacity);
    S.rects.push({ x: n.x, y: n.y, w: n.w, h: n.h, r: Math.min(3, n.w / 2), fill: bc, stroke: st && st.stroke ? hex(st.stroke) : n.start ? T.accent : [0, 0, 0, 0], sw: st && st.stroke ? (st.sw === undefined ? 1.5 : st.sw) : n.start ? 2 : 0, layer: 1, node: rec.i });
    var side = (st && st.labelSide) || sk.labels || 'auto';
    var left = side === 'left' || (side === 'auto' && n.layer === 0 && lastCol > 0);
    var size = 14, text = X.tx(n), tot = sk.nodeValues ? sankeyTotal(X, n) : NaN, cx = left ? n.x - 7 : n.x + n.w + 7;
    var col = X.labColor(n, bc), cy = n.y + n.h / 2, two = tot === tot;
    var l1 = X.lab(cx, cy + (two ? -1 : 4), clip(text, 30), size, col, n.start ? { align: left ? 'r' : 'l', node: rec.i, minK: 0.2, bold: true, bound: true } : { align: left ? 'r' : 'l', node: rec.i, minK: 0.2, bound: true });
    if (two && l1) X.lab(cx, cy + 12.5, fmtNum(tot), 10.5, T.muted, { align: left ? 'r' : 'l', node: rec.i, minK: 0.4, sub: true, bound: true });
  }

  function riverRibbons(X) {
    var S = X.S, L = X.L, T = X.T;
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
      var lk = X.look(e, ei, { w: 1, color: [0, 0, 0, 0.42], arrow: false });
      if (lk.hide) return;
      var t = Math.max(0.8, th[ei]), xa = a.x + a.w, xb = b.x, xm = (xa + xb) / 2;
      var c = X.endCol(b) || (b.end ? (b.valence === 'good' ? T.good : b.valence === 'bad' ? T.bad : T.neutral) : T.neutral);
      if (X.o.linkStyle || X.S.widthCh === '' && false) c = c;
      var ls = X.o.linkStyle ? X.o.linkStyle(e, ei) : null;
      if (ls && ls.color) c = hex(ls.color);
      else if (X.L.ch && X.L.ch.ecolor) c = lk.color;
      S.ribbons.push({ x0: xa, y0a: y0[ei], y0b: y0[ei] + t, x1: xb, y1a: y1[ei], y1b: y1[ei] + t, xm: xm, color: alpha(c, ls && ls.opacity !== undefined ? ls.opacity : 0.42), edge: ei, from: e.from, to: e.to });
    });
  }

  /* ---------------------------------------------------------------- arc view */
  function arcScene(X) {
    var S = X.S, L = X.L, T = X.T, lab = X.lab, addNode = X.addNode, fillOf = X.fillOf, valCol = X.valCol;
    var y0 = L.baseline, maxX = 0;
    L.nodes.forEach(function (n) { maxX = Math.max(maxX, n.cx); });
    S.curves.push({ P: [0, y0, (maxX + 30) / 3, y0, 2 * (maxX + 30) / 3, y0, maxX + 30, y0], w: 1, color: alpha(T.boxLine, 0.6), arrow: false, edge: -1, from: null, to: null });
    L.edges.forEach(function (e, ei) {
      var a = L.pos[e.from], b = L.pos[e.to];
      if (!a || !b || a === b) return;
      if ((a._st && a._st.hide) || (b._st && b._st.hide)) return;
      var xa = a.cx, xb = b.cx, dx = Math.abs(xb - xa), h = Math.min(dx * 0.5, y0 - 16), back = xb < xa;
      var k = h * 4 / 3, lk = X.look(e, ei, { w: Math.min(1.2 + Math.log2(e.count), 4), color: back ? alpha(T.gold, 0.55) : alpha(T.line, 0.45), arrow: false });
      if (lk.hide) return;
      S.curves.push({ P: [xa, y0, xa, y0 - k, xb, y0 - k, xb, y0], w: lk.w, color: lk.color, arrow: false, edge: ei, from: e.from, to: e.to, back: back, dash: lk.dash });
      var txt = X.linkText(e, lk);
      if (txt && X.LC.links.show && L.edges.length < 300) lab((xa + xb) / 2, y0 - h * 0.75 - 4, clip(txt, 24), 10 * X.LC.links.scale, T.muted, { minK: 0.9, edge: ei, bg: true });
    });
    L.nodes.forEach(function (n) {
      var st = n._st; if (st && st.hide) return;
      var sc = st && st.scale ? st.scale : 1, r = (5 + 6 * Math.sqrt(n.sizeK !== undefined ? n.sizeK : (n.traffic || 0))) * sc, rec = addNode(n, n.cx - r, y0 - r, 2 * r, 2 * r);
      var vc = n.end ? valCol(n.valence) : null, fill = n.start ? T.accent : fillOf(n).map(function (v, i) { return i < 3 ? v : Math.max(v, 0.9); });
      S.dots.push({ cx: n.cx, cy: y0, r: r, fill: fill, stroke: st && st.stroke ? hex(st.stroke) : vc || T.box, sw: st && st.sw !== undefined ? st.sw : vc ? 2.5 : 1.5, layer: 1, node: rec.i, kind: SHAPE_KIND[st && st.shape] === undefined ? 1 : SHAPE_KIND[st.shape] });
      X.addIcon(n, rec, n.cx, y0, r);
      lab(n.cx + 4, y0 + r + 10, clip(X.tx(n), 26), 11, X.labColor(n, fill), { align: 'l', rot: 60, node: rec.i, minK: 0.3 });
    });
  }

  /* ---------------------------------------------------------------- matrix view */
  function matrixScene(X) {
    var S = X.S, L = X.L, T = X.T, lab = X.lab, addNode = X.addNode, gcol = X.gcol;
    var cell = L.cell, head = L.head, n = L.nodes.length, big = n > 300, widthR = L.ch && L.ch.width && L.ch.width.n ? L.ch.width : null;
    S.matrix = { head: head, cell: cell, n: n, ids: [], at: new Map() };
    L.nodes.forEach(function (nd) { S.matrix.ids[nd.mi] = nd.id; });
    S.rects.push({ x: head, y: head, w: n * cell, h: n * cell, r: 0, fill: alpha(T.box, 0.6), stroke: alpha(T.boxLine, 0.8), sw: 1, layer: 0, node: -1 });
    L.nodes.forEach(function (nd) {
      var rec = addNode(nd, 0, head + nd.mi * cell, head + (nd.mi + 1) * cell, cell);
      S.rects.push({ x: head + nd.mi * cell, y: head + nd.mi * cell, w: cell, h: cell, r: 0, fill: alpha(T.muted, 0.18), stroke: [0, 0, 0, 0], sw: 0, layer: 0, node: -1 });
      var sz = Math.min(11, cell - 3), col = X.labColor(nd, null);
      lab(head - 6, head + nd.mi * cell + cell / 2 + sz / 3, clip(X.tx(nd), 26), sz, col, { align: 'r', node: rec.i, minK: big ? 0.9 : 0.25 });
      lab(head + nd.mi * cell + cell / 2 + sz / 3, head - 6, clip(X.tx(nd), 26), sz, col, { align: 'l', rot: -90, node: rec.i, minK: big ? 0.9 : 0.25 });
    });
    L.edges.forEach(function (e, ei) {
      var a = L.pos[e.from], b = L.pos[e.to];
      if (!a || !b) return;
      var back = e.kind === 'back' || e.kind === 'self', lk = X.look(e, ei, { w: 1, color: back ? alpha(T.gold, 0.9) : alpha(gcol(a.group), 0.95), arrow: false });
      if (lk.hide) return;
      var col = lk.color;
      if (widthR && e.widthV === e.widthV) col = alpha(col, 0.25 + 0.75 * Math.pow(Math.max(0, e.widthV) / (widthR.max || 1), 0.6));
      S.matrix.at.set(a.mi * L.nodes.length + b.mi, ei);
      S.rects.push({ x: head + b.mi * cell + 1, y: head + a.mi * cell + 1, w: cell - 2, h: cell - 2, r: Math.min(3, cell / 4), fill: col, stroke: [0, 0, 0, 0], sw: 0, layer: 1, node: -1, edge: ei, from: e.from, to: e.to });
    });
    lab(head + n * cell + 10, head + 12, 'rows are where a link starts, columns are where it goes', 10, T.muted, { align: 'l', minK: 0.3 });
  }

  /* ---------------------------------------------------------------- network view (2D with a fisheye lens, or 3D with a camera) */
  function networkScene(X) {
    var S = X.S, L = X.L, T = X.T, o = X.o, lab = X.lab, addNode = X.addNode, fillOf = X.fillOf, valCol = X.valCol, gcol = X.gcol;
    var m = L.edges.length, arrows = m <= 500, a = X.autoA, n3 = !!L.is3d, cam = o.cam || { yaw: 0.6, pitch: 0.35, persp: 2.4 }, lens = !n3 && o.lens && o.lens.r > 0 ? o.lens : null;
    var PN = new Map(), list = [], i;
    /* turning a 3D map only changes the camera: what each item and link looks like is worked out once and kept in o.plan for the next picture */
    var P3 = n3 && o.plan ? (o.plan === true ? (L.__plan || (L.__plan = {})) : o.plan) : null, ST = null;
    /* the kept looks are only good for the same theme, palette, color mode and (for the built-in cache on L) label function */
    var planKey = (o.theme || 'light') + '|' + (o.palette || '') + '|' + (o.colorBy || 'group');
    if (P3) { if (P3.L !== L || !P3.net || P3.key !== planKey || (o.plan === true && P3.lf !== o.labelFn)) { P3.L = L; P3.key = planKey; P3.lf = o.labelFn; P3.net = { nodes: new Array(L.nodes.length), edges: new Array(L.edges.length), rk: null, idxOf: null }; } ST = P3.net; }
    var cy3 = Math.cos(cam.yaw), sy3 = Math.sin(cam.yaw), cp3 = Math.cos(cam.pitch), sp3 = Math.sin(cam.pitch), R3 = L.radius3 || 300, D3 = R3 * (cam.persp || 2.4);
    var recs = new Array(L.nodes.length);
    L.nodes.forEach(function (n, qi) {
      var st = n._st, r = n.w / 2 * (st && st.scale ? st.scale : 1), px = n.cx, py = n.cy, depth = 0, f = 1;
      if (n3) {
        var x = n.cx - L.c3[0], y = n.cy - L.c3[1], z = n.z || 0, x1 = x * cy3 + z * sy3, z1 = -x * sy3 + z * cy3, y2 = y * cp3 - z1 * sp3, z2 = y * sp3 + z1 * cp3;
        f = D3 / (D3 + z2); px = L.c3[0] + x1 * f; py = L.c3[1] + y2 * f; r *= f; depth = z2;
      } else if (lens) {
        var dx = px - lens.x, dy = py - lens.y, d = Math.hypot(dx, dy);
        if (d < lens.r && d > 1e-6) { var u = d / lens.r, g = ((lens.d + 1) * u) / (lens.d * u + 1), nd2 = g * lens.r; px = lens.x + dx / d * nd2; py = lens.y + dy / d * nd2; r *= Math.min(2.6, Math.max(1, nd2 / d) * 0.85 + 0.15); }
      }
      var rec = { n: n, px: px, py: py, r: r, depth: depth, f: f, hide: !!(st && st.hide) };
      recs[qi] = rec; if (!ST) PN.set(n.id, rec); list.push(rec);
    });
    if (n3) list.sort(function (p, q) { return q.depth - p.depth; });
    var dmin = Infinity, dmax = -Infinity; list.forEach(function (p) { if (p.depth < dmin) dmin = p.depth; if (p.depth > dmax) dmax = p.depth; });
    var fade = function (p) { return n3 && dmax > dmin ? 0.42 + 0.58 * (1 - (p.depth - dmin) / (dmax - dmin)) : 1; };
    list.forEach(function (p) { p.fd = fade(p); });
    /* which two items each link joins, as positions in L.nodes: looked up by name once, not on every picture */
    var ef = null, et = null;
    if (ST) {
      if (!ST.ef) {
        var im = new Map(); L.nodes.forEach(function (n, q) { im.set(n.id, q); });
        ST.ef = new Int32Array(m); ST.et = new Int32Array(m); ST.idxOf = im;
        L.edges.forEach(function (e, ei) { var a = im.get(e.from), b = im.get(e.to); ST.ef[ei] = a === undefined ? -1 : a; ST.et[ei] = b === undefined ? -1 : b; });
      }
      ef = ST.ef; et = ST.et;
    }
    /* group blobs */
    if (o.hulls && !n3) {
      var byG = new Map(); list.forEach(function (p) { if (p.hide) return; var g = p.n.group || ''; if (!byG.has(g)) byG.set(g, []); byG.get(g).push(p); });
      byG.forEach(function (ps, g) {
        if (ps.length < 3 || byG.size > 40) return;
        var pts = []; ps.forEach(function (p) { var rr = p.r + 16; for (var q = 0; q < 8; q++) { var an = q * Math.PI / 4; pts.push(p.px + rr * Math.cos(an), p.py + rr * Math.sin(an)); } });
        var h = hull(pts), cx = 0, cy = 0; for (var k2 = 0; k2 < h.length; k2 += 2) { cx += h[k2]; cy += h[k2 + 1]; } cx /= h.length / 2; cy /= h.length / 2;
        var c = gcol(g); S.polys.push({ pts: h, c: [cx, cy], fill: alpha(c, 0.13), stroke: alpha(c, 0.55), group: g });
        if (X.LC.groups.show) lab(cx, cy - 6, g || '(no group)', 18 * X.LC.groups.scale, mix(T.fg, c, 0.5), { bold: true, minK: 0.05, group: g, fixed: true });
      });
    } else if (X.LC.groups.show && !n3) {
      var cg = new Map(); list.forEach(function (p) { if (p.hide) return; var g = p.n.group || '', c = cg.get(g) || { x: 0, y: 0, k: 0 }; c.x += p.px; c.y += p.py; c.k++; cg.set(g, c); });
      cg.forEach(function (c, g) { if (c.k > 1 && cg.size <= 40) lab(c.x / c.k, c.y / c.k, g || '(no group)', 18 * X.LC.groups.scale, mix(T.fg, gcol(g), 0.5), { bold: true, minK: 0.05, group: g, fixed: true }); });
    }
    L.edges.forEach(function (e, ei) {
      var s = ef ? (ef[ei] < 0 ? undefined : recs[ef[ei]]) : PN.get(e.from), t = et ? (et[ei] < 0 ? undefined : recs[et[ei]]) : PN.get(e.to);
      if (!s || !t || s === t || s.hide || t.hide) return;
      var sp = ST ? ST.edges[ei] : undefined;
      if (sp === undefined) {
        var same0 = s.n.group && s.n.group === t.n.group, lk0 = X.look(e, ei, { w: Math.min(1 + Math.log2(e.count) * 0.4, 2.5), color: same0 ? alpha(gcol(s.n.group), a + 0.1) : alpha(T.line, a), arrow: arrows });
        sp = lk0.hide ? null : { lk: lk0, txt: X.linkText(e, lk0) };
        if (ST) ST.edges[ei] = sp;
      }
      if (!sp) return;
      var lk = sp.lk, dx = t.px - s.px, dy = t.py - s.py, d = Math.sqrt(dx * dx + dy * dy) || 1, r = t.r + (arrows ? HEAD * (n3 ? t.f : 1) : 0), ex = t.px - dx / d * r, ey = t.py - dy / d * r;
      var sx = s.px + dx / d * s.r, sy = s.py + dy / d * s.r, fd = n3 ? (s.fd + t.fd) / 2 : 1;
      var bend = lk.bend || 0, nx = -dy / d * bend * d * 0.5, ny = dx / d * bend * d * 0.5;
      var c1x = sx + (ex - sx) / 3 + nx, c1y = sy + (ey - sy) / 3 + ny, c2x = sx + 2 * (ex - sx) / 3 + nx, c2y = sy + 2 * (ey - sy) / 3 + ny;
      S.curves.push({ P: [sx, sy, c1x, c1y, c2x, c2y, ex, ey], w: n3 ? lk.w * ((s.f + t.f) / 2) : lk.w, color: n3 ? alpha(lk.color, lk.color[3] * fd) : lk.color, arrow: lk.arrow, line: !bend, tip: lk.arrow ? [t.px - dx / d * t.r, t.py - dy / d * t.r] : undefined, edge: ei, from: e.from, to: e.to, dash: lk.dash });
      var txt = sp.txt;
      if (txt && X.LC.links.show && m < 600) lab((sx + ex) / 2, (sy + ey) / 2 - 4, clip(txt, 24), 10 * X.LC.links.scale, T.muted, { minK: 0.9, edge: ei, bg: true });
      else if (!txt && o.edgeValueLabels && e.widthV === e.widthV && m < 600) lab((sx + ex) / 2, (sy + ey) / 2 - 4, fmtNum(e.widthV), 10 * X.LC.links.scale, T.muted, { minK: 0.7, edge: ei, bg: true });
    });
    var rk, idxOf;
    if (ST && ST.rk) { rk = ST.rk; idxOf = ST.idxOf; }
    else {
      var rank = L.nodes.map(function (n, q) { return q; }).sort(function (p, q) { return L.nodes[q].deg - L.nodes[p].deg; }); rk = new Array(L.nodes.length);
      rank.forEach(function (q, r) { rk[q] = r; });
      if (ST && ST.idxOf) idxOf = ST.idxOf; else { idxOf = new Map(); L.nodes.forEach(function (n, q) { idxOf.set(n.id, q); }); }
      if (ST) { ST.rk = rk; ST.idxOf = idxOf; }
    }
    var topN = X.LC.items.topN, recOf = n3 && ST ? new Int32Array(L.nodes.length).fill(-1) : null, dotOf = recOf ? new Int32Array(L.nodes.length).fill(-1) : null;
    /* one item's name under it: the same call for a normal picture and for a turn frame */
    var emitLabel = function (n, q, np, rec, px, py, r, f, fd) {
      var rnk = rk[q], showTop = topN && rnk < topN, fill = n3 ? alpha(np.fill, np.fill[3] * fd) : np.fill;
      lab(px, py + r + 11 * (n3 ? f : 1), np.text, 11 * (n3 ? Math.max(0.7, f) : 1), np.col || X.labColor(n, fill), { node: rec.i, minK: showTop ? 0.05 : 0.22 * (1 + rnk / 35), bold: rnk < 8 });
    };
    list.forEach(function (p) {
      var n = p.n, st = n._st, r = p.r; if (p.hide) return;
      var rec = addNode(n, p.px - r, p.py - r, 2 * r, 2 * r), q = idxOf.get(n.id), fd = p.fd, np = ST ? ST.nodes[q] : undefined;
      if (recOf) { recOf[q] = rec.i; dotOf[q] = S.dots.length; }
      if (np === undefined) {
        var vc0 = n.end ? valCol(n.valence) : null, fill0 = n.start ? mix(fillOf(n), T.accent, 0.7) : fillOf(n).map(function (v, k) { return k < 3 ? v : Math.max(v, 0.92); }), kind0 = SHAPE_KIND[st && st.shape]; if (kind0 === undefined) kind0 = 1;
        np = { fill: fill0, kind: kind0, replace: !!(st && (st.icon || st.image) && st.iconMode !== 'inside'), stroke: st && st.stroke ? hex(st.stroke) : n.start ? T.accent : vc0 || alpha(T.box, 0.9), sw: st && st.sw !== undefined ? st.sw : n.start ? 3 : vc0 ? 2.5 : 1.2, text: clip(X.tx(n), 24), col: X.LC.items.color === 'fill' ? null : X.labColor(n, fill0) };
        if (ST) ST.nodes[q] = np;
      }
      var fill = n3 ? alpha(np.fill, np.fill[3] * fd) : np.fill, kind = np.kind, replace = np.replace;
      S.dots.push({ cx: p.px, cy: p.py, r: r, fill: replace ? alpha(fill, 0.15) : fill, stroke: np.stroke, sw: np.sw, layer: 1, node: rec.i, kind: kind });
      if (n.choke) S.dots.push({ cx: p.px + r * 0.72, cy: p.py - r * 0.72, r: Math.max(2.5, r * 0.3), fill: T.gold, stroke: alpha(T.box, 0.9), sw: 1, layer: 1, node: rec.i });
      X.addIcon(n, rec, p.px, p.py, r);
      emitLabel(n, q, np, rec, p.px, p.py, r, p.f, fd);
    });
    if (recOf && o.rig && S.icons.length === 0 && m >= (o.rigMin === undefined ? RIG_MIN_LINKS : o.rigMin)) {
      if (ST.rig === undefined) ST.rig = makeRig(L, ST, T, idxOf, rk);
      if (ST.rig) attachTurn(X, ST.rig, { recOf: recOf, dotOf: dotOf, np: ST.nodes, idxOf: idxOf, rk: rk, emitLabel: emitLabel, cam: cam, R3: R3, topN: topN });
    }
  }

  /* ---------------------------------------------------------------- turning a big 3D map on the graphics card */
  var RIG_MIN_LINKS = 1500;
  /**
   * The parts of a big 3D map that do not change while it turns: where each item sits in space, how it looks, which two items each link joins and how it looks.
   * The graphics card is given these once; for each new angle it works out the screen places itself (src/render.js). Returns null when this map cannot be drawn
   * that way (bent, dashed or arrow-headed links; fewer than a few links), and the ordinary picture is used instead.
   */
  var RIG_ID = 0;
  function makeRig(L, ST, T, idxOf, rk) {
    var N = L.nodes.length, nodeF = new Float32Array(N * 16), pos = new Float64Array(N * 4), hid = new Uint8Array(N), chk = new Uint8Array(N), c3 = L.c3 || [0, 0], q, ei;
    for (q = 0; q < N; q++) {
      var n = L.nodes[q], st = n._st, np = ST.nodes[q], o = q * 16;
      pos[q * 4] = n.cx - c3[0]; pos[q * 4 + 1] = n.cy - c3[1]; pos[q * 4 + 2] = n.z || 0; pos[q * 4 + 3] = n.w / 2 * (st && st.scale ? st.scale : 1);
      if (st && st.hide) { hid[q] = 1; continue; }
      if (!np) return null;
      for (var i = 0; i < 3; i++) { nodeF[o + i] = pos[q * 4 + i]; }
      nodeF[o + 3] = pos[q * 4 + 3];
      for (i = 0; i < 4; i++) { nodeF[o + 4 + i] = np.fill[i]; nodeF[o + 8 + i] = np.stroke[i]; }
      chk[q] = n.choke ? 1 : 0;
      nodeF[o + 12] = np.sw; nodeF[o + 13] = np.kind; nodeF[o + 14] = (np.replace ? 1 : 0) + (n.choke ? 2 : 0); nodeF[o + 15] = 0;
    }
    var rows = [];
    for (ei = 0; ei < L.edges.length; ei++) {
      var e = L.edges[ei], a = idxOf.get(e.from), b = idxOf.get(e.to);
      if (a === undefined || b === undefined || a === b || hid[a] || hid[b]) continue;
      var sp = ST.edges[ei];
      if (sp === undefined) return null;
      if (!sp) continue;
      var lk = sp.lk;
      if (lk.bend || lk.dash || lk.arrow) return null;
      rows.push(a, b, lk.w, lk.color[0], lk.color[1], lk.color[2], lk.color[3], ei);
    }
    var M = rows.length / 8, edgeF = new Float32Array(M * 8), edgeIdx = new Int32Array(M);
    for (var k = 0; k < M; k++) { var r = k * 8; edgeF[r] = rows[r]; edgeF[r + 1] = rows[r + 1]; edgeF[r + 2] = rows[r + 2]; edgeF[r + 3] = 0; edgeF[r + 4] = rows[r + 3]; edgeF[r + 5] = rows[r + 4]; edgeF[r + 6] = rows[r + 5]; edgeF[r + 7] = rows[r + 6]; edgeIdx[k] = rows[r + 7]; }
    /* what the card reads per link: both ends' places and sizes copied in (they never change, only the angle does), then the width, then the color; so drawing a link needs no second look-up */
    var edgeG = new Float32Array(M * 16);
    for (k = 0; k < M; k++) { var r2 = k * 8, g = k * 16, ia = edgeF[r2] * 16, ib = edgeF[r2 + 1] * 16; for (var c = 0; c < 4; c++) { edgeG[g + c] = nodeF[ia + c]; edgeG[g + 4 + c] = nodeF[ib + c]; edgeG[g + 12 + c] = edgeF[r2 + 4 + c]; } edgeG[g + 8] = edgeF[r2 + 2]; }
    var byRank = []; for (q = 0; q < N; q++) if (!hid[q]) byRank.push(q);
    byRank.sort(function (p1, p2) { return rk[p1] - rk[p2]; });
    return { id: ++RIG_ID, n: N, m: M, pos: pos, nodeF: nodeF, edgeF: edgeF, edgeG: edgeG, edgeIdx: edgeIdx, hid: hid, chk: chk, byRank: Int32Array.from(byRank), c3: c3 };
  }
  /** What the person has done to the drawing (dimmed, selected, marked), for the graphics card: one row per item and per link, read from the styled lists of the last full picture. */
  function rigStyle(S) {
    var rig = S.rig, N = rig.n, M = rig.m, ns = new Float32Array(N * 8), es = new Float32Array(M * 4), q, k;
    for (q = 0; q < N; q++) {
      var rec = S.nodes[S.turnMap.recOf[q]];
      ns[q * 8] = rec && rec.a !== undefined ? rec.a : 1;
      if (rec && rec.ring) { ns[q * 8 + 1] = 1; ns[q * 8 + 4] = rec.ring[0]; ns[q * 8 + 5] = rec.ring[1]; ns[q * 8 + 6] = rec.ring[2]; ns[q * 8 + 7] = rec.ring[3]; }
    }
    for (k = 0; k < M; k++) { var c = S.curves[k]; es[k * 4] = c.a === undefined ? 1 : c.a; es[k * 4 + 1] = c.base && c.color !== c.base.color ? 1 : 0; }
    return { node: ns, edge: es };
  }
  /** Adds S.turnTo(cam, k): puts a picture of the same map from another angle on the graphics card with almost no work here (a depth order and the few visible names). */
  function attachTurn(X, rig, M) {
    var S = X.S, L = X.L, T = X.T, o = X.o, N = rig.n, cam = M.cam, R3 = M.R3, c3 = rig.c3, lab = X.lab;
    var PX = new Float64Array(N), PY = new Float64Array(N), PR = new Float64Array(N), PF = new Float64Array(N), PD = new Float64Array(N);
    var keys = new Uint32Array(N), ia = new Uint32Array(N), ib = new Uint32Array(N), cnt = new Uint32Array(2048), f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
    var seq = new Uint32Array(N * 2), mask = new Uint8Array(N), fixedMin = X.LC.items.fixedMin, rankOf = new Uint32Array(N), lpool = new Array(N), lk = new Float64Array(N), qOfRec = new Int32Array(S.nodes.length).fill(-1);
    for (var qi = 0; qi < N; qi++) if (M.recOf[qi] >= 0) qOfRec[M.recOf[qi]] = qi;
    S.rig = rig; S.turnMap = M; S.styleVer = (S.styleVer || 0);
    /* brings the item records up to date with the last angle (in record order, which walks memory in a line) */
    S.syncRecs = function () {
      if (!S.recStale) return; S.recStale = false;
      var recs = S.nodes;
      for (var ri = 0; ri < recs.length; ri++) { var qr = qOfRec[ri]; if (qr < 0) continue; var rc0 = recs[ri], r0 = PR[qr]; rc0.x = PX[qr] - r0; rc0.y = PY[qr] - r0; rc0.w = rc0.h = 2 * r0; rc0.o = rankOf[qr]; }
    };
    S.turnTo = function (cam2, kmax) {
      var c = cam2 || cam, cy3 = Math.cos(c.yaw), sy3 = Math.sin(c.yaw), cp3 = Math.cos(c.pitch), sp3 = Math.sin(c.pitch), D3 = R3 * (c.persp || 2.4), pos = rig.pos, q, dmin = Infinity, dmax = -Infinity;
      for (q = 0; q < N; q++) {
        var x = pos[q * 4], y = pos[q * 4 + 1], z = pos[q * 4 + 2], x1 = x * cy3 + z * sy3, z1 = -x * sy3 + z * cy3, y2 = y * cp3 - z1 * sp3, z2 = y * sp3 + z1 * cp3, f = D3 / (D3 + z2);
        PX[q] = c3[0] + x1 * f; PY[q] = c3[1] + y2 * f; PR[q] = pos[q * 4 + 3] * f; PF[q] = f; PD[q] = z2;
        if (z2 < dmin) dmin = z2; if (z2 > dmax) dmax = z2;
      }
      /* back to front, as the ordinary picture sorts (farthest first, ties in item order): a stable radix sort on the depth */
      for (q = 0; q < N; q++) { f32[0] = -PD[q]; var b = u32[0]; keys[q] = (b & 0x80000000) ? ~b >>> 0 : (b | 0x80000000) >>> 0; ia[q] = q; }
      var src = ia, dst = ib, pass, sh;
      for (pass = 0; pass < 3; pass++) {
        sh = pass * 11; cnt.fill(0);
        for (q = 0; q < N; q++) cnt[(keys[src[q]] >>> sh) & 2047]++;
        for (q = 0, b = 0; q < 2048; q++) { var t = cnt[q]; cnt[q] = b; b += t; }
        for (q = 0; q < N; q++) { var id = src[q]; dst[cnt[(keys[id] >>> sh) & 2047]++] = id; }
        var sw = src; src = dst; dst = sw;
      }
      var ord = src, ns = 0, fadeOn = dmax > dmin, inv = fadeOn ? 1 / (dmax - dmin) : 0, recs = S.nodes;
      for (q = 0; q < N; q++) {
        var it = ord[q]; rankOf[it] = q; if (rig.hid[it]) continue;
        seq[ns++] = it * 2; if (rig.chk[it]) seq[ns++] = it * 2 + 1;
      }
      S.recStale = true;   /* the item records (places and paint rank) are brought up to date only when something reads them: picking, selecting, centering (S.syncRecs) */
      /* the names that can be seen at this zoom (the ordinary picture makes all of them and the drawing skips the small ones) */
      S.labels = []; mask.fill(0);
      var byRank = rig.byRank, topN = M.topN, i, kk = kmax || 1;
      for (i = 0; i < byRank.length; i++) {
        var qq = byRank[i], rnk = M.rk[qq], mk = topN && rnk < topN ? 0.05 : 0.22 * (1 + rnk / 35);
        if (fixedMin !== undefined) mk = Math.min(mk, fixedMin);
        if (mk > kk) { if (fixedMin === undefined) break; else continue; }
        mask[qq] = 1;
      }
      for (q = 0; q < N; q++) {
        var iq = ord[q]; if (!mask[iq] || rig.hid[iq]) continue;
        var lp = lpool[iq];
        if (lp) {   /* seen before: only the place and the size change with the angle, so the same label object is moved (no new objects per picture) */
          lp.x = PX[iq]; lp.y = PY[iq] + PR[iq] + 11 * PF[iq]; lp.size = lk[iq] * (PF[iq] > 0.7 ? PF[iq] : 0.7); S.labels.push(lp); continue;
        }
        var rc = recs[M.recOf[iq]], fd = fadeOn ? 0.42 + 0.58 * (1 - (PD[iq] - dmin) / (dmax - dmin)) : 1, np = M.np[iq], nb = S.labels.length;
        M.emitLabel(L.nodes[iq], iq, np, rc, PX[iq], PY[iq], PR[iq], PF[iq], fd);
        /* a label whose color does not change with the fade (the usual case) is kept for the next picture */
        if (lp === undefined) { var made = S.labels.length > nb ? S.labels[nb] : null; if (made && np.col) { lpool[iq] = made; lk[iq] = made.size / (PF[iq] > 0.7 ? PF[iq] : 0.7); } else lpool[iq] = null; }
      }
      S.labels.forEach(function (l) { var rr = recs[l.node]; l.a = rr && rr.a !== undefined ? rr.a : 1; });
      S.gridStale = true;
      var prev = S.turn;
      S.turn = { on: true, ver: prev ? prev.ver + 1 : 1, seq: seq, nseq: ns, cy: cy3, sy: sy3, cp: cp3, sp: sp3, c3x: c3[0], c3y: c3[1], D3: D3, fadeOn: fadeOn ? 1 : 0, dmin: dmin, inv: inv, kmax: kk, cam: { yaw: c.yaw, pitch: c.pitch, persp: c.persp }, gold: T.gold, boxS: alpha(T.box, 0.9), accent: T.accent };
      return S.turn;
    };
  }

  /* ---------------------------------------------------------------- story shape */
  function shapeScene(X) {
    var S = X.S, L = X.L, T = X.T, lab = X.lab, addNode = X.addNode;
    var segs = L.segs, y = 0, W = 340;
    var box = function (id, label) {
      var rec = addNode({ id: 'shape:' + id, nodeId: id, label: label, deg: 0 }, 0, y, W, 46);
      S.rects.push({ x: 0, y: y, w: W, h: 46, r: 12, fill: alpha(T.gold, 0.22), stroke: T.gold, sw: 2.5, layer: 1, node: rec.i });
      lab(W / 2, y + 28, clip(label, 38), 14, T.fg, { bold: true, node: rec.i });
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
      lab(W / 2, y + 24, clip(lines[0], 52), 13, T.fg, { bold: true });
      lab(W / 2, y + 45, lines[1], 12, T.muted, {});
      lab(W / 2, y + 64, clip(lines[2], 60), 11, T.muted, {});
      y += h; join(16);
      if (s.toId) box(s.toId, s.toLabel); else { lab(W / 2, y + 22, 'the story branches out to its endings from here', 12, T.muted, {}); y += 36; }
    });
  }

  /* ---------------------------------------------------------------- drawing state: selection, neighbors, marks, pins */
  /**
   * st: { focus: Set of node ids kept bright (null = all), edges: Set of edge indices kept bright (null = derived from focus),
   *       sel: Set of selected node ids, selEdges: Set of selected edge indices, marks: Map id -> '#hex' (highlight color), dimTo: 0.22 }
   */
  function style(S, st) {
    st = st || {};
    var focus = st.focus && st.focus.size ? st.focus : null, sel = st.sel || null, selE = st.selEdges || null, marks = st.marks || null, dimTo = st.dimTo === undefined ? 0.22 : st.dimTo;
    var edgeBright = function (c) {
      if (c.from === null || c.from === undefined || c.edge === undefined || c.edge < 0) return true;
      if (st.edges) return st.edges.has(c.edge);
      if (!focus) return true;
      return focus.has(c.from) && focus.has(c.to);
    };
    S.nodes.forEach(function (n) { n.a = !focus || focus.has(n.key) ? 1 : dimTo; n.ring = sel && sel.has(n.key) ? S.theme.accent : marks && marks.get(n.key) ? hex(marks.get(n.key)) : null; });
    S.styleVer = (S.styleVer || 0) + 1;
    var remember = function (o, keys) { if (!o.base) { o.base = {}; keys.forEach(function (k) { o.base[k] = o[k]; }); } };
    var ring = function (o, node) {
      remember(o, ['stroke', 'sw']);
      var id = S.nodes[node] && S.nodes[node].key, mk = marks && marks.get(id);
      if (sel && sel.has(id)) { o.stroke = S.theme.accent; o.sw = Math.max(o.base.sw, 4); }
      else if (mk) { o.stroke = hex(mk); o.sw = Math.max(o.base.sw, 4); }
      else { o.stroke = o.base.stroke; o.sw = o.base.sw; }
    };
    S.rects.forEach(function (r) {
      if (r.node >= 0 && S.nodes[r.node] && r.layer === 1) ring(r, r.node);
      r.a = r.node >= 0 && S.nodes[r.node] ? S.nodes[r.node].a : r.from !== undefined ? (edgeBright(r) ? 1 : 0.08) : 1;
    });
    S.dots.forEach(function (d) { if (d.node >= 0 && S.nodes[d.node] && d.r > 4 && d.fill[3] > 0.1 && !d.isMark) ring(d, d.node); d.a = d.node >= 0 && S.nodes[d.node] ? S.nodes[d.node].a : 1; });
    S.icons.forEach(function (ic) { ic.a = ic.node >= 0 && S.nodes[ic.node] ? S.nodes[ic.node].a : 1; });
    S.labels.forEach(function (l) { l.a = l.node >= 0 && S.nodes[l.node] ? S.nodes[l.node].a : (l.edge !== undefined && S.curves.length ? 1 : 1); });
    S.curves.forEach(function (c) {
      remember(c, ['w', 'color']);
      var on = selE && c.edge >= 0 && selE.has(c.edge);
      c.w = on ? Math.max(c.base.w * 1.8, c.base.w + 2) : c.base.w;
      c.color = on ? S.theme.accent : c.base.color;
      c.a = on ? 1 : (edgeBright(c) ? 1 : 0.08);
    });
    S.ribbons.forEach(function (c) { var on = selE && c.edge >= 0 && selE.has(c.edge); c.a = on ? 1 : (edgeBright(c) ? 1 : 0.08); });
    S.polys.forEach(function (p) { p.a = focus && p.group !== undefined ? 0.5 : 1; });
    return S;
  }
  function restyle(S, sel, hot) {
    var on = !!(sel && sel.size), focus = on ? sel : null, edges = null;
    if (on && hot) { edges = new Set(); S.curves.forEach(function (c) { if (c.edge >= 0 && (c.from === hot || c.to === hot)) edges.add(c.edge); }); S.ribbons.forEach(function (c) { if (c.from === hot || c.to === hot) edges.add(c.edge); }); }
    return style(S, { focus: focus, edges: edges });
  }

  /* ---------------------------------------------------------------- SVG export (same lists) */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toSvg(S, title) {
    var T = S.theme, f = function (n) { return +n.toFixed(2); }, out = [];
    var op = function (o) { return o.a !== undefined && o.a < 1 ? ' opacity="' + f(Math.max(0, o.a)) + '"' : ''; };   /* dimmed things (a < 1) are exported dimmed, like the canvas draws them */
    out.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="' + f(S.x0) + ' ' + f(S.y0) + ' ' + f(S.w) + ' ' + f(S.h) + '" width="' + Math.round(Math.min(S.w, 3000)) + '" height="' + Math.round(Math.min(S.w, 3000) * S.h / S.w) + '" font-family="system-ui, sans-serif">');
    if (title) out.push('<title>' + esc(title) + '</title>');
    out.push('<rect x="' + f(S.x0) + '" y="' + f(S.y0) + '" width="' + f(S.w) + '" height="' + f(S.h) + '" fill="' + css(T.bg) + '"/>');
    S.rects.filter(function (r) { return r.layer === 0; }).forEach(function (r) { out.push(rectSvg(r, css, f, op)); });
    S.polys.forEach(function (p) { var d = 'M'; for (var i = 0; i < p.pts.length; i += 2) d += (i ? 'L' : '') + f(p.pts[i]) + ' ' + f(p.pts[i + 1]); out.push('<path d="' + d + 'Z" fill="' + css(p.fill) + '" stroke="' + css(p.stroke) + '" stroke-width="1.5"' + op(p) + '/>'); });
    var defs = [];
    S.ribbons.forEach(function (r, ri) { var fill = css(r.color); if (r.color2) { defs.push('<linearGradient id="rg' + ri + '" gradientUnits="userSpaceOnUse" x1="' + f(r.x0) + '" y1="0" x2="' + f(r.x1) + '" y2="0"><stop offset="0" stop-color="' + css([r.color[0], r.color[1], r.color[2], 1]) + '"/><stop offset="1" stop-color="' + css([r.color2[0], r.color2[1], r.color2[2], 1]) + '"/></linearGradient>'); fill = 'url(#rg' + ri + ')'; } out.push('<path d="M' + f(r.x0) + ' ' + f(r.y0a) + 'C' + f(r.xm) + ' ' + f(r.y0a) + ' ' + f(r.xm) + ' ' + f(r.y1a) + ' ' + f(r.x1) + ' ' + f(r.y1a) + 'L' + f(r.x1) + ' ' + f(r.y1b) + 'C' + f(r.xm) + ' ' + f(r.y1b) + ' ' + f(r.xm) + ' ' + f(r.y0b) + ' ' + f(r.x0) + ' ' + f(r.y0b) + 'Z" fill="' + fill + '"' + (r.color2 ? ' fill-opacity="' + f(r.color[3]) + '"' : '') + op(r) + '/>'); });
    if (defs.length) out.splice(out.length - S.ribbons.length, 0, '<defs>' + defs.join('') + '</defs>');
    S.curves.forEach(function (c) {
      var d = 'M' + f(c.P[0]) + ' ' + f(c.P[1]);
      for (var i = 2; i < c.P.length; i += 6) d += 'C' + f(c.P[i]) + ' ' + f(c.P[i + 1]) + ' ' + f(c.P[i + 2]) + ' ' + f(c.P[i + 3]) + ' ' + f(c.P[i + 4]) + ' ' + f(c.P[i + 5]);
      out.push('<path d="' + d + '" fill="none" stroke="' + css(c.color) + '" stroke-width="' + f(c.w) + '"' + (c.dash ? ' stroke-dasharray="' + (c.dash === 1 ? '1 ' + f(c.w * 2.2) + '" stroke-linecap="round' : c.dash === 3 ? f(c.w * 6) + ' ' + f(c.w * 3) : f(c.w * 3) + ' ' + f(c.w * 2)) + '"' : '') + op(c) + '/>');
      if (c.arrow) { var tri = arrowTri(c); out.push('<path d="M' + tri.map(f).join(' ').replace(/(\S+ \S+) /g, '$1L') + 'Z" fill="' + css(c.color) + '"' + op(c) + '/>'); }
    });
    S.rects.filter(function (r) { return r.layer === 1; }).forEach(function (r) { out.push(rectSvg(r, css, f, op)); });
    S.dots.forEach(function (d) {
      var k = d.kind === undefined ? 1 : d.kind, attrs = 'fill="' + css(d.fill) + '" stroke="' + css(d.stroke) + '" stroke-width="' + f(d.sw) + '"' + op(d);
      if (k === 1) out.push('<circle cx="' + f(d.cx) + '" cy="' + f(d.cy) + '" r="' + f(d.r) + '" ' + attrs + '/>');
      else if (k === 0) out.push('<rect x="' + f(d.cx - d.r) + '" y="' + f(d.cy - d.r) + '" width="' + f(2 * d.r) + '" height="' + f(2 * d.r) + '" rx="3" ' + attrs + '/>');
      else { var p = shapePts(k, d.cx, d.cy, d.r), dd = 'M'; for (var i = 0; i < p.length; i += 2) dd += (i ? 'L' : '') + f(p[i]) + ' ' + f(p[i + 1]); out.push('<path d="' + dd + 'Z" ' + attrs + ' stroke-linejoin="round"/>'); }
    });
    S.icons.forEach(function (ic) {
      if (ic.img) out.push('<image x="' + f(ic.cx - ic.r) + '" y="' + f(ic.cy - ic.r) + '" width="' + f(2 * ic.r) + '" height="' + f(2 * ic.r) + '" xlink:href="' + esc(ic.img) + '" preserveAspectRatio="xMidYMid meet"' + op(ic) + '/>');
      else if (ICONS[ic.icon]) { var sc = ic.r * 2 / 24; out.push('<path transform="translate(' + f(ic.cx - ic.r) + ' ' + f(ic.cy - ic.r) + ') scale(' + f(sc) + ')" d="' + ICONS[ic.icon] + '" fill="none" stroke="' + css(ic.color) + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' + op(ic) + '/>'); }
      else if (ic.icon) out.push('<text x="' + f(ic.cx) + '" y="' + f(ic.cy + ic.r * 0.35) + '" font-size="' + f(ic.r * 1.2) + '" text-anchor="middle" fill="' + css(ic.color) + '"' + op(ic) + '>' + esc(ic.icon) + '</text>');
    });
    var bgFill = css(alpha(T.bg, 0.82));
    S.labels.forEach(function (l, li) {
      if (li >= 2500) return;   /* the canvas stops at 2,500 labels, in list order: the export keeps the same ones */
      var anchor = l.align === 'l' ? 'start' : l.align === 'r' ? 'end' : 'middle';
      if (l.bg) {   /* the pale backing the canvas puts behind link labels (width estimated the way labelBox does) */
        var tw = l.t.length * l.size * 0.55, bx = l.align === 'l' ? l.x - 2 : l.align === 'r' ? l.x - tw - 2 : l.x - tw / 2 - 2;
        out.push('<rect x="' + f(bx) + '" y="' + f(l.y - l.size) + '" width="' + f(tw + 4) + '" height="' + f(l.size + 3) + '" fill="' + bgFill + '"' + (l.rot ? ' transform="rotate(' + l.rot + ' ' + f(l.x) + ' ' + f(l.y) + ')"' : '') + op(l) + '/>');
      }
      out.push('<text x="' + f(l.x) + '" y="' + f(l.y) + '" font-size="' + f(l.size) + '" text-anchor="' + anchor + '" fill="' + css(l.color) + '"' + (l.bold ? ' font-weight="700"' : '') + (l.rot ? ' transform="rotate(' + l.rot + ' ' + f(l.x) + ' ' + f(l.y) + ')"' : '') + op(l) + '>' + esc(l.t) + '</text>');
    });
    out.push('</svg>');
    return out.join('\n');
  }
  function rectSvg(r, css, f, op) { return '<rect x="' + f(r.x) + '" y="' + f(r.y) + '" width="' + f(r.w) + '" height="' + f(r.h) + '" rx="' + f(Math.min(r.r, r.w / 2, r.h / 2)) + '" fill="' + css(r.fill) + '" stroke="' + (r.sw ? css(r.stroke) : 'none') + '" stroke-width="' + f(r.sw) + '"' + (op ? op(r) : '') + '/>'; }
  /** Arrow triangle for a curve: tip at c.tip (or the curve end), base at the curve end. Returns [x1,y1,x2,y2,x3,y3]. */
  function arrowTri(c) {
    var P = c.P, ex = P[P.length - 2], ey = P[P.length - 1], tip = c.tip || [ex, ey], dx = tip[0] - ex, dy = tip[1] - ey, d = Math.hypot(dx, dy), half = Math.max(4.2, (c.w || 1) * 1.3);
    if (d < 1e-6) { dx = ex - P[P.length - 4]; dy = ey - P[P.length - 3]; d = Math.hypot(dx, dy) || 1; tip = [ex + dx / d * HEAD, ey + dy / d * HEAD]; dx = tip[0] - ex; dy = tip[1] - ey; d = Math.hypot(dx, dy); }
    var nx = -dy / d * half, ny = dx / d * half;
    return [tip[0], tip[1], ex + nx, ey + ny, ex - nx, ey - ny];
  }

  return {
    make: make, rigStyle: rigStyle, pick: pick, hit: hit, pickEdge: pickEdge, pickLabel: pickLabel, inRect: inRect, inLasso: inLasso, restyle: restyle, style: style, toSvg: toSvg, palette: palette, THEMES: THEMES,
    PALETTES: PALETTES, RAMPS: RAMPS, RAMP_NAMES: RAMP_NAMES, rampAt: rampAt, ICONS: ICONS, SHAPE_KIND: SHAPE_KIND, SHAPE_NAMES: SHAPE_NAMES, shapePts: shapePts,
    css: css, hex: hex, toHex: toHex, mix: mix, alpha: alpha, arrowTri: arrowTri, bez: bez, HEAD: HEAD, labelBox: labelBox
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMScene;

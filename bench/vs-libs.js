/* Copyright (c) 2026 LFC Foundry. MIT License.
 * Netflow Map against the open-source JavaScript libraries people reach for first (d3-force, d3-sankey, ForceAtlas2, Cytoscape.js,
 * dagre, ELK, graphology, Papa Parse, d3-dsv), the numbers behind the landing page charts. Runs inside bench/page.html.
 * Every suite is  SUITES.vs*(args) -> plain object. Times are milliseconds: the median of 3 runs, or one run when the first is over 600 ms.
 * Runner: node bench/vs-libs-run.js <firefox|chromium|webkit> [plan]  (one browser at a time). */
(function () {
  'use strict';
  var E = NFMEngine, C = NFMColumns, I = NFMImport, GEN = NFMGen;
  var now = function () { return performance.now(); }, r1 = function (v) { return Math.round(v * 10) / 10; };
  var med = function (a) { return a.slice().sort(function (x, y) { return x - y; })[a.length >> 1]; };
  function T(fn) { var ts = [], v, t0, i; for (i = 0; i < 3; i++) { t0 = now(); v = fn(); ts.push(now() - t0); if (ts[0] > 600) break; } return { ms: r1(med(ts)), value: v }; }
  async function TA(fn) { var ts = [], v, t0, i; for (i = 0; i < 3; i++) { t0 = now(); v = await fn(); ts.push(now() - t0); if (ts[0] > 600) break; } return { ms: r1(med(ts)), value: v }; }
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  /* ---- items touching: every layout drawn with OUR item sizes; a point layout is first scaled so its median link is as long as ours (the kindest fair scale; same as bench/overlap.js) ---- */
  function overlaps(ids, pos, rad) {
    var n = ids.length, rmax = 0, i; for (i = 0; i < n; i++) rmax = Math.max(rmax, rad[ids[i]]);
    var cell = 2 * rmax || 1, grid = new Map(), key = function (cx, cy) { return cx * 73856093 ^ cy * 19349663; }, hit = new Uint8Array(n), pairs = 0;
    for (i = 0; i < n; i++) { var p = pos[ids[i]], k = key(Math.floor(p[0] / cell), Math.floor(p[1] / cell)); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
    for (i = 0; i < n; i++) {
      var a = pos[ids[i]], cx = Math.floor(a[0] / cell), cy = Math.floor(a[1] / cell);
      for (var gx = -1; gx <= 1; gx++) for (var gy = -1; gy <= 1; gy++) { var l = grid.get(key(cx + gx, cy + gy)); if (!l) continue; for (var q = 0; q < l.length; q++) { var j = l[q]; if (j <= i) continue; var b = pos[ids[j]]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < rad[ids[i]] + rad[ids[j]]) { pairs++; hit[i] = hit[j] = 1; } } }
    }
    var items = 0; for (i = 0; i < n; i++) items += hit[i];
    return { pairs: pairs, pct: Math.round(1000 * items / n) / 10 };
  }
  function rescale(ids, edges, pos, target) {
    var len = []; edges.forEach(function (e) { var a = pos[e.from], b = pos[e.to]; if (e.from !== e.to && a && b) len.push(Math.hypot(a[0] - b[0], a[1] - b[1])); });
    var f = target / (med(len) || 1), out = {}; ids.forEach(function (id) { out[id] = [pos[id][0] * f, pos[id][1] * f]; }); return out;
  }
  function linkMedian(edges, pos) { var len = []; edges.forEach(function (e) { var a = pos[e.from], b = pos[e.to]; if (e.from !== e.to && a && b) len.push(Math.hypot(a[0] - b[0], a[1] - b[1])); }); return med(len); }

  var SUITES = window.SUITES || (window.SUITES = {});

  /* ================= network layout: ours (the app's default arrangement) vs d3-force, d3-force + forceCollide, ForceAtlas2, Cytoscape.js cose ================= */
  SUITES.vsNet = function (a) {   // a: { n, libs: ['d3','d3c','fa2','cose'] }
    var g = GEN.graph(a.kind || 'moderate', a.n, 11), ids = g.nodes.map(function (x) { return x.id; }), out = { n: a.n, links: g.edges.length }, rad = {}, ourPos = {};
    var want = a.libs || ['d3', 'd3c', 'fa2', 'cose'];
    var dg = C.derive(clone(g)), r = T(function () { return E.build(dg, { view: 'network', colorBy: 'group' }); });   /* the map as the app holds it after reading (build does not change it); only the drawing is timed */
    r.value.nodes.forEach(function (nd) { var id = nd.nodeId || nd.id; ourPos[id] = [nd.cx, nd.cy]; rad[id] = nd.w / 2; });
    var target = linkMedian(g.edges, ourPos);
    out.ours = { ms: r.ms, touch: overlaps(ids, ourPos, rad) };
    var lib = function (name, fn) {
      var res = T(fn), pos = res.value; ids.forEach(function (id) { if (!pos[id]) pos[id] = [0, 0]; });
      out[name] = { ms: res.ms, touch: overlaps(ids, rescale(ids, g.edges, pos, target), rad) };
    };
    var d3 = LIBS.d3force;
    var d3run = function (collide) {
      var nodes = ids.map(function (id) { return { id: id }; }), links = g.edges.map(function (e) { return { source: e.from, target: e.to }; });
      var sim = d3.forceSimulation(nodes).force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(collide ? 130 : 30)).force('charge', d3.forceManyBody().strength(collide ? -300 : -30)).force('center', d3.forceCenter(0, 0));
      if (collide) sim.force('collide', d3.forceCollide(function (d) { return rad[d.id]; }));
      sim.stop(); var ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())); for (var i = 0; i < ticks; i++) sim.tick();
      var pos = {}; nodes.forEach(function (q) { pos[q.id] = [q.x, q.y]; }); return pos;
    };
    if (want.indexOf('d3') >= 0) lib('d3force', function () { return d3run(false); });
    if (want.indexOf('d3c') >= 0) lib('d3collide', function () { return d3run(true); });
    if (want.indexOf('fa2') >= 0) lib('forceatlas2', function () {
      var gr = new LIBS.Graph({ type: 'undirected' }); ids.forEach(function (id, i) { gr.addNode(id, { x: Math.cos(i) * 10 + Math.random(), y: Math.sin(i) * 10 + Math.random() }); });
      g.edges.forEach(function (e) { if (e.from !== e.to && !gr.hasEdge(e.from, e.to)) gr.addEdge(e.from, e.to); });
      LIBS.fa2.assign(gr, { iterations: 300, settings: Object.assign(LIBS.fa2.inferSettings(gr), { barnesHutOptimize: a.n > 500 }) });
      var pos = {}; gr.forEachNode(function (id, at) { pos[id] = [at.x, at.y]; }); return pos;
    });
    if (want.indexOf('cose') >= 0) lib('cytoscape', function () {
      var seen = new Set(), els = ids.map(function (id) { return { data: { id: id } }; });
      g.edges.forEach(function (e, i) { var k = e.from + '>' + e.to; if (e.from !== e.to && !seen.has(k)) { seen.add(k); els.push({ data: { id: 'e' + i, source: e.from, target: e.to } }); } });
      var cy = LIBS.cytoscape({ headless: true, elements: els }); cy.layout({ name: 'cose', animate: false, randomize: true, boundingBox: { x1: 0, y1: 0, w: 1000, h: 1000 } }).run();
      var pos = {}; cy.nodes().forEach(function (nd) { var p = nd.position(); pos[nd.id()] = [p.x, p.y]; }); cy.destroy(); return pos;
    });
    return out;
  };

  /* ================= layered (Flow view) vs dagre and ELK; Sankey view vs d3-sankey. Same random acyclic data; crossings counted the same way for all: straight lines between item centers ================= */
  function dag(n, m, seed) { var r = GEN.rng(seed), layers = Math.max(4, Math.round(Math.sqrt(n) * 0.8)), per = Math.ceil(n / layers), nodes = [], edges = [], Lr = function (i) { return Math.floor(i / per); }, i;
    for (i = 0; i < n; i++) nodes.push({ id: 'n' + i, label: 'Item ' + i, group: 'g' + (Lr(i) % 5), attrs: {} });
    var seen = new Set(), guard = 0;
    for (i = 1; i < n; i++) { var lo = Math.max(0, (Lr(i) - 1) * per), hi = Lr(i) * per - 1; if (hi < lo) continue; var a = lo + Math.floor(r() * (hi - lo + 1)); seen.add(a + '>' + i); edges.push({ from: 'n' + a, to: 'n' + i, weight: 1 + Math.floor(r() * 5), attrs: {} }); }
    while (edges.length < m && guard++ < m * 20) { var a2 = Math.floor(r() * n), la = Lr(a2), b = r() < 0.03 ? Math.floor(r() * n) : Math.min(n - 1, (la + 1 + Math.floor(r() * 2)) * per + Math.floor(r() * per)); if (a2 === b || seen.has(a2 + '>' + b)) continue; seen.add(a2 + '>' + b); edges.push({ from: 'n' + Math.min(a2, b), to: 'n' + Math.max(a2, b), weight: 1 + Math.floor(r() * 5), attrs: {} }); }
    return { name: 'dag' + n, start: 'n0', nodes: nodes, edges: edges }; }
  function crossings(pos, edges) {
    var seg = [], c = 0, i, j; edges.forEach(function (e) { var a = pos[e.from], b = pos[e.to]; if (a && b && e.from !== e.to) seg.push([a, b, e.from, e.to]); });
    var ccw = function (a, b, p) { return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); };
    for (i = 0; i < seg.length; i++) for (j = i + 1; j < seg.length; j++) { var s = seg[i], t = seg[j]; if (s[2] === t[2] || s[2] === t[3] || s[3] === t[2] || s[3] === t[3]) continue; if (ccw(s[0], s[1], t[0]) * ccw(s[0], s[1], t[1]) < 0 && ccw(t[0], t[1], s[0]) * ccw(t[0], t[1], s[1]) < 0) c++; }
    return c;
  }
  /* crossings of what is drawn: each link as its polyline (through its bends or stand-in stops), every pair of segments of two links that share no item */
  function polyCross(polys) {   // polys: [[from, to, [[x,y],...]], ...]
    var S = [], c = 0, i, j;
    polys.forEach(function (p) { var pts = p[2]; for (var k = 0; k + 1 < pts.length; k++) S.push([pts[k], pts[k + 1], p[0], p[1]]); });
    var ccw = function (a, b, q) { return (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]); };
    for (i = 0; i < S.length; i++) { var s = S[i], x0 = Math.min(s[0][0], s[1][0]), x1 = Math.max(s[0][0], s[1][0]);
      for (j = i + 1; j < S.length; j++) { var t = S[j]; if (s[2] === t[2] || s[2] === t[3] || s[3] === t[2] || s[3] === t[3]) continue; if (Math.max(t[0][0], t[1][0]) < x0 || Math.min(t[0][0], t[1][0]) > x1) continue;
        if (ccw(s[0], s[1], t[0]) * ccw(s[0], s[1], t[1]) < 0 && ccw(t[0], t[1], s[0]) * ccw(t[0], t[1], s[1]) < 0) c++; } }
    return c;
  }
  function oursPolys(L) { var cp = {}; L.nodes.forEach(function (nd) { cp[nd.id] = [nd.x + nd.w / 2, nd.y + nd.h / 2]; }); var out = []; L.edges.forEach(function (e) { if (e.from === e.to || !cp[e.from] || !cp[e.to]) return; out.push([e.from, e.to, [cp[e.from]].concat(e.pts || [], [cp[e.to]])]); }); return out; }
  var centers = function (L) { var pos = {}; L.nodes.forEach(function (nd) { pos[nd.nodeId || nd.id] = [nd.x + nd.w / 2, nd.y + nd.h / 2]; }); return pos; };
  SUITES.vsFlow = async function (a) {   // a: { n, m, dagre, elk }
    var g = dag(a.n, a.m, a.n), out = { n: a.n, links: g.edges.length };
    var dg = C.derive(clone(g)), r = T(function () { return E.build(dg, Object.assign({ view: 'flow', colorBy: 'group', rows: 'best' }, a.opt || {})); });   /* rows 'best' is what the app sends by default (V.rows); without it the 1,000-item map drew 24,185 crossings instead of 21,812 */
    out.ours = { ms: r.ms, cross: crossings(centers(r.value), g.edges), drawn: polyCross(oursPolys(r.value)) };
    if (a.dagre !== false) { var dpol = []; var r2 = T(function () { var gr = new LIBS.dagre.graphlib.Graph(); gr.setGraph({ rankdir: 'LR', nodesep: 14, ranksep: 90 }); gr.setDefaultEdgeLabel(function () { return {}; }); g.nodes.forEach(function (x) { gr.setNode(x.id, { width: 176, height: 56 }); }); g.edges.forEach(function (e) { gr.setEdge(e.from, e.to); }); LIBS.dagre.layout(gr); var p = {}; gr.nodes().forEach(function (id) { var q = gr.node(id); p[id] = [q.x, q.y]; }); dpol = gr.edges().map(function (ed) { return [ed.v, ed.w, [p[ed.v]].concat(gr.edge(ed).points.map(function (q) { return [q.x, q.y]; }), [p[ed.w]])]; }); return p; });
      out.dagre = { ms: r2.ms, cross: crossings(r2.value, g.edges), drawn: polyCross(dpol) }; }
    if (a.elk !== false) { var elk = new LIBS.ELK(), epol = []; var r3 = await TA(async function () { var rs = await elk.layout({ id: 'root', layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.spacing.nodeNode': '14', 'elk.layered.spacing.nodeNodeBetweenLayers': '90' }, children: g.nodes.map(function (x) { return { id: x.id, width: 176, height: 56 }; }), edges: g.edges.map(function (e, i) { return { id: 'e' + i, sources: [e.from], targets: [e.to] }; }) }); var p = {}; rs.children.forEach(function (q) { p[q.id] = [q.x + 88, q.y + 28]; }); epol = (rs.edges || []).map(function (ed) { var sc = (ed.sections || [])[0], pts = sc ? [[sc.startPoint.x, sc.startPoint.y]].concat((sc.bendPoints || []).map(function (q) { return [q.x, q.y]; }), [[sc.endPoint.x, sc.endPoint.y]]) : []; return [ed.sources[0], ed.targets[0], [p[ed.sources[0]]].concat(pts, [p[ed.targets[0]]])]; }); return p; });
      out.elk = { ms: r3.ms, cross: crossings(r3.value, g.edges), drawn: polyCross(epol) }; }
    return out;
  };
  /* repT: a.reps > 1 runs it once to warm up, then a.reps times, and keeps the median time (the value is the last run's) */
  function repT(reps, fn) { if (!(reps > 1)) return T(fn); fn(); var ms = [], v; for (var q = 0; q < reps; q++) { var x = T(fn); ms.push(x.ms); v = x.value; } return { ms: med(ms), value: v }; }
  /* picHash: positions of every item and every link point, rounded to 0.01, so "same picture" can be checked */
  function picHash(L) { var h = 2166136261, add = function (v) { v = Math.round(v * 100); h = Math.imul(h ^ (v | 0), 16777619) >>> 0; }; L.nodes.forEach(function (n) { add(n.x); add(n.y); add(n.w); add(n.h); }); L.edges.forEach(function (e) { (e.pts || []).forEach(function (p) { add(p[0] !== undefined ? p[0] : p.x); add(p[1] !== undefined ? p[1] : p.y); }); add(e.width || 0); }); return h.toString(16); }
  SUITES.vsFlowX = function (a) {   // experiments: a.opt goes to the engine build; inner = the module's own count (with stand-in stops)
    var g = dag(a.n, a.m, a.n), out = { n: a.n };
    var dg = C.derive(clone(g)), fopt = Object.assign({ view: 'flow', colorBy: 'group' }, a.opt || {}), r = repT(a.reps, function () { return E.build(dg, fopt); });
    out.ours = { ms: r.ms, cross: crossings(centers(r.value), g.edges), inner: r.value.crossings, drawn: polyCross(oursPolys(r.value)), hash: picHash(r.value) };
    return out;
  };
  SUITES.vsSankey = function (a) {   // a: { n, m }
    var g = dag(a.n, a.m, a.n + 1), idx0 = 0;
    /* a Sankey draws what flows from the start item: every item of the first column gets a link from it, so everything can be reached (the same data goes to d3-sankey) */
    var per0 = Math.ceil(a.n / Math.max(4, Math.round(Math.sqrt(a.n) * 0.8))); for (idx0 = 1; idx0 < per0; idx0++) g.edges.push({ from: 'n0', to: 'n' + idx0, weight: 3, attrs: {} });
    var out = { n: a.n, links: g.edges.length }, idx = new Map(); g.nodes.forEach(function (nd, q) { idx.set(nd.id, q); });
    var sopt = Object.assign({ view: 'sankey', colorBy: 'group', sk: {} }, a.opt || {}), dg = C.derive(clone(g)), r = repT(a.reps, function () { return E.build(dg, sopt); });
    if (a.oursOnly) return { ms: r.ms };
    if (a.over === false) {   /* geometry for pictures (bench only): ours and d3-sankey's, rounded */
      var R1 = function (v) { return Math.round(v * 10) / 10; };
      var d3o = LIBS.d3sankey.sankey().nodeWidth(15).nodePadding(8).extent([[0, 0], [1000, Math.max(500, a.n * 4)]])({ nodes: g.nodes.map(function (nd) { return { name: nd.id }; }), links: g.edges.map(function (e) { return { source: idx.get(e.from), target: idx.get(e.to), value: e.weight }; }) });
      window.__lastSk = { W: r.value.width, H: r.value.height, bars: r.value.nodes.map(function (n) { return [R1(n.x), R1(n.y), R1(n.w), R1(n.h)]; }), bands: r.value.sk.bands.map(function (b) { return [R1(b.x0), R1(b.y0a), R1(b.y0b), R1(b.x1), R1(b.y1a), R1(b.y1b)]; }),
        d3: { W: 1000, H: Math.max(500, a.n * 4), bars: d3o.nodes.map(function (n) { return [R1(n.x0), R1(n.y0), R1(n.x1 - n.x0), R1(n.y1 - n.y0)]; }), links: d3o.links.map(function (k) { return [R1(k.source.x1), R1(k.y0 - k.width / 2), R1(k.y0 + k.width / 2), R1(k.target.x0), R1(k.y1 - k.width / 2), R1(k.y1 + k.width / 2)]; }) } };
      return { ms: r.ms };
    }
    var cp = centers(r.value), bad = 0; Object.keys(cp).forEach(function (k) { if (!isFinite(cp[k][0]) || !isFinite(cp[k][1])) bad++; });
    /* links drawn over bars: a band whose straight path passes a bar it does not belong to (its middle line at the bar's x is inside the bar) */
    var overBars = function (bars, links) { var hit = 0; bars.sort(function (p, q) { return p.x0 - q.x0; }); links.forEach(function (k) { if (k.x1 - k.x0 < 1) return; bars.forEach(function (b) { if (b.x0 <= k.x0 + 1 || b.x1 >= k.x1 - 1 || b.id === k.s || b.id === k.t) return; var xm = (b.x0 + b.x1) / 2, f = (xm - k.x0) / (k.x1 - k.x0), y = k.y0 + f * (k.y1 - k.y0); if (y > b.y0 && y < b.y1) hit++; }); }); return hit; };
    var obOurs = r.value.sk ? overBars(r.value.nodes.map(function (n) { return { id: n.id, x0: n.x, x1: n.x + n.w, y0: n.y, y1: n.y + n.h }; }), r.value.sk.bands.map(function (b) { return { s: b.from, t: b.to, x0: b.x0, y0: (b.y0a + b.y0b) / 2, x1: b.x1, y1: (b.y1a + b.y1b) / 2 }; })) : null;   /* each band piece as drawn: a piece between two neighboring columns cannot pass another bar; a long link drawn straight can */
    out.ours = { ms: r.ms, cross: crossings(cp, g.edges), placed: Object.keys(cp).length, notFinite: bad, columns: new Set(Object.keys(cp).map(function (k) { return Math.round(cp[k][0]); })).size, netflowSankey: !!window.NetflowSankey, hash: picHash(r.value), overBars: obOurs, straightBands: r.value.sk ? r.value.sk.bands.filter(function (b) { return b.x1 - b.x0 > 300; }).length : null };
    try {
      var r2 = T(function () { var nodes = g.nodes.map(function (nd) { return { name: nd.id }; }), links = g.edges.map(function (e) { return { source: idx.get(e.from), target: idx.get(e.to), value: e.weight }; });
        var o = LIBS.d3sankey.sankey().nodeWidth(15).nodePadding(8).extent([[0, 0], [1000, Math.max(500, a.n * 4)]])({ nodes: nodes, links: links }); var p = {}; o.nodes.forEach(function (nd) { p[nd.name] = [(nd.x0 + nd.x1) / 2, (nd.y0 + nd.y1) / 2]; }); window.__d3sk = o; return p; });
      var o3 = window.__d3sk; window.__d3sk = null;
      out.d3sankey = { ms: r2.ms, cross: crossings(r2.value, g.edges), overBars: a.over === false ? null : overBars(o3.nodes.map(function (nd) { return { id: nd.name, x0: nd.x0, x1: nd.x1, y0: nd.y0, y1: nd.y1 }; }), o3.links.map(function (k) { return { s: k.source.name, t: k.target.name, x0: k.source.x1, y0: k.y0, x1: k.target.x0, y1: k.y1 }; })) };
    } catch (e) { out.d3sankey = { error: String(e && e.message || e).slice(0, 80) }; }
    return out;
  };

  /* ================= reading a table: ours vs Papa Parse vs d3-dsv (the 16 MB table the app's big-map tests use) ================= */
  SUITES.vsCsv = function (a) {   // a: { n }
    var c = GEN.csv('moderate', a.n, 3), text = c.text, out = { rows: c.rows, MB: r1(text.length / 1048576) }, names = ['ours', 'papa', 'd3'], V = { ours: function () { return I.parseDelimited(text, ','); }, papa: function () { return LIBS.Papa.parse(text, { delimiter: ',' }).data; }, d3: function () { return LIBS.d3dsv.csvParseRows(text); } }, ts = { ours: [], papa: [], d3: [] }, q, k, t0;
    for (q = 0; q < 5; q++) for (k = 0; k < 3; k++) { var nm = names[(k + q) % 3]; t0 = now(); var v = V[nm](); ts[nm].push(now() - t0); v = null; }   // turns taken in rotation; the first round is a warm-up
    names.forEach(function (nm) { out[nm] = r1(med(ts[nm].slice(1))); });
    return out;
  };

  /* ================= memory to hold a network (Chromium: the runner reads the JS heap over the DevTools protocol, after two full collections, around vsMemHold) ================= */
  SUITES.vsMemPrep = function (a) { window.__t = JSON.stringify(GEN.graph('moderate', a.n, 11)); JSON.parse(window.__t); return { n: a.n }; };   /* the text stays alive on both sides of the count; one parse thrown away first */
  SUITES.vsMemHold = function (a) {   // a: { what: 'ours' | 'graphology' | 'cytoscape' }; keeps what each one holds for the network, drops the plain list
    var g = JSON.parse(window.__t), k = null, links = g.edges.length;
    if (a.what === 'ours') k = C.derive(g);   /* the app keeps the graph this way (S.graph) */
    if (a.what === 'graphology') { k = new LIBS.Graph(); g.nodes.forEach(function (x) { k.addNode(x.id, { label: x.label, group: x.group }); }); g.edges.forEach(function (e) { if (e.from !== e.to && !k.hasEdge(e.from, e.to)) k.addEdge(e.from, e.to, { weight: e.weight }); }); }
    if (a.what === 'cytoscape') { var seen = new Set(), els = g.nodes.map(function (x) { return { data: { id: x.id, label: x.label, group: x.group } }; }); g.edges.forEach(function (e, i) { var q = e.from + '>' + e.to; if (e.from !== e.to && !seen.has(q)) { seen.add(q); els.push({ data: { id: 'e' + i, source: e.from, target: e.to, weight: e.weight } }); } }); k = LIBS.cytoscape({ headless: true, elements: els }); }
    window.__k = k; return { links: links };
  };
})();

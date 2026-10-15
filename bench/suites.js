/* Copyright (c) 2026 LFC Foundry. MIT License. The benchmark suites. They run inside a page (Firefox or Chromium) next to our modules and LIBS.
 * Every suite is  SUITES.name(args) -> plain object.  Times are milliseconds; "ms" is the median of up to 3 runs (one run when it is slow). */
var SUITES = (function () {
  'use strict';
  var now = function () { return performance.now(); };
  var E = NFMEngine, C = NFMColumns, I = NFMImport, K = NFMCheck, S = NFMSim, G = NFMGif, GEN = NFMGen, X = NFMExamples;
  var med = function (a) { return a.slice().sort(function (x, y) { return x - y; })[a.length >> 1]; };
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  /** Time fn: first run, then two more only when the first was under `fast` ms. Returns { ms, first, value }. */
  function T(fn, fast) {
    var ts = [], v, t0, i; fast = fast === undefined ? 600 : fast;
    for (i = 0; i < 3; i++) { t0 = now(); v = fn(); ts.push(now() - t0); if (ts[0] > fast) break; }
    return { ms: r1(med(ts)), first: r1(ts[0]), value: v };
  }
  var heap = function () { return performance.memory ? performance.memory.usedJSHeapSize : null; };
  var mb = function (b) { return b === null ? null : Math.round(b / 1048576 * 10) / 10; };

  /* ---- shared measuring tools ---- */
  function hopStats(ids, edges, pos, comm) {   // sampled stress (lower = truer) and cluster separation
    var idx = new Map(ids.map(function (id, i) { return [id, i]; })), n = ids.length, adj = ids.map(function () { return []; }), i, k;
    edges.forEach(function (e) { var a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { adj[a].push(b); adj[b].push(a); } });
    var ns = Math.min(60, n), srcs = []; for (i = 0; i < ns; i++) srcs.push(Math.floor(i * n / ns));
    var pairs = [], num = 0, den = 0, s, t;
    srcs.forEach(function (src) {
      var d = new Int32Array(n).fill(-1), q = [src]; d[src] = 0;
      for (var h = 0; h < q.length; h++) { var u = q[h]; for (k = 0; k < adj[u].length; k++) { var w = adj[u][k]; if (d[w] < 0) { d[w] = d[u] + 1; q.push(w); } } }
      for (t = 0; t < n; t += (n > 3000 ? 7 : 1)) if (t !== src && d[t] > 0) { var p = pos[ids[src]], r = pos[ids[t]]; if (!p || !r) continue; var e = Math.hypot(p[0] - r[0], p[1] - r[1]); pairs.push([d[t], e]); num += e / d[t]; den += e * e / (d[t] * d[t]); }
    });
    var sc = num / den, st = 0; pairs.forEach(function (pr) { st += Math.pow(pr[0] - sc * pr[1], 2) / (pr[0] * pr[0]); });
    var out = { stress: Math.round(st / pairs.length * 1000) / 1000 };
    if (comm) { var intra = 0, ni = 0, inter = 0, nx = 0; srcs.forEach(function (src) { for (var t2 = 0; t2 < n; t2 += 3) if (t2 !== src) { var p2 = pos[ids[src]], r2 = pos[ids[t2]]; if (!p2 || !r2) continue; var e2 = Math.hypot(p2[0] - r2[0], p2[1] - r2[1]); if (comm(ids[src]) === comm(ids[t2])) { intra += e2; ni++; } else { inter += e2; nx++; } } }); out.sep = Math.round(inter / nx / (intra / ni) * 100) / 100; }
    return out;
  }
  function layoutPos(L) { var pos = {}; L.nodes.forEach(function (nd) { pos[nd.nodeId || nd.id] = [nd.cx, nd.cy]; }); return pos; }
  var netGraph = function (kind, n) { if (kind === 'planted') return X.bigNetwork(n, Math.max(6, Math.round(Math.sqrt(n) / 4)), 7); return GEN.graph(kind, n, 11); };

  var SUITES = {};

  /* ================= CSV: ours vs PapaParse vs d3-dsv ================= */
  SUITES.csvGrid = function (a) {   // a: { rows, cols, quoted (0..1), len (chars per field), multiline (0..1), delim, only: [names] }
    var r = GEN.rng(5), parts = [], R = a.rows, Cc = a.cols, d = a.delim || ',', i, j, hdr = [];
    for (j = 0; j < Cc; j++) hdr.push('c' + j); parts.push(hdr.join(d));
    var word = 'abcdefghijklmnopqrstuvwxyz'; var field = function (q, ml) { var s = ''; for (var k = 0; k < a.len; k++) s += word[(k * 7 + Math.floor(r() * 26)) % 26]; if (q) { s = s.slice(0, Math.max(1, a.len >> 1)) + d + ' "x" ' + s.slice(a.len >> 1); if (ml) s += '\nmore'; return '"' + s.replace(/"/g, '""') + '"'; } return s; };
    for (i = 0; i < R; i++) { var row = []; for (j = 0; j < Cc; j++) row.push(j === 0 ? 'n' + i : (r() < a.quoted ? field(true, r() < a.multiline) : (j % 3 === 1 ? String(Math.round(r() * 1e4) / 100) : field(false)))); parts.push(row.join(d)); }
    var text = parts.join('\n'), out = { bytes: text.length, rows: R, cols: Cc }, want = a.only || ['ours', 'papa', 'd3'], res;
    var dsv = LIBS.d3dsv.dsvFormat(d), fns = { ours: function () { return I.parseDelimited(text, d); }, papa: function () { return LIBS.Papa.parse(text, { delimiter: d }).data; }, d3: function () { return dsv.parseRows(text); } };
    var reps = a.rows > 300000 ? 3 : 7, ts = { ours: [], papa: [], d3: [] }, rr, nm, t0, val;
    for (rr = 0; rr < reps; rr++) want.forEach(function (nm) { t0 = now(); val = fns[nm](); ts[nm].push(now() - t0); if (rr === 0) { if (nm === 'ours') out.n = val.length; if (nm === 'papa') out.nPapa = val.length; } val = null; });
    want.forEach(function (nm) { out[nm] = r1(med(ts[nm])); out[nm + 'Min'] = r1(Math.min.apply(null, ts[nm])); });
    if (a.check) { var A = I.parseDelimited(text, d), B = LIBS.Papa.parse(text, { delimiter: d }).data; var ok = A.length === B.length || (A.length === B.length + 1); var diff = 0; for (i = 0; i < Math.min(A.length, B.length); i++) { if (A[i].join('\u0001') !== B[i].join('\u0001')) { diff++; if (diff > 3) break; } } out.sameAsPapa = diff === 0; out.rowsOursVsPapa = A.length + '/' + B.length; }
    return out;
  };

  /* Ways to cut a quote-free table into rows, for Firefox (a: { rows, cols, len }). Median of 9 runs each. */
  SUITES.csvvar = function (a) {
    var r = GEN.rng(5), parts = [], R = a.rows, Cc = a.cols, d = ',', i, j, hdr = [], word = 'abcdefghijklmnopqrstuvwxyz';
    for (j = 0; j < Cc; j++) hdr.push('c' + j); parts.push(hdr.join(d));
    for (i = 0; i < R; i++) { var row = []; for (j = 0; j < Cc; j++) { var s = ''; if (j === 0) s = 'n' + i; else if (j % 3 === 1) s = String(Math.round(r() * 1e4) / 100); else for (var k = 0; k < a.len; k++) s += word[(k * 7 + Math.floor(r() * 26)) % 26]; row.push(s); } parts.push(row.join(d)); }
    var text = parts.join('\n'), out = { bytes: text.length };
    var V = {
      current: function () { return I.parseDelimited(text, d); },
      linesFirst: function () { var L = text.split('\n'), rows = new Array(L.length), n = 0; for (var q = 0; q < L.length; q++) { var ln = L[q]; if (ln.length === 0) continue; rows[n++] = ln.split(d); } rows.length = n; return rows; },
      sliceSplit: function () { var rows = [], pos = 0, n = text.length; while (pos < n) { var nl = text.indexOf('\n', pos), end = nl < 0 ? n : nl; rows.push(text.slice(pos, end).split(d)); pos = end + 1; } return rows; },
      linesOnly: function () { return text.split('\n'); },
      flat: function () { return text.split(/,|\n/); },
      flatStr: function () { return text.replace(/\n/g, ',').split(','); },
      regexRows: function () { var rows = [], re = /([^\n]*)\n|([^\n]+)$/g, m; while ((m = re.exec(text)) !== null) { rows.push((m[1] !== undefined ? m[1] : m[2]).split(d)); } return rows; }
    };
    var names = a.only || Object.keys(V), T9 = {}, v, t0, q, m; names.forEach(function (k) { T9[k] = []; });
    for (q = 0; q < (a.rounds || 11); q++) for (m = 0; m < names.length; m++) { var k = names[(m + q) % names.length]; t0 = now(); v = V[k](); T9[k].push(now() - t0); v = null; }
    names.forEach(function (k) { out[k] = r1(med(T9[k].slice(a.rounds ? 0 : 2))); out[k + 'First'] = r1(T9[k][0]); out[k + 'Min'] = r1(Math.min.apply(null, T9[k])); });
    return out;
  };
  SUITES.csvKind = function (a) {   // the three structures through the three parsers (a: { kind, n, only })
    var c = GEN.csv(a.kind, a.n, 21); if (c.error) return { error: c.error, rows: c.rows };
    var text = c.text, out = { kind: a.kind, rows: c.rows, MB: Math.round(c.bytes / 1048576 * 10) / 10 }, want = a.only || ['ours', 'papa', 'd3', 'import'], r;
    if (want.indexOf('ours') >= 0) out.ours = T(function () { return I.parseDelimited(text, ','); }, 1500).ms;
    if (want.indexOf('papa') >= 0) out.papa = T(function () { return LIBS.Papa.parse(text, { delimiter: ',' }).data; }, 1500).ms;
    if (want.indexOf('d3') >= 0) out.d3 = T(function () { return LIBS.d3dsv.csvParseRows(text); }, 1500).ms;
    if (want.indexOf('import') >= 0) { r = T(function () { return I.importAny(text, { name: 'x.csv', maxNodes: 1e7, maxEdges: 5e7 }); }, 1500); out.import = r.ms; out.items = r.value.graph.nodes.length; }
    return out;
  };

  /** Pairs of items whose discs touch (grid of cells as wide as the largest disc). The same count as bench/overlap.js. */
  function touching(L) {
    var nodes = L.nodes, rmax = 0, grid = {}, i, pairs = 0;
    for (i = 0; i < nodes.length; i++) if (nodes[i].w / 2 > rmax) rmax = nodes[i].w / 2;
    var cell = 2 * rmax || 1;
    for (i = 0; i < nodes.length; i++) { var k = Math.floor(nodes[i].cx / cell) + ',' + Math.floor(nodes[i].cy / cell); (grid[k] || (grid[k] = [])).push(i); }
    for (i = 0; i < nodes.length; i++) {
      var a = nodes[i], cx = Math.floor(a.cx / cell), cy = Math.floor(a.cy / cell);
      for (var gx = -1; gx <= 1; gx++) for (var gy = -1; gy <= 1; gy++) { var l = grid[(cx + gx) + ',' + (cy + gy)]; if (!l) continue; for (var q = 0; q < l.length; q++) { var j = l[q]; if (j > i) { var b = nodes[j]; if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.w / 2 + b.w / 2) pairs++; } } }
    }
    return pairs;
  }

  /* ================= network layouts: ours (stress, force) vs d3-force vs ForceAtlas2 ================= */
  SUITES.network = function (a) {   // a: { kind, n, libs: bool, arranges: [...] }
    var g = netGraph(a.kind, a.n), dg = C.derive(g), out = { n: a.n, m: g.edges.length, kind: a.kind }, per = Math.max(1, Math.ceil(a.n / (a.kind === 'planted' ? Math.max(6, Math.round(Math.sqrt(a.n) / 4)) : 12)));
    var ids = g.nodes.map(function (x) { return x.id; }), comm = function (id) { return Math.floor(parseInt(String(id).replace(/\D/g, ''), 10) / per); };
    (a.arranges || ['stress', 'force']).forEach(function (arr) {
      var res = T(function () { return E.build(dg, { view: 'network', arrange: arr, colorBy: 'group' }); }, a.fast);
      var st = hopStats(ids, g.edges.map(function (e) { return { from: e.from, to: e.to }; }), res.value.nodes && layoutPos(res.value), comm);
      var posIds = res.value.nodes.map(function (nd) { return nd.nodeId || nd.id; });
      out['ours_' + arr] = { ms: res.ms, stress: st.stress, sep: st.sep, touch: touching(res.value) };
    });
    if (a.before !== false && typeof NFMEngineBefore !== 'undefined') {   // the engine as committed before the typed-array stress rewrite
      var rb = T(function () { return NFMEngineBefore.build(C.derive(g), { view: 'network', arrange: 'stress', colorBy: 'group' }); }, a.fast);
      var stb = hopStats(ids, g.edges.map(function (e) { return { from: e.from, to: e.to }; }), layoutPos(rb.value), comm);
      out.before_stress = { ms: rb.ms, stress: stb.stress, sep: stb.sep };
    }
    if (a.libs !== false) {
      var d3 = LIBS.d3force, res2 = T(function () { var nodes = ids.map(function (id) { return { id: id }; }), links = g.edges.map(function (e) { return { source: e.from, target: e.to }; }); var sim = d3.forceSimulation(nodes).force('link', d3.forceLink(links).id(function (d) { return d.id; }).distance(30)).force('charge', d3.forceManyBody().strength(-30)).force('center', d3.forceCenter(0, 0)).stop(); var ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())); for (var i = 0; i < ticks; i++) sim.tick(); return nodes; }, a.fast);
      var pos = {}; res2.value.forEach(function (q) { pos[q.id] = [q.x, q.y]; }); var st2 = hopStats(ids, g.edges, pos, comm); out.d3force = { ms: res2.ms, stress: st2.stress, sep: st2.sep };
      if (a.n <= 20000) { var res3 = T(function () { var gr = new LIBS.Graph({ type: 'undirected' }); ids.forEach(function (id, i) { gr.addNode(id, { x: Math.cos(i) * 10 + Math.random(), y: Math.sin(i) * 10 + Math.random() }); }); g.edges.forEach(function (e) { if (e.from !== e.to && !gr.hasEdge(e.from, e.to)) gr.addEdge(e.from, e.to); }); LIBS.fa2.assign(gr, { iterations: 300, settings: Object.assign(LIBS.fa2.inferSettings(gr), { barnesHutOptimize: a.n > 500 }) }); return gr; }, a.fast);
        var pos3 = {}; res3.value.forEachNode(function (id, at) { pos3[id] = [at.x, at.y]; }); var st3 = hopStats(ids, g.edges, pos3, comm); out.forceatlas2 = { ms: res3.ms, stress: st3.stress, sep: st3.sep }; }
    }
    return out;
  };


  /* ================= sending a layout from the worker to the page: objects (structured clone) vs packed columns ================= */
  SUITES.pack = function (a) {   // a: { kind, n }; the layout is built once, then the two ways of sending it are timed
    var g = netGraph(a.kind || 'moderate', a.n), L = E.build(C.derive(g), { view: 'network', arrange: 'force' }), out = { n: a.n, links: L.edges.length };
    var P = NFMPack, best = function (f) { var ts = [], i; for (i = 0; i < 3; i++) { var t0 = now(); f(); ts.push(now() - t0); } return r1(med(ts)); };
    out.objects_clone = best(function () { structuredClone(L); });   // write and rebuild every object, all at once (the page waits for about half of it)
    var packed, tr, cl;
    out.pack = best(function () { tr = []; packed = P.packResult(L, tr); });
    out.clone_packed = best(function () { tr = []; packed = P.packResult(L, tr); var t1 = now(); cl = structuredClone(packed, { transfer: tr }); out._t = now() - t1; });
    out.clone_packed = r1(out._t); delete out._t;
    out.unpack = best(function () { tr = []; packed = P.packResult(L, tr); cl = structuredClone(packed, { transfer: tr }); var t2 = now(); P.unpackResult(cl); out._u = now() - t2; });
    out.unpack = r1(out._u); delete out._u;
    out.page_waits_objects = r1(out.objects_clone / 2); out.page_waits_packed = r1(out.clone_packed + out.unpack);
    return out;
  };

  /* ================= flow (layered) layout: ours vs dagre vs ELK, random acyclic graphs ================= */
  function dag(n, m, seed) { var r = GEN.rng(seed), layers = Math.max(4, Math.round(Math.sqrt(n) * 0.8)), per = Math.ceil(n / layers), nodes = [], edges = [], Lr = function (i) { return Math.floor(i / per); }, i;
    for (i = 0; i < n; i++) nodes.push({ id: 'n' + i, label: 'Item ' + i, group: 'g' + (Lr(i) % 5), attrs: {} });
    var seen = new Set(), guard = 0;
    for (i = 1; i < n; i++) { var lo = Math.max(0, (Lr(i) - 1) * per), hi = Lr(i) * per - 1; if (hi < lo) continue; var a = lo + Math.floor(r() * (hi - lo + 1)); seen.add(a + '>' + i); edges.push({ from: 'n' + a, to: 'n' + i, weight: 1 + Math.floor(r() * 5), attrs: {} }); }
    while (edges.length < m && guard++ < m * 20) { var a2 = Math.floor(r() * n), la = Lr(a2), b = r() < 0.03 ? Math.floor(r() * n) : Math.min(n - 1, (la + 1 + Math.floor(r() * 2)) * per + Math.floor(r() * per)); if (a2 === b || seen.has(a2 + '>' + b)) continue; seen.add(a2 + '>' + b); edges.push({ from: 'n' + Math.min(a2, b), to: 'n' + Math.max(a2, b), weight: 1 + Math.floor(r() * 5), attrs: {} }); }
    return { name: 'dag' + n, start: 'n0', nodes: nodes, edges: edges }; }
  function crossings(pos, edges) {
    var seg = edges.map(function (e) { return [pos[e.from], pos[e.to], e.from, e.to]; }).filter(function (s) { return s[0] && s[1]; }), c = 0, i, j;
    var ccw = function (a, b, p) { return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]); };
    for (i = 0; i < seg.length; i++) for (j = i + 1; j < seg.length; j++) { var s = seg[i], t = seg[j]; if (s[2] === t[2] || s[2] === t[3] || s[3] === t[2] || s[3] === t[3]) continue; if (ccw(s[0], s[1], t[0]) * ccw(s[0], s[1], t[1]) < 0 && ccw(t[0], t[1], s[0]) * ccw(t[0], t[1], s[1]) < 0) c++; }
    return c;
  }
  SUITES.layered = async function (a) {   // a: { n, m, dagre: bool, elk: bool, cross: bool }
    var g = dag(a.n, a.m, a.n), dg = C.derive(g), out = { n: a.n, m: a.m }, res = T(function () { return E.build(dg, { view: 'flow', colorBy: 'group' }); }, a.fast), pos = {};
    res.value.nodes.forEach(function (nd) { pos[nd.id] = [nd.x + nd.w / 2, nd.y + nd.h / 2]; });
    out.ours = { ms: res.ms, cross: a.cross ? crossings(pos, res.value.edges.filter(function (e) { return e.from !== e.to; })) : null };
    if (a.dagre) { var dp = {}, r2 = T(function () { var gr = new LIBS.dagre.graphlib.Graph(); gr.setGraph({ rankdir: 'LR', nodesep: 14, ranksep: 90 }); gr.setDefaultEdgeLabel(function () { return {}; }); g.nodes.forEach(function (x) { gr.setNode(x.id, { width: 176, height: 56 }); }); g.edges.forEach(function (e) { gr.setEdge(e.from, e.to); }); LIBS.dagre.layout(gr); gr.nodes().forEach(function (id) { var q = gr.node(id); dp[id] = [q.x, q.y]; }); return gr; }, a.fast); out.dagre = { ms: r2.ms, cross: a.cross ? crossings(dp, g.edges) : null }; }
    if (a.elk) { var elk = new LIBS.ELK(), ep = {}, ts = []; for (var k = 0; k < 2; k++) { var t0 = now(); var rs = await elk.layout({ id: 'root', layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT', 'elk.spacing.nodeNode': '14', 'elk.layered.spacing.nodeNodeBetweenLayers': '90' }, children: g.nodes.map(function (x) { return { id: x.id, width: 176, height: 56 }; }), edges: g.edges.map(function (e, i) { return { id: 'e' + i, sources: [e.from], targets: [e.to] }; }) }); ts.push(now() - t0); rs.children.forEach(function (q) { ep[q.id] = [q.x + 88, q.y + 28]; }); if (ts[0] > 3000) break; } out.elk = { ms: r1(med(ts)), cross: a.cross ? crossings(ep, g.edges) : null }; }
    return out;
  };

  /* ================= found groups: ours vs Louvain ================= */
  var nmi = function (a, b) { var n = a.length, ca = new Map(), cb = new Map(), cab = new Map(), i; for (i = 0; i < n; i++) { ca.set(a[i], (ca.get(a[i]) || 0) + 1); cb.set(b[i], (cb.get(b[i]) || 0) + 1); var k = a[i] + '|' + b[i]; cab.set(k, (cab.get(k) || 0) + 1); } var ha = 0, hb = 0, mi = 0; ca.forEach(function (v) { ha -= v / n * Math.log(v / n); }); cb.forEach(function (v) { hb -= v / n * Math.log(v / n); }); cab.forEach(function (v, k) { var p = k.split('|'); mi += v / n * Math.log(v * n / (ca.get(+p[0]) * cb.get(+p[1]))); }); return 2 * mi / (ha + hb || 1); };
  SUITES.groups = function (a) {   // a: { n, planted, louvain: bool }
    var g = X.bigNetwork(a.n, a.planted, 7), per = Math.ceil(a.n / a.planted), dg = C.derive(g), P = E.prepare(dg, {}), out = { n: a.n, planted: a.planted, m: g.edges.length };
    var truth = [], i; for (i = 0; i < P.n; i++) truth.push(Math.floor(parseInt(P.nodes[i].id.slice(1), 10) / per));
    var res = T(function () { return E.communities(P); }, a.fast), lab = Array.prototype.slice.call(res.value);
    out.ours = { ms: res.ms, groups: new Set(lab).size, nmi: Math.round(nmi(truth, lab) * 1000) / 1000 };
    if (a.louvain !== false) { var gr = new LIBS.Graph({ type: 'undirected' }); g.nodes.forEach(function (x) { gr.addNode(x.id); }); g.edges.forEach(function (e) { if (e.from !== e.to && !gr.hasEdge(e.from, e.to)) gr.addEdge(e.from, e.to); }); var det, r2 = T(function () { var s = 1; det = LIBS.louvain.detailed(gr, { rng: function () { s = (s * 16807) % 2147483647; return s / 2147483647; } }); return det; }, a.fast); var th = []; for (i = 0; i < P.n; i++) th.push(det.communities[P.nodes[i].id]); out.louvain = { ms: r2.ms, groups: new Set(th).size, nmi: Math.round(nmi(truth, th) * 1000) / 1000 }; }
    return out;
  };

  /* ================= Monte Carlo draws, formulas ================= */
  SUITES.draws = function (a) {
    var N = a.N || 1000000, out = {}, rr = S.rngFor(1, 0), mk = function (seed) { var s = seed; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
    var run = function (f) { var t = T(function () { var sum = 0, sq = 0; for (var i = 0; i < N; i++) { var v = f(); sum += v; sq += v * v; } return [sum / N, Math.sqrt(sq / N - sum * sum / N / N)]; }, 3000); return { ms: t.ms, mean: Math.round(t.value[0] * 1000) / 1000, sd: Math.round(t.value[1] * 1000) / 1000 }; };
    var o = function (d, p, q) { var f = S.DRAW[d]; return function () { return f(rr, p, q); }; }, d3 = LIBS.d3random, js = LIBS.jstat;
    out.normal = { ours: run(o('normal', 10, 3)), d3: run(d3.randomNormal.source(mk(3))(10, 3)), jstat: run(function () { return js.normal.sample(10, 3); }) };
    out.lognormal = { ours: run(o('lognormal', 10, 3)), d3: run(d3.randomLogNormal.source(mk(3))(Math.log(10) - 0.5 * Math.log(1.09), Math.sqrt(Math.log(1.09)))) };
    out.poisson = { ours: run(o('poisson', 7)), d3: run(d3.randomPoisson.source(mk(3))(7)), jstat: run(function () { return js.poisson.sample(7); }) };
    out.binomial = { ours: run(o('binomial', 40, 0.3)), d3: run(d3.randomBinomial.source(mk(3))(40, 0.3)) };
    out.exponential = { ours: run(o('exponential', 5)), d3: run(d3.randomExponential.source(mk(3))(1 / 5)) };
    return out;
  };
  /* Normal draws, run after run, to tell a cold start from a steady cost (Firefox reads the first run slower). */
  SUITES.drawsrun = function (a) {
    var N = a.N || 1000000, rr = S.rngFor(1, 0), f = S.DRAW.normal, runs = [], k, sum, i, t0, v;
    for (k = 0; k < 8; k++) { t0 = now(); sum = 0; for (i = 0; i < N; i++) { v = f(rr, 10, 3); sum += v; } runs.push(r1(now() - t0)); }
    var direct = [], nz = rr.normal; for (k = 0; k < 8; k++) { t0 = now(); sum = 0; for (i = 0; i < N; i++) { sum += nz(); } direct.push(r1(now() - t0)); }
    return { N: N, viaDraw: runs, direct: direct, sum: sum };
  };
  /* Ways to write the normal generator, steady-state time for 1,000,000 draws (min and median of 8 runs). Fast path only is compared; the rare slow path is the same text everywhere. */
  SUITES.drawsvar = function (a) {
    var N = a.N || 1000000, ZK = new Float64Array(128), ZW = new Float64Array(128), ZR = 3.442619855899;
    (function () { var m1 = 2147483648, dn = ZR, tn = dn, vn = 9.91256303526217e-3, q = vn / Math.exp(-0.5 * dn * dn), i; ZK[0] = (dn / q) * m1; ZK[1] = 0; ZW[0] = q / m1; ZW[127] = dn / m1; for (i = 126; i >= 1; i--) { dn = Math.sqrt(-2 * Math.log(vn / dn + Math.exp(-0.5 * dn * dn))); ZK[i + 1] = (dn / tn) * m1; tn = dn; ZW[i] = dn / m1; } })();
    var slow = function () { return 0; };
    var mk = {};
    mk.closure = function (seed) { var s = seed | 0; var next = function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return t ^ (t >>> 14); }; return function () { var hz = next(), iz = hz & 127; return Math.abs(hz) < ZK[iz] ? hz * ZW[iz] : slow(hz, iz); }; };
    mk.inline = function (seed) { var s = seed | 0; return function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; var hz = t ^ (t >>> 14), iz = hz & 127; return Math.abs(hz) < ZK[iz] ? hz * ZW[iz] : slow(hz, iz); }; };
    mk.typed = function (seed) { var st = new Int32Array(1); st[0] = seed | 0; return function () { var s = (st[0] + 0x6d2b79f5) | 0; st[0] = s; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; var hz = t ^ (t >>> 14), iz = hz & 127; return Math.abs(hz) < ZK[iz] ? hz * ZW[iz] : slow(hz, iz); }; };
    mk.field = function (seed) { var o = { s: seed | 0 }; return function () { var s = (o.s + 0x6d2b79f5) | 0; o.s = s; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; var hz = t ^ (t >>> 14), iz = hz & 127; return Math.abs(hz) < ZK[iz] ? hz * ZW[iz] : slow(hz, iz); }; };
    mk.cmp = function (seed) { var s = seed | 0; return function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; var hz = t ^ (t >>> 14), iz = hz & 127; var x = hz * ZW[iz]; return (hz < 0 ? -hz : hz) < ZK[iz] ? x : slow(hz, iz); }; };
    var out = {}, fill = function (seed, buf, n) { var s = seed | 0, i, t, hz, iz; for (i = 0; i < n; i++) { s = (s + 0x6d2b79f5) | 0; t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; hz = t ^ (t >>> 14); iz = hz & 127; buf[i] = Math.abs(hz) < ZK[iz] ? hz * ZW[iz] : slow(hz, iz); } };
    Object.keys(mk).forEach(function (k) { var f = mk[k](7), ts = [], j, i, sum, t0; for (j = 0; j < 8; j++) { t0 = now(); sum = 0; for (i = 0; i < N; i++) sum += f(); ts.push(now() - t0); } ts.sort(function (x, y) { return x - y; }); out[k] = { min: r1(ts[0]), med: r1((ts[3] + ts[4]) / 2), sum: sum }; });
    var buf = new Float64Array(N), ts = [], j, t0, sum, i; for (j = 0; j < 8; j++) { t0 = now(); fill(7, buf, N); sum = 0; for (i = 0; i < N; i++) sum += buf[i]; ts.push(now() - t0); } ts.sort(function (x, y) { return x - y; }); out.batch = { min: r1(ts[0]), med: r1((ts[3] + ts[4]) / 2), sum: sum };
    return out;
  };
  SUITES.formula = function (a) {
    var N = a.N || 300000, rows = [], i; for (i = 0; i < N; i++) rows.push({ a: i % 97, b: i % 13 + 1 });
    var f = C.compile('if(a > 40, a * 1.5 + sqrt(b), a / b) - round(b * 2)'), p = LIBS.exprEval.Parser.parse('(a > 40 ? a * 1.5 + sqrt(b) : a / b) - round(b * 2)');
    var o = T(function () { var s = 0; for (var i = 0; i < N; i++) s += f.fn(function (k) { return rows[i][k]; }); return s; }), e = T(function () { var s = 0; for (var i = 0; i < N; i++) s += p.evaluate(rows[i]); return s; });
    return { rows: N, ours: o.ms, exprEval: e.ms, same: Math.abs(o.value - e.value) < 1e-6 * Math.abs(e.value) };
  };

  /* ================= GIF: ours vs gifenc, synthetic animated frames ================= */
  SUITES.gif = function (a) {
    var W = a.w || 960, H = a.h || 540, N = a.frames || 31, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var cx = cv.getContext('2d', { willReadFrequently: true }), frames = [], i, j;
    for (i = 0; i < N; i++) { cx.fillStyle = '#f6f5f1'; cx.fillRect(0, 0, W, H); for (j = 0; j < 13; j++) { cx.fillStyle = ['#4a78b0', '#e08a3c', '#5aa05a', '#d04a4a', '#6ab0a8'][j % 5]; var x = 60 + (j % 5) * 170 + Math.sin(i / 5 + j) * 14, y = 60 + Math.floor(j / 5) * 150 + Math.cos(i / 4 + j) * 10; cx.beginPath(); cx.roundRect(x, y, 140, 52, 10); cx.fill(); cx.strokeStyle = 'rgba(40,50,80,' + (0.3 + 0.4 * ((i + j) % 5) / 5) + ')'; cx.lineWidth = 3 + (i % 4); cx.beginPath(); cx.moveTo(x + 140, y + 26); cx.bezierCurveTo(x + 200, y + 26, x + 160, y + 140, x + 230, y + 140); cx.stroke(); } frames.push(cx.getImageData(0, 0, W, H).data); }
    var out = { frames: N, w: W, h: H }, o = T(function () { var pal = G.makePalette([frames[0], frames[(N / 4) | 0], frames[(N / 2) | 0], frames[N - 1]], 255), enc = G.createEncoder(W, H, pal); frames.forEach(function (f) { enc.add(f, 100); }); return enc.finish(); }, 800);
    out.ours = { ms: o.ms, bytes: o.value.length };
    var ge = LIBS.gifenc, t1 = T(function () { var enc = ge.GIFEncoder(), pal = ge.quantize(frames[0], 256); frames.forEach(function (f) { enc.writeFrame(ge.applyPalette(f, pal), W, H, { palette: pal, delay: 100 }); }); enc.finish(); return enc.bytes(); }, 800);
    out.gifenc_shared_palette = { ms: t1.ms, bytes: t1.value.length };
    /* how close is the decoded animation to the original pictures? (mean squared error per color value, 0 to 255 scale; PSNR in dB; read back with omggif) */
    var mse = function (bytes) {
      var rd = new LIBS.omggif.GifReader(bytes), px = new Uint8ClampedArray(W * H * 4), sum = 0, f, q;
      for (f = 0; f < N; f++) { rd.decodeAndBlitFrameRGBA(f, px); var src = frames[f]; for (q = 0; q < px.length; q += 4) { var dr = px[q] - src[q], dg = px[q + 1] - src[q + 1], db = px[q + 2] - src[q + 2]; sum += dr * dr + dg * dg + db * db; } }
      return sum / (N * W * H * 3);
    };
    try {
      var m1 = mse(o.value), m2 = mse(t1.value);
      out.ours.mse = Math.round(m1 * 1e4) / 1e4; out.gifenc_shared_palette.mse = Math.round(m2 * 1e4) / 1e4;
      out.ours.psnr = Math.round(10 * Math.log10(65025 / Math.max(m1, 1e-9)) * 100) / 100; out.gifenc_shared_palette.psnr = Math.round(10 * Math.log10(65025 / Math.max(m2, 1e-9)) * 100) / 100;
    } catch (e) { out.quality_error = String(e && e.message || e); }
    return out;
  };

  /* GIF profile: where the time goes, run by run (the first run is cold, the later ones are warmer). Needs an instrumented src/gif.js (bench/gif-profile.sh swaps one in); without it only the outer times appear. */
  SUITES.gifprof = function (a) {
    var W = a.w || 960, H = a.h || 540, N = a.frames || 31, cv = document.createElement('canvas'); cv.width = W; cv.height = H; var cx = cv.getContext('2d', { willReadFrequently: true }), frames = [], i, j;
    for (i = 0; i < N; i++) { cx.fillStyle = '#f6f5f1'; cx.fillRect(0, 0, W, H); for (j = 0; j < 13; j++) { cx.fillStyle = ['#4a78b0', '#e08a3c', '#5aa05a', '#d04a4a', '#6ab0a8'][j % 5]; var x = 60 + (j % 5) * 170 + Math.sin(i / 5 + j) * 14, y = 60 + Math.floor(j / 5) * 150 + Math.cos(i / 4 + j) * 10; cx.beginPath(); cx.roundRect(x, y, 140, 52, 10); cx.fill(); cx.strokeStyle = 'rgba(40,50,80,' + (0.3 + 0.4 * ((i + j) % 5) / 5) + ')'; cx.lineWidth = 3 + (i % 4); cx.beginPath(); cx.moveTo(x + 140, y + 26); cx.bezierCurveTo(x + 200, y + 26, x + 160, y + 140, x + 230, y + 140); cx.stroke(); } frames.push(cx.getImageData(0, 0, W, H).data); }
    var runs = [], r, lap = function () { return window.__laps ? window.__laps.splice(0) : []; };
    for (r = 0; r < 3; r++) {
      window.__laps = []; var t0 = now(), pal = G.makePalette([frames[0], frames[(N / 4) | 0], frames[(N / 2) | 0], frames[N - 1]], 255), t1 = now(), enc = G.createEncoder(W, H, pal), adds = [];
      frames.forEach(function (f) { var q = now(); enc.add(f, 100); adds.push(r1(now() - q)); });
      var t2 = now(), bytes = enc.finish().length, t3 = now(), laps = lap();
      var g0 = now(), ge = LIBS.gifenc, enc2 = ge.GIFEncoder(), pal2 = ge.quantize(frames[0], 256), g1 = now(); frames.forEach(function (f) { enc2.writeFrame(ge.applyPalette(f, pal2), W, H, { palette: pal2, delay: 100 }); }); enc2.finish(); var g2 = now();
      runs.push({ total: r1(t3 - t0), palette: r1(t1 - t0), adds: adds, finish: r1(t3 - t2), laps: laps.map(function (l) { return [l[0], r1(l[1])]; }), gifenc_total: r1(g2 - g0), gifenc_quantize: r1(g1 - g0) });
    }
    return { frames: N, runs: runs };
  };


  /* ================= majorization on the graphics card: does it give the same picture as the CPU? ================= */
  var MAJ_WGSL = [
    'struct P { k: u32, edge: f32, a: u32, b: u32 };',
    '@group(0) @binding(0) var<uniform> prm: P;',
    '@group(0) @binding(1) var<storage, read> dm: array<u32>;',
    '@group(0) @binding(2) var<storage, read> pin: array<vec2<f32>>;',
    '@group(0) @binding(3) var<storage, read_write> pout: array<vec2<f32>>;',
    '@group(0) @binding(4) var<storage, read> wsum: array<f32>;',
    'fn hop(a: u32, b: u32) -> f32 { let idx = a * prm.k + b; return f32((dm[idx >> 2u] >> ((idx & 3u) * 8u)) & 255u); }',
    '@compute @workgroup_size(64)',
    'fn step(@builtin(global_invocation_id) gid: vec3<u32>) {',
    '  let i = gid.x; if (i >= prm.k) { return; }',
    '  let xi = pin[i]; var acc = vec2<f32>(0.0, 0.0);',
    '  for (var j = 0u; j < prm.k; j = j + 1u) {',
    '    let d = hop(j, i);',   // the table is symmetric: reading it column-wise lets neighboring threads read neighboring bytes
    '    if (d == 0.0) { continue; }',
    '    let xj = pin[j]; let dl = xi - xj; let len = max(length(dl), 1e-6);',
    '    acc = acc + (1.0 / (d * d)) * (xj + (d * prm.edge / len) * dl);',
    '  }',
    '  if (wsum[i] > 0.0) { pout[i] = acc / wsum[i]; } else { pout[i] = xi; }',
    '}'].join('\n');
  /** The same step on the CPU (64-bit numbers): every item moves to the weighted mean of where each other item wants it. */
  function majCpu(P, D, k, edge, steps, wsum) {
    var cur = Float64Array.from(P), nxt = new Float64Array(2 * k), s, i, j;
    for (s = 0; s < steps; s++) {
      for (i = 0; i < k; i++) {
        var ax = 0, ay = 0, xi = cur[2 * i], yi = cur[2 * i + 1];
        for (j = 0; j < k; j++) { var d = D[i * k + j]; if (!d) continue; var dx = xi - cur[2 * j], dy = yi - cur[2 * j + 1], len = Math.max(Math.sqrt(dx * dx + dy * dy), 1e-6), w = 1 / (d * d), f = d * edge / len; ax += w * (cur[2 * j] + f * dx); ay += w * (cur[2 * j + 1] + f * dy); }
        if (wsum[i] > 0) { nxt[2 * i] = ax / wsum[i]; nxt[2 * i + 1] = ay / wsum[i]; } else { nxt[2 * i] = xi; nxt[2 * i + 1] = yi; }
      }
      var sw = cur; cur = nxt; nxt = sw;
    }
    return cur;
  }
  function allStress(P, D, k, edge) {   // mean of w * (page distance - wanted distance)^2 over every pair
    var sum = 0, cnt = 0, i, j;
    for (i = 0; i < k; i++) for (j = i + 1; j < k; j++) { var d = D[i * k + j]; if (!d) continue; sum += Math.pow(Math.hypot(P[2 * i] - P[2 * j], P[2 * i + 1] - P[2 * j + 1]) - d * edge, 2) / (d * d); cnt++; }
    return sum / cnt;
  }
  SUITES.gpumaj = async function (a) {   // a: { kind, n, steps }
    var out = { kind: a.kind || 'moderate', n: a.n, steps: a.steps || 20 }, EDGE = 130;
    if (!navigator.gpu) { out.verdict = 'This browser has no WebGPU, so there is nothing to check.'; out.skipped = true; return out; }
    var adapter = await navigator.gpu.requestAdapter(); if (!adapter) { out.verdict = 'No graphics adapter was offered, so there is nothing to check.'; out.skipped = true; return out; }
    var info = adapter.info || {}; out.adapter = [info.vendor, info.architecture, info.description || info.device].filter(Boolean).join(' / '); out.software = !!adapter.isFallbackAdapter || /swiftshader|llvmpipe|software|lavapipe/i.test(out.adapter + ' ' + (info.vendor === 'google' ? 'swiftshader' : ''));
    var device = await adapter.requestDevice(), g = netGraph(out.kind, a.n), dg = C.derive(g), L = E.build(dg, { view: 'network', arrange: 'stress', colorBy: 'group' });
    var ids = L.nodes.map(function (nd) { return nd.nodeId || nd.id; }), k = ids.length, idx = new Map(ids.map(function (id, i) { return [id, i]; })), adj = ids.map(function () { return []; }), i, j;
    g.edges.forEach(function (e) { var p = idx.get(e.from), q = idx.get(e.to); if (p !== undefined && q !== undefined && p !== q) { adj[p].push(q); adj[q].push(p); } });
    var D = new Uint8Array(k * k), dist = new Int32Array(k), queue = new Int32Array(k), wsum = new Float32Array(k);
    for (i = 0; i < k; i++) {
      dist.fill(-1); dist[i] = 0; queue[0] = i; var head = 0, tail = 1;
      while (head < tail) { var u = queue[head++]; for (var e2 = 0; e2 < adj[u].length; e2++) { var w2 = adj[u][e2]; if (dist[w2] < 0) { dist[w2] = dist[u] + 1; queue[tail++] = w2; } } }
      for (j = 0; j < k; j++) { var dv = dist[j] > 255 ? 255 : dist[j]; D[i * k + j] = dv > 0 ? dv : 0; if (dv > 0) wsum[i] += 1 / (dv * dv); }
    }
    var P0 = new Float32Array(2 * k); L.nodes.forEach(function (nd, q) { P0[2 * q] = nd.cx; P0[2 * q + 1] = nd.cy; });
    var t0 = now(), Pc = majCpu(P0, D, k, EDGE, out.steps, wsum); out.cpuMs = r1(now() - t0);
    var mk = function (size, usage, data) { var b = device.createBuffer({ size: size, usage: usage, mappedAtCreation: !!data }); if (data) { new data.constructor(b.getMappedRange()).set(data); b.unmap(); } return b; };
    var S = GPUBufferUsage, words = Math.ceil(k * k / 4), dmw = new Uint32Array(words); new Uint8Array(dmw.buffer).set(D);
    var bP = mk(16, S.UNIFORM, new Uint32Array([k, new Uint32Array(new Float32Array([EDGE]).buffer)[0], 0, 0])), bD = mk(words * 4, S.STORAGE, dmw), bA = mk(8 * k, S.STORAGE | S.COPY_SRC, P0), bB = mk(8 * k, S.STORAGE | S.COPY_SRC), bW = mk(4 * k, S.STORAGE, wsum), bR = mk(8 * k, S.COPY_DST | S.MAP_READ);
    var mod = device.createShaderModule({ code: MAJ_WGSL }), pipe = device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'step' } });
    var bg = function (pin, pout) { return device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: bP } }, { binding: 1, resource: { buffer: bD } }, { binding: 2, resource: { buffer: pin } }, { binding: 3, resource: { buffer: pout } }, { binding: 4, resource: { buffer: bW } }] }); };
    var g1 = bg(bA, bB), g2 = bg(bB, bA), enc = device.createCommandEncoder(), pass = enc.beginComputePass();
    pass.setPipeline(pipe); for (var s = 0; s < out.steps; s++) { pass.setBindGroup(0, s % 2 ? g2 : g1); pass.dispatchWorkgroups(Math.ceil(k / 64)); }
    pass.end(); enc.copyBufferToBuffer(out.steps % 2 ? bB : bA, 0, bR, 0, 8 * k); var t1 = now(); device.queue.submit([enc.finish()]); await bR.mapAsync(GPUMapMode.READ);
    var Pg = new Float32Array(bR.getMappedRange().slice(0)); bR.unmap(); out.gpuMs = r1(now() - t1);
    var s0 = allStress(P0, D, k, EDGE), sc = allStress(Pc, D, k, EDGE), sg = allStress(Pg, D, k, EDGE), dsum = 0;
    for (i = 0; i < k; i++) dsum += Math.hypot(Pc[2 * i] - Pg[2 * i], Pc[2 * i + 1] - Pg[2 * i + 1]);
    out.items = k; out.stressStart = r1(s0); out.stressCpu = r1(sc); out.stressGpu = r1(sg); out.stressDiffPct = Math.round(Math.abs(sg - sc) / sc * 1000) / 10; out.meanMoveVsLink = Math.round(dsum / k / EDGE * 1000) / 1000;
    var same = out.stressDiffPct < 1 && out.meanMoveVsLink < 0.05;
    out.verdict = (same ? 'The graphics-card version gives the same picture as the CPU version' : 'The graphics-card version differs from the CPU version') + ' (distance error ' + out.stressGpu + ' against ' + out.stressCpu + ', started from ' + out.stressStart + '; items differ by ' + (out.meanMoveVsLink * 100).toFixed(1) + '% of a link length on average).' + (out.software ? ' The adapter is a software one, so the times say nothing about a real card.' : '');
    out.ok = same;
    return out;
  };

  /* ================= checker, ingestion, memory ================= */
  SUITES.check = function (a) { var g = GEN.graph(a.kind || 'moderate', a.n, 3), t = T(function () { return K.run(g, {}); }, 800); return { n: a.n, m: g.edges.length, ms: t.ms, findings: t.value.findings.length }; };
  SUITES.ingest = function (a) {   // import the same network from JSON, CSV and "A -> B" lines
    var g = X.bigNetwork(a.n, 20, 7), json = JSON.stringify(g), csv = ['from,to,weight'].concat(g.edges.map(function (e) { return e.from + ',' + e.to + ',1'; })).join('\n'), arrows = g.edges.map(function (e) { return e.from + ' -> ' + e.to; }).join('\n');
    return { n: a.n, links: g.edges.length, json: T(function () { return I.importAny(json, { name: 'a.json' }); }).ms, csv: T(function () { return I.importAny(csv, { name: 'a.csv' }); }).ms, arrows: T(function () { return I.importAny(arrows, { name: 'a.txt' }); }).ms, jsonKB: json.length >> 10, csvKB: csv.length >> 10 };
  };
  SUITES.memory = function (a) {   // a: { n, what: 'ours' | 'prepare' | 'graphology' | 'cytoscape' | 'layout' }; the runner adds process memory (the only number Firefox gives)
    var g = X.bigNetwork(a.n, 20, 7), out = { n: a.n, m: g.edges.length, what: a.what }, dg = C.derive(g), b = heap(), keep = (window.__keep = []);
    if (a.what === 'baseline') return out;
    if (a.what === 'prepare') { var P = E.prepare(dg, {}); keep.push(P); var typed = 0; Object.keys(P).forEach(function (k) { if (ArrayBuffer.isView(P[k])) typed += P[k].byteLength; }); out.typed_arrays_MB = mb(typed); }
    if (a.what === 'graphology') { var gr = new LIBS.Graph(); g.nodes.forEach(function (x) { gr.addNode(x.id, { label: x.label }); }); g.edges.forEach(function (e) { if (e.from !== e.to && !gr.hasEdge(e.from, e.to)) gr.addEdge(e.from, e.to); }); keep.push(gr); }
    if (a.what === 'cytoscape') keep.push(LIBS.cytoscape({ headless: true, elements: g.nodes.map(function (x) { return { data: { id: x.id } }; }).concat(g.edges.map(function (e, i) { return { data: { id: 'e' + i, source: e.from, target: e.to } }; })) }));
    if (a.what === 'layout') keep.push(E.build(dg, { view: 'network', arrange: 'force' }));
    out.heapMB = b === null ? null : mb(heap() - b); return out;
  };

  /* ================= typed arrays: what do they cost, what do they save? ================= */
  SUITES.pairStore = function (a) {   // a: { k, variant: 'arrays' | 'typedIndexed' | 'typedSeq', iters } the stress sweep alone, same pairs, three ways to hold them
    var k = a.k, iters = a.iters || 30, EDGE = 130, X = new Float64Array(k * 2), i, j, t, q, p, rnd = GEN.rng(3), out = { k: k, variant: a.variant, iters: iters };
    for (i = 0; i < k * 2; i++) X[i] = (rnd() - 0.5) * 2000;
    var dist = function (x, y) { return 1 + ((x * 7 + y * 13) % 8); }, b = heap(), t0 = now(), keep = (window.__keep = []);
    var cnt = k * (k - 1) / 2; out.pairs = cnt;
    if (a.variant === 'arrays') {
      var pairs = []; for (i = 0; i < k; i++) for (j = i + 1; j < k; j++) pairs.push([i, j, dist(i, j)]); keep.push(pairs);
      out.buildMs = r1(now() - t0); out.heapMB = b === null ? null : mb(heap() - b); t0 = now();
      for (t = 0; t < iters; t++) {
        var eta = 64 * Math.exp(-0.15 * t);
        for (q = pairs.length - 1; q > 0; q--) { j = Math.floor(rnd() * (q + 1)); p = pairs[q]; pairs[q] = pairs[j]; pairs[j] = p; }
        for (q = 0; q < pairs.length; q++) { var pr = pairs[q], dij = pr[2] * EDGE, mu = Math.min(1, eta / (pr[2] * pr[2])), a2 = pr[0] * 2, b2 = pr[1] * 2, dx = X[a2] - X[b2], dy = X[a2 + 1] - X[b2 + 1], mag = Math.sqrt(dx * dx + dy * dy) || 1e-6, r = (mu * (mag - dij)) / 2, rx = r * dx / mag, ry = r * dy / mag; X[a2] -= rx; X[a2 + 1] -= ry; X[b2] += rx; X[b2 + 1] += ry; }
      }
    } else {
      var pa = new Int32Array(cnt), pb = new Int32Array(cnt), pd = new Float32Array(cnt), pw = new Float32Array(cnt); q = 0;
      for (i = 0; i < k; i++) for (j = i + 1; j < k; j++) { var d = dist(i, j); pa[q] = i; pb[q] = j; pd[q] = d * EDGE; pw[q] = 1 / (d * d); q++; }
      keep.push(pa, pb, pd, pw); var ord = new Int32Array(cnt); for (q = 0; q < cnt; q++) ord[q] = q;
      if (a.variant === 'typedSeq') { for (q = cnt - 1; q > 0; q--) { j = Math.floor(rnd() * (q + 1)); p = pa[q]; pa[q] = pa[j]; pa[j] = p; p = pb[q]; pb[q] = pb[j]; pb[j] = p; var f = pd[q]; pd[q] = pd[j]; pd[j] = f; f = pw[q]; pw[q] = pw[j]; pw[j] = f; } }
      out.buildMs = r1(now() - t0); out.heapMB = b === null ? null : mb(heap() - b); t0 = now();
      for (t = 0; t < iters; t++) {
        var eta2 = 64 * Math.exp(-0.15 * t);
        if (a.variant === 'typedIndexed') { for (q = cnt - 1; q > 0; q--) { j = Math.floor(rnd() * (q + 1)); p = ord[q]; ord[q] = ord[j]; ord[j] = p; } }
        for (var n2 = 0; n2 < cnt; n2++) {
          q = a.variant === 'typedIndexed' ? ord[n2] : (t & 1 ? cnt - 1 - n2 : n2);
          var mu2 = pw[q] * eta2; if (mu2 > 1) mu2 = 1;
          var c2 = pa[q] * 2, e2 = pb[q] * 2, dx2 = X[c2] - X[e2], dy2 = X[c2 + 1] - X[e2 + 1], mg = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1e-6, r2 = (mu2 * (mg - pd[q])) / (2 * mg), rx2 = r2 * dx2, ry2 = r2 * dy2;
          X[c2] -= rx2; X[c2 + 1] -= ry2; X[e2] += rx2; X[e2 + 1] += ry2;
        }
      }
    }
    out.sgdMs = r1(now() - t0); out.nsPerUpdate = Math.round(out.sgdMs * 1e6 / (cnt * iters)); return out;
  };

  SUITES.stressRun = function (a) {   // a: { kind, n, engine: 'new' | 'before' } one stress layout, nothing else; the runner adds the process memory
    var g = netGraph(a.kind, a.n), dg = C.derive(g), eng = a.engine === 'before' ? NFMEngineBefore : E, b = heap(), t0 = now(), L = eng.build(dg, { view: 'network', arrange: 'stress', colorBy: 'group' });
    window.__keep = [L]; return { kind: a.kind, n: a.n, engine: a.engine, ms: r1(now() - t0), heapMB: b === null ? null : mb(heap() - b) };
  };

  SUITES.transfer = function (a) {   // a: { n } sending a layout result to the page: one object per item (structured clone) against typed arrays (copied, or moved)
    var n = a.n, items = new Array(n), i, out = { n: n }, t0;
    for (i = 0; i < n; i++) items[i] = { id: 'n' + i, nodeId: 'n' + i, label: 'Item ' + i, x: i * 1.5, y: i * 2.5, w: 40, h: 40, cx: i * 1.5 + 20, cy: i * 2.5 + 20, shape: 'dot', layer: 0, group: 'g' + (i % 12), color: '#4477aa' };
    t0 = now(); var c1 = structuredClone(items); out.objectsMs = r1(now() - t0); c1 = null;
    var ta = new Float64Array(n * 4); for (i = 0; i < n * 4; i++) ta[i] = i;
    t0 = now(); var c2 = structuredClone(ta); out.typedCopyMs = r1(now() - t0); c2 = null;
    t0 = now(); var c3 = structuredClone(ta, { transfer: [ta.buffer] }); out.typedMoveMs = r1(now() - t0); c3 = null;
    out.objectsMB = Math.round(n * 13 * 8 / 1048576 * 10) / 10; out.typedMB = Math.round(n * 32 / 1048576 * 10) / 10; return out;
  };

  /* ================= limits: one structure at one scale, every stage in turn, ours only ================= */
  SUITES.limits = function (a) {   // a: { kind, n, via: 'csv'|'graph', stages: [names] }
    var out = { kind: a.kind, n: a.n, stages: {} }, text = null, graph = null, dg = null, P = null, st = out.stages;
    var stage = function (name, fn) { var b = heap(), t0 = now(); try { var v = fn(); st[name] = { ms: r1(now() - t0), heapMB: b === null ? null : mb(heap() - b) }; return v; } catch (e) { st[name] = { ms: r1(now() - t0), error: String(e && e.message || e).slice(0, 90) }; return null; } };
    var want = function (s) { return !a.stages || a.stages.indexOf(s) >= 0; };
    if (a.via === 'csv') {
      var tg = now(); var c = GEN.csv(a.kind, a.n, 21); out.makeCsvMs = r1(now() - tg);
      if (c.error) { st.csv_text = { error: c.error + ' (after ' + c.rows + ' rows)' }; return out; }
      text = c.text; out.rows = c.rows; out.csvMB = Math.round(c.bytes / 1048576 * 10) / 10;
      stage('csv_parse', function () { return I.parseDelimited(text, ','); });
      var imp = stage('csv_import', function () { return I.importAny(text, { name: 'bench.csv', maxNodes: 1e7, maxEdges: 5e7 }); }); text = null;
      graph = imp && imp.graph; if (!graph) return out; out.nodes = graph.nodes.length; out.edges = graph.edges.length;
    } else { graph = GEN.graph(a.kind, a.n, 21); out.nodes = graph.nodes.length; out.edges = graph.edges.length; }
    dg = stage('derive', function () { return C.derive(graph); }) || graph;
    if (want('prepare')) P = stage('prepare', function () { return E.prepare(dg, {}); });
    if (want('check')) stage('check', function () { return K.run(graph, {}).findings.length; });
    if (want('groups') && P) stage('groups', function () { return E.communities(P); });
    if (want('flow')) stage('flow_layout', function () { return E.build(dg, { view: 'flow', colorBy: 'group' }).nodes.length; });
    if (want('force')) stage('force_layout', function () { return E.build(dg, { view: 'network', arrange: 'force', colorBy: 'group' }).nodes.length; });
    if (want('stress')) stage('stress_layout', function () { return E.build(dg, { view: 'network', arrange: 'stress', colorBy: 'group' }).nodes.length; });
    if (want('sim') && P) stage('sim_1000_runs', function () { var sim = S.create(P, { trials: 1000, seed: 1, sources: [{ v: 0, w: 1 }] }); return sim.run(1000, 600000).done; });
    return out;
  };

  return SUITES;
})();

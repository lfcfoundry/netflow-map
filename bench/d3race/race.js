/* Copyright (c) 2026 LFC Foundry. MIT License.
 * Netflow Map against D3: one button. Races Netflow Map's own layouts and drawing against d3-force, d3-sankey and a D3 SVG / canvas drawing
 * of the same data, in the browser that opens this page, and writes a results file (.md).
 * Needs: NFMColumns, NFMEngine, NFMGen, NFMScene, NFMRender, NFMProbe and D3R (the build puts them in this page). */
(function () {
  'use strict';
  var E = NFMEngine, C = NFMColumns, GEN = NFMGen, D3 = D3R;
  var now = function () { return performance.now(); }, r1 = function (v) { return Math.round(v * 10) / 10; }, r3 = function (v) { return Math.round(v * 1000) / 1000; };
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search), QUICK = params.has('quick'), VERSION = '__VERSION__';
  var yieldUI = function () { return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); }); };
  var nextFrame = function () { return new Promise(function (r) { requestAnimationFrame(r); }); };
  var sections = [], running = false, t0Run = 0, clockTimer = 0, total = 3, doneSteps = 0, ctx = { layouts: {} };
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function fmtMs(ms) { return ms >= 1000 ? (ms / 1000).toFixed(ms >= 10000 ? 1 : 2) + ' s' : (ms >= 10 ? Math.round(ms) : r1(ms)) + ' ms'; }
  function clockText(ms) { var t = Math.floor(ms / 1000), m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function setStatus(t) { $('status').textContent = t; }
  function setBar() { $('barfill').style.width = Math.min(100, Math.round(100 * doneSteps / total)) + '%'; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function med(a) { if (!a.length) return 0; var b = a.slice().sort(function (x, y) { return x - y; }); return b[b.length >> 1]; }
  function pct(a, q) { if (!a.length) return 0; var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(q * b.length))]; }

  function addSection(title) {
    var card = document.createElement('div'); card.className = 'card'; card.innerHTML = '<h2></h2><div class="verdict note">Working…</div><div class="host"></div><div class="tw"></div>'; card.firstChild.textContent = title; $('out').appendChild(card);
    var s = { title: title, verdict: '', level: 'ok', tables: [], notes: [], card: card, host: card.querySelector('.host') };
    /** A table with a caption saying which direction is better. */
    s.table = function (caption, head) {
      var t = { caption: caption, head: head, rows: [], el: document.createElement('div') }; s.card.querySelector('.tw').appendChild(t.el);
      t.draw = function () { t.el.innerHTML = '<p class="note" style="margin:10px 0 2px"><b>' + esc(t.caption) + '</b></p><table><thead><tr>' + t.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + t.rows.map(function (r) { return '<tr>' + r.map(function (c, i) { var w = c && c.win; return '<td' + (w ? ' class="win"' : '') + '>' + esc(w ? c.text : c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; };
      t.add = function (r) { t.rows.push(r); t.draw(); }; t.draw(); s.tables.push(t); return t;
    };
    s.finish = function (level, verdict) {
      s.level = level; s.verdict = verdict; var v = card.querySelector('.verdict'); v.className = 'verdict ' + level; v.textContent = verdict;
      s.host.textContent = ''; s.notes.forEach(function (n) { var p = document.createElement('p'); p.className = 'note'; p.textContent = n; card.appendChild(p); });
    };
    sections.push(s); return s;
  }

  /* ------------------------------------------------------------- the truth score (the same one every Netflow Map benchmark uses) */
  /** Largest connected piece as compressed adjacency, with the ids in piece order. */
  function piece(g) {
    var n = g.nodes.length, idx = new Map(), i; g.nodes.forEach(function (nd, q) { idx.set(nd.id, q); });
    var adj = new Array(n); for (i = 0; i < n; i++) adj[i] = new Set();
    g.edges.forEach(function (e) { var a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { adj[a].add(b); adj[b].add(a); } });
    var comp = new Int32Array(n).fill(-1), best = -1, bestSize = 0, c = 0, q = new Int32Array(n);
    for (i = 0; i < n; i++) if (comp[i] < 0) { var h = 0, t = 1; q[0] = i; comp[i] = c; while (h < t) { var u = q[h++]; adj[u].forEach(function (w) { if (comp[w] < 0) { comp[w] = c; q[t++] = w; } }); } if (t > bestSize) { bestSize = t; best = c; } c++; }
    var members = [], loc = new Int32Array(n).fill(-1); for (i = 0; i < n; i++) if (comp[i] === best) { loc[i] = members.length; members.push(i); }
    var k = members.length, off = new Uint32Array(k + 1), nbrArr = [], m = 0;
    members.forEach(function (v, j) { adj[v].forEach(function (w) { nbrArr.push(loc[w]); m++; }); off[j + 1] = m; });
    return { k: k, off: off, nbr: Uint32Array.from(nbrArr), ids: members.map(function (v) { return g.nodes[v].id; }) };
  }
  /** 60 breadth-first sources, best-scale fit, mean of (hops - scale*distance)^2 / hops^2. Lower is truer. */
  function truth(P, X) {
    var k = P.k, ns = Math.min(60, k), stride = k > 3000 ? 7 : 1, dist = new Int32Array(k), q = new Int32Array(k), num = 0, den = 0, pairs = [], s, t;
    for (s = 0; s < ns; s++) {
      var src = Math.floor(s * k / ns); dist.fill(-1); dist[src] = 0; q[0] = src; var h = 0, tl = 1;
      while (h < tl) { var u = q[h++]; for (var e = P.off[u]; e < P.off[u + 1]; e++) { var w = P.nbr[e]; if (dist[w] < 0) { dist[w] = dist[u] + 1; q[tl++] = w; } } }
      for (t = 0; t < k; t += stride) if (t !== src && dist[t] > 0) { var ex = Math.hypot(X[2 * src] - X[2 * t], X[2 * src + 1] - X[2 * t + 1]); pairs.push(dist[t], ex); num += ex / dist[t]; den += ex * ex / (dist[t] * dist[t]); }
    }
    var sc = num / den, st = 0; for (s = 0; s < pairs.length; s += 2) { var d = pairs[s], ee = pairs[s + 1]; st += Math.pow(d - sc * ee, 2) / (d * d); }
    return st / (pairs.length / 2);
  }
  function packX(P, pos) { var X = new Float64Array(2 * P.k); P.ids.forEach(function (id, i) { var p = pos.get(id); X[2 * i] = p[0]; X[2 * i + 1] = p[1]; }); return X; }
  function scatter(s, X, k, caption) {
    var fig = document.createElement('figure'), cv = document.createElement('canvas'), cap = document.createElement('figcaption'); cv.width = 480; cv.height = 320; fig.appendChild(cv); fig.appendChild(cap); cap.textContent = caption;
    var wrap = s.card.querySelector('.pics'); if (!wrap) { wrap = document.createElement('div'); wrap.className = 'pics'; s.card.insertBefore(wrap, s.card.querySelector('.tw')); } wrap.appendChild(fig);
    var g = cv.getContext('2d'), x0 = 1e30, x1 = -1e30, y0 = 1e30, y1 = -1e30, i, step = Math.max(1, Math.floor(k / 6000));
    for (i = 0; i < k; i += step) { var x = X[2 * i], y = X[2 * i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    var sc = 0.94 * Math.min(cv.width / Math.max(1e-9, x1 - x0), cv.height / Math.max(1e-9, y1 - y0)), ox = (cv.width - sc * (x1 - x0)) / 2, oy = (cv.height - sc * (y1 - y0)) / 2;
    g.fillStyle = matchMedia('(prefers-color-scheme:dark)').matches ? 'rgba(140,180,255,.7)' : 'rgba(40,90,200,.6)';
    for (i = 0; i < k; i += step) g.fillRect(ox + sc * (X[2 * i] - x0) - 1, oy + sc * (X[2 * i + 1] - y0) - 1, 2.4, 2.4);
  }
  var win = function (text) { return { win: true, text: text }; };

  /* ------------------------------------------------------------- 1. network layout */
  function netflowLayout(g, arrange) {
    var dg = C.derive(clone(g)), t0 = now(), L = E.build(dg, { view: 'network', arrange: arrange, colorBy: 'group' }), ms = now() - t0, pos = new Map();
    L.nodes.forEach(function (nd) { pos.set(nd.nodeId || nd.id, [nd.cx, nd.cy]); }); return { ms: ms, pos: pos, L: L };
  }
  function d3Layout(g) {   /* the same settings the benchmark files use: link distance 30, charge -30, centered, run until the simulation cools */
    var F = D3.d3force, t0 = now(), nodes = g.nodes.map(function (n) { return { id: n.id }; }), links = g.edges.map(function (e) { return { source: e.from, target: e.to }; });
    var sim = F.forceSimulation(nodes).force('link', F.forceLink(links).id(function (d) { return d.id; }).distance(30)).force('charge', F.forceManyBody().strength(-30)).force('center', F.forceCenter(0, 0)).stop();
    var ticks = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())); for (var i = 0; i < ticks; i++) sim.tick();
    var pos = new Map(); nodes.forEach(function (n) { pos.set(n.id, [n.x, n.y]); }); return { ms: now() - t0, pos: pos, ticks: ticks };
  }
  async function layoutStep() {
    var s = addSection('Network layout: who draws a truer map, and how fast?');
    var sizes = QUICK ? [500, 1500] : [1000, 3000, 10000];
    var t = s.table('Time to lay out the network (lower is better) and truth score (lower is truer)', ['Items', 'Netflow Stress: time', 'truth', 'Netflow Force: time', 'truth', 'D3 force: time', 'truth', 'Netflow Map faster by (higher is better)']);
    var fasterN = 0, truerN = 0, ratios = [], i;
    for (i = 0; i < sizes.length; i++) {
      var n = sizes[i]; setStatus('Layout, ' + n.toLocaleString() + ' items: Netflow Map Stress…'); await yieldUI();
      var g = GEN.graph('moderate', n, 11), P = piece(g), a = netflowLayout(g, 'stress'); await yieldUI(); setStatus('Layout, ' + n.toLocaleString() + ' items: Netflow Map Force…');
      var b = netflowLayout(g, 'force'); await yieldUI(); setStatus('Layout, ' + n.toLocaleString() + ' items: D3 force (this one is slow)…'); await yieldUI();
      var d = d3Layout(g), Xa = packX(P, a.pos), Xb = packX(P, b.pos), Xd = packX(P, d.pos), ta = truth(P, Xa), tb = truth(P, Xb), td = truth(P, Xd);
      var bestMs = Math.min(a.ms, b.ms), ratio = d.ms / bestMs; ratios.push(ratio); if (ratio > 1) fasterN++; if (Math.min(ta, tb) <= td) truerN++;
      t.add([n.toLocaleString(), a.ms < b.ms ? win(fmtMs(a.ms)) : fmtMs(a.ms), ta <= Math.min(tb, td) ? win(String(r3(ta))) : String(r3(ta)), b.ms < a.ms ? win(fmtMs(b.ms)) : fmtMs(b.ms), tb <= Math.min(ta, td) ? win(String(r3(tb))) : String(r3(tb)), fmtMs(d.ms), td <= Math.min(ta, tb) ? win(String(r3(td))) : String(r3(td)), r1(ratio) + '×']);
      ctx.layouts[n] = { g: g, L: a.L, pos: a.pos, P: P };
      if (i === sizes.length - 1 || (i === 1 && sizes.length > 2)) { scatter(s, Xa, P.k, n.toLocaleString() + ' items: Netflow Map Stress'); scatter(s, Xb, P.k, n.toLocaleString() + ' items: Netflow Map Force'); scatter(s, Xd, P.k, n.toLocaleString() + ' items: D3 force'); }
      doneSteps += 1 / sizes.length * 0.9; setBar();
    }
    var level = fasterN === sizes.length && truerN === sizes.length ? 'ok' : fasterN === sizes.length ? 'warn' : 'bad';
    s.notes.push('Same network for all three (about 3 links per item, planted groups, seed 11). D3 settings: link distance 30, charge -30, centered, run until the simulation cools (about 300 steps). Netflow Map times are whole builds (analysis, arrangement, clean-up so no two items touch); D3 times are the layout only, with nothing removed from overlap. Truth uses the largest connected piece. A bold cell is the best in its row.');
    s.finish(level, 'Netflow Map\'s faster arrangement was faster than D3 in ' + fasterN + ' of ' + sizes.length + ' sizes (middle ' + r1(med(ratios)) + '×, higher is better) and as true or truer in ' + truerN + ' of ' + sizes.length + ' (truth: lower is truer).');
    return s;
  }

  /* ------------------------------------------------------------- 2. flow layout (Sankey-like) */
  function dag(n, seed) {   /* items in order; every item after the first gets one or two links from an earlier item (within 40 places) */
    var r = GEN.rng(seed), nodes = [], edges = [], seen = new Set(), i, per = Math.max(10, Math.ceil(n / 12));
    for (i = 0; i < n; i++) nodes.push({ id: 'n' + i, label: 'n' + i, group: 'g' + Math.floor(i / per), valence: '', ghost: false, attrs: {} });
    function add(a, b) { var k = a + '>' + b; if (a === b || seen.has(k)) return; seen.add(k); edges.push({ from: 'n' + a, to: 'n' + b, label: '', kind: '', weight: 1 + Math.floor(r() * 5), attrs: {} }); }
    for (i = 1; i < n; i++) { add(Math.max(0, i - 1 - Math.floor(r() * Math.min(i, 40))), i); if (r() < 1.1 / 2) add(Math.max(0, i - 1 - Math.floor(r() * Math.min(i, 40))), i); }
    return { name: 'dag ' + n, start: 'n0', nodes: nodes, edges: edges };
  }
  /** Crossings when every link is a straight line between its two item centers; links that share an item never count. */
  function crossings(cx, cy, A, B) {
    var m = A.length, c = 0, i, j;
    function side(ax, ay, bx, by, px, py) { var v = (bx - ax) * (py - ay) - (by - ay) * (px - ax); return v > 0 ? 1 : v < 0 ? -1 : 0; }
    for (i = 0; i < m; i++) {
      var a = A[i], b = B[i], ax = cx[a], ay = cy[a], bx = cx[b], by = cy[b], lo = Math.min(ax, bx), hi = Math.max(ax, bx);
      for (j = i + 1; j < m; j++) {
        var p = A[j], q = B[j]; if (p === a || p === b || q === a || q === b) continue;
        var px = cx[p], py = cy[p], qx = cx[q], qy = cy[q]; if (Math.max(px, qx) < lo || Math.min(px, qx) > hi) continue;
        if (side(ax, ay, bx, by, px, py) * side(ax, ay, bx, by, qx, qy) < 0 && side(px, py, qx, qy, ax, ay) * side(px, py, qx, qy, bx, by) < 0) c++;
      }
    }
    return c;
  }
  async function flowStep() {
    var s = addSection('Flow layout (Sankey-style): speed and crossings');
    var sizes = QUICK ? [100, 400] : [100, 400, 1500];
    var t = s.table('Time (lower is better) and link crossings (lower is better)', ['Items', 'Links', 'Netflow Flow: time', 'crossings', 'd3-sankey: time', 'crossings', 'Netflow Map faster by (higher is better)']);
    var fasterN = 0, fewerN = 0, ratios = [], i;
    for (i = 0; i < sizes.length; i++) {
      var n = sizes[i]; setStatus('Flow layout, ' + n.toLocaleString() + ' items…'); await yieldUI();
      var g = dag(n, 5), idx = new Map(); g.nodes.forEach(function (nd, q) { idx.set(nd.id, q); });
      var dg = C.derive(clone(g)), t0 = now(), F = E.build(dg, { view: 'flow', colorBy: 'group' }), msN = now() - t0;
      var fx = new Float64Array(n), fy = new Float64Array(n), FA = [], FB = []; F.nodes.forEach(function (nd) { var q = idx.get(nd.nodeId || nd.id); fx[q] = nd.x + nd.w / 2; fy[q] = nd.y + nd.h / 2; }); F.edges.forEach(function (e) { FA.push(idx.get(e.from)); FB.push(idx.get(e.to)); });
      var cN = crossings(fx, fy, FA, FB); await yieldUI();
      var d3err = null, msD = 0, cD = null;
      try {
        t0 = now(); var nodes = g.nodes.map(function (nd) { return { name: nd.id }; }), links = g.edges.map(function (e) { return { source: idx.get(e.from), target: idx.get(e.to), value: e.weight }; });
        var out = D3.d3sankey.sankey().nodeWidth(15).nodePadding(8).extent([[0, 0], [1000, Math.max(500, n * 4)]])({ nodes: nodes, links: links }); msD = now() - t0;
        var dx = new Float64Array(n), dy = new Float64Array(n), DA = [], DB = []; out.nodes.forEach(function (nd, q) { dx[q] = (nd.x0 + nd.x1) / 2; dy[q] = (nd.y0 + nd.y1) / 2; }); out.links.forEach(function (l) { DA.push(l.source.index); DB.push(l.target.index); });
        cD = crossings(dx, dy, DA, DB);
      } catch (e) { d3err = String(e && e.message || e).slice(0, 60); }
      var ratio = d3err ? null : msD / msN;
      if (ratio !== null) { ratios.push(ratio); if (ratio > 1) fasterN++; if (cN <= cD) fewerN++; }
      t.add([n.toLocaleString(), g.edges.length.toLocaleString(), msN < msD || d3err ? win(fmtMs(msN)) : fmtMs(msN), d3err || cN <= cD ? win(cN.toLocaleString()) : cN.toLocaleString(), d3err ? 'failed: ' + d3err : fmtMs(msD), d3err ? '-' : cD <= cN ? win(cD.toLocaleString()) : cD.toLocaleString(), ratio === null ? '-' : r1(ratio) + '×']);
      doneSteps += 1 / sizes.length * 0.9; setBar();
    }
    var okN = ratios.length, level = fasterN === okN && fewerN === okN ? 'ok' : fasterN === okN ? 'warn' : 'bad';
    s.notes.push('Random layered data with no loops (d3-sankey cannot take loops; Netflow Map can). Crossings are counted the same way for both: straight lines between item centers. Netflow Map\'s time includes extra work D3 does not do (choke points, scores, loop handling), and the engine drops items with no links. Older measurements (docs/RESEARCH-open-source-comparison.md) found more crossings than dagre and ELK at 400 items; this table is the first against d3-sankey.');
    s.finish(level, 'Netflow Map was faster than d3-sankey in ' + fasterN + ' of ' + okN + ' sizes (middle ' + r1(med(ratios)) + '×, higher is better) and drew fewer or equal crossings in ' + fewerN + ' of ' + okN + ' (lower is better).');
    return s;
  }

  /* ------------------------------------------------------------- 3. drawing: pan and zoom, frame by frame */
  var PAL = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#2f6f9f', '#c4581e'];
  var DW = 720, DH = 420;
  /** Runs a motion for about `ms` milliseconds (at most `maxFrames`), one step per screen refresh; returns the gaps between refreshes and the time spent in the step itself. */
  async function animate(step, ms, maxFrames) {
    var gaps = [], own = [], last = 0, f = 0, t0 = 0, warm = 4;
    return new Promise(function (resolve) {
      var tick = function (ts) {
        var u = now(); step(f++); var o = now() - u;
        if (f > warm) { if (!t0) t0 = ts; if (last) { gaps.push(ts - last); } own.push(o); }
        last = ts;
        if ((t0 && ts - t0 >= ms) || gaps.length >= maxFrames || f > warm + maxFrames + 5) return resolve({ gaps: gaps, own: own, ms: t0 ? ts - t0 : 0 });
        requestAnimationFrame(tick);
      }; requestAnimationFrame(tick);
    });
  }
  function motion(f) { var tt = f / 90, z = 1 + 0.6 * (1 - Math.cos(2 * Math.PI * tt)) / 2; return { z: z, px: 40 * Math.sin(2 * Math.PI * tt * 2), py: 24 * Math.cos(2 * Math.PI * tt * 2) }; }
  function stats(r, box) { var m = med(r.gaps); return { frames: r.gaps.length, fps: r.gaps.length && r.ms ? r.gaps.length / r.ms * 1000 : 0, median: m, p95: pct(r.gaps, 0.95), worst: r.gaps.length ? Math.max.apply(null, r.gaps) : 0, own: med(r.own), seen: box ? inView(box) : true }; }
  function fitted(entry) {   /* item positions of the Stress layout, scaled to fit the box */
    var ids = entry.g.nodes.map(function (nd) { return nd.id; }), x0 = 1e30, x1 = -1e30, y0 = 1e30, y1 = -1e30;
    ids.forEach(function (id) { var p = entry.pos.get(id); if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    var sc = 0.94 * Math.min(DW / Math.max(1e-9, x1 - x0), DH / Math.max(1e-9, y1 - y0)), ox = (DW - sc * (x1 - x0)) / 2, oy = (DH - sc * (y1 - y0)) / 2, idx = new Map(), N = ids.length, X = new Float64Array(N), Y = new Float64Array(N), G = new Uint8Array(N);
    ids.forEach(function (id, q) { var p = entry.pos.get(id); X[q] = ox + sc * (p[0] - x0); Y[q] = oy + sc * (p[1] - y0); idx.set(id, q); G[q] = (parseInt(entry.g.nodes[q].group.slice(1), 10) || 0) % PAL.length; });
    var A = [], B = []; entry.g.edges.forEach(function (e) { var a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined) { A.push(a); B.push(b); } });
    return { N: N, X: X, Y: Y, G: G, A: A, B: B };
  }
  function makeBox(s) { s.host.textContent = ''; var b = document.createElement('div'); b.style.cssText = 'position:relative;width:' + DW + 'px;max-width:100%;height:' + DH + 'px;overflow:hidden;border:1px solid var(--line);border-radius:8px;background:#fff'; s.host.appendChild(b); b.scrollIntoView({ block: 'center' }); return b; }   /* a browser skips painting what is off screen, so every test box is scrolled into view first */
  function inView(b) { var r = b.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && !document.hidden; }
  async function drawD3Svg(s, F) {
    var box = makeBox(s), t0 = now(), svg = D3.select(box).append('svg').attr('width', DW).attr('height', DH), g = svg.append('g');
    g.selectAll('line').data(F.A).join('line').attr('x1', function (a) { return F.X[a]; }).attr('y1', function (a) { return F.Y[a]; }).attr('x2', function (a, i) { return F.X[F.B[i]]; }).attr('y2', function (a, i) { return F.Y[F.B[i]]; }).attr('stroke', 'rgba(110,110,110,.35)').attr('stroke-width', 0.6);
    var idxs = new Array(F.N); for (var q = 0; q < F.N; q++) idxs[q] = q;
    g.selectAll('circle').data(idxs).join('circle').attr('cx', function (d) { return F.X[d]; }).attr('cy', function (d) { return F.Y[d]; }).attr('r', 2.5).attr('fill', function (d) { return PAL[F.G[d]]; });
    await nextFrame(); await nextFrame(); var build = now() - t0, gn = g.node();
    var r = await animate(function (f) { var m = motion(f); gn.setAttribute('transform', 'translate(' + (DW / 2 * (1 - m.z) + m.px) + ',' + (DH / 2 * (1 - m.z) + m.py) + ') scale(' + m.z + ')'); }, 2500, 150);
    var st = stats(r, box); box.remove(); st.build = build; return st;
  }
  async function drawD3Canvas(s, F) {
    var box = makeBox(s), cv = document.createElement('canvas'); cv.width = DW; cv.height = DH; cv.style.cssText = 'width:' + DW + 'px;height:' + DH + 'px;display:block'; box.appendChild(cv); var g = cv.getContext('2d'), t0 = now(), i;
    var byGroup = PAL.map(function () { return []; }); for (i = 0; i < F.N; i++) byGroup[F.G[i]].push(i);
    function draw(m) {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, DW, DH); g.setTransform(m.z, 0, 0, m.z, DW / 2 * (1 - m.z) + m.px, DH / 2 * (1 - m.z) + m.py);
      g.beginPath(); for (var e = 0; e < F.A.length; e++) { g.moveTo(F.X[F.A[e]], F.Y[F.A[e]]); g.lineTo(F.X[F.B[e]], F.Y[F.B[e]]); } g.strokeStyle = 'rgba(110,110,110,.35)'; g.lineWidth = 0.6 / m.z; g.stroke();
      for (var k = 0; k < PAL.length; k++) { var L = byGroup[k]; if (!L.length) continue; g.beginPath(); for (var q = 0; q < L.length; q++) { var p = L[q]; g.moveTo(F.X[p] + 2.5, F.Y[p]); g.arc(F.X[p], F.Y[p], 2.5, 0, 6.2832); } g.fillStyle = PAL[k]; g.fill(); }
    }
    draw(motion(0)); await nextFrame(); await nextFrame(); var build = now() - t0;
    var r = await animate(function (f) { draw(motion(f)); }, 2500, 150); var st = stats(r, box); box.remove(); st.build = build; return st;
  }
  async function drawNetflow(s, entry, backend) {
    var box = makeBox(s), t0 = now(), mk = backend === 'webgl2' ? NFMRender.createWebGL2 : NFMRender.createCanvas2D, r;
    try { r = await mk(box, {}); } catch (e) { box.remove(); return { error: String(e && e.message || e).slice(0, 60) }; }
    var dark = 'light', sc = NFMScene.make(entry.L, { plan: {}, colorBy: 'group', theme: dark }); r.resize(DW, DH, 1); r.setScene(sc); var v0 = NFMProbe.fitView(sc, DW, DH);
    function draw(m) { var v = { k: v0.k * m.z, tx: DW / 2 - (DW / 2 - v0.tx) * m.z + m.px, ty: DH / 2 - (DH / 2 - v0.ty) * m.z + m.py }; r.draw(v); }
    draw(motion(0)); await nextFrame(); await nextFrame(); var build = now() - t0;
    var res = await animate(function (f) { draw(motion(f)); }, 2500, 150); var st = stats(res, box); try { r.destroy(); } catch (e) { /* gone */ } box.remove(); st.build = build; return st;
  }
  async function drawStep() {
    var s = addSection('Drawing: pan and zoom, frame by frame'), sizes = Object.keys(ctx.layouts).map(Number).sort(function (a, b) { return a - b; });
    var T1 = s.table('Pictures per second while panning and zooming (higher is better; your screen\'s refresh rate is the ceiling)', ['Items', 'D3 SVG', 'D3 canvas', 'Netflow Map (WebGL 2)', 'Netflow Map (basic canvas)']);
    var T2 = s.table('Slowest 1 in 20 pictures, in milliseconds (lower is better)', ['Items', 'D3 SVG', 'D3 canvas', 'Netflow Map (WebGL 2)', 'Netflow Map (basic canvas)']);
    var T3 = s.table('Time until the first picture is on screen, in milliseconds (lower is better)', ['Items', 'D3 SVG', 'D3 canvas', 'Netflow Map (WebGL 2)', 'Netflow Map (basic canvas)']);
    var wins = 0, tried = 0, winsB = 0, triedB = 0, i;
    for (i = 0; i < sizes.length; i++) {
      var n = sizes[i], F = fitted(ctx.layouts[n]); setStatus('Drawing, ' + n.toLocaleString() + ' items: D3 SVG…'); await yieldUI();
      var a = await drawD3Svg(s, F); setStatus('Drawing, ' + n.toLocaleString() + ' items: D3 canvas…'); await yieldUI();
      var b = await drawD3Canvas(s, F); setStatus('Drawing, ' + n.toLocaleString() + ' items: Netflow Map, WebGL 2…'); await yieldUI();
      var c = await drawNetflow(s, ctx.layouts[n], 'webgl2'); setStatus('Drawing, ' + n.toLocaleString() + ' items: Netflow Map, basic canvas…'); await yieldUI();
      var d = await drawNetflow(s, ctx.layouts[n], 'canvas2d');
      var all = [a, b, c, d], best = -1, bestFps = 0; all.forEach(function (x, q) { if (!x.error && x.fps > bestFps * 1.0001) { bestFps = x.fps; best = q; } });
      var cell = function (x, f, q, key) { if (x.error) return 'not available'; var t = f(x); return q === best && key === 'fps' ? win(t) : t; };
      T1.add([n.toLocaleString()].concat(all.map(function (x, q) { return cell(x, function (v) { return String(r1(v.fps)); }, q, 'fps'); })));
      T2.add([n.toLocaleString()].concat(all.map(function (x, q) { return cell(x, function (v) { return String(Math.round(v.p95)); }, q, 'p95'); })));
      T3.add([n.toLocaleString()].concat(all.map(function (x, q) { return cell(x, function (v) { return String(Math.round(v.build)); }, q, 'build'); })));
      if (all.some(function (x) { return !x.error && !x.seen; })) s.notes.push('At ' + n.toLocaleString() + ' items the picture box was not on screen for at least one test (the tab was hidden or the window is too small), so that row may flatter the test that was not drawn. Run again with the tab in front.');
      ctx.draw = ctx.draw || {}; ctx.draw[n] = all; if (!c.error) { tried++; if (c.fps >= 0.95 * Math.max(a.fps, b.fps)) wins++; } if (!d.error) { triedB++; if (d.fps >= 0.95 * Math.max(a.fps, b.fps)) winsB++; }
      doneSteps += 1 / sizes.length * 0.9; setBar(); delete ctx.layouts[n].L;
    }
    s.notes.push('Same item positions (Netflow Map\'s Stress layout) in all four. D3 here draws only plain dots and thin lines; Netflow Map\'s picture also carries curved links, arrowheads, shapes and labels, so it does MORE work per picture, which favors D3. The D3 canvas draws all lines in one path and the dots grouped by color, the quick way a D3 canvas is usually written. The motion is a slow zoom-in-and-out with a small sway, 2.5 seconds per test.');
    if (tried) s.finish(wins === tried ? 'ok' : wins ? 'warn' : 'bad', 'Netflow Map (WebGL 2) came within 5% of the faster D3 drawing or beat it in ' + wins + ' of ' + tried + ' sizes (pictures per second, higher is better). Its basic canvas did so in ' + winsB + ' of ' + triedB + '.');
    else s.finish('warn', 'Netflow Map\'s WebGL 2 drawing could not start in this browser, so only its basic canvas was raced: it came within 5% of the faster D3 drawing or beat it in ' + winsB + ' of ' + triedB + ' sizes (pictures per second, higher is better).');
    return s;
  }

  /* ------------------------------------------------------------- results */
  function mdTable(head, rows) { return '| ' + head.join(' | ') + ' |\n|' + head.map(function (_, i) { return i ? '---:' : '---'; }).join('|') + '|\n' + rows.map(function (r) { return '| ' + r.map(function (c) { return c && c.win ? '**' + c.text + '**' : c; }).join(' | ') + ' |'; }).join('\n') + '\n'; }
  function buildMd(elapsed) {
    var out = '# Netflow Map against D3: results\n\nVersion ' + VERSION + '. Run ' + new Date().toISOString() + ' in ' + (navigator.userAgent || 'unknown browser') + '. Took ' + clockText(elapsed) + (QUICK ? ' (quick mode)' : '') + '. A bold cell is the best in its row.\n\n';
    sections.forEach(function (s) { out += '## ' + s.title + '\n\n' + s.verdict + '\n\n'; s.tables.forEach(function (t) { out += '**' + t.caption + '**\n\n' + mdTable(t.head, t.rows) + '\n'; }); s.notes.forEach(function (n) { out += '- ' + n + '\n'; }); out += '\n'; });
    return out;
  }
  function offerResults(md, elapsed) {
    $('done').style.display = ''; $('finalsay').textContent = 'Finished in ' + clockText(elapsed) + '. ' + sections.map(function (s) { return s.verdict; }).join(' ');
    $('dl').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = 'netflow-map-d3-race-results.md'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000); };
    $('cp').onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(md) : Promise.reject()).then(function () { $('cp').textContent = 'Copied'; }, function () { var ta = document.createElement('textarea'); ta.value = md; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* the file button is the way */ } ta.remove(); }); };
    window.__NFM_RACE_RESULT = { md: md, version: VERSION };
  }
  async function runAll() {
    if (running) return; running = true; $('go').disabled = true; sections = []; $('out').textContent = ''; $('done').style.display = 'none'; doneSteps = 0; ctx = { layouts: {} }; t0Run = now(); setBar();
    clearInterval(clockTimer); clockTimer = setInterval(function () { $('clock').textContent = '⏱ ' + clockText(now() - t0Run); }, 250);
    var steps = [['Network layout', layoutStep], ['Flow layout', flowStep], ['Drawing', drawStep]];
    for (var i = 0; i < steps.length; i++) {
      setStatus('Step ' + (i + 1) + ' of ' + steps.length + ': ' + steps[i][0] + '…'); await yieldUI();
      try { await steps[i][1](); } catch (e) { var s = sections[sections.length - 1]; if (!s || s.verdict) s = addSection(steps[i][0]); s.finish('bad', 'This step stopped with an error: ' + String(e && e.message || e)); }
      doneSteps = i + 1; setBar();
    }
    var el = now() - t0Run; clearInterval(clockTimer); $('clock').textContent = '⏱ ' + clockText(el) + ' total'; setStatus('Finished.'); offerResults(buildMd(el), el); running = false; $('go').disabled = false; $('go').textContent = 'Run again';
  }
  $('go').onclick = runAll;
  window.__NFM_RACE = { run: runAll };
  if (params.has('auto')) window.addEventListener('load', function () { setTimeout(runAll, 300); });
})();

/*!
 * Netflow Map engine: pure functions, no page, no DOM. Runs on the main thread or inside a worker.
 * Copyright (c) 2026 JNFoo. MIT License.
 *
 * Starts from the layered / arc / matrix / shape drawings, choke points, traffic and drawing scores of the Story Editor's
 * map (story-editor/editor/maplayout.js, MIT, copied and generalized; there is no dependency on it) and adds:
 *   - typed-array graph storage (compressed rows), so a big network is a few flat arrays
 *   - choke points as a dominator tree (Cooper-Harvey-Kennedy), same answers as the editor's remove-and-search rule, much faster
 *   - traffic in log space (no overflow on thousands of stacked split-and-rejoin diamonds)
 *   - exact odds and busyness from an absorbing Markov chain (no dice), plus seeded simulated players for "first" and "curious"
 *   - no recursion (the editor's depth-first walk overflowed on a chain of ~4,000 pages)
 *   - a stress-SGD "network" layout for data that is not a story, with overlap removal and component packing
 *   - quick groups by label propagation, for data that carries no group column
 */
var NFMEngine = (function () {
  'use strict';
  var MAP_W = 176, MAP_H = 56;
  var LN10 = Math.LN10;

  /* ---------------------------------------------------------------- small tools */
  function mulberry32(seed) {
    var s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lse(a, b) {
    if (a === -Infinity) return b;
    if (b === -Infinity) return a;
    return a > b ? a + Math.log1p(Math.exp(b - a)) : b + Math.log1p(Math.exp(a - b));
  }
  function now() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  /* ---------------------------------------------------------------- 1. the graph in flat arrays */
  /**
   * graph: { nodes: [{id, label, group, valence, attrs}], edges: [{from, to, label, weight, kind}], start }
   * opts:  block (ids taken out: "what if this page were gone"), hideKinds (edge kinds taken out), start, weights (bool)
   */
  function prepare(graph, opts) {
    opts = opts || {};
    var block = new Set(opts.block || []), hide = new Set(opts.hideKinds || []);
    var nodes = [], index = new Map();
    for (var i = 0; i < graph.nodes.length; i++) {
      var nd = graph.nodes[i];
      if (block.has(nd.id)) continue;
      index.set(nd.id, nodes.length);
      nodes.push(nd);
    }
    var n = nodes.length;
    var f = [], t = [], w = [], eo = [];
    for (var k = 0; k < graph.edges.length; k++) {
      var e = graph.edges[k];
      if (hide.has(e.kind || '')) continue;
      var a = index.get(e.from), b = index.get(e.to);
      if (a === undefined || b === undefined) continue;
      f.push(a); t.push(b); eo.push(k);
      var wt = Number(e.weight);
      w.push(opts.weights && isFinite(wt) && wt > 0 ? wt : 1);
    }
    var m = f.length;
    var P = {
      n: n, m: m, nodes: nodes, index: index,
      from: Int32Array.from(f), to: Int32Array.from(t), w: Float64Array.from(w), eorig: Int32Array.from(eo),
      outStart: new Int32Array(n + 1), outEdge: new Int32Array(m), inStart: new Int32Array(n + 1), inEdge: new Int32Array(m),
      valence: new Int8Array(n), edges: graph.edges
    };
    var i2;
    for (i2 = 0; i2 < m; i2++) { P.outStart[P.from[i2] + 1]++; P.inStart[P.to[i2] + 1]++; }
    for (i2 = 0; i2 < n; i2++) { P.outStart[i2 + 1] += P.outStart[i2]; P.inStart[i2 + 1] += P.inStart[i2]; }
    var oc = P.outStart.slice(0, n), ic = P.inStart.slice(0, n);
    for (i2 = 0; i2 < m; i2++) { P.outEdge[oc[P.from[i2]]++] = i2; P.inEdge[ic[P.to[i2]]++] = i2; }
    for (i2 = 0; i2 < n; i2++) {
      var v = nodes[i2].valence;
      P.valence[i2] = v === 'good' ? 1 : v === 'bad' ? 2 : v === 'neutral' ? 3 : 0;
    }
    var want = opts.start !== undefined && opts.start !== null ? opts.start : graph.start;
    P.start = index.has(want) ? index.get(want) : autoStart(P);
    P.autoStart = !index.has(want);
    return P;
  }
  function outdeg(P, v) { return P.outStart[v + 1] - P.outStart[v]; }
  function indeg(P, v) { return P.inStart[v + 1] - P.inStart[v]; }

  /** Breadth-first distances from `root` (never entering `skip`); -1 where not reached. */
  function bfs(P, root, skip) {
    var d = new Int32Array(P.n).fill(-1);
    if (root < 0 || root === skip || P.n === 0) return d;
    var q = new Int32Array(P.n), h = 0, tl = 0;
    q[tl++] = root; d[root] = 0;
    while (h < tl) {
      var v = q[h++];
      for (var k = P.outStart[v]; k < P.outStart[v + 1]; k++) {
        var w = P.to[P.outEdge[k]];
        if (w !== skip && d[w] < 0) { d[w] = d[v] + 1; q[tl++] = w; }
      }
    }
    return d;
  }
  /** The best place to start when the data does not say: a node nothing points to that reaches the most, else the busiest node. */
  function autoStart(P) {
    if (!P.n) return -1;
    var cands = [], i;
    for (i = 0; i < P.n; i++) {
      var inn = 0;
      for (var k = P.inStart[i]; k < P.inStart[i + 1]; k++) if (P.from[P.inEdge[k]] !== i) inn++;
      if (!inn && outdeg(P, i)) cands.push(i);
    }
    if (!cands.length) for (i = 0; i < P.n; i++) cands.push(i);
    cands.sort(function (a, b) { return outdeg(P, b) - outdeg(P, a) || a - b; });
    var best = cands[0], bestN = -1;
    for (i = 0; i < Math.min(cands.length, 40); i++) {
      var d = bfs(P, cands[i], -1), c = 0;
      for (var j = 0; j < P.n; j++) if (d[j] >= 0) c++;
      if (c > bestN) { bestN = c; best = cands[i]; }
    }
    return best;
  }

  /* ---------------------------------------------------------------- 2. choke points and traffic */
  /**
   * Goal: the nodes marked good; else terminals not marked bad; else every terminal; else the farthest nodes.
   * A choke point is a node every route from the start to the goal must pass: a strict dominator of a virtual sink that
   * every goal points to (Cooper, Harvey, Kennedy 2001). The start always counts.
   * Traffic: the share of all routes (loops dropped) through a node, kept as logs so it never overflows.
   */
  function importance(P) {
    var n = P.n, start = P.start, depth = bfs(P, start, -1);
    var res = { choke: new Uint8Array(n), traffic: new Float64Array(n), depth: depth, goal: [], goalKind: '', spine: [], routesLog10: 0, reached: 0 };
    if (start < 0) return res;
    var i, reached = [];
    for (i = 0; i < n; i++) if (depth[i] >= 0) reached.push(i);
    res.reached = reached.length;
    var term = function (v) { return outdeg(P, v) === 0; };
    var goal = reached.filter(function (v) { return P.valence[v] === 1; });
    res.goalKind = 'marked good';
    if (!goal.length) { goal = reached.filter(function (v) { return term(v) && P.valence[v] !== 2; }); res.goalKind = 'ends'; }
    if (!goal.length) { goal = reached.filter(term); res.goalKind = 'all ends'; }
    if (!goal.length) {
      var md = 0;
      reached.forEach(function (v) { if (depth[v] > md) md = depth[v]; });
      goal = reached.filter(function (v) { return depth[v] === md; });
      res.goalKind = 'farthest nodes';
    }
    res.goal = goal;
    res.choke[start] = 1;
    /* --- dominators of the sink S (index n), iterative, no recursion --- */
    var S = n, isGoal = new Uint8Array(n + 1);
    goal.forEach(function (v) { isGoal[v] = 1; });
    var seen = new Uint8Array(n + 1), stack = new Int32Array(n + 2), it = new Int32Array(n + 1), po = new Int32Array(n + 1).fill(-1), order = [];
    var sp = 0; stack[sp++] = start; seen[start] = 1;
    while (sp) {
      var v = stack[sp - 1], od = v === S ? 0 : outdeg(P, v), deg = od + (v !== S && isGoal[v] ? 1 : 0), kk = it[v];
      if (kk < deg) {
        it[v]++;
        var w = kk < od ? P.to[P.outEdge[P.outStart[v] + kk]] : S;
        if (!seen[w]) { seen[w] = 1; stack[sp++] = w; }
      } else { po[v] = order.length; order.push(v); sp--; }
    }
    var idom = new Int32Array(n + 1).fill(-1);
    idom[start] = start;
    var preds = function (b, cb) {
      if (b === S) { for (var q = 0; q < goal.length; q++) cb(goal[q]); return; }
      for (var q2 = P.inStart[b]; q2 < P.inStart[b + 1]; q2++) cb(P.from[P.inEdge[q2]]);
    };
    var changed = true, guard = 0;
    while (changed && guard++ < 60) {
      changed = false;
      for (var oi = order.length - 1; oi >= 0; oi--) {
        var b = order[oi];
        if (b === start) continue;
        var ni = -1;
        preds(b, function (p) {
          if (!seen[p] || idom[p] < 0) return;
          if (ni < 0) { ni = p; return; }
          var x = p, y = ni;
          while (x !== y) {
            while (po[x] < po[y]) x = idom[x];
            while (po[y] < po[x]) y = idom[y];
          }
          ni = x;
        });
        if (ni !== idom[b]) { idom[b] = ni; changed = true; }
      }
    }
    if (seen[S] && idom[S] >= 0) {
      var x2 = idom[S], hops = 0;
      while (x2 !== start && x2 >= 0 && x2 < n && hops++ <= n) { res.choke[x2] = 1; x2 = idom[x2]; }
    }
    res.spine = reached.filter(function (v) { return res.choke[v]; }).sort(function (a, b) { return depth[a] - depth[b] || a - b; });
    /* --- traffic: drop arrows that loop back (iterative depth-first), then count routes in log space --- */
    var state = new Uint8Array(n), keep = new Uint8Array(P.m), post = [];
    sp = 0; it = new Int32Array(n); stack = new Int32Array(n + 1);
    stack[sp++] = start; state[start] = 1;
    while (sp) {
      var v2 = stack[sp - 1], k2 = it[v2];
      if (k2 < outdeg(P, v2)) {
        it[v2]++;
        var e = P.outEdge[P.outStart[v2] + k2], w2 = P.to[e];
        if (state[w2] === 1) continue;
        keep[e] = 1;
        if (!state[w2]) { state[w2] = 1; stack[sp++] = w2; }
      } else { state[v2] = 2; post.push(v2); sp--; }
    }
    var lin = new Float64Array(n).fill(-Infinity), lout = new Float64Array(n).fill(-Infinity), pi, pv, pk;
    lin[start] = 0;
    for (pi = post.length - 1; pi >= 0; pi--) {
      pv = post[pi];
      for (pk = P.outStart[pv]; pk < P.outStart[pv + 1]; pk++) {
        var ee = P.outEdge[pk];
        if (keep[ee]) lin[P.to[ee]] = lse(lin[P.to[ee]], lin[pv]);
      }
    }
    for (pi = 0; pi < post.length; pi++) {
      pv = post[pi];
      var acc = -Infinity, any = false;
      for (pk = P.outStart[pv]; pk < P.outStart[pv + 1]; pk++) {
        var e3 = P.outEdge[pk];
        if (keep[e3]) { any = true; acc = lse(acc, lout[P.to[e3]]); }
      }
      lout[pv] = any ? acc : 0;
    }
    var mx = -Infinity;
    post.forEach(function (v3) { var s = lin[v3] + lout[v3]; if (s > mx) mx = s; });
    post.forEach(function (v3) { res.traffic[v3] = isFinite(mx) ? Math.exp(lin[v3] + lout[v3] - mx) : 0; });
    res.routesLog10 = isFinite(lout[start]) ? lout[start] / LN10 : 0;
    return res;
  }

  /* ---------------------------------------------------------------- 3. simulated players */
  /**
   * Exact: a random walker who picks among a node's arrows equally (or by weight) is an absorbing Markov chain, so the odds of each
   * ending and the expected visits are computed, not sampled. Same 400-step cap as the editor's simulated players.
   * Returns per node: pGood/pBad/pNeutral (chance of that ending from here), visits (expected visits per player), and per arrow: moves.
   */
  function flowExact(P, imp, o) {
    o = o || {};
    var n = P.n, m = P.m, cap = o.cap || 400;
    var sumw = new Float64Array(n), p = new Float64Array(m), i, k, e;
    for (e = 0; e < m; e++) sumw[P.from[e]] += P.w[e];
    for (e = 0; e < m; e++) p[e] = P.w[e] / sumw[P.from[e]];
    var c = new Float64Array(n * 3);
    for (i = 0; i < n; i++) if (!outdeg(P, i)) c[i * 3 + (P.valence[i] === 1 ? 0 : P.valence[i] === 2 ? 1 : 2)] = 1;
    var ord = [];
    for (i = 0; i < n; i++) if (outdeg(P, i)) ord.push(i);
    ord.sort(function (a, b) { return imp.depth[b] - imp.depth[a] || a - b; });
    for (var sweep = 0; sweep < 500; sweep++) {
      var delta = 0;
      for (var oi = 0; oi < ord.length; oi++) {
        var v = ord[oi], a0 = 0, a1 = 0, a2 = 0;
        for (k = P.outStart[v]; k < P.outStart[v + 1]; k++) {
          e = P.outEdge[k];
          var t3 = P.to[e] * 3, pe = p[e];
          a0 += pe * c[t3]; a1 += pe * c[t3 + 1]; a2 += pe * c[t3 + 2];
        }
        var d = Math.abs(a0 - c[v * 3]) + Math.abs(a1 - c[v * 3 + 1]) + Math.abs(a2 - c[v * 3 + 2]);
        if (d > delta) delta = d;
        c[v * 3] = a0; c[v * 3 + 1] = a1; c[v * 3 + 2] = a2;
      }
      if (delta < 1e-12) break;
    }
    var visits = new Float64Array(n), moves = new Float64Array(m);
    var x = new Float64Array(n), y = new Float64Array(n), act = [P.start];
    if (P.start >= 0) x[P.start] = 1;
    for (var step = 0; step < cap && act.length && P.start >= 0; step++) {
      var nxt = [], mass = 0;
      for (var ai = 0; ai < act.length; ai++) {
        var u = act[ai], xu = x[u];
        x[u] = 0;
        visits[u] += xu;
        if (!outdeg(P, u)) continue;
        for (k = P.outStart[u]; k < P.outStart[u + 1]; k++) {
          e = P.outEdge[k];
          var w = P.to[e], flow = xu * p[e];
          moves[e] += flow;
          if (y[w] === 0) nxt.push(w);
          y[w] += flow; mass += flow;
        }
      }
      var tmp = x; x = y; y = tmp;
      act = nxt;
      if (mass < 1e-13) break;
    }
    var s = P.start >= 0 ? P.start * 3 : 0;
    var oc = { good: c[s], bad: c[s + 1], neutral: c[s + 2], stuck: 0 };
    oc.stuck = Math.max(0, 1 - oc.good - oc.bad - oc.neutral);
    var pg = new Float64Array(n), pb = new Float64Array(n), pn = new Float64Array(n);
    for (i = 0; i < n; i++) { pg[i] = c[i * 3]; pb[i] = c[i * 3 + 1]; pn[i] = c[i * 3 + 2]; }
    return { exact: true, runs: 1, visits: visits, moves: moves, pGood: pg, pBad: pb, pNeutral: pn, outcome: oc, mode: 'random' };
  }
  /** Seeded simulated players for the "first" (always the first arrow) and "curious" (prefers somewhere new) styles. */
  function flowSim(P, imp, o) {
    var runs = o.runs || 1000, mode = o.mode || 'random', cap = o.cap || 400, rnd = mulberry32(0x9e3779b9);
    var n = P.n, m = P.m, visits = new Float64Array(n), moves = new Float64Array(m), thr = new Float64Array(n * 3);
    var oc = { good: 0, bad: 0, neutral: 0, stuck: 0 }, seenAt = new Int32Array(n).fill(-1), seenCur = new Int32Array(n).fill(-1);
    if (P.start < 0) return { exact: false, runs: 0, visits: visits, moves: moves, pGood: thr.slice(0, n), pBad: thr.slice(0, n), pNeutral: thr.slice(0, n), outcome: oc, mode: mode };
    for (var r = 0; r < runs; r++) {
      var v = P.start, path = [v], step;
      seenCur[v] = r;
      var edgesTaken = [], kind = 3;
      for (step = 0; step < cap; step++) {
        var od = outdeg(P, v);
        if (!od) break;
        var pick;
        if (mode === 'first') pick = 0;
        else if (mode === 'curious') {
          var fresh = [];
          for (var q = 0; q < od; q++) if (seenCur[P.to[P.outEdge[P.outStart[v] + q]]] !== r) fresh.push(q);
          pick = fresh.length ? fresh[Math.floor(rnd() * fresh.length)] : Math.floor(rnd() * od);
        } else pick = Math.floor(rnd() * od);
        var e = P.outEdge[P.outStart[v] + pick];
        edgesTaken.push(e);
        v = P.to[e]; seenCur[v] = r;
        path.push(v);
      }
      kind = outdeg(P, v) ? 3 : P.valence[v] === 1 ? 0 : P.valence[v] === 2 ? 1 : 2;
      oc[kind === 0 ? 'good' : kind === 1 ? 'bad' : kind === 2 ? 'neutral' : 'stuck']++;
      for (var pi = 0; pi < path.length; pi++) {
        var u = path[pi];
        if (seenAt[u] !== r + runs) { seenAt[u] = r + runs; visits[u] += 1; thr[u * 3 + (kind === 3 ? 2 : kind)] += kind === 3 ? 0 : 1; }
      }
      for (var ei = 0; ei < edgesTaken.length; ei++) moves[edgesTaken[ei]] += 1;
    }
    var pg = new Float64Array(n), pb = new Float64Array(n), pn = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      var tot = visits[i] || 1;
      pg[i] = thr[i * 3] / tot; pb[i] = thr[i * 3 + 1] / tot; pn[i] = thr[i * 3 + 2] / tot;
      visits[i] = visits[i] / runs;
    }
    for (var e2 = 0; e2 < m; e2++) moves[e2] /= runs;
    oc.good /= runs; oc.bad /= runs; oc.neutral /= runs; oc.stuck /= runs;
    return { exact: false, runs: runs, visits: visits, moves: moves, pGood: pg, pBad: pb, pNeutral: pn, outcome: oc, mode: mode };
  }

  /* ---------------------------------------------------------------- 4. what to draw: runs folded, arrows merged */
  function mapGraph(P, imp, opts) {
    opts = opts || {};
    var n = P.n, i, k, e;
    var onlyNext = new Int32Array(n).fill(-1), onlyPrev = new Int32Array(n).fill(-1);
    for (i = 0; i < n; i++) {
      var first = -1, one = true;
      for (k = P.outStart[i]; k < P.outStart[i + 1]; k++) { var w = P.to[P.outEdge[k]]; if (first < 0) first = w; else if (w !== first) { one = false; break; } }
      if (one && first >= 0) onlyNext[i] = first;
      var f2 = -1, one2 = true;
      for (k = P.inStart[i]; k < P.inStart[i + 1]; k++) { var u = P.from[P.inEdge[k]]; if (f2 < 0) f2 = u; else if (u !== f2) { one2 = false; break; } }
      if (one2 && f2 >= 0) onlyPrev[i] = f2;
    }
    var chainNext = function (u) {
      var v = onlyNext[u];
      if (v < 0 || v === u || v === P.start || !outdeg(P, v) || !outdeg(P, u) || P.valence[v]) return -1;
      return onlyPrev[v] === u ? v : -1;
    };
    var hasPrev = new Uint8Array(n);
    for (i = 0; i < n; i++) { var cn = chainNext(i); if (cn >= 0) hasPrev[cn] = 1; }
    var runs = [], inRun = new Int32Array(n).fill(-1);
    for (i = 0; i < n; i++) {
      if (hasPrev[i] || i === P.start || imp.depth[i] < 0) continue;
      var run = [i], v2 = chainNext(i);
      while (v2 >= 0 && run.indexOf(v2) < 0 && run.length < 100000) { run.push(v2); v2 = chainNext(v2); }
      if (run.length >= 2) runs.push(run);
    }
    var runOf = new Int32Array(n).fill(-1);
    if (opts.fold) runs.forEach(function (run, ri) { if (!(opts.open && opts.open[run[0]])) run.forEach(function (id) { runOf[id] = ri; }); });
    var nodes = [], groupOf = new Array(n);
    for (i = 0; i < n; i++) {
      var ri2 = runOf[i];
      if (ri2 >= 0 && runs[ri2][0] !== i) continue;
      var node = ri2 >= 0 ? { id: 'run:' + i, pages: runs[ri2].slice(), run: true } : { id: 'n' + i, pages: [i], run: false };
      node.pages.forEach(function (pg) { groupOf[pg] = node.id; });
      nodes.push(node);
    }
    var edges = [], seen = new Map();
    for (e = 0; e < P.m; e++) {
      var a = groupOf[P.from[e]], b = groupOf[P.to[e]];
      if (a === b && P.from[e] !== P.to[e]) continue;
      var key = a + '>' + b;
      if (opts.merge && seen.has(key)) { seen.get(key).srcs.push(e); continue; }
      var ed = { from: a, to: b, srcs: [e] };
      seen.set(key, ed);
      edges.push(ed);
    }
    return { nodes: nodes, edges: edges, groupOf: groupOf, runs: runs, imp: imp };
  }

  /* ---------------------------------------------------------------- 5. the layered engine (Sugiyama-style) */
  function mapPlaceLine(want, w, gaps, lo) {
    var n = want.length, off = new Array(n);
    off[0] = 0;
    for (var i = 1; i < n; i++) off[i] = off[i - 1] + gaps[i - 1];
    var blocks = [];
    for (i = 0; i < n; i++) {
      blocks.push([w[i] * (want[i] - off[i]), w[i], 1]);
      while (blocks.length > 1) {
        var b = blocks[blocks.length - 1], a = blocks[blocks.length - 2];
        if (a[0] / a[1] <= b[0] / b[1]) break;
        blocks.pop(); a[0] += b[0]; a[1] += b[1]; a[2] += b[2];
      }
    }
    var out = new Array(n), at = 0, floor = lo === undefined ? -Infinity : lo;
    for (var bi = 0; bi < blocks.length; bi++) {
      var bl = blocks[bi], val = Math.max(bl[0] / bl[1], floor);
      for (var kk = 0; kk < bl[2]; kk++, at++) out[at] = val + off[at];
      floor = -Infinity;
    }
    if (lo !== undefined && out[0] < lo) { var dd = lo - out[0]; for (var q = 0; q < n; q++) out[q] += dd; }
    for (var z = 1; z < n; z++) if (out[z] < out[z - 1] + gaps[z - 1]) out[z] = out[z - 1] + gaps[z - 1];
    return out;
  }
  /** Crossings between two neighboring layers (Fenwick tree, n log n). */
  function mapCrossPairs(segs) {
    segs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var n = segs.length;
    if (n < 2) return 0;
    var lows = Array.from(new Set(segs.map(function (x) { return x[1]; }))).sort(function (x, y) { return x - y; });
    var idx = new Map(lows.map(function (v, i) { return [v, i + 1]; }));
    var tree = new Int32Array(lows.length + 2), c = 0, done = 0;
    for (var i = 0; i < n;) {
      var j = i;
      while (j < n && segs[j][0] === segs[i][0]) j++;
      for (var k = i; k < j; k++) {
        var q = 0;
        for (var t = idx.get(segs[k][1]); t > 0; t -= t & -t) q += tree[t];
        c += done - q;
      }
      for (k = i; k < j; k++) { for (var t2 = idx.get(segs[k][1]); t2 < tree.length; t2 += t2 & -t2) tree[t2]++; done++; }
      i = j;
    }
    return c;
  }

  /**
   * A layered drawing of G (boxes with w and h set). opts: dir 'LR'|'TB', root (box id), spine (hold choke boxes on one line),
   * lane (box -> number), prev ({boxId: 0-1 order from last time}), gapLayer, gapNode, maxVertices.
   */
  function layered(G, opts) {
    opts = opts || {};
    var dir = opts.dir || 'LR', LR = dir === 'LR';
    var byNode = {}, outs = {}, ins = {};
    G.nodes.forEach(function (n) { byNode[n.id] = n; outs[n.id] = []; ins[n.id] = []; });
    G.edges.forEach(function (e) { outs[e.from].push(e.to); ins[e.to].push(e.from); });
    var layer = {}, maxL = 0;
    var bfsFrom = function (r, base, loose) {
      if (layer[r] !== undefined) return;
      layer[r] = base; byNode[r].loose = loose;
      var q = [r];
      for (var i = 0; i < q.length; i++) {
        var outl = outs[q[i]];
        for (var j = 0; j < outl.length; j++) {
          var w = outl[j];
          if (layer[w] === undefined) { layer[w] = layer[q[i]] + 1; byNode[w].loose = loose; q.push(w); }
        }
      }
      q.forEach(function (id) { if (layer[id] > maxL) maxL = layer[id]; });
    };
    if (opts.root && byNode[opts.root]) bfsFrom(opts.root, 0, false);
    G.nodes.forEach(function (n) {
      if (layer[n.id] === undefined && !ins[n.id].some(function (f) { return layer[f] === undefined && f !== n.id; })) bfsFrom(n.id, maxL + 1, true);
    });
    G.nodes.forEach(function (n) { if (layer[n.id] === undefined) bfsFrom(n.id, maxL + 1, true); });
    var dummies = 0;
    G.edges.forEach(function (e) { var s = Math.abs(layer[e.to] - layer[e.from]); if (s > 1) dummies += s - 1; });
    if (dummies + G.nodes.length > (opts.maxVertices || 90000)) {
      var err = new Error('too big for a layered drawing (' + (dummies + G.nodes.length) + ' stops); use the Network view or filter first');
      err.tooBig = true;
      throw err;
    }
    var L = [], vert = [];
    var addV = function (rec, k) { rec.layer = k; rec.idx = vert.length; vert.push(rec); (L[k] = L[k] || []).push(rec); return rec; };
    G.nodes.forEach(function (n) { n.v = addV({ id: n.id, node: n, dummy: false }, layer[n.id]); });
    var links = [];
    G.edges.forEach(function (e) {
      var a = byNode[e.from], b = byNode[e.to], la = layer[e.from], lb = layer[e.to];
      e.chain = [];
      if (e.from === e.to) { e.kind = 'self'; return; }
      if (la === lb) { e.kind = 'flat'; return; }
      e.kind = lb > la ? 'fwd' : 'back';
      var lo = Math.min(la, lb), hi = Math.max(la, lb), prevV = (lb > la ? a : b).v;
      for (var k = lo + 1; k < hi; k++) {
        var d = addV({ dummy: true, edge: e }, k);
        e.chain.push(d); links.push([prevV, d, prevV.dummy ? 8 : 2]); prevV = d;
      }
      links.push([prevV, (lb > la ? b : a).v, prevV.dummy ? 2 : 1]);
      if (e.kind === 'back') e.chain.reverse();
    });
    var up = vert.map(function () { return []; }), down = vert.map(function () { return []; });
    links.forEach(function (l) { down[l[0].idx].push([l[1], l[2]]); up[l[1].idx].push([l[0], l[2]]); });
    var nL = L.length;
    for (var k0 = 0; k0 < nL; k0++) L[k0] = L[k0] || [];
    /* depth-first rank without recursion */
    var dfsRank = {}, rank = 0, seenD = new Set();
    var visitFrom = function (r) {
      if (seenD.has(r)) return;
      var stack = [[r, 0]];
      seenD.add(r); dfsRank[r] = rank++;
      while (stack.length) {
        var top = stack[stack.length - 1], list = outs[top[0]];
        if (top[1] < list.length) {
          var w = list[top[1]++];
          if (!seenD.has(w)) { seenD.add(w); dfsRank[w] = rank++; stack.push([w, 0]); }
        } else stack.pop();
      }
    };
    if (opts.root && byNode[opts.root]) visitFrom(opts.root);
    G.nodes.forEach(function (n) { visitFrom(n.id); });
    var prev = opts.prev || {};
    var laneOfEdge = function (e) { return Math.min(opts.lane(byNode[e.from]), opts.lane(byNode[e.to])); };
    var laneOf = function (v) { return v.dummy ? (opts.lane ? laneOfEdge(v.edge) : 0) : opts.lane ? opts.lane(v.node) : 0; };
    var rn = Math.max(1, rank);
    L.forEach(function (list) {
      list.forEach(function (v) {
        v.key = v.dummy ? (dfsRank[v.edge.from] + dfsRank[v.edge.to]) / 2 / rn : (prev[v.id] !== undefined ? prev[v.id] : dfsRank[v.id] / rn);
      });
    });
    L.forEach(function (list) {
      list.sort(function (a, b) { return laneOf(a) - laneOf(b) || a.key - b.key; });
      list.forEach(function (v, i) { v.pos = i; });
    });
    var crossBetween = function (k) {
      var segs = [];
      L[k].forEach(function (u) { down[u.idx].forEach(function (d) { segs.push([u.pos, d[0].pos]); }); });
      return mapCrossPairs(segs);
    };
    var totalCross = function () { var c = 0; for (var k = 0; k + 1 < nL; k++) c += crossBetween(k); return c; };
    var snapshot = function () { return L.map(function (list) { return list.slice(); }); };
    var best = snapshot(), bestC = totalCross();
    var sweep = function (k, nb) {
      L[k].forEach(function (v) {
        var ns = nb[v.idx];
        v.bary = ns.length ? ns.reduce(function (s, o) { return s + o[0].pos; }, 0) / ns.length : v.pos;
      });
      L[k].sort(function (a, b) { return laneOf(a) - laneOf(b) || a.bary - b.bary || a.pos - b.pos; });
      L[k].forEach(function (v, i) { v.pos = i; });
    };
    var transpose = function (k) {
      var improved = true, guard = 0;
      while (improved && guard++ < 8) {
        improved = false;
        for (var i = 0; i + 1 < L[k].length; i++) {
          var a = L[k][i], b = L[k][i + 1];
          if (laneOf(a) !== laneOf(b)) continue;
          var before = 0, after = 0;
          var tally = function (ea, eb) {
            for (var p = 0; p < ea.length; p++) for (var q = 0; q < eb.length; q++) {
              var x = ea[p][0].pos, y = eb[q][0].pos;
              if (x > y) before++; else if (x < y) after++;
            }
          };
          if (k + 1 < nL) tally(down[a.idx], down[b.idx]);
          if (k > 0) tally(up[a.idx], up[b.idx]);
          if (after < before) { a.pos = i + 1; b.pos = i; L[k][i] = b; L[k][i + 1] = a; improved = true; }
        }
      }
    };
    var big = vert.length > 600;
    for (var it = 0; it < (big ? 2 : 6) && bestC > 0; it++) {
      for (var k1 = 1; k1 < nL; k1++) sweep(k1, up);
      for (var k2 = nL - 2; k2 >= 0; k2--) sweep(k2, down);
      if (!big) for (var k3 = 0; k3 < nL; k3++) transpose(k3);
      var c = totalCross();
      if (c < bestC) { bestC = c; best = snapshot(); }
    }
    best.forEach(function (list, k) { L[k] = list; list.forEach(function (v, i) { v.pos = i; }); });
    var across = function (v) { return v.dummy ? 0 : LR ? v.node.h : v.node.w; };
    var gapN = opts.gapNode !== undefined ? opts.gapNode : LR ? 22 : 28, gapD = 12;
    var gapOf = function (a, b) { return (across(a) + across(b)) / 2 + (a.dummy || b.dummy ? gapD : gapN) + (opts.lane && laneOf(a) !== laneOf(b) ? 40 : 0); };
    L.forEach(function (list) {
      var c2 = 0;
      list.forEach(function (v, i) { if (i) c2 += gapOf(list[i - 1], v); v.c = c2; });
    });
    var isChoke = function (v) { return !v.dummy && opts.spine && v.node.choke; };
    var placeLayer = function (list, nb) {
      if (!list.length) return;
      var want = [], wt = [], gaps = [];
      list.forEach(function (v, i) {
        var ns = nb[v.idx], s = 0, sw = 0;
        ns.forEach(function (o) { s += o[0].c * o[1]; sw += o[1]; });
        if (isChoke(v)) { want.push(0); wt.push(1000); }
        else { want.push(sw ? s / sw : v.c); wt.push(sw ? sw + (v.dummy ? 2 : 0) : 0.2); }
        if (i) gaps.push(gapOf(list[i - 1], v));
      });
      var xs = mapPlaceLine(want, wt, gaps);
      list.forEach(function (v, i) { v.c = xs[i]; });
    };
    var both = vert.map(function (_, i) { return up[i].concat(down[i]); });
    for (var it2 = 0; it2 < (big ? 3 : 8); it2++) {
      for (var k4 = 1; k4 < nL; k4++) placeLayer(L[k4], it2 % 3 === 2 ? both : up);
      for (var k5 = nL - 2; k5 >= 0; k5--) placeLayer(L[k5], it2 % 3 === 2 ? both : down);
    }
    var lanes = [];
    if (opts.lane) {
      var ext = {};
      vert.forEach(function (v) {
        var ln = laneOf(v), lo = v.c - across(v) / 2, hi = v.c + across(v) / 2;
        ext[ln] = ext[ln] ? [Math.min(ext[ln][0], lo), Math.max(ext[ln][1], hi)] : [lo, hi];
      });
      var order = Object.keys(ext).map(Number).sort(function (a, b) { return a - b; }), shift = {}, at = 0;
      order.forEach(function (ln) {
        shift[ln] = at - ext[ln][0] + 28;
        lanes.push({ lane: ln, from: at, to: at + (ext[ln][1] - ext[ln][0]) + 56 });
        at += ext[ln][1] - ext[ln][0] + 56 + 16;
      });
      vert.forEach(function (v) { v.c += shift[laneOf(v)]; });
    }
    var gapL = opts.gapLayer !== undefined ? opts.gapLayer : LR ? 80 : 64, depthOf = [], at2 = 0;
    for (var k6 = 0; k6 < nL; k6++) {
      var mm = 0;
      L[k6].forEach(function (v) { if (!v.dummy) mm = Math.max(mm, LR ? v.node.w : v.node.h); });
      depthOf[k6] = [at2, mm || 20];
      at2 += (mm || 20) + gapL;
    }
    var minC = Infinity;
    vert.forEach(function (v) { minC = Math.min(minC, v.c - across(v) / 2); });
    if (!isFinite(minC)) minC = 0;
    var pad = 20;
    vert.forEach(function (v) {
      var dm = depthOf[v.layer], along = dm[0] + dm[1] / 2, acrossC = v.c - minC;
      if (v.dummy) { v.x = LR ? pad + along : pad + acrossC; v.y = LR ? pad + acrossC : pad + along; return; }
      var n = v.node;
      n.layer = v.layer;
      n.x = LR ? pad + along - n.w / 2 : pad + acrossC - n.w / 2;
      n.y = LR ? pad + acrossC - n.h / 2 : pad + along - n.h / 2;
    });
    lanes = lanes.map(function (l) { return { lane: l.lane, from: pad + l.from - minC, to: pad + l.to - minC }; });
    G.edges.forEach(function (e) { e.pts = e.chain.map(function (v) { return [v.x, v.y]; }); });
    var W = 0, H = 0;
    G.nodes.forEach(function (n) { W = Math.max(W, n.x + n.w); H = Math.max(H, n.y + n.h); });
    vert.forEach(function (v) { if (v.dummy) { W = Math.max(W, v.x); H = Math.max(H, v.y); } });
    if (lanes.length) { if (LR) H = Math.max(H, lanes[lanes.length - 1].to); else W = Math.max(W, lanes[lanes.length - 1].to); }
    var ord = {};
    L.forEach(function (list) { list.forEach(function (v) { if (!v.dummy) ord[v.id] = (v.pos + 0.5) / list.length; }); });
    var pos = {};
    G.nodes.forEach(function (n) { pos[n.id] = n; delete n.v; });
    G.edges.forEach(function (e) { delete e.chain; });
    return { kind: 'nodes', dir: dir, nodes: G.nodes, edges: G.edges, pos: pos, order: ord, lanes: lanes, width: W + pad + 60, height: H + pad + 30, crossings: bestC };
  }

  /* ---------------------------------------------------------------- 6. the other views */
  function arcLayout(G, base) {
    var nodes = G.nodes.slice().sort(function (a, b) { return a.layer - b.layer || (base.order[a.id] || 0) - (base.order[b.id] || 0); });
    var step = 34, pad = 40, maxSpan = 1, pos = {};
    nodes.forEach(function (n, i) { n.ai = i; pos[n.id] = n; });
    G.edges.forEach(function (e) { maxSpan = Math.max(maxSpan, Math.abs(pos[e.to].ai - pos[e.from].ai)); });
    var lift = Math.min((maxSpan * step) / 2, 520), y0 = pad + lift;
    nodes.forEach(function (n) { n.cx = pad + n.ai * step; n.cy = y0; });
    return { kind: 'arc', dir: 'LR', nodes: nodes, edges: G.edges, pos: pos, baseline: y0, width: pad * 2 + nodes.length * step, height: y0 + 190 };
  }
  function matrixLayout(G, base) {
    var nodes = G.nodes.slice().sort(function (a, b) { return a.layer - b.layer || (base.order[a.id] || 0) - (base.order[b.id] || 0); });
    var pos = {};
    nodes.forEach(function (n, i) { n.mi = i; pos[n.id] = n; });
    var cell = 18, head = 150;
    return { kind: 'matrix', dir: 'LR', nodes: nodes, edges: G.edges, pos: pos, cell: cell, head: head, width: head + nodes.length * cell + 150, height: head + nodes.length * cell + 30 };
  }
  /** Story shape: the stretches between choke points, each named by its pattern. */
  function shapeLayout(P, G) {
    var imp = G.imp, spine = imp.spine.slice(), n = P.n, i;
    var owner = new Int32Array(n).fill(-1);
    spine.forEach(function (c, si) {
      var without = bfs(P, P.start, c);
      for (i = 0; i < n; i++) if (i !== c && without[i] < 0 && imp.depth[i] >= 0) owner[i] = si;
    });
    spine.forEach(function (c, si) { owner[c] = si; });
    var isSpine = new Uint8Array(n);
    spine.forEach(function (c) { isSpine[c] = 1; });
    var segs = spine.map(function (c, si) { return { i: si, from: c, to: spine[si + 1] !== undefined ? spine[si + 1] : -1, pages: [], endings: { good: 0, bad: 0, neutral: 0 } }; });
    for (i = 0; i < n; i++) {
      if (imp.depth[i] < 0 || isSpine[i]) continue;
      var s = segs[owner[i] >= 0 ? owner[i] : 0];
      if (!s) continue;
      s.pages.push(i);
      if (!outdeg(P, i)) s.endings[P.valence[i] === 1 ? 'good' : P.valence[i] === 2 ? 'bad' : 'neutral']++;
    }
    segs.forEach(function (s) {
      var inside = new Set(s.pages.concat([s.from])), end = s.to, memo = new Map(), onPath = new Set();
      /* routes from this choke point to the next, loops ignored; iterative, counts kept as plain numbers capped at 1e15 */
      var count = function (root) {
        var stack = [[root, 0]], result = 0;
        var local = new Map();
        onPath.clear();
        onPath.add(root);
        var acc = new Map([[root, 0]]);
        while (stack.length) {
          var top = stack[stack.length - 1], v = top[0], lo = P.outStart[v], hi = P.outStart[v + 1];
          if (top[1] < hi - lo) {
            var w = P.to[P.outEdge[lo + top[1]++]];
            if (w === end) { acc.set(v, Math.min(1e15, acc.get(v) + 1)); continue; }
            if (!(inside.has(w) && w !== s.from)) continue;
            if (local.has(w)) { acc.set(v, Math.min(1e15, acc.get(v) + local.get(w))); continue; }
            if (onPath.has(w)) continue;
            onPath.add(w); acc.set(w, 0); stack.push([w, 0]);
          } else {
            stack.pop(); onPath.delete(v); local.set(v, acc.get(v));
            if (stack.length) { var pv = stack[stack.length - 1][0]; acc.set(pv, Math.min(1e15, acc.get(pv) + acc.get(v))); }
            else result = acc.get(v);
          }
        }
        return result;
      };
      s.routes = end >= 0 ? count(s.from) : 0;
      var loops = false;
      for (var e = 0; e < P.m && !loops; e++) {
        var a = P.from[e], b = P.to[e];
        if (inside.has(a) && inside.has(b) && imp.depth[b] <= imp.depth[a] && b !== end) loops = true;
      }
      s.loops = loops;
      var ends = s.endings.good + s.endings.bad + s.endings.neutral;
      var rest = s.pages.filter(function (id) { return outdeg(P, id) > 0; }).length;
      s.pattern = end < 0 ? (ends ? 'The finale' : 'Still open') : !rest ? 'Straight on' : s.routes <= 1 ? 'A straight road' : 'Branch and rejoin';
      if (end >= 0 && ends) s.pattern += ', with ' + ends + ' end' + (ends === 1 ? '' : 's') + ' off it';
      if (loops) s.pattern += ', with a loop';
      s.pages = s.pages.map(function (id) { return id; });
    });
    return { kind: 'shape', segs: segs, spine: spine, width: 0, height: 0 };
  }

  /* ---------------------------------------------------------------- 7. network layout (stress SGD) */
  /**
   * For data that is not a story: places nodes so that the distance on the page is close to the number of hops between them
   * (stress, minimized by stochastic gradient descent, Zheng, Pawar and Goodman 2018). Small graphs use every pair, large ones
   * use pivots. Components are laid out one by one and packed in rows. Seeded: same data, same picture.
   */
  function networkLayout(P, G, opts) {
    opts = opts || {};
    var nodes = G.nodes, nb = nodes.length, i, e;
    var idxOf = {};
    nodes.forEach(function (nd, k) { idxOf[nd.id] = k; });
    var adj = nodes.map(function () { return []; });
    G.edges.forEach(function (ed) {
      var a = idxOf[ed.from], b = idxOf[ed.to];
      if (a !== b) { adj[a].push(b); adj[b].push(a); }
    });
    var comp = new Int32Array(nb).fill(-1), comps = [];
    for (i = 0; i < nb; i++) {
      if (comp[i] >= 0) continue;
      var cid = comps.length, q = [i];
      comp[i] = cid;
      for (var h = 0; h < q.length; h++) adj[q[h]].forEach(function (w) { if (comp[w] < 0) { comp[w] = cid; q.push(w); } });
      comps.push(q);
    }
    var rnd = mulberry32(12345), EDGE = 130;
    var size = function (nd) { return 26 + Math.min(26, 8 * Math.sqrt((nd.traffic || 0))) + Math.min(14, Math.sqrt(adj[idxOf[nd.id]].length) * 3); };
    var packs = [];
    comps.forEach(function (members) {
      var k = members.length, loc = new Map();
      members.forEach(function (g, li) { loc.set(g, li); });
      var X = new Float64Array(k * 2);
      if (k === 1) { packs.push({ members: members, X: X, w: size(nodes[members[0]]) + 20, h: size(nodes[members[0]]) + 20 }); return; }
      /* start: a spiral in breadth-first order from the best-connected node, so neighbors begin close */
      var root = members.slice().sort(function (a, b) { return adj[b].length - adj[a].length || a - b; })[0];
      var seen = new Set([root]), order = [root];
      for (var oi = 0; oi < order.length; oi++) adj[order[oi]].forEach(function (w) { if (!seen.has(w)) { seen.add(w); order.push(w); } });
      order.forEach(function (g, r) { var a = r * 2.399963, rad = EDGE * 0.6 * Math.sqrt(r + 1); X[loc.get(g) * 2] = rad * Math.cos(a); X[loc.get(g) * 2 + 1] = rad * Math.sin(a); });
      /* hop distances: all pairs for small components, from pivots for large ones */
      var full = k <= 700, pivots;
      if (full) pivots = members.map(function (g) { return g; });
      else {
        pivots = [root];
        var minD = new Int32Array(k).fill(1e9);
        for (var pc = 1; pc < Math.min(120, k); pc++) {
          var last = pivots[pivots.length - 1], dl = hopFrom(last);
          var far = -1, fd = -1;
          members.forEach(function (g) { var li = loc.get(g); if (dl[li] < minD[li]) minD[li] = dl[li]; if (minD[li] > fd) { fd = minD[li]; far = g; } });
          pivots.push(far);
        }
      }
      function hopFrom(src) {
        var d = new Int32Array(k).fill(-1), qq = [src];
        d[loc.get(src)] = 0;
        for (var hh = 0; hh < qq.length; hh++) {
          var u = qq[hh];
          adj[u].forEach(function (w) { var lw = loc.get(w); if (d[lw] < 0) { d[lw] = d[loc.get(u)] + 1; qq.push(w); } });
        }
        return d;
      }
      var pairs = []; // [a, b, dist]
      var maxD = 1;
      pivots.forEach(function (pv, pi) {
        var d = hopFrom(pv), lp = loc.get(pv);
        members.forEach(function (g) {
          var lg = loc.get(g);
          if (lg === lp || (full && lg < lp)) return;
          if (d[lg] > maxD) maxD = d[lg];
          pairs.push([lp, lg, d[lg]]);
        });
      });
      var tmax = full ? 30 : 24, wMin = 1 / (maxD * maxD), etaMax = 1 / wMin, etaMin = 0.1, lambda = Math.log(etaMax / etaMin) / Math.max(1, tmax - 1);
      for (var t = 0; t < tmax; t++) {
        var eta = etaMax * Math.exp(-lambda * t);
        for (var pi2 = pairs.length - 1; pi2 > 0; pi2--) { var j = Math.floor(rnd() * (pi2 + 1)), tmp = pairs[pi2]; pairs[pi2] = pairs[j]; pairs[j] = tmp; }
        for (var pi3 = 0; pi3 < pairs.length; pi3++) {
          var pr = pairs[pi3], dij = pr[2] * EDGE, wij = 1 / (pr[2] * pr[2]), mu = Math.min(1, wij * eta);
          var a2 = pr[0] * 2, b2 = pr[1] * 2, dx = X[a2] - X[b2], dy = X[a2 + 1] - X[b2 + 1], mag = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          var r = (mu * (mag - dij)) / 2, rx = (r * dx) / mag, ry = (r * dy) / mag;
          X[a2] -= rx; X[a2 + 1] -= ry; X[b2] += rx; X[b2 + 1] += ry;
        }
      }
      /* push overlapping nodes apart (grid buckets, a few passes) */
      for (var pass = 0; pass < 30; pass++) {
        var cell = 90, grid = new Map(), moved = false;
        for (var li2 = 0; li2 < k; li2++) {
          var key = Math.floor(X[li2 * 2] / cell) + ',' + Math.floor(X[li2 * 2 + 1] / cell);
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push(li2);
        }
        for (var li3 = 0; li3 < k; li3++) {
          var cx = Math.floor(X[li3 * 2] / cell), cy = Math.floor(X[li3 * 2 + 1] / cell), ra = size(nodes[members[li3]]) / 2 + 8;
          for (var gx = cx - 1; gx <= cx + 1; gx++) for (var gy = cy - 1; gy <= cy + 1; gy++) {
            var lst = grid.get(gx + ',' + gy);
            if (!lst) continue;
            for (var lj = 0; lj < lst.length; lj++) {
              var o = lst[lj];
              if (o <= li3) continue;
              var rb = size(nodes[members[o]]) / 2 + 8, ddx = X[o * 2] - X[li3 * 2], ddy = X[o * 2 + 1] - X[li3 * 2 + 1], dd = Math.sqrt(ddx * ddx + ddy * ddy) || 0.01, need = ra + rb;
              if (dd < need) {
                var push = (need - dd) / 2, ux = ddx / dd || 1, uy = ddy / dd;
                X[li3 * 2] -= ux * push; X[li3 * 2 + 1] -= uy * push; X[o * 2] += ux * push; X[o * 2 + 1] += uy * push; moved = true;
              }
            }
          }
        }
        if (!moved) break;
      }
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (var li4 = 0; li4 < k; li4++) { var rr = size(nodes[members[li4]]) / 2; x0 = Math.min(x0, X[li4 * 2] - rr); x1 = Math.max(x1, X[li4 * 2] + rr); y0 = Math.min(y0, X[li4 * 2 + 1] - rr); y1 = Math.max(y1, X[li4 * 2 + 1] + rr); }
      for (var li5 = 0; li5 < k; li5++) { X[li5 * 2] -= x0; X[li5 * 2 + 1] -= y0; }
      packs.push({ members: members, X: X, w: x1 - x0 + 40, h: y1 - y0 + 40 });
    });
    /* pack the components in rows, biggest first, aiming at a wide picture */
    var sorted = packs.slice().sort(function (a, b) { return b.members.length - a.members.length; });
    var area = 0;
    sorted.forEach(function (p) { area += p.w * p.h; });
    var rowW = Math.max(sorted.length ? sorted[0].w : 0, Math.sqrt(area * 1.6)), cx2 = 0, cy2 = 0, rowH = 0, W = 0, H = 0;
    sorted.forEach(function (p) {
      if (cx2 > 0 && cx2 + p.w > rowW) { cx2 = 0; cy2 += rowH; rowH = 0; }
      for (var li = 0; li < p.members.length; li++) {
        var nd = nodes[p.members[li]], sz = size(nd);
        nd.w = nd.h = sz;
        nd.x = 20 + cx2 + p.X[li * 2] - sz / 2 + 20;
        nd.y = 20 + cy2 + p.X[li * 2 + 1] - sz / 2 + 20;
        nd.shape = 'dot';
        nd.layer = 0;
        nd.cx = nd.x + sz / 2; nd.cy = nd.y + sz / 2;
        W = Math.max(W, nd.x + sz); H = Math.max(H, nd.y + sz);
      }
      cx2 += p.w; rowH = Math.max(rowH, p.h);
    });
    var pos = {};
    nodes.forEach(function (nd) { pos[nd.id] = nd; });
    G.edges.forEach(function (ed) { ed.kind = ed.from === ed.to ? 'self' : 'fwd'; ed.pts = []; });
    return { kind: 'network', dir: 'none', nodes: nodes, edges: G.edges, pos: pos, order: {}, width: W + 60, height: H + 60, crossings: 0 };
  }

  /** Quick groups for data that has no group column: label propagation, deterministic. Returns group number per node (0 = biggest). */
  function communities(P) {
    var n = P.n, lab = new Int32Array(n), i, k;
    for (i = 0; i < n; i++) lab[i] = i;
    var order = [];
    for (i = 0; i < n; i++) order.push(i);
    order.sort(function (a, b) { return outdeg(P, b) + indeg(P, b) - outdeg(P, a) - indeg(P, a) || a - b; });
    var count = new Map();
    for (var sweep = 0; sweep < 20; sweep++) {
      var changed = 0;
      for (var oi = 0; oi < n; oi++) {
        var v = order[oi];
        count.clear();
        for (k = P.outStart[v]; k < P.outStart[v + 1]; k++) { var e = P.outEdge[k], w = P.to[e]; count.set(lab[w], (count.get(lab[w]) || 0) + P.w[e]); }
        for (k = P.inStart[v]; k < P.inStart[v + 1]; k++) { var e2 = P.inEdge[k], u = P.from[e2]; count.set(lab[u], (count.get(lab[u]) || 0) + P.w[e2]); }
        if (!count.size) continue;
        var bestL = lab[v], bestW = count.get(lab[v]) || 0;
        count.forEach(function (wt, l) { if (wt > bestW + 1e-12 || (Math.abs(wt - bestW) <= 1e-12 && l < bestL)) { bestW = wt; bestL = l; } });
        if (bestL !== lab[v]) { lab[v] = bestL; changed++; }
      }
      if (!changed) break;
    }
    var size = new Map();
    for (i = 0; i < n; i++) size.set(lab[i], (size.get(lab[i]) || 0) + 1);
    var ranked = Array.from(size.keys()).sort(function (a, b) { return size.get(b) - size.get(a) || a - b; });
    var rankOf = new Map(ranked.map(function (l, r) { return [l, r]; }));
    var out = new Int32Array(n);
    for (i = 0; i < n; i++) out[i] = rankOf.get(lab[i]);
    return out;
  }

  /* ---------------------------------------------------------------- 8. scoring a drawing */
  function segCross(a, b, c, d) {
    var o = function (p, q, r) { return Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); };
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  }
  function metrics(L, ms, cls, prevPos, quick) {
    var nodes = L.nodes, n = nodes.length, C = {};
    nodes.forEach(function (nd) { C[nd.id] = [nd.cx !== undefined ? nd.cx : nd.x + nd.w / 2, nd.cy !== undefined ? nd.cy : nd.y + nd.h / 2]; });
    var cross = 0, segs = [];
    if (L.kind === 'arc') {
      var side = function (e) { return L.pos[e.to].ai > L.pos[e.from].ai ? 1 : -1; };
      var iv = L.edges.filter(function (e) { return e.from !== e.to; }).map(function (e) { return [Math.min(L.pos[e.from].ai, L.pos[e.to].ai), Math.max(L.pos[e.from].ai, L.pos[e.to].ai), side(e)]; });
      if (iv.length <= 3000) for (var i = 0; i < iv.length; i++) for (var j = i + 1; j < iv.length; j++) {
        var a = iv[i][0], b = iv[i][1], s = iv[i][2], c2 = iv[j][0], d = iv[j][1], t = iv[j][2];
        if (s === t && ((a < c2 && c2 < b && b < d) || (c2 < a && a < d && d < b))) cross++;
      }
    } else if (L.kind !== 'matrix') {
      L.edges.forEach(function (e, ei) {
        if (e.from === e.to) return;
        var pts = [C[e.from]].concat(e.pts || [], [C[e.to]]);
        for (var q = 0; q + 1 < pts.length; q++) segs.push([pts[q], pts[q + 1], ei]);
      });
      if (segs.length <= 4000) {
        var box = segs.map(function (sg) { return [Math.min(sg[0][0], sg[1][0]), Math.max(sg[0][0], sg[1][0]), Math.min(sg[0][1], sg[1][1]), Math.max(sg[0][1], sg[1][1])]; });
        for (var x = 0; x < segs.length; x++) for (var y = x + 1; y < segs.length; y++) {
          var bi = box[x], bj = box[y];
          if (bi[1] < bj[0] || bj[1] < bi[0] || bi[3] < bj[2] || bj[3] < bi[2]) continue;
          if (segs[x][2] === segs[y][2]) continue;
          if (segCross(segs[x][0], segs[x][1], segs[y][0], segs[y][1])) cross++;
        }
      } else cross = L.crossings || 0;
    }
    var fwd = 0, fl = 0;
    L.edges.forEach(function (e) {
      if (e.from === e.to) return;
      var a2 = C[e.from], b2 = C[e.to], dd = L.dir === 'TB' ? b2[1] - a2[1] : b2[0] - a2[0];
      fl++; if (dd > 0) fwd++;
    });
    var ne = Math.max(1, L.edges.length);
    if (quick) return { scores: null, raw: { crossings: cross, ms: ms, backward: fl - fwd, edges: L.edges.length } };
    var dist = function (a3, b3) { return Math.hypot(C[a3][0] - C[b3][0], C[a3][1] - C[b3][1]); };
    var adj = {}, np = 0, npn = 0;
    L.edges.forEach(function (e) { if (e.from !== e.to) { (adj[e.from] = adj[e.from] || new Set()).add(e.to); (adj[e.to] = adj[e.to] || new Set()).add(e.from); } });
    if (n > 1 && n <= 600) nodes.forEach(function (nd) {
      var k = adj[nd.id] ? adj[nd.id].size : 0;
      if (!k) return;
      var near = [];
      for (var oi = 0; oi < nodes.length; oi++) {
        var o = nodes[oi];
        if (o === nd) continue;
        var dd = dist(nd.id, o.id);
        if (near.length === k && dd >= near[k - 1][0]) continue;
        var at = near.length;
        while (at > 0 && near[at - 1][0] > dd) at--;
        near.splice(at, 0, [dd, o]);
        if (near.length > k) near.pop();
      }
      np += near.filter(function (z) { return adj[nd.id].has(z[1].id); }).length / k; npn++;
    });
    var gs = 0, gsn = 0;
    if (cls && n > 1 && n <= 600) nodes.forEach(function (nd) {
      if (!cls[nd.id]) return;
      var bestN = null, bd = Infinity;
      nodes.forEach(function (o) { if (o !== nd && cls[o.id]) { var dd = dist(nd.id, o.id); if (dd < bd) { bd = dd; bestN = o; } } });
      if (bestN) { gs += cls[bestN.id] === cls[nd.id] ? 1 : 0; gsn++; }
    });
    var mv = 0, mvn = 0;
    if (prevPos) nodes.forEach(function (nd) { var p = prevPos[nd.id]; if (p) { mv += Math.hypot(C[nd.id][0] - p[0], C[nd.id][1] - p[1]); mvn++; } });
    var W = L.width || 1, H = L.height || 1, r = W / H, target = 1.6, area = 0;
    nodes.forEach(function (nd) { area += (nd.w || 12) * (nd.h || 12); });
    var fill = Math.min(1, (area / (W * H)) * 4);
    var grid = L.kind === 'matrix', noDir = L.dir === 'none';
    return {
      scores: {
        crossings: grid ? null : 1 / (1 + cross / ne), neighbors: npn ? np / npn : 1, groups: gsn ? gs / gsn : null,
        stability: mvn ? Math.max(0, 1 - mv / mvn / MAP_W) : null, flow: grid || noDir ? null : fl ? fwd / fl : 1,
        compact: (Math.min(r, target) / Math.max(r, target)) * 0.5 + fill * 0.5, speed: 1 / (1 + ms / 60)
      },
      raw: { crossings: cross, moved: mvn ? mv / mvn : 0, ms: ms, backward: fl - fwd, edges: L.edges.length }
    };
  }
  var TASKS = {
    edit: { label: 'Editing the structure', w: { crossings: 0.3, neighbors: 0.2, stability: 0.2, flow: 0.15, compact: 0.1, speed: 0.05 } },
    beats: { label: 'Reading the story beats', w: { flow: 0.3, crossings: 0.25, compact: 0.2, neighbors: 0.1, stability: 0.1, speed: 0.05 } },
    groups: { label: 'Seeing the groups', w: { groups: 0.35, crossings: 0.2, neighbors: 0.2, stability: 0.15, speed: 0.1 } }
  };
  function taskScore(scores, task) {
    var s = 0, w = 0;
    Object.keys(TASKS[task].w).forEach(function (k) {
      if (scores[k] !== null && scores[k] !== undefined) { s += scores[k] * TASKS[task].w[k]; w += TASKS[task].w[k]; }
    });
    return w ? s / w : 0;
  }

  /* ---------------------------------------------------------------- 9. one call: data in, drawing out */
  var VIEWS = [
    ['flow', 'Flow', 'Left to right: how things lead on from the start.'],
    ['down', 'Top-down', 'The same drawing, top to bottom.'],
    ['spine', 'Choke-point spine', 'Places every route to the goal must pass, held on one line.'],
    ['lanes', 'Lanes', 'One band per group; items in several groups sit in the middle.'],
    ['shape', 'Shape', 'The stretches between choke points, each named by its pattern.'],
    ['river', 'River', 'Simulated walkers pour through; the wider the band, the more take that arrow.'],
    ['arc', 'Arc', 'Everything on one line; arcs show the links, long arcs are long jumps.'],
    ['matrix', 'Matrix', 'A grid of who links to whom; patterns show clusters and loops.'],
    ['network', 'Network', 'Closeness on the page follows closeness in the data; for data that is not a story.']
  ];
  function groupKey(nd, by) {
    var g = by === 'group' || !by ? nd.group : nd.attrs && nd.attrs[by];
    return g === undefined || g === null || g === '' ? '(none)' : String(g);
  }
  /**
   * o: { view, dir, fold, merge, open, laneBy, colorBy ('group'|'choke'|'traffic'|'odds'|'heat'|'found'), mode ('random'|'first'|'curious'),
   *      runs, weights, block, hideKinds, start, prev (order from last time), traffic (size by traffic) }
   * Returns the drawing L with everything the screen needs on the boxes and arrows; nothing in it needs the engine.
   */
  function build(graph, o) {
    o = o || {};
    var t0 = now(), view = o.view || 'flow';
    var P = prepare(graph, o);
    var imp = importance(P);
    var flowing = view === 'river', needFlow = flowing || o.colorBy === 'odds' || o.colorBy === 'heat' || o.wantFlow;
    var flow = null;
    if (needFlow && P.start >= 0) flow = (o.mode && o.mode !== 'random') ? flowSim(P, imp, o) : flowExact(P, imp, { weights: o.weights });
    var G = mapGraph(P, imp, { fold: o.fold !== false && !flowing && view !== 'matrix' && view !== 'network' && view !== 'shape', open: o.open, merge: !!o.merge || flowing || view === 'matrix' || view === 'arc' || view === 'network' });
    var found = o.colorBy === 'found' || o.laneBy === 'found' ? communities(P) : null;
    G.nodes.forEach(function (n) {
      var pg = P.nodes[n.pages[0]];
      n.traffic = 0; n.choke = false; n.visits = 0; n.pGood = 0; n.pBad = 0; n.pNeutral = 0;
      n.pages.forEach(function (pi) {
        if (imp.traffic[pi] > n.traffic) n.traffic = imp.traffic[pi];
        if (imp.choke[pi]) n.choke = true;
        if (flow) { if (flow.visits[pi] > n.visits) n.visits = flow.visits[pi]; }
      });
      if (flow) { n.pGood = flow.pGood[n.pages[0]]; n.pBad = flow.pBad[n.pages[0]]; n.pNeutral = flow.pNeutral[n.pages[0]]; }
      n.label = n.run ? n.pages.length + ' in a row' : pg.label || pg.id;
      n.sub = n.run ? P.nodes[n.pages[0]].label + ' … ' + P.nodes[n.pages[n.pages.length - 1]].label : '';
      n.nodeId = pg.id;
      n.group = o.colorBy === 'found' && found ? 'group ' + (found[n.pages[0]] + 1) : groupKey(pg, o.colorBy && o.colorBy !== 'found' && ['group', 'choke', 'traffic', 'odds', 'heat'].indexOf(o.colorBy) < 0 ? o.colorBy : 'group');
      n.start = n.pages.indexOf(P.start) >= 0;
      n.end = !n.run && outdeg(P, n.pages[0]) === 0;
      n.valence = n.end ? (P.valence[n.pages[0]] === 1 ? 'good' : P.valence[n.pages[0]] === 2 ? 'bad' : 'neutral') : '';
      n.unreached = imp.depth[n.pages[0]] < 0;
      n.deg = indeg(P, n.pages[0]) + outdeg(P, n.pages[0]);
      n.ghost = !!pg.ghost;
      var k = 1;
      if (o.traffic) k = 1 + 0.45 * n.traffic;
      if (view === 'spine' && n.choke) k = Math.max(k, 1.2);
      n.k = k; n.w = MAP_W * k; n.h = MAP_H * k;
      if (flowing) { n.k = 1; n.w = 14; n.h = Math.max(6, n.visits * 420); }
    });
    G.edges.forEach(function (e) {
      var labels = [], fw = 0, wsum = 0;
      e.srcs.forEach(function (ei) {
        var orig = P.edges[P.eorig[ei]];
        if (orig.label && labels.length < 4) labels.push(orig.label);
        if (flow) fw += flow.moves[ei];
        wsum += P.w[ei];
      });
      e.label = labels.join(' / '); e.count = e.srcs.length; e.flow = fw; e.weight = wsum;
    });
    /* groups for lanes and for the "groups" score */
    var cls = {}, laneNames = [], laneOfBox = {};
    var useLanes = view === 'lanes' || true;
    var keyOf = function (n) { return o.laneBy === 'found' && found ? 'group ' + (found[n.pages[0]] + 1) : groupKey(P.nodes[n.pages[0]], o.laneBy || 'group'); };
    G.nodes.forEach(function (n) { cls[n.id] = keyOf(n); });
    var keys = Array.from(new Set(Object.keys(cls).map(function (id) { return cls[id]; })));
    var meanDepth = {};
    G.nodes.forEach(function (n) { var k = cls[n.id]; meanDepth[k] = meanDepth[k] || [0, 0]; meanDepth[k][0] += Math.max(0, imp.depth[n.pages[0]]); meanDepth[k][1]++; });
    keys.sort(function (a, b) { return meanDepth[a][0] / meanDepth[a][1] - meanDepth[b][0] / meanDepth[b][1] || (a < b ? -1 : 1); });
    keys.forEach(function (k, i) { laneNames.push(k); });
    G.nodes.forEach(function (n) { laneOfBox[n.id] = laneNames.indexOf(cls[n.id]); });
    var root = P.start >= 0 ? G.groupOf[P.start] : undefined, prev = o.prev || undefined, Lr;
    if (view === 'down') Lr = layered(G, { dir: 'TB', root: root, prev: prev });
    else if (view === 'spine') Lr = layered(G, { dir: 'LR', root: root, prev: prev, spine: true });
    else if (view === 'lanes' && laneNames.length > 1) Lr = layered(G, { dir: 'LR', root: root, prev: prev, lane: function (n) { return Math.max(0, laneOfBox[n.id]); } });
    else if (view === 'river') Lr = layered(G, { dir: 'LR', root: root, prev: prev, gapLayer: 190, gapNode: 14 });
    else if (view === 'arc') { Lr = arcLayout(G, layered(G, { dir: 'LR', root: root, prev: o.prevFlow })); }
    else if (view === 'matrix') {
      Lr = matrixLayout(G, layered(G, { dir: 'LR', root: root, prev: o.prevFlow }));
      Lr.nodes.forEach(function (n) { n.cx = n.cy = Lr.head + n.mi * Lr.cell + Lr.cell / 2; n.w = n.h = Lr.cell; });
    } else if (view === 'shape') Lr = shapeLayout(P, G);
    else if (view === 'network') Lr = networkLayout(P, G, o);
    else Lr = layered(G, { dir: o.dir === 'TB' ? 'TB' : 'LR', root: root, prev: prev });
    if (view === 'lanes' && laneNames.length > 1) Lr.laneNames = laneNames;
    Lr.view = view;
    Lr.cls = cls;
    Lr.imp = {
      goal: imp.goal.map(function (v) { return P.nodes[v].id; }), goalKind: imp.goalKind,
      spine: imp.spine.map(function (v) { return P.nodes[v].id; }), routesLog10: imp.routesLog10, reached: imp.reached,
      chokeCount: imp.spine.length
    };
    Lr.n = P.n; Lr.m = P.m; Lr.startId = P.start >= 0 ? P.nodes[P.start].id : null; Lr.autoStart = P.autoStart;
    Lr.flow = flow ? { exact: flow.exact, mode: flow.mode, runs: flow.runs, outcome: flow.outcome } : null;
    Lr.groups = laneNames;
    if (view === 'shape') {
      Lr.segs.forEach(function (s) {
        s.fromId = P.nodes[s.from].id; s.toId = s.to >= 0 ? P.nodes[s.to].id : null;
        s.fromLabel = P.nodes[s.from].label; s.toLabel = s.to >= 0 ? P.nodes[s.to].label : '';
        s.pageIds = s.pages.map(function (pi) { return P.nodes[pi].id; });
      });
    }
    Lr.ms = now() - t0;
    return Lr;
  }

  /** Scores every view for the Compare table. */
  function compare(graph, o) {
    var rows = [];
    ['flow', 'down', 'spine', 'lanes', 'river', 'arc', 'matrix', 'network'].forEach(function (v) {
      var oo = Object.assign({}, o, { view: v });
      try {
        var L = build(graph, oo);
        if (v === 'lanes' && !L.laneNames) { rows.push({ view: v, skipped: 'needs two or more groups' }); return; }
        var m = metrics(L, L.ms, L.cls, null, false);
        var tasks = {};
        Object.keys(TASKS).forEach(function (t) { tasks[t] = taskScore(m.scores, t); });
        rows.push({ view: v, scores: m.scores, raw: m.raw, tasks: tasks, ms: L.ms });
      } catch (err) { rows.push({ view: v, skipped: String(err && err.message || err) }); }
    });
    return rows;
  }

  return {
    MAP_W: MAP_W, MAP_H: MAP_H, VIEWS: VIEWS, TASKS: TASKS, prepare: prepare, importance: importance, flowExact: flowExact, flowSim: flowSim,
    mapGraph: mapGraph, layered: layered, arcLayout: arcLayout, matrixLayout: matrixLayout, shapeLayout: shapeLayout, networkLayout: networkLayout,
    communities: communities, metrics: metrics, taskScore: taskScore, build: build, compare: compare, bfs: bfs, mapCrossPairs: mapCrossPairs, mapPlaceLine: mapPlaceLine, autoStart: autoStart
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMEngine;

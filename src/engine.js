/*!
 * Net Flow Map engine: pure functions, no page, no DOM. Runs on the main thread or inside a worker.
 * Copyright (c) 2026 LFC Foundry. MIT License.
 *
 * Starts from the layered / arc / matrix / shape drawings, choke points, traffic and drawing scores of the Story Editor's
 * map (p-see-story-editor/editor/maplayout.js, MIT, copied and generalized; there is no dependency on it) and adds:
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
  var C = typeof NFMColumns !== 'undefined' ? NFMColumns : require('./columns.js');
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
    var block = new Set(opts.block || []), hide = new Set(opts.hideKinds || []), keep = opts.keep ? new Set(opts.keep) : null, ef = opts.edgeFacet && opts.edgeFacet.col ? opts.edgeFacet : null;
    var nodes = [], index = new Map(), no = [];
    for (var i = 0; i < graph.nodes.length; i++) {
      var nd = graph.nodes[i];
      if (block.has(nd.id) || (keep && !keep.has(nd.id))) continue;
      index.set(nd.id, nodes.length);
      nodes.push(nd); no.push(i);
    }
    var n = nodes.length;
    var f = [], t = [], w = [], eo = [], rw = [], me = opts.minEdge && opts.minEdge.ch ? opts.minEdge : null, st = opts.state, stEdges = null;
    for (var k = 0; k < graph.edges.length; k++) {
      var e = graph.edges[k];
      if (hide.has(e.kind || '')) continue;
      if (ef && ef.values.indexOf(C.catOf(e, 'col:' + ef.col)) < 0) continue;
      var a = index.get(e.from), b = index.get(e.to);
      if (a === undefined || b === undefined) continue;
      if (me) { var mv = C.numOf(e, me.ch); if (mv === mv && mv < me.min) continue; }
      var wt = Number(e.weight), gone = false;
      if (st !== undefined && st !== null && e.vals) {
        var sv = e.vals[st];
        if (sv === null || sv === undefined || !(sv > 0)) { if (opts.onlyPresent) continue; sv = 0; gone = true; }
        wt = sv;
        if (!stEdges) stEdges = graph.edges.slice();
        stEdges[k] = Object.assign({}, e, { weight: sv, absent: gone });
      }
      f.push(a); t.push(b); eo.push(k);
      rw.push(isFinite(wt) ? wt : 1);
      w.push(opts.weights && isFinite(wt) && wt > 0 ? wt : 1);
    }
    var m = f.length;
    var P = {
      n: n, m: m, nodes: nodes, index: index, norig: Int32Array.from(no), rw: Float64Array.from(rw),
      from: Int32Array.from(f), to: Int32Array.from(t), w: Float64Array.from(w), eorig: Int32Array.from(eo),
      outStart: new Int32Array(n + 1), outEdge: new Int32Array(m), inStart: new Int32Array(n + 1), inEdge: new Int32Array(m),
      valence: new Int8Array(n), edges: stEdges || graph.edges, stated: !!stEdges
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
    var r = absorb(P, imp, o, function (i) { return P.valence[i] === 1 ? 0 : P.valence[i] === 2 ? 1 : 2; }, 3);
    var n = P.n, pg = new Float64Array(n), pb = new Float64Array(n), pn = new Float64Array(n);
    for (var i = 0; i < n; i++) { pg[i] = r.c[i * 3]; pb[i] = r.c[i * 3 + 1]; pn[i] = r.c[i * 3 + 2]; }
    var oc = { good: r.start[0], bad: r.start[1], neutral: r.start[2], stuck: 0 };
    oc.stuck = Math.max(0, 1 - oc.good - oc.bad - oc.neutral);
    return { exact: true, runs: 1, visits: r.visits, moves: r.moves, pGood: pg, pBad: pb, pNeutral: pn, outcome: oc, mode: 'random' };
  }
  /** The seeds of a flow: [{v, mass}] from o.sources (ids with relative masses), else the start with mass 1. */
  function seedsOf(P, o) {
    var out = [];
    if (o && o.sources && o.sources.length) {
      var tot = 0;
      o.sources.forEach(function (s) { var v = P.index.get(s.id); if (v !== undefined) { var m = s.mass > 0 ? s.mass : 1; out.push({ v: v, mass: m }); tot += m; } });
      out.forEach(function (s) { s.mass /= tot || 1; });
    }
    if (!out.length && P.start >= 0) out.push({ v: P.start, mass: 1 });
    return out;
  }
  /** How the flow spreads forward from the seeds: expected visits per item and moves per link, with the same step cap as before. */
  function spread(P, p, seeds, cap) {
    var n = P.n, m = P.m, visits = new Float64Array(n), moves = new Float64Array(m), x = new Float64Array(n), y = new Float64Array(n), act = [], k, e;
    seeds.forEach(function (s) { if (x[s.v] === 0) act.push(s.v); x[s.v] += s.mass; });
    for (var step = 0; step < cap && act.length; step++) {
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
    return { visits: visits, moves: moves };
  }
  /**
   * Absorbing chain with K end classes: classOf(item with no way on) gives its class 0..K-1. Returns c (n * K: the chance of
   * finishing in each class from each item), start (the mix over the seeds), visits and moves.
   */
  function absorb(P, imp, o, classOf, K) {
    o = o || {};
    var n = P.n, m = P.m, cap = o.cap || 400;
    var sumw = new Float64Array(n), p = new Float64Array(m), i, k, e;
    for (e = 0; e < m; e++) sumw[P.from[e]] += P.w[e];
    for (e = 0; e < m; e++) p[e] = sumw[P.from[e]] > 0 ? P.w[e] / sumw[P.from[e]] : 0;
    var c = new Float64Array(n * K);
    for (i = 0; i < n; i++) if (!outdeg(P, i)) { var ci = classOf(i); if (ci >= 0 && ci < K) c[i * K + ci] = 1; }
    var ord = [];
    for (i = 0; i < n; i++) if (outdeg(P, i)) ord.push(i);
    ord.sort(function (a, b) { return imp.depth[b] - imp.depth[a] || a - b; });
    var acc = new Float64Array(K);
    for (var sweep = 0; sweep < 500; sweep++) {
      var delta = 0;
      for (var oi = 0; oi < ord.length; oi++) {
        var v = ord[oi], q;
        for (q = 0; q < K; q++) acc[q] = 0;
        for (k = P.outStart[v]; k < P.outStart[v + 1]; k++) {
          e = P.outEdge[k];
          var tK = P.to[e] * K, pe = p[e];
          for (q = 0; q < K; q++) acc[q] += pe * c[tK + q];
        }
        var d = 0;
        for (q = 0; q < K; q++) { d += Math.abs(acc[q] - c[v * K + q]); c[v * K + q] = acc[q]; }
        if (d > delta) delta = d;
      }
      if (delta < 1e-12) break;
    }
    var seeds = seedsOf(P, o), sp = spread(P, p, seeds, cap), start = new Float64Array(K);
    seeds.forEach(function (s) { for (var q = 0; q < K; q++) start[q] += s.mass * c[s.v * K + q]; });
    return { c: c, K: K, start: start, visits: sp.visits, moves: sp.moves, p: p };
  }
  /**
   * The end classes for any data. A story with good/bad marks gets good / bad / other. Everything else gets its busiest
   * ends (up to 8), one class each, and one class for all the rest. Returns { K, classOf, list: [{id, label, kind}] }.
   */
  function endClasses(P, imp, o) {
    var story = false, i;
    for (i = 0; i < P.n; i++) if (!outdeg(P, i) && (P.valence[i] === 1 || P.valence[i] === 2)) { story = true; break; }
    if (story) return { story: true, K: 3, classOf: function (v) { return P.valence[v] === 1 ? 0 : P.valence[v] === 2 ? 1 : 2; }, list: [{ id: null, label: 'good ends', kind: 'good' }, { id: null, label: 'bad ends', kind: 'bad' }, { id: null, label: 'other ends', kind: 'neutral' }] };
    var ends = [];
    for (i = 0; i < P.n; i++) if (!outdeg(P, i) && imp.depth[i] >= 0) ends.push(i);
    if (!ends.length) return { story: false, K: 1, classOf: function () { return 0; }, list: [{ id: null, label: 'no end', kind: 'neutral' }] };
    var mass = null;
    if (ends.length > 8) {
      var sw = new Float64Array(P.n), pp = new Float64Array(P.m), e;
      for (e = 0; e < P.m; e++) sw[P.from[e]] += P.w[e];
      for (e = 0; e < P.m; e++) pp[e] = P.w[e] / sw[P.from[e]];
      mass = spread(P, pp, seedsOf(P, o), o.cap || 400).visits;
      ends.sort(function (a, b) { return mass[b] - mass[a] || a - b; });
    } else ends.sort(function (a, b) { return a - b; });
    var top = ends.slice(0, 8), cls = new Map(), list = [];
    top.forEach(function (v, k) { cls.set(v, k); list.push({ id: P.nodes[v].id, label: P.nodes[v].label || P.nodes[v].id, kind: 'end' }); });
    var other = ends.length > 8;
    if (other) list.push({ id: null, label: ends.length - 8 + ' other ends', kind: 'other' });
    return { story: false, K: list.length, classOf: function (v) { return cls.has(v) ? cls.get(v) : other ? 8 : 0; }, list: list };
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
  /* ---- arrangements for the network view: force (Barnes-Hut), circle, rings, groups, radial tree, grid, and three 3D ones ---- */
  /** Push overlapping circles apart (grid buckets, a few passes). X has `dim` numbers per item; only the first two count. */
  /** Same job as separate, for a few big things (every pair is checked, so large radii work). */
  function separateBig(X, k, dim, rad, passes) {
    for (var pass = 0; pass < (passes || 60); pass++) {
      var moved = false;
      for (var i = 0; i < k; i++) for (var o = i + 1; o < k; o++) {
        var dx = X[o * dim] - X[i * dim], dy = X[o * dim + 1] - X[i * dim + 1], dd = Math.sqrt(dx * dx + dy * dy) || 0.01, need = rad(i) + rad(o);
        if (dd < need) { var push = (need - dd) / 2 + 0.5, ux = dx / dd || 1, uy = dy / dd; X[i * dim] -= ux * push; X[i * dim + 1] -= uy * push; X[o * dim] += ux * push; X[o * dim + 1] += uy * push; moved = true; }
      }
      if (!moved) break;
    }
  }
  function separate(X, k, dim, rad, passes) {
    var rads = new Float64Array(k), cellOf = new Int32Array(k), sorted = new Int32Array(k), start = null, i, o, pass, rmax = 0;
    for (i = 0; i < k; i++) { rads[i] = rad(i); if (rads[i] > rmax) rmax = rads[i]; }
    var cell = Math.max(2 * rmax, 20);   // a cell as wide as the longest reach of two touching items: only the 3 x 3 cells around an item matter
    for (pass = 0; pass < (passes || 30); pass++) {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (i = 0; i < k; i++) { var px = X[i * dim], py = X[i * dim + 1]; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
      var GW = Math.floor((x1 - x0) / cell) + 3, GH = Math.floor((y1 - y0) / cell) + 3;
      if (!(GW * GH <= 4000000)) { return separateSparse(X, k, dim, rad, (passes || 30) - pass); }
      if (!start || start.length < GW * GH + 1) start = new Int32Array(GW * GH + 1); else start.fill(0, 0, GW * GH + 1);
      // counting sort of the items into grid cells: items of one cell sit next to each other in `sorted`
      for (i = 0; i < k; i++) { var c = (Math.floor((X[i * dim + 1] - y0) / cell) + 1) * GW + Math.floor((X[i * dim] - x0) / cell) + 1; cellOf[i] = c; start[c + 1]++; }
      for (c = 0; c < GW * GH; c++) start[c + 1] += start[c];
      for (i = 0; i < k; i++) sorted[start[cellOf[i]]++] = i;
      for (c = GW * GH; c > 0; c--) start[c] = start[c - 1];
      start[0] = 0;
      var moved = false;
      for (i = 0; i < k; i++) {
        var ci = cellOf[i], ra = rads[i];
        for (var row = -1; row <= 1; row++) {
          var from = start[ci + row * GW - 1], to = start[ci + row * GW + 2];   // three neighboring cells in a row are one slice
          for (var q = from; q < to; q++) {
            o = sorted[q];
            if (o <= i) continue;
            var dx = X[o * dim] - X[i * dim], dy = X[o * dim + 1] - X[i * dim + 1], dd = Math.sqrt(dx * dx + dy * dy) || 0.01, need = ra + rads[o];
            if (dd < need) { var push = (need - dd) / 2, ux = dx / dd || 1, uy = dy / dd; X[i * dim] -= ux * push; X[i * dim + 1] -= uy * push; X[o * dim] += ux * push; X[o * dim + 1] += uy * push; moved = true; }
          }
        }
      }
      if (!moved) break;
    }
    return !!moved;   // true when the last pass still had to move something
  }
  /**
   * Overlap removal that cannot end with touching items. Push-apart passes first; if some pairs still touch, the whole picture is
   * stretched a little (the truth score ignores the overall scale, so this costs nothing in truth, only page area) and the passes run
   * again; the few that remain are placed by settleOverlaps. `margin` is the gap kept between items.
   */
  function clearOverlaps(X, k, dim, rad, passes, rounds, grow) {
    var i, r, dirty = separate(X, k, dim, rad, passes);
    for (r = 0; r < rounds && dirty; r++) {
      var cx = 0, cy = 0;
      for (i = 0; i < k; i++) { cx += X[i * dim]; cy += X[i * dim + 1]; }
      cx /= k; cy /= k;
      for (i = 0; i < k; i++) { X[i * dim] = cx + (X[i * dim] - cx) * grow; X[i * dim + 1] = cy + (X[i * dim + 1] - cy) * grow; }
      dirty = separate(X, k, dim, rad, Math.max(6, passes >> 1));
    }
  }

  /**
   * The last word on overlaps. The push-apart passes above get close but, in crowded cores, can stop with a few touching items. This walks
   * the items once; an item that touches another is lifted out and put at the nearest free place on an outward spiral. A moved item only
   * lands where nothing is, so when the walk ends nothing touches anything (by construction, not by hope). `rad(i)` is the item's radius.
   */
  function settleOverlaps(X, k, dim, rad) {
    var rads = new Float64Array(k), rmax = 1, i, j, c;
    for (i = 0; i < k; i++) { rads[i] = rad(i); if (rads[i] > rmax) rmax = rads[i]; }
    var cell = 2 * rmax + 1, tsize = 16; while (tsize < 2 * k) tsize <<= 1;
    var mask = tsize - 1, head = new Int32Array(tsize).fill(-1), next = new Int32Array(k).fill(-1), bucket = new Int32Array(k);
    var hashOf = function (cx, cy) { return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & mask; };
    var link = function (a) { var b = hashOf(Math.floor(X[a * dim] / cell), Math.floor(X[a * dim + 1] / cell)); bucket[a] = b; next[a] = head[b]; head[b] = a; };
    var unlink = function (a) { var b = bucket[a], o = head[b], prev = -1; while (o !== a && o >= 0) { prev = o; o = next[o]; } if (o === a) { if (prev < 0) head[b] = next[a]; else next[prev] = next[a]; } };
    var clash = function (a, x, y, ra) {   // does a disc of radius ra at (x, y) touch any item other than a?
      var cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      for (var gx = cx - 1; gx <= cx + 1; gx++) for (var gy = cy - 1; gy <= cy + 1; gy++) {
        for (var o = head[hashOf(gx, gy)]; o >= 0; o = next[o]) {
          if (o === a) continue;
          var dx = X[o * dim] - x, dy = X[o * dim + 1] - y, need = ra + rads[o];
          if (dx * dx + dy * dy < need * need) return true;
        }
      }
      return false;
    };
    for (i = 0; i < k; i++) link(i);
    var maxX = -Infinity, far = 0;
    for (i = 0; i < k; i++) if (X[i * dim] > maxX) maxX = X[i * dim];
    for (i = 0; i < k; i++) {
      var ra = rads[i], x0 = X[i * dim], y0 = X[i * dim + 1];
      if (!clash(i, x0, y0, ra)) continue;
      unlink(i);
      var placed = false, step = Math.max(2, ra * 0.6);
      for (c = 1; c < 6000; c++) {
        var rho = step * Math.sqrt(c), th = c * 2.399963, nx = x0 + rho * Math.cos(th), ny = y0 + rho * Math.sin(th);
        if (!clash(i, nx, ny, ra)) { X[i * dim] = nx; X[i * dim + 1] = ny; placed = true; break; }
      }
      if (!placed) { far++; X[i * dim] = maxX + cell * far; X[i * dim + 1] = y0; }
      link(i);
    }
  }

  function separateSparse(X, k, dim, rad, passes) {   // the same job on a hash grid, for pictures too spread out for a plain grid
    var cell = 90, next = new Int32Array(k), head = new Map(), rads = new Float64Array(k), i;
    for (i = 0; i < k; i++) rads[i] = rad(i);
    for (var pass = 0; pass < (passes || 30); pass++) {
      head.clear(); var moved = false;
      for (i = 0; i < k; i++) { var key = (Math.floor(X[i * dim] / cell) + 4096) * 8192 + Math.floor(X[i * dim + 1] / cell) + 4096; var h0 = head.get(key); next[i] = h0 === undefined ? -1 : h0; head.set(key, i); }
      for (i = 0; i < k; i++) {
        var cx = Math.floor(X[i * dim] / cell) + 4096, cy = Math.floor(X[i * dim + 1] / cell) + 4096, ra = rads[i];
        for (var gx = cx - 1; gx <= cx + 1; gx++) for (var gy = cy - 1; gy <= cy + 1; gy++) {
          var o = head.get(gx * 8192 + gy); if (o === undefined) continue;
          for (; o >= 0; o = next[o]) {
            if (o <= i) continue;
            var dx = X[o * dim] - X[i * dim], dy = X[o * dim + 1] - X[i * dim + 1], dd = Math.sqrt(dx * dx + dy * dy) || 0.01, need = ra + rads[o];
            if (dd < need) { var push = (need - dd) / 2, ux = dx / dd || 1, uy = dy / dd; X[i * dim] -= ux * push; X[i * dim + 1] -= uy * push; X[o * dim] += ux * push; X[o * dim + 1] += uy * push; moved = true; }
          }
        }
      }
      if (!moved) break;
    }
    return !!moved;
  }
  /**
   * Force-directed placement with Barnes-Hut repulsion (quadtree in 2D, octree in 3D). Edges pull like springs, every item pushes
   * every other, heavier (better connected) items push harder, a weak gravity keeps pieces together. X is changed in place.
   * pairs: flat [a, b, a, b, ...]. dim: 2 or 3.
   */
  function forceSim(X, k, dim, pairs, mass, iters, K, rnd) {
    var NC = 1 << dim, cap = 6 * k + 64, FX = new Float64Array(k * dim), i, j, d, it;
    var tm = new Float64Array(cap), tcx = new Float64Array(cap * dim), tc = new Float64Array(cap * dim), th = new Float64Array(cap), tn = new Int32Array(cap), tb = new Int32Array(cap), tch = new Int32Array(cap * NC);
    var cnt, stack = new Int32Array(256), K2 = K * K, theta2 = 0.81, msum = 0;
    for (i = 0; i < k; i++) msum += mass[i];
    var mnorm = msum > 0 ? k / msum : 1; for (i = 0; i < k; i++) mass[i] *= mnorm;
    function newNode(parent, q) {
      var id = cnt++, h = th[parent] / 2;
      th[id] = h; tm[id] = 0; tn[id] = 0; tb[id] = -1; for (var c = 0; c < NC; c++) tch[id * NC + c] = -1;
      for (var a = 0; a < dim; a++) { tcx[id * dim + a] = 0; tc[id * dim + a] = tc[parent * dim + a] + ((q >> a) & 1 ? h : -h); }
      return id;
    }
    function quad(nd, i) { var q = 0; for (var a = 0; a < dim; a++) if (X[i * dim + a] >= tc[nd * dim + a]) q |= 1 << a; return q; }
    function ins(nd, i, depth) {
      var m = mass[i];
      tm[nd] += m; for (var a = 0; a < dim; a++) tcx[nd * dim + a] += X[i * dim + a] * m;
      if (tn[nd] === 0) { tb[nd] = i; tn[nd] = 1; return; }
      if (tn[nd] === 1 && tb[nd] >= 0) {
        var b = tb[nd];
        if (depth >= 24 || cnt + NC >= cap) { tb[nd] = -2; tn[nd] = 2; return; }
        tb[nd] = -1; tn[nd] = 2;
        var qb = quad(nd, b), cb = tch[nd * NC + qb]; if (cb < 0) cb = tch[nd * NC + qb] = newNode(nd, qb);
        ins(cb, b, depth + 1);
      } else if (tb[nd] === -2) { tn[nd]++; return; } else tn[nd]++;
      var qi = quad(nd, i), ci = tch[nd * NC + qi]; if (ci < 0) { if (cnt >= cap) { tb[nd] = -2; return; } ci = tch[nd * NC + qi] = newNode(nd, qi); }
      ins(ci, i, depth + 1);
    }
    var temp0 = K * 2, tempN = K * 0.02;
    for (it = 0; it < iters; it++) {
      var temp = temp0 * Math.pow(tempN / temp0, it / Math.max(1, iters - 1));
      // bounds and tree
      var lo = new Array(dim).fill(Infinity), hi = new Array(dim).fill(-Infinity);
      for (i = 0; i < k; i++) for (d = 0; d < dim; d++) { var v = X[i * dim + d]; if (v < lo[d]) lo[d] = v; if (v > hi[d]) hi[d] = v; }
      var half = 1; for (d = 0; d < dim; d++) half = Math.max(half, (hi[d] - lo[d]) / 2 + 1);
      cnt = 1; th[0] = half; tm[0] = 0; tn[0] = 0; tb[0] = -1; for (var c0 = 0; c0 < NC; c0++) tch[c0] = -1;
      for (d = 0; d < dim; d++) { tc[d] = (lo[d] + hi[d]) / 2; tcx[d] = 0; }
      for (i = 0; i < k; i++) ins(0, i, 0);
      FX.fill(0);
      // repulsion
      for (i = 0; i < k; i++) {
        var sp = 0; stack[sp++] = 0;
        while (sp) {
          var nd = stack[--sp]; if (!tn[nd]) continue;
          var r2 = 0, dv = [0, 0, 0];
          for (d = 0; d < dim; d++) { dv[d] = X[i * dim + d] - tcx[nd * dim + d] / tm[nd]; r2 += dv[d] * dv[d]; }
          if (tn[nd] === 1 && tb[nd] === i) continue;
          var leaf = tn[nd] === 1 || tb[nd] === -2 || (4 * th[nd] * th[nd]) / (r2 || 1e-9) < theta2;
          if (leaf) {
            if (r2 < 1e-6) { for (d = 0; d < dim; d++) dv[d] = (rnd() - 0.5) * 0.1; r2 = 0.01; }
            var f = K2 * mass[i] * tm[nd] / r2;
            if (tn[nd] === 1 && tb[nd] >= 0 || true) for (d = 0; d < dim; d++) FX[i * dim + d] += dv[d] * f;
          } else for (var cc = 0; cc < NC; cc++) { var ch = tch[nd * NC + cc]; if (ch >= 0 && sp < 250) stack[sp++] = ch; }
        }
      }
      // springs
      for (j = 0; j < pairs.length; j += 2) {
        var a2 = pairs[j], b2 = pairs[j + 1], dd2 = 0, dvv = [0, 0, 0];
        for (d = 0; d < dim; d++) { dvv[d] = X[a2 * dim + d] - X[b2 * dim + d]; dd2 += dvv[d] * dvv[d]; }
        var dist = Math.sqrt(dd2) || 1e-6, fa = dist / K;
        for (d = 0; d < dim; d++) { FX[a2 * dim + d] -= dvv[d] * fa; FX[b2 * dim + d] += dvv[d] * fa; }
      }
      // gravity and move
      for (i = 0; i < k; i++) {
        var mag2 = 0;
        for (d = 0; d < dim; d++) { FX[i * dim + d] -= X[i * dim + d] * 0.02 * mass[i]; mag2 += FX[i * dim + d] * FX[i * dim + d]; }
        var mag = Math.sqrt(mag2) || 1e-9, step = Math.min(mag, temp) / mag;
        for (d = 0; d < dim; d++) X[i * dim + d] += FX[i * dim + d] * step;
      }
    }
  }
  /** Where each arrangement puts things. All return centers (dim numbers per item) around the origin. */
  var ARRANGE_NAMES = { stress: 'Distances (stress)', stressBest: 'Distances, best quality (slower)', force: 'Force (springs)', circle: 'Circle', rings: 'Rings by importance', groups: 'Group clusters', radial: 'Radial tree', grid: 'Grid', force3d: '3D force', sphere: 'Sphere', stack: 'Stacked group planes' };
  function arrangeAll(kind, nodes, adj, size, rnd, EDGE) {
    var k = nodes.length, i, dim = /3d|sphere|stack/.test(kind) ? 3 : 2, X = new Float64Array(k * dim);
    var deg = nodes.map(function (n, ix) { return adj[ix].length; });
    var byImp = nodes.map(function (n, ix) { return ix; }).sort(function (a, b) { return deg[b] - deg[a] || a - b; });
    var gOrder = function () {
      var gs = new Map(); nodes.forEach(function (n, ix) { var g = n.group || ''; if (!gs.has(g)) gs.set(g, []); gs.get(g).push(ix); });
      var keys = Array.from(gs.keys()).sort(function (a, b) { return gs.get(b).length - gs.get(a).length || (a < b ? -1 : 1); });
      keys.forEach(function (g) { gs.get(g).sort(function (a, b) { return deg[b] - deg[a] || a - b; }); });
      return { keys: keys, map: gs };
    };
    var avgSize = nodes.reduce(function (a, n) { return a + size(n); }, 0) / Math.max(1, k) + 14;
    if (kind === 'circle') {
      var gg = gOrder(), ord = []; gg.keys.forEach(function (g) { gg.map.get(g).forEach(function (ix) { ord.push(ix); }); });
      var R = Math.max(120, ord.length * avgSize * 0.8 / (2 * Math.PI));
      ord.forEach(function (ix, r) { var a = (r / ord.length) * 2 * Math.PI - Math.PI / 2; X[ix * 2] = R * Math.cos(a); X[ix * 2 + 1] = R * Math.sin(a); });
    } else if (kind === 'rings') {
      var left = byImp.slice(), ring = 0, placed = 0;
      while (left.length) {
        var R2 = ring === 0 ? 0 : ring * avgSize * 1.7, cap = ring === 0 ? 1 : Math.max(6, Math.floor(2 * Math.PI * R2 / (avgSize * 1.15)));
        var take = left.splice(0, cap), gm = new Map(); take.forEach(function (ix) { var g = nodes[ix].group || ''; if (!gm.has(g)) gm.set(g, []); gm.get(g).push(ix); });
        var seq = []; Array.from(gm.keys()).sort().forEach(function (g) { gm.get(g).forEach(function (ix) { seq.push(ix); }); });
        seq.forEach(function (ix, r) { var a = (r / seq.length) * 2 * Math.PI + ring * 0.5; X[ix * 2] = R2 * Math.cos(a); X[ix * 2 + 1] = R2 * Math.sin(a); });
        ring++; placed += take.length;
      }
    } else if (kind === 'grid') {
      var g2 = gOrder(), ord2 = []; g2.keys.forEach(function (g) { g2.map.get(g).forEach(function (ix) { ord2.push(ix); }); });
      var cols = Math.max(1, Math.ceil(Math.sqrt(ord2.length * 1.5))), cw = avgSize * 1.5;
      ord2.forEach(function (ix, r) { X[ix * 2] = (r % cols) * cw; X[ix * 2 + 1] = Math.floor(r / cols) * cw; });
    } else if (kind === 'groups') {
      var g3 = gOrder(), gi = g3.keys.length, gc = new Float64Array(gi * 2), grad = new Float64Array(gi), gidx = new Map();
      g3.keys.forEach(function (g, q) { gidx.set(g, q); grad[q] = Math.sqrt(g3.map.get(g).length + 0.5) * avgSize * 0.62 * 1.35 + avgSize * 1.1; });
      var between = new Map();
      nodes.forEach(function (n, ix) { adj[ix].forEach(function (o) { if (o > ix) { var a = gidx.get(nodes[ix].group || ''), b = gidx.get(nodes[o].group || ''); if (a !== b) { var kk = a < b ? a * 100003 + b : b * 100003 + a; between.set(kk, (between.get(kk) || 0) + 1); } } }); });
      var gp = []; between.forEach(function (c, kk) { gp.push(Math.floor(kk / 100003), kk % 100003); });
      g3.keys.forEach(function (g, q) { var a = q * 2.399963, r = Math.sqrt(q + 1) * 160; gc[q * 2] = r * Math.cos(a); gc[q * 2 + 1] = r * Math.sin(a); });
      var gm2 = new Float64Array(gi).fill(1); for (i = 0; i < gi; i++) gm2[i] = grad[i] / 40;
      if (gi > 1) { forceSim(gc, gi, 2, gp, gm2, 160, 220, rnd); separateBig(gc, gi, 2, function (q) { return grad[q] + 10; }, 200); }
      g3.keys.forEach(function (g, q) { g3.map.get(g).forEach(function (ix, r) { var a = r * 2.399963, rad = avgSize * 0.62 * Math.sqrt(r + 0.5) * 1.35; X[ix * 2] = gc[q * 2] + rad * Math.cos(a); X[ix * 2 + 1] = gc[q * 2 + 1] + rad * Math.sin(a); }); });
    } else if (kind === 'sphere') {
      var g4 = gOrder(), ord4 = []; g4.keys.forEach(function (g) { g4.map.get(g).forEach(function (ix) { ord4.push(ix); }); });
      var Rs = Math.max(150, Math.sqrt(ord4.length) * avgSize * 0.8), ga = Math.PI * (3 - Math.sqrt(5));
      ord4.forEach(function (ix, r) { var y = ord4.length > 1 ? 1 - 2 * r / (ord4.length - 1) : 0, rr = Math.sqrt(Math.max(0, 1 - y * y)), th = r * ga; X[ix * 3] = Rs * rr * Math.cos(th); X[ix * 3 + 1] = Rs * y; X[ix * 3 + 2] = Rs * rr * Math.sin(th); });
    } else if (kind === 'stack') {
      var g5 = gOrder(), nL = g5.keys.length, gapZ = Math.max(120, avgSize * 3);
      g5.keys.forEach(function (g, q) { g5.map.get(g).forEach(function (ix, r) { var a = r * 2.399963, rad = avgSize * 0.62 * Math.sqrt(r + 0.5) * 1.5; X[ix * 3] = rad * Math.cos(a); X[ix * 3 + 1] = rad * Math.sin(a); X[ix * 3 + 2] = (q - (nL - 1) / 2) * gapZ; }); });
    }
    return { X: X, dim: dim };
  }

  /** One sweep of stochastic gradient descent over the pairs, in the order given (a small function on purpose: engines compile small hot loops best). */
  function sgdPass(X, pa, pb, pd, pw, ord, cnt, eta) {
    for (var q = 0; q < cnt; q++) {
      var p = ord[q], mu = pw[p] * eta; if (mu > 1) mu = 1;
      var a2 = pa[p] * 2, b2 = pb[p] * 2, dx = X[a2] - X[b2], dy = X[a2 + 1] - X[b2 + 1], mag = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      var r = (mu * (mag - pd[p])) / (2 * mag), rx = r * dx, ry = r * dy;
      X[a2] -= rx; X[a2 + 1] -= ry; X[b2] += rx; X[b2 + 1] += ry;
    }
  }

  /** The same sweep over the pairs as they lie in memory (forward or backward): no index lookups, so the memory is read in a straight line. */
  function sgdSweep(X, pa, pb, pd, pw, cnt, eta, back) {
    var q = back ? cnt - 1 : 0, step = back ? -1 : 1;
    for (var n = 0; n < cnt; n++, q += step) {
      var mu = pw[q] * eta; if (mu > 1) mu = 1;
      var a2 = pa[q] * 2, b2 = pb[q] * 2, dx = X[a2] - X[b2], dy = X[a2 + 1] - X[b2 + 1], mag = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      var r = (mu * (mag - pd[q])) / (2 * mag), rx = r * dx, ry = r * dy;
      X[a2] -= rx; X[a2 + 1] -= ry; X[b2] += rx; X[b2 + 1] += ry;
    }
  }

  /* Tuning knobs for the stress layout (the benchmark page changes them to compare settings; the app never does). */
  var exactNow = false;
  var STRESS = { fullMax: 4000, pivMin: 30, pivMax: 120, pivBudget: 300000, iters: 36, fullIters: 30, near: 100, nearBig: 60, pivW: 0.3, settle: 1, growRounds: 12, grow: 1.1, reshuffle: false, sepPasses: 30, spread: 0.35, exactMax: 20000, exactIters: 0 };   // exactIters 0 = by size

  /**
   * "Best quality" stress for one connected piece: every pair of items is used, with the hop counts kept in one byte each (k*k bytes,
   * 100 MB for 10,000 items) instead of 16 bytes per pair. Items are numbered in a random order first, so sweeping each item against
   * the next items in that numbering is a random pair order, and the memory is read in straight lines.
   */
  function stressExact(X, k, off, nbr, EDGE, rnd, iters) {
    var T = STRESS, nm = k >> 1, D = new Uint8Array(nm * k), rp = new Int32Array(k), i, j, t, m, r, c;
    for (i = 0; i < k; i++) rp[i] = i;
    for (i = k - 1; i > 0; i--) { j = (rnd() * (i + 1)) | 0; r = rp[i]; rp[i] = rp[j]; rp[j] = r; }
    var ri = new Int32Array(k), off2 = new Int32Array(k + 1), nbr2 = new Int32Array(nbr.length), dist = new Int32Array(k), queue = new Int32Array(k), maxD = 1;
    for (r = 0; r < k; r++) ri[rp[r]] = r;
    for (r = 0; r < k; r++) { off2[r + 1] = off2[r] + off[rp[r] + 1] - off[rp[r]]; for (j = off[rp[r]], c = off2[r]; j < off[rp[r] + 1]; j++, c++) nbr2[c] = ri[nbr[j]]; }   // the same links, in the new numbering
    // D[(m-1)*k + i] = hops between numbered items i and (i+m) mod k, for offsets m = 1..k/2: each pair once, and one offset lies in a straight line.
    // 32 searches run side by side: every item holds a 32-bit mask of the searches that have reached it, so one pass over a link moves 32 searches
    // one step. Rows of a block are kept in a small table and written across in pieces (writing one byte at a time down a column is slow).
    var BL = 32, tmp = new Uint8Array(BL * nm), reach = new Int32Array(k), fr = new Int32Array(k), fr2 = new Int32Array(k), acc = new Int32Array(k);
    var list = new Int32Array(k), list2 = new Int32Array(k), touched = new Int32Array(k), seenT = new Uint8Array(k);
    for (var r0 = 0; r0 < k; r0 += BL) {
      var nb = Math.min(BL, k - r0), nl = nb, level = 0, bb;
      reach.fill(0); tmp.fill(0);
      for (bb = 0; bb < nb; bb++) { reach[r0 + bb] = fr[r0 + bb] = 1 << bb; list[bb] = r0 + bb; }
      while (nl > 0) {
        level++; var nt = 0, u, e, e1, v;
        if (level > 254) return false;   // hop counts are kept in one byte; a piece this stretched out is left to the pivot version
        for (var li = 0; li < nl; li++) {   // push: every item that just got reached hands its mask to its neighbors
          u = list[li]; var fu = fr[u];
          for (e = off2[u], e1 = off2[u + 1]; e < e1; e++) { v = nbr2[e]; if (!seenT[v]) { seenT[v] = 1; touched[nt++] = v; } acc[v] |= fu; }
        }
        for (li = 0; li < nl; li++) fr[list[li]] = 0;
        var nl2 = 0, dv = level > 255 ? 255 : level;
        for (var ti = 0; ti < nt; ti++) {
          v = touched[ti]; seenT[v] = 0;
          var nx = acc[v] & ~reach[v]; acc[v] = 0;
          if (!nx) continue;
          reach[v] |= nx; fr[v] = nx; list2[nl2++] = v;
          if (dv > maxD) maxD = dv;
          while (nx) {
            var low = nx & -nx; nx ^= low; bb = 31 - Math.clz32(low);
            m = v - (r0 + bb); if (m < 0) m += k;
            if (m > nm || (m + m === k && r0 + bb >= nm)) continue;
            tmp[bb * nm + m - 1] = dv;
          }
        }
        var sw = list; list = list2; list2 = sw; nl = nl2;
      }
      for (m = 0; m < nm; m++) { var ob = m * k + r0; for (var b2 = 0; b2 < nb; b2++) D[ob + b2] = tmp[b2 * nm + m]; }
    }
    var Y = new Float64Array(2 * k);
    for (r = 0; r < k; r++) { Y[2 * r] = X[2 * rp[r]]; Y[2 * r + 1] = X[2 * rp[r] + 1]; }
    var pdT = new Float64Array(256), wT = new Float64Array(256), ord = new Int32Array(nm);
    for (i = 1; i < 256; i++) { pdT[i] = i * EDGE; wT[i] = 1 / (i * i); }
    for (m = 0; m < nm; m++) ord[m] = m + 1;
    var etaMax = maxD * maxD, etaMin = 0.1, lambda = Math.log(etaMax / etaMin) / Math.max(1, iters - 1);
    for (t = 0; t < iters; t++) {
      var eta = etaMax * Math.exp(-lambda * t);
      for (m = nm - 1; m > 0; m--) { j = (rnd() * (m + 1)) | 0; c = ord[m]; ord[m] = ord[j]; ord[j] = c; }
      for (var q = 0; q < nm; q++) {   // one offset at a time, in a random order: successive pairs are far apart in the picture's history
        m = ord[q];
        var row = (m - 1) * k, lim = m + m === k ? nm : k;
        for (i = 0; i < lim; i++) {
          var dd = D[row + i]; if (dd === 0) continue;
          j = i + m; if (j >= k) j -= k;
          var mu = wT[dd] * eta; if (mu > 1) mu = 1;
          var dx = Y[2 * i] - Y[2 * j], dy = Y[2 * i + 1] - Y[2 * j + 1], mag = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          var f = (mu * (mag - pdT[dd])) / (2 * mag), rx = f * dx, ry = f * dy;
          Y[2 * i] -= rx; Y[2 * i + 1] -= ry; Y[2 * j] += rx; Y[2 * j + 1] += ry;
        }
      }
    }
    for (r = 0; r < k; r++) { X[2 * rp[r]] = Y[2 * r]; X[2 * rp[r] + 1] = Y[2 * r + 1]; }
  }

  /**
   * Stress layout of one connected piece: X (x,y per item) is moved so that the distance on the page follows the hop count.
   * Hop counts come from every item (small pieces) or from far-apart "pivot" items plus the links and a few near neighbors (big pieces).
   * Pairs live in typed arrays (two Int32 index lists, two Float32 lists), not one small array per pair: about a fifth of the memory and
   * no garbage for the collector.
   */
  function stressComponent(X, k, members, adj, locArr, root, EDGE, rnd) {
    var T = STRESS, full = k <= T.fullMax, i, j, h, u, w;
    var off = new Int32Array(k + 1), m2 = 0;
    for (i = 0; i < k; i++) { m2 += adj[members[i]].length; off[i + 1] = m2; }
    var nbr = new Int32Array(m2);
    for (i = 0; i < k; i++) { var lst = adj[members[i]], o0 = off[i]; for (j = 0; j < lst.length; j++) nbr[o0 + j] = locArr[lst[j]]; }
    if (exactNow && k > T.fullMax && k <= T.exactMax) {   // 'best quality': every pair; if the device cannot give the memory (k*k/2 bytes), fall through to the pivot version
      var X0 = X.slice();
      try { if (stressExact(X, k, off, nbr, EDGE, rnd, T.exactIters || (k <= 6000 ? 12 : k <= 12000 ? 6 : 4)) !== false) return; } catch (err) { if (!(err instanceof RangeError)) throw err; }
      X.set(X0);
    }
    var dist = new Int32Array(k), queue = new Int32Array(k);
    function bfs(src) {
      dist.fill(-1); dist[src] = 0; queue[0] = src;
      var head = 0, tail = 1;
      while (head < tail) { u = queue[head++]; var du = dist[u] + 1; for (var e = off[u], e1 = off[u + 1]; e < e1; e++) { w = nbr[e]; if (dist[w] < 0) { dist[w] = du; queue[tail++] = w; } } }
    }
    // Huge pieces: keep the pairs to a memory budget (about 12 million pairs, 200 MB) by using fewer pivots and fewer near neighbors.
    var near = Math.min(k > 20000 ? T.nearBig : T.near, Math.max(2, Math.floor(4e6 / k)));
    var rootL = locArr[root], nPiv = full ? k : Math.min(k, Math.max(4, Math.min(Math.max(T.pivMin, Math.min(T.pivMax, Math.round(T.pivBudget / k))), Math.floor(8e6 / k))));
    var cap = full ? (k * (k - 1)) / 2 : nPiv * k + m2 / 2 + k * near;
    var pa = new Int32Array(cap), pb = new Int32Array(cap), pd = new Float32Array(cap), pw = new Float32Array(cap), cnt = 0, maxD = 1;
    function add(a, b, d, wm) { if (cnt >= cap) throw new Error('internal: stress pair list overflow'); pa[cnt] = a; pb[cnt] = b; pd[cnt] = d * EDGE; pw[cnt] = (wm || 1) / (d * d); cnt++; if (d > maxD) maxD = d; }
    if (full) {
      for (i = 0; i < k; i++) { bfs(i); for (j = i + 1; j < k; j++) if (dist[j] > 0) add(i, j, dist[j]); }
    } else {
      var minD = new Int32Array(k).fill(1e9), piv = rootL;
      for (h = 0; h < nPiv; h++) {
        bfs(piv);
        var far = -1, fd = -1;
        for (j = 0; j < k; j++) { var dj = dist[j]; if (dj < minD[j]) minD[j] = dj; if (minD[j] > fd) { fd = minD[j]; far = j; } if (j !== piv && dj > 0) add(piv, j, dj, T.pivW); }
        piv = far;
      }
      for (i = 0; i < k; i++) for (j = off[i]; j < off[i + 1]; j++) if (nbr[j] > i) add(i, nbr[j], 1);
      if (near > 0) {   // a few more near neighbors per item (two or three hops away), found by a short breadth-first walk
        var stamp = new Int32Array(k).fill(-1), dl = new Int32Array(k);
        for (i = 0; i < k; i++) {
          var tail2 = 1, head2 = 0, got = 0; queue[0] = i; stamp[i] = i; dl[i] = 0;
          while (head2 < tail2 && got < near) {
            u = queue[head2++];
            for (var e2 = off[u], e3 = off[u + 1]; e2 < e3 && got < near; e2++) {
              w = nbr[e2];
              if (stamp[w] !== i) { stamp[w] = i; dl[w] = dl[u] + 1; queue[tail2++] = w; if (dl[w] >= 2 && w > i) { add(i, w, dl[w]); got++; } }
            }
          }
        }
      }
    }
    var tmax = full ? (k <= 700 ? T.fullIters : k <= 1500 ? 20 : 12) : T.iters, wMin = 1 / (maxD * maxD), etaMax = 1 / wMin, etaMin = 0.1, lambda = Math.log(etaMax / etaMin) / Math.max(1, tmax - 1);
    var s = (rnd() * 4294967296) | 0 || 1, t, p, q;
    function nextInt(n) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296 * n) | 0; }
    if (T.reshuffle) {   // a fresh random order every sweep (an index list is shuffled; the pairs stay where they are)
      var ord = new Int32Array(cnt);
      for (q = 0; q < cnt; q++) ord[q] = q;
      for (t = 0; t < tmax; t++) {
        for (q = cnt - 1; q > 0; q--) { j = nextInt(q + 1); p = ord[q]; ord[q] = ord[j]; ord[j] = p; }
        sgdPass(X, pa, pb, pd, pw, ord, cnt, etaMax * Math.exp(-lambda * t));
      }
    } else {   // one random order, made once in memory; sweeps then go forward and backward through it
      for (q = cnt - 1; q > 0; q--) {
        j = nextInt(q + 1);
        p = pa[q]; pa[q] = pa[j]; pa[j] = p; p = pb[q]; pb[q] = pb[j]; pb[j] = p;
        var f = pd[q]; pd[q] = pd[j]; pd[j] = f; f = pw[q]; pw[q] = pw[j]; pw[j] = f;
      }
      for (t = 0; t < tmax; t++) sgdSweep(X, pa, pb, pd, pw, cnt, etaMax * Math.exp(-lambda * t), t & 1);
    }
  }

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
    var rnd = mulberry32(12345), EDGE = 130, locArr = new Int32Array(nb);
    var size = function (nd) { if (nd.sizeK !== undefined) return 20 + 52 * nd.sizeK; return 26 + Math.min(26, 8 * Math.sqrt((nd.traffic || 0))) + Math.min(14, Math.sqrt(adj[idxOf[nd.id]].length) * 3); };
    var arr = opts.arrange || 'stress';
    exactNow = arr === 'stressBest' || !!opts.exact;
    if (arr === 'stressBest') arr = 'stress';
    if (arr !== 'stress' && arr !== 'force' && arr !== 'radial') return globalNetwork(arr, nodes, G, adj, size, rnd, EDGE, idxOf);
    var packs = [];
    comps.forEach(function (members) {
      var k = members.length, loc = new Map();
      members.forEach(function (g, li) { loc.set(g, li); locArr[g] = li; });
      var X = new Float64Array(k * 2);
      if (k === 1) { packs.push({ members: members, X: X, w: size(nodes[members[0]]) + 20, h: size(nodes[members[0]]) + 20 }); return; }
      /* start: a spiral in breadth-first order from the best-connected node, so neighbors begin close */
      var root = members.slice().sort(function (a, b) { return adj[b].length - adj[a].length || a - b; })[0];
      var seen = new Set([root]), order = [root];
      for (var oi = 0; oi < order.length; oi++) adj[order[oi]].forEach(function (w) { if (!seen.has(w)) { seen.add(w); order.push(w); } });
      order.forEach(function (g, r) { var a = r * 2.399963, rad = EDGE * 0.6 * Math.sqrt(r + 1); X[loc.get(g) * 2] = rad * Math.cos(a); X[loc.get(g) * 2 + 1] = rad * Math.sin(a); });
      if (arr === 'force' || arr === 'radial') {
        if (arr === 'force') {
          var lpairs = [], lmass = new Float64Array(k);
          members.forEach(function (g, li) { lmass[li] = 1 + Math.sqrt(adj[g].length); adj[g].forEach(function (w) { var lw = loc.get(w); if (lw > li) lpairs.push(li, lw); }); });
          forceSim(X, k, 2, lpairs, lmass, k <= 1000 ? 220 : k <= 5000 ? 240 : k <= 12000 ? 120 : 60, EDGE * 0.55, rnd);
        } else {
          var rpar = new Map([[root, -1]]), rkids = new Map(), rdep = new Map([[root, 0]]), rq = [root], rleaf = new Map(), rcount = [];
          for (var rh = 0; rh < rq.length; rh++) { var ru = rq[rh]; rkids.set(ru, []); adj[ru].forEach(function (w) { if (!rpar.has(w)) { rpar.set(w, ru); rdep.set(w, rdep.get(ru) + 1); rkids.get(ru).push(w); rq.push(w); } }); }
          for (var rr = rq.length - 1; rr >= 0; rr--) { var rn = rq[rr], kd = rkids.get(rn); rleaf.set(rn, kd.length ? kd.reduce(function (a, c) { return a + rleaf.get(c); }, 0) : 1); var dd0 = rdep.get(rn); rcount[dd0] = (rcount[dd0] || 0) + 1; }
          var rrad = [0]; for (var rd = 1; rd < rcount.length; rd++) rrad[rd] = Math.max(rrad[rd - 1] + EDGE, rcount[rd] * 56 / (2 * Math.PI));
          var span = new Map([[root, [0, 2 * Math.PI]]]);
          rq.forEach(function (rn2) {
            var sp = span.get(rn2), a0 = sp[0], tot = rleaf.get(rn2), kd2 = rkids.get(rn2), mid = (sp[0] + sp[1]) / 2, R = rrad[rdep.get(rn2)] || 0;
            X[loc.get(rn2) * 2] = R * Math.cos(mid); X[loc.get(rn2) * 2 + 1] = R * Math.sin(mid);
            kd2.forEach(function (c) { var w = (sp[1] - sp[0]) * rleaf.get(c) / tot; span.set(c, [a0, a0 + w]); a0 += w; });
          });
        }
      } else {
      stressComponent(X, k, members, adj, locArr, root, EDGE, rnd);
      }
      /* push overlapping nodes apart (grid buckets, a few passes) */
      if (arr === 'stress' && STRESS.spread) {   // crowded pictures are first stretched so the items cover about a third of the page; then little is left to push apart
        var bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity, discs = 0, rr0;
        for (var si = 0; si < k; si++) { rr0 = size(nodes[members[si]]) / 2 + 8; discs += Math.PI * rr0 * rr0; if (X[si * 2] < bx0) bx0 = X[si * 2]; if (X[si * 2] > bx1) bx1 = X[si * 2]; if (X[si * 2 + 1] < by0) by0 = X[si * 2 + 1]; if (X[si * 2 + 1] > by1) by1 = X[si * 2 + 1]; }
        var f0 = Math.sqrt((discs / STRESS.spread) / (Math.max(1, bx1 - bx0) * Math.max(1, by1 - by0)));
        if (f0 > 1) { f0 = Math.min(f0, 8); for (var sj = 0; sj < k * 2; sj++) X[sj] *= f0; }
      }
      if (arr !== 'stress' || STRESS.sepPasses > 0) clearOverlaps(X, k, 2, function (li) { return size(nodes[members[li]]) / 2 + 8; }, arr === 'stress' ? STRESS.sepPasses : 30, STRESS.growRounds, STRESS.grow);
      if (STRESS.settle) settleOverlaps(X, k, 2, function (li) { return size(nodes[members[li]]) / 2 + 2; });
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
    return { kind: 'network', dir: 'none', nodes: nodes, edges: G.edges, pos: pos, order: {}, width: W + 60, height: H + 60, crossings: 0, arrange: arr, is3d: false };
  }

  /** Arrangements that place everything at once (no component packing): circle, rings, grid, groups, and the 3D ones. */
  function globalNetwork(arr, nodes, G, adj, size, rnd, EDGE, idxOf) {
    var nb = nodes.length, res, X, dim, i;
    if (arr === 'force3d') {
      dim = 3; X = new Float64Array(nb * 3);
      var Rs = Math.sqrt(nb) * EDGE * 0.35 + 40, ga = Math.PI * (3 - Math.sqrt(5)), mass = new Float64Array(nb), pairs = [];
      for (i = 0; i < nb; i++) { var y = nb > 1 ? 1 - 2 * i / (nb - 1) : 0, rr = Math.sqrt(Math.max(0, 1 - y * y)), th = i * ga; X[i * 3] = Rs * rr * Math.cos(th) + (rnd() - 0.5); X[i * 3 + 1] = Rs * y; X[i * 3 + 2] = Rs * rr * Math.sin(th); mass[i] = 1 + Math.sqrt(adj[i].length); adj[i].forEach(function (w) { if (w > i) pairs.push(i, w); }); }
      forceSim(X, nb, 3, pairs, mass, nb <= 300 ? 260 : nb <= 1500 ? 160 : nb <= 6000 ? 90 : 45, EDGE * 0.55, rnd);
    } else { res = arrangeAll(arr, nodes, adj, size, rnd, EDGE); X = res.X; dim = res.dim; }
    if (dim === 2) { clearOverlaps(X, nb, 2, function (q) { return size(nodes[q]) / 2 + 8; }, 40, STRESS.growRounds, STRESS.grow); if (STRESS.settle) settleOverlaps(X, nb, 2, function (q) { return size(nodes[q]) / 2 + 2; }); }
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (i = 0; i < nb; i++) { var r = size(nodes[i]) / 2; x0 = Math.min(x0, X[i * dim] - r); x1 = Math.max(x1, X[i * dim] + r); y0 = Math.min(y0, X[i * dim + 1] - r); y1 = Math.max(y1, X[i * dim + 1] + r); if (dim === 3) { z0 = Math.min(z0, X[i * 3 + 2]); z1 = Math.max(z1, X[i * 3 + 2]); } }
    if (!nb) { x0 = x1 = y0 = y1 = 0; }
    var zc = dim === 3 ? (z0 + z1) / 2 : 0;
    nodes.forEach(function (nd, q) {
      var sz = size(nd); nd.w = nd.h = sz; nd.cx = X[q * dim] - x0 + 40; nd.cy = X[q * dim + 1] - y0 + 40; nd.x = nd.cx - sz / 2; nd.y = nd.cy - sz / 2; nd.shape = 'dot'; nd.layer = 0;
      if (dim === 3) nd.z = X[q * 3 + 2] - zc;
    });
    var pos = {}; nodes.forEach(function (nd) { pos[nd.id] = nd; });
    G.edges.forEach(function (ed) { ed.kind = ed.from === ed.to ? 'self' : 'fwd'; ed.pts = []; });
    var W = x1 - x0 + 80, H = y1 - y0 + 80;
    return { kind: 'network', dir: 'none', nodes: nodes, edges: G.edges, pos: pos, order: {}, width: W, height: H, crossings: 0, arrange: arr, is3d: dim === 3, c3: [W / 2, H / 2, 0], radius3: Math.max(W, H, dim === 3 ? z1 - z0 : 0) / 2 };
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
  /* ---------------------------------------------------------------- channels: numbers and categories from the data */
  function aggOf(vals, how) {
    var s = 0, c = 0, mx = -Infinity;
    for (var i = 0; i < vals.length; i++) { var v = vals[i]; if (v === v) { s += v; c++; if (v > mx) mx = v; } }
    if (!c) return NaN;
    return how === 'mean' ? s / c : how === 'max' ? mx : s;
  }
  function rangeOf(arr) {
    var mn = Infinity, mx = -Infinity, sm = 0, c = 0;
    for (var i = 0; i < arr.length; i++) { var v = arr[i]; if (v === v) { if (v < mn) mn = v; if (v > mx) mx = v; sm += v; c++; } }
    return c ? { min: mn, max: mx, sum: sm, n: c } : { min: 0, max: 0, sum: 0, n: 0 };
  }
  /** One number per drawn box for a channel string (NaN where the data has none). */
  function nodeChan(P, G, ch, how, imp, flow, o) {
    var out = new Float64Array(G.nodes.length).fill(NaN), t = C.split(ch);
    if (!t) return out;
    var one = function (i) {
      if (t.t === 'col' || t.t === 'weight') return C.numOf(P.nodes[i], t);
      if (t.t !== 'sys') return NaN;
      var k = t.key, v, a, e;
      if (k === 'degree') return outdeg(P, i) + indeg(P, i);
      if (k === 'in') return indeg(P, i);
      if (k === 'out') return outdeg(P, i);
      if (k === 'inW') { v = 0; for (a = P.inStart[i]; a < P.inStart[i + 1]; a++) v += P.rw[P.inEdge[a]]; return v; }
      if (k === 'outW') { v = 0; for (e = P.outStart[i]; e < P.outStart[i + 1]; e++) v += P.rw[P.outEdge[e]]; return v; }
      if (k === 'traffic') return imp.traffic[i];
      if (k === 'visits') return flow ? flow.visits[i] : NaN;
      if (k === 'sim') return o.sim && o.sim.visits ? o.sim.visits[P.norig[i]] : NaN;
      return NaN;
    };
    G.nodes.forEach(function (n, gi) {
      if (n.pages.length === 1) { out[gi] = one(n.pages[0]); return; }
      var vals = n.pages.map(one);
      out[gi] = aggOf(vals, how);
    });
    return out;
  }
  /** One number per drawn arrow for a channel string. */
  function edgeChan(P, G, ch, how, flow, o) {
    var out = new Float64Array(G.edges.length).fill(NaN), t = C.split(ch);
    if (!t) return out;
    G.edges.forEach(function (ed, gi) {
      var vals = ed.srcs.map(function (ei) {
        if (t.t === 'col' || t.t === 'weight') return C.numOf(P.edges[P.eorig[ei]], t);
        if (t.t === 'sys') {
          if (t.key === 'count') return 1;
          if (t.key === 'flow') return flow ? flow.moves[ei] : NaN;
          if (t.key === 'sim') return o.sim && o.sim.moves ? o.sim.moves[P.eorig[ei]] : NaN;
        }
        return NaN;
      });
      out[gi] = aggOf(vals, t.t === 'sys' || how === 'sum' ? 'sum' : how);
    });
    return out;
  }
  /** Is a column on the items mostly numbers? ('num'), words ('cat'), or not a column ('special'). */
  function colorMode(P, ch) {
    var t = C.split(ch);
    if (!t || t.t !== 'col' || t.key === 'group') return { t: 'special' };
    var num = 0, any = 0, n = Math.min(P.n, 4000);
    for (var i = 0; i < n; i++) {
      var node = P.nodes[i], at = node.attrs, v = at && t.key in at ? at[t.key] : node[t.key];
      if (v === undefined || v === null || v === '') continue;
      any++; if (C.num(v) === C.num(v)) num++;
    }
    return { t: any && num >= 0.9 * any ? 'num' : 'cat', key: t.key };
  }

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
    var flowing = view === 'river', amounts = flowing && !!o.amounts;
    var sysFlow = [o.sizeBy, o.widthBy, o.edgeColorBy, o.colorBy].some(function (c) { return c && /^sys:(flow|visits)$/.test(c); });
    var needFlow = (flowing && !amounts) || o.colorBy === 'odds' || o.colorBy === 'heat' || o.wantFlow || sysFlow;
    var flow = null, classes = null;
    if (needFlow && P.start >= 0) {
      if (o.mode && o.mode !== 'random') flow = flowSim(P, imp, o);
      else {
        classes = endClasses(P, imp, o);
        var ab = absorb(P, imp, o, classes.classOf, classes.K), nn0 = P.n, zg = new Float64Array(nn0), zb = new Float64Array(nn0), zn = new Float64Array(nn0), q0;
        if (classes.story) for (q0 = 0; q0 < nn0; q0++) { zg[q0] = ab.c[q0 * 3]; zb[q0] = ab.c[q0 * 3 + 1]; zn[q0] = ab.c[q0 * 3 + 2]; }
        var oc0 = classes.story ? { good: ab.start[0], bad: ab.start[1], neutral: ab.start[2], stuck: 0 } : { good: 0, bad: 0, neutral: 0, stuck: 0 };
        var got = 0; for (q0 = 0; q0 < ab.K; q0++) got += ab.start[q0];
        oc0.stuck = Math.max(0, 1 - got);
        flow = { exact: true, runs: 1, visits: ab.visits, moves: ab.moves, pGood: zg, pBad: zb, pNeutral: zn, outcome: oc0, mode: 'random', c: ab.c, K: ab.K, story: classes.story, start: ab.start, classes: classes.list.map(function (cl, k) { return { id: cl.id, label: cl.label, kind: cl.kind, p: ab.start[k] }; }) };
      }
    }
    var G = mapGraph(P, imp, { fold: o.fold !== false && !flowing && view !== 'matrix' && view !== 'network' && view !== 'shape', open: o.open, merge: !!o.merge || flowing || view === 'matrix' || view === 'arc' || view === 'network' });
    var found = o.colorBy === 'found' || o.laneBy === 'found' ? communities(P) : null;
    var how = o.agg || 'sum', colCh = o.colorBy === 'sim' ? 'sys:sim' : o.colorBy, cmode = colCh && /^sys:/.test(colCh) ? { t: 'num' } : colorMode(P, colCh);
    var sizeV = o.sizeBy ? nodeChan(P, G, o.sizeBy, how, imp, flow, o) : null, sizeR = sizeV ? rangeOf(sizeV) : null;
    var colV = cmode.t === 'num' ? nodeChan(P, G, colCh, 'mean', imp, flow, o) : null, colR = colV ? rangeOf(colV) : null;
    var nodeIdx = 0;
    G.nodes.forEach(function (n) {
      var gi = nodeIdx++;
      var pg = P.nodes[n.pages[0]];
      n.traffic = 0; n.choke = false; n.visits = 0; n.pGood = 0; n.pBad = 0; n.pNeutral = 0;
      n.pages.forEach(function (pi) {
        if (imp.traffic[pi] > n.traffic) n.traffic = imp.traffic[pi];
        if (imp.choke[pi]) n.choke = true;
        if (flow) { if (flow.visits[pi] > n.visits) n.visits = flow.visits[pi]; }
      });
      n.pi = n.pages[0]; n.dom = -1; n.domP = 0;
      if (flow) {
        n.pGood = flow.pGood[n.pi]; n.pBad = flow.pBad[n.pi]; n.pNeutral = flow.pNeutral[n.pi];
        if (flow.c) { var bk = -1, bv = 0.0005; for (var qk = 0; qk < flow.K; qk++) { var cv = flow.c[n.pi * flow.K + qk]; if (cv > bv) { bv = cv; bk = qk; } } n.dom = bk; n.domP = bk >= 0 ? bv : 0; }
      }
      n.label = n.run ? n.pages.length + ' in a row' : pg.label || pg.id;
      n.sub = n.run ? P.nodes[n.pages[0]].label + ' … ' + P.nodes[n.pages[n.pages.length - 1]].label : '';
      n.nodeId = pg.id;
      n.group = o.colorBy === 'found' && found ? 'group ' + (found[n.pages[0]] + 1) : groupKey(pg, cmode.t === 'cat' ? cmode.key : 'group');
      n.sizeV = sizeV ? sizeV[gi] : NaN; n.colorV = colV ? colV[gi] : NaN;
      n.start = n.pages.indexOf(P.start) >= 0;
      n.end = !n.run && outdeg(P, n.pages[0]) === 0;
      n.valence = n.end ? (P.valence[n.pages[0]] === 1 ? 'good' : P.valence[n.pages[0]] === 2 ? 'bad' : 'neutral') : '';
      n.unreached = imp.depth[n.pages[0]] < 0;
      n.deg = indeg(P, n.pages[0]) + outdeg(P, n.pages[0]);
      n.inN = 0; n.outN = 0; n.inW = 0; n.outW = 0;
      n.pages.forEach(function (pi2) { n.inN += indeg(P, pi2); n.outN += outdeg(P, pi2); var q; for (q = P.inStart[pi2]; q < P.inStart[pi2 + 1]; q++) n.inW += P.rw[P.inEdge[q]]; for (q = P.outStart[pi2]; q < P.outStart[pi2 + 1]; q++) n.outW += P.rw[P.outEdge[q]]; });
      n.ghost = !!pg.ghost;
      var k = 1;
      if (o.traffic) k = 1 + 0.45 * n.traffic;
      if (sizeR && sizeR.n) { var sv = n.sizeV; k = sv === sv && sizeR.max > 0 ? 0.7 + 0.9 * Math.sqrt(Math.max(0, sv) / sizeR.max) : 0.7; n.sizeK = sv === sv && sizeR.max > 0 ? Math.sqrt(Math.max(0, sv) / sizeR.max) : 0; }
      if (view === 'spine' && n.choke) k = Math.max(k, 1.2);
      n.k = k; n.w = MAP_W * k; n.h = MAP_H * k;
      if (flowing) { n.k = 1; n.w = 14; n.h = Math.max(6, n.visits * 420); }
    });
    var widthV = o.widthBy ? edgeChan(P, G, o.widthBy, how, flow, o) : null, widthR = widthV ? rangeOf(widthV) : null;
    if (widthR && o.widthMax > widthR.max) widthR.max = o.widthMax;
    var ecT = C.split(o.edgeColorBy), ecNum = false, ecV = null, ecR = null;
    if (ecT && ecT.t === 'col' && ecT.key !== 'kind') {
      var ne = 0, an = 0; for (var ei0 = 0; ei0 < Math.min(P.m, 4000); ei0++) { var rv = (P.edges[P.eorig[ei0]].attrs || {})[ecT.key]; if (rv === undefined || rv === '') continue; an++; if (C.num(rv) === C.num(rv)) ne++; }
      ecNum = an > 0 && ne >= 0.9 * an;
    }
    if (ecNum) { ecV = edgeChan(P, G, o.edgeColorBy, 'mean', flow, o); ecR = rangeOf(ecV); }
    var ei1 = 0, amountMass = null, amountMax = 0;
    if (amounts && widthV) {
      amountMass = new Float64Array(G.nodes.length);
      var gidx = new Map(); G.nodes.forEach(function (n, k) { gidx.set(n.id, k); });
      var ins2 = new Float64Array(G.nodes.length), outs2 = new Float64Array(G.nodes.length);
      G.edges.forEach(function (e, k) { var v = widthV[k]; if (v === v && v > 0) { outs2[gidx.get(e.from)] += v; ins2[gidx.get(e.to)] += v; } });
      for (var gk = 0; gk < amountMass.length; gk++) { amountMass[gk] = Math.max(ins2[gk], outs2[gk]); if (amountMass[gk] > amountMax) amountMax = amountMass[gk]; }
    }
    G.edges.forEach(function (e) {
      var gi = ei1++, labels = [], fw = 0, wsum = 0;
      e.srcs.forEach(function (ei) {
        var orig = P.edges[P.eorig[ei]];
        if (orig.label && labels.length < 4) labels.push(orig.label);
        if (flow) fw += flow.moves[ei];
        wsum += P.w[ei];
      });
      e.label = labels.join(' / '); e.count = e.srcs.length; e.flow = fw; e.weight = wsum; e.orig = e.srcs.map(function (q) { return P.eorig[q]; });
      if (P.stated) e.absent = e.srcs.every(function (q) { return P.edges[P.eorig[q]].absent === true; });
      e.widthV = widthV ? widthV[gi] : NaN; e.colorV = ecV ? ecV[gi] : NaN;
      e.colorC = ecT && !ecNum ? (C.catOf(P.edges[P.eorig[e.srcs[0]]], ecT) || '(none)') : '';
      if (amountMass) { var av = widthV[gi]; e.flow = av === av && av > 0 && amountMax > 0 ? av / amountMax : 0; }
    });
    if (amountMass) { var gj = 0; G.nodes.forEach(function (n) { n.visits = amountMax > 0 ? amountMass[gj] / amountMax : 0; gj++; }); }
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
    Lr.flow = flow ? { exact: flow.exact, mode: flow.mode, runs: flow.runs, outcome: flow.outcome, K: flow.K || 0, classes: flow.classes || null, story: !!flow.story } : (amounts ? { exact: true, mode: 'amounts', runs: 1, outcome: null, K: 0, classes: null, story: false } : null);
    Lr.amounts = !!amountMass;
    Lr.ch = { size: sizeR ? Object.assign({ ch: o.sizeBy }, sizeR) : null, width: widthR ? Object.assign({ ch: o.widthBy }, widthR) : null, color: colR ? Object.assign({ ch: colCh, kind: 'num' }, colR) : (cmode.t === 'cat' ? { ch: colCh, kind: 'cat' } : null), ecolor: ecR ? Object.assign({ ch: o.edgeColorBy, kind: 'num' }, ecR) : (ecT && ecT.t === 'col' ? { ch: o.edgeColorBy, kind: 'cat' } : null), linkLabels: o.linkLabels || '' };
    Lr.groups = laneNames;
    if (view === 'shape') {
      Lr.segs.forEach(function (s) {
        s.fromId = P.nodes[s.from].id; s.toId = s.to >= 0 ? P.nodes[s.to].id : null;
        s.fromLabel = P.nodes[s.from].label; s.toLabel = s.to >= 0 ? P.nodes[s.to].label : '';
        s.pageIds = s.pages.map(function (pi) { return P.nodes[pi].id; });
      });
    }
    /* the drawing does not need the engine's working lists: free them so a big result stays small */
    var NOLIST = [];
    (Lr.edges || []).forEach(function (ed) { ed.srcs = NOLIST; if (ed.pts && !ed.pts.length) ed.pts = NOLIST; });
    (Lr.nodes || []).forEach(function (nd) { nd.pages = nd.pages.length === 1 ? [nd.pages[0]] : nd.pages; });
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
    MAP_W: MAP_W, MAP_H: MAP_H, VIEWS: VIEWS, TASKS: TASKS, prepare: prepare, importance: importance, flowExact: flowExact, flowSim: flowSim, absorb: absorb, endClasses: endClasses, spread: spread, seedsOf: seedsOf,
    mapGraph: mapGraph, layered: layered, arcLayout: arcLayout, matrixLayout: matrixLayout, shapeLayout: shapeLayout, networkLayout: networkLayout, ARRANGE_NAMES: ARRANGE_NAMES, forceSim: forceSim, stressTuning: STRESS,
    communities: communities, metrics: metrics, taskScore: taskScore, build: build, compare: compare, bfs: bfs, mapCrossPairs: mapCrossPairs, mapPlaceLine: mapPlaceLine, autoStart: autoStart
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMEngine;

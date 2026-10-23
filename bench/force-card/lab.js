/* Copyright (c) 2026 LFC Foundry. MIT License.
 * Netflow Map: the whole Force round on the graphics card (a prototype, not part of the app) against the engine's WebAssembly Force round.
 * One button. For each map size: the engine's Force layout (same start, same springs and masses, same number of rounds as the app uses), then the same rounds on the card
 * (all-pairs repulsion in tiles, springs, gravity and the move, positions staying on the card for every round, one read back at the end), then how true each result is.
 * Needs: NFMColumns, NFMEngine, NFMGen, NFMGpuStress (the build puts them in this page). */
(function () {
  'use strict';
  var E = NFMEngine, C = NFMColumns, GEN = NFMGen, G = NFMGpuStress;
  var now = function () { return performance.now(); }, r1 = function (v) { return Math.round(v * 10) / 10; }, r3 = function (v) { return Math.round(v * 1000) / 1000; };
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search), VERSION = '__VERSION__', EDGE = 130, K = EDGE * 0.55;
  var sizes = params.get('sizes') ? params.get('sizes').split(',').map(Number) : params.has('quick') ? [2000, 10000] : params.has('big') ? [10000, 100000, 200000, 300000] : [10000, 100000, 200000];
  var CAP_S = +(params.get('cap') || 150);   /* a card run that would take longer than this many seconds is stopped and said so */
  var yieldUI = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  var log = [], md = [];
  function say(t) { $('status').textContent = t; }
  function put(t) { log.push(t); var p = document.createElement('div'); p.textContent = t; $('log').appendChild(p); }

  /* ---- the map: largest connected piece, start, springs, masses, rounds (what the app's Force arrangement does for one piece) ---- */
  function piece(g) {
    var n = g.nodes.length, idx = new Map(), i; g.nodes.forEach(function (nd, q) { idx.set(nd.id, q); });
    var adj = new Array(n); for (i = 0; i < n; i++) adj[i] = new Set();
    g.edges.forEach(function (e) { var a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { adj[a].add(b); adj[b].add(a); } });
    var comp = new Int32Array(n).fill(-1), best = -1, bestSize = 0, c = 0, q = new Int32Array(n);
    for (i = 0; i < n; i++) if (comp[i] < 0) { var h = 0, t = 1; q[0] = i; comp[i] = c; while (h < t) { var u = q[h++]; adj[u].forEach(function (w) { if (comp[w] < 0) { comp[w] = c; q[t++] = w; } }); } if (t > bestSize) { bestSize = t; best = c; } c++; }
    var members = [], loc = new Int32Array(n).fill(-1); for (i = 0; i < n; i++) if (comp[i] === best) { loc[i] = members.length; members.push(i); }
    var k = members.length, off = new Uint32Array(k + 1), nbrArr = [], m = 0;
    members.forEach(function (v, j) { adj[v].forEach(function (w) { nbrArr.push(loc[w]); m++; }); off[j + 1] = m; });
    return { k: k, off: off, nbr: Uint32Array.from(nbrArr) };
  }
  function setup(P) {
    var k = P.k, off = P.off, nbr = P.nbr, X = new Float64Array(k * 2), mass = new Float64Array(k), pairs = [], i, e;
    var root = 0; for (i = 1; i < k; i++) if (off[i + 1] - off[i] > off[root + 1] - off[root]) root = i;
    var seen = new Uint8Array(k), order = [root]; seen[root] = 1;
    for (var oi = 0; oi < order.length; oi++) { var u = order[oi]; for (e = off[u]; e < off[u + 1]; e++) { var w = nbr[e]; if (!seen[w]) { seen[w] = 1; order.push(w); } } }
    order.forEach(function (g, r) { var a = r * 2.399963, rad = EDGE * 0.6 * Math.sqrt(r + 1); X[g * 2] = rad * Math.cos(a); X[g * 2 + 1] = rad * Math.sin(a); });
    for (i = 0; i < k; i++) { mass[i] = 1 + Math.sqrt(off[i + 1] - off[i]); for (e = off[i]; e < off[i + 1]; e++) if (nbr[e] > i) pairs.push(i, nbr[e]); }
    var iters = k <= 1000 ? 220 : k <= 5000 ? 240 : k <= 12000 ? 120 : 60;
    return { X: X, mass: mass, pairs: Int32Array.from(pairs), iters: iters };
  }

  /* ---- how true: the benchmarks' truth score (60 breadth-first sources, best-scale fit; lower is truer), crossings among a sample of links, items touching ---- */
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
  function crossings(X, pairs, k) {   /* links crossing another link (not sharing an item), found for a sample of up to 3,000 links against all links through a grid; returns crossings per sampled link */
    var m = pairs.length / 2, i, j, cell = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (i = 0; i < k; i++) { x0 = Math.min(x0, X[2 * i]); x1 = Math.max(x1, X[2 * i]); y0 = Math.min(y0, X[2 * i + 1]); y1 = Math.max(y1, X[2 * i + 1]); }
    var len = 0; for (j = 0; j < m; j += Math.max(1, m >> 10)) len += Math.hypot(X[2 * pairs[2 * j]] - X[2 * pairs[2 * j + 1]], X[2 * pairs[2 * j] + 1] - X[2 * pairs[2 * j + 1] + 1]); len /= Math.ceil(m / Math.max(1, m >> 10));
    cell = Math.max(len * 2, (x1 - x0) / 2048, (y1 - y0) / 2048, 1);
    var gw = Math.ceil((x1 - x0) / cell) + 1, grid = new Map(), key = function (cx, cy) { return cx * 65536 + cy; };
    var cellsOf = function (a, b, fn) { var ax = X[2 * a], ay = X[2 * a + 1], bx = X[2 * b], by = X[2 * b + 1], cx0 = Math.floor((Math.min(ax, bx) - x0) / cell), cx1 = Math.floor((Math.max(ax, bx) - x0) / cell), cy0 = Math.floor((Math.min(ay, by) - y0) / cell), cy1 = Math.floor((Math.max(ay, by) - y0) / cell); for (var cx = cx0; cx <= cx1; cx++) for (var cy = cy0; cy <= cy1; cy++) fn(cx, cy); };
    for (j = 0; j < m; j++) cellsOf(pairs[2 * j], pairs[2 * j + 1], function (cx, cy) { var kk = key(cx, cy), l = grid.get(kk); if (!l) grid.set(kk, l = []); l.push(j); });
    var ccw = function (ax, ay, bx, by, cx, cy) { return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax); }, stamp = new Int32Array(m).fill(-1), total = 0, sample = Math.min(3000, m), stepj = Math.max(1, Math.floor(m / sample)), used = 0;
    for (j = 0; j < m; j += stepj) {
      used++; var a = pairs[2 * j], b = pairs[2 * j + 1];
      cellsOf(a, b, function (cx, cy) { var l = grid.get(key(cx, cy)); if (!l) return; for (var q = 0; q < l.length; q++) { var o = l[q]; if (o === j || stamp[o] === j) continue; stamp[o] = j; var c = pairs[2 * o], d = pairs[2 * o + 1]; if (c === a || c === b || d === a || d === b) continue; if (ccw(X[2 * a], X[2 * a + 1], X[2 * c], X[2 * c + 1], X[2 * d], X[2 * d + 1]) !== ccw(X[2 * b], X[2 * b + 1], X[2 * c], X[2 * c + 1], X[2 * d], X[2 * d + 1]) && ccw(X[2 * a], X[2 * a + 1], X[2 * b], X[2 * b + 1], X[2 * c], X[2 * c + 1]) !== ccw(X[2 * a], X[2 * a + 1], X[2 * b], X[2 * b + 1], X[2 * d], X[2 * d + 1])) total++; } });
    }
    return total / used;
  }
  function touching(X, k, rad) {   /* pairs of items closer than 2 * rad (a hash grid) */
    var cell = 2 * rad, grid = new Map(), i, cnt = 0, key = function (a, b) { return a * 131072 + b; };
    for (i = 0; i < k; i++) { var kk = key(Math.floor(X[2 * i] / cell) + 65536, Math.floor(X[2 * i + 1] / cell) + 65536), l = grid.get(kk); if (!l) grid.set(kk, l = []); l.push(i); }
    for (i = 0; i < k; i++) { var cx = Math.floor(X[2 * i] / cell) + 65536, cy = Math.floor(X[2 * i + 1] / cell) + 65536; for (var gx = cx - 1; gx <= cx + 1; gx++) for (var gy = cy - 1; gy <= cy + 1; gy++) { var l2 = grid.get(key(gx, gy)); if (!l2) continue; for (var q = 0; q < l2.length; q++) { var o = l2[q]; if (o > i && Math.hypot(X[2 * o] - X[2 * i], X[2 * o + 1] - X[2 * i + 1]) < 2 * rad) cnt++; } } }
    return cnt;
  }

  /* ---- the card: one Force round = repulsion over all pairs (tiles of 256 items, in chunks so no single job runs long), then springs + gravity + move per item ---- */
  var WGSL_REPEL = '\nstruct U { n: u32, k2: f32, off: u32, p: u32 }\n@group(0) @binding(0) var<storage, read> pos: array<vec4<f32>>;\n@group(0) @binding(1) var<storage, read_write> frc: array<vec2<f32>>;\n@group(0) @binding(2) var<uniform> u: U;\nvar<workgroup> tile: array<vec4<f32>, 256>;\n' +
    '@compute @workgroup_size(256)\nfn main(@builtin(workgroup_id) wid: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {\n  let i = (wid.x + u.off) * 256u + lid.x;\n  var me = vec4<f32>(0.0);\n  if (i < u.n) { me = pos[i]; }\n  var f = vec2<f32>(0.0);\n  var base = 0u;\n  loop {\n    if (base >= u.n) { break; }\n    let j = base + lid.x;\n    if (j < u.n) { tile[lid.x] = pos[j]; } else { tile[lid.x] = vec4<f32>(0.0); }\n    workgroupBarrier();\n' +
    '    for (var q = 0u; q < 256u; q++) {\n      let o = tile[q];\n      let d = me.xy - o.xy;\n      let d2 = max(dot(d, d), 0.000001);\n      f += d * (o.z * me.z * u.k2 / d2);\n    }\n    workgroupBarrier();\n    base += 256u;\n  }\n  if (i < u.n) { frc[i] = f; }\n}\n';
  var WGSL_MOVE = '\nstruct U { n: u32, k: f32, temp: f32, p: u32 }\n@group(0) @binding(0) var<storage, read> pos: array<vec4<f32>>;\n@group(0) @binding(1) var<storage, read> frc: array<vec2<f32>>;\n@group(0) @binding(2) var<storage, read> off: array<u32>;\n@group(0) @binding(3) var<storage, read> nbr: array<u32>;\n@group(0) @binding(4) var<storage, read_write> outp: array<vec4<f32>>;\n@group(0) @binding(5) var<uniform> u: U;\n' +
    '@compute @workgroup_size(64)\nfn main(@builtin(global_invocation_id) gid: vec3<u32>) {\n  let i = gid.x;\n  if (i >= u.n) { return; }\n  let p = pos[i];\n  var f = frc[i];\n  for (var e = off[i]; e < off[i + 1u]; e++) {\n    let d = pos[nbr[e]].xy - p.xy;\n    var dist = length(d);\n    if (dist == 0.0) { dist = 0.000001; }\n    f += d * (dist / u.k);\n  }\n  f -= p.xy * 0.02 * p.z;\n  var mag = length(f);\n  if (mag == 0.0) { mag = 0.000000001; }\n  let step = min(mag, u.temp) / mag;\n  outp[i] = vec4<f32>(p.xy + f * step, p.z, 0.0);\n}\n';

  async function cardRun(dev, S, k, P, opt) {
    var d = dev.device, GB = GPUBufferUsage, n = k, iters = S.iters, t0 = now(), ms = {};
    d.pushErrorScope('validation'); d.pushErrorScope('out-of-memory');
    var mk = function (size, usage, data) { var b = d.createBuffer({ size: Math.max(16, size), usage: usage }); if (data) d.queue.writeBuffer(b, 0, data); return b; };
    var msum = 0, i; for (i = 0; i < n; i++) msum += S.mass[i]; var mn = msum > 0 ? n / msum : 1;
    var pos4 = new Float32Array(n * 4); for (i = 0; i < n; i++) { pos4[i * 4] = S.X[i * 2]; pos4[i * 4 + 1] = S.X[i * 2 + 1]; pos4[i * 4 + 2] = S.mass[i] * mn; }
    var bufA = mk(n * 16, GB.STORAGE | GB.COPY_DST | GB.COPY_SRC, pos4), bufB = mk(n * 16, GB.STORAGE | GB.COPY_DST | GB.COPY_SRC), frc = mk(n * 8, GB.STORAGE), bOff = mk((n + 1) * 4, GB.STORAGE | GB.COPY_DST, P.off), bNbr = mk(P.nbr.length * 4, GB.STORAGE | GB.COPY_DST, P.nbr);
    var rb = d.createBuffer({ size: n * 16, usage: GB.MAP_READ | GB.COPY_DST });
    var mkMod = function (code) { return d.createShaderModule({ code: code }); };
    var pRep = await d.createComputePipelineAsync({ layout: 'auto', compute: { module: mkMod(WGSL_REPEL), entryPoint: 'main' } }), pMov = await d.createComputePipelineAsync({ layout: 'auto', compute: { module: mkMod(WGSL_MOVE), entryPoint: 'main' } });
    ms.setup = now() - t0;
    var totalWG = Math.ceil(n / 256), chunkWG = Math.max(1, Math.min(totalWG, Math.floor((opt.pairsPerJob || 1.5e9) / (n * 256)))), chunks = Math.ceil(totalWG / chunkWG);
    var uni = d.createBuffer({ size: (chunks + iters) * 256, usage: GB.UNIFORM | GB.COPY_DST }), ub = new ArrayBuffer((chunks + iters) * 256), ud = new DataView(ub);
    var K2 = K * K;
    for (var c = 0; c < chunks; c++) { ud.setUint32(c * 256, n, true); ud.setFloat32(c * 256 + 4, K2, true); ud.setUint32(c * 256 + 8, c * chunkWG, true); }
    var temp0 = K * 2, tempN = K * 0.02;
    for (var r = 0; r < iters; r++) { var o = (chunks + r) * 256, temp = temp0 * Math.pow(tempN / temp0, r / Math.max(1, iters - 1)); ud.setUint32(o, n, true); ud.setFloat32(o + 4, K, true); ud.setFloat32(o + 8, temp, true); }
    d.queue.writeBuffer(uni, 0, ub);
    var slot = function (s) { return { buffer: uni, offset: s * 256, size: 16 }; };
    var bgRep = [0, 1].map(function (par) { return Array.apply(null, Array(chunks)).map(function (_, c2) { return d.createBindGroup({ layout: pRep.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: par ? bufB : bufA } }, { binding: 1, resource: { buffer: frc } }, { binding: 2, resource: slot(c2) }] }); }); });
    var bgMov = [];
    for (r = 0; r < iters; r++) { var par = r & 1; bgMov.push(d.createBindGroup({ layout: pMov.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: par ? bufB : bufA } }, { binding: 1, resource: { buffer: frc } }, { binding: 2, resource: { buffer: bOff } }, { binding: 3, resource: { buffer: bNbr } }, { binding: 4, resource: { buffer: par ? bufA : bufB } }, { binding: 5, resource: slot(chunks + r) }] })); }
    await d.queue.onSubmittedWorkDone(); ms.upload = now() - t0 - ms.setup;
    var tr = now(), roundMs = null;
    for (r = 0; r < iters; r++) {
      for (c = 0; c < chunks; c++) { var e1 = d.createCommandEncoder(), p1 = e1.beginComputePass(); p1.setPipeline(pRep); p1.setBindGroup(0, bgRep[r & 1][c]); p1.dispatchWorkgroups(Math.min(chunkWG, totalWG - c * chunkWG)); p1.end(); d.queue.submit([e1.finish()]); }
      var e2 = d.createCommandEncoder(), p2 = e2.beginComputePass(); p2.setPipeline(pMov); p2.setBindGroup(0, bgMov[r]); p2.dispatchWorkgroups(Math.ceil(n / 64)); p2.end(); d.queue.submit([e2.finish()]);
      if (r === 1) {   /* two rounds in: how long the whole thing will take (the first includes warming up) */
        await d.queue.onSubmittedWorkDone(); roundMs = (now() - tr) / 2; if (roundMs * iters / 1000 > opt.capS) { [bufA, bufB, frc, bOff, bNbr, rb, uni].forEach(function (b) { b.destroy(); }); try { await d.popErrorScope(); await d.popErrorScope(); } catch (x) { /* closed */ } return { stopped: true, roundMs: roundMs, projectedS: roundMs * iters / 1000 }; }
      }
    }
    await d.queue.onSubmittedWorkDone(); ms.rounds = now() - tr;
    var fin = iters & 1 ? bufB : bufA, te = now(), enc = d.createCommandEncoder(); enc.copyBufferToBuffer(fin, 0, rb, 0, n * 16); d.queue.submit([enc.finish()]); await rb.mapAsync(GPUMapMode.READ);
    var out = new Float32Array(rb.getMappedRange().slice(0)); rb.unmap(); ms.read = now() - te; ms.total = now() - t0;
    var oom = await d.popErrorScope(), val = await d.popErrorScope();
    [bufA, bufB, frc, bOff, bNbr, rb, uni].forEach(function (b) { b.destroy(); });
    if (oom || val) return { error: (oom ? 'out of memory: ' + oom.message : 'error: ' + val.message).slice(0, 160) };
    var X = new Float64Array(n * 2); for (i = 0; i < n; i++) { X[i * 2] = out[i * 4]; X[i * 2 + 1] = out[i * 4 + 1]; }
    return { X: X, ms: ms, chunks: chunks, perRoundMs: ms.rounds / iters };
  }

  /* ---- the run ---- */
  async function run() {
    $('go').disabled = true; $('log').textContent = ''; log = []; var res = { version: VERSION, when: new Date().toISOString(), cap: CAP_S, sizes: [] };
    var dev = await G.getDevice();
    if (dev.error) { put('No WebGPU card: ' + dev.error); res.error = dev.error; return finish(res); }
    res.adapter = dev.info; res.software = dev.software; res.ua = navigator.userAgent;
    put('Card: ' + dev.info + (dev.software ? ' (a software stand-in: only the quality check is meaningful, not the speed)' : ''));
    if (dev.software && !params.has('softok')) { put('Software adapter refused (as in the app). Add ?softok=1 to check quality only.'); res.refused = true; return finish(res); }
    E.forceWasm.minItems = 0; E.forceWasm.on = true;
    for (var si = 0; si < sizes.length; si++) {
      var N = sizes[si], row = { requested: N }; res.sizes.push(row);
      say('Building the ' + N.toLocaleString() + '-item map…'); await yieldUI();
      var g = GEN.graph('moderate', N, 11), P = piece(g); g = null; var S = setup(P); row.items = P.k; row.links = S.pairs.length / 2; row.rounds = S.iters;
      var T = function (f) { var t = now(); var v = f(); return [v, now() - t]; };
      say('Engine Force rounds, ' + P.k.toLocaleString() + ' items (' + S.iters + ' rounds)…'); await yieldUI();
      var Xe = Float64Array.from(S.X), me = Float64Array.from(S.mass), c0 = E.forceWasm.calls, te = T(function () { E.forceSim(Xe, P.k, 2, S.pairs.slice(), me, S.iters, K, (function () { var s = 1; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })()); })[1];
      row.engine = { totalMs: te, perRoundMs: te / S.iters, usedWasm: E.forceWasm.calls > c0 };
      put(P.k.toLocaleString() + ' items: engine ' + S.iters + ' rounds ' + r1(te) + ' ms (' + r1(te / S.iters) + ' ms a round' + (row.engine.usedWasm ? '' : ', JavaScript') + ')');
      say('Card Force rounds, ' + P.k.toLocaleString() + ' items…'); await yieldUI();
      var rc; try { rc = await cardRun(dev, S, P.k, P, { capS: CAP_S, pairsPerJob: +(params.get('pairs') || 1.5e9) }); } catch (err) { rc = { error: String(err && err.message || err).slice(0, 160) }; }
      if (rc.error) { row.card = { error: rc.error }; put('  card failed: ' + rc.error); if (/lost/i.test(rc.error)) break; continue; }
      if (rc.stopped) { row.card = { stopped: true, perRoundMs: rc.roundMs, projectedS: rc.projectedS }; put('  card stopped: ' + r1(rc.roundMs) + ' ms a round, ' + r1(rc.projectedS) + ' s for ' + S.iters + ' rounds is over the ' + CAP_S + ' s limit'); continue; }
      row.card = { totalMs: rc.ms.total, roundsMs: rc.ms.rounds, perRoundMs: rc.perRoundMs, setupMs: rc.ms.setup, uploadMs: rc.ms.upload, readMs: rc.ms.read, jobs: rc.chunks };
      say('How true, ' + P.k.toLocaleString() + ' items…'); await yieldUI();
      row.quality = { engineTruth: truth(P, Xe), cardTruth: truth(P, rc.X), startTruth: truth(P, S.X), engineCross: crossings(Xe, S.pairs, P.k), cardCross: crossings(rc.X, S.pairs, P.k) };
      var rad = 30, Xo = Float64Array.from(rc.X), Xp = Float64Array.from(Xe), tb = touching(Xo, P.k, rad), tbe = touching(Xp, P.k, rad), t1 = now(); E.separate(Xo, P.k, 2, function () { return rad; }, 30); var sepMs = now() - t1; E.separate(Xp, P.k, 2, function () { return rad; }, 30);
      row.afterCard = { touchingBefore: tb, touchingAfter: touching(Xo, P.k, rad), engineTouchingBefore: tbe, engineTouchingAfter: touching(Xp, P.k, rad), separateMs: sepMs };
      row.speedup = te / rc.ms.total; row.verdict = row.quality.cardTruth <= row.quality.engineTruth * 1.01 ? 'at least as true' : 'LESS TRUE';
      put('  card ' + r1(rc.ms.total) + ' ms whole (' + r1(rc.perRoundMs) + ' ms a round), engine ' + r1(te) + ' ms: ' + r1(row.speedup) + 'x. Truth (lower is truer): engine ' + r3(row.quality.engineTruth) + ', card ' + r3(row.quality.cardTruth) + ' (' + row.verdict + '). Crossings per link: engine ' + r3(row.quality.engineCross) + ', card ' + r3(row.quality.cardCross) + '. Items touching (radius 30) before / after the engine\'s push-apart: engine ' + row.afterCard.engineTouchingBefore + ' / ' + row.afterCard.engineTouchingAfter + ', card ' + row.afterCard.touchingBefore + ' / ' + row.afterCard.touchingAfter);
      if (row.verdict !== 'at least as true') { put('Stopping: the card result is less true than the engine\'s.'); break; }
    }
    finish(res);
  }
  function finish(res) {
    say('Finished.');
    var L = ['# Force round on the card, prototype results', '', 'Version ' + VERSION + ' · ' + res.when + ' · limit ' + CAP_S + ' s per card run', '', 'Card: ' + (res.adapter || 'none') + (res.software ? ' (software stand-in)' : ''), 'Browser: ' + (res.ua || navigator.userAgent), ''];
    if (res.sizes.length) {
      L.push('| Items | Links | Rounds | Engine whole (ms) | Engine a round (ms) | Card whole (ms) | Card a round (ms) | Card faster | Truth: engine / card (lower is truer) | Crossings per link: engine / card | Touching pairs before / after push-apart: engine | card |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
      res.sizes.forEach(function (r) { var c = r.card || {}, q = r.quality; L.push('| ' + (r.items || r.requested).toLocaleString() + ' | ' + (r.links || '').toLocaleString() + ' | ' + (r.rounds || '') + ' | ' + (r.engine ? r1(r.engine.totalMs) : '') + ' | ' + (r.engine ? r1(r.engine.perRoundMs) : '') + ' | ' + (c.totalMs ? r1(c.totalMs) : c.stopped ? 'stopped (' + r1(c.projectedS) + ' s projected)' : c.error ? 'failed' : '') + ' | ' + (c.perRoundMs ? r1(c.perRoundMs) : '') + ' | ' + (r.speedup ? r1(r.speedup) + 'x' : '') + ' | ' + (q ? r3(q.engineTruth) + ' / ' + r3(q.cardTruth) : '') + ' | ' + (q ? r3(q.engineCross) + ' / ' + r3(q.cardCross) : '') + ' | ' + (r.afterCard ? r.afterCard.engineTouchingBefore + ' / ' + r.afterCard.engineTouchingAfter : '') + ' | ' + (r.afterCard ? r.afterCard.touchingBefore + ' / ' + r.afterCard.touchingAfter : '') + ' |'); });
      L.push('');
    }
    L.push('Faster means engine time divided by card time for the whole layout including setup and the one read back (higher is better for the card). Truth and crossings are lower is better.', '', '```json', JSON.stringify(res), '```');
    var text = L.join('\n'); window.__FORCE_CARD_RESULT = { md: text, res: res };
    $('out').textContent = text; $('dl').style.display = $('cp').style.display = ''; $('go').disabled = false;
    $('dl').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); a.download = 'netflow-map-force-card-results.md'; a.click(); };
    $('cp').onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(text); };
  }
  $('go').onclick = run;
  if (params.has('auto')) window.addEventListener('load', function () { setTimeout(run, 300); });
})();

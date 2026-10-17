/* Copyright (c) 2026 LFC Foundry. MIT License.
 * Net Flow Map Tester: opens, runs the research checks by itself, explains each result in plain words, and writes a results file (.md).
 * Needs: NFMColumns, NFMImport, NFMEngine, NFMCheck, NFMGen, NFMGpuStress (the build puts them in this page). */
(function () {
  'use strict';
  var E = NFMEngine, C = NFMColumns, I = NFMImport, K = NFMCheck, GEN = NFMGen, G = NFMGpuStress;
  var now = function () { return performance.now(); }, r1 = function (v) { return Math.round(v * 10) / 10; }, r3 = function (v) { return Math.round(v * 1000) / 1000; };
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search), QUICK = params.has('quick');
  var VERSION = '__VERSION__', EDGE = 130;
  var yieldUI = function () { return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); }); };
  var sections = [], total = 0, doneSteps = 0, running = false, t0Run = 0;

  /* ------------------------------------------------------------- small helpers */
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  /** Distance error colors (lower is truer): green to 0.147, light green to 0.154, yellow to 0.165, orange to 0.199, red above. */
  function errCls(v) { var x = Number(v); return !isFinite(x) ? '' : x <= 0.1475 ? 'e1' : x <= 0.1545 ? 'e2' : x <= 0.1655 ? 'e3' : x < 0.2 ? 'e4' : 'e5'; }
  function tintNums(t) { return esc(t).replace(/\b\d\.\d{3}\b/g, function (m) { var c = errCls(m); return c ? '<span class="' + c + '">' + m + '</span>' : m; }); }
  function tintSay(t) { return esc(t).replace(/(distance error )(\d\.\d+)( against )?(\d\.\d+)?/g, function (m, a, v1, mid, v2) { return a + '<span class="' + errCls(v1) + '">' + v1 + '</span>' + (mid && v2 ? mid + '<span class="' + errCls(v2) + '">' + v2 + '</span>' : ''); }); }
  function setStatus(t) { $('status').textContent = t; }
  function setBar() { $('barfill').style.width = Math.min(100, Math.round(100 * doneSteps / total)) + '%'; }
  function addSection(title) {
    var card = document.createElement('div'); card.className = 'card'; card.innerHTML = '<h2></h2><div class="verdict note">Working…</div><div class="tw"></div>'; card.firstChild.textContent = title; $('out').insertBefore(card, $('out').firstChild);   /* the step being tested is always the top card */
    var s = { title: title, verdict: '', level: 'ok', head: null, rows: [], notes: [], card: card };
    s.finish = function (level, verdict) {
      s.level = level; s.verdict = verdict; var v = card.querySelector('.verdict'); v.className = 'verdict ' + level; v.innerHTML = tintSay(verdict);
      if (s.head) { var h = '<table><thead><tr>' + s.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + s.rows.map(function (r) { var rowErr = /distance error|^After \d+ steps|CPU math \/ graphics card/i.test(r[0]); return '<tr>' + r.map(function (x, ci) { return '<td>' + (rowErr && ci > 0 || /truth|distance error/i.test(s.head[ci] || '') ? tintNums(x) : esc(x)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; card.querySelector('.tw').innerHTML = h; }
      s.notes.forEach(function (n) { var p = document.createElement('p'); p.className = 'note'; p.textContent = n; card.appendChild(p); });
    };
    sections.push(s); return s;
  }
  function mdTable(head, rows) { return '| ' + head.join(' | ') + ' |\n|' + head.map(function (_, i) { return i ? '---:' : '---'; }).join('|') + '|\n' + rows.map(function (r) { return '| ' + r.join(' | ') + ' |'; }).join('\n') + '\n'; }

  /* ------------------------------------------------------------- graph helpers */
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
  /** The truth score used by every benchmark: 60 breadth-first sources, best-scale fit, mean of (hops - scale*distance)^2 / hops^2. Lower is truer. */
  function truth(P, X, dim) {
    dim = dim || 2; var k = P.k, ns = Math.min(60, k), stride = k > 3000 ? 7 : 1, dist = new Int32Array(k), q = new Int32Array(k), num = 0, den = 0, pairs = [], s, t;
    for (s = 0; s < ns; s++) {
      var src = Math.floor(s * k / ns); dist.fill(-1); dist[src] = 0; q[0] = src; var h = 0, tl = 1;
      while (h < tl) { var u = q[h++]; for (var e = P.off[u]; e < P.off[u + 1]; e++) { var w = P.nbr[e]; if (dist[w] < 0) { dist[w] = dist[u] + 1; q[tl++] = w; } } }
      for (t = 0; t < k; t += stride) if (t !== src && dist[t] > 0) { var ex = dim === 2 ? Math.hypot(X[2 * src] - X[2 * t], X[2 * src + 1] - X[2 * t + 1]) : Math.hypot(X[3 * src] - X[3 * t], X[3 * src + 1] - X[3 * t + 1], X[3 * src + 2] - X[3 * t + 2]); pairs.push(dist[t], ex); num += ex / dist[t]; den += ex * ex / (dist[t] * dist[t]); }
    }
    var sc = num / den, st = 0; for (s = 0; s < pairs.length; s += 2) { var d = pairs[s], ee = pairs[s + 1]; st += Math.pow(d - sc * ee, 2) / (d * d); }
    return st / (pairs.length / 2);
  }
  function fullTable(P) {   // hop counts of every pair, k*stride bytes, same layout the card uses
    var k = P.k, S = Math.ceil(k / 4) * 4, D = new Uint8Array(k * S), dist = new Int32Array(k), q = new Int32Array(k);
    for (var s = 0; s < k; s++) { dist.fill(-1); dist[s] = 0; q[0] = s; var h = 0, t = 1; while (h < t) { var u = q[h++]; for (var e = P.off[u]; e < P.off[u + 1]; e++) { var w = P.nbr[e]; if (dist[w] < 0) { dist[w] = dist[u] + 1; q[t++] = w; } } } for (var j = 0; j < k; j++) D[j * S + s] = dist[j] > 0 ? Math.min(255, dist[j]) : 0; }
    return D;
  }
  function pairStress(X, D, k, S) {   // weighted stress over every pair (1/hops^2), after the best overall scale
    var num = 0, den = 0, i, j, d;
    for (i = 0; i < k; i++) for (j = i + 1; j < k; j++) { d = D[j * S + i]; if (!d) continue; var e = Math.hypot(X[2 * i] - X[2 * j], X[2 * i + 1] - X[2 * j + 1]); num += e / d; den += e * e / (d * d); }
    var sc = num / den, st = 0, cnt = 0;
    for (i = 0; i < k; i++) for (j = i + 1; j < k; j++) { d = D[j * S + i]; if (!d) continue; var e2 = Math.hypot(X[2 * i] - X[2 * j], X[2 * i + 1] - X[2 * j + 1]); st += Math.pow(d - sc * e2, 2) / (d * d); cnt++; }
    return st / cnt;
  }
  var graphFor = function (kind, n) { return GEN.graph(kind, n, 11); };
  function cpuBest(g) {
    var dg = C.derive(JSON.parse(JSON.stringify(g))), t0 = now(), L = E.build(dg, { view: 'network', arrange: 'stressBest', colorBy: 'group' }), ms = now() - t0, pos = new Map();
    L.nodes.forEach(function (nd) { pos.set(nd.nodeId || nd.id, [nd.cx, nd.cy]); }); return { ms: ms, pos: pos };
  }
  var fmtMs = function (ms) { return ms >= 1000 ? (ms / 1000).toFixed(ms >= 10000 ? 1 : 2) + ' s' : Math.round(ms) + ' ms'; };

  /* ------------------------------------------------------------- the checks */
  var ctx = { dev: null, gpuNote: '' };
  var STEPS = [];

  STEPS.push({ name: 'Your computer', run: async function () {
    var s = addSection('Your computer'), ua = navigator.userAgent, rows = [];
    rows.push(['Browser', ua]); rows.push(['Processor threads', String(navigator.hardwareConcurrency || '?')]); rows.push(['Memory hint (GB)', String(navigator.deviceMemory || 'not shared by this browser')]); rows.push(['Screen', screen.width + ' x ' + screen.height + ' at ' + (window.devicePixelRatio || 1) + 'x']);
    var gpuLine = '', level = 'ok', say;
    var glName = ''; try { var cv = document.createElement('canvas'), gl = cv.getContext('webgl2') || cv.getContext('webgl'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); glName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { glName = ''; }
    if (glName) rows.push(['Graphics (as the page sees it)', glName]);
    var dev = await G.getDevice().catch(function (e) { return { error: String(e && e.message || e) }; });
    if (dev.error) { level = 'warn'; say = 'No graphics-card computing in this browser (' + dev.error + ')' + (dev.noAdapter ? ' If an earlier test run upset the graphics driver, Firefox keeps refusing it until it is fully closed: quit every Firefox window (also from the tray), open it again, then open this file.' : '') + ' The graphics-card checks will be skipped; everything else still runs. ' + (/firefox/i.test(ua) ? 'In Firefox, WebGPU is on by default in recent versions on some systems; on others it may need switching on.' : ''); rows.push(['Graphics-card computing (WebGPU)', 'not available']); }
    else {
      ctx.dev = dev; rows.push(['Graphics-card computing (WebGPU)', 'available']); rows.push(['Graphics adapter', dev.info]); rows.push(['Largest buffer it allows', Math.round(dev.limits.maxStorageBufferBindingSize / 1048576) + ' MB']);
      if (dev.software) { level = 'warn'; say = 'WebGPU is there, but it is a software stand-in (' + dev.info + '), not a real graphics card, so graphics-card timings will not mean much.'; ctx.softGpu = true; }
      else say = 'Graphics-card computing is available on: ' + dev.info + '.';
    }
    s.head = ['Item', 'Value']; s.rows = rows; s.finish(level, say);
    ctx.info = { ua: ua, threads: navigator.hardwareConcurrency, mem: navigator.deviceMemory || null, gpu: dev.error ? null : dev.info, gl: glName, soft: !!dev.software, bufMB: dev.limits ? Math.round(dev.limits.maxStorageBufferBindingSize / 1048576) : null };
    return { level: level, say: say };
  } });

  STEPS.push({ name: 'Is the graphics-card answer right?', run: async function () {
    var s = addSection('Is the graphics-card answer right?');
    if (!ctx.dev) { s.finish('warn', 'Skipped: no graphics-card computing here.'); return { level: 'warn', say: 'skipped' }; }
    var n = QUICK ? 600 : 1200, g = graphFor('moderate', n), P = piece(g), steps = 20;
    setStatus('Checking the graphics-card hop table and steps on ' + P.k + ' items…'); await yieldUI();
    var res = await G.layout(ctx.dev, P.off, P.nbr, P.k, EDGE, { steps: steps, keepTable: true, omega: 1.2 });
    if (res.error) { s.finish('bad', 'The graphics-card version failed: ' + res.error); return { level: 'bad', say: res.error }; }
    var S = res.stride, D = fullTable(P), bad = 0, i, j;
    for (i = 0; i < P.k; i++) for (j = 0; j < P.k; j++) if (D[j * S + i] !== res.dTable[j * S + i]) bad++;
    var Xc = G.majCpu(res.X0, D, P.k, S, EDGE, steps, 1.2), sg = pairStress(res.X, D, P.k, S), sc = pairStress(Xc, D, P.k, S), s0 = pairStress(res.X0, D, P.k, S);
    var diff = Math.abs(sg - sc) / sc * 100, move = 0; for (i = 0; i < P.k; i++) move += Math.hypot(res.X[2 * i] - Xc[2 * i], res.X[2 * i + 1] - Xc[2 * i + 1]); move = move / P.k / EDGE;
    var okTable = bad === 0, okSteps = diff < 1 && move < 0.05;
    setStatus('Checking the parallel-pairs method on ' + P.k + ' items…'); await yieldUI();
    var r2 = await G.layout(ctx.dev, P.off, P.nbr, P.k, EDGE, { method: 'sgd', keepTable: true }), okSgd = false, sgdRows = [], sdiff = 0, smove = 0;
    if (r2.error) { sgdRows.push(['Parallel pairs: failed', r2.error.slice(0, 80)]); }
    else {
      var sch0 = G.sgdSchedule(P.k, r2.sched.sweeps, r2.maxD, r2.seed, r2.sched.hi, r2.sched.lo, r2.sched.smooth), pm0 = G.permFor(P.k, r2.seed), Xq = G.sgdCpu(r2.X0, D, P.k, S, EDGE, sch0, pm0), sg2 = pairStress(r2.X, D, P.k, S), sq = pairStress(Xq, D, P.k, S);
      sdiff = Math.abs(sg2 - sq) / sq * 100; for (i = 0; i < P.k; i++) smove += Math.hypot(r2.X[2 * i] - Xq[2 * i], r2.X[2 * i + 1] - Xq[2 * i + 1]); smove = smove / P.k / EDGE;
      okSgd = sdiff < 2;   // positions can drift apart (many tiny steps, 32-bit against 64-bit), the distance error is what must agree
      sgdRows.push(['Parallel pairs (' + r2.sweeps + ' sweeps): CPU math / graphics card', r3(sq) + ' / ' + r3(sg2)], ['Parallel pairs: difference / average item difference', r1(sdiff) + '% / ' + r3(smove)]);
    }
    s.head = ['Check', 'Result']; s.rows = [['Items', String(P.k)], ['Hop table: entries that differ from the CPU table', bad + ' of ' + (P.k * P.k)], ['Distance error at the start (sketch)', r3(s0)], ['After ' + steps + ' steps, CPU math', r3(sc)], ['After ' + steps + ' steps, graphics card', r3(sg)], ['Difference', r1(diff) + '%'], ['Average item difference (share of one link)', r3(move)]].concat(sgdRows);
    okSteps = okSteps && okSgd; var level = okTable && okSteps ? 'ok' : 'bad';
    var say = okTable && okSteps ? 'Yes. The graphics card builds the same hop table as the processor, and its steps give the same picture (distance error ' + r3(sg) + ' against ' + r3(sc) + ' on the processor).' : (!okTable ? 'No: the hop table built on the graphics card differs from the processor\'s in ' + bad + ' entries.' : 'The hop table matches, but the answer differs from the processor\'s (steps ' + r1(diff) + '%, parallel pairs ' + r1(sdiff) + '% in distance error).');
    s.finish(level, say); ctx.correct = { table: okTable, steps: okSteps, bad: bad, diffPct: r1(diff), move: r3(move), sgdDiffPct: r1(sdiff), sgdMove: r3(smove), sgdOk: okSgd };
    return { level: level, say: say };
  } });

  STEPS.push({ name: 'How fast and how true?', run: async function () {
    var s = addSection('How fast and how true is the graphics-card version?');
    if (!ctx.dev) { s.finish('warn', 'Skipped: no graphics-card computing here.'); return { level: 'warn', say: 'skipped' }; }
    var plan = QUICK ? [['moderate', 800], ['complex', 800]] : [['moderate', 2000], ['moderate', 5000], ['moderate', 10000], ['complex', 5000], ['complex', 10000], ['moderate', 20000], ['moderate', 30000]];
    if (params.get('plan')) plan = params.get('plan').split(',').map(function (x) { var a = x.split(':'); return [a[0], +a[1]]; });
    s.head = ['Network', 'Items', 'Processor time', 'Processor truth', 'Old steps time', 'Old steps truth', 'One smooth sweep time', 'truth', 'App path with the card: whole build time', 'truth after clean-up', 'Faster by (app path)']; var summary = [], wins = 0, tried = 0, ratios = [], truthOk = 0;
    for (var pi = 0; pi < plan.length; pi++) {
      var kind = plan[pi][0], n = plan[pi][1]; setStatus('Best quality, ' + kind + ' ' + n.toLocaleString() + ' items: processor…'); await yieldUI();
      var g = graphFor(kind, n), P = piece(g), cb = cpuBest(g), Xc = new Float64Array(2 * P.k);
      P.ids.forEach(function (id, i) { var p = cb.pos.get(id); Xc[2 * i] = p[0]; Xc[2 * i + 1] = p[1]; });
      var tc = truth(P, Xc); setStatus('Best quality, ' + kind + ' ' + n.toLocaleString() + ' items: graphics card…'); await yieldUI();
      var res = await G.layout(ctx.dev, P.off, P.nbr, P.k, EDGE, { steps: 40, snapshots: [20, 30] });
      if (res.error) { s.rows.push([kind, n.toLocaleString(), fmtMs(cb.ms), r3(tc), res.tooBig ? 'does not fit' : 'failed', '-', '-', '-', '-', '-', String(res.error).slice(0, 60)]); summary.push({ kind: kind, n: n, cpuMs: r1(cb.ms), cpuTruth: r3(tc), gpuError: res.error }); continue; }
      setStatus('Best quality, ' + kind + ' ' + n.toLocaleString() + ' items: graphics card, parallel pairs…'); await yieldUI();
      var rs = await G.layout(ctx.dev, P.off, P.nbr, P.k, EDGE, { method: 'sgd' });
      var tg = truth(P, res.X), t20 = truth(P, res.snapshots[20]), t30 = truth(P, res.snapshots[30]), ts = rs.error ? null : truth(P, rs.X);
      /* the whole app path with the card's picture: the engine asks for the picture of the big piece, the card makes it, the engine goes on with its own clean-up */
      setStatus('Best quality, ' + kind + ' ' + n.toLocaleString() + ' items: card picture through the app\'s clean-up…'); await yieldUI();
      var dgA = C.derive(JSON.parse(JSON.stringify(g))), TU = E.stressTuning, cap = null, whole = null, rg = null, tw = null, gpuMs = 0, capErr = null;
      TU.external = function (X, k, off, nbr) { if (!cap) { cap = { k: k, off: Uint32Array.from(off), nbr: Uint32Array.from(nbr) }; throw new Error('captured'); } return false; };
      try { E.build(dgA, { view: 'network', arrange: 'stressBest', colorBy: 'group' }); } catch (e) { if (!cap) capErr = String(e && e.message || e); }
      if (cap && cap.k === P.k) {
        rg = await G.layout(ctx.dev, cap.off, cap.nbr, cap.k, EDGE, G.recommend(cap.k));
        if (!rg.error) {
          var t1 = now(); TU.external = function (X, k) { if (k !== cap.k) return false; for (var q2 = 0; q2 < 2 * k; q2++) X[q2] = rg.X[q2]; return true; };
          var LA = E.build(dgA, { view: 'network', arrange: 'stressBest', colorBy: 'group' }); whole = now() - t1 + rg.ms.total;
          var pa = new Map(); LA.nodes.forEach(function (nd) { pa.set(nd.nodeId || nd.id, [nd.cx, nd.cy]); }); var Xa = new Float64Array(2 * P.k); P.ids.forEach(function (id, i2) { var p2 = pa.get(id); Xa[2 * i2] = p2[0]; Xa[2 * i2 + 1] = p2[1]; }); tw = truth(P, Xa);
        }
      }
      TU.external = null;
      var bestMs = whole === null ? Math.min(res.ms.total, rs.error ? 1e12 : rs.ms.total) : whole, ratio = cb.ms / bestMs; tried++; ratios.push(ratio); if (ratio > 1) wins++;
      var bestT = tw === null ? Math.min(tg, ts === null ? 9 : ts) : tw; if (bestT <= tc * 1.03) truthOk++;
      if (tg > Math.min(t20, t30) * 1.05) s.notes.push('At ' + P.k.toLocaleString() + ' items the old steps ran away (truth ' + r3(t20) + ' at 20 steps, ' + r3(t30) + ' at 30, ' + r3(tg) + ' at 40).');
      if (whole === null) s.notes.push('At ' + P.k.toLocaleString() + ' items the app path with the card\'s picture did not run' + (capErr ? ' (' + capErr + ')' : rg && rg.error ? ' (' + String(rg.error).slice(0, 80) + ')' : '') + '.');
      s.rows.push([kind, P.k.toLocaleString(), fmtMs(cb.ms), r3(tc), fmtMs(res.ms.total), r3(tg), rs.error ? 'failed' : fmtMs(rs.ms.total), ts === null ? '-' : r3(ts), whole === null ? '-' : fmtMs(whole), tw === null ? '-' : r3(tw), r1(ratio) + '×']);
      summary.push({ kind: kind, n: P.k, cpuMs: r1(cb.ms), cpuTruth: r3(tc), gpuMs: r1(res.ms.total), gpuTruth: r3(tg), sgdMs: rs.error ? null : r1(rs.ms.total), sgdTruth: ts === null ? null : r3(ts), sgdError: rs.error || null, appMs: whole === null ? null : r1(whole), appTruth: tw === null ? null : r3(tw), appMethod: rg && !rg.error ? rg.method + (rg.sched ? ' ' + rg.sched.sweeps + ' sweeps' : ' ' + 40 + ' steps') : null, appGpuMs: rg && !rg.error ? r1(rg.ms.total) : null, parts: { sketch: r1(res.ms.start), setup: r1(res.ms.upload), stepsAndTable: r1(res.ms.steps), read: r1(res.ms.read) }, sgdParts: rs.error ? null : { stepsAndTable: r1(rs.ms.steps), read: r1(rs.ms.read) }, split: res.split, levels: res.levels, t20: r3(t20), t30: r3(t30) });
      doneSteps += 0.1; setBar();
    }
    ctx.ladder = summary;
    var level, say;
    if (!tried) { level = 'warn'; say = 'The graphics-card version could not run at these sizes.'; }
    else {
      ratios.sort(function (a, b) { return a - b; }); var med = ratios[ratios.length >> 1];
      level = ctx.softGpu ? 'warn' : (wins === tried && truthOk === tried ? 'ok' : wins ? 'warn' : 'bad');
      say = 'The best graphics-card version was faster in ' + wins + ' of ' + tried + ' runs (middle ' + r1(med) + '×), and as true or truer (within 3%) in ' + truthOk + ' of ' + tried + '. Truth: lower is truer.' + (ctx.softGpu ? ' (Software stand-in, not a real graphics card.)' : '');
    }
    s.notes.push('Above 20,000 items the app\'s best quality falls back to the quick sample, so the processor truth there is the quick one.');
    s.notes.push('Processor time and the app-path time are both whole builds (flow analysis, arrangement, clean-up). The "old steps" and "one smooth sweep" columns are the card\'s raw picture only: 60-pivot sketch (made while the card builds the table), hop table, steps or sweeps, read-back, without the app\'s overlap clean-up. The app path uses two smooth sweeps up to 12,500 items and 40 old steps above, then the engine\'s own spread, push-apart and settle on the card\'s picture.');
    s.finish(level, say); return { level: level, say: say };
  } });

  STEPS.push({ name: 'Old kernel against new', run: async function () {
    var s = addSection('Parallel-pairs variants');
    if (!ctx.dev) { s.finish('warn', 'Skipped: no graphics-card computing here.'); return { level: 'warn', say: 'skipped' }; }
    var n = QUICK ? 800 : 10000, big = QUICK ? 1200 : 30000, variants = [
      ['complex', 'one smooth sweep (new default)', { method: 'sgd' }],
      ['complex', 'two smooth sweeps', { method: 'sgd', sweeps: 2 }],
      ['complex', 'one smooth sweep + 5 clean-up steps', { method: 'sgd', polish: 5 }],
      ['complex', 'one smooth sweep, bigger first step (0.1)', { method: 'sgd', hi: 0.1 }],
      ['complex', 'one smooth sweep, smaller steps (0.02)', { method: 'sgd', hi: 0.02, lo: 0.02 }],
      ['complex', 'three sweeps, steps shrink per sweep', { method: 'sgd', classic: true, sweeps: 3 }],
      ['complex', 'old steps, relaxed 1.2, 40', { kernel: 'v2', omega: 1.2, steps: 40 }],
      ['moderate', 'one smooth sweep (new default)', { method: 'sgd' }],
      ['moderate', 'two smooth sweeps', { method: 'sgd', sweeps: 2 }],
      ['moderate', 'three smooth sweeps', { method: 'sgd', sweeps: 3 }],
      ['moderate', 'one smooth sweep + 5 clean-up steps', { method: 'sgd', polish: 5 }],
      ['moderate', 'three sweeps, steps shrink per sweep', { method: 'sgd', classic: true, sweeps: 3 }],
      ['moderate', 'one smooth sweep', { method: 'sgd' }, big],
      ['moderate', 'old steps, relaxed 1.2, 40', { kernel: 'v2', omega: 1.2, steps: 40 }, big]];
    s.head = ['Network', 'Variant', 'Total time', 'Truth']; var cache = {}, out = [];
    for (var vi = 0; vi < variants.length; vi++) {
      var kind = variants[vi][0], name = variants[vi][1], o = variants[vi][2], nn = variants[vi][3] || n; setStatus('Program comparison: ' + kind + ' ' + name + '…'); await yieldUI();
      var P = cache[kind + nn] || (cache[kind + nn] = piece(graphFor(kind, nn))), res = await G.layout(ctx.dev, P.off, P.nbr, P.k, EDGE, o);
      if (res.error) { s.rows.push([kind, name, 'failed: ' + res.error.slice(0, 40), '']); continue; }
      var tt = truth(P, res.X);
      s.rows.push([kind + ' ' + P.k.toLocaleString(), name, fmtMs(res.ms.total), r3(tt)]);
      out.push({ kind: kind, n: P.k, variant: name, totalMs: r1(res.ms.total), truth: r3(tt), split: res.split });
    }
    var prof = null;
    if (out.length) {
      var Pm = cache['moderate' + n] || cache['complex' + n]; setStatus('Program comparison: timing each part…'); await yieldUI();
      var rp = await G.layout(ctx.dev, Pm.off, Pm.nbr, Pm.k, EDGE, { method: 'sgd', profile: true });
      if (!rp.error) { prof = { sketch: r1(rp.ms.start), setup: r1(rp.ms.upload), tableAndWeights: r1(rp.ms.table), steps60: r1(rp.ms.steps), read: r1(rp.ms.read), levels: rp.levels }; s.rows.push(['moderate ' + Pm.k.toLocaleString(), 'parts (parallel pairs): sketch / setup / table+weights / sweeps / read-back', prof.sketch + ' / ' + prof.setup + ' / ' + prof.tableAndWeights + ' / ' + prof.steps60 + ' / ' + prof.read + ' ms', '']); }
    }
    ctx.kernels = { n: n, variants: out, parts: prof };
    var say = out.length >= 2 ? 'Ran ' + out.length + ' variants; compare time and truth in the table.' : 'Not enough runs finished to compare.';
    s.finish(out.length >= 2 ? 'ok' : 'warn', say); return { level: 'ok', say: say };
  } });

  /* ------------------------------------------------------------- where the drawing time goes: WebGPU phases, several loop shapes, WebGL 2 as the control */
  STEPS.push({ name: 'Where the drawing time goes (WebGPU)', run: async function () {
    var s = addSection('Where the drawing time goes: WebGPU against WebGL 2'), n = params.get('plan3d') ? Number(params.get('plan3d').split(',')[0]) : QUICK ? 600 : 1000;
    s.head = ['Way of drawing', 'Pictures per second', 'New angle (ms)', 'Copy to card (ms)', 'Draw commands (ms)', 'Wait for card (ms)', 'Wait for refresh (ms)'];
    setStatus('Where the drawing time goes: building a ' + n.toLocaleString() + '-item 3D map…'); await yieldUI();
    var g = graphFor('moderate', n), dg = C.derive(JSON.parse(JSON.stringify(g))), L3 = E.build(dg, { view: 'network', arrange: 'force3d', colorBy: 'group' });
    var mk = function (yaw, pitch) { return NFMScene.make(L3, { plan: true, colorBy: 'group', theme: 'light', cam: { yaw: yaw, pitch: pitch, persp: 2.4 } }); };
    var c = await NFMProbe.canary(), gpu = null, ctl = null, row = function (nm, w) { return [nm + ': ' + w.label, r1(w.fps), r1(w.scene), r1(w.upload), r1(w.draw), r1(w.fence), r1(w.raf)]; };
    if (!c.webgpu.ok) { var why = 'WebGPU is not usable here' + (c.webgpu.why ? ' (' + c.webgpu.why + ')' : '') + ', so there is nothing to time. Nothing is wrong with the app: it draws with WebGL 2 or basic drawing instead.'; ctx.timing = { skipped: why }; s.finish('warn', why); return { level: 'warn', say: why }; }
    setStatus('Where the drawing time goes: timing WebGPU (about 8 seconds)…'); await yieldUI();
    gpu = await NFMProbe.frameTiming({ backend: 'webgpu', W: 900, H: 600, makeScene: mk });
    if (c.webgl2.ok) { setStatus('Where the drawing time goes: timing WebGL 2 as the control…'); await yieldUI(); ctl = await NFMProbe.frameTiming({ backend: 'webgl2', W: 900, H: 600, makeScene: mk }); }
    if (gpu.ways) gpu.ways.forEach(function (w) { s.rows.push(row('WebGPU', w)); });
    if (ctl && ctl.ways) ctl.ways.forEach(function (w) { s.rows.push(row('WebGL 2', w)); });
    var ex = NFMProbe.explainTiming(gpu, ctl && ctl.ways ? ctl : null);
    ex.lines.forEach(function (t) { s.notes.push(t); });
    if (ctl && ctl.skipped) s.notes.push('The WebGL 2 control was skipped: ' + ctl.skipped + '.');
    if (ctl && c.webgl2.software) s.notes.push('WebGL 2 here runs on the processor, so it is not a fair control.');
    s.notes.push('Each row draws the same ' + n.toLocaleString() + '-item 3D map, one picture per screen refresh from a new angle, for up to 60 pictures or 0.7 seconds; the times are averages per picture. "New angle" is working the picture out on the main thread, "Copy to card" is putting it into graphics memory, "Draw commands" is encoding and handing them over, "Wait for card" is how long the loop waited for the graphics card to report it was done (or, for "up to 3 pictures in flight", for the oldest picture), and "Wait for refresh" is the wait for the next screen refresh. "Blank picture" draws nothing at all: it is the least a browser can do per picture. Run the step twice and trust only what repeats.');
    ctx.timing = { items: n, device: gpu.device || '', software: !!gpu.software, webgpu: gpu.ways || gpu.skipped, webgl2: ctl && (ctl.ways || ctl.skipped) || null, fastest: ex.fastest, dominant: ex.dominant };
    s.finish(ex.level, ex.say); return { level: ex.level, say: ex.say };
  } });

  (params.get('extras') ? STEPS : []).push({ name: 'Hop table groups', run: async function () {
    var s = addSection('Hop table: how many start items to walk together');
    if (!ctx.dev) { s.finish('warn', 'Skipped: no graphics-card computing here.'); return { level: 'warn', say: 'skipped' }; }
    var n = QUICK ? 1200 : 20000, P = piece(graphFor('moderate', n)), rows = [], best = null;
    s.head = ['Start items walked together', 'Hop table time', 'Whole job']; ctx.groups = [];
    for (var gv = 0; gv < 5; gv++) {
      var grp = [1, 2, 4, 8, 16][gv]; setStatus('Hop table, ' + grp * 32 + ' start items at a time…'); await yieldUI();
      var res = await G.layout(ctx.dev, P.off, P.nbr, P.k, EDGE, { steps: 1, profile: true, group: grp });
      if (res.error) { s.rows.push([String(grp * 32), 'failed', res.error.slice(0, 50)]); continue; }
      s.rows.push([String(grp * 32), fmtMs(res.ms.table), fmtMs(res.ms.total)]); ctx.groups.push({ group: grp * 32, tableMs: r1(res.ms.table), totalMs: r1(res.ms.total) });
      if (!best || res.ms.table < best.ms) best = { g: grp * 32, ms: res.ms.table };
    }
    var say = best ? 'At ' + P.k.toLocaleString() + ' items the table is quickest with ' + best.g + ' start items at a time (' + fmtMs(best.ms) + ').' : 'No run finished.';
    s.finish(best ? 'ok' : 'warn', say); return { level: 'ok', say: say };
  } });

  (params.get('extras') ? STEPS : []).push({ name: 'Cold start', run: async function () {
    var s = addSection('First run against later runs (cold start)'), sizes = QUICK ? [300] : [500, 2000], rows = [], firstSlow = [];
    s.head = ['Items', 'Step', 'First run', 'Second run', 'Third run'];
    for (var zi = 0; zi < sizes.length; zi++) {
      var n = sizes[zi]; setStatus('Cold start, ' + n + ' items…'); await yieldUI();
      var runs = [];
      for (var k = 0; k < 3; k++) {
        var c = GEN.csv('moderate', n, 21 + k), r = {}, t0, imp, dg;
        t0 = now(); I.parseDelimited(c.text, ','); r.parse = now() - t0;
        t0 = now(); imp = I.importAny(c.text, { name: 'x.csv', maxNodes: 1e7, maxEdges: 5e7 }); r.import = now() - t0;
        t0 = now(); dg = C.derive(imp.graph); E.prepare(dg, {}); r.prepare = now() - t0;
        t0 = now(); K.run(imp.graph, {}); r.check = now() - t0;
        t0 = now(); E.build(dg, { view: 'flow', colorBy: 'group' }); r.flow = now() - t0;
        t0 = now(); E.build(dg, { view: 'network', arrange: 'stress', colorBy: 'group' }); r.stress = now() - t0;
        t0 = now(); E.build(dg, { view: 'network', arrange: 'force', colorBy: 'group' }); r.force = now() - t0;
        r.total = r.parse + r.import + r.prepare + r.check + r.flow + r.stress + r.force; runs.push(r); await yieldUI();
      }
      ['parse', 'import', 'prepare', 'check', 'flow', 'stress', 'force', 'total'].forEach(function (key) { s.rows.push([n.toLocaleString(), key, fmtMs(runs[0][key]), fmtMs(runs[1][key]), fmtMs(runs[2][key])]); });
      firstSlow.push({ n: n, first: r1(runs[0].total), second: r1(runs[1].total), third: r1(runs[2].total) });
    }
    ctx.cold = firstSlow; var f = firstSlow[firstSlow.length - 1], extra = f.first - Math.min(f.second, f.third);
    var say = 'For a ' + f.n.toLocaleString() + '-item file the first run took ' + fmtMs(f.first) + ' and later runs ' + fmtMs(Math.min(f.second, f.third)) + ': about ' + fmtMs(Math.max(0, extra)) + ' (' + Math.max(0, Math.round(100 * extra / f.first)) + '%) is warm-up cost.';
    s.finish('ok', say); return { level: 'ok', say: say };
  } });


  /* ------------------------------------------------------------- 3D: layouts, turning speed, spinning previews */
  var previews = [];
  /** A draggable, spinning picture of a 3D layout, drawn with the app's own scene and renderer. Spins when visible; click to pause; drag to turn; wheel to zoom. */
  async function addPreview(card, L3, title, backend) {
    var wrap = document.createElement('div'); wrap.style.cssText = 'margin:8px 0'; var cap = document.createElement('div'); cap.className = 'note'; cap.textContent = title + ' (drag to turn, wheel to zoom, click to pause)'; wrap.appendChild(cap);
    var host = document.createElement('div'); host.style.cssText = 'position:relative;width:100%;height:320px;border:1px solid var(--line);border-radius:8px;overflow:hidden;touch-action:none;cursor:grab'; wrap.appendChild(host); card.appendChild(wrap);
    var make = backend === 'webgpu' ? NFMRender.createWebGPU : backend === 'webgl2' ? NFMRender.createWebGL2 : NFMRender.createCanvas2D, r;
    try { r = await make(host, {}); } catch (e) { cap.textContent = title + ': could not draw the preview (' + String(e && e.message || e).slice(0, 80) + ')'; return; }
    var W = host.clientWidth || 600, H = 320, st = { yaw: 0.6, pitch: 0.35, zoom: 1, paused: false, drag: null, visible: true };
    var draw = function () { var sc = NFMScene.make(L3, { plan: true, colorBy: 'group', theme: matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light', cam: { yaw: st.yaw, pitch: st.pitch, persp: 2.4 } }); r.setScene(sc); r.resize(W, H, 1); var v = NFMProbe.fitView(sc, W, H); v.k *= st.zoom; v.tx = W / 2 - (W / 2 - v.tx) * st.zoom; v.ty = H / 2 - (H / 2 - v.ty) * st.zoom; r.draw(v); };
    host.addEventListener('pointerdown', function (e) { st.drag = { x: e.clientX, y: e.clientY, moved: false }; host.setPointerCapture(e.pointerId); host.style.cursor = 'grabbing'; });
    host.addEventListener('pointermove', function (e) { if (!st.drag) return; var dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) st.drag.moved = true; st.drag.x = e.clientX; st.drag.y = e.clientY; st.yaw += dx * 0.01; st.pitch = Math.max(-1.4, Math.min(1.4, st.pitch + dy * 0.01)); draw(); });
    host.addEventListener('pointerup', function () { if (st.drag && !st.drag.moved) st.paused = !st.paused; st.drag = null; host.style.cursor = 'grab'; });
    host.addEventListener('wheel', function (e) { e.preventDefault(); st.zoom = Math.max(0.4, Math.min(4, st.zoom * Math.exp(-e.deltaY * 0.001))); draw(); }, { passive: false });
    if (typeof IntersectionObserver !== 'undefined') new IntersectionObserver(function (en) { st.visible = en[0].isIntersecting; }).observe(host);
    draw(); previews.push({ st: st, draw: draw });
  }
  function startPreviews() {
    if (!previews.length || startPreviews.on) return; startPreviews.on = true; var last = 0;
    (function tick(ts) { if (ts - last > 33 && !document.hidden) { last = ts; previews.forEach(function (p) { if (p.st.visible && !p.st.paused && !p.st.drag) { p.st.yaw += 0.012; p.draw(); } }); } requestAnimationFrame(tick); })(0);
  }
  STEPS.push({ name: '3D arrangements and turning', run: async function () {
    var s = addSection('3D arrangements: build time, and how smoothly they turn'), sizes = params.get('plan3d') ? params.get('plan3d').split(',').map(Number) : QUICK ? [600] : [1000, 3000, 10000, 30000, 60000, 100000], kinds = [['force3d', '3D force'], ['sphere', 'Sphere'], ['stack', 'Stacked group planes']];
    s.head = ['Items', 'Arrangement', 'Build time', 'Hop error in 3D']; var scenes = [], previewL = null;
    for (var zi = 0; zi < sizes.length; zi++) for (var ki = 0; ki < kinds.length; ki++) {
      var n = sizes[zi], ar = kinds[ki][0]; setStatus('3D, ' + n.toLocaleString() + ' items: ' + kinds[ki][1] + '…'); await yieldUI();
      if (n > 30000 && ar === 'force3d') { s.rows.push([n.toLocaleString(), kinds[ki][1], 'not built here', 'the app builds it in the background; one page would freeze too long']); continue; }
      var g = graphFor('moderate', n), P = piece(g), dg = C.derive(JSON.parse(JSON.stringify(g))), t0 = now(), L3;
      try { L3 = E.build(dg, { view: 'network', arrange: ar, colorBy: 'group' }); } catch (e) { s.rows.push([n.toLocaleString(), kinds[ki][1], 'failed', String(e && e.message || e).slice(0, 40)]); continue; }
      var ms = now() - t0, X = new Float64Array(3 * P.k), pm = new Map(); L3.nodes.forEach(function (nd) { pm.set(nd.nodeId || nd.id, nd); });
      P.ids.forEach(function (id, i) { var nd = pm.get(id) || { cx: 0, cy: 0, z: 0 }; X[3 * i] = nd.cx; X[3 * i + 1] = nd.cy; X[3 * i + 2] = nd.z || 0; });
      s.rows.push([n.toLocaleString(), kinds[ki][1], fmtMs(ms), r3(truth(P, X, 3))]);
      if (ar === 'force3d' || (n > 30000 && ar === 'sphere')) scenes.push({ n: n, L3: L3, lay: ar === 'sphere' ? ', sphere layout' : '' }); if (!previewL && ar === 'force3d') previewL = { L3: L3, n: n };
      await yieldUI();
    }
    /* turning speed with each usable way of drawing, on the force layout of each size */
    var c = await NFMProbe.canary(), names = ['canvas2d']; if (c.webgl2.ok && !c.webgl2.software) names.push('webgl2'); if (c.webgpu.ok && !c.webgpu.software) names.push('webgpu');
    var turnRows = [], best = null, warmNotes = []; ctx.turn = [];
    for (var si = 0; si < scenes.length; si++) for (var bi = 0; bi < names.length; bi++) {
      setStatus('Turning a ' + scenes[si].n.toLocaleString() + '-item 3D map with ' + names[bi] + '…'); await yieldUI();
      var Lx = scenes[si].L3, nm = names[bi] === 'webgpu' ? 'WebGPU' : names[bi] === 'webgl2' ? 'WebGL 2' : 'Basic drawing';
      if (names[bi] === 'canvas2d' && scenes[si].n > 3000) continue;   /* far too slow to be worth timing */
      var t = scenes[si].n > 30000 ? { skipped: 'far too slow to be worth timing' } : await NFMProbe.turning({ backend: names[bi], W: 900, H: 600, makeScene: function (yaw, pitch) { return NFMScene.make(Lx, { plan: true, colorBy: 'group', theme: 'light', cam: { yaw: yaw, pitch: pitch, persp: 2.4 } }); } });
      if (t.fps) { turnRows.push([scenes[si].n.toLocaleString() + ' items' + scenes[si].lay + ', ' + nm + ', every angle worked out here', Math.round(t.fps), r1(t.sceneMs), r1(t.drawMs)]); ctx.turn.push({ n: scenes[si].n, backend: names[bi], way: 'here', fps: r1(t.fps), sceneMs: r1(t.sceneMs), drawMs: r1(t.drawMs) }); }
      else turnRows.push([scenes[si].n.toLocaleString() + ' items' + scenes[si].lay + ', ' + nm + ', every angle worked out here', 'skipped', '-', String(t.skipped).slice(0, 40)]);
      if (names[bi] === 'canvas2d') continue;
      /* the way the app turns a big 3D map: the map sits on the graphics card, each picture is only a new angle */
      setStatus('Turning a ' + scenes[si].n.toLocaleString() + '-item 3D map with ' + names[bi] + ', math on the card…'); await yieldUI();
      var tc = await NFMProbe.turning({ backend: names[bi], W: 900, H: 600, rigScene: function (yaw, pitch) { return NFMScene.make(Lx, { plan: {}, rig: true, colorBy: 'group', theme: 'light', cam: { yaw: yaw, pitch: pitch, persp: 2.4 } }); } });
      if (tc.fps) { if (tc.warmMs > 400) warmNotes.push('Starting to turn the ' + scenes[si].n.toLocaleString() + '-item map with ' + nm + ': the first 24 pictures took ' + Math.round(tc.warmMs).toLocaleString() + ' ms (one-time setup on the card), then steady turning is timed below.'); turnRows.push([scenes[si].n.toLocaleString() + ' items' + scenes[si].lay + ', ' + nm + ', math on the card', Math.round(tc.fps), r1(tc.sceneMs), r1(tc.drawMs)]); ctx.turn.push({ n: scenes[si].n, backend: names[bi], way: 'card', warmMs: Math.round(tc.warmMs || 0), fps: r1(tc.fps), sceneMs: r1(tc.sceneMs), drawMs: r1(tc.drawMs) }); if (scenes[si].n === sizes[sizes.length - 1] && (!best || tc.fps > best.fps)) best = tc; }
      else turnRows.push([scenes[si].n.toLocaleString() + ' items' + scenes[si].lay + ', ' + nm + ', math on the card', 'skipped', '-', String(tc.skipped).slice(0, 60)]);
    }
    s.rows.push(['', '', '', '']); s.rows.push(['Turning speed', 'Pictures per second', 'New angle (ms)', 'Draw (ms)']); turnRows.forEach(function (r) { s.rows.push(r); });
    if (previewL) { $('show').style.display = ''; await addPreview($('show'), previewL.L3, '3D force, ' + previewL.n.toLocaleString() + ' items', names[names.length - 1]); }
    s.notes.push('Hop error in 3D uses the same measure as the distance error but with three dimensions; it is lower than a flat map would give and is not colored, because the bands are for flat maps. The sphere and stacked planes are shapes first, so their hop error is higher by design. "New angle" is the time to work out the picture from the new viewing angle (done on the main thread, once per picture); "Draw" is the time to hand it to the screen.');
    warmNotes.forEach(function (w) { s.notes.push(w); });
    s.notes.push('"Math on the card" is how the app turns a big 3D map: the items and links are put on the graphics card once, and each picture is only a new angle, so "New angle" is just the paint order and the few names that can be seen. "Every angle worked out here" is the older way, kept for comparison.');
    var say, level = 'ok';
    if (!best) { say = 'Built the 3D arrangements, but could not time turning (the page may have been in the background).'; level = 'warn'; }
    else { say = 'Turning a ' + sizes[sizes.length - 1].toLocaleString() + '-item 3D map with the math done on the graphics card ran at about ' + Math.round(best.fps) + ' pictures per second (' + r1(best.sceneMs) + ' ms to work out each new angle, ' + r1(best.drawMs) + ' ms to draw).' + (best.fps >= 45 ? ' Smooth.' : best.fps >= 20 ? ' Usable but a little steppy.' : ' Choppy.'); level = best.fps >= 45 ? 'ok' : best.fps >= 20 ? 'warn' : 'bad'; }
    s.finish(level, say);
    /* the largest map again, taken apart: what holds the turning below 60 pictures per second */
    var sp = addSection('Turning the largest map: where the time goes'), big = scenes[scenes.length - 1], splitSays = [], splitLevel = 'ok'; sp.head = ['Way', 'Pictures per second', 'Typical picture (ms)', 'Slowest 1 in 20 (ms)', 'Slowest (ms)', 'Angle math (ms)', 'Card per picture (ms)']; ctx.split = [];
    if (big) for (var bj = 0; bj < names.length; bj++) {
      if (names[bj] === 'canvas2d') continue;
      var nm2 = names[bj] === 'webgpu' ? 'WebGPU' : 'WebGL 2'; setStatus('Taking the turning of the ' + big.n.toLocaleString() + '-item map apart with ' + nm2 + '…'); await yieldUI();
      var Lb = big.L3, ts = await NFMProbe.turnSplit({ backend: names[bj], W: 900, H: 600, rigScene: function (yaw, pitch) { return NFMScene.make(Lb, { plan: {}, rig: true, colorBy: 'group', theme: 'light', cam: { yaw: yaw, pitch: pitch, persp: 2.4 } }); } });
      var ex = NFMProbe.explainSplit(ts, big.n); splitSays.push(ex.say); if (ex.level === 'warn' && splitLevel === 'ok') splitLevel = 'warn'; ctx.split.push({ n: big.n, backend: names[bj], cause: ex.cause, ways: ts.ways || null, skipped: ts.skipped || null });
      if (ts.ways) ts.ways.forEach(function (w) { sp.rows.push([nm2 + ': ' + w.label, w.fps === undefined ? '-' : Math.round(w.fps), w.gapMed === undefined ? '-' : r1(w.gapMed), w.gapP95 === undefined ? '-' : r1(w.gapP95), w.gapMax === undefined ? '-' : r1(w.gapMax), w.angleMed === undefined ? '-' : r1(w.angleMed), w.ms === undefined ? '-' : r1(w.ms)]); });
      ex.lines.forEach(function (l) { sp.notes.push(nm2 + ': ' + l); });
    }
    sp.notes.push('"Typical picture" is the time from one screen refresh to the next; the slowest 1 in 20 and the slowest show whether the speed is steady or has pauses. "Angle math" is the work on the main thread for each new angle; "Card per picture" is the time the graphics card needs for one picture, found by timing a batch of 20 and a batch of 120 pictures sent back to back and dividing the difference by 100 (so the fixed waits browsers add do not count). The browser rounds its clock to about a millisecond, so small numbers are rough. Links alone, items alone and names alone show which part costs the most.');
    if (!splitSays.length) { sp.finish('warn', 'Could not take the turning apart (no usable way of drawing, or the page was in the background).'); }
    else sp.finish(splitLevel, splitSays.join(' '));
    return { level: level, say: say };
  } });

  (params.get('extras') ? STEPS : []).push({ name: 'Browser checks', run: async function () {
    var s = addSection('Smaller checks: random draws, CSV reading, Force arrangement'), rows = [];
    s.head = ['Check', 'Run 1', 'Run 2', 'Run 3', 'Run 4', 'Run 5']; setStatus('Random draws…'); await yieldUI();
    var Sim = typeof NFMSim !== 'undefined' ? NFMSim : null, drawRuns = [];
    if (Sim) { var rr = Sim.rngFor(1, 0), f = Sim.DRAW.normal; for (var q = 0; q < 5; q++) { var t0 = now(), sum = 0; for (var i = 0; i < 1000000; i++) sum += f(rr, 10, 3); drawRuns.push(now() - t0); } rows.push(['1,000,000 normal draws'].concat(drawRuns.map(fmtMs))); }
    setStatus('CSV reading…'); await yieldUI();
    var c = GEN.csv('moderate', 40000, 5), csvRuns = []; for (var j = 0; j < 5; j++) { var t1 = now(); I.parseDelimited(c.text, ','); csvRuns.push(now() - t1); } rows.push(['CSV reading, ' + c.rows.toLocaleString() + ' rows'].concat(csvRuns.map(fmtMs)));
    setStatus('Force arrangement…'); await yieldUI();
    var fn = QUICK ? 800 : 3000, g = graphFor('moderate', fn), dg = C.derive(JSON.parse(JSON.stringify(g))), forceRuns = []; for (var m = 0; m < 3; m++) { var t2 = now(); E.build(dg, { view: 'network', arrange: 'force', colorBy: 'group' }); forceRuns.push(now() - t2); await yieldUI(); } rows.push(['Force arrangement, ' + fn.toLocaleString() + ' items'].concat(forceRuns.map(fmtMs)).concat(['', '']));
    s.rows = rows; ctx.small = { draws: drawRuns.map(r1), csv: csvRuns.map(r1), force: forceRuns.map(r1) };
    s.finish('ok', 'Times for the same job repeated; the first run is the one a person feels, the later ones show the warmed-up speed.'); return { level: 'ok', say: 'done' };
  } });

  /* ------------------------------------------------------------- results file */
  function buildMd(elapsed) {
    var L = ['# Net Flow Map Tester results', '', 'Version ' + VERSION + ' · run ' + new Date().toISOString() + ' · took ' + fmtMs(elapsed) + (QUICK ? ' · QUICK mode' : ''), ''];
    sections.forEach(function (s) { L.push('## ' + s.title, '', '**' + s.level.toUpperCase() + '** ' + s.verdict, ''); if (s.head) L.push(mdTable(s.head, s.rows)); s.notes.forEach(function (n) { L.push('_' + n + '_', ''); }); });
    L.push('## Raw data', '', '```json', JSON.stringify({ version: VERSION, quick: QUICK, info: ctx.info, correct: ctx.correct || null, ladder: ctx.ladder || null, kernels: ctx.kernels || null, groups: ctx.groups || null, cold: ctx.cold || null, turn: ctx.turn || null, split: ctx.split || null, timing: ctx.timing || null, small: ctx.small || null }, null, 1), '```', '');
    return L.join('\n');
  }
  function offerResults(md, elapsed) {
    var worst = sections.some(function (s) { return s.level === 'bad'; }) ? 'bad' : sections.some(function (s) { return s.level === 'warn'; }) ? 'warn' : 'ok';
    sections.forEach(function (s) { $('out').appendChild(s.card); });   /* back into test order */
    document.querySelector('main').classList.add('fin'); window.scrollTo(0, 0);   /* finished: the 'All done' buttons first, then the turning 3D map, then every step */
    $('done').style.display = ''; $('finalsay').textContent = worst === 'ok' ? 'Every check passed. Total time ' + fmtMs(elapsed) + '.' : worst === 'warn' ? 'Finished with some notes above (total time ' + fmtMs(elapsed) + ').' : 'Finished, and at least one check failed (total time ' + fmtMs(elapsed) + '). The results file explains what.';
    $('dl').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = 'net-flow-map-tester-results.md'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); };
    $('cp').onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(md).then(function () { $('cp').textContent = 'Copied'; }, function () { $('cp').textContent = 'Copy blocked'; }); };
    window.__NFM_TESTER_RESULT = { md: md, sections: sections.map(function (s) { return { title: s.title, level: s.level, verdict: s.verdict }; }), ctx: ctx };
  }
  async function runAll() {
    if (running) return; running = true; sections = []; $('out').innerHTML = ''; $('done').style.display = 'none'; $('show').style.display = 'none'; $('show').innerHTML = '<h2>The 3D map, turning</h2>'; previews.length = 0; document.querySelector('main').classList.remove('fin'); doneSteps = 0; if (params.get('only')) { var keep = STEPS.filter(function (x) { return x.name.toLowerCase().indexOf(params.get('only').toLowerCase()) >= 0; }); if (keep.length) { STEPS.length = 0; keep.forEach(function (x) { STEPS.push(x); }); } } total = STEPS.length; setBar(); t0Run = now();
    for (var i = 0; i < STEPS.length; i++) {
      setStatus('Step ' + (i + 1) + ' of ' + STEPS.length + ': ' + STEPS[i].name + '…'); await yieldUI();
      try { await STEPS[i].run(); } catch (e) { var s = sections[sections.length - 1]; if (!s || s.verdict) s = addSection(STEPS[i].name); s.finish('bad', 'This step stopped with an error: ' + String(e && e.message || e)); }
      doneSteps = i + 1; setBar();
    }
    var el = now() - t0Run; setStatus('Finished in ' + fmtMs(el) + '.'); offerResults(buildMd(el), el); startPreviews(); running = false;
  }
  $('again').onclick = function () { runAll(); };
  window.addEventListener('load', function () { setTimeout(runAll, 400); });
})();

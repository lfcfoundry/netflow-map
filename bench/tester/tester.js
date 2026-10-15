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
  function setStatus(t) { $('status').textContent = t; }
  function setBar() { $('barfill').style.width = Math.min(100, Math.round(100 * doneSteps / total)) + '%'; }
  function addSection(title) {
    var card = document.createElement('div'); card.className = 'card'; card.innerHTML = '<h2></h2><div class="verdict note">Working…</div><div class="tw"></div>'; card.firstChild.textContent = title; $('out').appendChild(card);
    var s = { title: title, verdict: '', level: 'ok', head: null, rows: [], notes: [], card: card };
    s.finish = function (level, verdict) {
      s.level = level; s.verdict = verdict; var v = card.querySelector('.verdict'); v.className = 'verdict ' + level; v.textContent = verdict;
      if (s.head) { var h = '<table><thead><tr>' + s.head.map(function (x) { return '<th>' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>' + s.rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>'; card.querySelector('.tw').innerHTML = h; }
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
    if (dev.error) { level = 'warn'; say = 'No graphics-card computing in this browser (' + dev.error + '). The graphics-card checks will be skipped; everything else still runs. ' + (/firefox/i.test(ua) ? 'In Firefox, WebGPU is on by default in recent versions on some systems; on others it may need switching on.' : ''); rows.push(['Graphics-card computing (WebGPU)', 'not available']); }
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
    s.head = ['Check', 'Result']; s.rows = [['Items', String(P.k)], ['Hop table: entries that differ from the CPU table', bad + ' of ' + (P.k * P.k)], ['Distance error at the start (sketch)', r3(s0)], ['After ' + steps + ' steps, CPU math', r3(sc)], ['After ' + steps + ' steps, graphics card', r3(sg)], ['Difference', r1(diff) + '%'], ['Average item difference (share of one link)', r3(move)]];
    var level = okTable && okSteps ? 'ok' : 'bad';
    var say = okTable && okSteps ? 'Yes. The graphics card builds the same hop table as the processor, and its steps give the same picture (distance error ' + r3(sg) + ' against ' + r3(sc) + ' on the processor).' : (!okTable ? 'No: the hop table built on the graphics card differs from the processor\'s in ' + bad + ' entries.' : 'The hop table matches, but the steps differ from the processor\'s (' + r1(diff) + '% in distance error).');
    s.finish(level, say); ctx.correct = { table: okTable, steps: okSteps, bad: bad, diffPct: r1(diff), move: r3(move) };
    return { level: level, say: say };
  } });

  STEPS.push({ name: 'How fast and how true?', run: async function () {
    var s = addSection('How fast and how true is the graphics-card version?');
    if (!ctx.dev) { s.finish('warn', 'Skipped: no graphics-card computing here.'); return { level: 'warn', say: 'skipped' }; }
    var plan = QUICK ? [['moderate', 800], ['complex', 800]] : [['moderate', 2000], ['moderate', 5000], ['moderate', 10000], ['complex', 5000], ['complex', 10000], ['moderate', 20000], ['moderate', 30000]];
    if (params.get('plan')) plan = params.get('plan').split(',').map(function (x) { var a = x.split(':'); return [a[0], +a[1]]; });
    s.head = ['Network', 'Items', 'Processor time', 'Processor truth', 'Graphics-card time', 'Graphics-card truth', 'Faster by', 'Truth at 20 / 40 steps']; var summary = [], wins = 0, tried = 0, ratios = [], truthOk = 0;
    for (var pi = 0; pi < plan.length; pi++) {
      var kind = plan[pi][0], n = plan[pi][1]; setStatus('Best quality, ' + kind + ' ' + n.toLocaleString() + ' items: processor…'); await yieldUI();
      var g = graphFor(kind, n), P = piece(g), cb = cpuBest(g), Xc = new Float64Array(2 * P.k);
      P.ids.forEach(function (id, i) { var p = cb.pos.get(id); Xc[2 * i] = p[0]; Xc[2 * i + 1] = p[1]; });
      var tc = truth(P, Xc); setStatus('Best quality, ' + kind + ' ' + n.toLocaleString() + ' items: graphics card…'); await yieldUI();
      var res = await G.layout(ctx.dev, P.off, P.nbr, P.k, EDGE, { steps: 60, snapshots: [20, 40] });
      if (res.error) { s.rows.push([kind, n.toLocaleString(), fmtMs(cb.ms), r3(tc), res.tooBig ? 'does not fit' : 'failed', '-', '-', '-']); summary.push({ kind: kind, n: n, cpuMs: r1(cb.ms), cpuTruth: r3(tc), gpuError: res.error }); continue; }
      var tg = truth(P, res.X), t20 = truth(P, res.snapshots[20]), t40 = truth(P, res.snapshots[40]), ratio = cb.ms / res.ms.total; tried++; ratios.push(ratio); if (ratio > 1) wins++; if (tg <= tc * 1.03) truthOk++; if (tg > Math.min(t20, t40) * 1.05) s.notes.push('At ' + P.k.toLocaleString() + ' items the steps ran away (truth ' + r3(t20) + ' at 20 steps, ' + r3(t40) + ' at 40, ' + r3(tg) + ' at 60).');
      s.rows.push([kind, P.k.toLocaleString(), fmtMs(cb.ms), r3(tc), fmtMs(res.ms.total), r3(tg), r1(ratio) + '×', r3(t20) + ' / ' + r3(t40)]);
      summary.push({ kind: kind, n: P.k, cpuMs: r1(cb.ms), cpuTruth: r3(tc), gpuMs: r1(res.ms.total), gpuTruth: r3(tg), parts: { sketch: r1(res.ms.start), setup: r1(res.ms.upload), stepsAndTable: r1(res.ms.steps), read: r1(res.ms.read) }, split: res.split, levels: res.levels, t20: r3(t20), t40: r3(t40) });
      doneSteps += 0.1; setBar();
    }
    ctx.ladder = summary;
    var level, say;
    if (!tried) { level = 'warn'; say = 'The graphics-card version could not run at these sizes.'; }
    else {
      ratios.sort(function (a, b) { return a - b; }); var med = ratios[ratios.length >> 1];
      level = ctx.softGpu ? 'warn' : (wins === tried && truthOk === tried ? 'ok' : wins ? 'warn' : 'bad');
      say = 'Graphics card faster in ' + wins + ' of ' + tried + ' runs (middle ' + r1(med) + '×), and as true or truer (within 3%) in ' + truthOk + ' of ' + tried + '. Truth: lower is truer.' + (ctx.softGpu ? ' (Software stand-in, not a real graphics card.)' : '');
    }
    s.notes.push('Above 20,000 items the app\'s best quality falls back to the quick sample, so the processor truth there is the quick one.');
    s.notes.push('Graphics-card time covers everything: the 60-point sketch, the upload, the hop table, 60 steps and reading the picture back. The processor time is the app\'s best-quality arrangement, which also includes the overlap clean-up that the graphics-card picture has not had yet, so the graphics-card truth is slightly flattering.');
    s.finish(level, say); return { level: level, say: say };
  } });

  STEPS.push({ name: 'Old kernel against new', run: async function () {
    var s = addSection('Old graphics-card program against the new one');
    if (!ctx.dev) { s.finish('warn', 'Skipped: no graphics-card computing here.'); return { level: 'warn', say: 'skipped' }; }
    var n = QUICK ? 800 : 10000, big = QUICK ? 1200 : 30000, variants = [
      ['moderate', 'old program, 60 steps', { kernel: 'v1', steps: 60, snapshots: [20, 40] }],
      ['moderate', 'new program, plain steps, 60', { kernel: 'v2', omega: 1, steps: 60, snapshots: [20, 40] }],
      ['moderate', 'new program, relaxed 1.2, 60', { kernel: 'v2', omega: 1.2, steps: 60, snapshots: [20, 40] }],
      ['moderate', 'new program without tables, relaxed 1.2, 60', { kernel: 'v3', omega: 1.2, steps: 60, snapshots: [20, 40] }],
      ['moderate', 'new program, relaxed 1.6, 60', { kernel: 'v2', omega: 1.6, steps: 60, snapshots: [20, 40] }],
      ['moderate', 'new program, relaxed 1.2, 30', { kernel: 'v2', omega: 1.2, steps: 30, snapshots: [10, 20] }],
      ['complex', 'new program, relaxed 1.2, 60', { kernel: 'v2', omega: 1.2, steps: 60, snapshots: [20, 40] }],
      ['complex', 'new program, relaxed 1.2, 150', { kernel: 'v2', omega: 1.2, steps: 150, snapshots: [60, 100] }],
      ['moderate', 'plain steps, 60', { kernel: 'v2', omega: 1, steps: 60, snapshots: [20, 40] }, big],
      ['moderate', 'relaxed 1.2, 60', { kernel: 'v2', omega: 1.2, steps: 60, snapshots: [20, 40] }, big]];
    s.head = ['Network', 'Variant', 'Total time', 'Truth at 1/3 of the steps', 'at 2/3', 'at the end']; var cache = {}, out = [];
    for (var vi = 0; vi < variants.length; vi++) {
      var kind = variants[vi][0], name = variants[vi][1], o = variants[vi][2], nn = variants[vi][3] || n; setStatus('Program comparison: ' + kind + ' ' + name + '…'); await yieldUI();
      var P = cache[kind + nn] || (cache[kind + nn] = piece(graphFor(kind, nn))), res = await G.layout(ctx.dev, P.off, P.nbr, P.k, EDGE, o);
      if (res.error) { s.rows.push([kind, name, 'failed: ' + res.error.slice(0, 40), '', '', '']); continue; }
      var sn = Object.keys(res.snapshots).map(Number).sort(function (a, b) { return a - b; }), tt = sn.map(function (k2) { return truth(P, res.snapshots[k2]); });
      s.rows.push([kind + ' ' + P.k.toLocaleString(), name, fmtMs(res.ms.total), r3(tt[0]), r3(tt[1]), r3(tt[2])]);
      out.push({ kind: kind, n: P.k, variant: name, totalMs: r1(res.ms.total), truths: tt.map(r3), split: res.split });
    }
    var prof = null;
    if (out.length) {
      var Pm = cache['moderate' + n]; setStatus('Program comparison: timing each part…'); await yieldUI();
      var rp = await G.layout(ctx.dev, Pm.off, Pm.nbr, Pm.k, EDGE, { kernel: 'v2', omega: 1.2, steps: 60, profile: true });
      if (!rp.error) { prof = { sketch: r1(rp.ms.start), setup: r1(rp.ms.upload), tableAndWeights: r1(rp.ms.table), steps60: r1(rp.ms.steps), read: r1(rp.ms.read), levels: rp.levels }; s.rows.push(['moderate ' + Pm.k.toLocaleString(), 'parts (new program): sketch / setup / table+weights / 60 steps / read-back', prof.sketch + ' / ' + prof.setup + ' / ' + prof.tableAndWeights + ' / ' + prof.steps60 + ' / ' + prof.read + ' ms', '', '', '']); }
    }
    ctx.kernels = { n: n, variants: out, parts: prof };
    var oldT = out[0], newT = out[2], say = out.length >= 3 ? 'At ' + n.toLocaleString() + ' items the new program takes ' + fmtMs(newT.totalMs) + ' against ' + fmtMs(oldT.totalMs) + ' for the old one (' + r1(oldT.totalMs / newT.totalMs) + '× as fast).' : 'Not enough runs finished to compare.';
    s.finish('ok', say); return { level: 'ok', say: say };
  } });

  STEPS.push({ name: 'Cold start', run: async function () {
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

  STEPS.push({ name: 'Browser checks', run: async function () {
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
    L.push('## Raw data', '', '```json', JSON.stringify({ version: VERSION, quick: QUICK, info: ctx.info, correct: ctx.correct || null, ladder: ctx.ladder || null, kernels: ctx.kernels || null, cold: ctx.cold || null, small: ctx.small || null }, null, 1), '```', '');
    return L.join('\n');
  }
  function offerResults(md, elapsed) {
    var worst = sections.some(function (s) { return s.level === 'bad'; }) ? 'bad' : sections.some(function (s) { return s.level === 'warn'; }) ? 'warn' : 'ok';
    $('done').style.display = ''; $('finalsay').textContent = worst === 'ok' ? 'Every check passed. Total time ' + fmtMs(elapsed) + '.' : worst === 'warn' ? 'Finished with some notes above (total time ' + fmtMs(elapsed) + ').' : 'Finished, and at least one check failed (total time ' + fmtMs(elapsed) + '). The results file explains what.';
    $('dl').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = 'net-flow-map-tester-results.md'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); };
    $('cp').onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(md).then(function () { $('cp').textContent = 'Copied'; }, function () { $('cp').textContent = 'Copy blocked'; }); };
    window.__NFM_TESTER_RESULT = { md: md, sections: sections.map(function (s) { return { title: s.title, level: s.level, verdict: s.verdict }; }), ctx: ctx };
  }
  async function runAll() {
    if (running) return; running = true; sections = []; $('out').innerHTML = ''; $('done').style.display = 'none'; doneSteps = 0; total = STEPS.length; setBar(); t0Run = now();
    for (var i = 0; i < STEPS.length; i++) {
      setStatus('Step ' + (i + 1) + ' of ' + STEPS.length + ': ' + STEPS[i].name + '…'); await yieldUI();
      try { await STEPS[i].run(); } catch (e) { var s = sections[sections.length - 1]; if (!s || s.verdict) s = addSection(STEPS[i].name); s.finish('bad', 'This step stopped with an error: ' + String(e && e.message || e)); }
      doneSteps = i + 1; setBar();
    }
    var el = now() - t0Run; setStatus('Finished in ' + fmtMs(el) + '.'); offerResults(buildMd(el), el); running = false;
  }
  $('again').onclick = function () { runAll(); };
  window.addEventListener('load', function () { setTimeout(runAll, 400); });
})();

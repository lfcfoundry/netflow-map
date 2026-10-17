/*!
 * Netflow Map tuning test: finds, on this computer, the fastest way to arrange big networks (processor or graphics card, how many sweeps,
 * up to what size) and the real speed of each, and returns a profile the page saves and uses. Copyright (c) 2026 LFC Foundry. MIT License.
 * It runs on made-up networks in a private worker; the user's data is never touched.
 */
var NFMTune = (function () {
  'use strict';
  var VERSION = 1, now = function () { return performance.now(); }, r3 = function (x) { return Math.round(x * 1000) / 1000; };

  /** A key for "this computer and browser": when it changes, the saved profile may no longer fit. */
  function deviceKey(cardInfo) {
    var m = /(Firefox|Edg|Chrome)\/(\d+)/.exec(navigator.userAgent || '');
    return [navigator.hardwareConcurrency || 0, m ? m[1] + m[2] : 'browser', cardInfo || 'none'].join('|');
  }
  /** Compact CSR (for the distance-error score) of a graph object; node order is the graph's. */
  function csr(g) {
    var n = g.nodes.length, idx = new Map(), i, deg = new Int32Array(n + 1);
    g.nodes.forEach(function (nd, q) { idx.set(nd.id, q); });
    var pairs = [];
    g.edges.forEach(function (e) { var a = idx.get(e.from), b = idx.get(e.to); if (a !== undefined && b !== undefined && a !== b) { pairs.push(a, b); deg[a + 1]++; deg[b + 1]++; } });
    for (i = 0; i < n; i++) deg[i + 1] += deg[i];
    var off = Uint32Array.from(deg), fill = Int32Array.from(deg.subarray(0, n)), nbr = new Uint32Array(deg[n]);
    for (i = 0; i < pairs.length; i += 2) { nbr[fill[pairs[i]]++] = pairs[i + 1]; nbr[fill[pairs[i + 1]]++] = pairs[i]; }
    return { k: n, off: off, nbr: nbr, idx: idx };
  }
  /** A power law t = t0 * (n / n0)^p through two timings (p kept between 1 and 2.5). */
  function law(n0, t0, n1, t1) { var p = Math.max(1, Math.min(2.5, Math.log(Math.max(t1, 1e-3) / Math.max(t0, 1e-3)) / Math.log(n1 / n0))); return { n0: n0, t0: r3(t0), p: r3(p) }; }
  function lawAt(l, n) { return l.t0 * Math.pow(n / l.n0, l.p); }

  /** Whole-build time and distance error for one network size: the processor, then (if the card passed its test) the card path. c: a started private client. */
  async function measure(c, card, opts, o, n, step, stop) {
    var g = o.makeGraph(n), S = csr(g), place = function (L) { var X = new Float64Array(2 * S.k); L.nodes.forEach(function (nd) { var q = S.idx.get(nd.nodeId || nd.id); if (q !== undefined) { X[2 * q] = nd.cx; X[2 * q + 1] = nd.cy; } }); return X; };
    c.setGraph(g); await new Promise(function (r) { setTimeout(r, 0); });
    await step('The processor, ' + n.toLocaleString('en-US') + ' items…');
    c.cardOff = true; var t0 = now(), b0 = await c.build(opts), tcpu = now() - t0;
    var row = { n: n, cpuMs: Math.round(tcpu), cpuTruth: r3(typeof NFMGpuStress === 'undefined' ? 0 : NFMGpuStress.stress(S.off, S.nbr, S.k, place(b0.L), 20)), cardMs: null, cardTruth: null, cardUsed: false };
    if (stop()) return null;
    if (card.state === 'ready') {
      await step('The graphics card, ' + n.toLocaleString('en-US') + ' items…');
      c.cardOff = false; c.tune = null; card.prof = null; t0 = now(); var b1 = await c.build(opts), tgpu = now() - t0;
      if (b1.card) { row.cardMs = Math.round(tgpu); row.cardTruth = r3(NFMGpuStress.stress(S.off, S.nbr, S.k, place(b1.L), 20)); row.cardUsed = true; }
    } else await step('(no graphics card to try)');
    return row;
  }
  /**
   * The device check's graphics-card test: does the card path work and pay off for a map of about n items here?
   * Resolves { state: 'none', why } | { state: 'ready', info, row, verdict: 'good' | 'slower' | 'worse' | 'unused', text }.
   */
  async function checkCard(o) {
    var n = o.n || 6000, c = new o.Client(o.engineSrc, o.getEngine), steps = 0;
    try {
      await c.start(); if (c.mode !== 'worker') return { state: 'none', why: 'the background helper is not available' };
      var card = typeof NFMGpuStress === 'undefined' ? { state: 'none', why: 'no graphics-card code on this page' } : await NFMGpuStress.probe(20000);
      c.card = card; c.cardP = Promise.resolve(card);
      var row = await measure(c, card, { view: 'network', arrange: 'stressBest', colorBy: 'group' }, o, n, function (t) { steps++; if (o.onStep) o.onStep(t); return Promise.resolve(); }, function () { return false; });
      if (card.state !== 'ready') return { state: 'none', why: card.why || 'none offered', row: row };
      var x = row.cardMs === null ? null : row.cpuMs / row.cardMs, tw = row.cardTruth !== null && row.cardTruth > row.cpuTruth * 1.05 + 0.003;
      var verdict = !row.cardUsed ? 'unused' : tw ? 'worse' : x >= 1.3 ? 'good' : 'slower';
      return { state: 'ready', info: card.info, max: card.max, row: row, speedup: x, verdict: verdict, why: c.cardWhy || '' };
    } finally { try { if (c.w) c.w.terminate(); } catch (e) { /* gone */ } }
  }

  /**
   * o: { Client (NFMEngineClient.Client), engineSrc, getEngine, makeGraph(n) -> graph, sizes ([5000, 10000]), big (20000), onStep(text, fraction), cancelled() }
   * Resolves { profile, rows, verdict, steps } (profile is what to save), or { cancelled: true }.
   */
  async function run(o) {
    var sizes = o.sizes || [5000, 10000], big = o.big === undefined ? 20000 : o.big, T0 = now(), rows = [], stepNo = 0, total = 5 + sizes.length * 2 + (big ? 2 : 0) + 3;
    var step = function (text) { stepNo++; if (o.onStep) o.onStep(text, Math.min(0.98, stepNo / total)); return new Promise(function (r) { setTimeout(r, 30); }); };
    var stop = function () { return o.cancelled && o.cancelled(); };
    var c = new o.Client(o.engineSrc, o.getEngine);
    try {
      await step('Starting a helper…'); await c.start();
      if (c.mode !== 'worker') return { profile: null, rows: rows, verdict: 'Skipped: this browser would not start a background helper, and the test would freeze the page.', skipped: true };
      if (stop()) return { cancelled: true };
      await step('Trying the graphics card…');
      var card = typeof NFMGpuStress === 'undefined' ? { state: 'none', why: 'No graphics-card code on this page.' } : await NFMGpuStress.probe(20000);
      c.card = card; c.cardP = Promise.resolve(card);
      var opts = { view: 'network', arrange: 'stressBest', colorBy: 'group' }, cpu = [], gpu = [], truthCpu = [], truthGpu = [];
      for (var si = 0; si < sizes.length; si++) {
        if (stop()) return { cancelled: true };
        var row = await measure(c, card, opts, o, sizes[si], step, stop);
        if (!row) return { cancelled: true };
        cpu.push(row.cpuMs); gpu.push(row.cardMs); truthCpu.push(row.cpuTruth); truthGpu.push(row.cardTruth); rows.push(row);
      }
      var prof = { v: VERSION, key: deviceKey(card.state === 'ready' ? card.info : ''), when: new Date().toISOString(), threads: navigator.hardwareConcurrency || 0, card: { use: false, info: card.state === 'ready' ? card.info : '', why: card.state === 'ready' ? '' : card.why || '', max: card.state === 'ready' ? card.max : 0, minItems: 4001, sgdMax: 12500, sweeps: 2 }, secs: { cpu: law(sizes[0], cpu[0] / 1000, sizes[sizes.length - 1], cpu[cpu.length - 1] / 1000) }, rows: rows };
      var variants = [];
      if (card.state === 'ready' && gpu.every(function (x) { return x !== null; }) && gpu.length === sizes.length) {
        prof.secs.card = law(sizes[0], gpu[0] / 1000, sizes[sizes.length - 1], gpu[gpu.length - 1] / 1000);
        /* the card is used if it is clearly faster and no less true at the smaller size, and at the larger one */
        var okAll = true; for (var q = 0; q < sizes.length; q++) if (!(gpu[q] < cpu[q] * 0.9 && truthGpu[q] <= truthCpu[q] * 1.05 + 0.003)) okAll = false;
        prof.card.use = okAll;
        prof.card.minItems = okAll ? 4001 : (gpu[sizes.length - 1] < cpu[sizes.length - 1] * 0.9 && truthGpu[sizes.length - 1] <= truthCpu[sizes.length - 1] * 1.05 + 0.003 ? Math.round(sizes[sizes.length - 1] * 0.8) : 0);
        if (!okAll && prof.card.minItems) prof.card.use = true;
        if (prof.card.use) {
          /* which method wins on this card: one or two sweeps of parallel pairs, or the 40 majorization steps, at about 10,000 items and at about 20,000 */
          var run1 = async function (nn, label, extra) {
            if (stop()) return null;
            if (nn > card.max) return null;
            var g2 = o.makeGraph(nn); c.setGraph(g2); await new Promise(function (r) { setTimeout(r, 0); });
            await step('The graphics card\'s methods, ' + nn.toLocaleString('en-US') + ' items…');
            c.cardOff = false; var cap = (await c.run('gpuPiece', opts)).L.gpuPiece; if (!cap) return null;
            var out = [], mk = [['one smooth sweep', { method: 'sgd', sweeps: 1 }], ['two smooth sweeps', { method: 'sgd', sweeps: 2 }], ['40 majorization steps', { method: 'smacof', steps: 40 }]].filter(function (m) { return !extra || extra.indexOf(m[0]) >= 0; });
            for (var vi = 0; vi < mk.length; vi++) {
              if (stop()) return null;
              var r = await card.layoutWith(cap, mk[vi][1]);
              if (r.error) continue;
              out.push({ name: mk[vi][0], opts: mk[vi][1], ms: r.ms.total, truth: NFMGpuStress.stress(cap.off, cap.nbr, cap.k, r.X, 20), n: cap.k });
            }
            return out;
          };
          var v10 = await run1(sizes[sizes.length - 1], 'mid'), v20 = big ? await run1(big, 'big', ['one smooth sweep', '40 majorization steps']) : null;
          if (stop()) return { cancelled: true };
          var pick = function (list) {   // fastest among those within 2% of the truest
            if (!list || !list.length) return null; var bt = Math.min.apply(null, list.map(function (x) { return x.truth; }));
            return list.filter(function (x) { return x.truth <= bt * 1.02 + 0.0005; }).sort(function (a, b) { return a.ms - b.ms; })[0];
          };
          var p10 = pick(v10), p20 = pick(v20);
          variants = (v10 || []).concat(v20 || []).map(function (x) { return { n: x.n, name: x.name, ms: Math.round(x.ms), truth: r3(x.truth) }; });
          if (p10) {
            if (p10.opts.method === 'sgd') { prof.card.sweeps = p10.opts.sweeps; prof.card.sgdMax = p20 && p20.opts.method === 'sgd' ? Math.min(card.max, 30000) : 12500; }
            else prof.card.sgdMax = 0;
          }
        }
      }
      prof.variants = variants;
      var last = rows[rows.length - 1], verdict;
      if (card.state !== 'ready') verdict = 'No usable graphics card was found (' + String(card.why || 'none offered').replace(/\.$/, '') + '), so the processor will keep doing the work. For your processor, best quality takes about ' + (cpu[cpu.length - 1] / 1000).toFixed(1) + ' s at ' + sizes[sizes.length - 1].toLocaleString('en-US') + ' items.';
      else if (!prof.card.use) verdict = 'Your graphics card (' + card.info + ') was not clearly faster than your processor here, so the processor will keep doing the work (' + (cpu[cpu.length - 1] / 1000).toFixed(1) + ' s at ' + sizes[sizes.length - 1].toLocaleString('en-US') + ' items).';
      else verdict = 'Your graphics card (' + card.info + ') is ' + (cpu[cpu.length - 1] / gpu[gpu.length - 1]).toFixed(1) + ' times faster than your processor for best quality at ' + sizes[sizes.length - 1].toLocaleString('en-US') + ' items (' + (gpu[gpu.length - 1] / 1000).toFixed(1) + ' s against ' + (cpu[cpu.length - 1] / 1000).toFixed(1) + ' s) with the same or better accuracy. Best quality will use it from ' + prof.card.minItems.toLocaleString('en-US') + ' to ' + card.max.toLocaleString('en-US') + ' items' + (prof.card.sgdMax ? ', with ' + (prof.card.sweeps === 1 ? 'one smooth sweep' : 'two smooth sweeps') + ' up to ' + prof.card.sgdMax.toLocaleString('en-US') + ' items and the 40 steps above' : ', using the 40 steps') + '.';
      prof.verdict = verdict; prof.ms = Math.round(now() - T0);
      return { profile: prof, rows: rows, variants: variants, verdict: verdict };
    } finally { try { if (c.w) c.w.terminate(); } catch (e) { /* gone */ } }
  }
  /** How good a distance error is (lower is truer), from the measured ranges: e1 excellent (to 0.147), e2 very good (to 0.154), e3 good (to 0.165), e4 fair (to 0.199), e5 poor. */
  function errBand(v) {
    var x = Number(v); if (!isFinite(x)) return null;
    return x <= 0.1475 ? { cls: 'e1', word: 'excellent' } : x <= 0.1545 ? { cls: 'e2', word: 'very good' } : x <= 0.1655 ? { cls: 'e3', word: 'good' } : x < 0.2 ? { cls: 'e4', word: 'fair' } : { cls: 'e5', word: 'poor' };
  }
  return { errBand: errBand, run: run, checkCard: checkCard, measure: measure, deviceKey: deviceKey, lawAt: lawAt, VERSION: VERSION };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NFMTune;

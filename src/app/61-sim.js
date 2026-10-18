/*!
 * Netflow Map app, part 8b: the Monte Carlo simulation in the Advanced tab (set-up, distributions, run, charts, what-if table, map link).
 * Copyright (c) 2026 LFC Foundry. MIT License.
 */
var SIM = { st: 'idle', snap: null, exact: null, exactAvg: false, sweep: null, sweepBusy: false, sweepId: 0, sweepWhat: 'items', err: '', stop: false, runId: 0, info: null, spec: null, t0: 0, ms: 0, allEnds: false, startKey: '', startInfo: null };
S.simVer = 0; S.simSnap = null; S.simUsed = 0;
var WALKER_RULES = [
  ['weights', 'Follow the link weights (evenly if there are none)'],
  ['uniform', 'Pick any link equally often'],
  ['first', 'Always take the first link'],
  ['curious', 'Prefer places they have not been yet'],
  ['softmax', 'Lean hard toward heavier links (softmax)']
];
function simDefaults() {
  return { starts: [], walkers: 10000, repeats: 100, seed: 1, stepCap: 400, rule: 'weights', temp: 1, arrivals: { dist: 'auto' }, linkWeight: { dist: 'none' }, linkCost: { dist: 'none' }, dwell: { dist: 'none' }, dots: false };
}
function SC() { var a = S.A; a.sim = Object.assign(simDefaults(), a.sim || {}); return a.sim; }
function simUsesMap() { return S.V.colorBy === 'sim' || S.V.widthBy === 'sys:sim' || S.V.sizeBy === 'sys:sim' || S.V.edgeColorBy === 'sys:sim'; }
function simReset() {
  SIM.runId++; SIM.st = 'idle'; SIM.snap = null; SIM.exact = null; SIM.sweep = null; SIM.sweepBusy = false; SIM.err = ''; SIM.info = null; SIM.startKey = '';
  S.simSnap = null; S.simVer++; stopDots();
  if (S.tab === 'adv') renderAdv();
}
HOOKS.graph.push(simReset);
function pct(x, d) { if (!(x === x)) return '–'; var v = x * 100; return (v >= 10 || d === 0 ? v.toFixed(d === undefined ? 1 : d) : v.toFixed(d === undefined ? 2 : d)) + '%'; }
function svgEl(tag, attrs, kids) {
  var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
  (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
  return el;
}
function prepOpts() { return { block: S.V.block.slice(), hideKinds: S.V.hideKinds.slice() }; }

/* ---------------------------------------------------------------- the settings -> what the engine wants */
function distSpec(d, role) {
  if (!d || d.dist === 'none' || d.dist === 'auto') return null;
  var o = { dist: d.dist };
  if (d.dist === 'empirical') { o.values = d.values || { scope: role === 'dwell' ? 'nodes' : 'edges', col: 'weight' }; return o; }
  ['a', 'b', 'c'].forEach(function (k) { if (d[k]) o[k] = JSON.parse(JSON.stringify(d[k])); });
  return o;
}
function startIds() { var c = SC(); return c.starts.filter(function (id) { return S.byId.has(id); }); }
function buildSpec(noWeightNoise) {
  var c = SC(), perRepeat = Math.max(1, Math.ceil(c.walkers / Math.max(1, c.repeats)));
  var ids = startIds();
  return {
    seed: c.seed, trials: c.repeats, stepCap: c.stepCap, rule: c.rule, temp: c.temp, maxWalkers: c.walkers,
    sources: ids.map(function (id) { return { id: id, w: 1 }; }),
    arrivals: c.arrivals.dist === 'auto' ? { dist: 'fixed', a: { src: 'const', v: perRepeat } } : distSpec(c.arrivals, 'arrivals'),
    linkWeight: noWeightNoise ? null : distSpec(c.linkWeight, 'linkWeight'), linkCost: distSpec(c.linkCost, 'linkCost'), dwell: distSpec(c.dwell, 'dwell')
  };
}
/** The item the walkers start from when none is picked (worked out on this page, quickly). */
function defaultStart() {
  var key = S.gver + '|' + JSON.stringify(prepOpts());
  if (SIM.startKey === key) return SIM.startInfo;
  var info = null;
  try { var P = getEngine().prepare(S.dg, prepOpts()); if (P.start >= 0) info = { id: P.nodes[P.start].id, n: P.n, m: P.m }; else info = { id: null, n: P.n, m: P.m }; } catch (e) { info = null; }
  SIM.startKey = key; SIM.startInfo = info; return info;
}

/* ---------------------------------------------------------------- run */
function runSim() {
  if (SIM.st === 'running') return;
  if (!client || client.mode === 'starting') { toast('The engine is still starting. Try again in a moment.'); return; }
  var spec = buildSpec(false), prep = prepOpts(), id = ++SIM.runId;
  if (!spec.sources.length) { var d = defaultStart(); if (!d || !d.id) { SIM.err = 'No start item. Pick one or more start items above, or set the start in the Nodes tab.'; renderSimAll(); return; } }
  SIM.st = 'running'; SIM.err = ''; SIM.snap = null; SIM.exact = null; SIM.sweep = null; SIM.spec = spec; SIM.t0 = performance.now(); SIM.stop = false;
  S.simSnap = null; S.simVer++;
  renderSimAll();
  var fail = function (err) { if (id !== SIM.runId || err.message === 'superseded') return; SIM.st = 'idle'; SIM.err = err.message; renderSimAll(); };
  client.simStart(spec, prep).then(function (r) {
    if (id !== SIM.runId) return;
    SIM.info = r.L;
    var xs = buildSpec(true); SIM.exactAvg = !!spec.linkWeight;
    client.simExact(xs, prep).then(function (x) { if (id === SIM.runId) { SIM.exact = x.L; renderSimResults(); } }).catch(function () { /* not available for this set-up */ });
    return simLoop(id);
  }).catch(fail);
}
function simLoop(id) {
  var per = Math.max(1, Math.ceil(SC().repeats / 40));
  return client.simRun(per, 150).then(function (r) {
    if (id !== SIM.runId) return;
    var snap = r.L.snap; SIM.snap = snap; S.simSnap = { visits: snap.visits, moves: snap.moves }; S.simVer++;
    renderSimResults();
    if (S.tab === 'map' && simUsesMap()) refreshMapThrottled();
    if (r.L.done || SIM.stop) {
      SIM.st = r.L.done ? 'done' : 'stopped'; SIM.ms = performance.now() - SIM.t0; renderSimAll();
      if (S.tab === 'map' && simUsesMap()) refreshMap('simulation');
      return;
    }
    return nextFrame().then(function () { return simLoop(id); });
  });
}
var refreshMapT = 0;
/** While the simulation runs, the Map is redrawn at most every 0.7 s. */
function refreshMapThrottled() { var now = performance.now(); if (now - refreshMapT < 700) return; refreshMapT = now; refreshMap('simulation'); }
function stopSim() { SIM.stop = true; }

/* ---------------------------------------------------------------- distribution pickers */
function numInput(val, onchange, attrs) {
  var el = h('input', Object.assign({ type: 'number', step: 'any', value: val === undefined || val === null || val !== val ? '' : String(val) }, attrs || {}));
  el.addEventListener('change', function () { var v = parseFloat(el.value); onchange(v === v ? v : 0); });
  return el;
}
function paramRow(d, p, role, scope, save) {
  var cur = d[p.k] || { src: 'const', v: 1 };
  var srcs = [['const', 'A number']];
  if (scope !== 'one') {
    if (scope === 'edges') srcs.push(['weight', 'The link weight']);
    var cc = colsOf(scope, ['number']).filter(function (c) { return c.key !== 'weight'; });
    if (cc.length) srcs.push(['col', 'A column']);
    if (p.k !== 'a') srcs.push(['pct', 'A percent of the first value']);
  }
  var kids = [];
  var sel = select(srcs, cur.src, function (v) {
    var n = { src: v };
    if (v === 'const') n.v = cur.v !== undefined ? cur.v : 1;
    if (v === 'col') { var first = colsOf(scope, ['number']).filter(function (c) { return c.key !== 'weight'; })[0]; n.col = first && first.key; }
    if (v === 'pct') n.p = 20;
    d[p.k] = n; save(true);
  }, { 'aria-label': p.label + ' comes from' });
  kids.push(sel);
  if (cur.src === 'const') kids.push(numInput(cur.v, function (v) { d[p.k] = { src: 'const', v: v }; save(false); }, { 'aria-label': p.label }));
  else if (cur.src === 'col') kids.push(select(colsOf(scope, ['number']).filter(function (c) { return c.key !== 'weight'; }).map(function (c) { return [c.key, c.name]; }), cur.col, function (v) { d[p.k] = { src: 'col', col: v }; save(false); }));
  else if (cur.src === 'pct') kids.push(numInput(cur.p, function (v) { d[p.k] = { src: 'pct', p: v }; save(false); }, { min: 0, 'aria-label': 'Percent' }), h('span', { class: 'muted small' }, '% of the first value'));
  else if (cur.src === 'weight') kids.push(h('span', { class: 'muted small' }, 'taken from each link'));
  return h('div', { class: 'param' }, [h('span', null, p.label), h('div', { class: 'row', style: { gap: '6px' } }, kids)]);
}
/** One distribution picker. scope: 'one' (a single number), 'edges' (per link) or 'nodes' (per item). */
function distEditor(title, role, scope, d, opts, rerender) {
  var DS = NFMSim.DISTS, save = function (again) { saveAdv(); if (again) rerender(); };
  var options = [];
  if (opts.auto) options.push(['auto', opts.auto]);
  if (opts.none) options.push(['none', opts.none]);
  DS.forEach(function (x) { if (x.id === 'empirical' && scope === 'one' && !colsOf('nodes', ['number']).length && !colsOf('edges', ['number']).length) return; options.push([x.id, x.name]); });
  var box = h('div', { class: 'distbox' }, [h('h3', null, title)]);
  box.appendChild(select(options, d.dist, function (v) {
    d.dist = v;
    var info = NFMSim.DIST_BY[v];
    ['a', 'b', 'c'].forEach(function (k) { delete d[k]; });
    if (info && v !== 'empirical') info.params.forEach(function (p, i) { d[p.k] = defaultParam(role, v, p.k, i); });
    if (v === 'empirical' && !d.values) d.values = scope === 'nodes' ? { scope: 'nodes', col: (colsOf('nodes', ['number'])[0] || {}).key } : { scope: 'edges', col: 'weight' };
    save(true);
  }, { 'aria-label': title }));
  var info = NFMSim.DIST_BY[d.dist];
  if (info) {
    box.appendChild(h('p', { class: 'muted small', style: { margin: '4px 0' } }, info.blurb));
    if (d.dist === 'empirical') {
      var vc = [];
      colsOf('edges', ['number']).forEach(function (c) { vc.push(['edges|' + c.key, 'Links: ' + c.name]); });
      if (!colsOf('edges', ['number']).some(function (c) { return c.key === 'weight'; })) vc.unshift(['edges|weight', 'Links: Weight']);
      colsOf('nodes', ['number']).forEach(function (c) { vc.push(['nodes|' + c.key, 'Items: ' + c.name]); });
      var cv = d.values ? d.values.scope + '|' + d.values.col : '';
      box.appendChild(field('Numbers to pick from', select(vc, cv, function (v) { var p = v.split('|'); d.values = { scope: p[0], col: p.slice(1).join('|') }; save(false); })));
    } else {
      info.params.forEach(function (p) { if (!d[p.k]) d[p.k] = defaultParam(role, d.dist, p.k, 0); box.appendChild(paramRow(d, p, role, scope, save)); });
      var ex = distSummary(d);
      if (ex) box.appendChild(h('p', { class: 'muted small', style: { margin: '4px 0 0' } }, ex));
    }
  }
  return box;
}
function defaultParam(role, dist, k, i) {
  if (role === 'linkWeight' && k === 'a') return { src: 'weight' };
  if (role === 'linkWeight' && k === 'b') return { src: 'pct', p: 20 };
  if (role === 'linkWeight' && k === 'c') return { src: 'pct', p: 150 };
  var first = { fixed: 10, normal: 100, lognormal: 100, poisson: 100, binomial: 100, negbinomial: 100, geometric: 4, exponential: 1, gamma: 1, weibull: 1, beta: 0.3, uniform: 0, triangular: 0, pareto: 1, dunif: 1 };
  var second = { normal: 15, lognormal: 40, binomial: 0.1, negbinomial: 30, gamma: 0.5, weibull: 1.5, beta: 0.1, uniform: 2, triangular: 2, pareto: 2.5, dunif: 6 };
  if (k === 'a') return { src: 'const', v: first[dist] !== undefined ? first[dist] : 1 };
  if (k === 'b') return { src: 'const', v: second[dist] !== undefined ? second[dist] : 1 };
  return { src: 'const', v: 4 };
}
function distSummary(d) {
  if (!d || !d.a || d.a.src !== 'const') return '';
  var m; try { m = NFMSim.moments(d.dist, d.a.v, d.b && d.b.src === 'const' ? d.b.v : 0, d.c && d.c.src === 'const' ? d.c.v : 0); } catch (e) { return ''; }
  if (!m || !(m.mean === m.mean)) return '';
  var sd = Math.sqrt(m.variance);
  return 'Average ' + NFMColumns.fmt(m.mean) + (sd === sd && isFinite(sd) ? ', typical spread ' + NFMColumns.fmt(sd) : '') + '.';
}

/* ---------------------------------------------------------------- the set-up card */
function startPicker(c) {
  var ids = startIds(), d = defaultStart(), box = h('div', null);
  var chips = h('div', { class: 'chips' }, ids.map(function (id) { return h('span', { class: 'chip' }, [labelOf(id), h('button', { class: 'x', 'aria-label': 'Remove ' + labelOf(id), onclick: function () { c.starts = ids.filter(function (x) { return x !== id; }); saveAdv(); renderAdv(); } }, '×')]); }));
  var dl = h('datalist', { id: 'sim-starts' }, S.graph.nodes.slice(0, 3000).map(function (n) { return h('option', { value: n.label || n.id }); }));
  var inp = h('input', { type: 'search', list: 'sim-starts', placeholder: 'Add a start ' + word('item') + '…', 'aria-label': 'Add a start item' });
  var add = function () {
    var q = inp.value.trim(); if (!q) return;
    var hit = S.graph.nodes.find(function (n) { return (n.label || n.id) === q || n.id === q; }) || S.graph.nodes.find(function (n) { return String(n.label || n.id).toLowerCase() === q.toLowerCase(); });
    if (!hit) { toast('I could not find "' + q + '".'); return; }
    if (c.starts.indexOf(hit.id) < 0) c.starts = ids.concat([hit.id]); inp.value = ''; saveAdv(); renderAdv();
  };
  inp.addEventListener('change', add);
  var selBtn = S.sel.size ? h('button', { class: 'sm', onclick: function () { c.starts = Array.from(S.sel).filter(function (id) { return S.byId.has(id); }).slice(0, 200); saveAdv(); renderAdv(); } }, 'Use the ' + plural(S.sel.size, 'selected ' + word('item')) + ' from the Map') : null;
  box.appendChild(h('div', { class: 'row' }, [inp, dl, selBtn, ids.length ? h('button', { class: 'sm', onclick: function () { c.starts = []; saveAdv(); renderAdv(); } }, 'Clear') : null]));
  box.appendChild(ids.length ? chips : h('p', { class: 'muted small', style: { margin: '4px 0 0' } }, d && d.id ? 'Walkers start at "' + labelOf(d.id) + '", the start set for this data. Add items here to start them elsewhere; several starts are used equally often.' : 'No start item is set. Add at least one here, or set one in the Nodes tab.'));
  return box;
}
function simSetup() {
  var c = SC(), rerender = renderAdv;
  var big = field('Walkers (most)', h('div', { class: 'row', style: { gap: '6px' } }, [
    select([1000, 5000, 10000, 25000, 50000, 100000].map(function (v) { return [v, nfmt(v)]; }).concat([[c.walkers, nfmt(c.walkers)]]).filter(function (x, i, a) { return a.findIndex(function (y) { return y[0] === x[0]; }) === i; }).sort(function (a, b) { return a[0] - b[0]; }), c.walkers, function (v) { c.walkers = +v; saveAdv(); rerender(); }, { 'aria-label': 'Number of walkers' }),
    numInput(c.walkers, function (v) { c.walkers = clamp(Math.round(v) || 1000, 10, 100000); saveAdv(); rerender(); }, { min: 10, max: 100000, step: 100, style: { width: '96px' }, 'aria-label': 'Number of walkers, typed' })]), 'Up to 100,000.');
  var rep = field('Repeats', select([1, 10, 50, 100, 200, 500, 1000].map(function (v) { return [v, nfmt(v)]; }), c.repeats, function (v) { c.repeats = +v; saveAdv(); rerender(); }), 'Each repeat draws its own arrivals and weights.');
  var seed = field('Random seed', numInput(c.seed, function (v) { c.seed = Math.round(v); saveAdv(); }, { step: 1 }), 'Same seed, same answer.');
  var cap = field('Longest walk (steps)', select([50, 100, 400, 1000, 5000].map(function (v) { return [v, nfmt(v)]; }), c.stepCap, function (v) { c.stepCap = +v; saveAdv(); }), 'A walker that is still going after this many steps is counted as stuck.');
  var rule = field('How a walker chooses', select(WALKER_RULES, c.rule, function (v) { c.rule = v; saveAdv(); rerender(); }));
  var temp = c.rule === 'softmax' ? field('Pickiness (lower = pickier)', numInput(c.temp, function (v) { c.temp = v > 0 ? v : 1; saveAdv(); }, { min: 0.01, step: 0.1 })) : null;
  var run = h('button', { class: 'primary', id: 'sim-run', onclick: runSim, disabled: SIM.st === 'running' }, SIM.st === 'idle' ? 'Run the simulation' : 'Run again');
  var stop = h('button', { id: 'sim-stop', onclick: stopSim, hidden: SIM.st !== 'running' }, 'Stop');
  return h('div', { class: 'card' }, [h('h2', null, 'Monte Carlo simulation'),
    h('p', { class: 'muted small', style: { margin: 0 } }, 'Send many ' + word('walkers') + ' through your links by chance and count where they end up. The exact odds are worked out too, when they can be, so you can see how close the dice get.'),
    h('h3', null, 'Where they start'), startPicker(c),
    h('div', { class: 'maprow' }, [big, rep, seed, cap, rule, temp]),
    h('div', { class: 'row' }, [run, stop, h('span', { class: 'muted small' }, 'Runs in the background; you can keep working.')]),
    acc('How many arrive, how sure the link weights are, what things cost (optional)', [
      distEditor('How many ' + word('walkers') + ' arrive in each repeat', 'arrivals', 'one', c.arrivals, { auto: 'The same number each time (automatic)' }, rerender),
      distEditor('How uncertain each link weight is', 'linkWeight', 'edges', c.linkWeight, { none: 'Not uncertain: use the weights as they are' }, rerender),
      distEditor('What taking a link costs (time or money)', 'linkCost', 'edges', c.linkCost, { none: 'Nothing' }, rerender),
      distEditor('How long a walker stays at each ' + word('item'), 'dwell', 'nodes', c.dwell, { none: 'Nothing' }, rerender)
    ].concat([h('p', { class: 'muted small', style: { margin: 0 } }, 'Not every choice is a good fit for every number. The sentence under each picker tells what it is for. Columns that hold numbers can fill in the settings, one value per link or item.')]), !!(c.arrivals.dist !== 'auto' || c.linkWeight.dist !== 'none' || c.linkCost.dist !== 'none' || c.dwell.dist !== 'none'))
  ]);
}

/* ---------------------------------------------------------------- results */
function barChartHist(hist, label, fmtX) {
  var bins = hist && hist.bins || [];
  if (!bins.length) return h('p', { class: 'muted small' }, 'Nothing to show yet.');
  var mx = Math.max.apply(null, bins) || 1, n = bins.length, W = 300, H = 90, bw = W / n;
  var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + (H + 14), class: 'chart', role: 'img', 'aria-label': label }, bins.map(function (b, i) { var bh = b / mx * H; return svgEl('rect', { x: i * bw + 0.5, y: H - bh, width: Math.max(0.5, bw - 1), height: bh, class: 'bar' }); }).concat([
    svgEl('line', { x1: 0, x2: W, y1: H + 0.5, y2: H + 0.5, class: 'axis' }), (function () { var t = svgEl('text', { x: 0, y: H + 11, class: 'tick' }); t.textContent = fmtX(hist.lo); return t; })(), (function () { var t = svgEl('text', { x: W, y: H + 11, class: 'tick', 'text-anchor': 'end' }); t.textContent = fmtX(hist.hi); return t; })()]));
  return svg;
}
function endpointRows(snap) {
  var ex = SIM.exact, exMap = new Map();   /* a Map: an item called "constructor" or "toString" must not find the built-in object members */
  if (ex) ex.ends.forEach(function (id, i) { exMap.set(id, ex.p[i]); });
  var rows = snap.endpoints.map(function (e) { return { id: e.id, share: e.share, lo: e.lo, hi: e.hi, exact: exMap.get(e.id), count: e.count, perTrial: e.perTrial, cost: e.cost }; });
  rows.sort(function (a, b) { return Math.max(b.share, b.exact || 0) - Math.max(a.share, a.exact || 0); });
  return rows;
}
function endpointChart(snap) {
  var rows = endpointRows(snap), total = rows.length, shown = SIM.allEnds ? rows : rows.slice(0, 12);
  var top = 0.0001; shown.forEach(function (r) { top = Math.max(top, r.hi, r.exact || 0); }); top *= 1.06;
  var list = h('div', { class: 'eprows' });
  shown.forEach(function (r) {
    var x = function (v) { return Math.max(0, Math.min(100, v / top * 100)); };
    var svg = svgEl('svg', { viewBox: '0 0 100 12', preserveAspectRatio: 'none', class: 'epbar', 'aria-hidden': 'true' }, [
      svgEl('rect', { x: 0, y: 3, width: x(r.share), height: 6, class: 'bar' }),
      svgEl('line', { x1: x(r.lo), x2: x(r.hi), y1: 6, y2: 6, class: 'whisk' }),
      svgEl('line', { x1: x(r.lo), x2: x(r.lo), y1: 3, y2: 9, class: 'whisk' }), svgEl('line', { x1: x(r.hi), x2: x(r.hi), y1: 3, y2: 9, class: 'whisk' }),
      r.exact !== undefined ? svgEl('rect', { x: x(r.exact) - 0.45, y: 0, width: 0.9, height: 12, class: 'exact' }) : null]);
    var inside = r.exact === undefined ? '' : (r.exact >= r.lo - 1e-9 && r.exact <= r.hi + 1e-9 ? ' ✓' : ' ≠');
    list.appendChild(h('div', { class: 'eprow' }, [
      h('button', { class: 'link', title: 'Show on the map', onclick: function () { showItemOnMap(r.id); } }, labelOf(r.id)), svg,
      h('span', { class: 'epnum' }, pct(r.share) + ' (' + pct(r.lo) + ' to ' + pct(r.hi) + ')' + (r.exact !== undefined ? ' · exact ' + pct(r.exact) + inside : ''))]));
  });
  var kids = [list];
  if (total > shown.length || SIM.allEnds) kids.push(h('button', { class: 'sm', onclick: function () { SIM.allEnds = !SIM.allEnds; renderSimResults(); } }, SIM.allEnds ? 'Show fewer' : 'Show all ' + nfmt(total)));
  kids.push(h('p', { class: 'muted small', style: { margin: '4px 0 0' } }, 'Bar: simulated share. Line: the range the dice allow (95% sure). Mark: exact odds' + (SIM.exactAvg ? ' using the average weights' : '') + (SIM.exact ? '' : ' (not available for this set-up)') + '. ✓ means the exact value is inside the range.'));
  return kids;
}
function traceChart(snap) {
  var tr = snap.trace || []; if (tr.length < 3) return null;
  var rows = endpointRows(snap).slice(0, 6), W = 300, H = 110, pad = 26;
  var xmin = Math.log10(Math.max(1, tr[0].walkers)), xmax = Math.log10(Math.max(2, tr[tr.length - 1].walkers));
  if (xmax - xmin < 0.1) xmax = xmin + 0.1;
  var top = 0.0001; rows.forEach(function (r) { top = Math.max(top, r.share, r.exact || 0); }); top = Math.min(1, top * 1.25);
  var X = function (w) { return pad + (Math.log10(Math.max(1, w)) - xmin) / (xmax - xmin) * (W - pad - 4); }, Y = function (v) { return H - v / top * (H - 8); };
  var order = {}; snap.endpoints.forEach(function (e, i) { order[e.id] = i; });
  var kids = [svgEl('line', { x1: pad, x2: W, y1: H, y2: H, class: 'axis' }), svgEl('line', { x1: pad, x2: pad, y1: 0, y2: H, class: 'axis' })];
  var t1 = svgEl('text', { x: 2, y: 10, class: 'tick' }); t1.textContent = pct(top, 0); kids.push(t1);
  var t2 = svgEl('text', { x: pad, y: H + 11, class: 'tick' }); t2.textContent = nfmt(tr[0].walkers); kids.push(t2);
  var t3 = svgEl('text', { x: W, y: H + 11, class: 'tick', 'text-anchor': 'end' }); t3.textContent = nfmt(tr[tr.length - 1].walkers) + ' walkers'; kids.push(t3);
  rows.forEach(function (r, ri) {
    var k = order[r.id], d = tr.map(function (p, i) { return (i ? 'L' : 'M') + X(p.walkers).toFixed(1) + ' ' + Y(p.shares[k]).toFixed(1); }).join('');
    kids.push(svgEl('path', { d: d, class: 'line c' + (ri % 6) }));
    if (r.exact !== undefined) kids.push(svgEl('line', { x1: pad, x2: W, y1: Y(r.exact), y2: Y(r.exact), class: 'exline c' + (ri % 6) }));
  });
  var legend = h('div', { class: 'chartkey' }, rows.map(function (r, ri) { return h('span', null, [h('i', { class: 'sw c' + (ri % 6) }), labelOf(r.id)]); }));
  return [svgEl('svg', { viewBox: '0 0 ' + W + ' ' + (H + 14), class: 'chart', role: 'img', 'aria-label': 'How the shares settle as more walkers are added' }, kids), legend, h('p', { class: 'muted small', style: { margin: 0 } }, 'Dashed lines are the exact odds. The shares wobble at first and settle as walkers are added.')];
}
function showItemOnMap(id) {
  if (!S.byId.has(id)) return;
  showTab('map'); setTimeout(function () { setSel([id], { center: true }); }, 60);
}
function simStatus() {
  var snap = SIM.snap;
  if (SIM.st === 'idle' && !snap) return SIM.err ? h('div', { class: 'verdict attention' }, SIM.err) : h('p', { class: 'muted' }, 'Set up the walkers above, then press Run.');
  if (SIM.st === 'running') {
    var tot = SIM.spec ? SIM.spec.trials : 1, got = snap ? snap.trials : 0;
    return h('div', null, [h('progress', { max: tot, value: got, 'aria-label': 'Simulation progress' }), h('p', { class: 'muted small', style: { margin: '2px 0 0' } }, (snap ? nfmt(snap.walkers) + ' walkers so far' : 'Starting…') + ' · repeat ' + nfmt(got) + ' of ' + nfmt(tot) + (client && client.mode === 'worker' ? ' · in the background' : ''))]);
  }
  var secs = SIM.ms / 1000;
  return h('div', { class: 'verdict ' + (snap && snap.stuckShare > 0.02 ? 'look' : 'clean') }, (SIM.st === 'stopped' ? 'Stopped. ' : 'Done. ') + nfmt(snap ? snap.walkers : 0) + ' walkers in ' + (secs < 10 ? secs.toFixed(1) : Math.round(secs)) + ' seconds.' + (snap && snap.stuckShare > 0.001 ? ' ' + pct(snap.stuckShare) + ' did not reach an end within ' + nfmt(SC().stepCap) + ' steps.' : ''));
}
function simMapCard(snap) {
  var c = SC();
  return h('div', { class: 'row' }, [
    h('button', { class: 'primary', onclick: function () { setV({ colorBy: 'sim', widthBy: 'sys:sim', sizeBy: S.V.sizeBy }, 'none'); S.simVer++; showTab('map'); } }, 'Show on the Map'),
    check('Animate flow dots on the Map', c.dots, function (on) { c.dots = on; saveAdv(); if (S.tab === 'map') { attachSimOverlay(); requestDraw(); } }),
    h('span', { class: 'muted small' }, 'Colors show visits per walker. Link width shows traffic.')
  ]);
}
function sweepCard() {
  var what = SIM.sweepWhat, kids = [h('h3', null, 'What if one ' + (what === 'links' ? 'link' : word('item')) + ' were gone?'),
    h('p', { class: 'muted small', style: { margin: 0 } }, 'Takes away the busiest ' + (what === 'links' ? 'links' : word('items')) + ' one at a time and measures how much the end odds move. Uses exact odds, not dice.'),
    h('div', { class: 'row' }, [seg([['items', cap(word('items'))], ['links', cap(word('links'))]], what, function (v) { SIM.sweepWhat = v; SIM.sweep = null; SIM.sweepId++; SIM.sweepBusy = false; renderSimResults(); }), h('button', { id: 'sim-sweep', disabled: SIM.sweepBusy, onclick: runSweep }, SIM.sweepBusy ? 'Working…' : 'Rank them')])];
  var sw = SIM.sweep;
  if (sw && !sw.ok) kids.push(h('p', { class: 'muted' }, sw.reason));
  else if (sw && sw.rows.length) {
    var head = ['', 'Odds that move', 'Biggest change', 'Stuck'];
    var body = sw.rows.slice(0, 25).map(function (r) {
      var bi = 0, bd = 0; r.after.forEach(function (a, i) { var d = a - sw.before[i]; if (Math.abs(d) > Math.abs(bd)) { bd = d; bi = i; } });
      var name = r.kind === 'item' ? labelOf(r.id) : labelOf(r.from) + ' → ' + labelOf(r.to);
      return h('tr', null, [h('td', null, h('button', { class: 'link', onclick: function () { if (r.kind === 'item') showItemOnMap(r.id); else showItemOnMap(r.from); } }, name)), h('td', { class: 'num' }, pct(r.shift)), h('td', null, labelOf(sw.ends[bi]) + ' ' + (bd >= 0 ? '+' : '') + (bd * 100).toFixed(1) + ' points'), h('td', { class: 'num' }, pct(r.stuck))]);
    });
    kids.push(h('div', { class: 'tablewrap', style: { maxHeight: '300px' } }, h('table', { class: 't' }, [h('thead', null, h('tr', null, head.map(function (x) { return h('th', null, x); }))), h('tbody', null, body)])));
    kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, '"Odds that move" is the share of all walkers who end somewhere else.' + (sw.partial ? ' Time ran out before every candidate was tried.' : '')));
  } else if (sw) kids.push(h('p', { class: 'muted' }, 'Nothing to rank.'));
  return h('div', { class: 'simsub' }, kids);
}
function runSweep() {
  if (SIM.sweepBusy) return;
  /* a result is only used when nothing it depends on changed meanwhile (Items/Links switched, new data, a new run): each ranking has its own number, like the simulation loop */
  var sid = ++SIM.sweepId, rid = SIM.runId, ok = function () { return sid === SIM.sweepId && rid === SIM.runId; };
  SIM.sweepBusy = true; SIM.sweep = null; renderSimResults();
  client.sweep(buildSpec(true), prepOpts(), { what: SIM.sweepWhat, top: 30, budgetMs: 8000 }).then(function (r) { if (ok()) SIM.sweep = r.L; }).catch(function (err) { if (err.message !== 'superseded' && ok()) SIM.sweep = { ok: false, reason: err.message, rows: [] }; }).then(function () { if (ok()) { SIM.sweepBusy = false; renderSimResults(); } });
}
function costBlock(snap) {
  var c = snap.cost; if (!c) return null;
  var f = NFMColumns.fmt;
  return h('div', { class: 'simsub' }, [h('h3', null, 'Cost per walker'), barChartHist(c.hist, 'Cost per walker', f),
    h('p', { class: 'muted small', style: { margin: '2px 0 0' } }, 'Average ' + f(c.mean) + ' · middle half ' + f(c.p25) + ' to ' + f(c.p75) + ' · 9 in 10 between ' + f(c.p5) + ' and ' + f(c.p95) + '.'),
    snap.endpoints.some(function (e) { return e.cost; }) ? h('div', { class: 'tablewrap', style: { maxHeight: '200px' } }, h('table', { class: 't' }, [h('thead', null, h('tr', null, ['Ending', 'Average cost', 'Typical (middle)', '9 in 10 between'].map(function (x) { return h('th', null, x); }))),
      h('tbody', null, endpointRows(snap).filter(function (r) { return r.cost; }).slice(0, 15).map(function (r) { return h('tr', null, [h('td', null, labelOf(r.id)), h('td', { class: 'num' }, f(r.cost.mean)), h('td', { class: 'num' }, f(r.cost.p50)), h('td', null, f(r.cost.p5) + ' to ' + f(r.cost.p95))]); }))])) : null]);
}
function simResults() {
  var snap = SIM.snap, kids = [simStatus()];
  if (!snap) return kids;
  var ss = snap.stepStats;
  kids.push(h('h3', null, 'Where ' + word('walkers') + ' ended'), h('div', null, endpointChart(snap)));
  kids.push(h('div', { class: 'simgrid' }, [
    h('div', { class: 'simsub' }, [h('h3', null, 'Steps per walker'), barChartHist(snap.steps, 'Steps per walker', function (v) { return nfmt(Math.round(v)); }),
      ss ? h('p', { class: 'muted small', style: { margin: '2px 0 0' } }, 'Average ' + ss.mean.toFixed(1) + ' · typical ' + Math.round(ss.p50) + ' · 9 in 10 between ' + Math.round(ss.p5) + ' and ' + Math.round(ss.p95) + ' · longest ' + nfmt(ss.max)) : null]),
    costBlock(snap),
    (function () { var t = traceChart(snap); return t ? h('div', { class: 'simsub' }, [h('h3', null, 'Settling')].concat(t)) : null; })()
  ]));
  if (SIM.st !== 'running') { kids.push(simMapCard(snap)); kids.push(sweepCard()); }
  return kids;
}
var simDraw = 0;
function renderSimResults() {
  if (simDraw) return; simDraw = requestAnimationFrame(function () {
    simDraw = 0; var box = $('sim-results'); if (!box) return;
    mount(box, simResults());
    var r = $('sim-run'), s = $('sim-stop'); if (r) { r.disabled = SIM.st === 'running'; r.textContent = SIM.st === 'idle' && !SIM.snap ? 'Run the simulation' : 'Run again'; } if (s) s.hidden = SIM.st !== 'running';
  });
}
function renderSimAll() { renderSimResults(); }
function simCards() { return [simSetup(), h('div', { class: 'card', id: 'sim-results', 'aria-live': 'polite' }, simResults())]; }

/* ---------------------------------------------------------------- flow dots on the Map */
var DOTS = { raf: 0, key: '', list: [] };
function stopDots() { if (DOTS.raf) cancelAnimationFrame(DOTS.raf); DOTS.raf = 0; }
function dotsWanted() { return S.tab === 'map' && SC().dots && !!S.simSnap && !!S.scene && !reduceMotion && S.V.view !== 'matrix' && S.V.view !== 'sankey'; }
function dotList() {
  var sc = liveScene(), L = S.L, mv = S.simSnap && S.simSnap.moves; if (!sc || !L || !mv) return [];
  var key = S.simVer + '|' + sc.curveCount() + '|' + S.gver; if (DOTS.key === key && DOTS.sc === sc) return DOTS.list;
  var out = [], mx = 0, tr = new Float64Array(sc.curves.length), i;
  for (i = 0; i < sc.curves.length; i++) {
    var cv = sc.curves[i]; if (cv.edge === undefined || cv.edge < 0 || cv.back) continue;
    var e = L.edges[cv.edge], s = 0; if (e && e.orig) for (var q = 0; q < e.orig.length; q++) s += mv[e.orig[q]] || 0; else if (e && e.oi !== undefined) s = mv[e.oi] || 0;
    tr[i] = s; if (s > mx) mx = s;
  }
  if (mx > 0) for (i = 0; i < sc.curves.length; i++) if (tr[i] > 0) {
    var cnt = 1 + Math.floor(Math.sqrt(tr[i] / mx) * 5); out.push({ cv: sc.curves[i], n: cnt, sp: 0.18 + 0.5 * (tr[i] / mx), ph: (i * 0.618) % 1 });
    if (out.length > 1600) break;
  }
  DOTS.key = key; DOTS.sc = sc; DOTS.list = out; return out;
}
function simOverlay(ctx, view) {
  if (!dotsWanted()) return;
  var list = dotList(), t = performance.now() / 1000, T = S.scene.theme || {}, bez = NFMScene.bez, r = Math.max(1.6, Math.min(4, 2 + view.k * 0.6));
  ctx.fillStyle = NFMScene.css ? NFMScene.css(T.gold || T.accent || [240, 180, 40, 1]) : '#e6b422';
  ctx.globalAlpha = 0.9;
  for (var i = 0; i < list.length; i++) {
    var d = list[i];
    for (var j = 0; j < d.n; j++) {
      var u = (t * d.sp + d.ph + j / d.n) % 1, p = bez(d.cv.P, u), x = p[0] * view.k + view.tx, y = p[1] * view.k + view.ty;
      if (x < -10 || y < -10 || x > S.stageW + 10 || y > S.stageH + 10) continue;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function attachSimOverlay() {
  var want = dotsWanted();
  if (S.scene) S.scene.overlayDraw = want ? simOverlay : null;
  if (!want) { stopDots(); return; }
  if (!DOTS.raf) { var tick = function () { DOTS.raf = 0; if (!dotsWanted()) return; requestDraw(); DOTS.raf = requestAnimationFrame(tick); }; DOTS.raf = requestAnimationFrame(tick); }
}

/* Copyright (c) 2026 LFC Foundry. MIT License. The river (Sankey) before-and-after page: draws each test network the way the app does today and the way the improved layout would,
 * side by side, measures both with the same yardstick, and says in plain words which is better. Runs by itself when the page opens. */
(function () {
  'use strict';
  var E = NFMEngine, I = NFMImport, X = NFMExamples, Sc = NFMScene, SK = NFMSankey, VERSION = '__VERSION__';
  var params = new URLSearchParams(location.search), QUICK = params.has('quick');
  var $ = function (id) { return document.getElementById(id); }, esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var r1 = function (v) { return Math.round(v * 10) / 10; }, r2 = function (v) { return Math.round(v * 100) / 100; };
  var yieldUI = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  var PAL = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#8c8c8c'];

  /* ---- test networks ---- */
  function rng(seed) { var s = seed | 0; return function () { s = (s + 0x6d2b79f5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /** A made-up flow network: layers of items, links to the next layer (a few skip ahead), heavy-tailed amounts, and a few that run back. */
  function synth(nl, per, seed, loops) {
    var r = rng(seed), rows = ['from,to,weight'], k, j, q;
    for (k = 0; k + 1 < nl; k++) for (j = 0; j < per; j++) {
      var m = 1 + Math.floor(r() * 3);
      for (q = 0; q < m; q++) rows.push('Stage' + k + ' item' + j + ',Stage' + (k + 1) + ' item' + Math.floor(r() * per) + ',' + Math.max(1, Math.round(Math.exp(r() * 4))));
      if (k + 2 < nl && r() < 0.25) rows.push('Stage' + k + ' item' + j + ',Stage' + (k + 2 + Math.floor(r() * Math.max(1, nl - k - 2))) + ' item' + Math.floor(r() * per) + ',' + (Math.round(Math.exp(r() * 3)) + 1));
    }
    for (q = 0; q < loops; q++) { var a = 2 + Math.floor(r() * (nl - 2)); rows.push('Stage' + a + ' item' + Math.floor(r() * per) + ',Stage' + Math.floor(r() * a) + ' item' + Math.floor(r() * per) + ',' + (Math.round(Math.exp(r() * 2)) + 1)); }
    return rows.join('\n');
  }
  var NETS = [
    { id: 'itself', title: 'How this app turns data into a picture (example)', kind: 'example' },
    { id: 'pipeline', title: 'How work moves through a team (example)', kind: 'example' },
    { id: 'story', title: 'A short adventure (example, odds of each path)', kind: 'example', odds: true },
    { id: 'states', title: 'A supply chain over four states (example)', kind: 'example' },
    { id: 's1', title: 'Made-up: 5 stages of 6 items', kind: 'synth', nl: 5, per: 6, loops: 2 },
    { id: 's2', title: 'Made-up: 7 stages of 10 items', kind: 'synth', nl: 7, per: 10, loops: 3 },
    { id: 's3', title: 'Made-up: 9 stages of 14 items', kind: 'synth', nl: 9, per: 14, loops: 4 }
  ];
  if (!QUICK) NETS.push({ id: 's4', title: 'Made-up: 10 stages of 25 items', kind: 'synth', nl: 10, per: 25, loops: 5 });
  if (params.get('only')) NETS = NETS.filter(function (n) { return params.get('only').split(',').indexOf(n.id) >= 0; });
  if (QUICK) NETS = NETS.filter(function (n) { return n.id !== 's3'; });

  /* ---- drawing the improved layout as an SVG ---- */
  function afterSvg(R, L, colorOf) {
    var o = [], f = function (n) { return +n.toFixed(2); }, W = R.width, H = R.height;
    o.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + f(W) + ' ' + f(H) + '" font-family="system-ui,sans-serif"><rect width="' + f(W) + '" height="' + f(H) + '" fill="#fbfaf7"/>');
    R.bands.forEach(function (b) {
      var e = L.edges[b.edge], c = colorOf(e.from);
      o.push('<path d="M' + f(b.x0) + ' ' + f(b.y0a) + 'C' + f(b.xm) + ' ' + f(b.y0a) + ' ' + f(b.xm) + ' ' + f(b.y1a) + ' ' + f(b.x1) + ' ' + f(b.y1a) + 'L' + f(b.x1) + ' ' + f(b.y1b) + 'C' + f(b.xm) + ' ' + f(b.y1b) + ' ' + f(b.xm) + ' ' + f(b.y0b) + ' ' + f(b.x0) + ' ' + f(b.y0b) + 'Z" fill="' + c + '" fill-opacity=".42"><title>' + esc(e.from + ' → ' + e.to + ': ' + r2(e.flow)) + '</title></path>');
    });
    R.loops.forEach(function (lp) { var e = L.edges[lp.edge]; o.push('<path d="' + lp.d + '" fill="none" stroke="' + colorOf(e.from) + '" stroke-opacity=".42" stroke-width="' + f(lp.w) + '"><title>' + esc(e.from + ' → ' + e.to + ' (loops back): ' + r2(e.flow)) + '</title></path>'); });
    var lastX = Math.max.apply(null, R.nodes.map(function (n) { return n.x; }));
    R.nodes.forEach(function (n) {
      o.push('<rect x="' + f(n.x) + '" y="' + f(n.y) + '" width="' + f(n.w) + '" height="' + f(n.h) + '" fill="' + colorOf(n.id) + '" stroke="#333" stroke-opacity=".5" stroke-width=".6"><title>' + esc(n.label + ': ' + r2(n.flow)) + '</title></rect>');
      var left = n.x >= lastX - 1, t = String(n.label); if (t.length > 30) t = t.slice(0, 29) + '…';
      o.push('<text x="' + f(left ? n.x - 5 : n.x + n.w + 5) + '" y="' + f(n.y + n.h / 2 + 4) + '" font-size="12" text-anchor="' + (left ? 'end' : 'start') + '" fill="#222" stroke="#fbfaf7" stroke-width="3" paint-order="stroke" stroke-linejoin="round">' + esc(t) + '</text>');
    });
    return o.join('') + '</svg>';
  }

  /* ---- a picture inside a fixed frame: fits the whole picture, wheel to zoom, drag to move, buttons, and a link to open it full size ---- */
  function viewer(svgText, title, hideWhy) {
    var wrap = document.createElement('div'); wrap.className = 'view';
    var bar = document.createElement('div'); bar.className = 'vbar'; var cap = document.createElement('b'); cap.textContent = title; bar.appendChild(cap);
    wrap.appendChild(bar);
    var m = /viewBox="([-\d. ]+)"/.exec(svgText); var vb0 = m ? m[1].trim().split(/\s+/).map(Number) : [0, 0, 1000, 500];
    var blobUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    var open = document.createElement('a'); open.href = blobUrl; open.target = '_blank'; open.rel = 'noopener'; open.textContent = 'Open full size'; open.className = 'vlink';
    if (hideWhy) { var p = document.createElement('p'); p.className = 'note'; p.textContent = hideWhy; wrap.appendChild(p); bar.appendChild(open); return wrap; }
    var frame = document.createElement('div'); frame.className = 'frame'; wrap.appendChild(frame);
    wrap.fitFrame = function () { var w = Math.max(300, frame.clientWidth || 1000), h = Math.max(150, Math.min(480, w * vb0[3] / vb0[2])); frame.style.height = Math.round(h) + 'px'; };
    frame.innerHTML = svgText.replace(/<svg ([^>]*?)width="[^"]*"/, '<svg $1').replace(/<svg ([^>]*?)height="[^"]*"/, '<svg $1').replace('<svg ', '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet" ');
    var svg = frame.querySelector('svg'), vb = vb0.slice(), set = function () { svg.setAttribute('viewBox', vb.join(' ')); };
    var fit = function () { vb = vb0.slice(); set(); };
    var zoom = function (f, cx, cy) { var nx = cx === undefined ? vb[0] + vb[2] / 2 : cx, ny = cy === undefined ? vb[1] + vb[3] / 2 : cy; vb = [nx - (nx - vb[0]) / f, ny - (ny - vb[1]) / f, vb[2] / f, vb[3] / f]; set(); };
    var btn = function (t, fn, label) { var b = document.createElement('button'); b.textContent = t; b.title = label; b.setAttribute('aria-label', label); b.onclick = fn; bar.appendChild(b); };
    btn('Fit', fit, 'Fit the whole picture'); btn('+', function () { zoom(1.5); }, 'Zoom in'); btn('−', function () { zoom(1 / 1.5); }, 'Zoom out'); bar.appendChild(open);
    var toWorld = function (e) { var r = svg.getBoundingClientRect(), k = Math.max(vb[2] / r.width, vb[3] / r.height), ox = (r.width - vb[2] / k) / 2, oy = (r.height - vb[3] / k) / 2; return [vb[0] + (e.clientX - r.left - ox) * k, vb[1] + (e.clientY - r.top - oy) * k, k]; };
    frame.addEventListener('wheel', function (e) { e.preventDefault(); var w0 = toWorld(e); zoom(Math.exp(-e.deltaY * 0.0015), w0[0], w0[1]); }, { passive: false });
    var drag = null; frame.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY }; frame.setPointerCapture(e.pointerId); frame.style.cursor = 'grabbing'; });
    frame.addEventListener('pointermove', function (e) { if (!drag) return; var k = toWorld(e)[2]; vb[0] -= (e.clientX - drag.x) * k; vb[1] -= (e.clientY - drag.y) * k; drag.x = e.clientX; drag.y = e.clientY; set(); });
    frame.addEventListener('pointerup', function () { drag = null; frame.style.cursor = 'grab'; });
    frame.addEventListener('dblclick', fit);
    return wrap;
  }

  /* ---- one network ---- */
  function build(net) {
    var graph, opts, ex;
    if (net.kind === 'example') {
      ex = X.LIST.find(function (x) { return x.id === net.id; }).load(); graph = ex.graph;
      opts = net.odds ? { view: 'river', colorBy: 'odds', wantFlow: true } : { view: 'river', amounts: true, widthBy: 'weight', colorBy: 'group' };
      if (ex.opts) opts = Object.assign({}, opts, ex.opts);
    } else { graph = I.importDelimited(synth(net.nl, net.per, 5, net.loops), ',').graph; opts = { view: 'river', amounts: true, widthBy: 'weight', colorBy: 'group' }; }
    return { graph: graph, opts: opts };
  }
  async function runOne(net, sec) {
    var b = build(net), t0 = performance.now(), L = E.build(b.graph, b.opts), nowMs = performance.now() - t0;
    var scene = Sc.make(L, { colorBy: net.odds ? 'odds' : 'group', theme: 'light' });
    var flowOf = function (ei) { return L.edges[ei].flow; };
    var und = L.edges.filter(function (e) { return (e.kind === 'back' || e.kind === 'flat') && e.flow > 1e-9; }).reduce(function (s, e) { return s + e.flow; }, 0);
    var gNow = { bands: scene.ribbons.map(function (r) { return { edge: r.edge, from: r.from, to: r.to, x0: r.x0, y0a: r.y0a, y0b: r.y0b, x1: r.x1, y1a: r.y1a, y1b: r.y1b, xm: r.xm }; }), nodes: L.nodes, undrawn: und, height: L.height, width: L.width };
    var common = new Set(gNow.bands.map(function (x) { return x.edge; }));
    var t1 = performance.now(), R = SK.layout(L), newMs = performance.now() - t1, R0 = SK.layout(L, { unweighted: true });
    var gNew = { bands: R.bands, loops: R.loops, nodes: R.nodes, height: R.height, width: R.width }, gPlain = { bands: R0.bands, loops: R0.loops, nodes: R0.nodes, height: R0.height, width: R0.width };
    var mNow = SK.measure(gNow, flowOf), mPlain = SK.measure(gPlain, flowOf), mNew = SK.measure(gNew, flowOf);
    var cNow = SK.measure(gNow, flowOf, common), cNew = SK.measure(gNew, flowOf, common), cPlain = SK.measure(gPlain, flowOf, common);
    var grp = {}; L.nodes.forEach(function (n, q) { grp[n.id] = n.group !== undefined && n.group !== '' ? String(n.group) : n.id; });
    var keys = Array.from(new Set(Object.values(grp))), colorOf = function (id) { return PAL[(keys.length > 10 ? Math.abs(hash(id)) : keys.indexOf(grp[id])) % PAL.length]; };
    var card = sec.card, big = L.nodes.length > 100, why = big ? 'Picture not shown: with ' + L.nodes.length + ' items it would be too small to read. Use "Open full size" to look at it, or the table below.' : '';
    [viewer(Sc.toSvg(scene, net.title), 'Now (the app today)', why), viewer(afterSvg(R, L, colorOf), 'Improved', why)].forEach(function (v) { card.appendChild(v); if (v.fitFrame) v.fitFrame(); });
    if (!big) { var hint = document.createElement('p'); hint.className = 'note'; hint.textContent = 'Scroll to zoom, drag to move, double-click to fit the whole picture.'; card.appendChild(hint); }
    var pct = function (v) { return Math.round(v * 100) + '%'; }, sp = function (v) { return v < 1.05 ? '1.0 (exact)' : r1(v) + '×'; };
    var rows = [
      ['Flow drawn as bands', pct(mNow.drawnShare), pct(mPlain.drawnShare), pct(mNew.drawnShare)],
      ['Band thickness vs flow (thickest per unit ÷ thinnest; 1.0 is exact)', sp(mNow.widthSpread), sp(mPlain.widthSpread), sp(mNew.widthSpread)],
      ['Weighted crossings, all bands drawn (lower is better)', r2(mNow.crossingWeight), r2(mPlain.crossingWeight), r2(mNew.crossingWeight)],
      ['Weighted crossings, only the links Now draws', r2(cNow.crossingWeight), r2(cPlain.crossingWeight), r2(cNew.crossingWeight)],
      ['Crossing count, all bands drawn', mNow.crossings, mPlain.crossings, mNew.crossings],
      ['Bands drawn over an item they do not touch', mNow.nodeHits, mPlain.nodeHits, mNew.nodeHits],
      ['Average rise or fall of a band (% of picture height)', r1(mNow.bend * 100), r1(mPlain.bend * 100), r1(mNew.bend * 100)],
      ['Time to arrange (ms)', Math.round(nowMs) + ' (whole build)', Math.round(R0.ms), Math.round(newMs)]
    ];
    sec.head = ['Measure', 'Now', 'Improved, old-style order', 'Improved']; sec.rows = rows;
    var tbl = '<div class="tw"><table><thead><tr>' + sec.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    card.insertAdjacentHTML('beforeend', tbl);
    var wins = [], notes = [];
    if (mNew.drawnShare > mNow.drawnShare + 0.02) wins.push('draws ' + pct(mNew.drawnShare) + ' of the flow as bands (Now: ' + pct(mNow.drawnShare) + ')');
    if (mNow.widthSpread > 1.2) wins.push('makes every band as thick as its flow (Now: the thickest is ' + r1(mNow.widthSpread) + '× the thinnest per unit)');
    var ordGain = mPlain.crossingWeight > 0 ? 1 - mNew.crossingWeight / mPlain.crossingWeight : 0;
    if (ordGain > 0.05) wins.push('cuts weighted crossings by ' + Math.round(ordGain * 100) + '% against the old-style order on the same layout');
    if (mNew.crossings > mPlain.crossings) notes.push('It trades more small crossings (' + mNew.crossings + ' against ' + mPlain.crossings + ') for fewer big ones, on purpose.');
    var say = wins.length ? 'The improved picture ' + wins.join('; ') + '.' : 'On this network the two pictures measure about the same.';
    sec.finish(wins.length ? 'ok' : 'warn', say, notes);
    return { id: net.id, title: net.title, now: mNow, plain: mPlain, improved: mNew, commonNow: cNow.crossingWeight, commonNew: cNew.crossingWeight, ordGain: ordGain, ms: { now: nowMs, improved: newMs } };
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

  /* ---- page ---- */
  var sections = [];
  function addSection(title) {
    var card = document.createElement('div'); card.className = 'card'; card.innerHTML = '<h2></h2><div class="verdict note">Working…</div>'; card.firstChild.textContent = title; $('out').appendChild(card);
    var s = { title: title, card: card, head: null, rows: [], verdict: '', level: 'ok', notes: [] };
    s.finish = function (level, say, notes) { s.level = level; s.verdict = say; s.notes = notes || []; var v = card.querySelector('.verdict'); v.className = 'verdict ' + level; v.textContent = say; s.notes.forEach(function (n) { var p = document.createElement('p'); p.className = 'note'; p.textContent = n; card.appendChild(p); }); };
    sections.push(s); return s;
  }
  function mdTable(head, rows) { return '| ' + head.join(' | ') + ' |\n|' + head.map(function (_, i) { return i ? '---:' : '---'; }).join('|') + '|\n' + rows.map(function (r) { return '| ' + r.join(' | ') + ' |'; }).join('\n') + '\n'; }
  async function runAll() {
    $('out').innerHTML = ''; sections = []; var results = [], t0 = performance.now();
    for (var i = 0; i < NETS.length; i++) {
      $('status').textContent = 'Network ' + (i + 1) + ' of ' + NETS.length + ': ' + NETS[i].title + '…'; $('barfill').style.width = Math.round(100 * i / NETS.length) + '%'; await yieldUI();
      var s = addSection(NETS[i].title);
      try { results.push(await runOne(NETS[i], s)); } catch (e) { s.finish('bad', 'This network stopped with an error: ' + String(e && e.message || e)); }
      await yieldUI();
    }
    var el = performance.now() - t0; $('barfill').style.width = '100%'; $('status').textContent = 'Finished in ' + (el / 1000).toFixed(1) + ' seconds.';
    var good = results.filter(function (r) { return r.improved.drawnShare >= r.now.drawnShare && r.improved.widthSpread <= r.now.widthSpread + 0.01 && r.ordGain >= 0; }).length;
    var avgGain = results.length ? results.reduce(function (s, r) { return s + r.ordGain; }, 0) / results.length : 0;
    var overall = 'The improved layout was at least as good on ' + good + ' of ' + results.length + ' networks. Weighted crossings fell by ' + Math.round(avgGain * 100) + '% on average against the old-style order on the same layout.';
    $('finalsay').textContent = overall; $('done').style.display = '';
    var L = ['# Net Flow Map river before and after', '', 'Version ' + VERSION + ' · run ' + new Date().toISOString() + ' · took ' + (el / 1000).toFixed(1) + ' s' + (QUICK ? ' · QUICK' : ''), '', overall, ''];
    sections.forEach(function (s) { L.push('## ' + s.title, '', '**' + s.level.toUpperCase() + '** ' + s.verdict, ''); if (s.head) L.push(mdTable(s.head, s.rows)); s.notes.forEach(function (n) { L.push('_' + n + '_', ''); }); });
    L.push('## Raw data', '', '```json', JSON.stringify(results, null, 1), '```', '');
    var md = L.join('\n');
    $('dl').onclick = function () { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' })); a.download = 'net-flow-map-river-results.md'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 500); };
    $('cp').onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(md).then(function () { $('cp').textContent = 'Copied'; }, function () { $('cp').textContent = 'Copy blocked'; }); };
    window.__NFM_SANKEY_RESULT = { md: md, results: results, sections: sections.map(function (s) { return { title: s.title, level: s.level, verdict: s.verdict }; }) };
  }
  $('again').onclick = function () { runAll(); };
  window.addEventListener('load', function () { setTimeout(runAll, 300); });
})();

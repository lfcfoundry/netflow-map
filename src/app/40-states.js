/*!
 * Netflow Map app, part 5b: states (baseline, year 1, year 2 ...): turning columns into states, the timeline, and the morph between them.
 * Copyright (c) 2026 LFC Foundry. MIT License.
 */
var ST = { frames: null, key: '', pending: null, pendingKey: '', token: 0, playing: false, pos: 0, raf: 0, last: 0, lastMake: 0, makeMs: 16, shown: null, wmax: null, building: 0 };
function nStates() { var s = S.graph.states; return s && s.names && s.names.length > 1 && S.graph.edges.some(function (e) { return e.vals; }) ? s.names.length : 0; }
function hasStates() { return nStates() > 1; }
function stateName(i) { var s = S.graph.states; return s && s.names[i] !== undefined ? s.names[i] : 'State ' + (i + 1); }
function curState() { return hasStates() ? clamp(Math.round(S.V.state || 0), 0, nStates() - 1) : -1; }
/** Biggest link value in any state, so line widths mean the same thing in every state. */
function stateWidthMax() {
  var key = S.gver + '|' + (S.graph.edges.length); if (ST.wmax && ST.wmax.key === key) return ST.wmax.v;
  var mx = 0; S.graph.edges.forEach(function (e) { if (e.vals) e.vals.forEach(function (v) { if (v > mx) mx = v; }); });
  ST.wmax = { key: key, v: mx }; return mx;
}
function stateAbort() { ST.token++; ST.pending = null; ST.frames = null; ST.shown = null; if (ST.playing) pauseStates(true); }

/* ---------------------------------------------------------------- Data tab: making states */
HOOKS.graph.push(function () { ST.frames = null; ST.pos = curState() > 0 ? curState() : 0; renderStatesCard(); renderTimeline(); });
function applyStatesSpec(spec) {
  var g; try { g = NFMColumns.buildStates(S.graph, spec); } catch (e) { toast(e.message); return; }
  S.V.state = 0; saveView(); setGraph(g, true, true);
  toast('Done: ' + plural(g.states.names.length, 'state') + '. Open the Map to see the timeline.');
}
function renderStatesCard() {
  var card = $('states'); if (!card) return;
  if (!S.graph.nodes.length || !S.graph.edges.length) { card.hidden = true; return; }
  card.hidden = false;
  var kids = [h('h2', null, 'States (optional)')];
  if (hasStates()) {
    var names = S.graph.states.names;
    kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, 'This data holds ' + plural(names.length, 'state') + ' of the same network. The Map has a timeline you can play or drag, and the Export tab can make an animated GIF.'));
    kids.push(h('div', { class: 'chips' }, names.map(function (n, i) {
      var inp = h('input', { value: n, 'aria-label': 'Name of state ' + (i + 1), style: { width: '120px' } });
      inp.addEventListener('change', function () { var nn = names.slice(); nn[i] = inp.value.trim() || n; setGraph(Object.assign({}, S.graph, { states: { names: nn } }), true, true); });
      return inp;
    })));
    kids.push(h('div', { class: 'row' }, [h('button', { onclick: function () { setGraph(NFMColumns.clearStates(S.graph), true, true); } }, 'Remove the states'), h('button', { class: 'primary', onclick: function () { showTab('map'); } }, 'Show the timeline')]));
    mount(card, kids); return;
  }
  kids.push(h('p', { class: 'muted small', style: { margin: 0 } }, 'If your data holds the same network at several times (baseline, year 1, year 2, an end state), I can animate how the links change. Two layouts work: one number column per state, or one column that names the state on repeated links.'));
  var sug = { rows: [], cols: [] }; try { sug = NFMColumns.suggestStates(S.graph, S.prof) || sug; } catch (e) { /* none */ }
  sug.cols.forEach(function (c) {
    var nameInputs = c.names.map(function (n) { return h('input', { value: n, style: { width: '110px' }, 'aria-label': 'State name' }); });
    kids.push(h('div', { class: 'distbox' }, [h('h3', null, 'These columns look like states'), h('div', { class: 'chips' }, nameInputs),
      h('div', { class: 'row' }, [h('button', { class: 'primary', onclick: function () { applyStatesSpec({ mode: 'cols', keys: c.keys, names: nameInputs.map(function (i) { return i.value.trim(); }) }); } }, 'Use them as states'), h('span', { class: 'muted small' }, 'Each link gets one value per state. Empty means the link is absent then.')])]));
  });
  sug.rows.slice(0, 3).forEach(function (r) {
    kids.push(h('div', { class: 'distbox' }, [h('h3', null, 'The column "' + r.name + '" repeats the same links'), h('p', { class: 'muted small', style: { margin: 0 } }, 'Values: ' + r.values.slice(0, 8).join(', ') + (r.values.length > 8 ? '…' : '')),
      h('div', { class: 'row' }, [h('button', { class: 'primary', onclick: function () { applyStatesSpec({ mode: 'rows', key: r.key }); } }, 'Use its values as states')])]));
  });
  var numCols = colsOf('edges', ['number']).filter(function (c) { return c.key !== 'weight'; }), anyCols = (S.prof ? S.prof.edges : []).filter(function (c) { return !c.builtin && c.key !== 'label' && c.key !== 'kind'; });
  if (numCols.length >= 2 || anyCols.length) {
    var checks = numCols.map(function (c) { return h('label', { class: 'chip' }, [h('input', { type: 'checkbox', value: c.key }), c.name]); });
    var pick = select([['', 'Choose a column…']].concat(anyCols.map(function (c) { return [c.key, c.name]; })), '', function () { /* read on click */ });
    kids.push(acc('Choose by hand', [
      numCols.length >= 2 ? h('div', { class: 'distbox' }, [h('h3', null, 'One number column per state'), h('div', { class: 'chips' }, checks), h('div', { class: 'row' }, [h('button', { onclick: function () { var keys = checks.map(function (l) { return l.firstChild; }).filter(function (i) { return i.checked; }).map(function (i) { return i.value; }); if (keys.length < 2) { toast('Check at least two columns, in the order of the states.'); return; } applyStatesSpec({ mode: 'cols', keys: keys, names: keys.map(function (k) { return colName('edges', k); }) }); } }, 'Use the checked columns')])]) : null,
      anyCols.length ? h('div', { class: 'distbox' }, [h('h3', null, 'One column that names the state'), pick, h('div', { class: 'row' }, [h('button', { onclick: function () { if (!pick.value) { toast('Choose a column first.'); return; } applyStatesSpec({ mode: 'rows', key: pick.value }); } }, 'Split by this column')])]) : null], false));
  }
  mount(card, kids);
}

/* ---------------------------------------------------------------- frames (one engine build per state) and the blend between two of them */
function frameKey() { var o = engineOpts(); delete o.state; return JSON.stringify(o) + '|' + S.gver; }
function annotate(L) {
  if (!L || L.annotated) return L;
  var has = {}, pres = {};
  L.edges.forEach(function (e) { var p = e.absent ? 0 : 1; e.pres = p; has[e.from] = 1; has[e.to] = 1; if (p) { pres[e.from] = 1; pres[e.to] = 1; } });
  L.nodes.forEach(function (n) { n.pres = has[n.id] ? (pres[n.id] ? 1 : 0) : 1; });
  L.annotated = true; return L;
}
function sameShape(a, b) {
  if (!a || !b || a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  var i; for (i = 0; i < a.nodes.length; i++) if (a.nodes[i].id !== b.nodes[i].id) return false;
  for (i = 0; i < a.edges.length; i++) if (a.edges[i].from !== b.edges[i].from || a.edges[i].to !== b.edges[i].to) return false;
  return true;
}
function holdPositions(frames) {
  var base = frames[0]; if (!base || base.view !== 'network' || base.is3d) return;
  var at = {}; base.nodes.forEach(function (n) { at[n.nodeId !== undefined ? n.nodeId : n.id] = n; });
  frames.forEach(function (L, i) { if (!i) return; L.nodes.forEach(function (n) { var b = at[n.nodeId !== undefined ? n.nodeId : n.id]; if (b) { n.cx = b.cx; n.cy = b.cy; n.x = b.x; n.y = b.y; } }); });
}
function shareRanges(frames) {
  ['width', 'size', 'color', 'ecolor'].forEach(function (k) {
    var rs = frames.map(function (L) { return L.ch && L.ch[k]; }); if (rs.some(function (r) { return !r; })) return;
    var mx = Math.max.apply(null, rs.map(function (r) { return r.max; })), mn = Math.min.apply(null, rs.map(function (r) { return r.min; }));
    frames.forEach(function (L) { L.ch[k] = Object.assign({}, L.ch[k], { max: mx, min: mn }); });
  });
}
/** Builds every state (once per set of settings). Resolves to an array of layouts, one per state. */
function ensureFrames(onProgress) {
  if (!hasStates()) return Promise.reject(new Error('This data has no states.'));
  var key = frameKey(); if (ST.frames && ST.key === key) return Promise.resolve(ST.frames);
  if (ST.pending && ST.pendingKey === key) return ST.pending;
  var n = nStates(), out = [], token = ++ST.token; ST.pendingKey = key;
  var step = function (i) {
    if (i >= n) return Promise.resolve(out);
    var o = engineOpts(); o.state = i;
    return client.build(o).then(function (r) { if (token !== ST.token) throw new Error('superseded'); out.push(annotate(r.L)); if (onProgress) onProgress(i + 1, n); return step(i + 1); });
  };
  ST.pending = step(0).then(function (fr) {
    if (token !== ST.token) throw new Error('superseded');
    holdPositions(fr); shareRanges(fr); ST.frames = fr; ST.key = key; ST.pending = null; return fr;
  }, function (err) { if (token === ST.token) ST.pending = null; throw err; });
  return ST.pending;
}
var NODE_NUM = ['x', 'y', 'w', 'h', 'cx', 'cy', 'traffic', 'visits', 'pGood', 'pBad', 'pNeutral', 'pi', 'domP', 'sizeV', 'colorV', 'sizeK', 'k', 'inW', 'outW', 'pres'];
var EDGE_NUM = ['flow', 'weight', 'widthV', 'colorV', 'pres'];
function mixNum(a, b, u) { return a === a && b === b ? a + (b - a) * u : (u < 0.5 ? a : b); }
/** A layout part-way from state A to state B (u from 0 to 1). Shapes that differ switch halfway instead of morphing. */
function blend(A, B, u) {
  if (u <= 0.0005) return A; if (u >= 0.9995) return B;
  if (!sameShape(A, B)) return u < 0.5 ? A : B;
  var L = Object.assign({}, A), pos = {};
  L.nodes = A.nodes.map(function (a, i) {
    var b = B.nodes[i], n = Object.assign({}, a);
    NODE_NUM.forEach(function (k) { if (typeof a[k] === 'number' && typeof b[k] === 'number') n[k] = mixNum(a[k], b[k], u); });
    if (u >= 0.5) { n.dom = b.dom; n.colorC = b.colorC; }
    pos[n.id] = n; return n;
  });
  L.pos = pos;
  L.edges = A.edges.map(function (a, i) {
    var b = B.edges[i], e = Object.assign({}, a);
    EDGE_NUM.forEach(function (k) { if (typeof a[k] === 'number' && typeof b[k] === 'number') e[k] = mixNum(a[k], b[k], u); });
    if (a.pts && b.pts && a.pts.length === b.pts.length) e.pts = a.pts.map(function (p, j) { var q = b.pts[j]; return Array.isArray(p) ? [mixNum(p[0], q[0], u), mixNum(p[1], q[1], u)] : p; });
    if (u >= 0.5) { e.colorC = b.colorC; e.absent = b.absent; } return e;
  });
  L.ch = A.ch; L.annotated = true; L.width = mixNum(A.width, B.width, u); L.height = mixNum(A.height, B.height, u);
  return L;
}
function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
/** The layout at a position along the timeline: 0 is the first state, 1 the second, 1.5 half way to the third. */
function layoutAt(frames, pos, hold) {
  var N = frames.length, p = clamp(pos, 0, N - 1), i = Math.min(N - 2, Math.floor(p)), u = p - i;
  if (p >= N - 1) return frames[N - 1];
  var hf = hold === undefined ? 0.35 : hold, ue = u < hf ? 0 : ease((u - hf) / (1 - hf));
  return blend(frames[i], frames[i + 1], ue);
}

/* ---------------------------------------------------------------- the timeline and playing */
function ensureTimeline() {
  var el = $('timeline'); if (el) return el;
  var ui = $('ui'); if (!ui) return null;
  el = h('div', { id: 'timeline', class: 'glass', role: 'group', 'aria-label': 'States', hidden: true }, [
    h('button', { id: 'tl-play', class: 'primary icon', 'aria-label': 'Play the states', title: 'Play or pause', onclick: function () { if (ST.playing) pauseStates(); else playStates(); } }, '▶'),
    h('div', { class: 'tl-mid' }, [h('input', { type: 'range', id: 'tl-range', min: 0, max: 1, step: 0.001, value: 0, 'aria-label': 'Position along the states', oninput: function (ev) { scrubStates(parseFloat(ev.target.value)); }, onchange: function (ev) { settleStates(); } }), h('div', { id: 'tl-ticks', class: 'tl-ticks' })]),
    h('div', { id: 'tl-name', class: 'tl-name', 'aria-live': 'polite' }, ''),
    h('button', { class: 'icon tl-more', id: 'tl-more', title: 'More options', 'aria-label': 'More options', onclick: function () { var t = $('timeline'); t.classList.toggle('more'); $('tl-more').setAttribute('aria-pressed', String(t.classList.contains('more'))); } }, '⋯'),
    h('button', { id: 'tl-loop', class: 'icon', title: 'Play over and over', 'aria-label': 'Loop', 'aria-pressed': 'true', onclick: function () { S.V.anim.loop = !S.V.anim.loop; saveView(); renderTimeline(); } }, '⟳'),
    h('select', { id: 'tl-speed', 'aria-label': 'Seconds per state', onchange: function (ev) { S.V.anim.sec = parseFloat(ev.target.value); saveView(); } }, [[1, 'Fast'], [2.4, 'Normal'], [4, 'Slow']].map(function (o) { return h('option', { value: o[0] }, o[1]); }))
  ]);
  ui.appendChild(el); return el;
}
function renderTimeline() {
  var el = ensureTimeline(); if (!el) return;
  var on = hasStates() && S.tab === 'map' && !!S.L; el.hidden = !on; if (!on) return;
  var N = nStates(), rg = $('tl-range'), pos = ST.playing ? ST.pos : curState();
  rg.max = N - 1; rg.value = clamp(pos, 0, N - 1);
  var ticks = $('tl-ticks'); if (ticks.childNodes.length !== N || ticks.dataset.names !== S.graph.states.names.join('|')) {
    ticks.dataset.names = S.graph.states.names.join('|');
    mount(ticks, S.graph.states.names.map(function (nm, i) { return h('button', { class: 'tick', style: { left: (N > 1 ? i / (N - 1) * 100 : 0) + '%' }, title: nm, 'aria-label': 'Go to ' + nm, onclick: function () { gotoState(i); } }, nm); }));
  }
  Array.prototype.forEach.call(ticks.childNodes, function (b, i) { b.setAttribute('aria-current', String(Math.round(pos) === i)); });
  $('tl-name').textContent = stateName(clamp(Math.round(pos), 0, N - 1));
  $('tl-play').textContent = ST.playing ? '❚❚' : '▶'; $('tl-play').setAttribute('aria-label', ST.playing ? 'Pause' : 'Play the states');
  $('tl-loop').setAttribute('aria-pressed', String(!!S.V.anim.loop)); $('tl-speed').value = String(S.V.anim.sec);
}
function updateTimelinePos() {
  var rg = $('tl-range'); if (!rg) return; var N = nStates(); rg.value = clamp(ST.pos, 0, N - 1);
  var i = clamp(Math.round(ST.pos), 0, N - 1); if ($('tl-name').textContent !== stateName(i)) { $('tl-name').textContent = stateName(i); Array.prototype.forEach.call($('tl-ticks').childNodes, function (b, k) { b.setAttribute('aria-current', String(i === k)); }); }
}
/** Shows a layout in place of the map's own (used while moving along the timeline). */
function showLayout(L) {
  if (!L || !S.mapBuilt) return;
  var t0 = performance.now();
  S.L = L; S.buildKey = null; applyPins(L);
  S.scene = NFMScene.make(L, sceneOpts()); editKey(S.scene);
  S.keyMap = null; applyStyle(true);
  if (mgr && mgr.r) mgr.r.setScene(S.scene);
  requestDraw();
  ST.makeMs = performance.now() - t0; ST.lastMake = performance.now();
}
function withFrames(fn) {
  var msg = null;
  var p = ensureFrames(function (i, n) { showMsg('Preparing the states… ' + i + ' of ' + n); });
  if (ST.pending) showMsg('Preparing the states…');
  return p.then(function (fr) { hideMsg(); return fn(fr); }, function (err) { hideMsg(); if (err.message !== 'superseded') toast('The states could not be built: ' + err.message); });
}
function playStates() {
  if (!hasStates() || S.tab !== 'map') return;
  withFrames(function (fr) {
    if (ST.pos >= fr.length - 1 - 1e-6 || curState() === fr.length - 1 && !ST.playing && ST.pos >= fr.length - 1) ST.pos = 0;
    ST.playing = true; ST.last = performance.now(); renderTimeline(); ST.raf = requestAnimationFrame(stateTick);
  });
}
function pauseStates(quiet) {
  if (!ST.playing && !quiet) return;
  ST.playing = false; if (ST.raf) cancelAnimationFrame(ST.raf); ST.raf = 0;
  if (!quiet) settleStates(); else renderTimeline();
}
function stateTick(now) {
  ST.raf = 0; if (!ST.playing || !ST.frames) return;
  if (S.tab !== 'map') { pauseStates(true); return; }
  var N = ST.frames.length, V = S.V, dt = Math.min(0.25, (now - ST.last) / 1000); ST.last = now;
  var endHold = 0.6; ST.pos += dt / Math.max(0.3, V.anim.sec);
  if (ST.pos >= N - 1 + endHold) { if (V.anim.loop) ST.pos = 0; else { ST.pos = N - 1; ST.playing = false; showAt(N - 1); settleStates(); return; } }
  showAt(ST.pos);
  ST.raf = requestAnimationFrame(stateTick);
}
var lastShownKey = '';
function showAt(pos) {
  if (!ST.frames) return;
  var N = ST.frames.length, p = clamp(pos, 0, N - 1), i = Math.min(N - 2, Math.floor(p)), u = p - i, hf = 0.35, ue = p >= N - 1 ? 1 : (u < hf ? 0 : ease((u - hf) / (1 - hf)));
  var k = i + '|' + ue.toFixed(3);
  if (k !== lastShownKey && performance.now() - ST.lastMake >= Math.max(16, ST.makeMs * 1.25)) { lastShownKey = k; showLayout(layoutAt(ST.frames, pos)); }
  ST.pos = pos > N - 1 ? pos : p; updateTimelinePos();
}
function scrubStates(v) {
  pauseStates(true); ST.pos = v;
  withFrames(function () { showAt(ST.pos); renderTimeline(); });
}
/** Lands on the nearest whole state and remembers it as the state shown. */
function settleStates() {
  var N = nStates(), i = clamp(Math.round(ST.pos), 0, N - 1); ST.pos = i; lastShownKey = '';
  S.V.state = i; saveView();
  if (ST.frames) { showLayout(ST.frames[i]); renderMapUI(); } else refreshMap('state');
  renderTimeline();
}
function gotoState(i) {
  pauseStates(true); ST.pos = i; S.V.state = i; saveView(); lastShownKey = '';
  if (ST.frames && ST.key === frameKey()) { showLayout(ST.frames[i]); renderMapUI(); } else refreshMap('state');
  renderTimeline();
}

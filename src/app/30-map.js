/*!
 * Net Flow Map app, part 4: the Map (building, scene, drawing, camera). Copyright (c) 2026 LFC Foundry. MIT License.
 */
var client = null, mgr = null, host = $('host'), stage = $('stage');
var VIEWS = getEngine().VIEWS, ARR = getEngine().ARRANGE_NAMES;
var ENGINE_COLORS = ['group', 'found', 'choke', 'traffic', 'odds', 'heat', 'sim', 'none'];
S.tool = 'hand'; S.search = { q: '', hits: new Set(), list: [], cur: 0 }; S.route = null; S.styleMap = null; S.ctxHit = null;

/* ---------------------------------------------------------------- what to ask the engine */
function engineColor() {
  var c = S.V.colorBy;
  if (c === 'sim' && !S.simSnap) return 'group';
  if (!S.story && c === 'odds' && false) return 'group';
  return ENGINE_COLORS.indexOf(c) >= 0 || /^(col|sys):/.test(c) ? c : 'group';
}
function nodeCat(n, col) {
  var v = col === 'group' ? n.group : col === 'valence' ? n.valence : n.attrs && n.attrs[col];
  return v === undefined || v === null || v === '' ? '(none)' : String(v);
}
/** Quantile cut-off so only the strongest X% of links are drawn. */
function strongestCut() {
  var V = S.V, ch = V.widthBy === 'weight' || /^col:/.test(V.widthBy) ? V.widthBy : (NFMColumns.findCol(S.prof.edges, 'weight') && NFMColumns.findCol(S.prof.edges, 'weight').kind === 'number' ? 'weight' : '');
  if (!ch || V.strongest >= 100) return { ch: ch, min: null, total: S.graph.edges.length, shown: S.graph.edges.length };
  var key = ch + '|' + S.gver; if (!strongestCut.c || strongestCut.c.key !== key) {
    var vals = []; S.dg.edges.forEach(function (e) { var v = NFMColumns.numOf(e, ch); if (v === v) vals.push(v); }); vals.sort(function (a, b) { return a - b; }); strongestCut.c = { key: key, vals: vals };
  }
  var vals2 = strongestCut.c.vals, n = vals2.length; if (!n) return { ch: ch, min: null, total: S.graph.edges.length, shown: S.graph.edges.length };
  var idx = clamp(Math.floor(n * (1 - V.strongest / 100)), 0, n - 1), min = vals2[idx], shown = n - idx;
  while (idx > 0 && vals2[idx - 1] === min) { idx--; shown++; }
  return { ch: ch, min: min, total: n, shown: shown };
}
function aroundSet() {
  var A = S.V.around; if (!A || !S.byId.has(A.id)) return null;
  var seen = new Set([A.id]), frontier = [A.id];
  for (var d = 0; d < A.depth && frontier.length; d++) {
    var next = [];
    frontier.forEach(function (id) {
      (S.outAdj.get(id) || []).forEach(function (e) { if (!seen.has(e.to)) { seen.add(e.to); next.push(e.to); } });
      (S.inAdj.get(id) || []).forEach(function (e) { if (!seen.has(e.from)) { seen.add(e.from); next.push(e.from); } });
    });
    frontier = next;
  }
  return seen;
}
function keepList() {
  var V = S.V, ids = null, g = S.dg;
  var fk = Object.keys(V.facets).filter(function (k) { return k.indexOf('n:') === 0 && V.facets[k] && V.facets[k].length; });
  if (fk.length) { ids = new Set(); g.nodes.forEach(function (n) { if (fk.every(function (k) { return V.facets[k].indexOf(nodeCat(n, k.slice(2))) >= 0; })) ids.add(n.id); }); }
  if (V.only && V.only.length) { var on = new Set(V.only); if (ids) ids.forEach(function (id) { if (!on.has(id)) ids.delete(id); }); else ids = on; }
  var ar = aroundSet();
  if (ar) { if (ids) ar.forEach(function (id) { if (!ids.has(id)) ar.delete(id); }); ids = ar; }
  return ids ? Array.from(ids) : null;
}
function engineOpts() {
  var V = S.V, o = {
    view: V.view, arrange: V.arrange, dir: V.dir, fold: V.fold, merge: V.merge, laneBy: V.laneBy, colorBy: engineColor(), sizeBy: V.sizeBy, widthBy: V.widthBy, edgeColorBy: V.edgeColorBy, agg: V.agg,
    block: V.block.slice(), hideKinds: V.hideKinds.slice(), mode: S.A.mode, runs: S.A.runs, weights: S.A.weights, wantFlow: V.colorBy === 'odds' || V.colorBy === 'heat'
  };
  var cut = strongestCut(); if (cut.min !== null) o.minEdge = { ch: cut.ch, min: cut.min };
  var keep = keepList(); if (keep) o.keep = keep;
  var eks = Object.keys(V.facets).filter(function (k) { return k.indexOf('e:') === 0 && V.facets[k] && V.facets[k].length; });
  if (eks.length) {   /* the panel offers two link filters: both go to the engine (edgeFacets); edgeFacet stays the first for an engine that only knows one */
    o.edgeFacets = eks.map(function (k) { return { col: k.slice(2), values: V.facets[k].slice() }; });
    o.edgeFacet = o.edgeFacets[0];
  }
  if (S.simSnap) o.sim = S.simSnap;
  if (hasStates()) { o.state = curState(); if (V.widthBy === 'weight') o.widthMax = stateWidthMax(); }
  S.simUsed = S.simVer;
  if (S.A.amounts && V.view === 'river' && V.widthBy) o.amounts = true;
  if (V.view === 'river') o.sk = skSettings();
  return o;
}

/* ---------------------------------------------------------------- build and show */
var busyT, lastFitKey = '';
function showMsg(content, buttons) {
  var m = $('msg'); m.hidden = false; var d = m.firstElementChild; clear(d);
  d.appendChild(typeof content === 'string' ? h('b', null, content) : content);
  (buttons || []).forEach(function (b) { d.appendChild(h('button', { class: b[2] ? 'primary' : null, onclick: b[1] }, b[0])); });
}
function hideMsg() { $('msg').hidden = true; }
var buildQueued = 0;
/** Builds the map again from the data and settings. Off the Map tab it only notes that the picture is out of date (the Map builds it when shown), unless force is true (export asks for that). Returns a promise that settles when the build is over. */
function refreshMap(reason, force) {
  if (S.tab !== 'map' && !force) { S.sceneOk = false; S.mapStale = -1; return Promise.resolve(); }
  stateAbort();
  clearTimeout(busyT);
  $('stage').classList.toggle('empty', !S.graph.nodes.length);
  if (!S.graph.nodes.length) {
    S.L = null; S.scene = null; S.sceneOk = true; S.mapBusy = 0; if (mgr && mgr.r) mgr.r.setScene(null);
    showMsg(h('div', { style: { display: 'grid', gap: '6px' } }, [h('b', null, 'Nothing to draw yet.'), h('span', { class: 'muted small' }, 'Bring in a table, a JSON file, an outline or a folder of notes on the Data tab.')]), [['Go to Data', function () { showTab('data'); }, true]]);
    renderMapUI(); return Promise.resolve();
  }
  if (!client || client.mode === 'starting') { showMsg('Getting ready…'); return new Promise(function (res) { setTimeout(function () { res(refreshMap(reason, force)); }, 150); }); }
  var seq = ++S.mapSeq; S.sceneOk = false; S.mapBusy = seq;
  busyT = setTimeout(function () { if (seq === S.mapSeq) showMsg(h('div', { style: { display: 'grid', gap: '6px' } }, [h('b', null, 'Working out the map…'), h('span', { class: 'muted small' }, nfmt(S.graph.nodes.length) + ' items, ' + nfmt(S.graph.edges.length) + ' links')])); }, 350);
  var t0 = performance.now(), V = S.V;
  var p = client.build(engineOpts()).then(function (res) {
    if (seq !== S.mapSeq) return;
    clearTimeout(busyT); hideMsg();
    /* the chosen links are remembered by the original links they stand for, so they stay the same links when the view or arrangement draws them as other arrows */
    var origSel = null; if (S.selEdges.size && S.L) { origSel = new Set(); S.selEdges.forEach(function (i) { var oe = S.L.edges[i]; if (oe && oe.orig) for (var q = 0; q < oe.orig.length; q++) origSel.add(oe.orig[q]); }); }
    S.L = res.L; S.ms = res.ms; S.totalMs = performance.now() - t0;
    if (S.selEdges.size) S.selEdges = origSel && origSel.size ? edgesFromOrig(origSel) : new Set();
    var hadCard = !!S.cardUsed; S.cardUsed = res.card || null; if (hadCard !== !!S.cardUsed || (client && client.cardWhy)) renderMapUI();
    if (S.L.is3d === false) S.L.is3d = false;
    var fk = [V.view, V.arrange, S.gver, V.dir, V.laneBy, V.block.length, V.hideKinds.length, V.strongest, JSON.stringify(V.facets), JSON.stringify(V.around)].join('|');
    var fit = fk !== lastFitKey && reason !== 'look';
    if (S.tab !== 'map') { if (fit) S.needFit = true; fit = false; }   /* built for export while another tab is open: the stage has no size now, so it fits when the Map is shown */
    else if (S.needFit) { S.needFit = false; fit = true; }
    makeScene(fit); lastFitKey = fk;
    S.sceneOk = true; if (S.mapBusy === seq) S.mapBusy = 0;
  }).catch(function (err) {
    if (err && err.message === 'superseded') return;
    if (seq !== S.mapSeq) return;
    if (S.mapBusy === seq) S.mapBusy = 0;
    clearTimeout(busyT);
    var big = /too big/.test(err.message);
    showMsg(h('div', { style: { display: 'grid', gap: '6px' } }, [h('b', null, big ? 'This map is too big for that view.' : 'The map could not be drawn.'), h('span', { class: 'muted small' }, err.message)]), big ? [['Use the Network view', function () { setV({ view: 'network' }); }, true]] : []);
  });
  S.mapDone = p; return p;
}
/** Resolves with the scene once it matches the data and settings (building it first when needed, also off the Map tab); null when there is nothing to draw. Exports use this so they never save an older picture. */
function ensureMap() {
  if (S.sceneOk && S.scene) return Promise.resolve(S.scene);
  if (!S.graph.nodes.length) return Promise.resolve(null);
  var done = function (left) { return S.sceneOk && S.scene ? S.scene : (left > 0 && S.mapDone ? S.mapDone.then(function () { return done(left - 1); }) : null); };
  return (S.mapBusy && S.mapDone ? S.mapDone : refreshMap('export', true)).then(function () { return done(3); });
}

/* ---------------------------------------------------------------- looks: rules, labels, colors */
/* A blank or non-number never matches a number comparison ("less than 5" must not catch items with no value). */
var numCmp = function (a, b, f) {
  if (a === '' || a === null || a === undefined || b === '' || b === null || b === undefined || (typeof a === 'string' && !a.trim()) || (typeof b === 'string' && !b.trim())) return false;
  var x = Number(a), y = Number(b); return x === x && y === y && f(x, y);
};
var FILL_OPS = { '=': function (a, b) { return String(a) === String(b); }, '!=': function (a, b) { return String(a) !== String(b); }, 'contains': function (a, b) { return String(a).toLowerCase().indexOf(String(b).toLowerCase()) >= 0; },
  '>': function (a, b) { return numCmp(a, b, function (x, y) { return x > y; }); }, '<': function (a, b) { return numCmp(a, b, function (x, y) { return x < y; }); }, '>=': function (a, b) { return numCmp(a, b, function (x, y) { return x >= y; }); }, '<=': function (a, b) { return numCmp(a, b, function (x, y) { return x <= y; }); } };
function ruleValue(obj, col) { var v = col === 'group' ? obj.group : col === 'label' ? obj.label : col === 'valence' ? obj.valence : col === 'kind' ? obj.kind : col === 'weight' ? obj.weight : obj.attrs && obj.attrs[col]; return v === undefined || v === null ? '' : v; }
/** Works out, for every item and link, what the style rules say. Returns { nodes: Map id->style, edges: Map index->style }. */
function computeStyles() {
  var V = S.V, rules = V.rules.filter(function (r) { return r.on !== false; }), key = JSON.stringify(rules) + '|' + S.gver + '|' + JSON.stringify(V.sets || {});
  if (S.styleMap && S.styleMap.key === key) return S.styleMap;
  var out = { key: key, nodes: new Map(), edges: new Map(), any: !!rules.length };
  if (!rules.length) { S.styleMap = out; return out; }
  /* formula rules: let the column engine work them out as hidden calculated columns */
  var fcalc = [];
  rules.forEach(function (r, i) { if (r.when && r.when.type === 'formula' && r.when.formula) fcalc.push({ scope: r.target === 'links' ? 'edges' : 'nodes', name: '__rule' + i, formula: r.when.formula }); });
  var g = S.dg;
  if (fcalc.length) { try { g = NFMColumns.derive({ name: S.graph.name + '·rules', start: S.graph.start, flavor: S.graph.flavor, calc: (S.graph.calc || []).concat(fcalc), nodes: S.graph.nodes, edges: S.graph.edges }); } catch (e) { g = S.dg; } }
  var sets = V.sets || {};
  rules.forEach(function (r, i) {
    var w = r.when || { type: 'all' }, links = r.target === 'links', list = links ? g.edges : g.nodes, st = r.set || {};
    var test = function (o) {
      if (w.type === 'all') return true;
      if (w.type === 'group') return links ? false : String(o.group || '(none)') === String(w.value);
      if (w.type === 'kind') return String(o.kind || '(none)') === String(w.value);
      if (w.type === 'column') { var f = FILL_OPS[w.op || '=']; return f ? f(ruleValue(o, w.col), w.value) : false; }
      if (w.type === 'set') return !links && (sets[w.name] || []).indexOf(o.id) >= 0;
      if (w.type === 'formula') { var v = o.attrs && o.attrs['__rule' + i]; return v !== '' && v !== undefined && Number(v) !== 0; }
      if (w.type === 'ends') return !links && !(S.outAdj.get(o.id) || []).length;
      if (w.type === 'between') { if (!links) return false; var a = S.byId.get(o.from), b = S.byId.get(o.to); return !!a && !!b && String(a.group || '(none)') !== String(b.group || '(none)'); }
      return false;
    };
    for (var k = 0; k < list.length; k++) {
      var o = list[k]; if (!test(o)) continue;
      var map = links ? out.edges : out.nodes, id = links ? k : o.id;
      map.set(id, Object.assign(map.get(id) || {}, st));
    }
  });
  S.styleMap = out;
  return out;
}
/** Every group of the data, sorted: the scene hands out colors by place in this list, so hiding a group does not recolor the others. Kept per data version (a 100,000-item map must not scan every item for each picture). */
function allGroupOrder(dg) { if (!S.groupOrderKey || S.groupOrderKey.dg !== dg || S.groupOrderKey.n !== dg.nodes.length || S.groupOrderKey.v !== S.gver) S.groupOrderKey = { dg: dg, n: dg.nodes.length, v: S.gver, list: Array.from(new Set(dg.nodes.map(function (n) { return n.group || ''; }))).sort() }; return S.groupOrderKey.list; }
function sceneOpts() {
  var V = S.V, sm = computeStyles(), dg = S.dg, byDg = new Map(); dg.nodes.forEach(function (n) { byDg.set(n.id, n); });
  var o = {
    theme: themeName(), colorBy: engineColor(), palette: V.palette, ramp: V.ramp, groupColors: V.groupColors, groupOrder: allGroupOrder(dg), story: S.story, lab: V.lab, widthScale: V.widthScale, widthMul: V.widthMul, hulls: V.hulls,
    cam: V.cam, curve: V.curve, edgeValueLabels: V.valueLabels, lens: V.lens.on ? { x: S.lens ? S.lens.x : 0, y: S.lens ? S.lens.y : 0, r: S.lens ? S.lens.r : 0, d: V.lens.d } : null,
    chName: function (c) { return chLabel(c, /^sys:(count|flow)$/.test(c) || c === 'weight' ? 'edges' : 'nodes'); }
  };
  if (sm.any) {
    o.nodeStyle = function (n) { return sm.nodes.get(n.nodeId || n.id) || null; };
    o.linkStyle = function (e, ei) { var best = null; if (e.orig) for (var i = 0; i < e.orig.length && !best; i++) best = sm.edges.get(e.orig[i]) || null; return best; };
  }
  if (hasStates()) {
    annotate(S.L);
    var baseL = o.linkStyle, baseN = o.nodeStyle, ghost = V.anim.ghost;
    o.linkStyle = function (e, ei) {
      var b = baseL ? baseL(e, ei) : null, p = e.pres !== undefined ? e.pres : (e.absent ? 0 : 1);
      if (p >= 0.999) return b;
      var st = Object.assign({}, b || {}); st.opacity = (ghost === 'hide' ? 0 : 0.1) + 0.5 * p; st.wmul = (st.wmul || 1) * (0.4 + 0.6 * p); if (ghost === 'hide' && p < 0.03) st.hide = true; return st;
    };
    o.nodeStyle = function (n) {
      var b = baseN ? baseN(n) : null, p = n.pres !== undefined ? n.pres : 1; if (p >= 0.999) return b;
      return Object.assign({}, b || {}, { opacity: 0.28 + 0.72 * p });
    };
  }
  if (V.view === 'river') skStyleWrap(o);
  if (V.labelCol) o.labelFn = function (n) { var d = byDg.get(n.nodeId); var v = d && d.attrs ? d.attrs[V.labelCol] : ''; return v === '' || v === undefined || v === null ? n.label : (n.label + ' · ' + v); };
  if (V.linkLabels) o.linkLabelFn = function (e) {
    if (V.linkLabels === 'none') return '';
    var t = NFMColumns.split(V.linkLabels); if (!t || t.t !== 'col' || !e.orig) return e.label;
    var x = dg.edges[e.orig[0]], v = x && x.attrs ? x.attrs[t.key] : ''; return v === undefined || v === null ? '' : (typeof v === 'number' ? NFMColumns.fmt(v) : String(v));
  };
  if (V.linkLabels === 'none') { o.lab = Object.assign({}, V.lab, { links: Object.assign({}, V.lab.links, { show: false }) }); }
  return o;
}
function pinKey() { return S.V.view + '|' + S.V.arrange; }
function applyPins(L) {
  var pins = S.V.pins[pinKey()]; if (!pins || L.view !== 'network' || L.is3d) return;
  L.nodes.forEach(function (n) { var id = n.nodeId || n.id, p = own(pins, id) ? pins[id] : null; if (p && typeof p[0] === 'number' && typeof p[1] === 'number') { n.cx = p[0]; n.cy = p[1]; } });
}
/** Applies key edits (renamed or hidden entries, recolored groups) to a fresh key list. */
function editKey(sc) {
  var ed = S.V.key.edits || {}; if (!sc.legend) return;
  if (ed.__title) sc.legendTitle = ed.__title;
  sc.legend = sc.legend.filter(function (l) {
    var k = l.key || l.t, e = ed[k]; if (e && e.hide) return false;
    if (e && e.t) l.t = e.t; return true;
  });
}
function makeScene(fit) {
  if (!S.L) return;
  applyPins(S.L);
  var t0 = performance.now();
  S.camPlan = null;
  var so0 = sceneOpts();
  if (S.L.is3d && mgr && mgr.r && mgr.r.rigPrepare) { mgr.r.rigPrepare(); S.camPlan = {}; so0.plan = S.camPlan; so0.rig = true; }   /* a big 3D map is ready to turn on the card from the first drag */
  S.scene = NFMScene.make(S.L, so0);
  editKey(S.scene);
  S.sceneMs = performance.now() - t0;
  applyStyle(true);
  if (mgr && mgr.r) mgr.r.setScene(S.scene);
  if (fit) fitView(true); else requestDraw();
  renderMapUI();
  warmCardSoon(); spinLoop();
  if (fit) { host.classList.remove('fade'); void host.offsetWidth; host.classList.add('fade'); }
}
var sceneQueued = false, sceneCamOnly = true;
/** Redraws on the next frame. camOnly: only the camera of a 3D map changed, so what each item looks like is reused from the last picture. */
function scheduleScene(camOnly) {
  sceneCamOnly = sceneCamOnly && camOnly === true; if (sceneQueued) return; sceneQueued = true;
  requestAnimationFrame(function () {
    sceneQueued = false; if (!S.L) return;
    var r = mgr && mgr.r, sc = S.scene;
    /* a big 3D map that is only being turned: the graphics card already holds the items and links, so just give it the new angle (see turnTo in scene.js) */
    if (sceneCamOnly && S.L.is3d && sc && sc.turnTo && r && r.rigOK && !sc.noTurn) { sc.turnTo(S.V.cam, S.view.k * 2); requestDraw(); armSettle(); return; }
    applyPins(S.L); var so = sceneOpts();
    if (sceneCamOnly && S.L.is3d) { so.plan = S.camPlan || (S.camPlan = {}); if (r && r.rigPrepare) { r.rigPrepare(); so.rig = true; } } else S.camPlan = null;
    sceneCamOnly = true; S.scene = NFMScene.make(S.L, so); editKey(S.scene); applyStyle(true); if (r) r.setScene(S.scene); requestDraw();
  });
}
/** While a big 3D map turns, the picture lives on the card and the lists in the scene are out of date. A moment after the turning stops (or when something needs them: saving, printing) they are made again. */
var settleTimer = 0;
/* A big 3D map stays on the card after turning, zooming or panning stops: the card's picture is the ordinary picture, so there is nothing to put back, and rebuilding the whole scene (a fifth of a second at 25,000 items, over a second at 100,000, then a fresh upload to the card) froze the next drag. Anything that needs the full scene (saving, printing, any change to the map) asks for it itself. */
function armSettle() { clearTimeout(settleTimer); }
/** The scene with its item records brought up to date (they are only worked out when something reads them while a big map is being turned). */
function liveScene() { var sc = S.scene; if (sc && sc.recStale) sc.syncRecs(); return sc; }
function settleTurn() {
  clearTimeout(settleTimer);
  var sc = S.scene; if (!S.L || !sc || !sc.turn || !sc.turn.on) return;
  applyPins(S.L); var so = sceneOpts(); so.plan = S.camPlan || (S.camPlan = {}); so.rig = true;
  S.scene = NFMScene.make(S.L, so); editKey(S.scene); applyStyle(true); if (mgr && mgr.r) mgr.r.setScene(S.scene); requestDraw();
}

/* ---------------------------------------------------------------- selection, dimming, search, route lighting */
function sceneNodeFor(id) { if (!S.scene || id == null) return null; if (S.scene.recStale) S.scene.syncRecs(); if (!S.keyMap || S.keyMap.sc !== S.scene) { var m = new Map(); S.scene.nodes.forEach(function (n) { if (n.nodeId !== undefined && !m.has(n.nodeId)) m.set(n.nodeId, n); }); S.keyMap = { sc: S.scene, m: m }; } return S.keyMap.m.get(id) || null; }
function keysOf(ids) { var s = new Set(); ids.forEach(function (id) { var n = sceneNodeFor(id); if (n) s.add(n.key); }); return s; }
function neighborIds(ids) {
  var s = new Set(ids);
  ids.forEach(function (id) { (S.outAdj.get(id) || []).forEach(function (e) { s.add(e.to); }); (S.inAdj.get(id) || []).forEach(function (e) { s.add(e.from); }); });
  return s;
}
function edgesFromOrig(set) { /* original link numbers -> drawn arrow numbers */
  var out = new Set(); if (!S.L) return out;
  S.L.edges.forEach(function (e, i) { if (e.orig) for (var k = 0; k < e.orig.length; k++) if (set.has(e.orig[k])) { out.add(i); break; } });
  return out;
}
function applyStyle(noDraw) {
  var sc = S.scene; if (!sc) return;
  attachSimOverlay();
  var mk = new Map(), ids = Array.from(S.sel); Object.keys(S.V.marks || {}).forEach(function (id) { var n = sceneNodeFor(id); if (n) mk.set(n.key, S.V.marks[id]); });
  var st = { marks: mk.size ? mk : null };
  if (S.search.q && S.search.hits.size) { st.focus = keysOf(neighborIds(S.search.hits)); st.sel = keysOf(S.search.hits); }
  else if (S.route) { st.focus = keysOf(S.route.nodes); st.edges = edgesFromOrig(S.route.edges); st.sel = keysOf(S.route.ends || []); }
  else if (ids.length) { st.focus = keysOf(neighborIds(ids)); st.sel = keysOf(ids); if (S.selEdges.size) st.selEdges = S.selEdges; }
  else if (S.selEdges.size) { st.selEdges = S.selEdges; var ep = new Set(); S.selEdges.forEach(function (i) { var e = S.L.edges[i]; if (e) { ep.add(e.from); ep.add(e.to); } }); st.focus = keysOf(ep); }
  if (S.V.hover) { /* reserved */ }
  NFMScene.style(sc, st);
  if (mgr && mgr.r && mgr.r.restyle) mgr.r.restyle();
  if (!noDraw) requestDraw();
}
function setSel(ids, opts) {
  opts = opts || {};
  S.sel = new Set(ids); S.selEdges = new Set(opts.edges || []); S.ring = null;
  applyStyle(); renderDetails(); renderSelbar();
  if (opts.center && ids.length) centerOn(ids);
  if (ids.length) { var n = ids.length === 1 ? S.byId.get(ids[0]) : null; say(n ? 'Selected ' + n.label + '. ' + plural((S.outAdj.get(ids[0]) || []).length, 'way') + ' on, ' + plural((S.inAdj.get(ids[0]) || []).length, 'way') + ' in.' : plural(ids.length, 'item') + ' selected.'); }
}
function runSearch(q) {
  q = (q || '').trim().toLowerCase(); S.search.q = q; S.search.cur = 0;
  if (!q) { S.search.hits = new Set(); S.search.list = []; applyStyle(); return; }
  var toks = q.split(/\s+/), sc = [];
  S.dg.nodes.forEach(function (n) {
    var lab = String(n.label || '').toLowerCase(), id = String(n.id).toLowerCase(), grp = String(n.group || '').toLowerCase(), at = n.attrs ? Object.keys(n.attrs).map(function (k) { return String(n.attrs[k]).toLowerCase(); }).join(' ') : '';
    var score = 0;
    if (toks.every(function (t) { return lab.indexOf(t) >= 0 || id.indexOf(t) >= 0; })) score = lab === q || id === q ? 100 : lab.indexOf(q) === 0 ? 80 : (' ' + lab).indexOf(' ' + q) >= 0 ? 60 : 40;
    else if (toks.every(function (t) { return lab.indexOf(t) >= 0 || id.indexOf(t) >= 0 || grp.indexOf(t) >= 0 || at.indexOf(t) >= 0; })) score = 20;
    if (score) sc.push([score, n]);
  });
  sc.sort(function (a, b) { return b[0] - a[0] || (a[1].label < b[1].label ? -1 : 1); });
  S.search.list = sc.map(function (x) { return x[1].id; }); S.search.hits = new Set(S.search.list);
  applyStyle();
}

/* ---------------------------------------------------------------- the drawing backend */
function stageSize() {
  var r = stage.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), hh = Math.max(1, Math.round(r.height)), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  while (w * hh * dpr * dpr > 9e6 && dpr > 1) dpr -= 0.25;
  return { w: w, h: hh, dpr: dpr };
}
function applySize() {
  var z = stageSize(); S.stageW = z.w; S.stageH = z.h; S.dpr = z.dpr;
  if (mgr && mgr.r) mgr.r.resize(z.w, z.h, z.dpr);
  requestDraw();
}
var drawQueued = false, lastDrawView = { k: 0, tx: 0, ty: 0 };
function requestDraw() {
  if (drawQueued) return; drawQueued = true;
  requestAnimationFrame(function () {
    drawQueued = false;
    var tsc = S.scene, mv = S.view.k !== lastDrawView.k || S.view.tx !== lastDrawView.tx || S.view.ty !== lastDrawView.ty;
    lastDrawView = { k: S.view.k, tx: S.view.tx, ty: S.view.ty };
    /* zooming or panning a big 3D map rides the card just like turning it: the ordinary picture costs tens of milliseconds at 30,000 items, the card's about ten at 100,000 */
    if (mv && tsc && tsc.turnTo && S.L && S.L.is3d && !tsc.noTurn && mgr && mgr.r && mgr.r.rigOK) {
      if (!(tsc.turn && tsc.turn.on)) tsc.turnTo(S.V.cam, S.view.k * 2);
      armSettle();
    }
    if (tsc && tsc.turn && tsc.turn.on && S.view.k > tsc.turn.kmax) tsc.turnTo(tsc.turn.cam, S.view.k * 2);   /* zoomed in: more names can be seen */
    if (mgr && mgr.r && S.scene) { try { mgr.r.draw({ k: S.view.k, tx: S.view.tx, ty: S.view.ty, invalidate: requestDraw }); } catch (err) { mgr.log.push('draw: ' + err.message); } }
    drawInk();
  });
}
function attach(r) { r.resize(S.stageW, S.stageH, S.dpr); if (S.scene) { r.setScene(S.scene); if (S.L && S.L.is3d && r.rigPrepare) r.rigPrepare(); } requestDraw(); renderMapUI(); warmCardSoon(); }
/** A big 3D map is put on the graphics card a moment after it appears, while nobody is dragging yet, so the first turn does not pay for the upload and the driver's first-use work. */
var warmTimer = 0;
function warmCardSoon() {
  clearTimeout(warmTimer); var sc0 = S.scene;
  if (!sc0 || !S.L || !S.L.is3d || !sc0.rig) return;
  warmTimer = setTimeout(function () {
    var r = mgr && mgr.r; if (S.scene !== sc0 || !r || !r.rigWarm) return;
    if (!r.rigOK) { warmTimer = setTimeout(function () { if (S.scene === sc0 && mgr && mgr.r === r && r.rigOK && sc0.rig) r.rigWarm(); }, 200); return; }   /* WebGPU confirms its turning setup a moment late */
    r.rigWarm();
  }, 150);
}
var mgrStarting = false;
function startRenderer() {
  if (mgr || mgrStarting) return;
  mgrStarting = true;
  mgr = new NFMRender.Manager(host, { onChange: attach, onRebuilt: function (r) { toast('The graphics were reset; the map is back.'); attach(r); }, onStepDown: function () { toast('Graphics kept failing, so I switched to a safer way of drawing.'); } });
  mgr.choice = S.method && S.method !== 'webgpu' ? S.method : 'auto';   /* a saved WebGPU choice from an older version means Automatic now */
  var ready = S.canary ? Promise.resolve(S.canary) : NFMProbe.canary();
  ready.then(function (c) {
    S.canary = c;
    mgr.canary = { canvas2d: { ok: true }, webgl2: { ok: c.webgl2.ok && !c.webgl2.software }, webgpu: { ok: c.webgpu.ok && !c.webgpu.software } };
    if (mgr.choice !== 'auto' && c[mgr.choice] && c[mgr.choice].ok) mgr.canary[mgr.choice].ok = true;
    return mgr.start();
  }).catch(function (err) { showMsg(h('div', null, [h('b', null, 'Nothing could draw the map. '), err.message])); });
}
TAB_HOOKS.map = function () {
  if (!S.mapBuilt) { buildMapUI(); S.mapBuilt = true; }
  startRenderer(); applySize();
  if (S.sel.size) { var a = Array.from(S.sel); S.sel = new Set(a); }
  if (!S.scene || !S.sceneOk || S.mapStale !== S.gver || (S.simUsed !== S.simVer && simUsesMap())) { S.mapStale = S.gver; refreshMap('shown'); } else { if (S.needFit) { S.needFit = false; fitView(true); } requestDraw(); renderMapUI(); }
  attachSimOverlay(); renderTimeline(); spinLoop();
};
new ResizeObserver(function () { if (S.tab === 'map') { var was = S.stageW; applySize(); if (S.scene && (was <= 2 || Math.abs(S.stageW - was) / was > 0.2)) fitView(true); } }).observe(stage);

/* ---------------------------------------------------------------- camera: eased zoom, eased fit and center, fling */
var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var CAM = { raf: 0, anim: null, wheel: null, fling: null };
function stopCam() { if (CAM.raf) cancelAnimationFrame(CAM.raf); CAM.raf = 0; CAM.anim = CAM.wheel = CAM.fling = null; }
function camLoop() {
  CAM.raf = 0; var now = performance.now(), moving = false, v = S.view;
  if (CAM.anim) {
    var a = CAM.anim, u = Math.min(1, (now - a.t0) / a.ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    var k = a.k0 * Math.pow(a.k1 / a.k0, e), cx = a.cx0 + (a.cx1 - a.cx0) * e, cy = a.cy0 + (a.cy1 - a.cy0) * e;
    v = { k: k, tx: a.bx - cx * k, ty: a.by - cy * k }; if (u >= 1) CAM.anim = null; else moving = true;
  } else if (CAM.wheel) {
    var w = CAM.wheel, d = Math.log(w.kT / v.k);
    if (Math.abs(d) < 0.002) { v = { k: w.kT, tx: w.ax - w.wx * w.kT, ty: w.ay - w.wy * w.kT }; CAM.wheel = null; }
    else { var k2 = v.k * Math.exp(d * 0.28); v = { k: k2, tx: w.ax - w.wx * k2, ty: w.ay - w.wy * k2 }; moving = true; }
  } else if (CAM.fling) {
    var f = CAM.fling; v = { k: v.k, tx: v.tx + f.vx, ty: v.ty + f.vy }; f.vx *= 0.93; f.vy *= 0.93;
    if (Math.abs(f.vx) + Math.abs(f.vy) < 0.15) CAM.fling = null; else moving = true;
  }
  S.view = v; requestDraw(); renderKeyPos();
  if (moving) CAM.raf = requestAnimationFrame(camLoop);
}
function kick() { if (!CAM.raf) CAM.raf = requestAnimationFrame(camLoop); }
function clampZoom(k) { var lo = (S.fitK || 0.1) * 0.2, hi = Math.max(10, (S.fitK || 1) * 40); return clamp(k, lo, hi); }
function worldOf(x, y) { return [(x - S.view.tx) / S.view.k, (y - S.view.ty) / S.view.k]; }
/** Zoom around a screen point, easing toward the new level. */
function zoomAt(cx, cy, factor, instant) {
  if (reduceMotion || instant) { stopCam(); var k0 = S.view.k, k1 = clampZoom(k0 * factor), f = k1 / k0; S.view = { k: k1, tx: cx - (cx - S.view.tx) * f, ty: cy - (cy - S.view.ty) * f }; requestDraw(); renderKeyPos(); return; }
  var base = CAM.wheel ? CAM.wheel.kT : S.view.k, kT = clampZoom(base * factor), wp = worldOf(cx, cy);
  CAM.anim = null; CAM.fling = null; CAM.wheel = { kT: kT, ax: cx, ay: cy, wx: wp[0], wy: wp[1] }; kick();
}
function viewTo(v, ms) {
  if (reduceMotion || ms === 0) { stopCam(); S.view = v; requestDraw(); renderKeyPos(); return; }
  var W = S.stageW, H = S.stageH, c0 = [(W / 2 - S.view.tx) / S.view.k, (H / 2 - S.view.ty) / S.view.k], c1 = [(W / 2 - v.tx) / v.k, (H / 2 - v.ty) / v.k];
  CAM.wheel = CAM.fling = null; CAM.anim = { t0: performance.now(), ms: ms || 480, k0: S.view.k, k1: v.k, cx0: c0[0], cy0: c0[1], cx1: c1[0], cy1: c1[1], bx: W / 2, by: H / 2 }; kick();
}
/** The part of the stage not covered by the left rail and top bar (so "fit" does not hide things behind panels). */
function freeBox() {
  var W = S.stageW, H = S.stageH, phone = W < 761, left = 0, top = phone ? 58 : 64, bottom = 0, right = 0, rail = $('rail');
  if (rail && !rail.classList.contains('closed')) { if (phone) bottom = H * 0.58; else left = 322; }
  var d = $('details'); if (d && !d.hidden && !phone) right = 320;
  return { x: left + 8, y: top, w: Math.max(80, W - left - right - 16), h: Math.max(80, H - top - bottom - 8) };
}
function fitTarget(ids) {
  var sc = S.scene; if (!sc) return null;
  var b = freeBox(), x0 = sc.x0, y0 = sc.y0, x1 = sc.x0 + sc.w, y1 = sc.y0 + sc.h;
  if (ids && ids.length) {
    x0 = y0 = Infinity; x1 = y1 = -Infinity;
    ids.forEach(function (id) { var n = sceneNodeFor(id); if (n) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h); } });
    if (!isFinite(x0)) return null;
    var pad = Math.max(60, (x1 - x0) * 0.25, (y1 - y0) * 0.25); x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  }
  var k = Math.min(b.w / Math.max(1, x1 - x0), b.h / Math.max(1, y1 - y0)) * 0.97;
  if (ids && ids.length) k = Math.min(k, Math.max(S.fitK * 6, 2));
  return { k: k, tx: b.x + (b.w - (x1 - x0) * k) / 2 - x0 * k, ty: b.y + (b.h - (y1 - y0) * k) / 2 - y0 * k };
}
function fitView(instant) {
  if (!S.scene) return;
  var z = stageSize(); S.stageW = z.w; S.stageH = z.h;
  var v = fitTarget(); if (!v) return; S.fitK = v.k;
  if (instant === true) { stopCam(); S.view = v; requestDraw(); renderKeyPos(); } else viewTo(v, 520);
}
function centerOn(ids) {
  var v = fitTarget(ids); if (!v) return;
  var b = freeBox(), n = sceneNodeFor(ids[0]);
  if (ids.length === 1 && n) { var k = S.view.k, cx = (n.x + n.w / 2) * k + S.view.tx, cy = (n.y + n.h / 2) * k + S.view.ty; if (cx > b.x + 40 && cx < b.x + b.w - 40 && cy > b.y + 40 && cy < b.y + b.h - 40) return; v = { k: k, tx: b.x + b.w / 2 - (n.x + n.w / 2) * k, ty: b.y + b.h / 2 - (n.y + n.h / 2) * k }; }
  viewTo(v, 420);
}
document.addEventListener('visibilitychange', function () { if (!document.hidden) { requestDraw(); spinLoop(); } });

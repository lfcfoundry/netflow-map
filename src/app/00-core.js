/*!
 * Netflow Map app, part 1: helpers, state, the one place that changes the data, tabs and theme.
 * Copyright (c) 2026 LFC Foundry. MIT License.
 * The parts in src/app/ are joined into one function by tools/build.mjs, so they share these names.
 */
var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
/* DEBOUNCING counts the short (200 ms or less) screen-update delays still waiting, so a test can wait for the real finish instead of a guessed pause. The slow saves (300 ms and up) are not counted. */
var DEBOUNCING = 0;
var debounce = function (fn, ms) { var t, p = false, c = ms <= 200; var done = function () { if (p) { p = false; if (c) DEBOUNCING--; } }; var f = function () { var a = arguments, self = this; clearTimeout(t); if (!p) { p = true; if (c) DEBOUNCING++; } t = setTimeout(function () { done(); fn.apply(self, a); }, ms); }; f.now = function () { clearTimeout(t); done(); fn(); }; f.flush = function () { if (p) { clearTimeout(t); done(); fn(); } }; return f; };
/* TWIN: another open copy is in charge of the saved map, so this copy keeps nothing in the browser (see 63-twin.js) */
var TWIN = false;
var LS = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { if (TWIN) return true; try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del: function (k) { if (TWIN) return; try { localStorage.removeItem(k); } catch (e) { /* none */ } }
};
var nfmt = function (n) { return Number(n).toLocaleString('en-US'); };
var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
var plural = function (n, one, many) { return nfmt(n) + ' ' + (n === 1 ? one : (many || one + 's')); };
/** Builds an element: h('div', { class: 'x', onclick: fn, 'data-a': 1 }, [children or strings]). Text is always set as text, never as markup. */
function h(tag, attrs, kids) {
  var el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function (k) {
    var v = attrs[k];
    if (v === undefined || v === null || v === false) return;
    if (k === 'class') el.className = v;
    else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden' || k === 'open') { if (v) el[k] = true; }
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  });
  (kids === undefined ? [] : Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
    if (c === null || c === undefined || c === false) return;
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  });
  return el;
}
function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
function mount(el, kids) { clear(el); (Array.isArray(kids) ? kids : [kids]).forEach(function (k) { if (k) el.appendChild(k); }); return el; }
function opt(value, text, sel) { return h('option', { value: value, selected: sel }, text); }
function select(options, value, onchange, attrs) {
  var el = h('select', attrs || {}, options.map(function (o) { return opt(o[0], o[1], String(o[0]) === String(value)); }));
  el.value = value; if (onchange) el.addEventListener('change', function () { onchange(el.value); });
  return el;
}
function field(label, control, hint) { return h('label', { class: 'field' }, [h('span', null, label), control, hint ? h('span', { class: 'muted small' }, hint) : null]); }
function check(label, on, onchange, attrs) {
  var c = h('input', Object.assign({ type: 'checkbox', checked: !!on }, attrs || {})); c.addEventListener('change', function () { onchange(c.checked); });
  return h('label', null, [c, label]);
}
function seg(options, value, onpick) {
  var box = h('div', { class: 'seg', role: 'group' }, options.map(function (o) { return h('button', { 'aria-pressed': String(o[0] === value), onclick: function () { onpick(o[0]); } }, o[1]); }));
  return box;
}
function acc(title, kids, open) { return h('details', { class: 'acc', open: open }, [h('summary', null, title), h('div', null, kids)]); }
var nextFrame = function () { return new Promise(function (r) { setTimeout(r, 0); }); };

var toastT;
function toast(msg, ms) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, ms || 3600); }
/* Narrow is not the same as touch: a half-width window on a laptop is narrow with a mouse; a tablet held sideways is wide with a finger. */
var touchForce = null;
function touchOnly() { return touchForce !== null ? touchForce : !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches); }
function phoneLayout() { return !!(window.matchMedia && matchMedia('(max-width:820px)').matches); }
/** Words follow the device: T('Right-click', 'Press and hold'). */
function T(computerText, touchText) { return touchOnly() ? touchText : computerText; }
function placeChrome() { document.body.classList.toggle('touch', touchOnly()); document.body.classList.toggle('narrow', phoneLayout()); }
/** The on-screen keyboard changes the height, not the width. --kb is how much of the page it covers; typing hides the tab bar. */
function keyboardLift() {
  var vv = window.visualViewport; if (!vv) return;
  var upd = function () { var kb = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)); if (vv.scale > 1.01) kb = 0; document.documentElement.style.setProperty('--kb', kb + 'px'); document.body.classList.toggle('kb', kb > 80); };
  vv.addEventListener('resize', upd); vv.addEventListener('scroll', upd); upd();
}
function say(msg) { var l = $('live'); l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 30); }

function download(name, data, type) {
  var blob = data instanceof Blob ? data : new Blob([data], { type: type || 'text/plain' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}
var csvCell = function (v) { v = v === undefined || v === null ? '' : String(v); if (/^[=+\-@\t\r]/.test(v) && isNaN(Number(v))) v = "'" + v; return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
var fname = function (ext) { return (S.graph.name || 'map').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) + ext; };

/* ---------------------------------------------------------------- the engine runs on the page too (for small jobs and as a fallback) */
var engineSrc = $('nfm-engine-src').textContent, pageEngine = null;
function getEngine() {
  if (!pageEngine) { var s = document.createElement('script'); s.textContent = engineSrc; document.head.appendChild(s); pageEngine = window.NFMEngine; }
  return pageEngine;
}
getEngine();

/* ---------------------------------------------------------------- state */
var EMPTY = function () { return { name: 'Untitled', start: null, nodes: [], edges: [] }; };
var S = {
  graph: EMPTY(), dg: null, prof: null, story: false, hist: [], gver: 0, byId: new Map(), outAdj: new Map(), inAdj: new Map(), kinds: [],
  theme: 'auto', method: 'auto', tab: 'data', imp: null,
  V: null, // view settings for this data (see defaultView)
  A: null, // advanced settings (simulation, layout) for this data
  L: null, scene: null, sceneOk: false, view: { k: 1, tx: 0, ty: 0 }, fitK: 1, sel: new Set(), selEdges: new Set(), stageW: 1, stageH: 1, dpr: 1, mapSeq: 0, canary: null, ms: 0
};

function defaultView() {
  return {
    view: 'flow', arrange: 'stress', colorBy: 'group', sizeBy: '', widthBy: '', edgeColorBy: '', linkLabels: '', labelCol: '', dir: 'LR', spread: 'tight', fold: true, merge: false, rows: 'route', chapters: 'auto', openCh: {}, minimap: 'auto', bundle: false, taper: false, tagLen: 0, spineCol: false, better: false, wrap: false, ruler: false, downLanes: false, laneBy: 'group', agg: 'sum',
    state: 0, anim: { sec: 2.4, loop: true, ghost: 'faint' }, strongest: 100, facets: {}, around: null, block: [], hideKinds: [], only: null, sets: {}, marks: {},
    rules: [], fmt: NFMLook.defaults(), palette: 'standard', ramp: 'warm', groupColors: {}, widthScale: 'sqrt', widthMul: 1, hulls: false, curve: 0, valueLabels: false,
    lab: { items: { show: true, scale: 1, color: 'auto', fixed: '#222222', topN: 0 }, links: { show: true, scale: 1 }, groups: { show: false, scale: 1 } },
    lens: { on: false, d: 3, r: 0.28 }, cam: { yaw: 0.6, pitch: 0.35, persp: 2.4, spin: false },
    vocab: {}, key: { x: null, y: null, min: false, hide: phoneLayout(), edits: {} }, pins: {}, saved: [],
    sk: { color: 'target', opacity: 0.45, labels: 'auto', nodeValues: false, nodeW: 14, gap: 0, pad: 12, height: 0, justify: true, fixY: {}, order: null, nodes: {}, links: {} }
  };
}
var VKEY = function () { return 'nfm-v:' + (S.graph.name || 'Untitled'); };
/** True when the object really has this key of its own ("constructor" or "toString" as an item name must not find the built-in ones). */
function own(o, k) { return o !== null && o !== undefined && Object.prototype.hasOwnProperty.call(o, k); }
var isPlain = function (x) { return x !== null && typeof x === 'object' && !Array.isArray(x); };
/** Lays saved or shared settings over the defaults. "__proto__" is never taken (it would change every object); a list or an object is only replaced by the same kind of thing (never by null). */
function mergeDeep(base, add) {
  if (!isPlain(add)) return base;
  Object.keys(add).forEach(function (k) {
    if (k === '__proto__') return;
    var v = add[k], b = own(base, k) ? base[k] : undefined;
    if (v === undefined) return;
    if (isPlain(v) && isPlain(b)) mergeDeep(b, v);
    else if (Array.isArray(b) ? !Array.isArray(v) : isPlain(b) ? !isPlain(v) : false) return;
    else base[k] = v;
  });
  return base;
}
/** Settings that are looked up by name in a fixed list must name something on the list (saved or shared text can say anything). */
function fixLook(v) {
  var D = defaultView();
  v.fmt = NFMLook.clean(v.fmt);
  if (!own(NFMScene.PALETTES, v.palette)) v.palette = D.palette;
  if (!own(NFMScene.RAMPS, v.ramp)) v.ramp = D.ramp;
  if (!own(ARR, v.arrange)) v.arrange = D.arrange;
  if (v.spread !== 'tight' && v.spread !== 'wide') v.spread = D.spread;
  if (!VIEWS.some(function (x) { return x[0] === v.view; })) v.view = D.view;
  return v;
}
function loadView() {
  var v = defaultView(), raw = LS.get(VKEY());
  if (raw) { try { mergeDeep(v, JSON.parse(raw)); } catch (e) { /* ignore */ } fixLook(v); }
  else if (S.graph.roles) { var r = S.graph.roles; ['colorBy', 'sizeBy', 'widthBy', 'edgeColorBy', 'linkLabels', 'view'].forEach(function (k) { if (r[k] !== undefined) v[k] = r[k]; }); }
  else if (S.prof) { var g = NFMColumns.guessRoles(S.prof, S.graph); ['colorBy', 'sizeBy', 'widthBy', 'edgeColorBy'].forEach(function (k) { if (g[k]) v[k] = g[k]; }); if (!S.story && S.graph.nodes.length && !S.graph.start) v.view = 'network'; }
  if (!S.story && v.colorBy === 'odds') v.colorBy = 'group';
  S.V = v;
}
/* A save that fails (storage full or blocked) or is skipped (too big) is told once, in plain words; before this the old copy stayed and came back on reload as if it were current. */
var saveWarned = {};
function saveWarn(kind) {
  kind = kind === 'big' ? 'big' : 'fail'; if (saveWarned[kind]) return; saveWarned[kind] = true;   /* once for each of the two kinds of trouble */
  toast(kind === 'big' ? 'This data is too big to keep on this computer between visits. Use Export to keep your work.' : 'Your latest changes could not be saved on this computer (storage is full or blocked). Use Export to keep them.', 9000);
}
var saveView = debounce(function () { if (S.V && S.graph.nodes.length && !LS.set(VKEY(), JSON.stringify(S.V))) saveWarn('view'); }, 400);
var savePrefs = debounce(function () { LS.set('nfm-prefs', JSON.stringify({ theme: S.theme, method: S.method })); }, 300);
var saveGraph = debounce(function () {
  if (!S.graph.nodes.length) { LS.del('nfm-graph'); return; }
  var txt = JSON.stringify(S.graph);
  if (txt.length < 1800000) { if (!LS.set('nfm-graph', txt)) saveWarn('graph'); } else { LS.del('nfm-graph'); saveWarn('big'); }
}, 600);
/** Saves that are still waiting for their delay are done now when the page is going away or hidden (a reload 600 ms after an edit used to lose it). */
function flushSaves() { [saveGraph, saveView, savePrefs, typeof saveAdv === 'function' ? saveAdv : null].forEach(function (f) { if (f && f.flush) f.flush(); }); }
window.addEventListener('pagehide', flushSaves);
document.addEventListener('visibilitychange', function () { if (document.hidden || document.visibilityState === 'hidden') flushSaves(); });

/* ---------------------------------------------------------------- words: neutral by default, story wording only for stories */
var VOCAB = {
  story: { walkers: 'players', walker: 'player', ends: 'endings', end: 'ending', item: 'scene', items: 'scenes', link: 'choice', links: 'choices', odds: 'Where players end up', flow: 'Players' },
  data: { walkers: 'walkers', walker: 'walker', ends: 'end points', end: 'end point', item: 'item', items: 'items', link: 'link', links: 'links', odds: 'Where flow ends up', flow: 'Flow' }
};
function word(k) { var v = S.V && S.V.vocab && S.V.vocab[k]; return v || (S.story ? VOCAB.story : VOCAB.data)[k] || k; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------------------------------------------------------------- theme and tabs */
function themeName() { return S.theme === 'auto' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : S.theme; }
function applyTheme() {
  var r = document.documentElement;
  if (S.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.theme);
  if (S.scene && S.L && typeof makeScene === 'function') makeScene(false);
}
var TABS = ['data', 'nodes', 'map', 'check', 'adv', 'export'], TAB_HOOKS = {};
function showTab(name) {
  S.tab = name;
  TABS.forEach(function (t) { $('tab-' + t).hidden = t !== name; $('tabbtn-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false'); });
  if (TAB_HOOKS[name]) TAB_HOOKS[name]();
}

/* ---------------------------------------------------------------- the graph: one place that changes it */
/** The links of every item as two lists of numbers (where each item's links start, and which links they are) instead of a Map of arrays: 84% less memory on a big map, and reading them is quicker. get(id) gives the link objects in the order they were added, each(id, fn) visits them without making a list, has(id) says whether the item has any, count(id) says how many (without making a list). Links that name an item the map does not have are kept in a small side table. */
function makeLinkLists(edges, pos, field, nNodes) {
  var M = edges.length, off = new Int32Array(nNodes + 1), ord = new Int32Array(M), i, v, loose = null, idx = new Int32Array(M);
  for (i = 0; i < M; i++) { v = pos.get(edges[i][field]); if (v === undefined) { if (!loose) loose = new Map(); var key = edges[i][field]; if (!loose.has(key)) loose.set(key, []); loose.get(key).push(edges[i]); idx[i] = -1; } else { idx[i] = v; off[v + 1]++; } }
  for (i = 0; i < nNodes; i++) off[i + 1] += off[i];
  var cur = off.slice(0, nNodes), other = field === 'from' ? 'to' : 'from', oth = new Array(M);
  for (i = 0; i < M; i++) if (idx[i] >= 0) { ord[cur[idx[i]]] = i; oth[cur[idx[i]]++] = edges[i][other]; }
  return {
    off: off, ord: ord, loose: loose,
    get: function (id) { var x = pos.get(id); if (x === undefined) return loose ? loose.get(id) : undefined; var a = off[x], b = off[x + 1]; if (a === b) return undefined; var out = [], E = S.graph.edges, j; for (j = a; j < b; j++) out.push(E[ord[j]]); return out; },
    each: function (id, fn) { var x = pos.get(id), j; if (x === undefined) { if (loose && loose.has(id)) loose.get(id).forEach(function (e) { fn(e); }); return; } var E = S.graph.edges, b = off[x + 1]; for (j = off[x]; j < b; j++) fn(E[ord[j]]); },
    /** adds the item at the other end of each of this item's links to set: walks the two typed lists and the names kept beside them, touching no link object */
    addOther: function (id, set) { var x = pos.get(id), j, b; if (x === undefined) { if (loose && loose.has(id)) loose.get(id).forEach(function (e) { set.add(e[other]); }); return; } b = off[x + 1]; for (j = off[x]; j < b; j++) set.add(oth[j]); },
    /** every item reachable by following these links from id (id included), in the order found */
    reach: function (id) {
      var seen = new Set([id]), q = [id], i, j, b, x, w, o, add = function (e) { var o2 = e[other]; if (!seen.has(o2)) { seen.add(o2); q.push(o2); } };
      for (i = 0; i < q.length; i++) {
        w = q[i]; x = pos.get(w);
        if (x === undefined) { if (loose && loose.has(w)) loose.get(w).forEach(add); continue; }
        b = off[x + 1]; for (j = off[x]; j < b; j++) { o = oth[j]; if (!seen.has(o)) { seen.add(o); q.push(o); } }
      }
      return seen;
    },
    has: function (id) { var x = pos.get(id); if (x === undefined) return !!(loose && loose.has(id)); return off[x + 1] > off[x]; },
    count: function (id) { var x = pos.get(id); if (x === undefined) return loose && loose.has(id) ? loose.get(id).length : 0; return off[x + 1] - off[x]; }
  };
}
function indexGraph() {
  var g = S.graph, by = new Map(), pos = new Map(), kinds = new Set();
  g.nodes.forEach(function (n, i) { by.set(n.id, n); pos.set(n.id, i); });
  g.edges.forEach(function (e) { if (e.kind) kinds.add(e.kind); });
  S.byId = by; S.outAdj = makeLinkLists(g.edges, pos, 'from', g.nodes.length); S.inAdj = makeLinkLists(g.edges, pos, 'to', g.nodes.length); S.kinds = Array.from(kinds).sort();
  S.dg = NFMColumns.derive(g); S.prof = NFMColumns.profile(S.dg); S.story = NFMColumns.isStory(g);
}
/** One link of the layout, read without bringing a packed link list back (see src/layout-park.js). */
function edgeOf(i) { var L = S.L; return L.edgeAt ? L.edgeAt(i) : L.edges[i]; }
var HOOKS = { graph: [], view: [] };
/** Replace the whole graph. push=false means: do not remember the old one for Undo. */
function setGraph(g, push, keepView) {
  var rename = (S.graph.name !== g.name);
  if (rename) saveView.flush();   /* the old data's settings are saved under the old name before the name changes */
  if (push !== false) { S.hist.push(NFMUndo.step(S.graph, g)); if (S.hist.length > 25) S.hist.shift(); }   /* a step keeps only what this change replaced (src/undo.js) */
  S.graph = g; S.gver++;
  if (!keepView || rename) skHist = [];   /* Sankey undo steps belong to one dataset */
  graphChanged(rename && !keepView);
}
/** Change the graph through fn(g), where g holds copies of the two lists; fn must replace objects, not change them in place. */
function edit(fn, push) {
  var g = { name: S.graph.name, start: S.graph.start, flavor: S.graph.flavor, calc: S.graph.calc, roles: S.graph.roles, states: S.graph.states, nodes: S.graph.nodes.slice(), edges: S.graph.edges.slice() };
  fn(g);
  setGraph(g, push, true);
}
/** After a file is read: repeated texts in the map are pointed at one copy (src/undo.js textSharer), in short slices while the page is idle. */
var shareJob = null;
function shareTextSoon() {
  var g = S.graph; if (!g || !g.nodes || g.nodes.length + g.edges.length < 2000) return;
  var step = NFMUndo.textSharer(g), my = shareJob = {};
  var later = typeof requestIdleCallback === 'function' ? function (f) { requestIdleCallback(f, { timeout: 1000 }); } : function (f) { setTimeout(f, 16); };
  var go = function () { if (shareJob !== my) return; if (step(4000)) shareJob = null; else later(go); };
  later(go);
}
function graphChanged(reloadView) {
  indexGraph();
  if (reloadView || !S.V) loadView();
  var ids = S.byId;
  S.V.block = S.V.block.filter(function (id) { return ids.has(id); });
  S.sel = new Set(Array.from(S.sel).filter(function (id) { return ids.has(id); }));
  S.selEdges = new Set(); S.sceneOk = false;   /* link numbers mean other links in new data; the picture is out of date until it is built again */
  if (S.V.around && !ids.has(S.V.around.id)) S.V.around = null;
  if (client && client.mode !== 'starting') client.setGraph(S.graph);
  HOOKS.graph.forEach(function (f) { f(); });
  var u = $('b-undo'); if (u) u.disabled = !S.hist.length;
  saveGraph(); saveView();
  var cb = $('chk-badge'); if (cb) cb.hidden = true;
  if (S.tab === 'map') refreshMap('data');
}
function undo() {
  if (!S.hist.length) return;
  undoTo(NFMUndo.back(S.hist.pop(), S.graph));
}
function undoTo(g) {
  var rename = S.graph.name !== g.name;
  if (rename) { saveView.flush(); skHist = []; }   /* going back to other data: keep this data's settings under its own name, bring back the other's */
  S.graph = g; S.gver++; graphChanged(rename); toast('Undone.');
}
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/input|textarea|select/i.test((e.target.tagName || ''))) {
    if (S.tab === 'map' && S.V && S.V.view === 'sankey' && skHist.length) { e.preventDefault(); skUndo(); }
    else if (S.hist.length) { e.preventDefault(); undo(); }
  }
});
/** Change a view setting and redraw. Settings that change the layout rebuild; looks only restyle. */
function setV(patch, how) {
  mergeDeep(S.V, patch);
  Object.keys(patch).forEach(function (k) { if (Array.isArray(patch[k]) || (patch[k] === null)) S.V[k] = patch[k]; });
  saveView();
  if (how === 'none') { S.sceneOk = false; return; }
  if (how === 'look') { makeScene(false); return; }
  refreshMap('options');
}

/*!
 * Net Flow Map app, part 1: helpers, state, the one place that changes the data, tabs and theme.
 * Copyright (c) 2026 JNFoo. MIT License.
 * The parts in src/app/ are joined into one function by tools/build.mjs, so they share these names.
 */
var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
var debounce = function (fn, ms) { var t; var f = function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; f.now = function () { clearTimeout(t); fn(); }; return f; };
var LS = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* none */ } }
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
  L: null, scene: null, view: { k: 1, tx: 0, ty: 0 }, fitK: 1, sel: new Set(), selEdges: new Set(), stageW: 1, stageH: 1, dpr: 1, mapSeq: 0, canary: null, ms: 0
};

function defaultView() {
  return {
    view: 'flow', arrange: 'stress', colorBy: 'group', sizeBy: '', widthBy: '', edgeColorBy: '', linkLabels: '', labelCol: '', dir: 'LR', fold: true, merge: false, laneBy: 'group', agg: 'sum',
    state: 0, anim: { sec: 2.4, loop: true, ghost: 'faint' }, strongest: 100, facets: {}, around: null, block: [], hideKinds: [], only: null, sets: {}, marks: {},
    rules: [], palette: 'standard', ramp: 'warm', groupColors: {}, widthScale: 'sqrt', widthMul: 1, hulls: false, curve: 0, valueLabels: false,
    lab: { items: { show: true, scale: 1, color: 'auto', fixed: '#222222', topN: 0 }, links: { show: true, scale: 1 }, groups: { show: false, scale: 1 } },
    lens: { on: false, d: 3, r: 0.28 }, cam: { yaw: 0.6, pitch: 0.35, persp: 2.4, spin: false },
    vocab: {}, key: { x: null, y: null, min: false, hide: phoneLayout(), edits: {} }, pins: {}, saved: []
  };
}
var VKEY = function () { return 'nfm-v:' + (S.graph.name || 'Untitled'); };
function mergeDeep(base, add) {
  if (!add || typeof add !== 'object') return base;
  Object.keys(add).forEach(function (k) {
    if (add[k] && typeof add[k] === 'object' && !Array.isArray(add[k]) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) mergeDeep(base[k], add[k]);
    else if (add[k] !== undefined) base[k] = add[k];
  });
  return base;
}
function loadView() {
  var v = defaultView(), raw = LS.get(VKEY());
  if (raw) { try { mergeDeep(v, JSON.parse(raw)); } catch (e) { /* ignore */ } }
  else if (S.graph.roles) { var r = S.graph.roles; ['colorBy', 'sizeBy', 'widthBy', 'edgeColorBy', 'linkLabels', 'view'].forEach(function (k) { if (r[k] !== undefined) v[k] = r[k]; }); }
  else if (S.prof) { var g = NFMColumns.guessRoles(S.prof, S.graph); ['colorBy', 'sizeBy', 'widthBy', 'edgeColorBy'].forEach(function (k) { if (g[k]) v[k] = g[k]; }); if (!S.story && S.graph.nodes.length && !S.graph.start) v.view = 'network'; }
  if (!S.story && v.colorBy === 'odds') v.colorBy = 'group';
  S.V = v;
}
var saveView = debounce(function () { if (S.V && S.graph.nodes.length) LS.set(VKEY(), JSON.stringify(S.V)); }, 400);
var savePrefs = debounce(function () { LS.set('nfm-prefs', JSON.stringify({ theme: S.theme, method: S.method })); }, 300);
var saveGraph = debounce(function () {
  if (!S.graph.nodes.length) { LS.del('nfm-graph'); return; }
  var txt = JSON.stringify(S.graph);
  if (txt.length < 1800000) LS.set('nfm-graph', txt); else LS.del('nfm-graph');
}, 600);

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
function indexGraph() {
  var g = S.graph, by = new Map(), out = new Map(), inn = new Map(), kinds = new Set();
  g.nodes.forEach(function (n) { by.set(n.id, n); });
  g.edges.forEach(function (e) {
    if (!out.has(e.from)) out.set(e.from, []); out.get(e.from).push(e);
    if (!inn.has(e.to)) inn.set(e.to, []); inn.get(e.to).push(e);
    if (e.kind) kinds.add(e.kind);
  });
  S.byId = by; S.outAdj = out; S.inAdj = inn; S.kinds = Array.from(kinds).sort();
  S.dg = NFMColumns.derive(g); S.prof = NFMColumns.profile(S.dg); S.story = NFMColumns.isStory(g);
}
var HOOKS = { graph: [], view: [] };
/** Replace the whole graph. push=false means: do not remember the old one for Undo. */
function setGraph(g, push, keepView) {
  if (push !== false) { S.hist.push(S.graph); if (S.hist.length > 25) S.hist.shift(); }
  var rename = (S.graph.name !== g.name);
  S.graph = g; S.gver++;
  graphChanged(rename && !keepView);
}
/** Change the graph through fn(g), where g holds copies of the two lists; fn must replace objects, not change them in place. */
function edit(fn, push) {
  var g = { name: S.graph.name, start: S.graph.start, flavor: S.graph.flavor, calc: S.graph.calc, roles: S.graph.roles, states: S.graph.states, nodes: S.graph.nodes.slice(), edges: S.graph.edges.slice() };
  fn(g);
  setGraph(g, push, true);
}
function graphChanged(reloadView) {
  indexGraph();
  if (reloadView || !S.V) loadView();
  var ids = S.byId;
  S.V.block = S.V.block.filter(function (id) { return ids.has(id); });
  S.sel = new Set(Array.from(S.sel).filter(function (id) { return ids.has(id); }));
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
  S.graph = S.hist.pop(); S.gver++; graphChanged(false); toast('Undone.');
}
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/input|textarea|select/i.test((e.target.tagName || '')) && S.hist.length) { e.preventDefault(); undo(); }
});
/** Change a view setting and redraw. Settings that change the layout rebuild; looks only restyle. */
function setV(patch, how) {
  mergeDeep(S.V, patch);
  Object.keys(patch).forEach(function (k) { if (Array.isArray(patch[k]) || (patch[k] === null)) S.V[k] = patch[k]; });
  saveView();
  if (how === 'none') return;
  if (how === 'look') { makeScene(false); return; }
  refreshMap('options');
}

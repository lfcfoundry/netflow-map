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
var nfmt = function (n) { return NFMColumns.nf(n); };   /* Number(n).toLocaleString('en-US') with a kept formatter (src/columns.js) */
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
/** How many links g has, without building their rows when they are still columns. */
function nEdges(g) { var lc = NFMLinkCols.pending(g); return lc ? lc.n : g.edges.length; }
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
    view: 'flow', arrange: 'stress', colorBy: 'group', sizeBy: '', widthBy: '', edgeColorBy: '', linkLabels: '', labelCol: '', dir: 'LR', spread: 'tight', fold: true, merge: false, rows: 'best', search: 'auto', chordBy: 'auto', chordOrder: 'fast', nest: 'auto', treeShape: 'tidy', chapters: 'auto', openCh: {}, minimap: 'auto', bundle: false, taper: false, tagLen: 0, spineCol: false, better: false, wrap: false, ruler: false, downLanes: false, laneBy: 'group', agg: 'sum',
    state: 0, anim: { sec: 2.4, loop: true, ghost: 'faint' }, strongest: 100, facets: {}, around: null, block: [], hideKinds: [], only: null, sets: {}, marks: {},
    rules: [], fmt: NFMLook.defaults(), palette: 'standard', ramp: 'warm', groupColors: {}, widthScale: 'sqrt', widthMul: 1, hulls: false, curve: 0, valueLabels: false,
    lab: { items: { show: true, scale: 1, color: 'auto', fixed: '#222222', topN: 0 }, links: { show: true, scale: 1 }, groups: { show: false, scale: 1 } },
    lens: { on: false, d: 3, r: 0.28 }, cam: { yaw: 0.6, pitch: 0.35, persp: 2.4, spin: false },
    vocab: {}, key: { x: null, y: null, min: true, hide: phoneLayout(), edits: {} }, pins: {}, saved: [],
    sk: { color: 'target', opacity: 0.45, labels: 'auto', nodeValues: false, valueLabel: 'none', unit: '', percentOf: 'total', notes: [], nodeW: 14, gap: 0, pad: 12, height: 0, justify: true, fixY: {}, order: null, nodes: {}, links: {} }
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
  if (['auto', 'items', 'groups'].indexOf(v.chordBy) < 0) v.chordBy = D.chordBy;
  if (['fewest', 'fast'].indexOf(v.chordOrder) < 0) v.chordOrder = D.chordOrder;
  if (['auto', 'links', 'groups'].indexOf(v.nest) < 0) v.nest = D.nest;
  if (['tidy', 'cluster', 'radial', 'radialCluster', 'indented'].indexOf(v.treeShape) < 0) v.treeShape = D.treeShape;
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
/*
 * Safe saves. A browser that crashes or is killed loses the newest localStorage writes: in Chromium up to about a minute of them, in Firefox
 * about 10 s (tested: an edit 30 s before the kill was gone on reopen in Chromium). Each save of the data and of its view settings is also
 * written to IndexedDB, with 'strict' durability, which kept every completed save in both. Each save carries a number, also kept in
 * localStorage; at start, when IndexedDB holds a newer save than localStorage, that one is brought back.
 * The map itself (nfm-graph, up to 1.8 M characters) is kept in IndexedDB only, with a small marker (nfm-graph-at: its save number and
 * size) in localStorage: every app on this address shares one 5 MB localStorage, and in Chromium each app's start paid about 17 ms for
 * a big map kept there (round 22). A map saved by an older build in localStorage is read as before and moved over at start. Without
 * IndexedDB (a private window that refuses it) the map stays in localStorage, as before. While the page is going away, the map is also
 * written to localStorage (an IndexedDB write may not finish then); the next start moves it over and removes it.
 */
var SAFE = (function () {
  var dbP = null, seq = 0, idbOK = false, BIG = { 'nfm-graph': 'nfm-graph-at' }, going = false, flying = null;   /* flying: the map save whose IndexedDB write has not finished */
  function open() {
    if (dbP) return dbP;
    dbP = new Promise(function (res, rej) {
      if (TWIN || typeof indexedDB === 'undefined') return rej(new Error('no IndexedDB'));
      var q; try { q = indexedDB.open('netflow-map-saves', 1); } catch (e) { return rej(e); }
      q.onupgradeneeded = function () { q.result.createObjectStore('s'); };
      q.onsuccess = function () { idbOK = true; res(q.result); }; q.onerror = function () { rej(q.error); }; q.onblocked = function () { rej(new Error('blocked')); };
    });
    dbP.catch(function () { /* no safe copy: localStorage alone, as before */ });
    return dbP;
  }
  function tx(mode, f) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t; try { t = db.transaction('s', mode, { durability: 'strict' }); } catch (e) { t = db.transaction('s', mode); }
        var out = f(t.objectStore('s'));
        t.oncomplete = function () { res(out && out.result); }; t.onerror = t.onabort = function () { rej(t.error || new Error('aborted')); };
      });
    });
  }
  function next() { seq = Math.max(seq, +(LS.get('nfm-seq') || 0)) + 1; LS.set('nfm-seq', String(seq)); return seq; }
  function spill(f) { LS.set(f.k, f.text); LS.set('nfm-seq:' + f.k, String(f.n)); }
  return {
    ready: open,
    /** Takes the connection the page's first script opened (NFM_EARLY in the page head), so it is not opened twice. */
    adopt: function (db) { if (!dbP && db) { idbOK = true; dbP = Promise.resolve(db); } },
    /** Saves text under a key: localStorage plus the IndexedDB copy, or for the map (BIG) IndexedDB plus a marker. False when nothing could keep it. */
    set: function (k, text) {
      if (TWIN) return true;
      var n = next();
      if (BIG[k] && idbOK) {
        LS.set(BIG[k], JSON.stringify({ seq: n, size: text.length }));
        var me = flying = { k: k, text: text, n: n };
        if (going) spill(me);   /* the page is going away: a sure copy too, moved over at the next start */
        tx('readwrite', function (st) { st.put({ seq: n, text: text }, k); st.delete(k + '-delta'); }).then(function () {
          if (flying === me) flying = null;
          if (LS.get(k) !== null && +(LS.get('nfm-seq:' + k) || 0) <= n) { LS.del(k); LS.del('nfm-seq:' + k); }   /* an older or spilled copy is not needed now */
        }, function () { if (flying === me) flying = null; spill(me); });   /* IndexedDB refused it: localStorage, as before */
        return true;
      }
      var ok = LS.set(k, text); LS.set('nfm-seq:' + k, String(n));
      tx('readwrite', function (st) { st.put({ seq: n, text: text }, k); }).catch(function () { /* the localStorage copy stands */ });
      return ok;
    },
    /** Saves a big map as map-file bytes (a packed copy, about 4% of its text) in IndexedDB only, with the marker. Resolves true when kept; false when IndexedDB is not there or refused it. */
    setPacked: function (k, u8) {
      if (TWIN) return Promise.resolve(true);
      if (!BIG[k] || !idbOK) return Promise.resolve(false);
      var n = next(); LS.del(k); LS.del('nfm-seq:' + k);
      LS.set(BIG[k], JSON.stringify({ seq: n, size: u8.length, packed: 1 }));
      return tx('readwrite', function (st) { st.put({ seq: n, packed: u8 }, k); st.delete(k + '-delta'); }).then(function () { return n; }, function () { LS.del(BIG[k]); return false; });   /* resolves to the save number; a patch kept for an older full save goes */
    },
    /** Keeps a patch (LfcPack delta bytes) against the full save numbered baseSeq, next to it, and tells the marker. Resolves true when kept. */
    setDelta: function (k, u8, baseSeq) {
      if (TWIN) return Promise.resolve(true);
      if (!BIG[k] || !idbOK) return Promise.resolve(false);
      var n = next();
      return tx('readwrite', function (st) { st.put({ seq: n, baseSeq: baseSeq, delta: u8 }, k + '-delta'); }).then(function () {
        var m = null; try { m = JSON.parse(LS.get(BIG[k]) || 'null'); } catch (e) { m = null; }
        if (!m || m.seq !== baseSeq) return 'stale';   /* a newer full save came meanwhile: this patch is not for it */
        m.delta = n; LS.set(BIG[k], JSON.stringify(m)); return true;
      }, function () { return false; });
    },
    del: function (k) { if (TWIN) return; LS.del(k); LS.del('nfm-seq:' + k); if (BIG[k]) LS.del(BIG[k]); tx('readwrite', function (st) { st.delete(k); if (BIG[k]) st.delete(k + '-delta'); }).catch(function () { /* none */ }); },
    /** Puts a safe copy back: into localStorage, or for the map, nowhere (IndexedDB already holds it) once IndexedDB works. */
    repair: function (k, r) { if (BIG[k] && idbOK) { LS.set(BIG[k], JSON.stringify({ seq: r.seq, size: r.text.length })); return; } LS.set(k, r.text); LS.set('nfm-seq:' + k, String(r.seq)); },
    /** The safe copy of key k ({ seq, text }) when it is newer than localStorage's, else null. */
    newer: function (k) {
      var have = +(LS.get('nfm-seq:' + k) || 0);
      return tx('readonly', function (st) { return st.get(k); }).then(function (r) {
        if (r && r.seq) seq = Math.max(seq, r.seq);
        return r && r.seq > have && typeof r.text === 'string' ? r : null;
      }, function () { return null; });
    },
    /** The IndexedDB copy of key k ({ seq, text }) or null. */
    read: function (k) { return tx('readonly', function (st) { return st.get(k); }).then(function (r) { if (r && r.seq) seq = Math.max(seq, r.seq); return r && (typeof r.text === 'string' || r.packed || r.delta) ? r : null; }, function () { return null; }); },
    /** True while the page is going away (flushSaves): the map is also written to localStorage then. */
    going: function (v) { going = !!v; if (going && flying) spill(flying); },   /* a map save still on its way to IndexedDB goes to localStorage too */
    has: function () { return idbOK; }
  };
})();
var saveView = debounce(function () { if (S.V && S.graph.nodes.length && !SAFE.set(VKEY(), JSON.stringify(S.V))) saveWarn('view'); }, 400);
var savePrefs = debounce(function () { LS.set('nfm-prefs', JSON.stringify({ theme: S.theme, method: S.method })); }, 300);
/**
 * JSON.stringify(g), the same text, or null as soon as it would pass max characters. The autosave keeps maps under 1.8 MB of text only, and
 * it used to write a big map's whole text on every change just to find that out (750,000 items and links: a long freeze and about 100 MB
 * of garbage each time). Items are written one at a time, so a big map stops after the first 1.8 MB.
 */
function graphText(g, max) {
  var parts = [], len = 2, keys = Object.keys(g), ki, k, v, t, i, kq;   /* len: the exact length of the text so far */
  for (ki = 0; ki < keys.length; ki++) {
    k = keys[ki]; v = g[k];
    if ((k === 'nodes' || k === 'edges') && Array.isArray(v)) {
      var a = new Array(v.length); kq = JSON.stringify(k); len += (parts.length ? 1 : 0) + kq.length + 3 + (v.length ? v.length - 1 : 0);
      if (len > max) return null;
      for (i = 0; i < v.length; i++) { t = JSON.stringify(v[i]); if (t === undefined) t = 'null'; len += t.length; if (len > max) return null; a[i] = t; }
      parts.push(kq + ':[' + a.join(',') + ']');
    } else {
      t = JSON.stringify(v); if (t === undefined) continue;
      t = JSON.stringify(k) + ':' + t; len += (parts.length ? 1 : 0) + t.length; if (len > max) return null;
      parts.push(t);
    }
  }
  return '{' + parts.join(',') + '}';
}
/** Whether g's text may fit in max characters: yes under 20,000 items and links; above, a guess from 200 items and 200 links spread through it (generous: 1.5 times over max still says yes). */
function textMayFit(g, max) {
  var n = g.nodes || [], e = g.edges || [], k = Math.min(n.length, 200), j = Math.min(e.length, 200), a = 0, b = 0, i, t;
  if (n.length + e.length < 20000) return true;   /* small maps: the one whole stringify, exactly as before (sampling cost them 5 to 13%) */
  for (i = 0; i < k; i++) { t = JSON.stringify(n[Math.floor(i * n.length / k)]); a += t ? t.length + 1 : 5; }
  for (i = 0; i < j; i++) { t = JSON.stringify(e[Math.floor(i * e.length / j)]); b += t ? t.length + 1 : 5; }
  return (k ? a / k * n.length : 0) + (j ? b / j * e.length : 0) < max * 1.5;
}
var saveGraph = debounce(function () {
  if (!S.graph.nodes.length) { PACKSAVE.n++; PACKSAVE.base = null; PACKSAVE.again = false; SAFE.del('nfm-graph'); return; }
  if (NFMLinkCols.pending(S.graph)) { saveBig(); return; }   /* links still columns: always a big map (50,000+ links); saved packed, as columns */
  var txt = textMayFit(S.graph, 1800000) ? JSON.stringify(S.graph) : graphText(S.graph, 1800000);   /* one whole stringify when it may fit (the quickest), item by item with an early stop when it surely won't */
  if (txt !== null && txt.length < 1800000) { PACKSAVE.n++; PACKSAVE.base = null; PACKSAVE.again = false; if (!SAFE.set('nfm-graph', txt)) saveWarn('graph'); } else saveBig();
}, 600);
/* A map over 1.8 MB of text is kept as map-file bytes (LFC-pack, about 4% of the text), packed on the thread the Undo steps use, so the page is not held. The old copy goes first: a page that closes
   before the packing ends keeps nothing, never an older map that would come back as if it were current. Without a packing thread, IndexedDB or room, the old "too big" notice stands. */
var PACKSAVE = { n: 0, id: 0, base: null, deltas: 0, flying: false, again: false };   /* base: the last full save made by this page { id, seq, nodes, edges, len } while the saving thread still holds its tables; flying: a save is being made (a change meanwhile only asks for one more after it) */
/** The rows (index, row, index, row ...) of list b that are not the same objects as list a's, or null past 2,000 rows (edit() replaces changed objects, never changes them in place). */
function changedRows(a, b) {
  var r = [], i;
  for (i = 0; i < b.length; i++) if (a[i] !== b[i]) { r.push(i, b[i]); if (r.length > 4000) return null; }
  return r;
}
function saveBig() {
  if (PACKSAVE.flying) { PACKSAVE.again = true; return; }   /* one save at a time: a change made while one runs gets the next one, a patch against what this one makes (each used to start its own whole text of the map) */
  var n = PACKSAVE.n, g = S.graph, stale = function () { return PACKSAVE.n !== n; }, bs = PACKSAVE.base, packOK = typeof savePacker === 'function' && typeof Worker !== 'undefined' && typeof DecompressionStream !== 'undefined' && SAFE.has();
  if (!packOK) { SAFE.del('nfm-graph'); saveWarn('big'); return; }
  var full = function () {
    PACKSAVE.base = null; SAFE.del('nfm-graph');   /* the old copy goes first: a page that closes before the packing ends keeps nothing, never an older map */
    var later = typeof requestIdleCallback === 'function' ? function (f) { requestIdleCallback(f, { timeout: 3000 }); } : function (f) { setTimeout(f, 50); };
    var id = ++PACKSAVE.id;
    return new Promise(later).then(function () {
      if (stale()) throw 0;
      return undoText(g).then(function (text) { return savePackCall({ kind: 'full', text: text, baseId: id }); });
    }).then(function (r) {
      var u8 = r.u8;
      if (stale()) throw 0;   /* a small or empty map was saved meanwhile */
      if (!u8 || u8.length > 48 * 1048576) throw 1;
      return SAFE.setPacked('nfm-graph', u8).then(function (seq) {
        if (!seq) throw 1;
        if (!stale()) { PACKSAVE.base = NFMLinkCols.pending(g) ? null : { id: id, seq: seq, nodes: g.nodes.slice(), edges: g.edges.slice(), len: u8.length }; PACKSAVE.deltas = 0; }   /* the map as it was when this save began; a change made since is sent as a patch next */
      });
    });
  };
  var go = full;
  if (bs && !NFMLinkCols.pending(g) && bs.nodes.length === g.nodes.length && bs.edges.length === g.edges.length && PACKSAVE.deltas < 20) {
    var cn = changedRows(bs.nodes, g.nodes), ce = cn && changedRows(bs.edges, g.edges);
    if (ce) go = function () {   /* a small patch against the last full save, made on the saving thread: the page sends only the changed rows */
      return savePackCall({ kind: 'delta', baseId: bs.id, meta: undoMeta(g), nodes: cn, links: ce }).then(function (r) {
        if (stale()) throw 0;
        if (r.none || !r.u8) return full();   /* the thread lost its tables (ended, or a newer full save): a full save */
        return SAFE.setDelta('nfm-graph', r.u8, bs.seq).then(function (ok) {
          if (ok === 'stale') throw 0;
          if (!ok) throw 1;
          PACKSAVE.deltas++;
          if (r.u8.length * 4 > bs.len) PACKSAVE.deltas = 99;   /* the patch passed a quarter of the full save: the next one is a full save */
        });
      });
    };
  }
  PACKSAVE.flying = true;
  go().then(function () { return true; }, function (e) { if (e === 0) return false; PACKSAVE.base = null; PACKSAVE.again = false; saveWarn('big'); return false; }).then(function (ok) {
    PACKSAVE.flying = false;
    if (PACKSAVE.again) { PACKSAVE.again = false; if (S.graph !== g || ok) saveBig(); }   /* a change came while this save ran: save it now (as a patch against this one) */
  });
}
/** Saves that are still waiting for their delay are done now when the page is going away or hidden (a reload 600 ms after an edit used to lose it). */
function flushSaves() { SAFE.going(true); try { [saveGraph, saveView, savePrefs, typeof saveAdv === 'function' ? saveAdv : null].forEach(function (f) { if (f && f.flush) f.flush(); }); } finally { SAFE.going(false); } }
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
  if (S.scene && S.L && typeof makeScene === 'function') { if (S.tab === 'map') makeScene(false); else S.themeStale = true; }   /* the picture is only rebuilt when it can be seen; freshTheme() does it when something needs it */
}
/** Builds the picture again in the new light/dark colors if the theme was switched while the Map was hidden. */
function freshTheme() { if (S.themeStale && S.scene && S.L && typeof makeScene === 'function') { S.themeStale = false; makeScene(false); return true; } S.themeStale = false; return false; }
var TABS = ['data', 'nodes', 'map', 'charts', 'check', 'adv', 'export'], TAB_HOOKS = {};
function showTab(name) {
  S.tab = name;
  TABS.forEach(function (t) { $('tab-' + t).hidden = t !== name; $('tabbtn-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false'); });
  if (TAB_HOOKS[name]) TAB_HOOKS[name]();
}

/* ---------------------------------------------------------------- the graph: one place that changes it */
/** The links of every item as two lists of numbers (where each item's links start, and which links they are) instead of a Map of arrays: 84% less memory on a big map, and reading them is quicker. get(id) gives the link objects in the order they were added, each(id, fn) visits them without making a list, has(id) says whether the item has any, count(id) says how many (without making a list). Links that name an item the map does not have are kept in a small side table. */
function makeLinkLists(edges, pos, field, nNodes, pre, ctx) {   /* edges null: the links are still columns (ctx: { nodes, other } with the item numbers at the other end), no link object is read */
  var M = edges ? edges.length : pre.length, off = new Int32Array(nNodes + 1), ord = new Int32Array(M), i, v, loose = null, idx = pre && pre.length === M ? pre : new Int32Array(M);
  if (idx === pre) {   /* the worker already found where each link's end sits (-1: no such item) */
    for (i = 0; i < M; i++) { v = idx[i]; if (v < 0) { if (!loose) loose = new Map(); var key2 = edges[i][field]; if (!loose.has(key2)) loose.set(key2, []); loose.get(key2).push(edges[i]); } else off[v + 1]++; }
  } else
  for (i = 0; i < M; i++) { v = pos.get(edges[i][field]); if (v === undefined) { if (!loose) loose = new Map(); var key = edges[i][field]; if (!loose.has(key)) loose.set(key, []); loose.get(key).push(edges[i]); idx[i] = -1; } else { idx[i] = v; off[v + 1]++; } }
  for (i = 0; i < nNodes; i++) off[i + 1] += off[i];
  var cur = off.slice(0, nNodes), other = field === 'from' ? 'to' : 'from', oth = new Array(M);
  for (i = 0; i < M; i++) if (idx[i] >= 0) { ord[cur[idx[i]]] = i; oth[cur[idx[i]]++] = edges ? edges[i][other] : ctx.nodes[ctx.other[i]].id; }
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
    count: function (id) { var x = pos.get(id); if (x === undefined) return loose && loose.has(id) ? loose.get(id).length : 0; return off[x + 1] - off[x]; },
    /** how many items have no link here, read from the typed list (no name lookups); -1 when two items share a name (then ask has() per item) */
    none: function () { if (pos.size !== nNodes) return -1; var c = 0; for (var j = 0; j < nNodes; j++) if (off[j + 1] === off[j]) c++; return c; }
  };
}
/*
 * The item index (S.byId, the two link lists, the link kinds) was built again from nothing on every change: on a 16 MB table about half a
 * second of the page's time per change. A change made through the app replaces only the objects it changes, so when the items keep their
 * places and names (a rename, a group, an outcome mark) the index is updated for the changed items only, and the link lists are kept when
 * every link keeps its two ends. Anything else (items added, removed or renamed by id, links moved) builds it whole, as before.
 */
var HANDIX = null;   /* { g, fi, ti, kinds }: for each link of graph g, the places of its two ends, and the link kinds, made by the worker that read the file */
var HANDPROF = null;   /* { g, p }: the column profile of graph g, made by the worker that read the file */
var IDX = { g: null, pos: null, ghosts: -1 };   /* ghosts: how many placeholder items the indexed graph has (the Data tab's count) */
/** The slots of list a (now) that differ from list b (before), when both have the same length and few differ; else null. */
function changedSlots(a, b) {
  if (a.length !== b.length) return null;
  var d = NFMUndo.listDiff(a, b), out = [], i;
  if (d.same) return out;
  if (d.at) return d.at;
  if (d.mid.length * 4 > a.length) return null;
  for (i = d.p; i < d.p + d.mid.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}
function indexGraph() {
  var g = S.graph, old = IDX.g, by = null, pos = null, links = false, kindsSame = false, i, k, dn = null, de = null, lc = NFMLinkCols.pending(g);   /* lc: the links are still columns: nothing here may read g.edges */
  if (!lc && old && old !== g && S.byId && IDX.pos && old.nodes && old.edges && g.nodes.length + g.edges.length >= 2000 && typeof NFMUndo !== 'undefined') {
    dn = changedSlots(g.nodes, old.nodes); var ok = !!dn;
    for (i = 0; ok && i < dn.length; i++) { k = dn[i]; ok = g.nodes[k].id === old.nodes[k].id && S.byId.get(old.nodes[k].id) === old.nodes[k]; }
    if (ok) {
      by = S.byId; pos = IDX.pos;
      for (i = 0; i < dn.length; i++) by.set(g.nodes[dn[i]].id, g.nodes[dn[i]]);
      if (IDX.ghosts >= 0) for (i = 0; i < dn.length; i++) IDX.ghosts += (g.nodes[dn[i]].ghost ? 1 : 0) - (old.nodes[dn[i]].ghost ? 1 : 0);
      de = changedSlots(g.edges, old.edges);
      kindsSame = !!de && de.length === 0;
      links = !S.outAdj.loose && !S.inAdj.loose && !!de;
      for (i = 0; links && i < de.length; i++) { k = de[i]; links = g.edges[k].from === old.edges[k].from && g.edges[k].to === old.edges[k].to; }
    }
  }
  if (!by) { var gh = 0; by = new Map(); pos = new Map(); g.nodes.forEach(function (n, j) { by.set(n.id, n); pos.set(n.id, j); if (n.ghost) gh++; }); IDX.ghosts = gh; }
  var hx = HANDIX && HANDIX.g === g ? HANDIX : null; HANDIX = null;   /* link ends and kinds the worker worked out from this very graph */
  if (lc) S.kinds = lc.kinds.filter(function (x) { return x; }).sort();
  else if (!kindsSame) { if (hx) S.kinds = hx.kinds; else { var kinds = new Set(); g.edges.forEach(function (e) { if (e.kind) kinds.add(e.kind); }); S.kinds = Array.from(kinds).sort(); } }
  var wasBy = S.byId; S.byId = by;
  if (lc) { S.outAdj = makeLinkLists(null, pos, 'from', g.nodes.length, lc.fi, { nodes: g.nodes, other: lc.ti }); S.inAdj = makeLinkLists(null, pos, 'to', g.nodes.length, lc.ti, { nodes: g.nodes, other: lc.fi }); }
  else if (!links) { S.outAdj = makeLinkLists(g.edges, pos, 'from', g.nodes.length, hx && hx.fi); S.inAdj = makeLinkLists(g.edges, pos, 'to', g.nodes.length, hx && hx.ti); }
  IDX.g = g; IDX.pos = pos; IDX.why = by === wasBy && old ? (links ? 'quick+links' : 'quick') : (old === g ? 'same' : !old ? 'first' : 'full');
  /* the column profile: worked out for the changed items and links only when nothing is calculated (then S.dg is the graph itself) */
  var dg = NFMColumns.derive(g), prof = null;
  if (by === wasBy && dn && de && dg === g && IDX.dg === old && S.prof) prof = NFMColumns.profileUpdate(S.prof, old, g, dn, de);
  IDX.prof = prof ? 'quick' : 'full';
  if (!prof && HANDPROF && HANDPROF.g === g && dg === g) prof = HANDPROF.p;   /* made by the worker from this very graph (the same code on the same data) */
  HANDPROF = null;
  S.dg = dg; IDX.dg = dg; S.prof = prof || NFMColumns.profile(dg); S.story = dg === g ? NFMColumns.isStoryOf(g, S.prof) : NFMColumns.isStory(g);
}
/** For the checks: true when the index matches one built from nothing, else what differs. */
function indexMatches() {
  var g = S.graph, by = new Map(), pos = new Map(), bad = null;
  g.nodes.forEach(function (n, j) { by.set(n.id, n); pos.set(n.id, j); });
  if (by.size !== S.byId.size) return 'item count';
  by.forEach(function (n, id) { if (!bad && S.byId.get(id) !== n) bad = 'item ' + id; });
  var o = makeLinkLists(g.edges, pos, 'from', g.nodes.length), n2 = makeLinkLists(g.edges, pos, 'to', g.nodes.length);
  var same = function (a, b) { if (!a || !b) return !a === !b; if (a.length !== b.length) return false; for (var q = 0; q < a.length; q++) if (a[q] !== b[q]) return false; return true; };
  by.forEach(function (x, id) { if (!bad && (!same(o.get(id), S.outAdj.get(id)) || !same(n2.get(id), S.inAdj.get(id)))) bad = 'links of ' + id; });
  var kinds = new Set(); g.edges.forEach(function (e) { if (e.kind) kinds.add(e.kind); });
  if (!bad && Array.from(kinds).sort().join('|') !== S.kinds.join('|')) bad = 'kinds';
  var none = S.outAdj.none ? S.outAdj.none() : -1;
  if (!bad && none >= 0 && none !== g.nodes.filter(function (x) { return !S.outAdj.has(x.id); }).length) bad = 'count of items with no way on';
  if (!bad && IDX.g === g && IDX.ghosts >= 0 && IDX.ghosts !== g.nodes.filter(function (x) { return x.ghost; }).length) bad = 'count of placeholders';
  if (!bad && S.story !== NFMColumns.isStory(g)) bad = 'story check';
  var rep = REP.get(S.outAdj);
  if (!bad && rep !== undefined && rep !== NFMColumns.pairsRepeat(g)) bad = 'repeated pairs';
  return bad || true;
}
/** One link of the layout, read without bringing a packed link list back (see src/layout-park.js). */
function edgeOf(i) { var L = S.L; return L.edgeAt ? L.edgeAt(i) : L.edges[i]; }
var HOOKS = { graph: [], view: [] };
/** Replace the whole graph. push=false means: do not remember the old one for Undo. */
function setGraph(g, push, keepView) {
  var rename = (S.graph.name !== g.name);
  if (rename) saveView.flush();   /* the old data's settings are saved under the old name before the name changes */
  if (push !== false) { var st = NFMUndo.step(S.graph, g); S.hist.push(st); if (S.hist.length > 25) S.hist.shift(); if (st.graph) undoPackSoon(st); undoCap(); }   /* a step keeps only what this change replaced (src/undo.js); a whole old map is packed (src/app/75-mapfile.js) */
  S.graph = g; S.gver++;
  if (!keepView || rename) skHist = [];   /* Sankey undo steps belong to one dataset */
  graphChanged(rename && !keepView);
}
/** Change the graph through fn(g), where g holds copies of the two lists; fn must replace objects, not change them in place. */
/*
 * The two copies are made when fn first touches a list: a change to items only (a rename, a group, an outcome mark) keeps the very same
 * link list, so no one copies it or compares it link by link afterwards. On a 16 MB table (563,000 links) copying took 1 ms in Chromium
 * and 11 ms in WebKitGTK, and each comparison 7 ms and 15 ms: Chromium and WebKitGTK read every link object to compare two references.
 */
function edit(fn, push) {
  var src = S.graph, g = { name: src.name, start: src.start, flavor: src.flavor, calc: src.calc, roles: src.roles, states: src.states };
  var plain = function (k, v) { Object.defineProperty(g, k, { value: v, writable: true, enumerable: true, configurable: true }); };
  ['nodes', 'edges'].forEach(function (k) {
    Object.defineProperty(g, k, { enumerable: true, configurable: true, get: function () { var v = src[k].slice(); plain(k, v); return v; }, set: function (v) { plain(k, v); } });
  });
  fn(g);
  /* a plain object again (the graph is read everywhere): an untouched list is the one from before */
  var out = {};
  Object.keys(g).forEach(function (k) { var d = Object.getOwnPropertyDescriptor(g, k); out[k] = d.get ? src[k] : d.value; });
  setGraph(out, push, true);
}
/** After a file is read: repeated texts in the map are pointed at one copy (src/undo.js textSharer), in short slices while the page is idle. */
var shareJob = null;
function shareTextSoon() {
  var g = S.graph; if (!g || !g.nodes || g.nodes.length + (NFMLinkCols.pending(g) ? NFMLinkCols.pending(g).n : g.edges.length) < 2000) return;
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
var undoBusy = false;
function undo() {
  if (!S.hist.length || undoBusy) return;
  var st = S.hist.pop();
  if (st.bytes) {   /* a whole earlier map kept packed: read it back first */
    undoBusy = true; toast('Undoing…', 20000);
    undoUnpack(st).then(function (g) { undoBusy = false; undoTo(g); shareTextSoon(); }, function (err) { undoBusy = false; S.hist.push(st); toast('That step could not be undone (' + (err && err.message || err) + ').'); });
    return;
  }
  undoTo(NFMUndo.back(st, S.graph));
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

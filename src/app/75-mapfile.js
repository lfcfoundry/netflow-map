/*
 * Netflow Map app, part 10: the map file (.json.lfc, LFC-pack). One file holds the items, the links, the states, the view settings and, when the browser kept it, the finished picture of the map, so opening it again skips the layout.
 * Copyright (c) 2026 LFC Foundry. MIT License.
 */
var MAPFILE = { queue: [], ready: null };
function b64of(u8) { var s = '', i; for (i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); }
function bytesOfB64(t) { var s = atob(t), u = new Uint8Array(s.length), i; for (i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
/** Starts the map-file module (kept as text in the page) the first time it is needed. */
function lfcReady() {
  if (MAPFILE.ready) return MAPFILE.ready;
  MAPFILE.ready = Promise.resolve().then(function () {
    if (typeof LfcPack !== 'undefined') return LfcPack.init();
    return lfcSource().then(function (src) {
      var sc = document.createElement('script'); sc.textContent = src; document.head.appendChild(sc); return LfcPack.init();
    });
  }).catch(function (e) { MAPFILE.ready = null; throw e; });
  return MAPFILE.ready;
}
/** The map-file module's text, unpacked from the page once. */
function lfcSource() {
  if (MAPFILE.src) return MAPFILE.src;
  MAPFILE.src = Promise.resolve().then(function () {
    var b = bytesOfB64($('nfm-lfc-src').textContent.trim());
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  });
  MAPFILE.src.catch(function () { MAPFILE.src = null; });
  return MAPFILE.src;
}

/* ---------------------------------------------------------------- Undo of a whole earlier map
   Opening a file keeps the map from before it for Undo, whole (about 70 MB for a 16 MB table in Chromium). It is packed as map-file bytes
   (LFC-pack, about 5 MB) on a thread of its own, made when needed and ended 30 s after its last job, so the page never waits for it.
   Undo reads the bytes back (about half a second for 100,000 items). All of Undo is held to UNDO_CAP: past it the oldest steps go. */
var UNDO_CAP = 16 * 1048576, UNDOPACK = { str: JSON.stringify.bind(JSON), w: null, idle: null, seq: 0, wait: new Map() };
var UNDOPACK_MAIN = '\nself.onmessage=function(e){var d=e.data,fail=function(err){self.postMessage({id:d.id,error:String(err&&err.message||err)});};' +
  /* keep: the layout worker's graph arrives on a port and goes back to the page as map-file bytes; give: bytes in, the graph out on a port to a fresh layout worker */
  'if(d.kind==="keep"){var kp=e.ports[0];kp.onmessage=function(m){kp.close();var g=m.data.graph,meta={},k;for(k in g)if(k!=="nodes"&&k!=="edges"&&g[k]!==undefined)meta[k]=g[k];LfcPack.init().then(function(){return LfcPack.packTables({meta:meta,nodes:g.nodes,links:g.edges});}).then(function(u){self.postMessage({id:d.id,u8:u},[u.buffer]);},fail);};return;}' +
  'if(d.kind==="give"){var gp=e.ports[0];LfcPack.init().then(function(){return LfcPack.unpackTables(d.u8);}).then(function(x){var g={},m=x.meta||{},k;for(k in m)g[k]=m[k];g.nodes=x.nodes;g.edges=x.links;gp.postMessage({graph:g});gp.close();self.postMessage({id:d.id,u8:null});},fail);return;}' +
  'LfcPack.init().then(function(){return LfcPack.packTables(d.text!==undefined?JSON.parse(d.text):d.doc);}).then(function(u){self.postMessage({id:d.id,u8:u},[u.buffer]);},function(err){self.postMessage({id:d.id,error:String(err&&err.message||err)});});};';
function undoMeta(g) { var m = {}; Object.keys(g).forEach(function (k) { if (k !== 'nodes' && k !== 'edges' && g[k] !== undefined) m[k] = g[k]; }); return m; }   /* every other field of the map, as an undo step keeps them (src/undo.js) */
/** The map as text for the packer, in slices of 6,000 with the page free in between (one 90,000-item stringify held the page 136 ms); the same text as stringifying it whole. */
function undoText(g) {
  var n = g.nodes, e = g.edges, Z = 6000, parts = ['{"meta":' + UNDOPACK.str(undoMeta(g)) + ',"nodes":['], i = 0, j = 0;
  var ch = typeof MessageChannel === 'function' ? new MessageChannel() : null;
  var piece = function (a, k) { var t = UNDOPACK.str(a.slice(k, k + Z)); return t.slice(1, -1); };
  return new Promise(function (ok) {
    var step = function () {
      if (i < n.length) { var t = piece(n, i); if (t) parts.push((i ? ',' : '') + t); i += Z; if (i >= n.length) parts.push('],"links":['); }
      else if (j < e.length) { var u = piece(e, j); if (u) parts.push((j ? ',' : '') + u); j += Z; }
      else { parts.push(']}'); if (ch) { ch.port1.onmessage = null; ch.port1.close(); } ok(parts.join('')); return; }
      if (ch) ch.port2.postMessage(0); else setTimeout(step, 0);
    };
    if (!n.length) parts.push('],"links":[');
    if (ch) ch.port1.onmessage = step;
    step();
  });
}
function undoPacker() {
  if (UNDOPACK.w) return Promise.resolve(UNDOPACK.w);
  return lfcSource().then(function (src) {
    if (UNDOPACK.w) return UNDOPACK.w;
    var url = URL.createObjectURL(new Blob([src + UNDOPACK_MAIN], { type: 'text/javascript' })), w = new Worker(url);
    URL.revokeObjectURL(url);
    var failAll = function (why) { UNDOPACK.wait.forEach(function (p) { p.bad(new Error(why)); }); UNDOPACK.wait.clear(); if (UNDOPACK.w === w) UNDOPACK.w = null; try { w.terminate(); } catch (e) { /* gone */ } };
    w.onmessage = function (e) {
      var d = e.data, p = UNDOPACK.wait.get(d.id); if (!p) return; UNDOPACK.wait.delete(d.id);
      if (d.error) p.bad(new Error(d.error)); else p.ok(d.u8);
      if (!UNDOPACK.wait.size) { clearTimeout(UNDOPACK.idle); UNDOPACK.idle = setTimeout(function () { if (!UNDOPACK.wait.size && UNDOPACK.w === w) { UNDOPACK.w = null; w.terminate(); } }, 30000); }
    };
    w.onerror = function (ev) { failAll('the packing thread stopped (' + (ev && ev.message || 'error') + ')'); };
    UNDOPACK.w = w; return w;
  });
}
/* The autosave's packing thread (src/app/00-core.js saveBig): it packs a big map's text in full, and keeps that map's tables so the next
   saves are small patches against it (LfcPack delta saves; the page sends only the rows that changed since). Ended 5 minutes after its last job: its copy of the tables is not free. */
var SAVEPACK = { w: null, idle: null, seq: 0, wait: new Map() };
var SAVEPACK_MAIN = '\nvar BASE=null;self.onmessage=function(e){var d=e.data,fail=function(err){self.postMessage({id:d.id,error:String(err&&err.message||err)});};' +
  'if(d.kind==="full"){BASE=null;var doc;try{doc=JSON.parse(d.text);}catch(x){fail(x);return;}LfcPack.init().then(function(){return LfcPack.packTables(doc);}).then(function(u){BASE={id:d.baseId,u8:u,doc:doc};self.postMessage({id:d.id,u8:u});},fail);return;}' +
  'if(d.kind==="delta"){if(!BASE||BASE.id!==d.baseId){self.postMessage({id:d.id,none:true});return;}var n=BASE.doc.nodes.slice(),l=BASE.doc.links.slice(),dn=[],dl=[],i;for(i=0;i<d.nodes.length;i+=2){n[d.nodes[i]]=d.nodes[i+1];dn.push(d.nodes[i]);}for(i=0;i<d.links.length;i+=2){l[d.links[i]]=d.links[i+1];dl.push(d.links[i]);}' +
  'Promise.resolve().then(function(){return LfcPack.packTables({meta:d.meta,nodes:n,links:l},{base:BASE.u8,dirty:{nodes:dn,links:dl}});}).then(function(u){self.postMessage({id:d.id,u8:u});},fail);return;}' +
  'if(d.kind==="drop"){BASE=null;self.postMessage({id:d.id,u8:null});}};';
function savePacker() {
  if (SAVEPACK.w) return Promise.resolve(SAVEPACK.w);
  return lfcSource().then(function (src) {
    if (SAVEPACK.w) return SAVEPACK.w;
    var url = URL.createObjectURL(new Blob([src + SAVEPACK_MAIN], { type: 'text/javascript' })), w = new Worker(url);
    URL.revokeObjectURL(url);
    var failAll = function (why) { SAVEPACK.wait.forEach(function (p) { p.bad(new Error(why)); }); SAVEPACK.wait.clear(); if (SAVEPACK.w === w) { SAVEPACK.w = null; if (typeof PACKSAVE !== 'undefined') PACKSAVE.base = null; } try { w.terminate(); } catch (e) { /* gone */ } };
    w.onmessage = function (e) { var d = e.data, p = SAVEPACK.wait.get(d.id); if (!p) return; SAVEPACK.wait.delete(d.id); if (d.error) p.bad(new Error(d.error)); else p.ok(d); };
    w.onerror = function (ev) { failAll('the saving thread stopped (' + (ev && ev.message || 'error') + ')'); };
    SAVEPACK.w = w; return w;
  });
}
/** One job for the saving thread: resolves to its answer ({ u8 } or { none: true }). */
function savePackCall(msg) {
  return savePacker().then(function (w) {
    var id = ++SAVEPACK.seq; msg.id = id; clearTimeout(SAVEPACK.idle);
    return new Promise(function (ok, bad) {
      SAVEPACK.wait.set(id, { ok: ok, bad: bad }); w.postMessage(msg);
    }).then(function (r) {
      clearTimeout(SAVEPACK.idle);
      SAVEPACK.idle = setTimeout(function () { if (!SAVEPACK.wait.size && SAVEPACK.w === w) { SAVEPACK.w = null; if (typeof PACKSAVE !== 'undefined') PACKSAVE.base = null; w.terminate(); } }, 300000);
      return r;
    });
  });
}
/** A step that keeps a whole map (a file was opened, or a change replaced most of it): pack it while the page is idle. Small maps stay as they are. */
function undoPackSoon(st) {
  var g = st.graph;
  if (!g || !g.nodes || g.nodes.length + g.edges.length < 20000 || typeof Worker === 'undefined' || typeof DecompressionStream === 'undefined') return;
  st.packing = true;
  var later = typeof requestIdleCallback === 'function' ? function (f) { requestIdleCallback(f, { timeout: 2000 }); } : function (f) { setTimeout(f, 50); };
  new Promise(later).then(function () {
    if (S.hist.indexOf(st) < 0) throw new Error('gone');
    return undoPacker();
  }).then(function (w) {
    var id = ++UNDOPACK.seq;
    clearTimeout(UNDOPACK.idle);
    return undoText(g).then(function (text) { return new Promise(function (ok, bad) { UNDOPACK.wait.set(id, { ok: ok, bad: bad }); w.postMessage({ id: id, text: text }); }); });   /* as text: the page is held about a third as long as with a copy of the objects */
  }).then(function (u8) {
    st.packing = false;
    if (S.hist.indexOf(st) < 0) return;   // undone or dropped meanwhile
    st.bytes = u8; st.graph = null; undoCap();
  }, function () { st.packing = false; undoCap(); });
}
/** The layout worker's keeper (src/engine-client.js park and unpark): while it is parked, its graph is kept here as map-file bytes, packed and unpacked off the page. */
function keeperCall(kind, port, u8, posted) {
  return undoPacker().then(function (w) {
    var id = ++UNDOPACK.seq; clearTimeout(UNDOPACK.idle);
    return new Promise(function (ok, bad) { UNDOPACK.wait.set(id, { ok: ok, bad: bad }); w.postMessage({ id: id, kind: kind, u8: u8 }, u8 ? [port, u8.buffer] : [port]); if (posted) posted(); });
  });
}
var LAYOUT_KEEPER = {
  /* posted(): called once the port has gone to the keeper's thread; the layout worker is asked for its graph only then (see park) */
  keep: function (port, posted) { return keeperCall('keep', port, null, posted).then(function (u8) { if (!u8 || !u8.length) throw new Error('nothing kept'); return u8; }); },
  give: function (u8, port) { return keeperCall('give', port, u8); }
};
function undoUnpack(st) {
  return lfcReady().then(function () { return LfcPack.unpackTables(st.bytes); }).then(function (d) { var g = {}, m = d.meta || {}; Object.keys(m).forEach(function (k) { g[k] = m[k]; }); g.nodes = d.nodes; g.edges = d.links; return g; });
}
/** About what a step holds, in bytes: packed bytes as they are; a map still being packed as what packing usually leaves; a difference by its item count. */
function undoSize(st) {
  if (st.bytes) return st.bytes.length;
  if (st.graph) { var n = (st.graph.nodes || []).length + (st.graph.edges || []).length; return st.packing ? n * 12 : n * 150; }
  return 64 + ((st.nodes && (st.nodes.at ? st.nodes.at.length : st.nodes.mid ? st.nodes.mid.length : 0)) + (st.edges && (st.edges.at ? st.edges.at.length : st.edges.mid ? st.edges.mid.length : 0))) * 100;
}
/** Holds all of Undo to UNDO_CAP: the oldest steps go first; the newest step always stays. */
function undoCap() {
  var tot = 0, i;
  for (i = S.hist.length - 1; i >= 0; i--) { tot += undoSize(S.hist[i]); if (tot > UNDO_CAP && i < S.hist.length - 1) { S.hist.splice(0, i + 1); break; } }
  var u = $('b-undo'); if (u) u.disabled = !S.hist.length;
}
/** The importance answers kept beside a saved picture, as text columns for the map file (null when there are none). */
var IMP_COLS = [['choke', Uint8Array], ['traffic', Float64Array], ['depth', Int32Array], ['idom', Int32Array], ['rpo', Int32Array], ['goal', Int32Array], ['spine', Int32Array]];
function impToText(im) {
  if (!im) return null;
  var o = { n: im.n, startId: im.startId, goalKind: im.goalKind, routesLog10: im.routesLog10, reached: im.reached };
  IMP_COLS.forEach(function (c) { var a = im[c[0]]; if (!(a instanceof c[1])) a = c[1].from(a); o[c[0]] = b64of(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); });
  return o;
}
function impFromText(o) {
  if (!o || typeof o !== 'object') return null;
  try {
    var im = { n: o.n, startId: o.startId, goalKind: o.goalKind, routesLog10: o.routesLog10, reached: o.reached };
    IMP_COLS.forEach(function (c) { if (typeof o[c[0]] !== 'string') throw new Error('x'); var u = bytesOfB64(o[c[0]]); im[c[0]] = new c[1](u.buffer, 0, u.length / c[1].BYTES_PER_ELEMENT); });
    return im;
  } catch (e) { return null; }   /* the answers are worked out again */
}
/** The finished picture of this map from the browser's own storage ({ key, x, y, width, height }), or null when there is none.
 * x and y are lists of whole numbers: a place rounded to the nearest unit (under a tenth of the smallest item) cannot be seen, and whole-number
 * lists pack about a third smaller than the exact places as text (BENCHMARKS section 53). Files saved before this hold the exact places as xy text, still read. */
function mapFileLayout() {
  if (!client.store || !S.graph.nodes.length) return Promise.resolve(null);
  return client.run('layoutKey', engineOpts()).then(function (kr) { var key = kr && kr.L && kr.L.layoutKey; return key ? client.store.get(key) : null; })
    .then(function (rec) {
      if (!rec || !rec.xy) return null;
      var k = rec.xy.length >> 1, x = new Array(k), y = new Array(k);
      for (var i = 0; i < k; i++) { x[i] = Math.round(rec.xy[i * 2]); y[i] = Math.round(rec.xy[i * 2 + 1]); }
      return { key: rec.key, x: x, y: y, width: rec.width, height: rec.height, startId: rec.startId, imp: impToText(rec.imp) };
    }, function () { return null; });
}
/** The saved places of a map file's layout as typed numbers (x then y for every item), from either kind of file, or null. */
function layoutXY(L) {
  if (typeof L.xy === 'string') return new Float64Array(bytesOfB64(L.xy).buffer);
  if (!Array.isArray(L.x) || !Array.isArray(L.y) || L.x.length !== L.y.length) return null;
  var xy = new Float64Array(L.x.length * 2);
  for (var i = 0; i < L.x.length; i++) { xy[i * 2] = +L.x[i]; xy[i * 2 + 1] = +L.y[i]; }
  return xy;
}
/** The map as file bytes: resolves to a Uint8Array. */
function mapFileBytes() {
  return Promise.all([lfcReady(), mapFileLayout()]).then(function (r) {
    var g = S.graph, doc = { format: 'netflow-map', version: 1, name: g.name, start: g.start, flavor: g.flavor, calc: g.calc, roles: g.roles, states: g.states, nodes: g.nodes, links: g.edges, view: S.V };
    if (r[1]) doc.layout = r[1];
    return LfcPack.packTables(doc);
  });
}
function saveMapFile() {
  if (!S.graph.nodes.length) return Promise.resolve();
  toast('Saving the map file…', 2000);
  var t0 = performance.now();
  return nextFrame().then(mapFileBytes).then(function (bytes) {
    download(fname('.json.lfc'), new Blob([bytes], { type: 'application/octet-stream' }));
    MAPFILE.last = 'Last map file: ' + plural(S.graph.nodes.length, 'item') + ', ' + (bytes.length / 1048576 < 0.1 ? Math.round(bytes.length / 1024) + ' KB' : (bytes.length / 1048576).toFixed(1) + ' MB') + ', saved in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s.';
    toast('Saved ' + plural(S.graph.nodes.length, 'item') + ' and ' + plural(S.graph.edges.length, 'link') + ' in ' + (bytes.length / 1048576 < 0.1 ? Math.round(bytes.length / 1024) + ' KB' : (bytes.length / 1048576).toFixed(1) + ' MB') + ' (' + ((performance.now() - t0) / 1000).toFixed(1) + ' s).', 5000);
  }, function (err) { toast('The map file could not be made: ' + (err && err.message || err), 8000); });
}
/** Puts a map file back: the data, the view, and the saved picture when there is one. Resolves when the map is loaded. */
function openMapBytes(u8) {
  var t0 = performance.now(), tU;
  return lfcReady().then(function () { var t1 = performance.now(); var d = LfcPack.unpackTables(u8); return Promise.resolve(d).then(function (x) { tU = performance.now() - t1; return x; }); }).then(function (doc) {
    if (!doc || doc.format !== 'netflow-map' || !Array.isArray(doc.nodes) || !Array.isArray(doc.links)) throw new Error('this is not a Netflow Map file');
    var g = NFMImport.sanitizeGraph({ name: doc.name, start: doc.start, flavor: doc.flavor, calc: doc.calc, roles: doc.roles, states: doc.states, nodes: doc.nodes, edges: doc.links });
    if (doc.view && typeof doc.view === 'object') SAFE.set('nfm-v:' + g.name, JSON.stringify(doc.view)); else SAFE.del('nfm-v:' + g.name);
    var L = doc.layout, LX = L && L.key ? layoutXY(L) : null, put = LX && client.store ? client.store.put(L.key, { key: L.key, xy: LX, width: L.width, height: L.height, rough: false, startId: L.startId, imp: impFromText(L.imp) }).catch(function () { /* the layout is worked out again */ }) : Promise.resolve();
    return put.then(function () {
      S.imp = { files: null, opts: {}, base: null, mode: 'replace', res: { graph: g, report: { notes: ['Opened from a map file' + (L ? ' (with its saved picture)' : '') + ' in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s (unpacking the file ' + Math.round(tU) + ' ms).'] } }, name: g.name };
      setGraph(g, true, false);
    });
  });
}
function openMapFile(file) {
  busy('Opening ' + file.name + '…');
  return asBytes(file).then(openMapBytes).catch(function (err) { renderError('The map file ' + file.name + ' could not be opened: ' + (err && err.message || err) + '.'); });
}

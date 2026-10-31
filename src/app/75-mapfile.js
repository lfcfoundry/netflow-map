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
    var b = bytesOfB64($('nfm-lfc-src').textContent.trim());
    return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text().then(function (src) {
      var sc = document.createElement('script'); sc.textContent = src; document.head.appendChild(sc); return LfcPack.init();
    });
  }).catch(function (e) { MAPFILE.ready = null; throw e; });
  return MAPFILE.ready;
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
    if (doc.view && typeof doc.view === 'object') LS.set('nfm-v:' + g.name, JSON.stringify(doc.view)); else LS.del('nfm-v:' + g.name);
    var L = doc.layout, LX = L && L.key ? layoutXY(L) : null, put = LX && client.store ? client.store.put(L.key, { key: L.key, xy: LX, width: L.width, height: L.height, rough: false, startId: L.startId, imp: impFromText(L.imp) }).catch(function () { /* the layout is worked out again */ }) : Promise.resolve();
    return put.then(function () {
      S.imp = { files: null, opts: {}, base: S.graph, mode: 'replace', res: { graph: g, report: { notes: ['Opened from a map file' + (L ? ' (with its saved picture)' : '') + ' in ' + ((performance.now() - t0) / 1000).toFixed(2) + ' s (unpacking the file ' + Math.round(tU) + ' ms).'] } }, name: g.name };
      setGraph(g, true, false);
    });
  });
}
function openMapFile(file) {
  busy('Opening ' + file.name + '…');
  return asBytes(file).then(openMapBytes).catch(function (err) { renderError('The map file ' + file.name + ' could not be opened: ' + (err && err.message || err) + '.'); });
}

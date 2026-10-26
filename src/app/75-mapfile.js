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
/** The finished picture of this map from the browser's own storage ({ key, xy, width, height } with xy as text), or null when there is none. */
function mapFileLayout() {
  if (!client.store || !S.graph.nodes.length) return Promise.resolve(null);
  return client.run('layoutKey', engineOpts()).then(function (kr) { var key = kr && kr.L && kr.L.layoutKey; return key ? client.store.get(key) : null; })
    .then(function (rec) { return rec && rec.xy ? { key: rec.key, xy: b64of(new Uint8Array(rec.xy.buffer, rec.xy.byteOffset, rec.xy.byteLength)), width: rec.width, height: rec.height } : null; }, function () { return null; });
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
    var L = doc.layout, put = L && client.store && typeof L.xy === 'string' && L.key ? client.store.put(L.key, { key: L.key, xy: new Float64Array(bytesOfB64(L.xy).buffer), width: L.width, height: L.height, rough: false }).catch(function () { /* the layout is worked out again */ }) : Promise.resolve();
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

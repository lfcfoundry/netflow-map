// Copyright (c) 2026 LFC Foundry. MIT License. Cuts the Netflow Map engine (src/engine.js + src/columns.js) into the standalone JS-modules file netflow-engine.js.
// Run: node tools/build-engine-module.mjs <version> <out.js>      e.g. node tools/build-engine-module.mjs 1.0.0 /tmp/netflow-engine.js
// Only three things differ from the app's engine: the file is one UMD wrapper, the layered-drawing module (netflow-layers) and the Sankey add-on (netflow-sankey) are looked up when first needed (or handed over with use()), and status() exists. Every layout is the app's, bit for bit (tools/check-engine-module.mjs proves it).
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), rd = (p) => readFileSync(join(root, p), 'utf8');
const version = process.argv[2], out = process.argv[3];
if (!/^\d+\.\d+\.\d+$/.test(version || '') || !out) { console.error('usage: node tools/build-engine-module.mjs X.Y.Z out.js'); process.exit(1); }
const api = +version.split('.')[0];
let eng = rd('src/engine.js'), col = rd('src/columns.js');
const swap = (s, a, b) => { if (s.split(a).length !== 2) throw new Error('expected exactly one of: ' + a.slice(0, 70)); return s.replace(a, () => b); };
const strip = (s) => s.replace(/^\/\*![\s\S]*?\*\/\n/, '').replace(/\nif \(typeof module !== 'undefined' && module\.exports\) module\.exports = \w+;\n?$/, '\n');
col = strip(col); eng = strip(eng);
eng = swap(eng, "var C = typeof NFMColumns !== 'undefined' ? NFMColumns : require('./columns.js');", 'var C = NFMColumns;');
eng = swap(eng, "var SK = typeof NFMSankey !== 'undefined' ? NFMSankey : (typeof require === 'function' ? require('./sankey.js') : null);", 'var SK = null;   // the Sankey add-on (netflow-sankey): handed over with use(\'sankey\', impl); without it the River view keeps the plain layered picture');
eng = swap(eng, "var NL = typeof NetflowLayers !== 'undefined' ? NetflowLayers : require('../vendor/netflow-layers.js');\n  var mapPlaceLine = NL.mapPlaceLine, mapCrossPairs = NL.mapCrossPairs, layered = NL.layered;",
`var NL = null;   // the layered-drawing add-on (netflow-layers): found on first use, or handed over with use('layers', impl)
  function layersOf() {
    if (NL) return NL;
    if (typeof NetflowLayers !== 'undefined') NL = NetflowLayers;
    else if (REQ) { try { NL = REQ('../netflow-layers/netflow-layers.js'); } catch (e) { NL = null; } }
    if (!NL) throw new Error('netflow-engine: the layered views need netflow-layers 1.2.0 or newer (load it first, or call NetflowEngine.use("layers", NetflowLayers))');
    return NL;
  }
  function mapPlaceLine() { return layersOf().mapPlaceLine.apply(null, arguments); }
  function mapCrossPairs() { return layersOf().mapCrossPairs.apply(null, arguments); }
  function layered() { return layersOf().layered.apply(null, arguments); }`);
// the add-on hand-over lives inside the engine's closure, next to the two variables it sets
eng = swap(eng, '  return {\n    MAP_W: MAP_W,', `  /** Hand an add-on to the engine: 'layers' (netflow-layers) or 'sankey' (netflow-sankey). Optional: both are also found on their own when loaded as page scripts (or, for layers, as the Node file next to this one). */
  function use(name, impl) {
    if (name === 'layers') NL = impl; else if (name === 'sankey') SK = impl; else throw new Error('netflow-engine: use() knows "layers" and "sankey", not "' + name + '"');
    return API;
  }
  var API = {
    MAP_W: MAP_W,`);
eng = swap(eng, 'mapPlaceLine: mapPlaceLine, autoStart: autoStart\n  };', 'mapPlaceLine: mapPlaceLine, autoStart: autoStart, use: use, columns: C\n  };\n  return API;');
const head = `/*!
 * netflow-engine.js: the engine of Netflow Map as a module you can adapt: reads links, lays the map out (layered rows, arcs, matrix, shapes, force, distances), and scores it. No page, no DOM; runs on the main thread or in a worker.
 * Part of JS-modules, https://github.com/lfcfoundry/JS-modules
 * Copyright (c) 2026 LFC Foundry. MIT License (see LICENSE at the repository root).
 * Version ${version} (API ${api})
 *
 *   var L = NetflowEngine.build({ nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b' }] }, { view: 'network', colorBy: 'group' });   // L.nodes, L.edges: positions and sizes, ready to draw
 *   NetflowEngine.use('layers', NetflowLayers);      // optional: hand over the add-ons (they are also found on their own)
 *   NetflowEngine.use('sankey', NetflowSankey);
 */
`;
const body = `(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(function (n) { return require(n); });
  else root.NetflowEngine = factory(null);
}(typeof self !== 'undefined' ? self : this, function (REQ) {
  'use strict';
  var VERSION = '${version}';
${col.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}
${eng.split('\n').map((l) => (l ? '  ' + l : l)).join('\n')}
  var E = NFMEngine;
  E.version = VERSION; E.api = ${api};
  E.status = function () { return { placeholder: false, version: VERSION, api: ${api}, message: 'netflow-engine ' + VERSION }; };
  return E;
}));
`;
writeFileSync(out, head + '\n' + body);
console.log('wrote', out, Math.round((head.length + body.length) / 1024), 'KB');

/* Copyright (c) 2026 LFC Foundry. MIT License. Does a newer vendored netflow-layers draw exactly what the older one drew? Runs the app's own engine with each version over random maps (three kinds, several sizes and seeds), every layered view (Flow, Down, Spine, Lanes) and the layout options (story order, tags, bundled links, wide spacing, folded chapters), and compares a digest of each whole layout. A pass/fail gate, so it is run in Node (no speed numbers come from it).
 *   node bench/layers-same.js [old.js] [new.js]      (defaults: /tmp/nl-130.js and vendor/netflow-layers.js) */
'use strict';
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const text = (p) => fs.readFileSync(p, 'utf8'), strip = (t) => t.replace(/if \(typeof module[^\n]*\n?/, '');
function load(layersFile) {
  const g = {}, ev = (code) => new Function('globalThis', code + '\n;return globalThis;')(g);
  ev(text(layersFile)); ev(strip(text(path.join(root, 'src/columns.js'))) + '\n;globalThis.NFMColumns = typeof NFMColumns !== "undefined" ? NFMColumns : globalThis.NFMColumns;');
  ev(strip(text(path.join(root, 'bench/gen.js'))) + '\n;globalThis.NFMGen = NFMGen;');
  ev(strip(text(path.join(root, 'src/engine.js'))).replace(/var C = typeof NFMColumns[^\n]*\n/, 'var C = globalThis.NFMColumns;\n') + '\n;globalThis.NFMEngine = NFMEngine;');
  return g;
}
const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
const dig = (X) => fnv(JSON.stringify(X, (k, v) => (k === 'ms' ? undefined : ArrayBuffer.isView(v) ? Array.from(v) : v)));
const A = load(process.argv[2] || '/tmp/nl-130.js'), B = load(process.argv[3] || path.join(root, 'vendor/netflow-layers.js'));
const OPTS = [{}, { rows: 'story' }, { tagLen: 4 }, { bundle: true }, { better: true }, { spread: 'wide' }, { chapters: 40 }, { rows: 'story', tagLen: 6, bundle: true, spread: 'wide' }];
let runs = 0, bad = 0, errs = 0;
for (const view of ['flow', 'down', 'spine', 'lanes']) for (const kind of ['simple', 'moderate', 'complex']) for (const n of [40, 220, 900]) for (const seed of [3, 11]) for (const o of OPTS) {
  const one = (g) => { try { return dig(g.NFMEngine.build(g.NFMColumns.derive(JSON.parse(JSON.stringify(g.NFMGen.graph(kind, n, seed)))), Object.assign({ view }, o))); } catch (e) { return 'ERR:' + e.message.slice(0, 60); } };
  const a = one(A), b = one(B); runs++; if (a !== b) { bad++; console.log('DIFFERENT', view, kind, n, seed, JSON.stringify(o), a, b); } else if (a.indexOf('ERR:') === 0) errs++;
}
console.log(runs + ' layouts compared, ' + bad + ' different (' + errs + ' too big for both and refused alike)');
process.exit(bad ? 1 : 0);

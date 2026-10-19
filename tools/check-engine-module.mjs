// Copyright (c) 2026 LFC Foundry. MIT License. Proves the cut-out engine module lays everything out exactly as src/engine.js does: same views, same options, same bytes.
// Run: node tools/build-engine-module.mjs 1.0.0 /tmp/netflow-engine.js && node tools/check-engine-module.mjs /tmp/netflow-engine.js     (a pass/fail gate; Node is not used for speed numbers)
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url), root = join(dirname(fileURLToPath(import.meta.url)), '..');
const App = require(join(root, 'src/engine.js')), Mod = require(resolve(process.argv[2])), NL = require(join(root, 'vendor/netflow-layers.js')), SK = require(join(root, 'vendor/netflow-sankey.js'));
Mod.use('layers', NL).use('sankey', SK);
const rng = (seed) => { let s = seed | 0; return () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
function story(n, seed) { const r = rng(seed), nodes = [], edges = []; for (let i = 0; i < n; i++) nodes.push({ id: 'n' + i, label: 'Page ' + i, group: ['A', 'B', 'C'][i % 3], valence: i === n - 1 ? 'good' : i === n - 2 ? 'bad' : '', ghost: false, attrs: {} }); for (let i = 1; i < n; i++) { edges.push({ from: 'n' + Math.floor(r() * i), to: 'n' + i, label: '', kind: '', attrs: {} }); if (r() < 0.5) edges.push({ from: 'n' + Math.floor(r() * n), to: 'n' + Math.floor(r() * n), label: '', kind: '', attrs: {} }); } return { start: 'n0', nodes, edges: edges.filter((e) => e.from !== e.to) }; }
function net(n, seed) { const r = rng(seed), g = story(n, seed); g.start = null; g.edges.forEach((e) => { e.weight = Math.round(r() * 1000) / 10; }); return g; }
const graphs = [['story 40', story(40, 1)], ['story 300', story(300, 2)], ['story 900', story(900, 3)], ['network 150', net(150, 4)], ['network 1500', net(1500, 5)]];
const views = App.VIEWS.map((v) => v[0]), opts = [{}, { colorBy: 'group' }, { arrange: 'stress' }, { arrange: 'force' }, { arrange: 'closeness' }, { arrange: 'stress3d' }, { arrange: 'force3d' }];
/* the only thing that may differ between two runs is the clock: L.ms (milliseconds the build took) is left out */
const digest = (L) => createHash('sha256').update(JSON.stringify(L, (k, v) => (k === 'ms' ? undefined : ArrayBuffer.isView(v) ? Array.from(v) : v))).digest('hex');
let n = 0, bad = 0, errs = 0;
for (const [name, g] of graphs) for (const view of views) for (const o of opts) {
  const a = Object.assign({ view }, o); let da, dm;
  try { da = digest(App.build(JSON.parse(JSON.stringify(g)), a)); } catch (e) { da = 'error: ' + e.message; }
  try { dm = digest(Mod.build(JSON.parse(JSON.stringify(g)), a)); } catch (e) { dm = 'error: ' + e.message; }
  n++; if (/^error/.test(da)) errs++;
  if (da !== dm) { bad++; if (bad < 6) console.log('DIFFERENT', name, JSON.stringify(a), da.slice(0, 60), dm.slice(0, 60)); }
}
const exportsApp = Object.keys(App).sort(), exportsMod = Object.keys(Mod).filter((k) => !['use', 'columns', 'version', 'api', 'status'].includes(k)).sort();
if (exportsApp.join() !== exportsMod.join()) { bad++; console.log('exports differ', exportsApp.filter((k) => !exportsMod.includes(k)), exportsMod.filter((k) => !exportsApp.includes(k))); }
console.log(n + ' builds (' + graphs.length + ' maps x ' + views.length + ' views x ' + opts.length + ' option sets), ' + bad + ' differences, ' + errs + ' builds that error the same way in both');
process.exit(bad ? 1 : 0);

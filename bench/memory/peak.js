// Copyright (c) 2026 LFC Foundry. MIT License.
// Netflow Map: memory at each step of making a 3D network picture, in a fresh process (Node 22).
// Run:  node --expose-gc bench/memory/peak.js 30000     (one process per size, so the "peak so far" numbers are not mixed)
// "live" = JS heap in use after a full collection; "peak so far" = the process's highest memory use up to that step (resident set, from the operating system).
const PATH = require('path'), R = PATH.resolve(__dirname, '..', '..') + '/';
global.NFMColumns = require(R + 'src/columns.js'); const E = require(R + 'src/engine.js'); global.NFMEngine = E; const SC = require(R + 'vendor/netflow-scene.js', 'src/scene-alias.js'), GEN = require(R + 'bench/gen.js'), C = global.NFMColumns;
const N = Number(process.argv[2]) || 100000, MB = (b) => (b / 1048576).toFixed(0).padStart(5);
const rows = [], step = (name, ms) => { global.gc(); global.gc(); const m = process.memoryUsage(); rows.push([name, MB(m.heapUsed), MB(m.arrayBuffers), MB(process.resourceUsage().maxRSS * 1024), ms === undefined ? '' : (ms / 1000).toFixed(1) + ' s']); };
const time = (f) => { const t = Date.now(), r = f(); return [r, Date.now() - t]; };
step('start');
let g = GEN.graph('moderate', N, 11), dg = C.derive(JSON.parse(JSON.stringify(g))); g = null; step('graph read and columns made');
let [L, t1] = time(() => E.build(dg, { view: 'network', arrange: 'sphere', colorBy: 'group' })); step('layout built (sphere)', t1);
const opts = () => ({ plan: {}, rig: false, colorBy: 'group', theme: 'light', cam: { yaw: .6, pitch: .35, persp: 2.4 } });
let [S1, t2] = time(() => SC.make(L, opts())); step('first picture (scene)', t2);
let [S2, t3] = time(() => SC.make(L, opts())); step('second picture while the first is kept', t3);
S1 = null; step('first picture let go');
S2 = null; step('both pictures let go (layout and graph kept)');
L = null; step('layout let go (graph kept)');
console.log(`items ${N}, Node ${process.version}\n${'step'.padEnd(46)} live heap  typed arrays  peak so far  time`);
rows.forEach((r) => console.log(r[0].padEnd(46) + r[1] + ' MB ' + r[2] + ' MB ' + r[3] + ' MB   ' + r[4]));

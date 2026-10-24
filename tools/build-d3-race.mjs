// Builds the one-file D3 race page: node tools/build-d3-race.mjs  ->  bench/netflow-map-d3-race.html
// Needs the D3 pieces (npm install in bench/, or set NFM_D3_FROM to a folder that has node_modules with d3-force, d3-sankey, d3-selection)
// and esbuild (NFM_ESBUILD_FROM). Copyright (c) 2026 LFC Foundry. MIT License.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
const g = (t) => parts.find((p) => p.type === t).value;
const version = process.env.NFM_VERSION || `${g('year')}.${+g('month')}.${+g('day')}.${g('hour')}${g('minute')}`;
const clean = (s) => s.replace(/if \(typeof module !== 'undefined' && module\.exports\) module\.exports = \w+;\n?/g, '');
let esb = null;
for (const where of [root, process.env.NFM_ESBUILD_FROM, '/opt/npm-tools'].filter(Boolean)) { try { esb = createRequire(join(where, 'x.js'))('esbuild'); break; } catch (e) { /* try the next place */ } }
if (!esb) throw new Error('esbuild not found: set NFM_ESBUILD_FROM to a folder that has node_modules/esbuild.');
const d3from = [process.env.NFM_D3_FROM, join(root, 'bench')].filter(Boolean).map((p) => join(p, 'node_modules')).find((p) => existsSync(join(p, 'd3-force')));
if (!d3from) throw new Error('D3 pieces not found: run npm install in bench/ or set NFM_D3_FROM.');
const bundle = esb.buildSync({ entryPoints: [join(root, 'bench/d3race/d3-entry.js')], bundle: true, minify: true, format: 'iife', globalName: 'D3R', platform: 'browser', write: false, nodePaths: [d3from], legalComments: 'none' }).outputFiles[0].text;
const used = ['d3-force', 'd3-sankey', 'd3-selection', 'd3-array', 'd3-shape', 'd3-path', 'd3-quadtree', 'd3-dispatch', 'd3-timer', 'internmap'];
const licenses = used.map((p) => `${p} ${JSON.parse(readFileSync(join(d3from, p, 'package.json'), 'utf8')).version}\n${readFileSync(join(d3from, p, 'LICENSE'), 'utf8').trim()}`).join('\n\n----\n\n');
const files = ['src/columns.js', 'vendor/netflow-layers.js', 'src/engine.js', 'bench/gen.js', 'vendor/netflow-scene.js', 'src/scene-alias.js', 'src/render.js', 'src/probe.js', 'bench/d3race/race.js'];
const code = [`/* ---- D3 pieces (d3-force, d3-sankey, d3-selection and what they need); licenses at the bottom of the page ---- */\n${bundle}`].concat(files.map((f) => { const s = clean(rd(f)).replace(/__VERSION__/g, version); if (/<\/script|<!--/i.test(s)) throw new Error(f + ' contains a sequence that would break the page'); return `/* ---- ${f} ---- */\n${s}`; })).join('\n');
if (/<\/script|<!--/i.test(bundle)) throw new Error('the D3 bundle contains a sequence that would break the page');
const html = rd('bench/d3race/template.html').replace(/__VERSION__/g, version).replace('__LICENSES__', () => licenses.replace(/&/g, '&amp;').replace(/</g, '&lt;')).replace('__SCRIPTS__', () => code);
writeFileSync(join(root, 'bench/netflow-map-d3-race.html'), html);
console.log(`built bench/netflow-map-d3-race.html ${(html.length / 1024) | 0} KB, version ${version}`);

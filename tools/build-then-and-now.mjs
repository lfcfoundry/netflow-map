// Builds the one-file comparison page: node tools/build-then-and-now.mjs  ->  bench/netflow-map-then-and-now.html
// Copyright (c) 2026 LFC Foundry. MIT License.
// Puts the first release's engine and scene (bench/then-and-now/first-release/, commit 48df84a) next to the current ones and times them one after the other in workers.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
let esb = null;
for (const where of [root, process.env.NFM_ESBUILD_FROM, '/opt/npm-tools'].filter(Boolean)) { try { esb = createRequire(join(where, 'x.js'))('esbuild'); break; } catch (e) { /* try the next place */ } }
const min = (code, name) => esb ? esb.transformSync(code, { minify: true, target: 'es2020', legalComments: 'none', sourcefile: name }).code : code;
const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
const g = (t) => parts.find((p) => p.type === t).value;
const version = process.env.NFM_VERSION || `${g('year')}.${+g('month')}.${+g('day')}.${g('hour')}${g('minute')}`;
const clean = (s) => s.replace(/if \(typeof module !== 'undefined' && module\.exports\) module\.exports = \w+;\n?/g, '');
const bundle = (files, name) => min(files.map((p) => clean(rd(p))).join('\n'), name);
const ok = (name, s) => { if (/<\/script|<!--/i.test(s)) throw new Error(name + ' contains a sequence that would break the page'); return s; };
const oldEngine = ok('old engine', bundle(['bench/then-and-now/first-release/engine.js'], 'old-engine'));
const oldScene = ok('old scene', bundle(['bench/then-and-now/first-release/scene.js'], 'old-scene'));
const newEngine = ok('new engine', bundle(['src/columns.js', 'src/pack.js', 'vendor/netflow-sankey.js', 'vendor/netflow-layers.js', 'src/engine.js'], 'new-engine'));
const mc = ok('memory-compression', min("self.MEMORY_COMPRESSION_NO_EVAL = true;\n" + clean(rd('vendor/memory-compression.js')), 'memory-compression'));
const newScene = ok('new scene', bundle(['src/scene.js'], 'new-scene'));
/* Each version's drawing code runs on the page inside its own function, so the two versions' NFMScene / NFMRender / NFMProbe never meet (the page allows no eval and no frames). */
const mainSide = (files, tail, name) => ok(name, min('(function () {\n' + files.map((p) => clean(rd(p))).join('\n') + '\n' + tail + '\n})();', name));
const oldMain = mainSide(['bench/then-and-now/first-release/scene.js', 'bench/then-and-now/first-release/render.js', 'bench/then-and-now/first-release/probe.js'], 'window.NFMV_old = { Pack: null, Scene: NFMScene, Render: NFMRender, Probe: NFMProbe };', 'old drawing code');
const newMain = mainSide(['src/pack.js', 'src/scene.js', 'src/render.js', 'src/probe.js'], 'window.NFMV_new = { Pack: NFMPack, Scene: NFMScene, Render: NFMRender, Probe: NFMProbe };', 'new drawing code');
const examples = ok('examples', clean(rd('src/examples.js')));
const staticHtml = existsSync(join(root, 'bench/then-and-now/static.html')) ? rd('bench/then-and-now/static.html') : '<p class="mut">(not filled in yet)</p>';
let html = rd('bench/then-and-now/template.html');
const put = (k, v) => { html = html.split(k).join(v); };
html = html.replace('__OLD_ENGINE__', () => oldEngine).replace('__OLD_SCENE__', () => oldScene).replace('__NEW_ENGINE__', () => newEngine).replace('__NEW_SCENE__', () => newScene).replace('__MC__', () => mc).replace('__OLD_MAIN__', () => oldMain).replace('__NEW_MAIN__', () => newMain).replace('__EXAMPLES__', () => examples).replace('__STATIC__', () => staticHtml);
put('__VERSION__', version);
writeFileSync(join(root, 'bench/netflow-map-then-and-now.html'), html);
console.log(`built bench/netflow-map-then-and-now.html ${(html.length / 1024) | 0} KB, version ${version}`);

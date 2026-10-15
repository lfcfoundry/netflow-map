// Builds the one-file app: node tools/build.mjs  ->  index.html
// Copyright (c) 2026 JNFoo. MIT License.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
/* Smaller file by default (esbuild minify, top-level names kept so the page and the helper share the same globals).
   node tools/build.mjs --dev  keeps the readable text.   node tools/build.mjs --pack  also writes index.html.xz (LZMA) for local copies. */
let esb = null;
if (!args.has('--dev')) {
  for (const where of [root, process.env.NFM_ESBUILD_FROM, '/opt/npm-tools'].filter(Boolean)) { try { esb = createRequire(join(where, 'x.js'))('esbuild'); break; } catch (e) { /* try the next place */ } }
  if (!esb) console.warn('esbuild not found: building the readable (larger) file. Set NFM_ESBUILD_FROM to a folder that has node_modules/esbuild.');
}
const jsMin = (code, name) => esb ? esb.transformSync(code, { minify: true, target: 'es2020', legalComments: 'inline', sourcefile: name }).code : code;
const cssMin = (code) => esb ? esb.transformSync(code, { loader: 'css', minify: true, legalComments: 'inline' }).code : code;
const rd = (p) => readFileSync(join(root, p), 'utf8');
const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
const g = (t) => parts.find((p) => p.type === t).value;
const version = process.env.NFM_VERSION || `${g('year')}.${+g('month')}.${+g('day')}.${g('hour')}${g('minute')}`;
const order = ['vendor/env-probes.js', 'vendor/back-close.js', 'src/importers.js', 'src/scene.js', 'src/gif.js', 'src/render.js', 'src/probe.js', 'src/engine-client.js', 'src/examples.js'];
const clean = (s) => s.replace(/if \(typeof module !== 'undefined' && module\.exports\) module\.exports = \w+;\n?/g, '');
const bad = (name, s) => { if (/<\/script|<!--/i.test(s)) throw new Error(name + ' contains a sequence that would break the page'); };
const engine = jsMin(['src/columns.js', 'src/engine.js', 'src/sim.js', 'src/check.js'].map((p) => clean(rd(p))).join('\n'), 'engine'); bad('engine bundle', engine);
const appParts = readdirSync(join(root, 'src/app')).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/app/' + f);
const appText = "/* ---- Net Flow Map app (src/app/*.js, one function) ---- */\n(function () {\n'use strict';\n" + appParts.map((p) => { const s = rd(p); bad(p, s); return `/* ---- ${p} ---- */\n` + s; }).join('\n') + '\n})();';
const scripts = jsMin(order.map((p) => { const s = clean(rd(p)); bad(p, s); return `/* ---- ${p} ---- */\n` + s; }).join('\n') + '\n' + appText, 'app'); bad('app bundle', scripts);
const css = cssMin(rd('src/app.css')); bad('app.css', css);
let html = rd('src/index.template.html');
const fill = (k, v) => { html = html.split(k).join(v); };
// order matters: the big pieces go in last so their text is never searched for placeholders
html = html.replace('@@CSS@@', () => css).replace('@@ENGINE@@', () => engine).replace('@@SCRIPTS@@', () => scripts);
fill('@@VERSION@@', version);
writeFileSync(join(root, 'index.html'), html);
if (args.has('--pack')) {
  try { execFileSync('xz', ['-9e', '-k', '-f', join(root, 'index.html')]); console.log('wrote index.html.xz (LZMA, for local copies; the browser needs the plain .html)'); } catch (e) { console.warn('xz not available: skipped index.html.xz'); }
}
console.log(`built index.html ${(html.length / 1024).toFixed(0)} KB, version ${version}`);

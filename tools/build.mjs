// Builds the one-file app: node tools/build.mjs  ->  index.html
// Copyright (c) 2026 LFC Foundry. MIT License.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
/* Smaller file by default (esbuild minify, top-level names kept so the page and the helper share the same globals).
   node tools/build.mjs --dev  keeps the readable text.   node tools/build.mjs --pack  also writes index.fast.html (self-unpacking, deflate, opens fastest) and index.packed.html (LZMA, the smallest file) for local copies; add --tune for the smallest. */
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
const order = ['vendor/field-report.js', 'src/field-report-start.js', 'vendor/env-probes.js', 'vendor/back-close.js', 'vendor/tab-guard.js', 'src/importers.js', 'src/unpack.js', 'src/pack.js', 'vendor/memory-compression.js', 'src/layout-park.js', 'vendor/netflow-scene.js', 'src/scene-alias.js', 'vendor/netflow-sankey.js', 'src/look.js', 'src/gif.js', 'src/render.js', 'src/probe.js', 'src/layoutstore.js', 'src/engine-client.js', 'src/gpustress.js', 'src/tune.js', 'src/examples.js'];
const clean = (s) => s.replace(/if \(typeof module !== 'undefined' && module\.exports\) module\.exports = \w+;\n?/g, '');
const bad = (name, s) => { if (/<\/script|<!--/i.test(s)) throw new Error(name + ' contains a sequence that would break the page'); };
const engine = jsMin(['src/columns.js', 'src/pack.js', 'vendor/netflow-sankey.js', 'vendor/netflow-layers.js', 'src/engine.js', 'src/sim.js', 'src/check.js'].map((p) => clean(rd(p))).join('\n'), 'engine'); bad('engine bundle', engine);
const appParts = readdirSync(join(root, 'src/app')).filter((f) => f.endsWith('.js')).sort().map((f) => 'src/app/' + f);
const appText = "/* ---- Netflow Map app (src/app/*.js, one function) ---- */\n(function () {\n'use strict';\n" + appParts.map((p) => { const s = rd(p); bad(p, s); return `/* ---- ${p} ---- */\n` + s; }).join('\n') + '\n})();';
/* The page allows no eval (only 'wasm-unsafe-eval'). memory-compression 2.0.2 and later skip their `new Function` probe, and so logs no blocked-eval error, when this switch is set before the file loads. */
const noEval = (p, s) => p === 'vendor/memory-compression.js' ? "self.MEMORY_COMPRESSION_NO_EVAL = true;\n" + s : s;
/* field-report's header comment shows a script tag as an example, which cannot sit inside the page; the vendored file stays an exact copy and only the built page drops that comment. */
const trimDoc = (p, s) => p === 'vendor/field-report.js' ? s.replace(/^\/\*![\s\S]*?\*\//, '') : s;
const scripts = jsMin(order.map((p) => { const s = trimDoc(p, clean(rd(p))); bad(p, s); return `/* ---- ${p} ---- */\n` + noEval(p, s); }).join('\n') + '\n' + appText, 'app'); bad('app bundle', scripts);
const css = cssMin(rd('src/app.css')); bad('app.css', css);
let html = rd('src/index.template.html');
const fill = (k, v) => { html = html.split(k).join(v); };
// order matters: the big pieces go in last so their text is never searched for placeholders
html = html.replace('@@CSS@@', () => css).replace('@@ENGINE@@', () => engine).replace('@@SCRIPTS@@', () => scripts);
fill('@@VERSION@@', version);
writeFileSync(join(root, 'index.html'), html);
if (args.has('--pack')) {
  /* Local (non-git) downloads: our own lzma-pack makes a self-unpacking page (LZMA, hash-checked). It lives in the JS-modules repo. */
  const packers = [process.env.NFM_LZMA_PACK, join(root, '..', 'js-modules/tools/lzma-pack/pack.py'), '/home/claude/js-modules/tools/lzma-pack/pack.py'].filter(Boolean);
  const pack = packers.find((p) => { try { readFileSync(p); return true; } catch (e) { return false; } });
  if (!pack) console.warn('lzma-pack not found: clone lfcfoundry/JS-modules next to this folder or set NFM_LZMA_PACK to its tools/lzma-pack/pack.py');
  else {
    const env = Object.assign({}, process.env); if (!env.ESBUILD) { try { const q = createRequire(join('/opt/npm-tools', 'x.js')).resolve('esbuild/package.json'); env.ESBUILD = join(dirname(q), '..', '.bin', 'esbuild'); } catch (e) { /* pack.py will look on the PATH */ } }
    const out = join(root, 'index.packed.html');
    try { process.stdout.write(execFileSync('python3', [pack, join(root, 'index.html'), out, '--title', 'Netflow Map', ...(args.has('--tune') ? ['--tune'] : [])], { env }).toString()); } catch (e) { console.warn('lzma-pack failed: ' + String(e.stderr || e.message).slice(0, 300)); }
  }
  /* The fast-opening copy (the default one to hand out): deflate, opened by the browser's own unpacker in a few milliseconds; the LZMA copy above is the smallest file. */
  try { process.stdout.write(execFileSync('python3', [join(root, 'tools', 'fast-pack.py'), join(root, 'index.html'), join(root, 'index.fast.html'), 'Netflow Map']).toString()); } catch (e) { console.warn('fast-pack failed: ' + String(e.stderr || e.message).slice(0, 300)); }
}
console.log(`built index.html ${(html.length / 1024).toFixed(0)} KB, version ${version}`);

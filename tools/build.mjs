// Builds the one-file app: node tools/build.mjs  ->  index.html
// Copyright (c) 2026 JNFoo. MIT License.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
const g = (t) => parts.find((p) => p.type === t).value;
const version = process.env.NFM_VERSION || `${g('year')}.${+g('month')}.${+g('day')}.${g('hour')}${g('minute')}`;
const order = ['vendor/env-probes.js', 'vendor/back-close.js', 'src/importers.js', 'src/scene.js', 'src/render.js', 'src/probe.js', 'src/engine-client.js', 'src/examples.js', 'src/app.js'];
const clean = (s) => s.replace(/if \(typeof module !== 'undefined' && module\.exports\) module\.exports = \w+;\n?/g, '');
const bad = (name, s) => { if (/<\/script|<!--/i.test(s)) throw new Error(name + ' contains a sequence that would break the page'); };
const engine = clean(rd('src/engine.js')); bad('engine.js', engine);
const scripts = order.map((p) => { const s = clean(rd(p)); bad(p, s); return `/* ---- ${p} ---- */\n` + s; }).join('\n');
const css = rd('src/app.css'); bad('app.css', css);
let html = rd('src/index.template.html');
const fill = (k, v) => { html = html.split(k).join(v); };
// order matters: the big pieces go in last so their text is never searched for placeholders
html = html.replace('@@CSS@@', () => css).replace('@@ENGINE@@', () => engine).replace('@@SCRIPTS@@', () => scripts);
fill('@@VERSION@@', version);
writeFileSync(join(root, 'index.html'), html);
console.log(`built index.html ${(html.length / 1024).toFixed(0)} KB, version ${version}`);

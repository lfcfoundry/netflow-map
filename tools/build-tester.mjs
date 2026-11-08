// Builds the one-file laptop tester: node tools/build-tester.mjs  ->  bench/netflow-map-tester.html
// Copyright (c) 2026 LFC Foundry. MIT License.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
const g = (t) => parts.find((p) => p.type === t).value;
const version = process.env.NFM_VERSION || `${g('year')}.${+g('month')}.${+g('day')}.${g('hour')}${g('minute')}`;
const clean = (s) => s.replace(/if \(typeof module !== 'undefined' && module\.exports\) module\.exports = \w+;\n?/g, '');
const phone = process.argv.includes('--phone');   /* --phone: the phone tester, the same page plus the real app inside it and a touch checklist */
const files = ['src/columns.js', 'src/importers.js', 'vendor/netflow-layers.js', 'vendor/graph-walk.js', 'src/engine.js', 'src/sim.js', 'src/check.js', 'bench/gen.js', 'src/gpustress.js', 'vendor/netflow-scene.js', 'src/scene-alias.js', 'src/render.js', 'src/probe.js', 'bench/tester/tester.js', ...(phone ? ['bench/tester/phone.js'] : [])];
const code = files.map((f) => { const s = clean(rd(f)).replace(/__VERSION__/g, version); if (/<\/script|<!--/i.test(s)) throw new Error(f + ' contains a sequence that would break the page'); return `/* ---- ${f} ---- */\n${s}`; }).join('\n');
const appB64 = phone ? readFileSync(join(root, 'index.html')).toString('base64') : '';
let html = rd('bench/tester/template.html').replace(/__VERSION__/g, version).replace('__SCRIPTS__', () => (phone ? `window.__NFM_APP_B64="${appB64}";\n` : '') + code);
if (phone) html = html.replace('<title>Netflow Map Tester</title>', '<title>Netflow Map Phone Tester</title>').replace('<h1>Netflow Map Tester</h1>', '<h1>Netflow Map Phone Tester</h1>').replace('It takes a few minutes. Leave this tab in front and let it finish;', 'It takes about 5 minutes, then asks you to try 15 touch actions. Keep the phone awake and this tab in front;').replace(/default-src 'none'/, "default-src 'none'");
const outName = phone ? 'bench/netflow-map-phone-tester.html' : 'bench/netflow-map-tester.html';
writeFileSync(join(root, outName), html);
console.log(`built ${outName} ${(html.length / 1024) | 0} KB, version ${version}`);

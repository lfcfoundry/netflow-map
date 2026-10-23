// Builds the one-file Force-on-the-card lab: node tools/build-force-lab.mjs  ->  bench/netflow-map-force-card.html
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
const files = ['src/columns.js', 'src/importers.js', 'vendor/netflow-layers.js', 'src/engine.js', 'bench/gen.js', 'src/gpustress.js', 'bench/force-card/lab.js'];
const code = files.map((f) => { const s = clean(rd(f)).replace(/__VERSION__/g, version); if (/<\/script|<!--/i.test(s)) throw new Error(f + ' contains a sequence that would break the page'); return `/* ---- ${f} ---- */\n${s}`; }).join('\n');
const html = rd('bench/force-card/template.html').replace(/__VERSION__/g, version).replace('__SCRIPTS__', () => code);
writeFileSync(join(root, 'bench/netflow-map-force-card.html'), html);
console.log(`built bench/netflow-map-force-card.html ${(html.length / 1024) | 0} KB, version ${version}`);

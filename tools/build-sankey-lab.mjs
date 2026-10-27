// Builds the sankey before-and-after page: node tools/build-sankey-lab.mjs  ->  bench/netflow-map-sankey.html
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
const files = ['src/columns.js', 'src/importers.js', 'vendor/netflow-layers.js', 'vendor/graph-walk.js', 'src/engine.js', 'src/sim.js', 'src/check.js', 'src/examples.js', 'vendor/netflow-scene.js', 'src/scene-alias.js', 'vendor/netflow-sankey.js', 'test/sankey-measure.js', 'bench/sankey/lab.js'];
const code = files.map((f) => { const s = clean(rd(f)).replace(/__VERSION__/g, version); if (/<\/script|<!--/i.test(s)) throw new Error(f + ' contains a sequence that would break the page'); return `/* ---- ${f} ---- */\n${s}`; }).join('\n');
const html = rd('bench/sankey/template.html').replace(/__VERSION__/g, version).replace('__SCRIPTS__', () => code);
writeFileSync(join(root, 'bench/netflow-map-sankey.html'), html);
console.log(`built bench/netflow-map-sankey.html ${(html.length / 1024) | 0} KB, version ${version}`);

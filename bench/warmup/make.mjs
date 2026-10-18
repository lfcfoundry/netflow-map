// Copyright (c) 2026 LFC Foundry. MIT License. Builds bench/warmup/page.html: times the FIRST layout of a 3,000-item map in a layout worker that was left idle for 2 s, with the idle warm-up on against off. Run: node bench/warmup/make.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), rd = (p) => readFileSync(join(root, p), 'utf8');
const clean = (s) => s.replace(/if \(typeof module !== 'undefined' && module\.exports\) module\.exports = \w+;\n?/g, '');
const engine = ['src/columns.js', 'src/pack.js', 'src/sankey.js', 'vendor/netflow-layers.js', 'src/engine.js', 'src/sim.js', 'src/check.js'].map((p) => clean(rd(p))).join('\n');
const client = clean(rd('src/engine-client.js')), examples = clean(rd('src/examples.js'));
for (const [n, s] of [['engine', engine], ['client', client], ['examples', examples]]) if (/<\/script|<!--/i.test(s)) throw new Error(n + ' would break the page');
const html = `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><title>Netflow Map worker warm-up bench</title></head><body><pre id="out">ready</pre>
<script type="text/plain" id="eng">${engine}</script>
<script>${examples}</script><script>${client}</script>
<script>
var engineSrc = document.getElementById('eng').textContent, pageEngine = null;
function getEngine() { if (!pageEngine) { var s = document.createElement('script'); s.textContent = engineSrc; document.head.appendChild(s); pageEngine = window.NFMEngine; } return pageEngine; }
var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
/* One round: a fresh worker, left idle for idleMs, then the first layout of a 3,000-item network. warm = the idle warm-up on or off. */
async function round(warm, items, idleMs) {
  var g = NFMExamples.bigNetwork(items, 12, 7), c = new NFMEngineClient.Client(engineSrc, getEngine);
  c.warmAfter = warm ? 1500 : 0;
  await c.start(); await c.setGraph(JSON.parse(JSON.stringify(g)));
  await wait(idleMs);
  var t0 = performance.now(); await c.run('build', { view: 'network', colorBy: 'group' }); var ms = performance.now() - t0;
  var warmed = c.warmed; try { c.w.terminate(); } catch (e) { /* gone */ }
  return { ms: Math.round(ms), warmed: warmed, mode: c.mode };
}
window.__warmBench = async function (items, rounds, idleMs) {
  var out = { off: [], on: [], modes: {} }, i, w;
  await round(false, 300, 100);   // loads the page's own code once, outside the timing
  for (i = 0; i < rounds; i++) { var order = i % 2 ? [true, false] : [false, true]; for (w = 0; w < 2; w++) { var r = await round(order[w], items, idleMs); out[order[w] ? 'on' : 'off'].push(r.ms); out.modes[r.mode + (r.warmed ? '+warmed' : '')] = 1; } }
  return out;
};
</script></body></html>`;
writeFileSync(join(root, 'bench/warmup/page.html'), html);
console.log('wrote bench/warmup/page.html', Math.round(html.length / 1024), 'KB');
